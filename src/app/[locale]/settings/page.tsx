'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';

const settingsSchema = z.object({
  electricityRate: z.number().min(0),
  laborRate: z.number().min(0),
  monthlyMaintenance: z.number().min(0),
  foundryName: z.string().min(1),
  foundryNameEn: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      electricityRate: 0,
      laborRate: 0,
      monthlyMaintenance: 0,
      foundryName: '',
      foundryNameEn: '',
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/v1/settings');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            reset(json.data);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [reset]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: tCommon('success') });
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

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} />
        <p className="text-muted-foreground">{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('title')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('systemSettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('foundryName')}</Label>
                <Input {...register('foundryName')} />
                {errors.foundryName && (
                  <p className="text-sm text-destructive">{tCommon('required')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('foundryNameEn')}</Label>
                <Input {...register('foundryNameEn')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('electricityRate')}</Label>
                <Input type="number" step="0.01" {...register('electricityRate', { valueAsNumber: true })} />
                {errors.electricityRate && (
                  <p className="text-sm text-destructive">{tCommon('required')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('laborRate')}</Label>
                <Input type="number" step="0.01" {...register('laborRate', { valueAsNumber: true })} />
                {errors.laborRate && (
                  <p className="text-sm text-destructive">{tCommon('required')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('monthlyMaintenance')}</Label>
                <Input type="number" step="0.01" {...register('monthlyMaintenance', { valueAsNumber: true })} />
                {errors.monthlyMaintenance && (
                  <p className="text-sm text-destructive">{tCommon('required')}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                <Save className="me-2 h-4 w-4" />
                {submitting ? tCommon('loading') : tCommon('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
