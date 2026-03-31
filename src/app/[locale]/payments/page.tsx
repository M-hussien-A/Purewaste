'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentForm } from '@/components/forms/PaymentForm';
import { Plus } from 'lucide-react';

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [defaultType, setDefaultType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [payRes, recRes] = await Promise.all([
        fetch('/api/v1/payments?type=PAYABLE'),
        fetch('/api/v1/payments?type=RECEIVABLE'),
      ]);
      if (payRes.ok) {
        const json = await payRes.json();
        setPayables(json.data || []);
      }
      if (recRes.ok) {
        const json = await recRes.json();
        setReceivables(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const payableColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      id: 'supplier',
      header: t('payable'),
      cell: ({ row }) => row.original.supplier?.name || '—',
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) =>
        `${Number(row.original.amount).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'method',
      header: t('method'),
      cell: ({ row }) => {
        const m = row.original.method;
        if (m === 'CASH') return t('cash');
        if (m === 'BANK_TRANSFER') return t('bankTransfer');
        if (m === 'CHECK') return t('check');
        return m;
      },
    },
    {
      accessorKey: 'notes',
      header: tCommon('notes'),
    },
  ];

  const receivableColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      id: 'customer',
      header: t('receivable'),
      cell: ({ row }) => row.original.customer?.name || '—',
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) =>
        `${Number(row.original.amount).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'method',
      header: t('method'),
      cell: ({ row }) => {
        const m = row.original.method;
        if (m === 'CASH') return t('cash');
        if (m === 'BANK_TRANSFER') return t('bankTransfer');
        if (m === 'CHECK') return t('check');
        return m;
      },
    },
    {
      accessorKey: 'notes',
      header: tCommon('notes'),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newPayment')}
          </Button>
        }
      />

      <Tabs defaultValue="payable" className="w-full">
        <TabsList>
          <TabsTrigger value="payable" onClick={() => setDefaultType('PAYABLE')}>
            {t('payable')}
          </TabsTrigger>
          <TabsTrigger value="receivable" onClick={() => setDefaultType('RECEIVABLE')}>
            {t('receivable')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payable">
          <DataTable columns={payableColumns} data={payables} loading={loading} />
        </TabsContent>
        <TabsContent value="receivable">
          <DataTable columns={receivableColumns} data={receivables} loading={loading} />
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('newPayment')}</DialogTitle>
          </DialogHeader>
          <PaymentForm
            defaultType={defaultType}
            onSuccess={() => {
              setShowForm(false);
              fetchPayments();
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
