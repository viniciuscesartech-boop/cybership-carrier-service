import { UpsRateResponse, UpsOAuthTokenResponse } from '../../src/carriers/ups/types';

export const mockTokenResponse: UpsOAuthTokenResponse = {
  access_token: 'mock_access_token_12345',
  token_type: 'Bearer',
  expires_in: 3600,
  issued_at: new Date().toISOString(),
  client_id: 'test_client_id',
  status: 'approved',
};

export const mockSuccessRateResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: '1',
        Description: 'Success',
      },
    },
    RatedShipment: [
      {
        Service: {
          Code: '03',
          Name: 'UPS Ground',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '12.45',
        },
        TimeInTransit: {
          ServiceSummary: {
            EstimatedArrival: {
              BusinessDaysInTransit: '3',
              Date: '2026-03-09',
            },
          },
        },
      },
      {
        Service: {
          Code: '02',
          Name: 'UPS 2nd Day Air',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '24.89',
        },
        TimeInTransit: {
          ServiceSummary: {
            EstimatedArrival: {
              BusinessDaysInTransit: '2',
              Date: '2026-03-08',
            },
          },
        },
      },
      {
        Service: {
          Code: '01',
          Name: 'UPS Next Day Air',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '45.67',
        },
        TimeInTransit: {
          ServiceSummary: {
            EstimatedArrival: {
              BusinessDaysInTransit: '1',
              Date: '2026-03-07',
            },
          },
        },
      },
    ],
  },
};

export const mockErrorResponse = {
  response: {
    errors: [
      {
        code: '250003',
        message: 'Invalid Access License number',
      },
    ],
  },
};

export const mockMalformedResponse = {
  unexpected: 'structure',
  missing: 'required fields',
};
