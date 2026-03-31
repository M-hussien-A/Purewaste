import { z } from 'zod';

export const PURCHASE_CATEGORIES = [
  'RAW_MATERIAL',
  'FUEL',
  'FOOD',
  'CONSUMABLES',
  'MAINTENANCE',
  'UTILITIES',
  'OTHER',
] as const;

export const purchaseSchema = z.object({
  date: z.coerce.date(),
  category: z.enum(PURCHASE_CATEGORIES).default('RAW_MATERIAL'),
  description: z.string().optional(),
  supplierId: z.string().optional(),
  materialId: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be a positive number'),
  unitPrice: z.coerce.number().positive('Unit price must be a positive number'),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.category === 'RAW_MATERIAL') {
      return !!data.materialId && data.materialId.length > 0;
    }
    return true;
  },
  { message: 'Material is required for raw material purchases', path: ['materialId'] }
).refine(
  (data) => {
    if (data.category !== 'RAW_MATERIAL') {
      return !!data.description && data.description.length > 0;
    }
    return true;
  },
  { message: 'Description is required for non-material purchases', path: ['description'] }
);

export type PurchaseInput = z.infer<typeof purchaseSchema>;
