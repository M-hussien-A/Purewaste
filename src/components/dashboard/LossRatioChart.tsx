'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface LossRatioChartProps {
  data: Array<{ batch: number; lossRatio: number }>;
}

export function LossRatioChart({ data }: LossRatioChartProps) {
  const t = useTranslations('operations');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('lossRatio')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="batch"
                name={t('batchNumber')}
                stroke="var(--color-text-secondary)"
                fontSize={12}
              />
              <YAxis
                dataKey="lossRatio"
                name={t('lossRatio')}
                stroke="var(--color-text-secondary)"
                fontSize={12}
                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text-primary)',
                }}
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(2)}%`, t('lossRatio')]}
              />
              <Scatter data={data} fill="var(--color-danger)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
