'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { FileDown, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

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
        `/api/v1/reports/profit?startDate=${startDate}&endDate=${endDate}`
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

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={handleGeneratePDF} disabled={generating}>
            <FileDown className="me-2 h-4 w-4" />
            {generating ? tCommon('loading') : t('generatePDF')}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t('startDate')}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('endDate')}</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? tCommon('loading') : t('applyFilter')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalRevenue')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(report?.totalRevenue || 0).toLocaleString()} {tCommon('currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalCosts')}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(report?.totalCosts || 0).toLocaleString()} {tCommon('currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('netProfit')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (report?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {Number(report?.netProfit || 0).toLocaleString()} {tCommon('currency')}
            </div>
          </CardContent>
        </Card>
      </div>

      {report?.breakdown && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t('breakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.breakdown.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {Number(item.value || 0).toLocaleString()} {tCommon('currency')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
