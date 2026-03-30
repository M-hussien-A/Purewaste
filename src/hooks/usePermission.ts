'use client';

import { useAuth } from './useAuth';
import { checkPermission, type Module, type Action } from '@/lib/rbac';
import type { UserRole } from '@prisma/client';

export function usePermission() {
  const { user } = useAuth();

  const can = (module: Module, action: Action): boolean => {
    if (!user?.role) return false;
    return checkPermission(user.role as UserRole, module, action);
  };

  return { can };
}
