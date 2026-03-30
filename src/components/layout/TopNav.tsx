'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { Menu, Sun, Moon, Monitor, Languages } from 'lucide-react';

export function TopNav() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useSidebarStore();
  const { theme, setTheme } = useThemeStore();

  const toggleLocale = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: newLocale });
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIdx = themes.indexOf(theme);
    const nextTheme = themes[(currentIdx + 1) % themes.length];
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLocale}
          title={locale === 'ar' ? 'English' : 'العربية'}
        >
          <Languages className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={t(theme)}
        >
          <ThemeIcon className="h-5 w-5" />
        </Button>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
