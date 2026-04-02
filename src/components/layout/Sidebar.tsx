'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useAuth } from '@/hooks/useAuth';
import { checkPermission, type Module } from '@/lib/rbac';
import type { UserRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Flame,
  ShoppingCart,
  TrendingUp,
  Package,
  Boxes,
  Box,
  Users,
  Truck,
  UserCheck,
  CreditCard,
  HardHat,
  Wallet,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Settings,
  Shield,
  FileText,
  ChevronDown,
  ChevronLeft,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  module?: Module;
  children?: NavItem[];
}

export function Sidebar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isOpen, isCollapsed, setOpen } = useSidebarStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['inventory', 'accounts'])
  );
  const isRtl = locale === 'ar';

  const navItems: NavItem[] = [
    { label: t('dashboard'), href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    { label: t('operations'), href: '/operations', icon: Flame, module: 'operations' },
    { label: t('purchases'), href: '/purchases', icon: ShoppingCart, module: 'purchases' },
    { label: t('sales'), href: '/sales', icon: TrendingUp, module: 'sales' },
    {
      label: t('inventory'),
      icon: Package,
      children: [
        { label: t('rawMaterials'), href: '/inventory/raw', icon: Boxes, module: 'inventory_raw' },
        { label: t('finishedProducts'), href: '/inventory/finished', icon: Box, module: 'inventory_finished' },
      ],
    },
    {
      label: t('accounts'),
      icon: Users,
      children: [
        { label: t('suppliers'), href: '/accounts/suppliers', icon: Truck, module: 'accounts_suppliers' },
        { label: t('customers'), href: '/accounts/customers', icon: UserCheck, module: 'accounts_customers' },
      ],
    },
    { label: t('payments'), href: '/payments', icon: CreditCard, module: 'payments_payable' },
    { label: t('labor'), href: '/labor', icon: HardHat, module: 'labor' },
    {
      label: t('expenses'),
      icon: Wallet,
      children: [
        { label: t('dailyExpenses'), href: '/expenses/daily', icon: CalendarDays, module: 'expenses_daily' },
        { label: t('monthlyOverhead'), href: '/expenses/monthly', icon: CalendarRange, module: 'expenses_monthly' },
      ],
    },
    { label: t('reports'), href: '/reports', icon: BarChart3, module: 'reports' },
    { label: t('settings'), href: '/settings', icon: Settings, module: 'settings' },
    { label: t('users'), href: '/admin/users', icon: Shield, module: 'users' },
    { label: t('auditLog'), href: '/admin/audit-log', icon: FileText, module: 'audit_log' },
  ];

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const canAccess = (item: NavItem): boolean => {
    if (!user?.role) return false;
    if (item.module) {
      return checkPermission(user.role as UserRole, item.module, 'read');
    }
    if (item.children) {
      return item.children.some((child) => canAccess(child));
    }
    return true;
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    const localePath = `/${locale}${href}`;
    return pathname === localePath || pathname.startsWith(localePath + '/');
  };

  const filteredItems = navItems.filter(canAccess);

  const renderNavItem = (item: NavItem, depth = 0) => {
    if (item.children) {
      const isExpanded = expandedGroups.has(item.label);
      const visibleChildren = item.children.filter(canAccess);
      if (visibleChildren.length === 0) return null;

      return (
        <div key={item.label}>
          <button
            onClick={() => toggleGroup(item.label)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              depth > 0 && 'ps-8'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-start">{item.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                />
              </>
            )}
          </button>
          {isExpanded && !isCollapsed && (
            <div className="mt-1 space-y-1">
              {visibleChildren.map((child) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href || '/'}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground',
          isActive(item.href)
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground',
          depth > 0 && 'ps-8'
        )}
        onClick={() => {
          if (window.innerWidth < 1024) setOpen(false);
        }}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="text-start">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 z-50 flex h-full flex-col border-e bg-card transition-all duration-300 lg:relative lg:z-auto',
          isRtl ? 'end-0' : 'start-0',
          isOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full',
          'lg:translate-x-0',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <h2 className="text-lg font-bold text-foreground">
              {locale === 'ar' ? 'المسبك' : 'The Foundry'}
            </h2>
          )}
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 hover:bg-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">{filteredItems.map((item) => renderNavItem(item))}</nav>
        </ScrollArea>
      </aside>
    </>
  );
}
