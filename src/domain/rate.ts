import { z } from 'zod';
import { AddressSchema } from './address';
import { PackageSchema } from './package';

export const RateRequestSchema = z.object({
  origin: AddressSchema,
  destination: AddressSchema,
  packages: z.array(PackageSchema).min(1),
  serviceLevel: z.string().optional(),
});

export const RateQuoteSchema = z.object({
  carrier: z.string(),
  service: z.string(),
  serviceCode: z.string(),
  totalCost: z.number().nonnegative(),
  currency: z.string().length(3),
  deliveryDays: z.number().int().positive().optional(),
  deliveryDate: z.string().optional(),
});

export type RateRequest = z.infer<typeof RateRequestSchema>;
export type RateQuote = z.infer<typeof RateQuoteSchema>;
