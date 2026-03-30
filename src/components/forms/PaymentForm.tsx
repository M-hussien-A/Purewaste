'use client';

import { useEffect, useState } from 'react';
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

const paymentSchema = z.object({
  type: z.enum(['PAYABLE', 'RECEIVABLE']),
  date: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  supplierId: z.string().optional(),
  customerId: z.string().optional(),
  purchaseId: z.string().optional(),
  saleId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface Option {
  id: string;
  name: string;
}

interface PaymentFormProps {
  defaultType?: 'PAYABLE' | 'RECEIVABLE';
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentForm({ defaultType = 'PAYABLE', onSuccess, onCancel }: PaymentFormProps) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [purchases, setPurchases] = useState<Option[]>([]);
  const [sales, setSales] = useState<Option[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      type: defaultType,
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      method: 'CASH',
      supplierId: '',
      customerId: '',
      purchaseId: '',
      saleId: '',
      reference: '',
      notes: '',
    },
  });

  const watchedType = watch('type');
  const watchedSupplierId = watch('supplierId');
  const watchedCustomerId = watch('customerId');

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/accounts/suppliers').then((r) => r.json()),
      fetch('/api/v1/accounts/customers').then((r) => r.json()),
    ]).then(([supRes, custRes]) => {
      setSuppliers(supRes.data || []);
      setCustomers(custRes.data || []);
    });
  }, []);

  useEffect(() => {
    if (watchedType === 'PAYABLE' && watchedSupplierId) {
      fetch(`/api/v1/purchases?supplierId=${watchedSupplierId}&unpaid=true`)
        .then((r) => r.json())
        .then((res) => setPurchases(res.data || []))
        .catch(() => setPurchases([]));
    }
  }, [watchedType, watchedSupplierId]);

  useEffect(() => {
    if (watchedType === 'RECEIVABLE' && watchedCustomerId) {
      fetch(`/api/v1/sales?customerId=${watchedCustomerId}&unpaid=true`)
        .then((r) => r.json())
        .then((res) => setSales(res.data || []))
        .catch(() => setSales([]));
    }
  }, [watchedType, watchedCustomerId]);

  const onSubmit = async (data: PaymentFormValues) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('type')}</Label>
          <Select
            value={watchedType}
            onValueChange={(val) => setValue('type', val as 'PAYABLE' | 'RECEIVABLE')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAYABLE">{t('payable')}</SelectItem>
              <SelectItem value="RECEIVABLE">{t('receivable')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{tCommon('date')}</Label>
          <Input type="date" {...register('date')} />
          {errors.date && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
      </div>

      {watchedType === 'PAYABLE' && (
        <>
          <div className="space-y-2">
            <Label>{t('supplier')}</Label>
            <Select
              value={watch('supplierId') || ''}
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
          </div>
          {purchases.length > 0 && (
            <div className="space-y-2">
              <Label>{t('purchase')}</Label>
              <Select
                value={watch('purchaseId') || ''}
                onValueChange={(val) => setValue('purchaseId', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('purchase')} />
                </SelectTrigger>
                <SelectContent>
                  {purchases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {watchedType === 'RECEIVABLE' && (
        <>
          <div className="space-y-2">
            <Label>{t('customer')}</Label>
            <Select
              value={watch('customerId') || ''}
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
          </div>
          {sales.length > 0 && (
            <div className="space-y-2">
              <Label>{t('sale')}</Label>
              <Select
                value={watch('saleId') || ''}
                onValueChange={(val) => setValue('saleId', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('sale')} />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('amount')}</Label>
          <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          {errors.amount && (
            <p className="text-sm text-destructive">{tCommon('required')}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('method')}</Label>
          <Select
            value={watch('method')}
            onValueChange={(val) => setValue('method', val as 'CASH' | 'BANK_TRANSFER' | 'CHECK')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">{t('cash')}</SelectItem>
              <SelectItem value="BANK_TRANSFER">{t('bankTransfer')}</SelectItem>
              <SelectItem value="CHECK">{t('check')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('reference')}</Label>
        <Input {...register('reference')} />
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
