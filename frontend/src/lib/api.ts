import axios from 'axios';
import {
  Application,
  ApplicationCreateInput,
  ApplicationStatus,
  ApplicationUpdateInput,
  DashboardStats,
  ExtractedJob,
  Resume,
  AnalysisResult,
  FollowUp,
  ChatMessage,
  AppSettings,
  GoogleCalendarStatus,
  GoogleCalendarConfigInput,
  CalendarSyncResult,
  NotificationItem,
  NotificationsResponse,
  NotificationSettings,
  TestEmailInput,
  MonitoredCompany,
  MonitoredCompanyCreateInput,
  DiscoveredJob,
  JobWatcherSettings,
  JobWatcherStatus,
  JobWatcherRunSummary,
  User,
  AuthResponse,
  LoginCredentials,
  ExcelActionSummary,
} from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    let message = 'An unexpected error occurred';
    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item: any) => {
          if (typeof item === 'string') return item;
          const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : '';
          return field ? `${field}: ${item.msg || 'Invalid value'}` : item.msg || 'Validation error';
        })
        .join(', ');
    } else if (data?.message) {
      message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  }
);

export const applicationsApi = {
  getAll: (params?: {
    status?: ApplicationStatus;
    search?: string;
    is_favorite?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get<Application[]>('/api/applications', { params }),

  getById: (id: string) => api.get<Application>(`/api/applications/${id}`),

  create: (data: ApplicationCreateInput) =>
    api.post<Application>('/api/applications', data),

  update: (id: string, data: ApplicationUpdateInput) =>
    api.put<Application>(`/api/applications/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/api/applications/${id}`),

  updateStatus: (id: string, status: ApplicationStatus, notes?: string) =>
    api.patch<Application>(`/api/applications/${id}/status`, { status, notes }),

  toggleFavorite: (id: string, is_favorite?: boolean) =>
    api.patch<Application>(`/api/applications/${id}/favorite`, null, {
      params: is_favorite !== undefined ? { is_favorite } : undefined,
    }),

  toggleCompanyFavorite: (company_name: string, is_favorite: boolean) =>
    api.post<{ company_name: string; is_favorite: boolean; count_updated: number }>(
      '/api/applications/company-favorite',
      { company_name, is_favorite }
    ),
};

export const dashboardApi = {
  getStats: (params?: { start_date?: string; end_date?: string }) =>
    api.get<DashboardStats>('/api/dashboard/stats', { params }),
  getCharts: (params?: { start_date?: string; end_date?: string }) =>
    api.get<any>('/api/dashboard/charts', { params }),
};

export const extractorApi = {
  extract: (url: string) =>
    api.post<ExtractedJob>('/api/extractor/extract', { url }),
  extractRaw: (text: string) =>
    api.post<ExtractedJob>('/api/extractor/extract-text', { text }),
  save: (data: ExtractedJob) =>
    api.post<Application>('/api/extractor/save', data),
};

export const resumesApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Resume>('/api/resumes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAll: () => api.get<Resume[]>('/api/resumes'),
  delete: (id: string) => api.delete<{ success: boolean }>(`/api/resumes/${id}`),
};

export const analyzerApi = {
  analyze: (data: {
    resume_id?: string;
    resume_text?: string;
    application_id?: string;
    job_description?: string;
  }) => api.post<AnalysisResult>('/api/analyzer/analyze', data),
  getHistory: () => api.get<AnalysisResult[]>('/api/analyzer/history'),
};

export const assistantApi = {
  chat: (message: string, history: ChatMessage[]) =>
    api.post<{
      reply: string;
      response?: string;
      excel_action?: ExcelActionSummary;
      excel_modified?: boolean;
      tool_used?: string;
      data?: any;
    }>('/api/assistant/chat', { message, history }),
};

export const followupsApi = {
  getAll: (applicationId?: string) =>
    api.get<FollowUp[]>('/api/followups', {
      params: applicationId ? { application_id: applicationId } : undefined,
    }),
  create: (data: Omit<FollowUp, 'followup_id'>) =>
    api.post<FollowUp>('/api/followups', data),
  update: (id: string, data: Partial<FollowUp>) =>
    api.put<FollowUp>(`/api/followups/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/api/followups/${id}`),
  toggleComplete: (id: string, completed: boolean) =>
    api.patch<FollowUp>(`/api/followups/${id}`, { completed }),
};

export const settingsApi = {
  get: () => api.get<AppSettings>('/api/settings'),
  update: (data: AppSettings) => api.post<AppSettings>('/api/settings', data),
  exportData: () =>
    api.get('/api/export', {
      responseType: 'blob',
    }),
  clearData: () => api.post<{ success: boolean }>('/api/clear-data'),
};

export const calendarApi = {
  getStatus: () => api.get<GoogleCalendarStatus>('/api/calendar/status'),
  saveConfig: (data: GoogleCalendarConfigInput) =>
    api.post<{ success: boolean; message: string }>('/api/calendar/config', data),
  getAuthUrl: (state?: string) =>
    api.get<{ auth_url: string; redirect_uri: string }>('/api/calendar/auth-url', {
      params: { state },
    }),
  sync: () => api.post<CalendarSyncResult>('/api/calendar/sync'),
  disconnect: () =>
    api.post<{ success: boolean; message: string }>('/api/calendar/disconnect'),
  getFeedUrl: () => `${api.defaults.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')}/api/calendar/feed.ics`,
  getExportUrl: () => `${api.defaults.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')}/api/calendar/export.ics`,
  getWebLink: (params: {
    application_id?: string;
    followup_id?: string;
    title?: string;
    date?: string;
    details?: string;
    location?: string;
  }) =>
    api.get<{ url: string; title: string; date: string }>('/api/calendar/link', {
      params,
    }),
};

export const notificationsApi = {
  getAll: (params?: { unread_only?: boolean; limit?: number }) =>
    api.get<NotificationsResponse>('/api/notifications', { params }),
  markRead: (id: string) =>
    api.patch<{ success: boolean; notification_id: string; is_read: boolean }>(`/api/notifications/${id}/read`),
  markAllRead: () =>
    api.post<{ success: boolean; updated_count: number }>('/api/notifications/mark-all-read'),
  delete: (id: string) =>
    api.delete<{ success: boolean; notification_id: string }>(`/api/notifications/${id}`),
  clearAll: () =>
    api.delete<{ success: boolean; cleared_count: number }>('/api/notifications'),
  scan: (forceEmail: boolean = false) =>
    api.post<{ success: boolean; message: string; details: any }>('/api/notifications/scan', null, {
      params: { force_email: forceEmail },
    }),
  getSettings: () =>
    api.get<NotificationSettings>('/api/notifications/settings'),
  saveSettings: (data: Partial<NotificationSettings>) =>
    api.post<NotificationSettings>('/api/notifications/settings', data),
  testEmail: (data: TestEmailInput) =>
    api.post<{ success: boolean; message: string; recipient: string }>('/api/notifications/test-email', data),
  testInApp: () =>
    api.post<NotificationItem>('/api/notifications/test-in-app'),
};

export const watcherApi = {
  getStatus: () => api.get<JobWatcherStatus>('/api/watcher/status'),
  getSettings: () => api.get<JobWatcherSettings>('/api/watcher/settings'),
  updateSettings: (data: Partial<JobWatcherSettings>) =>
    api.post<JobWatcherSettings>('/api/watcher/settings', data),
  getCompanies: () => api.get<MonitoredCompany[]>('/api/watcher/companies'),
  addCompany: (data: MonitoredCompanyCreateInput) =>
    api.post<MonitoredCompany>('/api/watcher/companies', data),
  updateCompany: (id: string, data: Partial<MonitoredCompany>) =>
    api.put<MonitoredCompany>(`/api/watcher/companies/${id}`, data),
  deleteCompany: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/watcher/companies/${id}`),
  syncCompanies: () =>
    api.post<{
      success: boolean;
      message: string;
      added_count: number;
      total_monitored: number;
    }>('/api/watcher/companies/sync'),
  getJobs: (params?: {
    search?: string;
    company?: string;
    min_score?: number;
    is_new?: boolean;
    is_applied?: boolean;
    source?: string;
  }) => api.get<DiscoveredJob[]>('/api/watcher/jobs', { params }),
  getJob: (id: string) => api.get<DiscoveredJob>(`/api/watcher/jobs/${id}`),
  updateJob: (id: string, data: Partial<DiscoveredJob>) =>
    api.patch<DiscoveredJob>(`/api/watcher/jobs/${id}`, data),
  deleteJob: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/watcher/jobs/${id}`),
  applyJob: (id: string, params?: { status_val?: string; notes?: string }) =>
    api.post<{ success: boolean; message: string; application: Application }>(
      `/api/watcher/jobs/${id}/apply`,
      null,
      { params }
    ),
  analyzeJob: (id: string, resumeId?: string) =>
    api.post<{ job: DiscoveredJob; evaluation: any }>(
      `/api/watcher/jobs/${id}/analyze`,
      null,
      { params: { resume_id: resumeId } }
    ),
  runDiscovery: (waitForResult: boolean = true) =>
    api.post<JobWatcherRunSummary | { status: string; message: string }>(
      '/api/watcher/run',
      null,
      { params: { wait_for_result: waitForResult } }
    ),
  getRuns: () => api.get<JobWatcherRunSummary[]>('/api/watcher/runs'),
  ingestAlert: (data: {
    alert_text: string;
    source?: string;
    resume_id?: string;
  }) =>
    api.post<{ success: boolean; message: string; jobs: DiscoveredJob[] }>(
      '/api/watcher/ingest-alert',
      data
    ),
};

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/api/auth/login', credentials),
  getGoogleAuthUrl: (redirectUri?: string) => {
    const uri = redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/login/callback` : undefined);
    return api.get<{ auth_url: string; configured: boolean }>('/api/auth/google/url', {
      params: uri ? { redirect_uri: uri } : undefined,
    });
  },
  googleCallback: (code: string) =>
    api.post<AuthResponse>('/api/auth/google/callback', { code }),
  googleDemoLogin: (data?: { name?: string; email?: string }) =>
    api.post<AuthResponse>('/api/auth/google/demo', data || {}),
  getMe: () => api.get<User>('/api/auth/me'),
  getSeededCredentials: () =>
    api.get<{ email: string; password: string; hint: string }>(
      '/api/auth/seeded-credentials'
    ),
  logout: () => api.post<{ success: boolean; message: string }>('/api/auth/logout'),
};

export default api;
