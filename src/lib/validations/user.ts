import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'OPERATOR', 'ACCOUNTANT', 'VIEWER']),
});

export const updateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'ACCOUNTANT', 'VIEWER']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
