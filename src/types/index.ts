export type {
  User,
  RawMaterial,
  FinishedProduct,
  Supplier,
  Customer,
  Purchase,
  SmeltingBatch,
  BatchInput,
  BatchOutput,
  Sale,
  Payment,
  AuditLog,
  UserRole,
  AuditAction,
  PaymentType,
  PaymentMethod,
} from '@prisma/client';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  dismissible?: boolean;
  duration?: number;
}

export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}
