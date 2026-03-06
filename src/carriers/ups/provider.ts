import { RateProvider } from '../base';
import { RateRequest, RateQuote } from '../../domain/rate';
import { ValidationError } from '../../domain/errors';
import { UpsClient } from './client';
import { UpsMapper } from './mapper';
import { RateRequestSchema } from '../../domain/rate';

export class UpsRateProvider implements RateProvider {
  constructor(private readonly client: UpsClient) {}

  async getRates(req: RateRequest): Promise<RateQuote[]> {
    const validation = RateRequestSchema.safeParse(req);
    if (!validation.success) {
      throw new ValidationError('Invalid rate request', {
        errors: validation.error.errors,
      });
    }

    const upsReq = UpsMapper.toUpsRateRequest(validation.data);
    const upsRes = await this.client.rate(upsReq);

    const ratedShipments = upsRes.RateResponse.RatedShipment;
    if (!ratedShipments || ratedShipments.length === 0) {
      return [];
    }

    return ratedShipments.map((rated) => UpsMapper.fromUpsRatedShipment(rated));
  }
}
