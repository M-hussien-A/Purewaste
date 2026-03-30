'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

export default function AuditLogPage() {
  const t = useTranslations('auditLog');
  const tCommon = useTranslations('common');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (module) params.set('module', module);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/v1/audit-log?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'timestamp',
      header: t('timestamp'),
      cell: ({ row }) => new Date(row.original.timestamp).toLocaleString(),
    },
    { accessorKey: 'user.fullName', header: t('user') },
    {
      accessorKey: 'action',
      header: t('action'),
      cell: ({ row }) => t(`actions.${row.original.action}`),
    },
    { accessorKey: 'module', header: t('module') },
    { accessorKey: 'recordId', header: t('recordId') },
  ];

  return (
    <div>
      <PageHeader title={t('title')} />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t('action')}</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allActions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('allActions')}</SelectItem>
              <SelectItem value="CREATE">{t('actions.CREATE')}</SelectItem>
              <SelectItem value="UPDATE">{t('actions.UPDATE')}</SelectItem>
              <SelectItem value="DELETE">{t('actions.DELETE')}</SelectItem>
              <SelectItem value="LOGIN">{t('actions.LOGIN')}</SelectItem>
              <SelectItem value="LOGOUT">{t('actions.LOGOUT')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('module')}</Label>
          <Input
            className="w-40"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder={t('module')}
          />
        </div>
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
        <Button onClick={fetchLogs} disabled={loading}>
          <Search className="me-2 h-4 w-4" />
          {loading ? tCommon('loading') : t('search')}
        </Button>
      </div>

      <DataTable columns={columns} data={logs} loading={loading} />
    </div>
  );
}
