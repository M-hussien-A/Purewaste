'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ProfitChart } from '@/components/dashboard/ProfitChart';
import { LossRatioChart } from '@/components/dashboard/LossRatioChart';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Package, TrendingUp, DollarSign, Percent } from 'lucide-react';

interface DashboardData {
  kpis: {
    totalInventory: number;
    monthlyRevenue: number;
    monthlyProfit: number;
    avgLossRatio: number;
    inventoryChange: number;
    revenueChange: number;
    profitChange: number;
    lossRatioChange: number;
  };
  revenueChart: Array<{ month: string; revenue: number }>;
  profitChart: Array<{ month: string; profit: number }>;
  lossRatioChart: Array<{ batch: number; lossRatio: number }>;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/v1/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} />
        <LoadingSkeleton type="card" rows={4} />
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalInventory: 0,
    monthlyRevenue: 0,
    monthlyProfit: 0,
    avgLossRatio: 0,
    inventoryChange: 0,
    revenueChange: 0,
    profitChange: 0,
    lossRatioChange: 0,
  };

  return (
    <div>
      <PageHeader title={t('title')} />

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('totalInventory')}
          value={kpis.totalInventory.toLocaleString()}
          unit={tCommon('kg')}
          change={kpis.inventoryChange}
          icon={Package}
        />
        <KPICard
          title={t('monthlyRevenue')}
          value={kpis.monthlyRevenue.toLocaleString()}
          unit={tCommon('currency')}
          change={kpis.revenueChange}
          icon={TrendingUp}
        />
        <KPICard
          title={t('monthlyProfit')}
          value={kpis.monthlyProfit.toLocaleString()}
          unit={tCommon('currency')}
          change={kpis.profitChange}
          icon={DollarSign}
        />
        <KPICard
          title={t('avgLossRatio')}
          value={`${(kpis.avgLossRatio * 100).toFixed(1)}%`}
          change={kpis.lossRatioChange}
          icon={Percent}
        />
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <RevenueChart data={data?.revenueChart || []} />
        <ProfitChart data={data?.profitChart || []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LossRatioChart data={data?.lossRatioChart || []} />
        <AlertsPanel />
      </div>
    </div>
  );
}
