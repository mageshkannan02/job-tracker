import os
import shutil
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


_is_serverless = bool(
    os.getenv("VERCEL")
    or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    or os.getenv("NOW_REGION")
)
_default_data_dir = Path("/tmp/data") if _is_serverless else Path("./data")
_default_resume_dir = Path("/tmp/resumes") if _is_serverless else Path("./resumes")
_default_backup_dir = Path("/tmp/backups") if _is_serverless else Path("./backups")


class Settings(BaseSettings):
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_port: int = 5173
    frontend_url: str = ""
    data_dir: Path = _default_data_dir
    resume_dir: Path = _default_resume_dir
    backup_dir: Path = _default_backup_dir

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
        """Create necessary directories and seed initial files if needed."""
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self.resume_dir.mkdir(parents=True, exist_ok=True)
            self.backup_dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            # Fallback if working directory is read-only (e.g. Vercel/Lambda serverless execution)
            self.data_dir = Path("/tmp/data")
            self.resume_dir = Path("/tmp/resumes")
            self.backup_dir = Path("/tmp/backups")
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self.resume_dir.mkdir(parents=True, exist_ok=True)
            self.backup_dir.mkdir(parents=True, exist_ok=True)

        self._seed_bundled_data()

    def _seed_bundled_data(self) -> None:
        """Copy template/seed Excel and Auth data if target file does not exist."""
        base_dir = Path(__file__).resolve().parent
        candidate_dirs = [
            base_dir / "data",
            base_dir.parent / "data",
            Path("./data"),
        ]

        target_excel = self.excel_path
        if not target_excel.exists():
            for src_dir in candidate_dirs:
                src_file = src_dir / "job_tracker.xlsx"
                if src_file.exists():
                    try:
                        shutil.copy2(src_file, target_excel)
                        break
                    except Exception:
                        pass

        target_auth = self.data_dir / "user_auth.json"
        if not target_auth.exists():
            for src_dir in candidate_dirs:
                src_file = src_dir / "user_auth.json"
                if src_file.exists():
                    try:
                        shutil.copy2(src_file, target_auth)
                        break
                    except Exception:
                        pass

    @property
    def excel_path(self) -> Path:
        return self.data_dir / "job_tracker.xlsx"


settings = Settings()
settings.init_directories()
