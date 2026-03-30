'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const userFormSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'OPERATOR', 'ACCOUNTANT', 'VIEWER']),
});

type UserFormData = z.infer<typeof userFormSchema>;

export function UserForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { role: 'VIEWER' },
  });

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (res.ok) {
        toast({ title: tCommon('success') });
        onSuccess?.();
      } else {
        const json = await res.json();
        toast({ title: json.error?.message || tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('username')}</Label>
          <Input {...register('username')} />
          {errors.username && <p className="text-sm text-danger">{errors.username.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('email')}</Label>
          <Input type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('fullName')}</Label>
          <Input {...register('fullName')} />
          {errors.fullName && <p className="text-sm text-danger">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{tCommon('phone')}</Label>
          <Input {...register('phone')} />
        </div>
        <div className="space-y-2">
          <Label>{tCommon('password') || 'Password'}</Label>
          <Input type="password" {...register('password')} />
          {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('role')}</Label>
          <Select defaultValue="VIEWER" onValueChange={(v) => setValue('role', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">{t('roles.ADMIN')}</SelectItem>
              <SelectItem value="OPERATOR">{t('roles.OPERATOR')}</SelectItem>
              <SelectItem value="ACCOUNTANT">{t('roles.ACCOUNTANT')}</SelectItem>
              <SelectItem value="VIEWER">{t('roles.VIEWER')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>{loading ? tCommon('loading') : tCommon('save')}</Button>
      </div>
    </form>
  );
}
