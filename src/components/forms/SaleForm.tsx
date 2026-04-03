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

const saleSchema = z.object({
  date: z.string().min(1),
  customerId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().positive(),
  pricePerKg: z.number().positive(),
  notes: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleSchema>;

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  batchNumber: string;
}

interface SaleFormProps {
  initialData?: Record<string, unknown> | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SaleForm({ initialData, onSuccess, onCancel }: SaleFormProps) {
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      date: (initialData?.date as string)?.split('T')[0] || new Date().toISOString().split('T')[0],
      customerId: (initialData?.customerId as string) || '',
      productId: (initialData?.productId as string) || '',
      batchId: (initialData?.batchId as string) || '',
      quantity: (initialData?.quantity as number) || 0,
      pricePerKg: (initialData?.pricePerKg as number) || 0,
      notes: (initialData?.notes as string) || '',
    },
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/accounts/customers').then((r) => r.json()),
      fetch('/api/v1/inventory/finished').then((r) => r.json()),
    ]).then(([custRes, prodRes]) => {
      setCustomers(custRes.data || []);
      setProducts(prodRes.data || []);
    });
  }, []);

  const watchedProductId = watch('productId');

  useEffect(() => {
    if (watchedProductId) {
      fetch(`/api/v1/inventory/finished/${watchedProductId}/batches`)
        .then((r) => r.json())
        .then((res) => setBatches(res.data || []))
        .catch(() => setBatches([]));
    } else {
      setBatches([]);
    }
  }, [watchedProductId]);

  const watchedQty = watch('quantity');
  const watchedPrice = watch('pricePerKg');
  const totalRevenue = useMemo(
    () => (Number(watchedQty) || 0) * (Number(watchedPrice) || 0),
    [watchedQty, watchedPrice]
  );

  const onSubmit = async (data: SaleFormValues) => {
    try {
      setSubmitting(true);
      const url = initialData
        ? `/api/v1/sales/${(initialData as Record<string, unknown>).id}`
        : '/api/v1/sales';
      const method = initialData ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
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
        <Label>{tCommon('date')} <span className="text-destructive">*</span></Label>
        <Input type="date" {...register('date')} />
        {errors.date && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('customer')} <span className="text-destructive">*</span></Label>
        <Select
          value={watch('customerId')}
          onValueChange={(val) => setValue('customerId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('customer')} />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.customerId && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('product')} <span className="text-destructive">*</span></Label>
        <Select
          value={watch('productId')}
          onValueChange={(val) => setValue('productId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('product')} />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.productId && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      {batches.length > 0 && (
        <div className="space-y-2">
          <Label>{t('batch')}</Label>
          <Select
            value={watch('batchId') || ''}
            onValueChange={(val) => setValue('batchId', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('batch')} />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batchNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('quantity')} <span className="text-destructive">*</span></Label>
          <Input type="number" step="0.01" {...register('quantity', { valueAsNumber: true })} />
          {errors.quantity && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('pricePerKg')} <span className="text-destructive">*</span></Label>
          <Input type="number" step="0.01" {...register('pricePerKg', { valueAsNumber: true })} />
          {errors.pricePerKg && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted p-3 text-sm">
        <span className="text-muted-foreground">{t('totalRevenue')}: </span>
        <span className="font-bold">
          {totalRevenue.toLocaleString()} {tCommon('currency')}
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
