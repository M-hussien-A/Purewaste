'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
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
import { OperationForm } from '@/components/forms/OperationForm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { exportToXlsx } from '@/lib/export-xlsx';

interface Batch {
  id: string;
  batchNumber: number;
  date: string;
  totalInputQty: number;
  totalOutputQty: number;
  lossRatio: number;
  totalCost: number;
  costPerKg: number;
  status: string;
}

export default function OperationsPage() {
  const t = useTranslations('operations');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const locale = useLocale();
  const router = useRouter();
  const { isAdmin } = useCurrentUser();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit state
  const [editBatch, setEditBatch] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ status: '', notes: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/operations');
      if (res.ok) {
        const json = await res.json();
        setBatches(json.data || []);
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchBatches();
    toast({ title: tCommon('success') });
  };

  const openEdit = async (batch: Batch) => {
    try {
      const res = await fetch(`/api/v1/operations/${batch.id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setEditBatch(data);
        setEditData({
          status: data.status || 'COMPLETED',
          notes: data.notes || '',
        });
        setEditDialogOpen(true);
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    }
  };

  const handleEditSave = async () => {
    if (!editBatch) return;
    try {
      setEditSubmitting(true);
      const res = await fetch(`/api/v1/operations/${editBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setEditDialogOpen(false);
        setEditBatch(null);
        fetchBatches();
      } else {
        const err = await res.json();
        toast({ title: err.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/operations/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchBatches();
      } else {
        toast({ title: tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = (rows: Batch[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const confirmBulkDelete = async () => {
    setDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/operations/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: tCommon('success') });
      setBulkDeleteIds([]);
      fetchBatches();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    exportToXlsx('operations', batches, [
      { key: 'batchNumber', header: t('batchNumber') },
      { key: 'date', header: tCommon('date') },
      { key: 'status', header: t('batchStatus') },
      { key: 'totalInputQty', header: t('inputQty') },
      { key: 'totalOutputQty', header: t('outputQty') },
      { key: 'lossRatio', header: t('lossRatio') },
      { key: 'totalCost', header: t('totalCost') },
      { key: 'costPerKg', header: t('costPerKg') },
    ]);
  };

  const columns: ColumnDef<Batch>[] = [
    {
      accessorKey: 'batchNumber',
      header: t('batchNumber'),
    },
    {
      accessorKey: 'date',
      header: tCommon('date'),
      cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString(),
    },
    {
      accessorKey: 'totalInputQty',
      header: t('inputQty'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalInputQty')).toLocaleString()} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'totalOutputQty',
      header: t('outputQty'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalOutputQty')).toLocaleString()} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'lossRatio',
      header: t('lossRatio'),
      cell: ({ row }) => `${(Number(row.getValue('lossRatio')) * 100).toFixed(1)}%`,
    },
    {
      accessorKey: 'totalCost',
      header: t('totalCost'),
      cell: ({ row }) =>
        `${Number(row.getValue('totalCost')).toLocaleString()} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'costPerKg',
      header: t('costPerKg'),
      cell: ({ row }) =>
        `${Number(row.getValue('costPerKg')).toFixed(2)} ${tCommon('currency')}`,
    },
    {
      accessorKey: 'status',
      header: t('batchStatus'),
      cell: ({ row }) => (
        <StatusBadge status={row.getValue('status')} type="batch" />
      ),
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: tCommon('actions'),
            cell: ({ row }: { row: { original: Batch } }) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(row.original)}
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
          } as ColumnDef<Batch>,
        ]
      : []),
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
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newBatch')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={batches}
        searchColumn="batchNumber"
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? handleBulkDelete : undefined}
        onExport={handleExport}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('newBatch')}</DialogTitle>
          </DialogHeader>
          <OperationForm onSuccess={handleSuccess} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Operation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editBatch')} #{editBatch?.batchNumber}</DialogTitle>
          </DialogHeader>
          {editBatch && (
            <div className="space-y-6">
              {/* Read-only summary */}
              <div className="grid grid-cols-2 gap-3 text-sm rounded-lg border p-4">
                <div>
                  <span className="text-muted-foreground">{tCommon('date')}:</span>
                  <span className="ms-2 font-medium">{new Date(editBatch.date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('inputQty')}:</span>
                  <span className="ms-2 font-medium">{Number(editBatch.totalInputQty).toLocaleString()} {tCommon('kg')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('outputQty')}:</span>
                  <span className="ms-2 font-medium">{Number(editBatch.totalOutputQty).toLocaleString()} {tCommon('kg')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('lossRatio')}:</span>
                  <span className="ms-2 font-medium">{(Number(editBatch.lossRatio) * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('totalCost')}:</span>
                  <span className="ms-2 font-medium">{Number(editBatch.totalCost).toLocaleString()} {tCommon('currency')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('costPerKg')}:</span>
                  <span className="ms-2 font-medium">{Number(editBatch.costPerKg).toFixed(2)} {tCommon('currency')}</span>
                </div>
              </div>

              {/* Inputs summary */}
              {editBatch.inputs?.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">{t('inputMaterials')}</Label>
                  <div className="mt-1 space-y-1">
                    {editBatch.inputs.map((inp: any) => (
                      <div key={inp.id} className="flex justify-between text-sm border rounded px-3 py-1.5">
                        <span>{inp.material?.nameAr || inp.material?.name}</span>
                        <span>{Number(inp.quantity).toLocaleString()} {tCommon('kg')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outputs summary */}
              {editBatch.outputs?.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">{t('outputProducts')}</Label>
                  <div className="mt-1 space-y-1">
                    {editBatch.outputs.map((out: any) => (
                      <div key={out.id} className="flex justify-between text-sm border rounded px-3 py-1.5">
                        <span>{out.product?.nameAr || out.product?.name}</span>
                        <span>{Number(out.quantity).toLocaleString()} {tCommon('kg')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('batchStatus')}</Label>
                  <Select
                    value={editData.status}
                    onValueChange={(v) => setEditData({ ...editData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPLETED">{t('statusCompleted')}</SelectItem>
                      <SelectItem value="IN_PROGRESS">{t('statusInProgress')}</SelectItem>
                      <SelectItem value="CANCELLED">{t('statusCancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tCommon('notes')}</Label>
                  <Input
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    placeholder={tCommon('notes')}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button onClick={handleEditSave} disabled={editSubmitting}>
                  {editSubmitting ? tCommon('loading') : tCommon('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={tCommon('confirmDelete')}
        description={tCommon('confirmDeleteDescription')}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteLoading}
      />

      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}
        title={tCommon('confirmDelete')}
        description={tCommon('confirmBulkDeleteDescription')}
        onConfirm={confirmBulkDelete}
        variant="destructive"
        loading={deleteLoading}
      />
    </div>
  );
}
