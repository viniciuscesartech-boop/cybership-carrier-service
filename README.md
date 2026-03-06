# Carrier Integration Service

A production-ready, extensible TypeScript service for integrating with shipping carriers. Currently supports UPS Rating API with architecture designed for easy addition of new carriers (FedEx, USPS, DHL) and operations (label purchase, tracking, address validation).

## Design Decisions

### Architecture

**Domain-Driven Design**: Core domain models (`Address`, `Package`, `RateRequest`, `RateQuote`) are carrier-agnostic. Callers interact only with these domain types, never with carrier-specific formats.

**Provider Pattern**: Each carrier implements the `RateProvider` interface. Adding a new carrier means creating a new provider implementation without touching existing code.

**Separation of Concerns**:
- **Domain layer**: Business entities and validation rules
- **Carrier layer**: Carrier-specific implementations isolated in separate modules
- **Config layer**: Environment-based configuration with validation

**Mapper Pattern**: Dedicated mappers (`UpsMapper`) translate between domain models and carrier API formats, keeping the translation logic isolated and testable.

**Auth Abstraction**: `UpsAuthManager` implements `AuthProvider` interface, handling OAuth token lifecycle (acquisition, caching, refresh) transparently. The HTTP client automatically refreshes tokens on 401 responses.

### Type Safety

- **Zod schemas** for runtime validation of all inputs and configuration
- **Strict TypeScript** with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- **No `any` types** enforced via ESLint rules
- Separate types for domain models vs carrier API shapes

### Error Handling

Structured error hierarchy with specific error types:
- `ValidationError`: Invalid input data
- `AuthError`: Authentication failures
- `NetworkError`: Connection issues
- `TimeoutError`: Request timeouts
- `RateLimitError`: Rate limiting (429)
- `CarrierError`: Generic carrier errors

All errors include error codes and optional details for debugging.

### Testing Strategy

**Integration tests** with stubbed HTTP layer using `nock`:
- Verify request payload construction from domain models
- Verify response parsing and normalization
- Test auth token lifecycle (acquisition, caching, refresh on expiry)
- Test all error paths (4xx, 5xx, timeouts, network failures, malformed responses)

No live API calls required; all carrier responses are stubbed with realistic payloads from UPS documentation.

## Project Structure

```
carrier-integration-service/
├── src/
│   ├── domain/              # Carrier-agnostic domain models
│   │   ├── address.ts       # Address with validation
│   │   ├── package.ts       # Package dimensions and weight
│   │   ├── rate.ts          # Rate request and quote types
│   │   └── errors.ts        # Structured error hierarchy
│   ├── carriers/
│   │   ├── base.ts          # Provider interfaces
│   │   └── ups/
│   │       ├── auth.ts      # OAuth token manager with caching
│   │       ├── client.ts    # HTTP client with error handling
│   │       ├── mapper.ts    # Domain ↔ UPS format translation
│   │       ├── provider.ts  # UPS rate provider implementation
│   │       └── types.ts     # UPS API request/response types
│   ├── config/
│   │   └── env.ts           # Environment config with validation
│   └── index.ts             # Public API
├── tests/
│   ├── fixtures/            # Stubbed UPS API responses
│   │   └── ups-responses.ts
│   └── integration/         # End-to-end integration tests
│       ├── ups-rate-provider.test.ts
│       ├── ups-auth.test.ts
│       └── ups-mapper.test.ts
└── ...config files
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your UPS API credentials:
```env
UPS_CLIENT_ID=your_client_id
UPS_CLIENT_SECRET=your_client_secret
```

### Build

```bash
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# With coverage
npm test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Check formatting
npm run format:check
```

## Usage

```typescript
import { createUpsRateProvider, RateRequest } from 'carrier-integration-service';

const provider = createUpsRateProvider();

const request: RateRequest = {
  origin: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
  },
  destination: {
    street: '456 Market St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'US',
  },
  packages: [
    {
      dimensions: {
        length: 10,
        width: 8,
        height: 6,
        unit: 'IN',
      },
      weight: {
        value: 5,
        unit: 'LBS',
      },
    },
  ],
  serviceLevel: '03', // Optional: filter by UPS service code
};

