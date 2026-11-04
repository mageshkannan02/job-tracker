import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  ChevronDown,
  ChevronRight,
  Briefcase,
  DollarSign,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Application, ApplicationStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatDate, getInitials, STATUS_COLORS } from '@/lib/utils';
import { isPast, parseISO, isToday } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';

interface ApplicationListViewProps {
  applications: Application[];
  onView: (app: Application) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onToggleFavorite?: (app: Application) => void;
  onStatusChange?: (id: string, newStatus: ApplicationStatus) => void;
}

type SortField =
  | 'date_applied'
  | 'company_name'
  | 'job_title'
  | 'match_score'
  | 'application_status'
  | 'follow_up_date';

const ALL_STATUSES: ApplicationStatus[] = [
  'Wishlist',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'NoResponse',
];

export const ApplicationListView: React.FC<ApplicationListViewProps> = ({
  applications,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  onStatusChange,
}) => {
  const [groupByStatus, setGroupByStatus] = useState<boolean>(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('date_applied');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const toggleGroupCollapse = (status: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default to descending (newest / highest first)
    }
  };

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      // Always put favorites first if sorted by default
      if (a.is_favorite !== b.is_favorite) {
        return a.is_favorite ? -1 : 1;
      }

      let aVal: any = a[sortField] ?? '';
      let bVal: any = b[sortField] ?? '';

      if (sortField === 'match_score') {
        aVal = a.match_score ?? -1;
        bVal = b.match_score ?? -1;
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [applications, sortField, sortAsc]);

  // Group applications by status
  const groupedApplications = useMemo(() => {
    const map = new Map<ApplicationStatus, Application[]>();
    for (const status of ALL_STATUSES) {
      map.set(status, []);
    }

    for (const app of sortedApplications) {
      const list = map.get(app.application_status) || [];
      list.push(app);
      map.set(app.application_status, list);
    }

    return map;
  }, [sortedApplications]);

  const INITIAL_BATCH = 15;
  const BATCH_SIZE = 15;

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset or adjust visibleCount when applications length or sort changes
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [applications.length, sortField, sortAsc]);

  const loadMore = useCallback(() => {
    if (visibleCount >= sortedApplications.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, sortedApplications.length));
      setIsLoadingMore(false);
    }, 120);
  }, [visibleCount, sortedApplications.length, isLoadingMore]);

  // IntersectionObserver to detect scroll near bottom of page
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < sortedApplications.length) {
          loadMore();
        }
      },
      {
        root: null, // viewport
        rootMargin: '200px', // start loading before fully reaching the bottom
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, sortedApplications.length, loadMore]);

  // Window scroll fallback
  useEffect(() => {
    const handleScroll = () => {
      if (visibleCount >= sortedApplications.length || isLoadingMore) return;
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 150) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, sortedApplications.length, isLoadingMore, loadMore]);

  const visibleFlatApplications = useMemo(() => {
    return sortedApplications.slice(0, visibleCount);
  }, [sortedApplications, visibleCount]);

  const renderApplicationRow = (app: Application) => {
    // Check follow-up date status
    let isFollowUpOverdue = false;
    let isFollowUpToday = false;
    if (app.follow_up_date) {
      try {
        const d = parseISO(app.follow_up_date);
        isFollowUpToday = isToday(d);
        isFollowUpOverdue = isPast(d) && !isFollowUpToday;
      } catch {
        // ignore date parsing error
      }
    }

    return (
      <div
        key={app.application_id}
        onClick={() => onView(app)}
        className={cn(
          'group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 rounded-xl border bg-card text-card-foreground shadow-xs transition-all cursor-pointer',
          'hover:border-primary/40 hover:shadow-sm hover:bg-muted/20',
          app.is_favorite && 'border-amber-400/40 bg-amber-500/[0.02]'
        )}
      >
        {/* Left: Star, Logo, Company & Role, Location Badges */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(app);
            }}
            title={app.is_favorite ? 'High Priority - click to unmark' : 'Mark as High Priority'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-muted/70 transition-colors shrink-0 focus:outline-hidden cursor-pointer"
          >
            <Star
              className={cn(
                'h-4 w-4 transition-transform active:scale-125',
                app.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30 hover:text-amber-400'
              )}
            />
          </button>

          {/* Company Avatar / Logo */}
          {app.company_logo ? (
            <img
              src={app.company_logo}
              alt={app.company_name}
              className="h-9 w-9 rounded-lg object-contain bg-muted p-1 shrink-0 border border-border/50"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs border border-primary/20">
              {getInitials(app.company_name)}
            </div>
          )}

          {/* Title, Company & Tags */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate hover:text-primary transition-colors">
                {app.company_name}
              </span>
              <span className="text-muted-foreground hidden sm:inline">•</span>
              <span className="text-xs sm:text-sm font-medium text-foreground/85 truncate">
                {app.job_title}
              </span>
              {app.is_favorite && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                  High Priority
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              {app.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[120px]">{app.location}</span>
                </span>
              )}

              {app.work_mode && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  {app.work_mode}
                </Badge>
              )}

              {app.employment_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal hidden sm:inline-flex">
                  {app.employment_type}
                </Badge>
              )}

              {app.salary_range && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-foreground/80 font-medium">
                  <DollarSign className="h-3 w-3 text-emerald-500 shrink-0 -mr-0.5" />
                  <span>{app.salary_range}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center / Right Metadata: Status, Dates, Match Score */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
          {/* Status Badge with Quick Switch Dropdown */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                    'hover:ring-2 hover:ring-primary/20',
                    STATUS_COLORS[app.application_status]
                  )}
                  title="Click to change status"
                >
                  <span>{app.application_status}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move to Stage
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onStatusChange?.(app.application_id, status)}
                    className={cn(
                      'text-xs font-medium cursor-pointer',
                      app.application_status === status && 'font-bold bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full mr-2 shrink-0',
                        status === 'Wishlist' && 'bg-slate-400',
                        status === 'Applied' && 'bg-blue-500',
                        status === 'Assessment' && 'bg-purple-500',
                        status === 'Interview' && 'bg-amber-500',
                        status === 'Offer' && 'bg-emerald-500',
                        status === 'Rejected' && 'bg-rose-500',
                        status === 'NoResponse' && 'bg-gray-400'
                      )}
                    />
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Date Applied & Follow-up */}
          <div className="flex flex-col items-end text-xs min-w-[100px]">
            {app.date_applied ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatDate(app.date_applied)}</span>
              </span>
            ) : app.date_discovered ? (
              <span className="text-[11px] text-muted-foreground">
                Disc: {formatDate(app.date_discovered)}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">No date</span>
            )}

            {app.follow_up_date && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium mt-0.5',
                  isFollowUpOverdue && 'text-rose-600 dark:text-rose-400 font-semibold',
                  isFollowUpToday && 'text-amber-600 dark:text-amber-400 font-semibold',
                  !isFollowUpOverdue && !isFollowUpToday && 'text-muted-foreground'
                )}
                title={`Follow-up date: ${formatDate(app.follow_up_date)}`}
              >
                <Clock className="h-2.5 w-2.5 shrink-0" />
                <span>
                  {isFollowUpOverdue ? 'Overdue: ' : isFollowUpToday ? 'Today: ' : 'Follow-up: '}
                  {formatDate(app.follow_up_date, 'MMM d')}
                </span>
              </span>
            )}
          </div>

          {/* Match Score */}
          {app.match_score !== undefined && app.match_score > 0 && (
            <div
              className={cn(
                'hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0',
                app.match_score >= 80
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : app.match_score >= 60
                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                  : 'bg-muted text-muted-foreground'
              )}
              title={`Match Score: ${app.match_score}%`}
            >
              <Sparkles className="h-3 w-3" />
              <span>{app.match_score}%</span>
            </div>
          )}

          {/* Actions */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {app.job_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                onClick={() => window.open(app.job_url, '_blank')}
                title="Open Job URL"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onView(app)}>
                  <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleFavorite?.(app)}>
                  <Star
                    className={cn(
                      'mr-2 h-4 w-4',
                      app.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-amber-500'
                    )}
                  />
                  {app.is_favorite ? 'Unmark Favorite' : 'Mark as Favorite'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(app)}>
                  <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                  Edit Application
                </DropdownMenuItem>
                {app.job_url && (
                  <DropdownMenuItem onClick={() => window.open(app.job_url, '_blank')}>
                    <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                    Open Job Link
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(app.application_id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* List View Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
        {/* Count & Info */}
        <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <span>
            {!groupByStatus && visibleFlatApplications.length < applications.length
              ? `Showing ${visibleFlatApplications.length} of ${applications.length}`
              : applications.length}{' '}
            {applications.length === 1 ? 'application' : 'applications'}
          </span>
          <span className="text-border">•</span>
          <button
            type="button"
            onClick={() => setGroupByStatus(!groupByStatus)}
            className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{groupByStatus ? 'Grouped by Stage' : 'Flat List'}</span>
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
          <span className="text-muted-foreground mr-1 hidden sm:inline">Sort by:</span>

          <Button
            variant={sortField === 'date_applied' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => handleSort('date_applied')}
          >
            Date
            {sortField === 'date_applied' && (
              sortAsc ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </Button>

          <Button
            variant={sortField === 'company_name' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => handleSort('company_name')}
          >
            Company
            {sortField === 'company_name' && (
              sortAsc ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </Button>

          <Button
            variant={sortField === 'match_score' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => handleSort('match_score')}
          >
            Score
            {sortField === 'match_score' && (
              sortAsc ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </Button>

          <Button
            variant={sortField === 'application_status' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => handleSort('application_status')}
          >
            Stage
            {sortField === 'application_status' && (
              sortAsc ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Main List Rendering */}
      {applications.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
          No applications match your active search or filters.
        </div>
      ) : groupByStatus ? (
        // Grouped by Stage / Status
        <div className="space-y-4">
          {ALL_STATUSES.map((status) => {
            const stageApps = groupedApplications.get(status) || [];
            if (stageApps.length === 0) return null;

            const isCollapsed = collapsedGroups[status];

            return (
              <div key={status} className="space-y-2">
                {/* Stage Header */}
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(status)}
                  className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left cursor-pointer border border-border/40"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border',
                        STATUS_COLORS[status]
                      )}
                    >
                      {status}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      ({stageApps.length})
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                  </span>
                </button>

                {/* Items in this stage */}
                {!isCollapsed && (
                  <div className="space-y-2 pl-1 sm:pl-2">
                    {stageApps.map((app) => renderApplicationRow(app))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Flat Stream with Scroll Loading
        <div className="space-y-3">
          <div className="space-y-2">
            {visibleFlatApplications.map((app) => renderApplicationRow(app))}
          </div>

          {/* Bottom Sentinel & Infinite Scroll Loader */}
          {visibleCount < sortedApplications.length && (
            <div
              ref={sentinelRef}
              className="py-4 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 bg-muted/20"
            >
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-primary font-medium animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more applications...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={loadMore}
                  className="hover:text-primary transition-colors cursor-pointer text-xs font-medium"
                >
                  Scroll down for more ({sortedApplications.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}

          {visibleCount >= sortedApplications.length && sortedApplications.length > INITIAL_BATCH && (
            <div className="py-3 text-center text-xs text-muted-foreground/60 border-t border-border/40 mt-4">
              All {sortedApplications.length} applications loaded
            </div>
          )}
        </div>
      )}
    </div>
  );
};
