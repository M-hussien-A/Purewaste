'use client';

import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const isLoginPage = pathname === `/${locale}/login`;

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopNav />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
