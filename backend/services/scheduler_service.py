import asyncio
import json
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import settings
from services import email_service, excel_service
from services.job_discovery_service import JobDiscoveryService

logger = logging.getLogger("scheduler_service")

# Persistence file for run summaries
RUNS_LOG_PATH = settings.data_dir / "watcher_runs.json"


def _load_run_history() -> List[Dict[str, Any]]:
    if RUNS_LOG_PATH.exists():
        try:
            with open(RUNS_LOG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_run_summary(summary: Dict[str, Any]) -> None:
    history = _load_run_history()
    # Insert at beginning, limit to 50
    history.insert(0, summary)
    history = history[:50]
    try:
        RUNS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(RUNS_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, default=str)
    except Exception as e:
        logger.warning(f"Could not persist run summary: {e}")


class JobWatcherScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.discovery_service = JobDiscoveryService()
        self._is_running_discovery = False
        self._lock = threading.Lock()
        self._last_run_summary: Optional[Dict[str, Any]] = None

        # Load last run from persistence if available
        history = _load_run_history()
        if history:
            self._last_run_summary = history[0]

    def get_settings(self) -> Dict[str, Any]:
        """Read watcher settings from Excel Settings sheet with robust defaults."""
        stored = {}
        try:
            stored = excel_service.get_settings(settings.excel_path)
        except Exception:
            pass

        def _val(k: str, default: Any):
            v = stored.get(k)
            return v if v is not None and v != "" else default

        def _bool(k: str, default: bool):
            v = _val(k, default)
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                return v.strip().lower() in ("true", "1", "yes")
            return bool(v)

        def _list(k: str, default: List[str]):
            v = _val(k, default)
            if isinstance(v, list):
                return v
            if isinstance(v, str) and v.strip():
                return [s.strip() for s in v.split(",") if s.strip()]
            return default

        # Try to detect local timezone
        default_tz = "Asia/Kolkata"
        try:
            import tzlocal
            detected = str(tzlocal.get_localzone_name())
            if detected:
                default_tz = detected
        except Exception:
            pass

        return {
            "enabled": _bool("job_watcher_enabled", True),
            "daily_time": str(_val("job_watcher_time", "09:00")).strip(),
            "frequency": str(_val("job_watcher_frequency", "daily")).strip(),
            "interval_hours": int(_val("job_watcher_interval_hours", 24)),
            "timezone": str(_val("job_watcher_timezone", default_tz)).strip(),
            "min_match_score": int(_val("job_watcher_min_score", 60)),
            "target_titles": _list("job_watcher_target_titles", ["Software Engineer", "Frontend", "Backend", "Full Stack", "DevOps", "SRE"]),
            "preferred_locations": _list("job_watcher_preferred_locations", ["Bengaluru", "Hyderabad", "Remote", "Chennai", "Pune"]),
            "min_experience": str(_val("job_watcher_min_experience", "0-4 years")).strip(),
            "selected_resume_id": str(_val("job_watcher_selected_resume_id", "")).strip() or None,
            "email_digest_enabled": _bool("job_watcher_email_digest_enabled", True),
        }

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Update watcher settings in Excel Settings sheet and reschedule job."""
        key_mapping = {
            "enabled": "job_watcher_enabled",
            "daily_time": "job_watcher_time",
            "frequency": "job_watcher_frequency",
            "interval_hours": "job_watcher_interval_hours",
            "timezone": "job_watcher_timezone",
            "min_match_score": "job_watcher_min_score",
            "target_titles": "job_watcher_target_titles",
            "preferred_locations": "job_watcher_preferred_locations",
            "min_experience": "job_watcher_min_experience",
            "selected_resume_id": "job_watcher_selected_resume_id",
            "email_digest_enabled": "job_watcher_email_digest_enabled",
        }

        excel_payload = {}
        for k, v in new_settings.items():
            if k in key_mapping and v is not None:
                stored_key = key_mapping[k]
                if isinstance(v, list):
                    excel_payload[stored_key] = ", ".join(str(x) for x in v)
                else:
                    excel_payload[stored_key] = str(v)

        if excel_payload:
            excel_service.update_settings(settings.excel_path, excel_payload)

        # Refresh scheduler trigger
        self.reschedule()
        return self.get_settings()

    def reschedule(self) -> None:
        """Configure APScheduler triggers based on current settings."""
        cfg = self.get_settings()
        job_id = "daily_job_discovery"

        # Remove existing if present
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

        if not cfg.get("enabled"):
            logger.info("AI Job Watcher scheduler is disabled in settings.")
            return

        tz_str = cfg.get("timezone", "UTC")
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            logger.warning(f"Invalid timezone '{tz_str}', falling back to UTC.")
            tz = ZoneInfo("UTC")

        freq = cfg.get("frequency", "daily")
        if freq == "interval":
            hours = max(1, cfg.get("interval_hours", 24))
            trigger = IntervalTrigger(hours=hours, timezone=tz)
            logger.info(f"Scheduled Job Discovery interval trigger: every {hours} hours (tz={tz})")
        else:
            time_str = cfg.get("daily_time", "09:00")
            try:
                hour, minute = [int(p) for p in time_str.split(":", 1)]
            except Exception:
                hour, minute = 9, 0
            trigger = CronTrigger(hour=hour, minute=minute, timezone=tz)
            logger.info(f"Scheduled Job Discovery daily cron trigger: {hour:02d}:{minute:02d} (tz={tz})")

        self.scheduler.add_job(
            self.run_discovery,
            trigger=trigger,
            id=job_id,
            name="Daily Automated AI Job Discovery",
            max_instances=1,
            replace_existing=True,
        )

    async def run_discovery(self, is_manual: bool = False) -> Dict[str, Any]:
        """Execute discovery run with lock protection against duplicate runs."""
        with self._lock:
            if self._is_running_discovery:
                raise RuntimeError("Job discovery is already currently running. Please wait for completion.")
            self._is_running_discovery = True

        try:
            cfg = self.get_settings()
            logger.info(f"Starting discovery run (manual={is_manual})...")

            summary = await self.discovery_service.execute_discovery_run(
                search_keywords=cfg.get("target_titles"),
                preferred_locations=cfg.get("preferred_locations"),
                min_match_score=cfg.get("min_match_score", 60),
                selected_resume_id=cfg.get("selected_resume_id"),
            )

            # Persist summary
            self._last_run_summary = summary
            _save_run_summary(summary)

            # Send email digest if enabled and qualifying jobs found
            if cfg.get("email_digest_enabled") and summary.get("new_jobs_found", 0) > 0:
                try:
                    notif_cfg = email_service.get_smtp_config()
                    if notif_cfg.get("email_enabled") and notif_cfg.get("notification_recipient_email"):
                        top_jobs = summary.get("newly_saved_jobs", [])
                        email_service.send_job_watcher_digest_email(
                            to_email=notif_cfg["notification_recipient_email"],
                            run_summary=summary,
                            top_jobs=top_jobs,
                        )
                except Exception as mail_err:
                    logger.warning(f"Could not send daily discovery digest email: {mail_err}")

            return summary
        finally:
            with self._lock:
                self._is_running_discovery = False

    def start(self) -> None:
        """Start APScheduler if not already running."""
        if not self.scheduler.running:
            self.reschedule()
            self.scheduler.start()
            logger.info("APScheduler for AI Job Watcher started.")

    def shutdown(self) -> None:
        """Shutdown scheduler cleanly."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("APScheduler for AI Job Watcher stopped.")

    def get_status(self) -> Dict[str, Any]:
        """Return live scheduler status, run state, and counts."""
        job = self.scheduler.get_job("daily_job_discovery")
        next_run = None
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

        excel_path = settings.excel_path
        monitored = excel_service.read_monitored_companies(excel_path)
        discovered = excel_service.read_discovered_jobs(excel_path)
        cfg = self.get_settings()
        min_score = cfg.get("min_match_score", 60)

        new_count = sum(1 for j in discovered if j.get("is_new"))
        matched_count = sum(1 for j in discovered if (j.get("match_score") or 0) >= min_score)

        return {
            "scheduler_running": self.scheduler.running,
            "is_discovering_now": self._is_running_discovery,
            "next_run_time": next_run,
            "last_run": self._last_run_summary,
            "monitored_companies_count": len(monitored),
            "discovered_jobs_count": len(discovered),
            "new_jobs_count": new_count,
            "matched_jobs_count": matched_count,
        }

    def get_history(self) -> List[Dict[str, Any]]:
        return _load_run_history()


# Global singleton scheduler instance
scheduler_instance = JobWatcherScheduler()
