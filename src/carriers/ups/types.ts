export interface UpsOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_at: string;
  client_id: string;
  status: string;
}

export interface UpsAddress {
  AddressLine?: string[];
  City: string;
  StateProvinceCode: string;
  PostalCode: string;
  CountryCode: string;
}

export interface UpsPackageDimensions {
  UnitOfMeasurement: {
    Code: string;
  };
  Length: string;
  Width: string;
  Height: string;
}

export interface UpsPackageWeight {
  UnitOfMeasurement: {
    Code: string;
  };
  Weight: string;
}

export interface UpsPackage {
  PackagingType: {
    Code: string;
  };
  Dimensions: UpsPackageDimensions;
  PackageWeight: UpsPackageWeight;
}

export interface UpsShipment {
  Shipper: {
    Address: UpsAddress;
  };
  ShipTo: {
    Address: UpsAddress;
  };
  ShipFrom: {
    Address: UpsAddress;
  };
  Package: UpsPackage[];
  Service?: {
    Code: string;
  };
}

export interface UpsRateRequest {
  RateRequest: {
    Request: {
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    Shipment: UpsShipment;
  };
}

export interface UpsRatedShipment {
  Service: {
    Code: string;
    Name?: string;
  };
  TotalCharges: {
    CurrencyCode: string;
    MonetaryValue: string;
  };
  TimeInTransit?: {
    ServiceSummary?: {
      EstimatedArrival?: {
        BusinessDaysInTransit?: string;
        Date?: string;
      };
    };
  };
}

export interface UpsRateResponse {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
    };
    RatedShipment: UpsRatedShipment[];
  };
}

export interface UpsErrorResponse {
  response?: {
    errors?: Array<{
      code: string;
      message: string;
    }>;
  };
}
