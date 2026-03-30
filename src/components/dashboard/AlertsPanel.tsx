'use client';

import { useTranslations } from 'next-intl';
import { useAlerts } from '@/hooks/useAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const severityConfig = {
  critical: { icon: AlertCircle, variant: 'destructive' as const, color: 'text-danger' },
  warning: { icon: AlertTriangle, variant: 'warning' as const, color: 'text-warning' },
  info: { icon: Info, variant: 'default' as const, color: 'text-primary' },
};

export function AlertsPanel() {
  const t = useTranslations('dashboard');
  const tAlerts = useTranslations('alerts');
  const { alerts, isLoading } = useAlerts();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t('activeAlerts')}
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ms-2">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tAlerts('info')}
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const AlertIcon = config.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <AlertIcon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} />
                  <p className="text-sm">{alert.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
