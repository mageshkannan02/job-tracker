from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class ApplicationStatus(str, Enum):
    Wishlist = "Wishlist"
    Applied = "Applied"
    Assessment = "Assessment"
    Interview = "Interview"
    Offer = "Offer"
    Rejected = "Rejected"
    NoResponse = "NoResponse"


class WorkMode(str, Enum):
    Remote = "Remote"
    Hybrid = "Hybrid"
    Onsite = "Onsite"


class EmploymentType(str, Enum):
    FullTime = "FullTime"
    PartTime = "PartTime"
    Contract = "Contract"
    Internship = "Internship"
    Freelance = "Freelance"


def _clean_empty_dict_values(data: Any) -> Any:
    """Helper to convert empty strings or whitespace to None for optional schema fields."""
    if isinstance(data, dict):
        cleaned = dict(data)
        for k, v in list(cleaned.items()):
            if isinstance(v, str) and not v.strip():
                if k in (
                    "date_discovered",
                    "date_applied",
                    "follow_up_date",
                    "work_mode",
                    "employment_type",
                    "match_score",
                    "recruiter_email",
                    "company_website",
                    "company_logo",
                    "job_url",
                    "location",
                    "experience_required",
                    "salary_range",
                    "application_source",
                    "recruiter_name",
                    "resume_version",
                    "notes",
                    "job_description",
                ):
                    cleaned[k] = None
        return cleaned
    return data


class ApplicationBase(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    company_logo: Optional[str] = None
    job_title: str
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[WorkMode] = None
    employment_type: Optional[EmploymentType] = None
    experience_required: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: Optional[List[str]] = Field(default_factory=list)
    application_source: Optional[str] = None
    date_discovered: Optional[date] = None
    date_applied: Optional[date] = None
    application_status: ApplicationStatus = ApplicationStatus.Wishlist
    recruiter_name: Optional[str] = None
    recruiter_email: Optional[str] = None
    follow_up_date: Optional[date] = None
    resume_version: Optional[str] = None
    match_score: Optional[float] = None
    notes: Optional[str] = None
    is_favorite: Optional[bool] = False

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, data: Any) -> Any:
        return _clean_empty_dict_values(data)


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    company_logo: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[WorkMode] = None
    employment_type: Optional[EmploymentType] = None
    experience_required: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: Optional[List[str]] = None
    application_source: Optional[str] = None
    date_discovered: Optional[date] = None
    date_applied: Optional[date] = None
    application_status: Optional[ApplicationStatus] = None
    recruiter_name: Optional[str] = None
    recruiter_email: Optional[str] = None
    follow_up_date: Optional[date] = None
    resume_version: Optional[str] = None
    match_score: Optional[float] = None
    notes: Optional[str] = None
    is_favorite: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, data: Any) -> Any:
        return _clean_empty_dict_values(data)


