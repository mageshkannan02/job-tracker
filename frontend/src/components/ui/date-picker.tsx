import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar, CustomCalendarProps } from '@/components/ui/custom-calendar';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string | Date | null;
  onChange?: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  minDate?: string | Date;
  maxDate?: string | Date;
  className?: string;
  align?: 'start' | 'center' | 'end';
  showQuickActions?: boolean;
  'aria-label'?: string;
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

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  clearable = true,
  minDate,
  maxDate,
  className,
  align = 'start',
  showQuickActions = true,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);

  const parsedDate = useMemo(() => parseDateInput(value), [value]);

  const displayDate = useMemo(() => {
    if (!parsedDate) return '';
    try {
      return format(parsedDate, 'MMM d, yyyy');
    } catch {
      return String(value);
    }
  }, [parsedDate, value]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange?.('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          name={name}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50 text-left font-normal',
            !displayDate && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{displayDate || placeholder}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {clearable && displayDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleClear(e as any);
                  }
                }}
                className="rounded-full p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Clear date"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-auto p-0 border-0 bg-transparent shadow-none"
      >
        <CustomCalendar
          value={value}
          onChange={(newVal) => {
            onChange?.(newVal);
          }}
          onClose={() => setOpen(false)}
          minDate={minDate}
          maxDate={maxDate}
          showQuickActions={showQuickActions}
        />
      </PopoverContent>
    </Popover>
  );
};
