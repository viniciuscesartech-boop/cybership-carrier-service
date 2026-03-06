import { getEnv } from './config/env';
import { UpsAuthManager } from './carriers/ups/auth';
import { UpsClient } from './carriers/ups/client';
import { UpsRateProvider } from './carriers/ups/provider';
import { RateProvider } from './carriers/base';

export { RateRequest, RateQuote } from './domain/rate';
export { Address } from './domain/address';
export { Package, Dimensions, Weight } from './domain/package';
export {
  CarrierError,
  ValidationError,
  AuthError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ErrorCode,
} from './domain/errors';
export { RateProvider } from './carriers/base';

export function createUpsRateProvider(): RateProvider {
  const env = getEnv();
  const auth = new UpsAuthManager(env.UPS_BASE_URL, env.UPS_CLIENT_ID, env.UPS_CLIENT_SECRET);
  const client = new UpsClient(env.UPS_BASE_URL, auth, env.UPS_TIMEOUT_MS);
  return new UpsRateProvider(client);
}
