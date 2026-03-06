import nock from 'nock';
import { UpsRateProvider } from '../../src/carriers/ups/provider';
import { UpsClient } from '../../src/carriers/ups/client';
import { UpsAuthManager } from '../../src/carriers/ups/auth';
import { RateRequest } from '../../src/domain/rate';
import { ValidationError, AuthError, RateLimitError, NetworkError } from '../../src/domain/errors';
import {
  mockTokenResponse,
  mockSuccessRateResponse,
  mockErrorResponse,
} from '../fixtures/ups-responses';

describe('UpsRateProvider Integration', () => {
  const baseUrl = 'https://test.ups.com';
  const clientId = 'test_client_id';
  const clientSecret = 'test_client_secret';

  let provider: UpsRateProvider;
  let auth: UpsAuthManager;
  let client: UpsClient;

  const validRequest: RateRequest = {
    origin: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    destination: {
      street: '456 Market St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
    },
    packages: [
      {
        dimensions: {
          length: 10,
          width: 8,
          height: 6,
          unit: 'IN',
        },
        weight: {
          value: 5,
          unit: 'LBS',
        },
      },
    ],
  };

  beforeEach(() => {
    nock.cleanAll();
    auth = new UpsAuthManager(baseUrl, clientId, clientSecret);
    client = new UpsClient(baseUrl, auth);
    provider = new UpsRateProvider(client);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Successful rate request', () => {
    it('should fetch and normalize rate quotes', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      nock(baseUrl).post('/api/rating/v1/Rate').reply(200, mockSuccessRateResponse);

      const quotes = await provider.getRates(validRequest);

      expect(quotes).toHaveLength(3);
      expect(quotes[0]).toMatchObject({
        carrier: 'UPS',
        service: 'UPS Ground',
        serviceCode: '03',
        totalCost: 12.45,
        currency: 'USD',
        deliveryDays: 3,
        deliveryDate: '2026-03-09',
      });
      expect(quotes[1].serviceCode).toBe('02');
      expect(quotes[2].serviceCode).toBe('01');
    });

    it('should filter by service level when provided', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      nock(baseUrl)
        .post('/api/rating/v1/Rate', (body) => {
          const parsed = body as { RateRequest: { Shipment: { Service?: { Code: string } } } };
          return parsed.RateRequest.Shipment.Service?.Code === '03';
        })
        .reply(200, {
          RateResponse: {
            Response: {
              ResponseStatus: {
                Code: '1',
                Description: 'Success',
              },
            },
            RatedShipment: [mockSuccessRateResponse.RateResponse.RatedShipment[0]],
          },
        });

      const quotes = await provider.getRates({
        ...validRequest,
        serviceLevel: '03',
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].serviceCode).toBe('03');
    });
  });

  describe('Authentication lifecycle', () => {
    it('should acquire token on first request', async () => {
      const tokenScope = nock(baseUrl)
        .post('/security/v1/oauth/token')
        .reply(200, mockTokenResponse);

      nock(baseUrl).post('/api/rating/v1/Rate').reply(200, mockSuccessRateResponse);

      await provider.getRates(validRequest);

      expect(tokenScope.isDone()).toBe(true);
    });

    it('should reuse cached token for subsequent requests', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').once().reply(200, mockTokenResponse);

      nock(baseUrl).post('/api/rating/v1/Rate').times(2).reply(200, mockSuccessRateResponse);

      await provider.getRates(validRequest);
      await provider.getRates(validRequest);

      expect(nock.pendingMocks()).toHaveLength(0);
    });

    it('should refresh token on 401 and retry', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      nock(baseUrl).post('/api/rating/v1/Rate').reply(401, { error: 'Unauthorized' });

      nock(baseUrl)
        .post('/security/v1/oauth/token')
        .reply(200, { ...mockTokenResponse, access_token: 'new_token' });

      nock(baseUrl).post('/api/rating/v1/Rate').reply(200, mockSuccessRateResponse);

      const quotes = await provider.getRates(validRequest);

      expect(quotes).toHaveLength(3);
    });
  });

  describe('Validation', () => {
    it('should reject invalid origin address', async () => {
      const invalidReq = {
        ...validRequest,
        origin: {
          ...validRequest.origin,
          state: 'INVALID',
        },
      };

      await expect(provider.getRates(invalidReq)).rejects.toThrow(ValidationError);
    });

    it('should reject invalid package dimensions', async () => {
      const invalidReq = {
        ...validRequest,
        packages: [
          {
            dimensions: {
              length: -5,
              width: 8,
              height: 6,
              unit: 'IN' as const,
            },
            weight: {
              value: 5,
              unit: 'LBS' as const,
            },
          },
        ],
      };

      await expect(provider.getRates(invalidReq)).rejects.toThrow(ValidationError);
    });

    it('should reject empty packages array', async () => {
      const invalidReq = {
        ...validRequest,
        packages: [],
      };

      await expect(provider.getRates(invalidReq)).rejects.toThrow(ValidationError);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);
    });

    it('should handle 4xx client errors', async () => {
      nock(baseUrl).post('/api/rating/v1/Rate').reply(400, mockErrorResponse);

      await expect(provider.getRates(validRequest)).rejects.toMatchObject({
        code: 'CARRIER_ERROR',
        message: expect.stringContaining('Client error') as string,
      });
    });

    it('should handle 5xx server errors', async () => {
      nock(baseUrl).post('/api/rating/v1/Rate').reply(500, { error: 'Internal Server Error' });

      await expect(provider.getRates(validRequest)).rejects.toMatchObject({
        code: 'CARRIER_ERROR',
        message: expect.stringContaining('Server error') as string,
      });
    });

    it('should handle rate limiting', async () => {
      nock(baseUrl).post('/api/rating/v1/Rate').reply(429, { error: 'Too Many Requests' });

      await expect(provider.getRates(validRequest)).rejects.toThrow(RateLimitError);
    });

    it('should handle network timeouts', async () => {
      nock(baseUrl)
        .post('/api/rating/v1/Rate')
        .delayConnection(35000)
        .reply(200, mockSuccessRateResponse);

      await expect(provider.getRates(validRequest)).rejects.toMatchObject({
        name: 'TimeoutError',
      });
    }, 40000);

    it('should handle network failures', async () => {
      nock(baseUrl).post('/api/rating/v1/Rate').replyWithError('Network failure');

      await expect(provider.getRates(validRequest)).rejects.toThrow(NetworkError);
    });

    it('should handle auth failures', async () => {
      nock.cleanAll();

      nock(baseUrl).post('/security/v1/oauth/token').reply(401, { error: 'Invalid credentials' });

      await expect(provider.getRates(validRequest)).rejects.toThrow(AuthError);
    });
  });

  describe('Request building', () => {
    it('should build correct UPS request payload', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      const rateScope = nock(baseUrl)
        .post('/api/rating/v1/Rate', (body) => {
          const req = body as {
            RateRequest: {
              Shipment: {
                Shipper: { Address: { City: string } };
                ShipTo: { Address: { City: string } };
                Package: Array<{ PackageWeight: { Weight: string } }>;
              };
            };
          };
          return (
            req.RateRequest.Shipment.Shipper.Address.City === 'San Francisco' &&
            req.RateRequest.Shipment.ShipTo.Address.City === 'New York' &&
            req.RateRequest.Shipment.Package[0].PackageWeight.Weight === '5'
          );
        })
        .reply(200, mockSuccessRateResponse);

      await provider.getRates(validRequest);

      expect(rateScope.isDone()).toBe(true);
    });

    it('should include service code when serviceLevel is specified', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      const rateScope = nock(baseUrl)
        .post('/api/rating/v1/Rate', (body) => {
          const req = body as {
            RateRequest: {
              Shipment: {
                Service?: { Code: string };
              };
            };
          };
          return req.RateRequest.Shipment.Service?.Code === '01';
        })
        .reply(200, mockSuccessRateResponse);

      await provider.getRates({
        ...validRequest,
        serviceLevel: '01',
      });

      expect(rateScope.isDone()).toBe(true);
    });
  });
});
