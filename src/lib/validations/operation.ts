import { z } from 'zod';

export const smeltingBatchSchema = z.object({
  date: z.coerce.date(),
  inputMaterials: z.array(
    z.object({
      materialId: z.string().min(1, 'Material is required'),
      quantity: z.coerce.number().positive('Quantity must be a positive number'),
    })
  ).min(1, 'At least one input material is required'),
  outputProducts: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.coerce.number().positive('Quantity must be a positive number'),
    })
  ).min(1, 'At least one output product is required'),
  workerIds: z.array(z.string()).default([]),
  electricityHrs: z.coerce.number().min(0, 'Electricity hours cannot be negative'),
  laborHrs: z.coerce.number().min(0, 'Labor hours cannot be negative'),
  fuelCost: z.coerce.number().min(0, 'Fuel cost cannot be negative').default(0),
  otherExpenses: z.coerce.number().min(0, 'Other expenses cannot be negative'),
  notes: z.string().optional(),
});

export type SmeltingBatchInput = z.infer<typeof smeltingBatchSchema>;
