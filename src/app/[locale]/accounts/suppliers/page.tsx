'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToCsv } from '@/lib/export-csv';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export default function SuppliersPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [showLedger, setShowLedger] = useState(false);

  // Delete single
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk delete
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/accounts/suppliers');
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openCreateForm = () => {
    setEditingSupplier(null);
    setFormData({ nameAr: '', nameEn: '', phone: '', address: '' });
    setShowForm(true);
  };

  const openEditForm = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      nameAr: supplier.nameAr || '',
      nameEn: supplier.nameEn || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!formData.nameAr) return;
    try {
      setSubmitting(true);
      const url = editingSupplier
        ? `/api/v1/accounts/suppliers/${editingSupplier.id}`
        : '/api/v1/accounts/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowForm(false);
        setFormData({ nameAr: '', nameEn: '', phone: '', address: '' });
        setEditingSupplier(null);
        fetchSuppliers();
      } else {
        const err = await res.json();
        toast({ title: err.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/accounts/suppliers/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchSuppliers();
      } else {
        const err = await res.json();
        toast({ title: err.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmBulkDelete = (rows: any[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds.length) return;
    try {
      setBulkDeleteLoading(true);
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/accounts/suppliers/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: tCommon('success') });
      setBulkDeleteIds([]);
      fetchSuppliers();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToCsv('suppliers', suppliers, [
      { key: 'nameAr', header: t('nameAr') },
      { key: 'nameEn', header: t('nameEn') },
      { key: 'phone', header: t('phone') },
      { key: 'address', header: t('address') },
      { key: 'outstandingBalance', header: t('outstandingBalance') },
    ]);
  };

  const viewLedger = async (supplier: any) => {
    setSelectedSupplier(supplier);
    try {
      const res = await fetch(`/api/v1/accounts/suppliers/${supplier.id}/ledger`);
      if (res.ok) {
        const json = await res.json();
        setLedger(json.data || []);
      }
    } catch {
      setLedger([]);
    }
    setShowLedger(true);
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'nameAr', header: t('nameAr') },
    { accessorKey: 'phone', header: t('phone') },
    {
      accessorKey: 'totalPurchases',
      header: t('totalPurchases'),
      cell: ({ row }) =>
        `${Number(row.original.totalPurchases || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalPaid',
      header: t('totalPaid'),
      cell: ({ row }) =>
        `${Number(row.original.totalPaid || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'outstandingBalance',
      header: t('outstandingBalance'),
      cell: ({ row }) => {
        const balance = Number(row.original.outstandingBalance || 0);
        return (
          <span className={balance > 0 ? 'font-bold text-destructive' : ''}>
            {balance.toLocaleString()} {tCommon('currency')}
          </span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => viewLedger(row.original)}>
            {t('viewLedger')}
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditForm(row.original)}
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
            </>
          )}
        </div>
      ),
    },
  ];

  const ledgerColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    { accessorKey: 'description', header: t('description') },
    {
      accessorKey: 'debit',
      header: t('debit'),
      cell: ({ row }) => Number(row.original.debit || 0).toLocaleString(),
    },
    {
      accessorKey: 'credit',
      header: t('credit'),
      cell: ({ row }) => Number(row.original.credit || 0).toLocaleString(),
    },
    {
      accessorKey: 'balance',
      header: t('balance'),
      cell: ({ row }) => Number(row.original.balance || 0).toLocaleString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('suppliers')}
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="me-2 h-4 w-4" />
            {t('newSupplier')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? confirmBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t('editSupplier') : t('newSupplier')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('nameAr')}</Label>
              <Input
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('nameEn')}</Label>
              <Input
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('address')}</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? tCommon('loading') : tCommon('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ledger dialog */}
      <Dialog open={showLedger} onOpenChange={setShowLedger}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('ledger')} - {selectedSupplier?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <DataTable columns={ledgerColumns} data={ledger} loading={false} />
        </DialogContent>
      </Dialog>

      {/* Single delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('deleteSupplier')}
        description={t('deleteSupplierConfirm')}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteLoading}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={t('deleteSupplier')}
        description={t('bulkDeleteConfirm', { count: bulkDeleteIds.length })}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={bulkDeleteLoading}
      />
    </div>
  );
}
