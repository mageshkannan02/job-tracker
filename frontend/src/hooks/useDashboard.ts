import { useState, useEffect, useCallback } from 'react';
import { DashboardStats } from '@/types';
import { dashboardApi } from '@/lib/api';
import { toast } from 'sonner';

const defaultStats: DashboardStats = {
  total: 0,
  by_status: {
    Wishlist: 0,
    Applied: 0,
    Assessment: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
    NoResponse: 0,
  },
  interview_rate: 0,
  offer_rate: 0,
  rejection_rate: 0,
  response_rate: 0,
  applications_by_month: [],
  applications_by_week: [],
  top_companies: [],
  top_locations: [],
};

export interface DashboardDateRange {
  startDate?: string;
  endDate?: string;
}

export function useDashboard(dateRange?: DashboardDateRange) {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = dateRange?.startDate;
  const endDate = dateRange?.endDate;

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = startDate || endDate ? { start_date: startDate, end_date: endDate } : undefined;
      const [statsRes, chartsRes] = await Promise.allSettled([
        dashboardApi.getStats(params),
        dashboardApi.getCharts(params),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        setStats({
          ...defaultStats,
          ...statsRes.value.data,
          by_status: {
            ...defaultStats.by_status,
            ...(statsRes.value.data.by_status || {}),
          },
        });
      }

      if (chartsRes.status === 'fulfilled' && chartsRes.value.data) {
        setCharts(chartsRes.value.data);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch dashboard metrics';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    charts,
    loading,
    error,
    refreshDashboard: fetchDashboardData,
  };
}
