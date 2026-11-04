import React, { useState, useEffect, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addDays,
  subDays,
  setMonth as setDateMonth,
  setYear as setDateYear,
  getYear,
  getMonth,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface CustomCalendarProps {
  value?: string | Date | null;
  onChange?: (dateStr: string) => void;
  minDate?: string | Date;
  maxDate?: string | Date;
  className?: string;
  onClose?: () => void;
  showQuickActions?: boolean;
}

/**
 * Safely parse a date string (YYYY-MM-DD) or Date object without UTC timezone shifts.
 */
function parseDateInput(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  onClose,
  showQuickActions = true,
}) => {
  const selectedDate = useMemo(() => parseDateInput(value), [value]);
  const min = useMemo(() => (minDate ? startOfDay(parseDateInput(minDate) || new Date(0)) : undefined), [minDate]);
  const max = useMemo(() => (maxDate ? startOfDay(parseDateInput(maxDate) || new Date(8640000000000000)) : undefined), [maxDate]);

  // Current viewed month & year in calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  // When value prop changes, re-center view if relevant
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [value]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart.getTime(), calendarEnd.getTime()]);

  const prevMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const nextMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonthIndex = parseInt(e.target.value, 10);
    setCurrentMonth((prev) => setDateMonth(prev, newMonthIndex));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    setCurrentMonth((prev) => setDateYear(prev, newYear));
  };

  const handleSelectDay = (day: Date) => {
    if (isDayDisabled(day)) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    onChange?.(dateStr);
    onClose?.();
  };

  const isDayDisabled = (day: Date) => {
    const sod = startOfDay(day);
    if (min && isBefore(sod, min)) return true;
    if (max && isAfter(sod, max)) return true;
    return false;
  };

  const currentYear = getYear(currentMonth);
  const currentMonthIdx = getMonth(currentMonth);

  // Generate a friendly range of years (current year - 10 to current year + 5)
  const years = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const start = Math.min(nowYear - 8, currentYear - 3);
    const end = Math.max(nowYear + 5, currentYear + 3);
    const list: number[] = [];
    for (let y = start; y <= end; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Quick action helpers
  const handleQuickSelect = (targetDate: Date) => {
    setCurrentMonth(new Date(targetDate));
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    onChange?.(dateStr);
    onClose?.();
  };

  const handleClear = () => {
    onChange?.('');
    onClose?.();
  };

  return (
    <div
      className={cn(
        'w-[290px] select-none rounded-xl border bg-card p-3 shadow-md transition-colors',
        className
      )}
    >
      {/* Month & Year Header Controls */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          {/* Month Selector */}
          <select
            value={currentMonthIdx}
            onChange={handleMonthChange}
            className="text-xs font-semibold bg-transparent text-foreground hover:bg-muted py-1 px-1.5 rounded-md cursor-pointer border-0 focus:outline-hidden focus:ring-1 focus:ring-primary appearance-none transition-colors"
            aria-label="Select month"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx} className="bg-popover text-popover-foreground">
                {name}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="text-xs font-semibold bg-transparent text-foreground hover:bg-muted py-1 px-1.5 rounded-md cursor-pointer border-0 focus:outline-hidden focus:ring-1 focus:ring-primary appearance-none transition-colors"
            aria-label="Select year"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-popover text-popover-foreground">
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Prev / Next Arrows */}
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 mb-1 text-center">
        {WEEK_DAYS.map((day, idx) => {
          const isWeekend = idx === 0 || idx === 6;
          return (
            <div
              key={day}
              className={cn(
                'text-[11px] font-medium py-1',
                isWeekend ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'
              )}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const dayIsToday = isToday(day);
          const disabled = isDayDisabled(day);
          const dayNumber = format(day, 'd');
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectDay(day)}
              aria-label={format(day, 'PPPP')}
              aria-selected={isSelected}
              className={cn(
                'h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs font-normal transition-all relative',
                // Normal month vs outside month
                !isCurrentMonth && 'text-muted-foreground/35 hover:text-muted-foreground',
                isCurrentMonth && !isSelected && (isWeekend ? 'text-foreground/90 font-medium' : 'text-foreground'),
                // Hover state
                !isSelected && !disabled && 'hover:bg-accent hover:text-accent-foreground cursor-pointer',
                // Today state (if not selected)
                dayIsToday && !isSelected && 'font-bold border border-primary/40 text-primary bg-primary/5',
                // Selected state
                isSelected && 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/95',
                // Disabled state
                disabled && 'opacity-25 cursor-not-allowed hover:bg-transparent'
              )}
            >
              <span>{dayNumber}</span>
              {dayIsToday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Action Footer */}
      {showQuickActions && (
        <div className="pt-2.5 mt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleQuickSelect(new Date())}
              className="px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(addDays(new Date(), 1))}
              className="px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(subDays(new Date(), 1))}
              className="px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Yesterday
            </button>
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors flex items-center gap-1"
              title="Clear date"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};
