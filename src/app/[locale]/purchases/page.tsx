'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import { PurchaseForm } from '@/components/forms/PurchaseForm';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { exportToCsv } from '@/lib/export-csv';

interface Purchase {
  id: string;
  date: string;
  category: string;
  description: string | null;
  supplierId: string | null;
  materialId: string | null;
  supplier: { name: string; nameAr: string } | null;
  material: { name: string } | null;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  paymentStatus: string;
}

export default function PurchasesPage() {
  const t = useTranslations('purchases');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/purchases');
      if (res.ok) {
        const json = await res.json();
        setPurchases(json.data || []);
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingPurchase(null);
    fetchPurchases();
    toast({ title: tCommon('success') });
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/purchases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPurchases();
        setDeleteId(null);
        toast({ title: tCommon('success') });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async (rows: Purchase[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const confirmBulkDelete = async () => {
    setDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/purchases/${id}`, { method: 'DELETE' })
        )
      );
      fetchPurchases();
      setBulkDeleteIds([]);
      toast({ title: tCommon('success') });
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToCsv('purchases', purchases, [
      { key: 'date', header: tCommon('date') },
      { key: 'category', header: t('category') },
      { key: 'supplier.nameAr', header: t('supplier') },
      { key: 'material.name', header: t('item') },
      { key: 'description', header: t('description') },
      { key: 'quantity', header: t('quantity') },
      { key: 'unitPrice', header: t('unitPrice') },
      { key: 'totalCost', header: t('totalCost') },
      { key: 'paymentStatus', header: t('paymentStatus') },
    ]);
  };

  const columns: ColumnDef<Purchase>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString(),
    },
    {
      accessorKey: 'category',
      header: t('category'),
      cell: ({ row }) => {
        const cat = row.getValue('category') as string;
        return t(`categories.${cat}`);
      },
    },
    {
      id: 'item',
      header: t('item'),
      cell: ({ row }) => {
        const purchase = row.original;
        if (purchase.category === 'RAW_MATERIAL' && purchase.material) {
          return purchase.material.name;
        }
        return purchase.description || '—';
      },
    },
    {
      id: 'supplierName',
      header: t('supplier'),
      cell: ({ row }) => row.original.supplier?.name || '—',
    },
    {
      accessorKey: 'quantity',
      header: t('quantity'),
      cell: ({ row }) =>
        `${Number(row.getValue('quantity')).toLocaleString()}`,
    },
    {
      accessorKey: 'unitPrice',
      header: t('unitPrice'),
      cell: ({ row }) =>
        `${Number(row.getValue('unitPrice')).toFixed(2)} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalCost',
      header: t('totalCost'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalCost')).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'paymentStatus',
      header: t('paymentStatus'),
      cell: ({ row }) => (
        <StatusBadge status={row.getValue('paymentStatus')} type="payment" />
      ),
    },
    {
      id: 'actions',
      header: tCommon('actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
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
          <Button
            onClick={() => {
              setEditingPurchase(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t('newPurchase')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={purchases}
        searchColumn="supplierName"
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? handleBulkDelete : undefined}
        onExport={handleExport}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPurchase(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? t('editPurchase') : t('newPurchase')}
            </DialogTitle>
          </DialogHeader>
          <PurchaseForm
            initialData={editingPurchase as Record<string, unknown> | null}
            onSuccess={handleSuccess}
            onCancel={() => {
              setDialogOpen(false);
              setEditingPurchase(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={tCommon('confirmDelete')}
        description={tCommon('confirmDeleteDescription')}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        variant="destructive"
        loading={deleteLoading}
      />

      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteIds([]);
        }}
        title={tCommon('confirmDelete')}
        description={tCommon('confirmBulkDeleteDescription')}
        onConfirm={confirmBulkDelete}
        variant="destructive"
        loading={deleteLoading}
      />
    </div>
  );
}
