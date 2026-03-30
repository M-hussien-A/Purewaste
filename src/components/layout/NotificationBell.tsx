'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlerts } from '@/hooks/useAlerts';

export function NotificationBell() {
  const { count } = useAlerts();

  return (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );
}
