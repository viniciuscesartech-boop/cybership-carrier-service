import { Address } from '../../domain/address';
import { Package } from '../../domain/package';
import { RateRequest, RateQuote } from '../../domain/rate';
import { UpsAddress, UpsPackage, UpsRateRequest, UpsRatedShipment } from './types';

export class UpsMapper {
  static toUpsAddress(addr: Address): UpsAddress {
    return {
      AddressLine: [addr.street],
      City: addr.city,
      StateProvinceCode: addr.state,
      PostalCode: addr.zip,
      CountryCode: addr.country,
    };
  }

  static toUpsPackage(pkg: Package): UpsPackage {
    return {
      PackagingType: {
        Code: '02',
      },
      Dimensions: {
        UnitOfMeasurement: {
          Code: pkg.dimensions.unit,
        },
        Length: pkg.dimensions.length.toString(),
        Width: pkg.dimensions.width.toString(),
        Height: pkg.dimensions.height.toString(),
      },
      PackageWeight: {
        UnitOfMeasurement: {
          Code: pkg.weight.unit,
        },
        Weight: pkg.weight.value.toString(),
      },
    };
  }

  static toUpsRateRequest(req: RateRequest): UpsRateRequest {
    const shipment: UpsRateRequest['RateRequest']['Shipment'] = {
      Shipper: {
        Address: this.toUpsAddress(req.origin),
      },
      ShipTo: {
        Address: this.toUpsAddress(req.destination),
      },
      ShipFrom: {
        Address: this.toUpsAddress(req.origin),
      },
      Package: req.packages.map((pkg) => this.toUpsPackage(pkg)),
    };

    if (req.serviceLevel) {
      shipment.Service = {
        Code: req.serviceLevel,
      };
    }

    return {
      RateRequest: {
        Request: {
          TransactionReference: {
            CustomerContext: 'RateRequest',
          },
        },
        Shipment: shipment,
      },
    };
  }

  static fromUpsRatedShipment(rated: UpsRatedShipment): RateQuote {
    return {
      carrier: 'UPS',
      service: rated.Service.Name || rated.Service.Code,
      serviceCode: rated.Service.Code,
      totalCost: parseFloat(rated.TotalCharges.MonetaryValue),
      currency: rated.TotalCharges.CurrencyCode,
      deliveryDays: rated.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit
        ? parseInt(rated.TimeInTransit.ServiceSummary.EstimatedArrival.BusinessDaysInTransit, 10)
        : undefined,
      deliveryDate: rated.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Date,
    };
  }
}
