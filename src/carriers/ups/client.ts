import axios, { AxiosInstance, AxiosError } from 'axios';
import { UpsAuthManager } from './auth';
import { UpsRateRequest, UpsRateResponse, UpsErrorResponse } from './types';
import {
  CarrierError,
  ErrorCode,
  NetworkError,
  RateLimitError,
  TimeoutError,
  AuthError,
} from '../../domain/errors';

export class UpsClient {
  private readonly http: AxiosInstance;
  private readonly auth: UpsAuthManager;

  constructor(baseUrl: string, auth: UpsAuthManager, timeoutMs = 30000) {
    this.auth = auth;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async rate(req: UpsRateRequest): Promise<UpsRateResponse> {
    return this.makeRequest<UpsRateResponse>('/api/rating/v1/Rate', req);
  }

  private async makeRequest<T>(endpoint: string, data: unknown, retryAuth = true): Promise<T> {
    try {
      const token = await this.auth.getToken();

      const response = await this.http.post<T>(endpoint, data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (err) {
      if (err instanceof CarrierError) {
        throw err;
      }
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 && retryAuth) {
          await this.auth.refreshToken();
          return this.makeRequest<T>(endpoint, data, false);
        }

        throw this.handleAxiosError(err);
      }

      throw new CarrierError(ErrorCode.UNKNOWN_ERROR, 'Unexpected error', {
        error: String(err),
      });
    }
  }

  private handleAxiosError(err: AxiosError<unknown>): CarrierError {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new TimeoutError('Request timed out', { code: err.code });
    }

    if (!err.response) {
      return new NetworkError('Network error: no response received', {
        message: err.message,
      });
    }

    const { status, data } = err.response;
    const body = data as UpsErrorResponse | undefined;

    if (status === 401 || status === 403) {
      return new AuthError('Authentication failed', {
        status,
        errors: body?.response?.errors,
      });
    }

    if (status === 429) {
      return new RateLimitError('Rate limit exceeded', { status });
    }

    if (status >= 400 && status < 500) {
      return new CarrierError(ErrorCode.CARRIER_ERROR, 'Client error from carrier', {
        status,
        errors: body?.response?.errors,
      });
    }

    if (status >= 500) {
      return new CarrierError(ErrorCode.CARRIER_ERROR, 'Server error from carrier', {
        status,
      });
    }

    return new CarrierError(ErrorCode.UNKNOWN_ERROR, 'Unknown carrier error', {
      status,
    });
  }
}
