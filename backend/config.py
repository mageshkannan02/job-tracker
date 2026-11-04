import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_port: int = 5173
    frontend_url: str = ""
    data_dir: Path = Path("./data")
    resume_dir: Path = Path("./resumes")
    backup_dir: Path = Path("./backups")

    # Google Calendar OAuth Settings
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8000/api/calendar/callback"

    # Notification & Email Settings
    email_enabled: bool = False
    inapp_enabled: bool = True
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    notification_sender_email: str = ""
    notification_recipient_email: str = ""
    notify_on_status_change: bool = True
    notify_on_followup_due: bool = True
    notify_on_interview: bool = True
    reminder_days_before: int = 1

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def init_directories(self) -> None:
        """Create necessary directories if they don't already exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.resume_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    @property
    def excel_path(self) -> Path:
        return self.data_dir / "job_tracker.xlsx"


settings = Settings()
settings.init_directories()
