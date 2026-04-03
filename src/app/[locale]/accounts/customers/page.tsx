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
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CustomersPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [showLedger, setShowLedger] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/accounts/customers');
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreate = async () => {
    if (!formData.nameAr) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/accounts/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowForm(false);
        setFormData({ nameAr: '', nameEn: '', phone: '', address: '' });
        fetchCustomers();
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

  const viewLedger = async (customer: any) => {
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/v1/accounts/customers/${customer.id}/ledger`);
      if (res.ok) {
        const json = await res.json();
        setLedger(json.data || []);
      }
    } catch {
      setLedger([]);
    }
    setShowLedger(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/accounts/customers/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        fetchCustomers();
      } else {
        const err = await res.json();
        toast({ title: err.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const confirmBulkDelete = (rows: any[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0) return;
    setDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/accounts/customers/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: tCommon('success') });
      fetchCustomers();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
      setBulkDeleteIds([]);
    }
  };

  const handleExport = () => {
    exportToCsv('customers', customers, [
      { key: 'nameAr', header: t('nameAr') },
      { key: 'nameEn', header: t('nameEn') },
      { key: 'phone', header: t('phone') },
      { key: 'address', header: t('address') },
      { key: 'outstandingBalance', header: t('outstandingBalance') },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'nameAr', header: t('nameAr') },
    { accessorKey: 'phone', header: t('phone') },
    {
      accessorKey: 'totalSales',
      header: t('totalSales'),
      cell: ({ row }) =>
        `${Number(row.original.totalSales || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalReceived',
      header: t('totalReceived'),
      cell: ({ row }) =>
        `${Number(row.original.totalReceived || 0).toLocaleString()} ${tCommon('currency')}`,
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
                onClick={() => {
                  setFormData({
                    nameAr: row.original.nameAr || '',
                    nameEn: row.original.nameEn || '',
                    phone: row.original.phone || '',
                    address: row.original.address || '',
                  });
                  setSelectedCustomer(row.original);
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
        title={t('customers')}
        actions={
          <Button
            onClick={() => {
              setSelectedCustomer(null);
              setFormData({ nameAr: '', nameEn: '', phone: '', address: '' });
              setShowForm(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t('newCustomer')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? confirmBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Create / Edit form dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setSelectedCustomer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? t('editCustomer') : t('newCustomer')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('nameAr')} <span className="text-destructive">*</span></Label>
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
              {t('ledger')} - {selectedCustomer?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <DataTable columns={ledgerColumns} data={ledger} loading={false} />
        </DialogContent>
      </Dialog>

      {/* Single delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('deleteCustomer')}
        description={t('deleteCustomerConfirm')}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={t('bulkDeleteCustomers')}
        description={t('bulkDeleteCustomersConfirm', { count: bulkDeleteIds.length })}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
