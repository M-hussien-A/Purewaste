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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const { isAdmin } = useCurrentUser();

  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [defaultType, setDefaultType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [editPayment, setEditPayment] = useState<any | null>(null);

  // Single delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk delete
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

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

  // --- Handlers ---

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/v1/payments/${deleteId}`, { method: 'DELETE' });
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
      fetchPayments();
    }
  };

  const handleBulkDelete = (rows: any[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/payments/${id}`, { method: 'DELETE' })
        )
      );
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteIds([]);
      fetchPayments();
    }
  };

  const handleExport = (data: any[], type: 'PAYABLE' | 'RECEIVABLE') => {
    exportToXlsx(`payments_${type.toLowerCase()}`, data, [
      { key: 'date', header: tCommon('date') },
      { key: 'type', header: tCommon('type') },
      { key: 'amount', header: t('amount') },
      { key: 'method', header: t('method') },
      { key: 'notes', header: tCommon('notes') },
    ]);
  };

  // --- Actions column ---

  const actionsColumn: ColumnDef<any> = {
    id: 'actions',
    header: tCommon('actions'),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setEditPayment(row.original);
            setDefaultType(row.original.type ?? 'PAYABLE');
            setShowForm(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteId(row.original.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  };

  // --- Column definitions ---

  const basePayableColumns: ColumnDef<any>[] = [
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

  const baseReceivableColumns: ColumnDef<any>[] = [
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

  const payableColumns = isAdmin
    ? [...basePayableColumns, actionsColumn]
    : basePayableColumns;

  const receivableColumns = isAdmin
    ? [...baseReceivableColumns, actionsColumn]
    : baseReceivableColumns;

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button
            onClick={() => {
              setEditPayment(null);
              setShowForm(true);
            }}
          >
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
          <DataTable
            columns={payableColumns}
            data={payables}
            loading={loading}
            enableSelection={isAdmin}
            onBulkDelete={isAdmin ? handleBulkDelete : undefined}
            onExport={isAdmin ? () => handleExport(payables, 'PAYABLE') : undefined}
          />
        </TabsContent>
        <TabsContent value="receivable">
          <DataTable
            columns={receivableColumns}
            data={receivables}
            loading={loading}
            enableSelection={isAdmin}
            onBulkDelete={isAdmin ? handleBulkDelete : undefined}
            onExport={isAdmin ? () => handleExport(receivables, 'RECEIVABLE') : undefined}
          />
        </TabsContent>
      </Tabs>

      {/* New / Edit Payment Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditPayment(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editPayment ? t('editPayment') : t('newPayment')}
            </DialogTitle>
          </DialogHeader>
          <PaymentForm
            defaultType={defaultType}
            onSuccess={() => {
              setShowForm(false);
              setEditPayment(null);
              fetchPayments();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditPayment(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('deletePayment')}
        description={t('deletePaymentConfirm')}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={t('bulkDeletePayments')}
        description={t('bulkDeletePaymentsConfirm', { count: bulkDeleteIds.length })}
        variant="destructive"
        loading={bulkDeleteLoading}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
