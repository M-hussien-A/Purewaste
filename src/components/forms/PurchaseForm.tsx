'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
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

const purchaseSchema = z.object({
  date: z.string().min(1),
  supplierId: z.string().min(1),
  materialId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface Supplier {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
}

interface PurchaseFormProps {
  initialData?: Record<string, unknown> | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PurchaseForm({ initialData, onSuccess, onCancel }: PurchaseFormProps) {
  const t = useTranslations('purchases');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: (initialData?.date as string)?.split('T')[0] || new Date().toISOString().split('T')[0],
      supplierId: (initialData?.supplierId as string) || '',
      materialId: (initialData?.materialId as string) || '',
      quantity: (initialData?.quantity as number) || 0,
      unitPrice: (initialData?.unitPrice as number) || 0,
      notes: (initialData?.notes as string) || '',
    },
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/accounts/suppliers').then((r) => r.json()),
      fetch('/api/v1/inventory/raw').then((r) => r.json()),
    ]).then(([supRes, matRes]) => {
      setSuppliers(supRes.data || []);
      setMaterials(matRes.data || []);
    });
  }, []);

  const watchedQty = watch('quantity');
  const watchedPrice = watch('unitPrice');
  const totalCost = useMemo(
    () => (Number(watchedQty) || 0) * (Number(watchedPrice) || 0),
    [watchedQty, watchedPrice]
  );

  const onSubmit = async (data: PurchaseFormValues) => {
    try {
      setSubmitting(true);
      const url = initialData
        ? `/api/v1/purchases/${(initialData as Record<string, unknown>).id}`
        : '/api/v1/purchases';
      const method = initialData ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onSuccess();
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>{tCommon('date')}</Label>
        <Input type="date" {...register('date')} />
        {errors.date && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('supplier')}</Label>
        <Select
          value={watch('supplierId')}
          onValueChange={(val) => setValue('supplierId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('supplier')} />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.supplierId && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('material')}</Label>
        <Select
          value={watch('materialId')}
          onValueChange={(val) => setValue('materialId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('material')} />
          </SelectTrigger>
          <SelectContent>
            {materials.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.materialId && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('quantity')}</Label>
          <Input type="number" step="0.01" {...register('quantity', { valueAsNumber: true })} />
          {errors.quantity && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('unitPrice')}</Label>
          <Input type="number" step="0.01" {...register('unitPrice', { valueAsNumber: true })} />
          {errors.unitPrice && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted p-3 text-sm">
        <span className="text-muted-foreground">{t('totalCost')}: </span>
        <span className="font-bold">
          {totalCost.toLocaleString()} {tCommon('currency')}
        </span>
      </div>

      <div className="space-y-2">
        <Label>{tCommon('notes')}</Label>
        <Input {...register('notes')} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? tCommon('loading') : tCommon('submit')}
        </Button>
      </div>
    </form>
  );
}
