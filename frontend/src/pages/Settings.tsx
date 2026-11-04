import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Key,
  Folder,
  Download,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  Server,
  Save,
  AlertTriangle,
  Info,
  Calendar,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Link,
  Unlink,
  Mail,
  Bell,
  Send,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { settingsApi, calendarApi, notificationsApi } from '@/lib/api';
import { AppSettings, GoogleCalendarStatus, NotificationSettings } from '@/types';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Badge } from '@/components/ui/badge';

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<AppSettings>({
    groq_api_key: '',
    groq_model: 'llama-3.3-70b-versatile',
    data_dir: './data',
    resume_dir: './data/resumes',
  });

  const [showKey, setShowKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [clearDialogOpen, setClearDialogOpen] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);

  // Google Calendar Integration states
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [gcalClientId, setGcalClientId] = useState<string>('');
  const [gcalClientSecret, setGcalClientSecret] = useState<string>('');
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState<boolean>(false);
  const [isSavingGcalConfig, setIsSavingGcalConfig] = useState<boolean>(false);
  const [copiedFeed, setCopiedFeed] = useState<boolean>(false);
  const [showGcalConfig, setShowGcalConfig] = useState<boolean>(false);

  // Notification states
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_enabled: false,
    inapp_enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_password_configured: false,
    smtp_use_tls: true,
    notification_sender_email: '',
    notification_recipient_email: '',
    notify_on_status_change: true,
    notify_on_followup_due: true,
    notify_on_interview: true,
    reminder_days_before: 1,
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState<boolean>(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [isSendingTestInApp, setIsSendingTestInApp] = useState<boolean>(false);
  const [isScanningDueEvents, setIsScanningDueEvents] = useState<boolean>(false);
  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [leavesEnabled, setLeavesEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autumn-leaves') !== 'false';
  });

  const [trainIntensity, setTrainIntensity] = useState<string>(() => {
    return localStorage.getItem('autumn-bg-intensity') || 'cozy';
  });

  useEffect(() => {
    const handleIntensityUpdate = (e: CustomEvent<{ intensity: string }>) => {
      setTrainIntensity(e.detail.intensity);
    };
    window.addEventListener('autumn-bg-intensity-toggle' as any, handleIntensityUpdate);
    return () => {
      window.removeEventListener('autumn-bg-intensity-toggle' as any, handleIntensityUpdate);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleLeaves = () => {
    const next = !leavesEnabled;
    setLeavesEnabled(next);
    localStorage.setItem('autumn-leaves', String(next));
    window.dispatchEvent(new CustomEvent('autumn-leaves-toggle', { detail: { enabled: next } }));
    toast.success(`Blowing leaves effect ${next ? 'enabled' : 'disabled'}`);
  };

  const handleSetTrainIntensity = (level: string) => {
    setTrainIntensity(level);
    localStorage.setItem('autumn-bg-intensity', level);
    window.dispatchEvent(new CustomEvent('autumn-bg-intensity-toggle', { detail: { intensity: level } }));
    toast.success(`Autumn train landscape set to ${level}`);
  };

  const [fontStyle, setFontStyle] = useState<string>(() => {
    return localStorage.getItem('app-font-style') || 'jakarta';
  });

  const handleSetFontStyle = (style: string) => {
    setFontStyle(style);
    localStorage.setItem('app-font-style', style);
    document.documentElement.setAttribute('data-font-style', style);
    const names: Record<string, string> = {
      jakarta: 'Plus Jakarta Sans',
      outfit: 'Outfit',
      inter: 'Inter',
      editorial: 'Playfair Editorial',
    };
    toast.success(`Font style set to ${names[style] || style}`);
  };

  useEffect(() => {
    loadSettings();
    checkServerHealth();
    loadCalendarStatus();
    loadNotificationSettings();

    // Check for Google OAuth callback params
    const gcalSuccess = searchParams.get('gcal_success');
    const gcalError = searchParams.get('gcal_error');

    if (gcalSuccess === 'true') {
      toast.success('Successfully connected to Google Calendar!');
      setSearchParams({});
      loadCalendarStatus();
    } else if (gcalError) {
      toast.error(`Google Calendar connection failed: ${gcalError}`);
      setSearchParams({});
    }
  }, []);

  const loadCalendarStatus = async () => {
    try {
      const res = await calendarApi.getStatus();
      setCalendarStatus(res.data);
    } catch {
      // Ignored if server offline
    }
  };

  const handleConnectCalendar = async () => {
    try {
      setIsConnectingCalendar(true);
      const res = await calendarApi.getAuthUrl();
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      }
    } catch (err: any) {
      toast.error(
        err.message ||
          'Google Client ID is not configured. Please enter your Client ID & Secret below first.'
      );
      setShowGcalConfig(true);
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleSaveGcalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gcalClientId.trim() || !gcalClientSecret.trim()) {
      toast.error('Please enter both Google Client ID and Secret');
      return;
    }
    try {
      setIsSavingGcalConfig(true);
      await calendarApi.saveConfig({
        google_client_id: gcalClientId.trim(),
        google_client_secret: gcalClientSecret.trim(),
      });
      toast.success('Google Calendar configuration saved');
      await loadCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Google Calendar config');
    } finally {
      setIsSavingGcalConfig(false);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      setIsSyncingCalendar(true);
      const res = await calendarApi.sync();
      toast.success(
        `Calendar synced! Added ${res.data.synced_count} event(s) to your Google Calendar.`
      );
      await loadCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || 'Calendar synchronization failed');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await calendarApi.disconnect();
      toast.success('Google Calendar disconnected');
      await loadCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  const handleCopyFeedUrl = () => {
    const feedUrl = calendarApi.getFeedUrl();
    navigator.clipboard.writeText(feedUrl);
    setCopiedFeed(true);
    toast.success('Live Calendar Feed URL copied to clipboard');
    setTimeout(() => setCopiedFeed(false), 3000);
  };

  const loadNotificationSettings = async () => {
    try {
      const res = await notificationsApi.getSettings();
      if (res.data) {
        setNotificationSettings((prev) => ({ ...prev, ...res.data }));
      }
    } catch {
      // Ignored if offline
    }
  };

  const handleSaveNotificationSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSavingNotifications(true);
      const res = await notificationsApi.saveSettings(notificationSettings);
      setNotificationSettings((prev) => ({ ...prev, ...res.data }));
      toast.success('Notification preferences saved successfully');
      window.dispatchEvent(new CustomEvent('notification-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notification settings');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!notificationSettings.notification_recipient_email?.trim()) {
      toast.error('Please enter a recipient email address to send test email');
      return;
    }
    try {
      setIsSendingTestEmail(true);
      const res = await notificationsApi.testEmail({
        recipient_email: notificationSettings.notification_recipient_email,
        smtp_host: notificationSettings.smtp_host,
        smtp_port: notificationSettings.smtp_port,
        smtp_username: notificationSettings.smtp_username,
        smtp_password: notificationSettings.smtp_password,
        smtp_use_tls: notificationSettings.smtp_use_tls,
        notification_sender_email: notificationSettings.notification_sender_email,
      });
      toast.success(res.data.message || 'Test email sent successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSendTestInApp = async () => {
    try {
      setIsSendingTestInApp(true);
      await notificationsApi.testInApp();
      toast.success('Sample in-app notification generated! Check the bell icon in the top bar.');
      window.dispatchEvent(new CustomEvent('notification-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate in-app notification');
    } finally {
      setIsSendingTestInApp(false);
    }
  };

  const handleTriggerScan = async () => {
    try {
      setIsScanningDueEvents(true);
      const res = await notificationsApi.scan(notificationSettings.email_enabled);
      toast.success(res.data.message || 'Scan completed');
      window.dispatchEvent(new CustomEvent('notification-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to scan reminders');
    } finally {
      setIsScanningDueEvents(false);
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser desktop notifications are not supported on this browser');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        toast.success('Desktop notification permission granted!');
        new Notification('Autumn Suite', {
          body: 'Browser desktop notifications are now enabled!',
          icon: '/favicon.ico',
        });
      } else {
        toast.error('Desktop notification permission was denied');
      }
    } catch (err: any) {
      toast.error('Could not request notification permission');
    }
  };

  const handleSmtpPreset = (preset: 'gmail' | 'outlook' | 'yahoo' | 'custom') => {
    switch (preset) {
      case 'gmail':
        setNotificationSettings((prev) => ({
          ...prev,
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          smtp_use_tls: true,
        }));
        break;
      case 'outlook':
        setNotificationSettings((prev) => ({
          ...prev,
          smtp_host: 'smtp.office365.com',
          smtp_port: 587,
          smtp_use_tls: true,
        }));
        break;
      case 'yahoo':
        setNotificationSettings((prev) => ({
          ...prev,
          smtp_host: 'smtp.mail.yahoo.com',
          smtp_port: 587,
          smtp_use_tls: true,
        }));
        break;
      default:
        break;
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get();
      if (res.data) {
        setSettings((prev) => ({ ...prev, ...res.data }));
      }
    } catch {
      // Defaults keep working
    } finally {
      setLoading(false);
    }
  };

  const checkServerHealth = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
        method: 'GET',
      });
      setServerHealthy(res.ok);
    } catch {
      setServerHealthy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await settingsApi.update(settings);
      toast.success('Settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const response = await settingsApi.exportData();
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-applications-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Applications exported to Excel');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      setIsClearing(true);
      await settingsApi.clearData();
      toast.success('All applications and history have been cleared');
      setClearDialogOpen(false);
      window.dispatchEvent(new CustomEvent('application-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-xl font-bold tracking-tight">System & Model Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure your AI model providers, storage directories, autumn atmosphere, and notification preferences
        </p>
      </div>

      {/* Autumn Theme & Atmosphere Card */}
      <Card className="shadow-sm border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-orange-500/5 autumn-tree-shading">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <span className="text-base">🍁</span>
              </div>
              <div>
                <CardTitle className="text-base">Autumn Theme & Foliage Atmosphere</CardTitle>
                <CardDescription>
                  Embrace the seasonal warmth of amber leaves, autumn tree shading, and cozy forest twilight
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-amber-600 hover:bg-amber-600 text-white gap-1 text-[11px]">
              🍂 Autumn Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visual Scheme Selector */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2">
              <Label className="text-xs font-semibold text-foreground block">Autumn Palette Mode</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isDark ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setIsDark(false)}
                  className="flex-1 h-8 text-xs gap-1.5"
                >
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  Autumn Glow (Day)
                </Button>
                <Button
                  type="button"
                  variant={isDark ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsDark(true)}
                  className="flex-1 h-8 text-xs gap-1.5"
                >
                  <Moon className="h-3.5 w-3.5" />
                  Autumn Twilight (Night)
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Warm ivory parchment by day, deep cedar and glowing embers by night.
              </p>
            </div>

            {/* Falling Leaves Animation Toggle */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Blowing Autumn Leaves</Label>
                <Badge variant={leavesEnabled ? 'default' : 'outline'} className="text-[10px]">
                  {leavesEnabled ? 'Blowing' : 'Paused'}
                </Badge>
              </div>
              <Button
                type="button"
                variant={leavesEnabled ? 'secondary' : 'outline'}
                size="sm"
                onClick={toggleLeaves}
                className="w-full h-8 text-xs gap-1.5"
              >
                <span>🍁</span>
                {leavesEnabled ? 'Disable Blowing Leaves' : 'Enable Blowing Autumn Leaves'}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Maple, oak, and birch leaves swirling through the autumn breeze.
              </p>
            </div>

            {/* Animated Train Background Intensity */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>🚂</span> Animated Scenic Train & Forest Landscape
                </Label>
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 capitalize">
                  Current: {trainIntensity}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vintage steam train traveling through autumn trees, crossing a stone viaduct with smoke puffs and blowing leaves.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { id: 'subtle', label: 'Subtle (16%)' },
                  { id: 'cozy', label: 'Cozy (38%)' },
                  { id: 'vivid', label: 'Vivid (65%)' },
                  { id: 'cinematic', label: 'Cinematic (95%)' },
                  { id: 'off', label: 'Off' },
                ].map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={trainIntensity === item.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSetTrainIntensity(item.id)}
                    className="h-8 text-xs"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Typography & Font Style Selection */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>🔤</span> Typography & Font Style
                </Label>
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 capitalize">
                  Current: {fontStyle === 'jakarta' ? 'Plus Jakarta Sans' : fontStyle === 'outfit' ? 'Outfit' : fontStyle === 'inter' ? 'Inter' : 'Playfair Editorial'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Choose your preferred modern typeface family for headings, UI text, and data views across the app.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { id: 'jakarta', label: 'Plus Jakarta Sans' },
                  { id: 'outfit', label: 'Outfit' },
                  { id: 'inter', label: 'Inter' },
                  { id: 'editorial', label: 'Playfair Editorial' },
                ].map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={fontStyle === item.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSetFontStyle(item.id)}
                    className="h-8 text-xs font-medium"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Groq AI Configuration */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Groq AI Configuration</CardTitle>
            </div>
            <CardDescription>
              Powers the Job Extractor, ATS Resume Matching, and AI Assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="groq_key">Groq API Key</Label>
              <div className="relative">
                <Input
                  id="groq_key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="gsk_..."
                  value={settings.groq_api_key || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, groq_api_key: e.target.value })
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get a free high-speed API key at{' '}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  console.groq.com
                </a>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Default LLM Model</Label>
              <Select
                value={settings.groq_model || 'llama-3.3-70b-versatile'}
                onValueChange={(val) =>
                  setSettings({ ...settings, groq_model: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama-3.3-70b-versatile">
                    Llama 3.3 70B Versatile (Recommended, Fast & Accurate)
                  </SelectItem>
                  <SelectItem value="llama-3.1-8b-instant">
                    Llama 3.1 8B Instant (Ultra Fast)
                  </SelectItem>
                  <SelectItem value="mixtral-8x7b-32768">
                    Mixtral 8x7B 32k (Large Context)
                  </SelectItem>
                  <SelectItem value="gemma2-9b-it">
                    Gemma 2 9B IT
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-end">
            <Button type="submit" disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save AI Settings'}
            </Button>
          </CardFooter>
        </Card>

        {/* Storage Paths */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">File & Data Storage</CardTitle>
            </div>
            <CardDescription>
              Backend file directories for applications and resume documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data_dir">Database Directory</Label>
                <Input
                  id="data_dir"
                  value={settings.data_dir || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, data_dir: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resume_dir">Resumes Upload Folder</Label>
                <Input
                  id="resume_dir"
                  value={settings.resume_dir || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, resume_dir: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Export & Data Management */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Data Export & Backup</CardTitle>
          </div>
          <CardDescription>
            Download your applications data to an Excel spreadsheet
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Export Applications to Excel</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Includes all company names, positions, stages, dates, and recruiter contact info.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportData}
            disabled={isExporting}
            className="gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
          </Button>
        </CardContent>
      </Card>

      {/* Google Calendar Synchronization */}
      <Card className="shadow-sm border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-50/10 dark:to-blue-950/10">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Google Calendar Synchronization</CardTitle>
                <CardDescription>
                  Keep interview schedules, follow-up deadlines, and dates synced with your Google Calendar
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {calendarStatus?.connected ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px]">
                  <CheckCircle className="h-3 w-3" />
                  Connected {calendarStatus.calendar_email ? `(${calendarStatus.calendar_email})` : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Method 1: Automated Push Sync via Google OAuth */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  Direct Google Account OAuth Sync
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authorize Autumn Suite to create and update calendar events automatically.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {calendarStatus?.connected ? (
                  <>
                    <Button
                      onClick={handleSyncCalendar}
                      disabled={isSyncingCalendar}
                      className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingCalendar ? 'animate-spin' : ''}`} />
                      {isSyncingCalendar ? 'Syncing...' : 'Sync Events Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectCalendar}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectCalendar}
                    disabled={isConnectingCalendar}
                    className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Link className="h-3.5 w-3.5" />
                    {isConnectingCalendar ? 'Connecting...' : 'Connect Google Account'}
                  </Button>
                )}
              </div>
            </div>

            {/* OAuth Credentials Accordion / Fields */}
            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowGcalConfig(!showGcalConfig)}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                {showGcalConfig ? 'Hide' : 'Configure Custom'} Google OAuth Credentials (Client ID & Secret)
              </button>

              {showGcalConfig && (
                <form onSubmit={handleSaveGcalConfig} className="mt-3 space-y-3 p-3.5 rounded-lg border bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="gcal_client_id" className="text-xs">
                        Google Client ID
                      </Label>
                      <Input
                        id="gcal_client_id"
                        placeholder="...apps.googleusercontent.com"
                        value={gcalClientId}
                        onChange={(e) => setGcalClientId(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gcal_client_secret" className="text-xs">
                        Google Client Secret
                      </Label>
                      <Input
                        id="gcal_client_secret"
                        type="password"
                        placeholder="GOCSPX-..."
                        value={gcalClientSecret}
                        onChange={(e) => setGcalClientSecret(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Redirect URI: <code className="text-foreground">{calendarStatus?.redirect_uri || (typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/callback` : 'http://127.0.0.1:8000/api/calendar/callback')}</code>
                    </p>
                    <Button type="submit" size="sm" disabled={isSavingGcalConfig} className="h-7 text-xs">
                      {isSavingGcalConfig ? 'Saving...' : 'Save Credentials'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Method 2: Live Calendar Subscription Feed (.ics) */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
            <div>
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Live iCal Feed Subscription (Zero-Configuration)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Subscribe to your Autumn Suite feed URL in Google Calendar to keep events automatically in sync without needing API keys.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={calendarApi.getFeedUrl()}
                className="h-8 text-xs font-mono bg-muted/40 select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyFeedUrl}
                className="h-8 gap-1.5 shrink-0 text-xs"
              >
                {copiedFeed ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Feed Link
                  </>
                )}
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1.5 text-muted-foreground">
              <p className="font-semibold text-foreground">How to add to Google Calendar:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>
                  Open{' '}
                  <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    Google Calendar <ExternalLink className="h-2.5 w-2.5 inline" />
                  </a>
                </li>
                <li>In the left sidebar, click the <strong>+</strong> next to <strong>Other calendars</strong> $\to$ <strong>From URL</strong></li>
                <li>Paste the copied feed link above and click <strong>Add calendar</strong></li>
              </ol>
            </div>
          </div>

          {/* Method 3: One-click Calendar Export (.ics download) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/10">
            <div>
              <p className="text-xs font-semibold text-foreground">One-time .ics Calendar Download</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Download a snapshot of all upcoming follow-ups and interview events to import into any calendar app.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 text-xs shrink-0"
            >
              <a href={calendarApi.getExportUrl()} download="job_tracker_events.ics">
                <Download className="h-3.5 w-3.5" />
                Download .ics Calendar File
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email & In-App Notifications Management */}
      <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Notifications & Reminders</CardTitle>
                <CardDescription>
                  Configure automated email alerts and in-app notifications for due follow-ups and interview schedules
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {notificationSettings.email_enabled ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px]">
                  <Mail className="h-3 w-3" /> Email Alerts On
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                  <Mail className="h-3 w-3 text-muted-foreground" /> Email Alerts Off
                </Badge>
              )}
              {notificationSettings.inapp_enabled && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Bell className="h-3 w-3 text-primary" /> In-App Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs defaultValue="inapp" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="inapp" className="flex items-center gap-2 text-xs">
                <Bell className="h-3.5 w-3.5" />
                In-App Notifications
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2 text-xs">
                <Mail className="h-3.5 w-3.5" />
                Email Alerts & SMTP
              </TabsTrigger>
            </TabsList>

            {/* In-App Notifications Tab */}
            <TabsContent value="inapp" className="space-y-4">
              <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">In-App Notification Center</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Displays live alerts in the navigation bar bell icon for due follow-up tasks and interviews.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={notificationSettings.inapp_enabled ? 'default' : 'outline'}
                      onClick={() => {
                        const updated = { ...notificationSettings, inapp_enabled: !notificationSettings.inapp_enabled };
                        setNotificationSettings(updated);
                        notificationsApi.saveSettings(updated);
                        toast.success(`In-app notifications ${updated.inapp_enabled ? 'enabled' : 'disabled'}`);
                      }}
                      className="text-xs h-8"
                    >
                      {notificationSettings.inapp_enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={notificationSettings.notify_on_followup_due}
                      onCheckedChange={(c) =>
                        setNotificationSettings({ ...notificationSettings, notify_on_followup_due: Boolean(c) })
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground block">Follow-up Deadlines</span>
                      <span className="text-[11px] text-muted-foreground block">Alert when a follow-up task is due or overdue</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={notificationSettings.notify_on_interview}
                      onCheckedChange={(c) =>
                        setNotificationSettings({ ...notificationSettings, notify_on_interview: Boolean(c) })
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground block">Upcoming Interviews</span>
                      <span className="text-[11px] text-muted-foreground block">Reminder for scheduled interview dates</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={notificationSettings.notify_on_status_change}
                      onCheckedChange={(c) =>
                        setNotificationSettings({ ...notificationSettings, notify_on_status_change: Boolean(c) })
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground block">Status Stage Updates</span>
                      <span className="text-[11px] text-muted-foreground block">Alert when an application changes status</span>
                    </div>
                  </label>
                </div>

                {/* Browser Desktop Notification Support */}
                <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Browser Desktop Notifications
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Receive native OS notifications even when the tab is in the background. (Current status: <strong className="text-foreground">{browserPermission}</strong>)
                    </p>
                  </div>
                  {browserPermission === 'granted' ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] shrink-0">
                      <Check className="h-3 w-3" /> Permission Granted
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRequestBrowserPermission}
                      className="h-8 text-xs shrink-0 gap-1.5"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Enable Desktop Alerts
                    </Button>
                  )}
                </div>

                {/* In-App Actions */}
                <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSendTestInApp}
                    disabled={isSendingTestInApp}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {isSendingTestInApp ? 'Generating...' : 'Send Test In-App Notification'}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveNotificationSettings}
                    disabled={isSavingNotifications}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingNotifications ? 'Saving...' : 'Save In-App Preferences'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Email Notifications & SMTP Tab */}
            <TabsContent value="email" className="space-y-4">
              <form onSubmit={handleSaveNotificationSettings} className="space-y-4">
                <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-1.5">
                        <Mail className="h-4 w-4 text-primary" /> Automated Email Delivery
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deliver interview preparation alerts and overdue task reminders directly to your personal inbox.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={notificationSettings.email_enabled ? 'default' : 'outline'}
                        onClick={() =>
                          setNotificationSettings({
                            ...notificationSettings,
                            email_enabled: !notificationSettings.email_enabled,
                          })
                        }
                        className="text-xs h-8"
                      >
                        {notificationSettings.email_enabled ? 'Email Alerts Enabled' : 'Email Alerts Disabled'}
                      </Button>
                    </div>
                  </div>

                  {/* Recipient Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label htmlFor="notification_recipient_email" className="text-xs font-semibold">
                        Alert Recipient Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="notification_recipient_email"
                        type="email"
                        placeholder="yourname@gmail.com"
                        value={notificationSettings.notification_recipient_email || ''}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            notification_recipient_email: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        The destination email where your job reminders and alerts are sent.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="reminder_days_before" className="text-xs font-semibold">
                        Reminder Advance Notice
                      </Label>
                      <Select
                        value={String(notificationSettings.reminder_days_before || 1)}
                        onValueChange={(val) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            reminder_days_before: parseInt(val, 10),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">On Due Day Only</SelectItem>
                          <SelectItem value="1">1 Day in Advance + Due Day</SelectItem>
                          <SelectItem value="2">2 Days in Advance + Due Day</SelectItem>
                          <SelectItem value="3">3 Days in Advance</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        How many days ahead to start sending reminders.
                      </p>
                    </div>
                  </div>

                  {/* Quick SMTP Presets */}
                  <div className="pt-2 border-t space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quick SMTP Provider Presets:</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSmtpPreset('gmail')}
                        className="h-7 text-xs"
                      >
                        Gmail
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSmtpPreset('outlook')}
                        className="h-7 text-xs"
                      >
                        Outlook / Microsoft 365
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSmtpPreset('yahoo')}
                        className="h-7 text-xs"
                      >
                        Yahoo Mail
                      </Button>
                    </div>
                  </div>

                  {/* SMTP Credentials Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label htmlFor="smtp_host" className="text-xs">SMTP Host</Label>
                      <Input
                        id="smtp_host"
                        placeholder="smtp.gmail.com"
                        value={notificationSettings.smtp_host || ''}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, smtp_host: e.target.value })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="smtp_port" className="text-xs">SMTP Port</Label>
                      <Input
                        id="smtp_port"
                        type="number"
                        placeholder="587"
                        value={notificationSettings.smtp_port || 587}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, smtp_port: parseInt(e.target.value, 10) || 587 })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="smtp_username" className="text-xs">SMTP Username / Email</Label>
                      <Input
                        id="smtp_username"
                        placeholder="yourname@gmail.com"
                        value={notificationSettings.smtp_username || ''}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, smtp_username: e.target.value })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="smtp_password" className="text-xs">SMTP App Password</Label>
                        {notificationSettings.smtp_password_configured && (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 h-4">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="smtp_password"
                          type={showSmtpPassword ? 'text' : 'password'}
                          placeholder={notificationSettings.smtp_password_configured ? '•••••••••••••••• (Saved)' : 'Enter 16-char app password'}
                          value={notificationSettings.smtp_password || ''}
                          onChange={(e) =>
                            setNotificationSettings({ ...notificationSettings, smtp_password: e.target.value })
                          }
                          className="h-8 text-xs font-mono pr-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          {showSmtpPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={notificationSettings.smtp_use_tls}
                        onCheckedChange={(c) =>
                          setNotificationSettings({ ...notificationSettings, smtp_use_tls: Boolean(c) })
                        }
                      />
                      <span>Enable STARTTLS / SSL Encryption (Recommended)</span>
                    </label>
                  </div>

                  {/* Gmail Help Box */}
                  <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1.5 text-muted-foreground border">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary" /> Sending with Gmail:
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Google requires an <strong>App Password</strong> rather than your standard account password. To generate one:
                      Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">Google App Passwords <ExternalLink className="h-2.5 w-2.5 inline" /></a> with 2-Step Verification enabled, create an App Password named "Autumn Suite", and paste the 16-character key above.
                    </p>
                  </div>

                  {/* Email Action Buttons */}
                  <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTestEmail}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Send className={`h-3.5 w-3.5 ${isSendingTestEmail ? 'animate-pulse' : ''}`} />
                        {isSendingTestEmail ? 'Sending Test Email...' : 'Send Test Email'}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleTriggerScan}
                        disabled={isScanningDueEvents}
                        className="h-8 text-xs gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isScanningDueEvents ? 'animate-spin' : ''}`} />
                        {isScanningDueEvents ? 'Scanning...' : 'Check & Send Reminders Now'}
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSavingNotifications}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSavingNotifications ? 'Saving...' : 'Save Email Settings'}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Danger Zone: Clear Data */}
      <Card className="border-destructive/40 shadow-sm bg-destructive/[0.02]">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <CardTitle className="text-base">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Permanently remove your applications data and start with a clean slate
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Clear All Job Applications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This will wipe all tracked jobs, stages, notes, and local chat history.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setClearDialogOpen(true)}
            className="gap-2 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* App & Backend System Info */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">System Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b">
            <span className="text-muted-foreground">Frontend Application Version</span>
            <span className="font-semibold">v1.0.0 (Production)</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b">
            <span className="text-muted-foreground">Backend API Endpoint</span>
            <span className="font-mono">{import.meta.env.VITE_API_BASE_URL || '/api'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b">
            <span className="text-muted-foreground">Backend Connection Status</span>
            <div>
              {serverHealthy === true ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1 text-[11px]">
                  <CheckCircle className="h-3 w-3" /> Connected
                </Badge>
              ) : serverHealthy === false ? (
                <Badge variant="destructive" className="gap-1 text-[11px]">
                  <AlertTriangle className="h-3 w-3" /> Offline / Standalone
                </Badge>
              ) : (
                <span className="text-muted-foreground">Checking...</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">Client Stack</span>
            <span className="font-semibold">
              React 18 • Vite 5 • TypeScript • Tailwind CSS • shadcn/ui
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Reset All Applications?"
        description="Are you absolutely sure you want to clear all tracked jobs and history? This action is permanent and cannot be reversed."
        confirmLabel="Yes, Clear Everything"
        variant="destructive"
        isLoading={isClearing}
        onConfirm={handleClearAllData}
      />
    </div>
  );
};

export default Settings;
