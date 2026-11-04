import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';
import { ApplicationStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  Wishlist: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Applied: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  Assessment: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  Interview: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  Offer: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  NoResponse: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

export const STATUS_KANBAN_COLORS: Record<ApplicationStatus, string> = {
  Wishlist: 'border-t-slate-400 dark:border-t-slate-500',
  Applied: 'border-t-blue-500 dark:border-t-blue-400',
  Assessment: 'border-t-purple-500 dark:border-t-purple-400',
  Interview: 'border-t-amber-500 dark:border-t-amber-400',
  Offer: 'border-t-emerald-500 dark:border-t-emerald-400',
  Rejected: 'border-t-rose-500 dark:border-t-rose-400',
  NoResponse: 'border-t-gray-400 dark:border-t-gray-500',
};

export const STATUS_CHART_COLORS: Record<ApplicationStatus, string> = {
  Wishlist: '#94a3b8',
  Applied: '#3b82f6',
  Assessment: '#a855f7',
  Interview: '#f59e0b',
  Offer: '#10b981',
  Rejected: '#f43f5e',
  NoResponse: '#6b7280',
};

export function formatDate(dateStr?: string, pattern = 'MMM dd, yyyy'): string {
  if (!dateStr) return 'N/A';
  try {
    const parsed = typeof dateStr === 'string' && dateStr.includes('T')
      ? parseISO(dateStr)
      : new Date(dateStr);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, pattern);
  } catch {
    return dateStr;
  }
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function truncate(str: string, length = 30): string {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
