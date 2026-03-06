import { UpsMapper } from '../../src/carriers/ups/mapper';
import { RateRequest } from '../../src/domain/rate';
import { mockSuccessRateResponse } from '../fixtures/ups-responses';

describe('UpsMapper', () => {
  const sampleRequest: RateRequest = {
    origin: {
      street: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      country: 'US',
    },
    destination: {
      street: '789 Broadway',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
      country: 'US',
    },
    packages: [
      {
        dimensions: {
          length: 12,
          width: 10,
          height: 8,
          unit: 'IN',
        },
        weight: {
          value: 10,
          unit: 'LBS',
        },
      },
    ],
  };

  describe('toUpsRateRequest', () => {
    it('should map domain request to UPS format', () => {
      const upsReq = UpsMapper.toUpsRateRequest(sampleRequest);

      expect(upsReq.RateRequest.Shipment.Shipper.Address).toMatchObject({
        City: 'Los Angeles',
        StateProvinceCode: 'CA',
        PostalCode: '90001',
        CountryCode: 'US',
      });

      expect(upsReq.RateRequest.Shipment.ShipTo.Address).toMatchObject({
        City: 'Seattle',
        StateProvinceCode: 'WA',
        PostalCode: '98101',
      });

      expect(upsReq.RateRequest.Shipment.Package).toHaveLength(1);
      expect(upsReq.RateRequest.Shipment.Package[0].PackageWeight.Weight).toBe('10');
      expect(upsReq.RateRequest.Shipment.Package[0].Dimensions.Length).toBe('12');
    });

    it('should include service code when serviceLevel provided', () => {
      const withService = {
        ...sampleRequest,
        serviceLevel: '01',
      };

      const upsReq = UpsMapper.toUpsRateRequest(withService);

      expect(upsReq.RateRequest.Shipment.Service?.Code).toBe('01');
    });

    it('should omit service when no serviceLevel provided', () => {
      const upsReq = UpsMapper.toUpsRateRequest(sampleRequest);

      expect(upsReq.RateRequest.Shipment.Service).toBeUndefined();
    });
  });

  describe('fromUpsRatedShipment', () => {
    it('should map UPS response to domain quote', () => {
      const upsRated = mockSuccessRateResponse.RateResponse.RatedShipment[0];
      const quote = UpsMapper.fromUpsRatedShipment(upsRated);

      expect(quote).toMatchObject({
        carrier: 'UPS',
        service: 'UPS Ground',
        serviceCode: '03',
        totalCost: 12.45,
        currency: 'USD',
        deliveryDays: 3,
        deliveryDate: '2026-03-09',
      });
    });

    it('should handle missing optional fields', () => {
      const minimalRated = {
        Service: {
          Code: '99',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '15.00',
        },
      };

      const quote = UpsMapper.fromUpsRatedShipment(minimalRated);

      expect(quote).toMatchObject({
        carrier: 'UPS',
        service: '99',
        serviceCode: '99',
        totalCost: 15.0,
        currency: 'USD',
      });
      expect(quote.deliveryDays).toBeUndefined();
      expect(quote.deliveryDate).toBeUndefined();
    });
  });
});
