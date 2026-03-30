import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { routing } from '@/i18n/routing';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from './app-shell';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = locale === 'ar';

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            <AppShell>{children}</AppShell>
            <Toaster />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
