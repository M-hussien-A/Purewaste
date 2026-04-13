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
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Pencil, Plus, Trash2, Receipt, DollarSign } from 'lucide-react';

export default function LaborPage() {
  const t = useTranslations('labor');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Worker form
  const [showForm, setShowForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [formData, setFormData] = useState({
    nameAr: '',
    name: '',
    phone: '',
    costPerKg: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Transaction form
  const [showTxForm, setShowTxForm] = useState(false);
  const [txWorker, setTxWorker] = useState<any>(null);
  const [txData, setTxData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'ADVANCE' as 'ADVANCE' | 'SETTLEMENT',
    amount: '',
    notes: '',
  });
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Transaction history
  const [showHistory, setShowHistory] = useState(false);
  const [historyWorker, setHistoryWorker] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/labor');
      if (res.ok) {
        const json = await res.json();
        setWorkers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const openCreateForm = () => {
    setEditingWorker(null);
    setFormData({ nameAr: '', name: '', phone: '', costPerKg: '' });
    setShowForm(true);
  };

  const openEditForm = (worker: any) => {
    setEditingWorker(worker);
    setFormData({
      nameAr: worker.nameAr || '',
      name: worker.name || '',
      phone: worker.phone || '',
      costPerKg: String(worker.costPerKg || ''),
    });
    setShowForm(true);
  };

  const handleSaveWorker = async () => {
    if (!formData.nameAr) return;
    try {
      setSubmitting(true);
      const url = editingWorker
        ? `/api/v1/labor/${editingWorker.id}`
        : '/api/v1/labor';
      const method = editingWorker ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          costPerKg: parseFloat(formData.costPerKg) || 0,
        }),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowForm(false);
        fetchWorkers();
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

  const openTxForm = (worker: any, type: 'ADVANCE' | 'SETTLEMENT') => {
    setTxWorker(worker);
    setTxData({
      date: new Date().toISOString().split('T')[0],
      type,
      amount: '',
      notes: '',
    });
    setShowTxForm(true);
  };

  const handleSaveTx = async () => {
    if (!txWorker || !txData.amount) return;
    try {
      setTxSubmitting(true);
      const res = await fetch(`/api/v1/labor/${txWorker.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowTxForm(false);
        fetchWorkers();
      } else {
        const err = await res.json();
        toast({ title: err.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setTxSubmitting(false);
    }
  };

  const viewHistory = async (worker: any) => {
    setHistoryWorker(worker);
    try {
      const res = await fetch(`/api/v1/labor/${worker.id}/transactions`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
      }
    } catch {
      setTransactions([]);
    }
    setShowHistory(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/labor/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchWorkers();
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
          fetch(`/api/v1/labor/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: tCommon('success') });
      setBulkDeleteIds([]);
      fetchWorkers();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToXlsx('labor', workers, [
      { key: 'nameAr', header: t('workerName') },
      { key: 'phone', header: tCommon('phone') },
      { key: 'costPerKg', header: t('costPerKg') },
      { key: 'totalLaborCost', header: t('totalLaborCost') },
      { key: 'totalAdvances', header: t('totalAdvances') },
      { key: 'totalSettlements', header: t('totalSettlements') },
      { key: 'balance', header: t('balance') },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'nameAr', header: t('workerName') },
    { accessorKey: 'phone', header: tCommon('phone') },
    {
      accessorKey: 'costPerKg',
      header: t('costPerKg'),
      cell: ({ row }) =>
        `${Number(row.original.costPerKg || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalLaborCost',
      header: t('totalLaborCost'),
      cell: ({ row }) =>
        `${Number(row.original.totalLaborCost || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalAdvances',
      header: t('totalAdvances'),
      cell: ({ row }) =>
        `${Number(row.original.totalAdvances || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'totalSettlements',
      header: t('totalSettlements'),
      cell: ({ row }) =>
        `${Number(row.original.totalSettlements || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'balance',
      header: t('balance'),
      cell: ({ row }) => {
        const balance = Number(row.original.balance || 0);
        return (
          <span className={balance > 0 ? 'font-bold text-destructive' : 'font-bold text-green-600'}>
            {balance.toLocaleString()} {tCommon('currency')}
          </span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openTxForm(row.original, 'ADVANCE')}
            title={t('advance')}
          >
            <DollarSign className="me-1 h-3 w-3" />
            {t('advance')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openTxForm(row.original, 'SETTLEMENT')}
            title={t('settlement')}
          >
            <Receipt className="me-1 h-3 w-3" />
            {t('settlement')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => viewHistory(row.original)}>
            {t('history')}
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" onClick={() => openEditForm(row.original)}>
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

  const txColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      accessorKey: 'type',
      header: t('transactionType'),
      cell: ({ row }) =>
        row.original.type === 'ADVANCE' ? t('advance') : t('settlement'),
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) =>
        `${Number(row.original.amount || 0).toLocaleString()} ${tCommon('currency')}`,
    },
    { accessorKey: 'notes', header: tCommon('notes') },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="me-2 h-4 w-4" />
            {t('newWorker')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={workers}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? confirmBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Create / Edit Worker dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWorker ? t('editWorker') : t('newWorker')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('workerName')} <span className="text-destructive">*</span></Label>
              <Input
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('workerNameEn')}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tCommon('phone')}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('costPerKg')}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.costPerKg}
                onChange={(e) => setFormData({ ...formData, costPerKg: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleSaveWorker} disabled={submitting}>
                {submitting ? tCommon('loading') : tCommon('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction form dialog */}
      <Dialog open={showTxForm} onOpenChange={setShowTxForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {txData.type === 'ADVANCE' ? t('newAdvance') : t('newSettlement')} - {txWorker?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tCommon('date')} <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={txData.date}
                onChange={(e) => setTxData({ ...txData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactionType')} <span className="text-destructive">*</span></Label>
              <Select
                value={txData.type}
                onValueChange={(v) => setTxData({ ...txData, type: v as 'ADVANCE' | 'SETTLEMENT' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADVANCE">{t('advance')}</SelectItem>
                  <SelectItem value="SETTLEMENT">{t('settlement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('amount')} <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={txData.amount}
                onChange={(e) => setTxData({ ...txData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tCommon('notes')}</Label>
              <Input
                value={txData.notes}
                onChange={(e) => setTxData({ ...txData, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowTxForm(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleSaveTx} disabled={txSubmitting}>
                {txSubmitting ? tCommon('loading') : tCommon('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction history dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('history')} - {historyWorker?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <DataTable columns={txColumns} data={transactions} loading={false} />
        </DialogContent>
      </Dialog>

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('deleteWorker')}
        description={t('deleteWorkerConfirm')}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteLoading}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={t('deleteWorker')}
        description={tCommon('bulkDeleteConfirm', { count: bulkDeleteIds.length })}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={bulkDeleteLoading}
      />
    </div>
  );
}
