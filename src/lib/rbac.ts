import { UserRole } from '@prisma/client';

export type Module =
  | 'setup'
  | 'purchases'
  | 'inventory_raw'
  | 'inventory_finished'
  | 'operations'
  | 'sales'
  | 'accounts_suppliers'
  | 'accounts_customers'
  | 'payments_payable'
  | 'payments_receivable'
  | 'reports'
  | 'dashboard'
  | 'pdf_reports'
  | 'users'
  | 'audit_log'
  | 'labor'
  | 'expenses_daily'
  | 'expenses_monthly'
  | 'settings';

export type Action = 'create' | 'read' | 'update' | 'delete';

type Permissions = Record<Module, Action[]>;

const ALL_MODULES: Module[] = [
  'setup',
  'purchases',
  'inventory_raw',
  'inventory_finished',
  'operations',
  'sales',
  'accounts_suppliers',
  'accounts_customers',
  'payments_payable',
  'payments_receivable',
  'reports',
  'dashboard',
  'pdf_reports',
  'users',
  'labor',
  'expenses_daily',
  'expenses_monthly',
  'audit_log',
  'settings',
];

const ALL_ACTIONS: Action[] = ['create', 'read', 'update', 'delete'];

const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  ADMIN: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = [...ALL_ACTIONS];
    return acc;
  }, {} as Permissions),

  OPERATOR: {
    setup: ['read'],
    purchases: ['create', 'read', 'update'],
    inventory_raw: ['create', 'read', 'update'],
    inventory_finished: ['create', 'read', 'update'],
    operations: ['create', 'read', 'update'],
    sales: ['read'],
    accounts_suppliers: ['read'],
    accounts_customers: ['read'],
    payments_payable: [],
    payments_receivable: [],
    reports: ['read'],
    dashboard: ['read'],
    pdf_reports: ['read'],
    labor: ['create', 'read', 'update'],
    expenses_daily: ['create', 'read', 'update'],
    expenses_monthly: ['read'],
    users: [],
    audit_log: [],
    settings: [],
  },

  ACCOUNTANT: {
    setup: ['read'],
    purchases: ['read'],
    inventory_raw: ['read'],
    inventory_finished: ['read'],
    operations: ['read'],
    sales: ['create', 'read', 'update'],
    accounts_suppliers: ['create', 'read', 'update'],
    accounts_customers: ['create', 'read', 'update'],
    payments_payable: ['create', 'read', 'update'],
    payments_receivable: ['create', 'read', 'update'],
    reports: ['read'],
    dashboard: ['read'],
    pdf_reports: ['read'],
    labor: ['create', 'read', 'update'],
    expenses_daily: ['create', 'read', 'update'],
    expenses_monthly: ['create', 'read', 'update'],
    users: [],
    audit_log: [],
    settings: [],
  },

  VIEWER: {
    setup: ['read'],
    purchases: ['read'],
    inventory_raw: ['read'],
    inventory_finished: ['read'],
    operations: ['read'],
    sales: ['read'],
    accounts_suppliers: ['read'],
    accounts_customers: ['read'],
    payments_payable: [],
    payments_receivable: [],
    reports: ['read'],
    dashboard: ['read'],
    pdf_reports: ['read'],
    labor: ['read'],
    expenses_daily: ['read'],
    expenses_monthly: ['read'],
    users: [],
    audit_log: [],
    settings: [],
  },
};

export function checkPermission(
  role: UserRole,
  module: Module,
  action: Action
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  const moduleActions = permissions[module];
  if (!moduleActions) return false;
  return moduleActions.includes(action);
}

export function getModulesForRole(role: UserRole): Module[] {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];
  return ALL_MODULES.filter((mod) => permissions[mod].includes('read'));
}
