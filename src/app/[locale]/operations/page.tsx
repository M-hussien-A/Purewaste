'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OperationForm } from '@/components/forms/OperationForm';
import { useToast } from '@/components/ui/use-toast';

interface Batch {
  id: string;
  batchNumber: number;
  date: string;
  totalInputQty: number;
  totalOutputQty: number;
  lossRatio: number;
  totalCost: number;
  costPerKg: number;
  status: string;
}

export default function OperationsPage() {
  const t = useTranslations('operations');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/operations');
      if (res.ok) {
        const json = await res.json();
        setBatches(json.data || []);
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchBatches();
    toast({ title: tCommon('success') });
  };

  const columns: ColumnDef<Batch>[] = [
    {
      accessorKey: 'batchNumber',
      header: t('batchNumber'),
    },
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString(),
    },
    {
      accessorKey: 'totalInputQty',
      header: t('inputQty'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalInputQty')).toLocaleString()} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'totalOutputQty',
      header: t('outputQty'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalOutputQty')).toLocaleString()} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'lossRatio',
      header: t('lossRatio'),
      cell: ({ row }) => `${(Number(row.getValue('lossRatio')) * 100).toFixed(1)}%`,
    },
    {
      accessorKey: 'totalCost',
      header: t('totalCost'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalCost')).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'costPerKg',
      header: t('costPerKg'),
      cell: ({ row }) =>
        `${Number(row.getValue('costPerKg')).toFixed(2)} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'status',
      header: t('batchStatus'),
      cell: ({ row }) => (
        <StatusBadge status={row.getValue('status')} type="batch" />
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} />
        <LoadingSkeleton type="table" rows={8} columns={8} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newBatch')}
          </Button>
        }
      />

      <DataTable columns={columns} data={batches} searchColumn="batchNumber" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('newBatch')}</DialogTitle>
          </DialogHeader>
          <OperationForm onSuccess={handleSuccess} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
