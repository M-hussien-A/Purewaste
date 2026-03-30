'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { UserForm } from '@/components/forms/UserForm';
import { Plus } from 'lucide-react';

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'username', header: t('username') },
    { accessorKey: 'fullName', header: t('fullName') },
    { accessorKey: 'email', header: t('email') },
    {
      accessorKey: 'role',
      header: t('role'),
      cell: ({ row }) => t(`roles.${row.original.role}`),
    },
    {
      accessorKey: 'isActive',
      header: tCommon('status'),
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: t('lastLogin'),
      cell: ({ row }) =>
        row.original.lastLoginAt
          ? new Date(row.original.lastLoginAt).toLocaleString()
          : '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newUser')}
          </Button>
        }
      />
      <DataTable columns={columns} data={users} loading={loading} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newUser')}</DialogTitle>
          </DialogHeader>
          <UserForm
            onSuccess={() => {
              setShowForm(false);
              fetchUsers();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
