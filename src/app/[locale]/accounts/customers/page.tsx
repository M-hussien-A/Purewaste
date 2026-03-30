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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

export default function CustomersPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
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
        <Button variant="outline" size="sm" onClick={() => viewLedger(row.original)}>
          {t('viewLedger')}
        </Button>
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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newCustomer')}
          </Button>
        }
      />
      <DataTable columns={columns} data={customers} loading={loading} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newCustomer')}</DialogTitle>
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
    </div>
  );
}
