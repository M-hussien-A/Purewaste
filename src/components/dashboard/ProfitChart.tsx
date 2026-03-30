'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ProfitChartProps {
  data: Array<{ month: string; profit: number }>;
}

export function ProfitChart({ data }: ProfitChartProps) {
  const t = useTranslations('dashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profitTrend')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} />
              <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text-primary)',
                }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-success)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
