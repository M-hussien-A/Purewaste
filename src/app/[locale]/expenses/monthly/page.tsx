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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Plus, Trash2 } from 'lucide-react';

const MONTHS = [
  { value: 1, labelAr: 'يناير', labelEn: 'January' },
  { value: 2, labelAr: 'فبراير', labelEn: 'February' },
  { value: 3, labelAr: 'مارس', labelEn: 'March' },
  { value: 4, labelAr: 'أبريل', labelEn: 'April' },
  { value: 5, labelAr: 'مايو', labelEn: 'May' },
  { value: 6, labelAr: 'يونيو', labelEn: 'June' },
  { value: 7, labelAr: 'يوليو', labelEn: 'July' },
  { value: 8, labelAr: 'أغسطس', labelEn: 'August' },
  { value: 9, labelAr: 'سبتمبر', labelEn: 'September' },
  { value: 10, labelAr: 'أكتوبر', labelEn: 'October' },
  { value: 11, labelAr: 'نوفمبر', labelEn: 'November' },
  { value: 12, labelAr: 'ديسمبر', labelEn: 'December' },
];

export default function MonthlyOverheadPage() {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [overheads, setOverheads] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ categoryId: '', amount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = async () => {
    const res = await fetch('/api/v1/expenses/categories');
    if (res.ok) {
      const json = await res.json();
      setCategories((json.data || []).filter((c: any) => c.type === 'MONTHLY'));
    }
  };

  const fetchOverheads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/monthly?month=${month}&year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setOverheads(json.data?.overheads || []);
        setTotalAmount(json.data?.totalAmount || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchOverheads();
  }, [month, year]);

  const handleSave = async () => {
    if (!formData.categoryId || !formData.amount) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/expenses/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          categoryId: formData.categoryId,
          amount: formData.amount,
          notes: formData.notes,
        }),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowForm(false);
        setFormData({ categoryId: '', amount: '', notes: '' });
        fetchOverheads();
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
      const res = await fetch(`/api/v1/expenses/monthly/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchOverheads();
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToXlsx('monthly-overhead', overheads, [
      { key: 'category.nameAr', header: t('category') },
      { key: 'amount', header: t('amount') },
      { key: 'notes', header: tCommon('notes') },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'category',
      header: t('category'),
      cell: ({ row }) => row.original.category?.nameAr || '-',
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) =>
        `${Number(row.original.amount || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'notes',
      header: tCommon('notes'),
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            cell: ({ row }: any) => (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteId(row.original.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          } as ColumnDef<any>,
        ]
      : []),
  ];

  const monthLabel = MONTHS.find((m) => m.value === month)?.labelAr || '';

  return (
    <div>
      <PageHeader
        title={t('monthlyTitle')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('addOverhead')}
          </Button>
        }
      />

      {/* Month/Year filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('month')}</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.labelAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('year')}</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-24"
          />
        </div>
        <Card className="px-4 py-2">
          <span className="text-sm text-muted-foreground">{t('monthTotal')}: </span>
          <span className="text-lg font-bold">{totalAmount.toLocaleString()} {tCommon('currency')}</span>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={overheads}
        loading={loading}
        onExport={handleExport}
      />

      {/* Add overhead dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addOverhead')} - {monthLabel} {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('category')} <span className="text-destructive">*</span></Label>
              <Select
                value={formData.categoryId}
                onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('category')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('amount')} <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tCommon('notes')}</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>{tCommon('cancel')}</Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? tCommon('loading') : tCommon('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={tCommon('deleteConfirm')}
        description={tCommon('deleteConfirmMessage')}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteLoading}
      />
    </div>
  );
}
