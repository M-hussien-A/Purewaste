'use client';

import { Bell, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAlerts } from '@/hooks/useAlerts';
import { useTranslations } from 'next-intl';

const severityIcon = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityColor = {
  critical: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export function NotificationBell() {
  const { alerts, count } = useAlerts();
  const t = useTranslations('dashboard');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-3">
          <h4 className="text-sm font-semibold">{t('activeAlerts')}</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t('noAlerts') || 'No alerts'}
            </p>
          ) : (
            alerts.map((alert) => {
              const Icon = severityIcon[alert.severity] || Info;
              const color = severityColor[alert.severity] || 'text-blue-500';
              return (
                <div key={alert.id} className="flex items-start gap-3 border-b p-3 last:border-b-0">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <p className="text-sm">{alert.message}</p>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
