import { z } from 'zod';

export const paymentSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(['PAYABLE', 'RECEIVABLE']),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  supplierId: z.string().optional(),
  customerId: z.string().optional(),
  purchaseId: z.string().optional(),
  saleId: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