try {
  const quotes = await provider.getRates(request);
  quotes.forEach((quote) => {
    console.log(`${quote.service}: $${quote.totalCost} ${quote.currency}`);
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid request:', error.details);
  } else if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else {
    console.error('Error:', error);
  }
}
```

## Extensibility

### Adding a New Carrier (e.g., FedEx)

1. Create `src/carriers/fedex/` directory
2. Implement `FedExRateProvider` implementing `RateProvider` interface
3. Create carrier-specific types, auth, client, and mapper
4. Export factory function in `src/index.ts`:
```typescript
export function createFedExRateProvider(): RateProvider { ... }
```

No changes to domain models or existing UPS code required.

### Adding a New Operation (e.g., Label Purchase)

1. Define domain types in `src/domain/label.ts`
2. Create `LabelProvider` interface in `src/carriers/base.ts`
3. Implement for each carrier (e.g., `UpsLabelProvider`)
4. Reuse existing auth and client infrastructure

### Multi-Carrier Rate Shopping

```typescript
const ups = createUpsRateProvider();
const fedex = createFedExRateProvider();

const [upsQuotes, fedexQuotes] = await Promise.all([
  ups.getRates(request),
  fedex.getRates(request),
]);

const allQuotes = [...upsQuotes, ...fedexQuotes].sort((a, b) => a.totalCost - b.totalCost);
```

## What I Would Improve With More Time

### Functionality
- **Retry logic**: Exponential backoff for transient failures
- **Request validation**: More sophisticated address validation (real postal codes, international formats)
- **Response validation**: Zod schemas for carrier responses to catch malformed data
- **Logging**: Structured logging with correlation IDs for request tracing
- **Metrics**: Instrumentation for latency, error rates, cache hit rates

### Testing
- **Unit tests**: Isolated tests for mapper, auth manager, error handling
- **Contract tests**: Verify our understanding of UPS API matches reality
- **Load tests**: Token refresh under concurrent load
- **Edge cases**: International addresses, multi-package shipments, all UPS service codes

### Operations
- **Health checks**: Endpoint to verify carrier connectivity
- **Circuit breaker**: Fail fast when carrier is down
- **Rate limiting**: Client-side throttling to respect carrier limits
- **Monitoring**: Integration with observability platforms

### Code Quality
- **Documentation**: JSDoc comments for public APIs
- **Examples**: More usage examples and CLI demo
- **CI/CD**: GitHub Actions for automated testing and releases

## Development Tools

- **TypeScript**: Strict mode with comprehensive type checking
- **Prettier**: Consistent code formatting
- **ESLint**: Linting with TypeScript-specific rules
- **Husky + lint-staged**: Pre-commit hooks for formatting and linting
- **Jest**: Testing framework with coverage reporting
- **Nock**: HTTP mocking for integration tests

## License

MIT

A production-ready, extensible TypeScript service for integrating with shipping carriers. Currently supports UPS Rating API with architecture designed for easy addition of new carriers (FedEx, USPS, DHL) and operations (label purchase, tracking, address validation).

## Design Decisions

### Architecture

**Domain-Driven Design**: Core domain models (`Address`, `Package`, `RateRequest`, `RateQuote`) are carrier-agnostic. Callers interact only with these domain types, never with carrier-specific formats.

**Provider Pattern**: Each carrier implements the `RateProvider` interface. Adding a new carrier means creating a new provider implementation without touching existing code.

**Separation of Concerns**:
- **Domain layer**: Business entities and validation rules
- **Carrier layer**: Carrier-specific implementations isolated in separate modules
- **Config layer**: Environment-based configuration with validation

**Mapper Pattern**: Dedicated mappers (`UpsMapper`) translate between domain models and carrier API formats, keeping the translation logic isolated and testable.

**Auth Abstraction**: `UpsAuthManager` implements `AuthProvider` interface, handling OAuth token lifecycle (acquisition, caching, refresh) transparently. The HTTP client automatically refreshes tokens on 401 responses.

### Type Safety

- **Zod schemas** for runtime validation of all inputs and configuration
- **Strict TypeScript** with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- **No `any` types** enforced via ESLint rules
- Separate types for domain models vs carrier API shapes

### Error Handling

Structured error hierarchy with specific error types:
- `ValidationError`: Invalid input data
- `AuthError`: Authentication failures
- `NetworkError`: Connection issues
- `TimeoutError`: Request timeouts
- `RateLimitError`: Rate limiting (429)
- `CarrierError`: Generic carrier errors

All errors include error codes and optional details for debugging.

### Testing Strategy

**Integration tests** with stubbed HTTP layer using `nock`:
- Verify request payload construction from domain models
- Verify response parsing and normalization
- Test auth token lifecycle (acquisition, caching, refresh on expiry)
- Test all error paths (4xx, 5xx, timeouts, network failures, malformed responses)

No live API calls required; all carrier responses are stubbed with realistic payloads from UPS documentation.

## Project Structure

```
carrier-integration-service/
├── src/
│   ├── domain/              # Carrier-agnostic domain models
│   │   ├── address.ts       # Address with validation
│   │   ├── package.ts       # Package dimensions and weight
│   │   ├── rate.ts          # Rate request and quote types
│   │   └── errors.ts        # Structured error hierarchy
│   ├── carriers/
│   │   ├── base.ts          # Provider interfaces
│   │   └── ups/
│   │       ├── auth.ts      # OAuth token manager with caching
│   │       ├── client.ts    # HTTP client with error handling
│   │       ├── mapper.ts    # Domain ↔ UPS format translation
│   │       ├── provider.ts  # UPS rate provider implementation
│   │       └── types.ts     # UPS API request/response types
│   ├── config/
│   │   └── env.ts           # Environment config with validation
│   └── index.ts             # Public API
├── tests/
│   ├── fixtures/            # Stubbed UPS API responses
│   │   └── ups-responses.ts
│   └── integration/         # End-to-end integration tests
│       ├── ups-rate-provider.test.ts
│       ├── ups-auth.test.ts
│       └── ups-mapper.test.ts
└── ...config files
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your UPS API credentials:
```env
UPS_CLIENT_ID=your_client_id
UPS_CLIENT_SECRET=your_client_secret
```

### Build

```bash
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# With coverage
npm test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Check formatting
npm run format:check
```

## Usage

```typescript
import { createUpsRateProvider, RateRequest } from 'carrier-integration-service';

const provider = createUpsRateProvider();

const request: RateRequest = {
  origin: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
  },
  destination: {
    street: '456 Market St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'US',
  },
  packages: [
    {
      dimensions: {
        length: 10,
        width: 8,
        height: 6,
        unit: 'IN',
      },
      weight: {
        value: 5,
        unit: 'LBS',
      },
    },
  ],
  serviceLevel: '03', // Optional: filter by UPS service code
};

try {
  const quotes = await provider.getRates(request);
  quotes.forEach((quote) => {
    console.log(`${quote.service}: $${quote.totalCost} ${quote.currency}`);
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid request:', error.details);
  } else if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else {
    console.error('Error:', error);
  }
}
```

## Extensibility

### Adding a New Carrier (e.g., FedEx)

1. Create `src/carriers/fedex/` directory
2. Implement `FedExRateProvider` implementing `RateProvider` interface
3. Create carrier-specific types, auth, client, and mapper
4. Export factory function in `src/index.ts`:
```typescript
export function createFedExRateProvider(): RateProvider { ... }
```

No changes to domain models or existing UPS code required.

### Adding a New Operation (e.g., Label Purchase)

1. Define domain types in `src/domain/label.ts`
2. Create `LabelProvider` interface in `src/carriers/base.ts`
3. Implement for each carrier (e.g., `UpsLabelProvider`)
4. Reuse existing auth and client infrastructure

### Multi-Carrier Rate Shopping

```typescript
const ups = createUpsRateProvider();
const fedex = createFedExRateProvider();

const [upsQuotes, fedexQuotes] = await Promise.all([
  ups.getRates(request),
  fedex.getRates(request),
]);

const allQuotes = [...upsQuotes, ...fedexQuotes].sort((a, b) => a.totalCost - b.totalCost);
```

## What I Would Improve With More Time

### Functionality
- **Retry logic**: Exponential backoff for transient failures
- **Request validation**: More sophisticated address validation (real postal codes, international formats)
- **Response validation**: Zod schemas for carrier responses to catch malformed data
- **Logging**: Structured logging with correlation IDs for request tracing
- **Metrics**: Instrumentation for latency, error rates, cache hit rates

### Testing
- **Unit tests**: Isolated tests for mapper, auth manager, error handling
- **Contract tests**: Verify our understanding of UPS API matches reality
- **Load tests**: Token refresh under concurrent load
- **Edge cases**: International addresses, multi-package shipments, all UPS service codes

### Operations
- **Health checks**: Endpoint to verify carrier connectivity
- **Circuit breaker**: Fail fast when carrier is down
- **Rate limiting**: Client-side throttling to respect carrier limits
- **Monitoring**: Integration with observability platforms

### Code Quality
- **Documentation**: JSDoc comments for public APIs
- **Examples**: More usage examples and CLI demo
- **CI/CD**: GitHub Actions for automated testing and releases

## Development Tools

- **TypeScript**: Strict mode with comprehensive type checking
- **Prettier**: Consistent code formatting
- **ESLint**: Linting with TypeScript-specific rules
- **Husky + lint-staged**: Pre-commit hooks for formatting and linting
- **Jest**: Testing framework with coverage reporting
- **Nock**: HTTP mocking for integration tests

## License

MIT
