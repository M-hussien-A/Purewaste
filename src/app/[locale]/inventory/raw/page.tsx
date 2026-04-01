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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, AlertTriangle } from 'lucide-react';
import { exportToCsv } from '@/lib/export-csv';

export default function RawMaterialsPage() {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('ADD');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/raw');
      if (res.ok) {
        const json = await res.json();
        setMaterials(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleAdjustment = async () => {
    if (!selectedMaterial || !adjustmentQty) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/inventory/raw/${selectedMaterial.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adjustmentType,
          quantity: Number(adjustmentQty),
          reason: adjustmentReason,
        }),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setShowAdjustment(false);
        setAdjustmentQty('');
        setAdjustmentReason('');
        fetchMaterials();
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

  const handleExport = () => {
    exportToCsv('raw-materials', materials, [
      { key: 'nameAr', header: t('name') },
      { key: 'currentStock', header: t('currentStock') },
      { key: 'minStockLevel', header: t('minStockLevel') },
      { key: 'avgCostPerKg', header: t('avgCostPerKg') },
      { key: 'unit', header: tCommon('unit') },
    ]);
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'nameAr', header: t('name') },
    { accessorKey: 'category', header: t('category') },
    {
      accessorKey: 'currentStock',
      header: t('currentStock'),
      cell: ({ row }) => {
        const isLow = row.original.currentStock < row.original.minStockLevel;
        return (
          <span className={isLow ? 'flex items-center gap-1 font-bold text-destructive' : ''}>
            {isLow && <AlertTriangle className="h-4 w-4" />}
            {row.original.currentStock} {tCommon('kg')}
          </span>
        );
      },
    },
    {
      accessorKey: 'minStockLevel',
      header: t('minStockLevel'),
      cell: ({ row }) => `${row.original.minStockLevel} ${tCommon('kg')}`,
    },
    {
      accessorKey: 'avgCostPerKg',
      header: t('avgCostPerKg'),
      cell: ({ row }) =>
        `${Number(row.original.avgCostPerKg).toFixed(2)} ${tCommon('currency')}`,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedMaterial(row.original);
            setShowAdjustment(true);
          }}
        >
          {t('adjust')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('rawMaterials')} />
      <DataTable columns={columns} data={materials} loading={loading} onExport={handleExport} />
      <Dialog open={showAdjustment} onOpenChange={setShowAdjustment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stockAdjustment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selectedMaterial?.nameAr} - {t('currentStock')}:{' '}
              {selectedMaterial?.currentStock} {tCommon('kg')}
            </p>
            <div className="space-y-2">
              <Label>{t('adjustmentType')}</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">{t('add')}</SelectItem>
                  <SelectItem value="SUBTRACT">{t('subtract')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('quantity')}</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAdjustment(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleAdjustment} disabled={submitting}>
                {submitting ? tCommon('loading') : tCommon('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
