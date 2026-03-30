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
import { Plus } from 'lucide-react';

export default function SalesPage() {
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    { accessorKey: 'customer.nameAr', header: t('customer') },
    { accessorKey: 'product.nameAr', header: t('product') },
    { accessorKey: 'quantity', header: t('quantity') },
    { accessorKey: 'pricePerKg', header: t('pricePerKg') },
    { accessorKey: 'totalRevenue', header: t('totalRevenue') },
    { accessorKey: 'grossProfit', header: t('grossProfit') },
    {
      accessorKey: 'paymentStatus',
      header: tCommon('status'),
      cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newSale')}
          </Button>
        }
      />
      <DataTable columns={columns} data={sales} loading={loading} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('newSale')}</DialogTitle>
          </DialogHeader>
          <SaleForm
            onSuccess={() => {
              setShowForm(false);
              fetchSales();
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
