import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Briefcase,
  BookmarkCheck,
  Send,
  ClipboardCheck,
  Users,
  Award,
  XCircle,
  HelpCircle,
  Sparkles,
  Link,
  FileText,
  Plus,
  ArrowRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  StatusDistributionChart,
  ApplicationsOverTimeChart,
  WeeklyActivityChart,
  TopCompaniesChart,
} from '@/components/dashboard/Charts';
import { useDashboard } from '@/hooks/useDashboard';
import { Application } from '@/types';
import { applicationsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, getInitials, STATUS_COLORS } from '@/lib/utils';
import { ApplicationDetail } from '@/components/applications/ApplicationDetail';
import { ApplicationForm } from '@/components/applications/ApplicationForm';
import { DatePicker } from '@/components/ui/date-picker';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ onOpenAddModal?: () => void }>();
  
  // Date range filter state
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | '90d' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const activeDateRange = useMemo(() => {
    if (datePreset === 'all') {
      return { startDate: undefined, endDate: undefined };
    }
    if (datePreset === 'custom') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];
    const endDate = formatYMD(today);

    if (datePreset === '7d') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      return { startDate: formatYMD(start), endDate };
    }
    if (datePreset === '30d') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      return { startDate: formatYMD(start), endDate };
    }
    if (datePreset === '90d') {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      return { startDate: formatYMD(start), endDate };
    }
    if (datePreset === 'year') {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatYMD(start), endDate };
    }
    return { startDate: undefined, endDate: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  const { stats, loading: dashboardLoading, refreshDashboard } = useDashboard(activeDateRange);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState<boolean>(true);

  // Detail & Edit Modal states for recent applications
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editOpen, setEditOpen] = useState<boolean>(false);

  const fetchRecentApps = useCallback(async () => {
    try {
      setAppsLoading(true);
      const res = await applicationsApi.getAll({
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      setRecentApplications((res.data || []).slice(0, 5));
    } catch {
      // Graceful fallback
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentApps();

    const handleUpdate = () => {
      refreshDashboard();
      fetchRecentApps();
    };

    window.addEventListener('application-updated', handleUpdate);
    return () => {
      window.removeEventListener('application-updated', handleUpdate);
    };
  }, [fetchRecentApps, refreshDashboard]);

  const handleStatusChange = async (id: string, newStatus: any) => {
    try {
      await applicationsApi.updateStatus(id, newStatus);
      if (selectedApp && selectedApp.application_id === id) {
        setSelectedApp({ ...selectedApp, application_status: newStatus });
      }
      refreshDashboard();
      fetchRecentApps();
    } catch {
      // Handled in api
    }
  };

  const handleEditSubmit = async (data: any) => {
    if (!editApp) return;
    try {
      await applicationsApi.update(editApp.application_id, data);
      refreshDashboard();
      fetchRecentApps();
      setEditOpen(false);
    } catch {
      // Handled in api
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await applicationsApi.delete(id);
      refreshDashboard();
      fetchRecentApps();
      setDetailOpen(false);
    } catch {
      // Handled in api
    }
  };

  const statCardsData = [
    {
      title: 'Total Applications',
      value: stats.total,
      icon: Briefcase,
      description: 'All tracked roles',
      iconColor: 'bg-primary/10 text-primary',
    },
    {
      title: 'Wishlist',
      value: stats.by_status.Wishlist || 0,
      icon: BookmarkCheck,
      description: 'Saved to apply',
      iconColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      title: 'Applied',
      value: stats.by_status.Applied || 0,
      icon: Send,
      description: 'Applications submitted',
      iconColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      title: 'Assessment',
      value: stats.by_status.Assessment || 0,
      icon: ClipboardCheck,
      description: 'Tests & take-homes',
      iconColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      title: 'Interview',
      value: stats.by_status.Interview || 0,
      icon: Users,
      description: `${stats.interview_rate}% interview rate`,
      iconColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      trend: stats.interview_rate > 15 ? ('up' as const) : undefined,
      trendValue: `${stats.interview_rate}%`,
    },
    {
      title: 'Offer',
      value: stats.by_status.Offer || 0,
      icon: Award,
      description: `${stats.offer_rate}% offer rate`,
      iconColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      trend: stats.offer_rate > 0 ? ('up' as const) : undefined,
      trendValue: `${stats.offer_rate}%`,
    },
    {
      title: 'Rejected',
      value: stats.by_status.Rejected || 0,
      icon: XCircle,
      description: `${stats.rejection_rate}% rejection rate`,
      iconColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      title: 'No Response',
      value: stats.by_status.NoResponse || 0,
      icon: HelpCircle,
      description: 'Pending replies',
      iconColor: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => context?.onOpenAddModal?.()}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/50 active:scale-[0.98] group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 group-hover:scale-105">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Add Application</h4>
            <p className="text-xs text-muted-foreground">Track new role manually</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/extractor')}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/50 active:scale-[0.98] group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 group-hover:scale-105">
            <Link className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Extract from URL</h4>
            <p className="text-xs text-muted-foreground">Auto-parse job posting</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/analyzer')}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/50 active:scale-[0.98] group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200 group-hover:scale-105">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Analyze Resume</h4>
            <p className="text-xs text-muted-foreground">Check ATS match score</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/assistant')}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/50 active:scale-[0.98] group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all duration-200 group-hover:scale-105">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">AI Assistant</h4>
            <p className="text-xs text-muted-foreground">Prep questions & emails</p>
          </div>
        </button>
      </div>

      {/* Date Range Filter Bar & Pipeline Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2 pb-1 border-b">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Pipeline & Activity
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {datePreset === 'all'
              ? 'Showing all-time application metrics and charts'
              : activeDateRange.startDate && activeDateRange.endDate
              ? `Filtered: ${activeDateRange.startDate} to ${activeDateRange.endDate}`
              : 'Filtered by custom date range'}
          </p>
        </div>

        {/* Date Filter Presets and Pickers */}
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs overflow-x-auto max-w-full no-scrollbar">
            {[
              { id: 'all', label: 'All Time' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'year', label: 'This Year' },
              { id: 'custom', label: 'Custom' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDatePreset(tab.id as any)}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap',
                  datePreset === tab.id
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs animate-in fade-in duration-200 flex-wrap">
              <DatePicker
                value={customStartDate}
                onChange={(val) => setCustomStartDate(val)}
                placeholder="Start date"
                aria-label="Start date"
                className="h-8 text-xs w-[125px] sm:w-[135px]"
              />
              <span className="text-muted-foreground">to</span>
              <DatePicker
                value={customEndDate}
                onChange={(val) => setCustomEndDate(val)}
                placeholder="End date"
                aria-label="End date"
                className="h-8 text-xs w-[125px] sm:w-[135px]"
              />
              {(customStartDate || customEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 8 Stats Row */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {dashboardLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))
            : statCardsData.map((card, i) => (
                <StatCard
                  key={i}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  description={card.description}
                  iconColor={card.iconColor}
                  trend={card.trend}
                  trendValue={card.trendValue}
                  onClick={() => navigate('/applications')}
                />
              ))}
        </div>
      </div>

      {/* Charts Section 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboardLoading ? (
          <>
            <Skeleton className="h-[360px] rounded-xl" />
            <Skeleton className="h-[360px] rounded-xl" />
          </>
        ) : (
          <>
            <StatusDistributionChart byStatus={stats.by_status} />
            <ApplicationsOverTimeChart
              monthlyData={stats.applications_by_month || []}
            />
          </>
        )}
      </div>

      {/* Charts Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboardLoading ? (
          <>
            <Skeleton className="h-[320px] rounded-xl" />
            <Skeleton className="h-[320px] rounded-xl" />
          </>
        ) : (
          <>
            <WeeklyActivityChart weeklyData={stats.applications_by_week || []} />
            <TopCompaniesChart companies={stats.top_companies || []} />
          </>
        )}
      </div>

      {/* Recent Applications Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Recent Applications
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest additions to your application pipeline
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/applications')}
            className="text-xs gap-1 text-primary hover:text-primary"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                No applications added yet. Start by tracking your first job!
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => context?.onOpenAddModal?.()}
              >
                + Add Application
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentApplications.map((app) => (
                <div
                  key={app.application_id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/40 px-2.5 rounded-lg transition-all duration-200 ease-out hover:translate-x-1 active:scale-[0.99]"
                  onClick={() => {
                    setSelectedApp(app);
                    setDetailOpen(true);
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {app.company_logo ? (
                      <img
                        src={app.company_logo}
                        alt={app.company_name}
                        className="h-9 w-9 rounded-lg object-contain bg-muted p-1 shrink-0"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                        {getInitials(app.company_name)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {app.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {app.job_title} • {app.location || 'Remote'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span
                      className={cn(
                        'hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                        STATUS_COLORS[app.application_status]
                      )}
                    >
                      {app.application_status}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {formatDate(app.date_applied || app.created_at, 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Detail Dialog */}
      <ApplicationDetail
        application={selectedApp}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(app) => {
          setEditApp(app);
          setEditOpen(true);
        }}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />

      {/* Application Edit Dialog */}
      <ApplicationForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initialData={editApp}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
};

export default Dashboard;
