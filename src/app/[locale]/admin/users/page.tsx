'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { UserForm } from '@/components/forms/UserForm';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportToCsv } from '@/lib/export-csv';
import { useToast } from '@/components/ui/use-toast';

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Single delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk delete state
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

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

  // Single delete handler
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: tCommon('success') });
        setDeleteId(null);
        fetchUsers();
      } else {
        const json = await res.json();
        toast({
          title: json.error?.message || tCommon('error'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk delete: called by DataTable with selected rows
  const confirmBulkDelete = (rows: any[]) => {
    setBulkDeleteIds(rows.map((r) => r.id));
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds.length) return;
    setBulkDeleteLoading(true);
    try {
      await Promise.all(
        bulkDeleteIds.map((id) =>
          fetch(`/api/v1/users/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: tCommon('success') });
      setBulkDeleteIds([]);
      fetchUsers();
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // CSV export
  const handleExport = () => {
    exportToCsv('users', users, [
      { key: 'username', header: t('username') },
      { key: 'fullName', header: t('fullName') },
      { key: 'email', header: t('email') },
      { key: 'role', header: t('role') },
      { key: 'isActive', header: tCommon('status') },
      { key: 'lastLoginAt', header: t('lastLogin') },
    ]);
  };

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
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: tCommon('actions'),
            cell: ({ row }: { row: any }) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    router.push(`/admin/users/${row.original.id}/edit`)
                  }
                  title={tCommon('edit')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(row.original.id)}
                  title={tCommon('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          } as ColumnDef<any>,
        ]
      : []),
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

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        enableSelection={isAdmin}
        onBulkDelete={isAdmin ? confirmBulkDelete : undefined}
        onExport={handleExport}
      />

      {/* Create user dialog */}
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

      {/* Single delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('deleteUser')}
        description={t('deleteUserConfirm')}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => !open && setBulkDeleteIds([])}
        title={t('bulkDeleteUsers')}
        description={t('bulkDeleteUsersConfirm', { count: bulkDeleteIds.length })}
        variant="destructive"
        loading={bulkDeleteLoading}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
