'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ProfitChart } from '@/components/dashboard/ProfitChart';
import { LossRatioChart } from '@/components/dashboard/LossRatioChart';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, DollarSign, Percent } from 'lucide-react';

interface KPI {
  value: number;
  change: number;
  rawStock?: number;
  finishedStock?: number;
}

interface DashboardData {
  period: 'week' | 'month';
  periodStart: string;
  periodEnd: string;
  kpis: {
    totalInventory: KPI;
    monthlyRevenue: KPI;
    monthlyProfit: KPI;
    avgLossRatio: KPI;
  };
  charts: {
    revenue: Array<{ date: string; revenue: number; profit: number }>;
    batches: Array<{ batch: number; date: string; lossRatio: number; totalCost: number }>;
  };
}

const defaultKPI: KPI = { value: 0, change: 0 };

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const fetchData = useCallback(async (selectedPeriod: 'week' | 'month') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dashboard?period=${selectedPeriod}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} />
        <LoadingSkeleton type="card" rows={4} />
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalInventory: defaultKPI,
    monthlyRevenue: defaultKPI,
    monthlyProfit: defaultKPI,
    avgLossRatio: defaultKPI,
  };

  // Map revenue chart: API returns { date, revenue, profit } -> chart expects { month, revenue }
  const revenueChartData = (data?.charts.revenue || []).map((item) => ({
    month: item.date,
    revenue: item.revenue,
  }));

  // Map profit chart: API returns { date, revenue, profit } -> chart expects { month, profit }
  const profitChartData = (data?.charts.revenue || []).map((item) => ({
    month: item.date,
    profit: item.profit,
  }));

  // Map loss ratio chart: API returns { batch, date, lossRatio, totalCost } -> chart expects { batch, lossRatio }
  const lossRatioChartData = (data?.charts.batches || []).map((item) => ({
    batch: item.batch,
    lossRatio: item.lossRatio,
  }));

  const periodLabel = period === 'week' ? t('thisWeek') : t('thisMonth');

  return (
    <div>
      <PageHeader title={t('title')} />

      {/* Period Selector */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
        <Tabs value={period} onValueChange={(val) => setPeriod(val as 'week' | 'month')}>
          <TabsList>
            <TabsTrigger value="week">{t('weekly')}</TabsTrigger>
            <TabsTrigger value="month">{t('monthly')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('totalInventory')}
          value={kpis.totalInventory.value.toLocaleString()}
          unit={tCommon('kg')}
          change={kpis.totalInventory.change}
          icon={Package}
        />
        <KPICard
          title={period === 'week' ? t('weeklyRevenue') : t('monthlyRevenue')}
          value={kpis.monthlyRevenue.value.toLocaleString()}
          unit={tCommon('currency')}
          change={kpis.monthlyRevenue.change}
          icon={TrendingUp}
        />
        <KPICard
          title={period === 'week' ? t('weeklyProfit') : t('monthlyProfit')}
          value={kpis.monthlyProfit.value.toLocaleString()}
          unit={tCommon('currency')}
          change={kpis.monthlyProfit.change}
          icon={DollarSign}
        />
        <KPICard
          title={t('avgLossRatio')}
          value={`${(kpis.avgLossRatio.value * 100).toFixed(1)}%`}
          change={kpis.avgLossRatio.change}
          icon={Percent}
        />
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <RevenueChart data={revenueChartData} />
        <ProfitChart data={profitChartData} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LossRatioChart data={lossRatioChartData} />
        <AlertsPanel />
      </div>
    </div>
  );
}
