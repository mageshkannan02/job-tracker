export type ApplicationStatus =
  | 'Wishlist'
  | 'Applied'
  | 'Assessment'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'NoResponse';

export type WorkMode = 'Remote' | 'Hybrid' | 'Onsite';

export type EmploymentType =
  | 'FullTime'
  | 'PartTime'
  | 'Contract'
  | 'Internship'
  | 'Freelance';

export interface Application {
  application_id: string;
  company_name: string;
  company_website?: string;
  company_logo?: string;
  job_title: string;
  job_description?: string;
  job_url?: string;
  location?: string;
  work_mode?: WorkMode;
  employment_type?: EmploymentType;
  experience_required?: string;
  salary_range?: string;
  required_skills?: string[];
  application_source?: string;
  date_discovered?: string;
  date_applied?: string;
  application_status: ApplicationStatus;
  recruiter_name?: string;
  recruiter_email?: string;
  follow_up_date?: string;
  resume_version?: string;
  match_score?: number;
  notes?: string;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export type ApplicationCreateInput = Omit<
  Application,
  'application_id' | 'created_at' | 'updated_at'
> & {
  application_id?: string;
};

export type ApplicationUpdateInput = Partial<ApplicationCreateInput>;

export interface DashboardStats {
  total: number;
  by_status: Record<ApplicationStatus, number>;
  interview_rate: number;
  offer_rate: number;
  rejection_rate: number;
  response_rate: number;
  applications_by_month: Array<{ month: string; count: number }>;
  applications_by_week: Array<{ week: string; count: number }>;
  top_companies: Array<{ company: string; count: number }>;
  top_locations: Array<{ location: string; count: number }>;
}

export interface ExtractedJob {
  job_title: string;
  company_name: string;
  company_website?: string;
  location?: string;
  work_mode?: WorkMode;
  employment_type?: EmploymentType;
  experience_required?: string;
  salary_range?: string;
  required_skills?: string[];
  job_description?: string;
  job_url?: string;
}

export interface Resume {
  resume_id: string;
  filename: string;
  uploaded_at: string;
  size: number;
}

export interface AnalysisResult {
  analysis_id?: string;
  application_id?: string;
  resume_id?: string;
  overall_score: number;
  technical_score: number;
  experience_score: number;
  education_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  created_at?: string;
}

export interface FollowUp {
  followup_id: string;
  application_id: string;
  task: string;
  followup_date: string;
  completed: boolean;
  notes?: string;
}

export interface ExcelActionSummary {
  action_type: 'add_application' | 'update_status' | 'update_application' | 'create_followup' | 'delete_application' | 'bulk_add';
  sheet_name: string;
  item_id?: string;
  company_name?: string;
  job_title?: string;
  status?: string;
  salary?: string;
  notes?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  excel_action?: ExcelActionSummary;
  excel_modified?: boolean;
}

export interface AppSettings {
  groq_api_key?: string;
  groq_model?: string;
  data_dir?: string;
  resume_dir?: string;
  dark_mode?: boolean;
}

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  calendar_email?: string;
  redirect_uri?: string;
  pending_followup_events: number;
  pending_interview_events: number;
  total_syncable_events: number;
  connected_at?: string;
  error?: string;
}

export interface GoogleCalendarConfigInput {
  google_client_id: string;
  google_client_secret: string;
  google_redirect_uri?: string;
}

export interface CalendarSyncResult {
  success: boolean;
  synced_count: number;
  failed_count: number;
  synced_events: Array<{
    type: string;
    id: string;
    summary: string;
    gcal_id?: string;
    html_link?: string;
  }>;
  failed_events: Array<{
    type: string;
    id: string;
    summary: string;
    error: string;
  }>;
  synced_at: string;
}

export type NotificationType =
  | 'followup_due'
  | 'interview_upcoming'
  | 'status_change'
  | 'system';

export interface NotificationItem {
  notification_id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
  total_count: number;
}

export interface NotificationSettings {
  email_enabled: boolean;
  inapp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_password_configured: boolean;
  smtp_use_tls: boolean;
  notification_sender_email: string;
  notification_recipient_email: string;
  notify_on_status_change: boolean;
  notify_on_followup_due: boolean;
  notify_on_interview: boolean;
  reminder_days_before: number;
}

export interface TestEmailInput {
  recipient_email?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
  notification_sender_email?: string;
}

export interface MonitoredCompany {
  company_id: string;
  company_name: string;
  website?: string;
  careers_url?: string;
  search_keywords: string[];
  last_checked?: string;
  monitoring_enabled: boolean;
}

export interface MonitoredCompanyCreateInput {
  company_name: string;
  website?: string;
  careers_url?: string;
  search_keywords?: string[];
  monitoring_enabled?: boolean;
}

export interface DiscoveredJob {
  discovered_job_id: string;
  company_name: string;
  job_title: string;
  job_url: string;
  description?: string;
  location?: string;
  experience?: string;
  employment_type?: string;
  work_mode?: string;
  salary?: string;
  required_skills: string[];
  preferred_skills?: string[];
  posted_date?: string;
  discovered_date?: string;
  source?: string;
  match_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  is_new: boolean;
  is_applied: boolean;
  last_verified?: string;
}

export interface JobWatcherSettings {
  enabled: boolean;
  daily_time: string;
  frequency: string;
  interval_hours: number;
  timezone: string;
  min_match_score: number;
  target_titles: string[];
  preferred_locations: string[];
  min_experience: string;
  selected_resume_id?: string;
  email_digest_enabled: boolean;
}

export interface JobWatcherRunSummary {
  run_id: string;
  timestamp: string;
  status: string;
  companies_checked: number;
  new_jobs_found: number;
  jobs_matching_resume: number;
  highest_matching_score: number;
  failed_sources: Array<{ company: string; error: string }>;
  duration_seconds: number;
  summary: string;
}

export interface JobWatcherStatus {
  scheduler_running: boolean;
  is_discovering_now: boolean;
  next_run_time?: string;
  last_run?: JobWatcherRunSummary;
  monitored_companies_count: number;
  discovered_jobs_count: number;
  new_jobs_count: number;
  matched_jobs_count: number;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  avatar?: string;
  provider?: 'manual' | 'google';
}

export interface AuthResponse {
  success: boolean;
  token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

