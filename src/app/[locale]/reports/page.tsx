'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { FileDown } from 'lucide-react';

export default function ReportsPage() {
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/reports/profit?dateFrom=${startDate}&dateTo=${endDate}`
      );
      if (res.ok) {
        const json = await res.json();
        setReport(json.data || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleGeneratePDF = async () => {
    try {
      setGenerating(true);
      const res = await fetch(
        `/api/v1/reports/profit/pdf?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `profit-report-${startDate}-${endDate}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast({ title: tCommon('success') });
      } else {
        toast({ title: tCommon('error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const s = report?.summary;

  const PnLRow = ({ label, value, bold, indent, negative }: { label: string; value: number; bold?: boolean; indent?: boolean; negative?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${indent ? 'ps-6' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : ''} ${negative ? 'text-destructive' : ''}`}>
        {negative ? `(${Math.abs(value).toLocaleString()})` : value.toLocaleString()} {tCommon('currency')}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t('pnlTitle')}
        actions={
          <Button onClick={handleGeneratePDF} disabled={generating}>
            <FileDown className="me-2 h-4 w-4" />
            {generating ? tCommon('loading') : t('generatePDF')}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t('from')}</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('to')}</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? tCommon('loading') : t('applyFilter')}
        </Button>
      </div>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>{t('pnlTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* REVENUE */}
            <p className="text-sm font-semibold text-primary">{t('revenue')}</p>
            <PnLRow label={t('totalRevenue')} value={Number(s?.totalRevenue || 0)} indent />
            <Separator className="my-2" />

            {/* DIRECT COSTS */}
            <p className="text-sm font-semibold text-primary">{t('directCosts')}</p>
            <PnLRow label={t('totalCosts')} value={Number(s?.totalCosts || 0)} indent negative />
            <Separator className="my-2" />

            {/* GROSS PROFIT */}
            <PnLRow label={t('grossProfit')} value={Number(s?.grossProfit || 0)} bold />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">{t('grossMargin')}</span>
              <span className="text-xs font-medium">{Number(s?.grossMargin || 0).toFixed(1)}%</span>
            </div>
            <Separator className="my-2" />

            {/* PERIOD COSTS */}
            <p className="text-sm font-semibold text-primary">{t('periodCosts')}</p>

            {/* Daily Expenses */}
            <p className="ps-3 text-xs font-medium text-muted-foreground">{t('dailyExpenses')}</p>
            {(report.dailyExpenseBreakdown || []).map((item: any, i: number) => (
              <PnLRow key={i} label={item.nameAr} value={Number(item.total || 0)} indent />
            ))}
            {(report.dailyExpenseBreakdown || []).length > 0 && (
              <PnLRow label={t('totalDailyExpenses')} value={Number(s?.totalDailyExpenses || 0)} indent negative />
            )}

            {/* Monthly Overhead */}
            <p className="ps-3 pt-2 text-xs font-medium text-muted-foreground">{t('monthlyOverhead')}</p>
            {(report.monthlyOverheadBreakdown || []).map((item: any, i: number) => (
              <PnLRow key={i} label={item.nameAr} value={Number(item.total || 0)} indent />
            ))}
            {(report.monthlyOverheadBreakdown || []).length > 0 && (
              <PnLRow label={t('totalMonthlyOverhead')} value={Number(s?.totalMonthlyOverhead || 0)} indent negative />
            )}

            <PnLRow label={t('totalPeriodCosts')} value={Number(s?.totalPeriodCosts || 0)} negative />
            <Separator className="my-2" />

            {/* NET PROFIT */}
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-base font-bold">{t('netProfit')}</span>
              <span className={`text-xl font-bold ${Number(s?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {Number(s?.netProfit || 0).toLocaleString()} {tCommon('currency')}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">{t('netMargin')}</span>
              <span className="text-xs font-medium">{Number(s?.netMargin || 0).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
