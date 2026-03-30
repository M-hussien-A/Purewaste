'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Flame, Languages } from 'lucide-react';
import { useRouter as useIntlRouter } from '@/i18n/navigation';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const intlRouter = useIntlRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      username: data.username,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('loginError'));
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
    }
  };

  const toggleLocale = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    intlRouter.replace('/login', { locale: newLocale });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-4">
      <div className="absolute end-4 top-4">
        <Button variant="ghost" size="icon" onClick={toggleLocale}>
          <Languages className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Flame className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {locale === 'ar' ? 'نظام إدارة المسبك' : 'Foundry Management System'}
          </CardTitle>
          <CardDescription>{t('loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <Input
                id="username"
                {...register('username')}
                placeholder={t('username')}
                autoComplete="username"
              />
              {errors.username && (
                <p className="text-sm text-danger">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder={t('password')}
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-sm text-danger">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('welcomeBack') + '...' : t('login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