class ApplicationResponse(ApplicationBase):
    application_id: str
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def ensure_valid_timestamps(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cleaned = dict(data)
            now = datetime.utcnow()
            for key in ("created_at", "updated_at"):
                val = cleaned.get(key)
                if val is None or val is False or val == "":
                    cleaned[key] = now
            return cleaned
        return data


class StatusUpdate(BaseModel):
    status: ApplicationStatus
    notes: Optional[str] = None


class ExtractJobRequest(BaseModel):
    url: str


class ExtractedJob(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    location: Optional[str] = None
    experience_required: Optional[str] = None
    salary_range: Optional[str] = None
    employment_type: Optional[str] = None
    work_mode: Optional[str] = None
    required_skills: Optional[List[str]] = Field(default_factory=list)
    preferred_skills: Optional[List[str]] = Field(default_factory=list)
    education_requirements: Optional[str] = None
    responsibilities: Optional[List[str]] = Field(default_factory=list)
    company_website: Optional[str] = None
    job_url: str


class AnalyzeRequest(BaseModel):
    resume_id: str
    application_id: Optional[str] = None
    job_description: Optional[str] = None


class AnalysisResult(BaseModel):
    match_score: float
    technical_skills_match: float
    experience_match: float
    education_match: float
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    keyword_coverage: float
    suggestions: List[str] = Field(default_factory=list)
    project_relevance: str = ""
    summary: str = ""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)


class ActionRequest(BaseModel):
    action_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class FollowUpCreate(BaseModel):
    application_id: str
    task: str
    followup_date: date
    notes: Optional[str] = None


class FollowUpUpdate(BaseModel):
    task: Optional[str] = None
    followup_date: Optional[date] = None
    completed: Optional[bool] = None
    notes: Optional[str] = None


class FollowUpResponse(BaseModel):
    followup_id: str
    application_id: str
    task: str
    followup_date: date
    completed: bool = False
    notes: Optional[str] = None


class StatusHistoryResponse(BaseModel):
    history_id: str
    application_id: str
    previous_status: Optional[str] = None
    new_status: str
    changed_at: datetime
    notes: Optional[str] = None


class ResumeMetadata(BaseModel):
    resume_id: str
    filename: str
    file_path: str
    file_size: int
    uploaded_at: datetime


class DashboardStats(BaseModel):
    total: int
    by_status: Dict[str, int]
    applications_by_month: List[Dict[str, Any]]
    applications_by_week: List[Dict[str, Any]]
    top_companies: List[Dict[str, Any]]
    top_locations: List[Dict[str, Any]]
    interview_rate: float
    offer_rate: float
    rejection_rate: float
    response_rate: float
    avg_time_to_response: float


class NotificationType(str, Enum):
    followup_due = "followup_due"
    interview_upcoming = "interview_upcoming"
    status_change = "status_change"
    system = "system"


class NotificationCreate(BaseModel):
    type: str = "system"
    title: str
    message: str
    related_id: Optional[str] = None


class NotificationResponse(BaseModel):
    notification_id: str
    type: str
    title: str
    message: str
    related_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime


class NotificationsListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total_count: int


class NotificationSettingsResponse(BaseModel):
    email_enabled: bool
    inapp_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password_configured: bool
    smtp_use_tls: bool
    notification_sender_email: str
    notification_recipient_email: str
    notify_on_status_change: bool
    notify_on_followup_due: bool
    notify_on_interview: bool
    reminder_days_before: int


class NotificationSettingsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    inapp_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    notification_sender_email: Optional[str] = None
    notification_recipient_email: Optional[str] = None
    notify_on_status_change: Optional[bool] = None
    notify_on_followup_due: Optional[bool] = None
    notify_on_interview: Optional[bool] = None
    reminder_days_before: Optional[int] = None


class TestEmailRequest(BaseModel):
    recipient_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    notification_sender_email: Optional[str] = None


# ==========================================
# AI Job Watcher Schemas
# ==========================================

class MonitoredCompanyBase(BaseModel):
    company_name: str
    website: Optional[str] = None
    careers_url: Optional[str] = None
    search_keywords: Optional[List[str]] = Field(default_factory=list)
    monitoring_enabled: bool = True


class MonitoredCompanyCreate(MonitoredCompanyBase):
    pass


class MonitoredCompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    website: Optional[str] = None
    careers_url: Optional[str] = None
    search_keywords: Optional[List[str]] = None
    monitoring_enabled: Optional[bool] = None


class MonitoredCompanyResponse(MonitoredCompanyBase):
    company_id: str
    last_checked: Optional[str] = None


class DiscoveredJobBase(BaseModel):
    company_name: str
    job_title: str
    job_url: str
    description: Optional[str] = None
    location: Optional[str] = None
    experience: Optional[str] = None
    employment_type: Optional[str] = "FullTime"
    work_mode: Optional[str] = "Hybrid"
    salary: Optional[str] = None
    required_skills: Optional[List[str]] = Field(default_factory=list)
    preferred_skills: Optional[List[str]] = Field(default_factory=list)
    posted_date: Optional[str] = None
    discovered_date: Optional[str] = None
    source: Optional[str] = "Company Career Page"
    match_score: Optional[float] = None
    matched_skills: Optional[List[str]] = Field(default_factory=list)
    missing_skills: Optional[List[str]] = Field(default_factory=list)
    is_new: bool = True
    is_applied: bool = False
    last_verified: Optional[str] = None


class DiscoveredJobResponse(DiscoveredJobBase):
    discovered_job_id: str


class DiscoveredJobUpdate(BaseModel):
    is_new: Optional[bool] = None
    is_applied: Optional[bool] = None
    match_score: Optional[float] = None
    notes: Optional[str] = None


class JobWatcherSettings(BaseModel):
    enabled: bool = True
    daily_time: str = "09:00"
    frequency: str = "daily"
    interval_hours: int = 24
    timezone: str = "Asia/Kolkata"
    min_match_score: int = 60
    target_titles: List[str] = Field(default_factory=lambda: ["Software Engineer", "Frontend", "Backend", "Full Stack", "DevOps", "SRE"])
    preferred_locations: List[str] = Field(default_factory=lambda: ["Bengaluru", "Hyderabad", "Remote", "Chennai", "Pune"])
    min_experience: str = "0-4 years"
    selected_resume_id: Optional[str] = None
    email_digest_enabled: bool = True


class JobWatcherSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    daily_time: Optional[str] = None
    frequency: Optional[str] = None
    interval_hours: Optional[int] = None
    timezone: Optional[str] = None
    min_match_score: Optional[int] = None
    target_titles: Optional[List[str]] = None
    preferred_locations: Optional[List[str]] = None
    min_experience: Optional[str] = None
    selected_resume_id: Optional[str] = None
    email_digest_enabled: Optional[bool] = None


class JobWatcherRunSummary(BaseModel):
    run_id: str
    timestamp: str
    status: str
    companies_checked: int = 0
    new_jobs_found: int = 0
    jobs_matching_resume: int = 0
    highest_matching_score: float = 0.0
    failed_sources: List[Dict[str, str]] = Field(default_factory=list)
    duration_seconds: float = 0.0
    summary: str = ""


class JobWatcherStatusResponse(BaseModel):
    scheduler_running: bool
    is_discovering_now: bool
    next_run_time: Optional[str] = None
    last_run: Optional[JobWatcherRunSummary] = None
    monitored_companies_count: int = 0
    discovered_jobs_count: int = 0
    new_jobs_count: int = 0
    matched_jobs_count: int = 0


class IngestJobAlertRequest(BaseModel):
    alert_text: str
    source: Optional[str] = "LinkedIn Job Alert"
    resume_id: Optional[str] = None

