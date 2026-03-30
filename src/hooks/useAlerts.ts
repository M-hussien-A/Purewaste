'use client';

import { useState, useEffect } from 'react';

interface Alert {
  id: string;
  type: 'LOW_STOCK_RAW' | 'LOW_STOCK_FINISHED' | 'PAYMENT_DUE_SUPPLIER' | 'PAYMENT_OVERDUE_CUSTOMER';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  data?: Record<string, any>;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/v1/alerts');
        if (res.ok) {
          const json = await res.json();
          setAlerts(json.data || []);
        }
      } catch {
        // Silently fail for alerts
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  return { alerts, isLoading, count: alerts.length };
}
