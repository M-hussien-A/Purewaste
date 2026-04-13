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
import { SaleForm } from '@/components/forms/SaleForm';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function SalesPage() {
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const { isAdmin } = useCurrentUser();

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSale, setEditSale] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/sales');
      if (res.ok) {
        const json = await res.json();
        setSales(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/sales/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSales();
        setDeleteId(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async (rows: any[]) => {
    setBulkDeleteIds(rows.map((r: any) => r.id));
  };

  const confirmBulkDelete = async () => {
    setDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) => fetch(`/api/v1/sales/${id}`, { method: 'DELETE' }))
      );
      fetchSales();
      setBulkDeleteIds([]);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToXlsx('sales', sales, [
      { key: 'date', header: 'Date' },
      { key: 'customer.nameAr', header: 'Customer' },
      { key: 'product.name', header: 'Product' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'pricePerKg', header: 'Price/Kg' },
      { key: 'totalRevenue', header: 'Total Revenue' },
      { key: 'grossProfit', header: 'Gross Profit' },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      id: 'customer',
      header: t('customer'),
      cell: ({ row }) => row.original.customer?.name || '—',
    },
    {
      id: 'product',
      header: t('product'),
      cell: ({ row }) => row.original.product?.name || '—',
    },
    {
      accessorKey: 'quantity',
      header: t('quantity'),
      cell: ({ row }) => `${Number(row.original.quantity).toLocaleString()} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'pricePerKg',
      header: t('pricePerKg'),
      cell: ({ row }) => `${Number(row.original.pricePerKg).toFixed(2)} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalRevenue',
      header: t('totalRevenue'),
      cell: ({ row }) => `${Number(row.original.totalRevenue).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'grossProfit',
      header: t('grossProfit'),
      cell: ({ row }) => `${Number(row.original.grossProfit).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'paymentStatus',
      header: tCommon('status'),
      cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: tCommon('actions'),
            cell: ({ row }: { row: any }) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditSale(row.original);
                    setShowForm(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(row.original.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
          } as ColumnDef<any>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => { setEditSale(null); setShowForm(true); }}>
            <Plus className="me-2 h-4 w-4" />
            {t('newSale')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={sales}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? handleBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Add / Edit dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditSale(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editSale ? t('editSale') : t('newSale')}</DialogTitle>
          </DialogHeader>
          <SaleForm
            initialData={editSale}
            onSuccess={() => {
              setShowForm(false);
              setEditSale(null);
              fetchSales();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditSale(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Single delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('deleteSale')}
        description={t('deleteSaleConfirm')}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={() => handleDelete(deleteId!)}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={t('bulkDelete')}
        description={t('bulkDeleteConfirm')}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
