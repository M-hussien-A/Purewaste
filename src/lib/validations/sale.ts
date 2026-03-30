import { z } from 'zod';

export const saleSchema = z.object({
  date: z.coerce.date(),
  customerId: z.string().min(1, 'Customer is required'),
  productId: z.string().min(1, 'Product is required'),
  batchId: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be a positive number'),
  pricePerKg: z.coerce.number().positive('Price per kg must be a positive number'),
  notes: z.string().optional(),
});

export type SaleInput = z.infer<typeof saleSchema>;
