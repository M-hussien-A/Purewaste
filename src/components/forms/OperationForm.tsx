'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const operationSchema = z.object({
  date: z.string().min(1),
  inputMaterials: z
    .array(
      z.object({
        materialId: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  outputProducts: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  workerIds: z.array(z.string()),
  electricityHrs: z.number().min(0),
  laborHrs: z.number().min(0),
  fuelCost: z.number().min(0),
  otherExpenses: z.number().min(0),
});

type OperationFormValues = z.infer<typeof operationSchema>;

interface Material {
  id: string;
  name: string;
  avgCostPerKg: number;
}

interface Product {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  name: string;
  nameAr: string;
  costPerKg: number;
}

interface Settings {
  electricityRate: number;
  laborRate: number;
  monthlyMaintenance: number;
}

interface OperationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function OperationForm({ onSuccess, onCancel }: OperationFormProps) {
  const t = useTranslations('operations');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<Settings>({
    electricityRate: 0,
    laborRate: 0,
    monthlyMaintenance: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OperationFormValues>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      inputMaterials: [{ materialId: '', quantity: 0 }],
      outputProducts: [{ productId: '', quantity: 0 }],
      workerIds: [],
      electricityHrs: 0,
      laborHrs: 0,
      fuelCost: 0,
      otherExpenses: 0,
    },
  });

  const {
    fields: inputFields,
    append: appendInput,
    remove: removeInput,
  } = useFieldArray({ control, name: 'inputMaterials' });

  const {
    fields: outputFields,
    append: appendOutput,
    remove: removeOutput,
  } = useFieldArray({ control, name: 'outputProducts' });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/inventory/raw').then((r) => r.json()),
      fetch('/api/v1/inventory/finished').then((r) => r.json()),
      fetch('/api/v1/settings').then((r) => r.json()),
      fetch('/api/v1/labor').then((r) => r.json()),
    ]).then(([matRes, prodRes, settRes, workersRes]) => {
      setMaterials(matRes.data || []);
      setProducts(prodRes.data || []);
      if (settRes.data) setSettings(settRes.data);
      setWorkers(workersRes.data || []);
    });
  }, []);

  const watchedInputs = watch('inputMaterials');
  const watchedOutputs = watch('outputProducts');
  const watchedWorkerIds = watch('workerIds');
  const watchedElectricity = watch('electricityHrs');
  const watchedLabor = watch('laborHrs');
  const watchedFuel = watch('fuelCost');
  const watchedOther = watch('otherExpenses');

  const calculations = useMemo(() => {
    const totalInput = (watchedInputs || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const totalOutput = (watchedOutputs || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const lossRatio = totalInput > 0 ? (totalInput - totalOutput) / totalInput : 0;

    const materialCost = (watchedInputs || []).reduce((sum, item) => {
      const mat = materials.find((m) => m.id === item.materialId);
      return sum + (Number(item.quantity) || 0) * (mat?.avgCostPerKg || 0);
    }, 0);

    // Labor cost = sum of selected workers' costPerKg * totalOutput
    const laborCostPerKg = (watchedWorkerIds || []).reduce((sum, wId) => {
      const w = workers.find((w) => w.id === wId);
      return sum + (w ? Number(w.costPerKg) : 0);
    }, 0);
    const laborCost = laborCostPerKg * totalOutput;

    const electricityCost = (Number(watchedElectricity) || 0) * settings.electricityRate;
    const fuelCost = Number(watchedFuel) || 0;
    const otherExpenses = Number(watchedOther) || 0;
    const operatingCost =
      electricityCost + laborCost + fuelCost + otherExpenses + settings.monthlyMaintenance;
    const totalCost = materialCost + operatingCost;
    const costPerKg = totalOutput > 0 ? totalCost / totalOutput : 0;

    return {
      totalInput,
      totalOutput,
      lossRatio,
      materialCost,
      laborCost,
      fuelCost,
      operatingCost,
      totalCost,
      costPerKg,
    };
  }, [watchedInputs, watchedOutputs, watchedWorkerIds, watchedElectricity, watchedLabor, watchedFuel, watchedOther, materials, workers, settings]);

  const onSubmit = async (data: OperationFormValues) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/operations', {
        method: 'POST',
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Date */}
      <div className="space-y-2">
        <Label>{tCommon('date')} <span className="text-destructive">*</span></Label>
        <Input type="date" {...register('date')} />
        {errors.date && (
          <p className="text-sm text-destructive">{tCommon('required')}</p>
        )}
      </div>

      {/* Input Materials */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{t('inputMaterials')} <span className="text-destructive">*</span></Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendInput({ materialId: '', quantity: 0 })}
          >
            <Plus className="me-1 h-3 w-3" />
            {t('addMaterial')}
          </Button>
        </div>
        {inputFields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label>{t('materialType')} <span className="text-destructive">*</span></Label>
              <Select
                value={watchedInputs?.[index]?.materialId || ''}
                onValueChange={(val) =>
                  setValue(`inputMaterials.${index}.materialId`, val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('materialType')} />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1">
              <Label>{t('inputQty')} <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                {...register(`inputMaterials.${index}.quantity`, { valueAsNumber: true })}
              />
            </div>
            {inputFields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInput(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Output Products */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{t('outputProducts')} <span className="text-destructive">*</span></Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendOutput({ productId: '', quantity: 0 })}
          >
            <Plus className="me-1 h-3 w-3" />
            {t('addProduct')}
          </Button>
        </div>
        {outputFields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label>{t('productType')} <span className="text-destructive">*</span></Label>
              <Select
                value={watchedOutputs?.[index]?.productId || ''}
                onValueChange={(val) =>
                  setValue(`outputProducts.${index}.productId`, val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('productType')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1">
              <Label>{t('outputQty')} <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                {...register(`outputProducts.${index}.quantity`, { valueAsNumber: true })}
              />
            </div>
            {outputFields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOutput(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Workers Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">{t('workers')}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {workers.map((w) => {
            const isSelected = (watchedWorkerIds || []).includes(w.id);
            return (
              <label
                key={w.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    const current = watchedWorkerIds || [];
                    if (e.target.checked) {
                      setValue('workerIds', [...current, w.id]);
                    } else {
                      setValue('workerIds', current.filter((id: string) => id !== w.id));
                    }
                  }}
                  className="h-4 w-4"
                />
                <div>
                  <span className="text-sm font-medium">{w.nameAr || w.name}</span>
                  <span className="ms-1 text-xs text-muted-foreground">
                    ({Number(w.costPerKg).toFixed(2)} {tCommon('currency')}/{tCommon('kg')})
                  </span>
                </div>
              </label>
            );
          })}
        </div>
        {workers.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noWorkers')}</p>
        )}
      </div>

      {/* Operating Costs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label>{t('electricityHrs')}</Label>
          <Input type="number" step="0.1" {...register('electricityHrs', { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label>{t('laborHrs')}</Label>
          <Input type="number" step="0.1" {...register('laborHrs', { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label>{t('fuelCost')}</Label>
          <Input type="number" step="0.01" {...register('fuelCost', { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label>{t('otherExpenses')}</Label>
          <Input type="number" step="0.01" {...register('otherExpenses', { valueAsNumber: true })} />
        </div>
      </div>

      {/* Live Calculation Panel */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('costSummary')}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">{t('inputQty')}:</span>
          <span className="text-end font-medium">
            {calculations.totalInput.toLocaleString()} {tCommon('kg')}
          </span>

          <span className="text-muted-foreground">{t('outputQty')}:</span>
          <span className="text-end font-medium">
            {calculations.totalOutput.toLocaleString()} {tCommon('kg')}
          </span>

          <span className="text-muted-foreground">{t('lossRatio')}:</span>
          <span className="text-end font-medium">
            {(calculations.lossRatio * 100).toFixed(1)}%
          </span>

          <span className="text-muted-foreground">{t('materialCost')}:</span>
          <span className="text-end font-medium">
            {calculations.materialCost.toLocaleString()} {tCommon('currency')}
          </span>

          <span className="text-muted-foreground">{t('laborCost')}:</span>
          <span className="text-end font-medium">
            {calculations.laborCost.toLocaleString()} {tCommon('currency')}
          </span>

          <span className="text-muted-foreground">{t('fuelCost')}:</span>
          <span className="text-end font-medium">
            {calculations.fuelCost.toLocaleString()} {tCommon('currency')}
          </span>

          <span className="text-muted-foreground">{t('operatingCost')}:</span>
          <span className="text-end font-medium">
            {calculations.operatingCost.toLocaleString()} {tCommon('currency')}
          </span>

          <span className="text-muted-foreground font-semibold">{t('totalCost')}:</span>
          <span className="text-end font-bold">
            {calculations.totalCost.toLocaleString()} {tCommon('currency')}
          </span>

          <span className="text-muted-foreground font-semibold">{t('costPerKg')}:</span>
          <span className="text-end font-bold">
            {calculations.costPerKg.toFixed(2)} {tCommon('currency')}
          </span>
        </div>
      </Card>

      {/* Actions */}
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
