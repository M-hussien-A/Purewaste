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
import { exportToCsv } from '@/lib/export-csv';
import { Plus, Trash2 } from 'lucide-react';

interface ExpenseEntry {
  date: string;
  categoryId: string;
  description: string;
  amount: string;
}

export default function DailyExpensesPage() {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Multi-line entry
  const today = new Date().toISOString().split('T')[0];
  const [entries, setEntries] = useState<ExpenseEntry[]>([
    { date: today, categoryId: '', description: '', amount: '' },
  ]);

  // Date filter
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(today);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fetchCategories = async () => {
    const res = await fetch('/api/v1/expenses/categories');
    if (res.ok) {
      const json = await res.json();
      setCategories((json.data || []).filter((c: any) => c.type === 'DAILY'));
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/daily?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.data?.expenses || []);
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
    fetchExpenses();
  }, [dateFrom, dateTo]);

  const addRow = () => {
    setEntries([...entries, { date: today, categoryId: '', description: '', amount: '' }]);
  };

  const removeRow = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ExpenseEntry, value: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const entriesTotalAmount = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const handleSave = async () => {
    const validEntries = entries.filter((e) => e.categoryId && e.amount);
    if (validEntries.length === 0) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/expenses/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: validEntries }),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowForm(false);
        setEntries([{ date: today, categoryId: '', description: '', amount: '' }]);
        fetchExpenses();
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
      const res = await fetch(`/api/v1/expenses/daily/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchExpenses();
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmBulkDelete = (rows: any[]) => setBulkDeleteIds(rows.map((r) => r.id));

  const handleBulkDelete = async () => {
    try {
      setBulkDeleteLoading(true);
      await Promise.all(bulkDeleteIds.map((id) => fetch(`/api/v1/expenses/daily/${id}`, { method: 'DELETE' })));
      toast({ title: tCommon('success') });
      setBulkDeleteIds([]);
      fetchExpenses();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToCsv('daily-expenses', expenses, [
      { key: 'date', header: tCommon('date') },
      { key: 'category.nameAr', header: t('category') },
      { key: 'description', header: t('description') },
      { key: 'amount', header: t('amount') },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      accessorKey: 'category',
      header: t('category'),
      cell: ({ row }) => row.original.category?.nameAr || '-',
    },
    {
      accessorKey: 'description',
      header: t('description'),
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) =>
        `${Number(row.original.amount || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'creator',
      header: tCommon('created'),
      cell: ({ row }) => row.original.creator?.fullName || '-',
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

  return (
    <div>
      <PageHeader
        title={t('dailyTitle')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('addExpense')}
          </Button>
        }
      />

      {/* Date filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('from')}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('to')}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Card className="px-4 py-2">
          <span className="text-sm text-muted-foreground">{t('periodTotal')}: </span>
          <span className="text-lg font-bold">{totalAmount.toLocaleString()} {tCommon('currency')}</span>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? confirmBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Multi-line entry dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addExpense')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {entries.map((entry, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="w-36 space-y-1">
                  <Label className="text-xs">{tCommon('date')}</Label>
                  <Input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateEntry(index, 'date', e.target.value)}
                  />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs">{t('category')}</Label>
                  <Select
                    value={entry.categoryId}
                    onValueChange={(v) => updateEntry(index, 'categoryId', v)}
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
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{t('description')}</Label>
                  <Input
                    value={entry.description}
                    onChange={(e) => updateEntry(index, 'description', e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">{t('amount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={entry.amount}
                    onChange={(e) => updateEntry(index, 'amount', e.target.value)}
                  />
                </div>
                {entries.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="me-1 h-3 w-3" />
              {t('addRow')}
            </Button>

            <Card>
              <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-muted-foreground">{t('todayTotal')}</span>
                <span className="text-xl font-bold">{entriesTotalAmount.toLocaleString()} {tCommon('currency')}</span>
              </CardContent>
            </Card>

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
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={tCommon('deleteConfirm')}
        description={tCommon('bulkDeleteConfirm', { count: bulkDeleteIds.length })}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={bulkDeleteLoading}
      />
    </div>
  );
}
