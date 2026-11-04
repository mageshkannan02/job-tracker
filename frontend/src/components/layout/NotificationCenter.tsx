import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Calendar,
  Briefcase,
  TrendingUp,
  Info,
  Trash2,
  RefreshCw,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { NotificationItem } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getAll({ limit: 100 });
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch {
      // Graceful fallback if backend offline
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Refresh on application updates or every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    const handleUpdate = () => fetchNotifications();

    window.addEventListener('application-updated', handleUpdate);
    window.addEventListener('notification-updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('application-updated', handleUpdate);
      window.removeEventListener('notification-updated', handleUpdate);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(id);
      const target = notifications.find((n) => n.notification_id === id);
      setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
      if (target && !target.is_read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      toast.error('Failed to remove notification');
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      toast.success('Notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const handleScanDueEvents = async () => {
    try {
      setIsScanning(true);
      const res = await notificationsApi.scan(false);
      toast.success(res.data.message || 'Scanned for due reminders');
      await fetchNotifications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to scan reminders');
    } finally {
      setIsScanning(false);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await notificationsApi.markRead(notif.notification_id);
        setNotifications((prev) =>
          prev.map((n) => (n.notification_id === notif.notification_id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continue navigation
      }
    }

    setIsOpen(false);
    if (notif.type === 'interview_upcoming' || notif.type === 'status_change' || notif.type === 'followup_due') {
      navigate('/applications');
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const dt = new Date(isoString);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - dt.getTime()) / 1000);

      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      if (diffSecs < 172800) return 'Yesterday';
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'followup_due':
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        );
      case 'interview_upcoming':
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Briefcase className="h-4 w-4" />
          </div>
        );
      case 'status_change':
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <TrendingUp className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[calc(100vw-1rem)] sm:w-96 max-w-sm sm:max-w-md p-0 shadow-xl rounded-xl overflow-hidden border max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-3.5 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Scan for due reminders now"
                onClick={handleScanDueEvents}
                disabled={isScanning}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Mark all as read"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mt-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTab === 'all'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTab === 'unread'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[340px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="rounded-full bg-muted/60 p-3 mb-2">
                <Bell className="h-5 w-5 text-muted-foreground/70" />
              </div>
              <p className="text-xs font-medium text-foreground">No notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {activeTab === 'unread'
                  ? "You've caught up with all reminders!"
                  : 'Due follow-ups and interview alerts will appear here.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  onClick={() => handleItemClick(notif)}
                  className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer hover:bg-muted/40 ${
                    !notif.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  {getNotificationIcon(notif.type)}

                  <div className="flex-1 min-w-0 pr-14 sm:pr-12">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold truncate ${!notif.is_read ? 'text-foreground font-bold' : 'text-foreground/90'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  {/* Actions (visible on mobile touch, hover on desktop) */}
                  <div className="absolute right-2 top-2.5 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary active:bg-muted"
                        title="Mark as read"
                        onClick={(e) => handleMarkAsRead(e, notif.notification_id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive active:bg-muted"
                      title="Dismiss"
                      onClick={(e) => handleDelete(e, notif.notification_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-2.5 border-t bg-muted/20 text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsOpen(false);
              navigate('/settings');
            }}
          >
            <SettingsIcon className="h-3 w-3" />
            Notification Settings
          </Button>

          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
