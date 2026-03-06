import { RateRequest, RateQuote } from '../domain/rate';

export interface RateProvider {
  getRates(req: RateRequest): Promise<RateQuote[]>;
}

export interface AuthProvider {
  getToken(): Promise<string>;
  refreshToken(): Promise<string>;
}
