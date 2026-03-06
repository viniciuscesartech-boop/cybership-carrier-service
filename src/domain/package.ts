import { z } from 'zod';

export const DimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['IN', 'CM']).default('IN'),
});

export const WeightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['LBS', 'KGS']).default('LBS'),
});

export const PackageSchema = z.object({
  dimensions: DimensionsSchema,
  weight: WeightSchema,
});

export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Weight = z.infer<typeof WeightSchema>;
export type Package = z.infer<typeof PackageSchema>;
