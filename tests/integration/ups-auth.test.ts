import nock from 'nock';
import { UpsAuthManager } from '../../src/carriers/ups/auth';
import { AuthError } from '../../src/domain/errors';
import { mockTokenResponse } from '../fixtures/ups-responses';

describe('UpsAuthManager', () => {
  const baseUrl = 'https://test.ups.com';
  const clientId = 'test_client';
  const clientSecret = 'test_secret';

  let authManager: UpsAuthManager;

  beforeEach(() => {
    nock.cleanAll();
    authManager = new UpsAuthManager(baseUrl, clientId, clientSecret);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Token acquisition', () => {
    it('should obtain token with correct credentials', async () => {
      const scope = nock(baseUrl)
        .post('/security/v1/oauth/token', 'grant_type=client_credentials')
        .matchHeader('authorization', (val) => {
          const expected = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          return val === `Basic ${expected}`;
        })
        .reply(200, mockTokenResponse);

      const token = await authManager.getToken();

      expect(token).toBe(mockTokenResponse.access_token);
      expect(scope.isDone()).toBe(true);
    });

    it('should throw AuthError on failed authentication', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(401, { error: 'Invalid credentials' });

      await expect(authManager.getToken()).rejects.toThrow(AuthError);
    });
  });

  describe('Token caching', () => {
    it('should cache and reuse valid token', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').once().reply(200, mockTokenResponse);

      const token1 = await authManager.getToken();
      const token2 = await authManager.getToken();

      expect(token1).toBe(token2);
      expect(nock.pendingMocks()).toHaveLength(0);
    });

    it('should refresh expired token', async () => {
      const shortLivedToken = {
        ...mockTokenResponse,
        expires_in: 1,
      };

      nock(baseUrl).post('/security/v1/oauth/token').reply(200, shortLivedToken);

      const token1 = await authManager.getToken();

      await new Promise((resolve) => setTimeout(resolve, 1100));

      nock(baseUrl)
        .post('/security/v1/oauth/token')
        .reply(200, { ...mockTokenResponse, access_token: 'new_token' });

      const token2 = await authManager.getToken();

      expect(token1).not.toBe(token2);
      expect(token2).toBe('new_token');
    });
  });

  describe('Token refresh', () => {
    it('should explicitly refresh token', async () => {
      nock(baseUrl).post('/security/v1/oauth/token').reply(200, mockTokenResponse);

      const token1 = await authManager.getToken();

      nock(baseUrl)
        .post('/security/v1/oauth/token')
        .reply(200, { ...mockTokenResponse, access_token: 'refreshed_token' });

      const token2 = await authManager.refreshToken();

      expect(token1).not.toBe(token2);
      expect(token2).toBe('refreshed_token');
    });
  });
});
