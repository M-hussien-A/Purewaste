import { z } from 'zod';

export const purchaseSchema = z.object({
  date: z.coerce.date(),
  supplierId: z.string().min(1, 'Supplier is required'),
  materialId: z.string().min(1, 'Material is required'),
  quantity: z.coerce.number().positive('Quantity must be a positive number'),
  unitPrice: z.coerce.number().positive('Unit price must be a positive number'),
  notes: z.string().optional(),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
