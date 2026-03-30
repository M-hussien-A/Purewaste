'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface StatusBadgeProps {
  status: string;
  type?: 'payment' | 'batch';
}

const paymentVariants: Record<string, 'success' | 'warning' | 'destructive'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'destructive',
};

const batchVariants: Record<string, 'success' | 'default' | 'destructive'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'default',
  CANCELLED: 'destructive',
};

const paymentLabels: Record<string, string> = {
  PAID: 'paid',
  PARTIAL: 'partial',
  PENDING: 'pending',
};

const batchLabels: Record<string, string> = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'inProgress',
  CANCELLED: 'cancelled',
};

export function StatusBadge({ status, type = 'payment' }: StatusBadgeProps) {
  const tPayments = useTranslations('payments');
  const tOperations = useTranslations('operations');

  if (type === 'batch') {
    const variant = batchVariants[status] || 'default';
    const labelKey = batchLabels[status] || status;
    return <Badge variant={variant}>{tOperations(labelKey)}</Badge>;
  }

  const variant = paymentVariants[status] || 'default';
  const labelKey = paymentLabels[status] || status;
  return <Badge variant={variant}>{tPayments(labelKey)}</Badge>;
}
