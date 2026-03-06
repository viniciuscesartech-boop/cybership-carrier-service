import axios, { AxiosInstance } from 'axios';
import { AuthProvider } from '../base';
import { AuthError } from '../../domain/errors';

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class UpsAuthManager implements AuthProvider {
  private cache: TokenCache | null = null;
  private readonly client: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async getToken(): Promise<string> {
    if (this.cache && this.isValid(this.cache)) {
      return this.cache.token;
    }
    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await this.client.post<{
        access_token: string;
        expires_in: number;
      }>('/security/v1/oauth/token', 'grant_type=client_credentials', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
      });

      const { access_token, expires_in } = response.data;
      const bufferSeconds = 60;
      const expiresAt = Date.now() + (expires_in - bufferSeconds) * 1000;

      this.cache = {
        token: access_token,
        expiresAt,
      };

      return access_token;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new AuthError('Failed to obtain UPS access token', {
          status: err.response?.status,
          message: err.message,
        });
      }
      throw new AuthError('Unknown auth error', { error: String(err) });
    }
  }

  private isValid(cache: TokenCache): boolean {
    return Date.now() < cache.expiresAt;
  }
}
