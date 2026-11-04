import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isWeekend,
  getDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Briefcase,
  Plus,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Application } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, STATUS_COLORS, formatDate } from '@/lib/utils';
import { calendarApi } from '@/lib/api';
import { toast } from 'sonner';

interface CalendarViewProps {
  applications: Application[];
  onView: (app: Application) => void;
  onAddApplication?: (defaultStatus?: any) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  applications,
  onView,
  onAddApplication,
}) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSyncGcal = async () => {
    try {
      setIsSyncing(true);
      const res = await calendarApi.sync();
      toast.success(
        `Google Calendar Synced: ${res.data.synced_count} event(s) updated!`
      );
    } catch (err: any) {
      toast.error(
        'Google Calendar not yet connected. Configure it in Settings.',
        {
          action: {
            label: 'Open Settings',
            onClick: () => navigate('/settings'),
          },
        }
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const weekDays = [
    { short: 'Sun', letter: 'S' },
    { short: 'Mon', letter: 'M' },
    { short: 'Tue', letter: 'T' },
    { short: 'Wed', letter: 'W' },
    { short: 'Thu', letter: 'T' },
    { short: 'Fri', letter: 'F' },
    { short: 'Sat', letter: 'S' },
  ];

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateApps = applications.filter(
    (app) => app.date_applied?.startsWith(selectedDateStr)
  );
  const isSelectedDateWeekend = isWeekend(selectedDate);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card shadow-xs p-3 sm:p-5">
        {/* Month Navigation & Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Weekends (Sat & Sun) marked</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncGcal}
              disabled={isSyncing}
              className="text-xs h-8 gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Google Calendar</span>
              <span className="sm:hidden">Sync</span>
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8 px-2.5">
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Days of Week Header with Weekend Highlight */}
        <div className="grid grid-cols-7 gap-1 pt-2.5 pb-2 text-center text-xs font-semibold border-b">
          {weekDays.map((d, index) => {
            const isWeekendHeader = index === 0 || index === 6; // Sun (0) or Sat (6)
            return (
              <div
                key={d.short}
                className={cn(
                  'py-1 sm:py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors',
                  isWeekendHeader
                    ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20'
                    : 'text-muted-foreground'
                )}
              >
                <span className="hidden sm:inline">{d.short}</span>
                <span className="sm:hidden font-bold">{d.short}</span>
                {isWeekendHeader && (
                  <span className="hidden lg:inline text-[9px] font-medium opacity-85 px-1 py-0.2 rounded bg-amber-200/50 dark:bg-amber-900/40">
                    Weekend
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Month Days Grid - 100% fluid responsive */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayApps = applications.filter(
              (app) => app.date_applied?.startsWith(dateStr)
            );

            const isCurrentMonth = isSameMonth(day, monthStart);
            const isCurrentDay = isToday(day);
            const isWeekendDay = isWeekend(day);
            const isSelected = isSameDay(day, selectedDate);
            const dayOfWeek = getDay(day);
            const weekendType = dayOfWeek === 6 ? 'Sat' : dayOfWeek === 0 ? 'Sun' : null;

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'min-h-[58px] sm:min-h-[82px] md:min-h-[94px] rounded-lg border p-1 sm:p-1.5 flex flex-col transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] cursor-pointer select-none',
                  // Weekend styling vs regular weekday styling
                  isCurrentMonth
                    ? isWeekendDay
                      ? 'bg-amber-500/[0.04] dark:bg-amber-400/[0.06] border-amber-200/70 dark:border-amber-900/40 hover:bg-amber-500/[0.08]'
                      : 'bg-card hover:bg-muted/40'
                    : isWeekendDay
                    ? 'bg-amber-500/[0.02] dark:bg-amber-500/[0.03] opacity-40 border-dashed border-amber-500/20'
                    : 'bg-muted/15 opacity-40',
                  // Selected Day Highlight
                  isSelected && 'ring-2 ring-primary border-primary shadow-sm',
                  // Today Highlight (if not selected)
                  isCurrentDay && !isSelected && 'border-primary/70 ring-1 ring-primary/40 bg-primary/[0.03]'
                )}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'text-xs font-semibold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full transition-colors',
                        isCurrentDay
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : isSelected
                          ? 'bg-primary/20 text-primary font-bold'
                          : isWeekendDay && isCurrentMonth
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                          : 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Weekend Tag (Desktop) */}
                    {isWeekendDay && isCurrentMonth && (
                      <span className="text-[9px] font-semibold text-amber-700/90 dark:text-amber-400/90 bg-amber-500/15 px-1 py-0.5 rounded leading-none hidden md:inline-flex items-center gap-0.5">
                        {weekendType}
                      </span>
                    )}
                  </div>

                  {/* App Count Pill */}
                  {dayApps.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium shrink-0 bg-muted/60 px-1 rounded sm:bg-transparent sm:px-0">
                      <span className="hidden sm:inline">{dayApps.length} {dayApps.length === 1 ? 'app' : 'apps'}</span>
                      <span className="sm:hidden">{dayApps.length}</span>
                    </span>
                  )}
                </div>

                {/* Mobile: Colored dots for applications */}
                {dayApps.length > 0 && (
                  <div className="sm:hidden mt-auto pt-1 flex items-center gap-1 justify-center flex-wrap">
                    {dayApps.slice(0, 3).map((app, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          app.application_status === 'Offer'
                            ? 'bg-emerald-500'
                            : app.application_status === 'Interview'
                            ? 'bg-amber-500'
                            : app.application_status === 'Applied'
                            ? 'bg-blue-500'
                            : app.application_status === 'Assessment'
                            ? 'bg-purple-500'
                            : 'bg-muted-foreground'
                        )}
                      />
                    ))}
                    {dayApps.length > 3 && (
                      <span className="text-[8px] font-bold text-muted-foreground">
                        +{dayApps.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Tablet / Desktop: Application text cards */}
                <div className="hidden sm:block mt-1 space-y-1 overflow-y-auto max-h-[55px] md:max-h-[75px]">
                  {dayApps.map((app) => (
                    <button
                      key={app.application_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(app);
                      }}
                      className={cn(
                        'w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium border transition-transform hover:scale-[1.02] shadow-2xs',
                        STATUS_COLORS[app.application_status]
                      )}
                      title={`${app.company_name} - ${app.job_title} (${app.application_status})`}
                    >
                      <span className="font-semibold">{app.company_name}</span>: {app.job_title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Drawer / Card (Mobile & Tablet friendly) */}
      <div key={selectedDateStr} className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs animate-in fade-in-50 slide-in-from-bottom-2 duration-250 ease-out fill-mode-both">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm sm:text-base text-foreground">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            {isSelectedDateWeekend && (
              <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                Weekend
              </Badge>
            )}
            {isToday(selectedDate) && (
              <Badge variant="default" className="text-[11px]">
                Today
              </Badge>
            )}
          </div>

          <span className="text-xs text-muted-foreground">
            {selectedDateApps.length} {selectedDateApps.length === 1 ? 'application logged' : 'applications logged'}
          </span>
        </div>

        {selectedDateApps.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground space-y-2">
            <p className="text-xs sm:text-sm">No job applications logged on this date.</p>
            {onAddApplication && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddApplication()}
                className="text-xs gap-1.5 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Application for this date
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60 mt-1">
            {selectedDateApps.map((app) => (
              <div
                key={app.application_id}
                onClick={() => onView(app)}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-muted/30 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    {app.company_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate text-foreground">
                      {app.job_title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {app.company_name} {app.location ? `• ${app.location}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span
                    className={cn(
                      'px-2.5 py-0.5 text-[11px] font-semibold rounded-full border',
                      STATUS_COLORS[app.application_status]
                    )}
                  >
                    {app.application_status}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                    <span>Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
