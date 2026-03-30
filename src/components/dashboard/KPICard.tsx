'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  unit?: string;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
}

export function KPICard({ title, value, unit, change, icon: Icon, iconColor }: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {value}
              {unit && <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>}
            </p>
            {change !== undefined && (
              <div className={cn(
                'flex items-center gap-1 text-xs',
                isPositive && 'text-success',
                isNegative && 'text-danger'
              )}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
                <span>{Math.abs(change).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-lg p-3', iconColor || 'bg-primary/10')}>
            <Icon className={cn('h-6 w-6', iconColor ? 'text-white' : 'text-primary')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
