import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from config import settings
from services import email_service, excel_service

logger = logging.getLogger("notification_service")


def get_notification_settings(path_input: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """Retrieve combined notification settings from Excel and system config."""
    path = Path(path_input or settings.excel_path).resolve()
    stored = {}
    try:
        stored = excel_service.get_settings(path)
    except Exception as e:
        logger.warning(f"Could not read settings from Excel: {e}")

    def _get_val(key: str, default: Any) -> Any:
        if key in stored and stored[key] is not None and stored[key] != "":
            return stored[key]
        return getattr(settings, key, default)

    def _get_bool(key: str, default: bool) -> bool:
        v = _get_val(key, default)
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    def _get_int(key: str, default: int) -> int:
        try:
            return int(_get_val(key, default))
        except (ValueError, TypeError):
            return default

    smtp_pass = str(_get_val("smtp_password", "")).strip()

    return {
        "email_enabled": _get_bool("email_enabled", False),
        "inapp_enabled": _get_bool("inapp_enabled", True),
        "smtp_host": str(_get_val("smtp_host", "smtp.gmail.com")).strip(),
        "smtp_port": _get_int("smtp_port", 587),
        "smtp_username": str(_get_val("smtp_username", "")).strip(),
        "smtp_password": smtp_pass,
        "smtp_password_configured": bool(smtp_pass),
        "smtp_use_tls": _get_bool("smtp_use_tls", True),
        "notification_sender_email": str(_get_val("notification_sender_email", "")).strip(),
        "notification_recipient_email": str(_get_val("notification_recipient_email", "")).strip(),
        "notify_on_status_change": _get_bool("notify_on_status_change", True),
        "notify_on_followup_due": _get_bool("notify_on_followup_due", True),
        "notify_on_interview": _get_bool("notify_on_interview", True),
        "reminder_days_before": _get_int("reminder_days_before", 1),
    }


def update_notification_settings(
    settings_data: Dict[str, Any],
    path_input: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Persist notification settings to Excel."""
    path = Path(path_input or settings.excel_path).resolve()
    # Filter out empty or None fields if not provided
    payload = {}
    allowed_keys = [
        "email_enabled",
        "inapp_enabled",
        "smtp_host",
        "smtp_port",
        "smtp_username",
        "smtp_password",
        "smtp_use_tls",
        "notification_sender_email",
        "notification_recipient_email",
        "notify_on_status_change",
        "notify_on_followup_due",
        "notify_on_interview",
        "reminder_days_before",
    ]
    for k in allowed_keys:
        if k in settings_data and settings_data[k] is not None:
            # If smtp_password is empty and already configured, don't overwrite with empty
            if k == "smtp_password" and str(settings_data[k]).strip() == "":
                continue
            payload[k] = settings_data[k]

    if payload:
        excel_service.update_settings(path, payload)

    return get_notification_settings(path)


def create_inapp_notification(
    type: str,
    title: str,
    message: str,
    related_id: Optional[str] = None,
    path_input: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Create an in-app notification record in the workbook."""
    path = Path(path_input or settings.excel_path).resolve()
    notif_data = {
        "type": type,
        "title": title,
        "message": message,
        "related_id": related_id or "",
        "is_read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    return excel_service.add_notification(path, notif_data)


def scan_and_notify_due_events(
    path_input: Optional[Union[str, Path]] = None,
    force_email: bool = False,
) -> Dict[str, Any]:
    """Scan all incomplete follow-ups and upcoming interviews, creating in-app and email reminders."""
    path = Path(path_input or settings.excel_path).resolve()
    cfg = get_notification_settings(path)

    inapp_enabled = cfg.get("inapp_enabled", True)
    email_enabled = cfg.get("email_enabled", False) or force_email
    recipient_email = cfg.get("notification_recipient_email", "").strip()
    reminder_days = cfg.get("reminder_days_before", 1)

    today = date.today()
    target_cutoff_date = today + timedelta(days=reminder_days)

    all_followups = excel_service.read_followups(path)
    all_apps = excel_service.read_applications(path)
    app_map = {str(a.get("application_id")): a for a in all_apps}

    scanned_followups = 0
    scanned_apps = 0
    inapp_created = 0
    emails_sent = 0
    errors: List[str] = []

    # 1. Check FollowUps sheet for incomplete tasks
    if cfg.get("notify_on_followup_due", True):
        for f in all_followups:
            if f.get("completed"):
                continue
            scanned_followups += 1
            f_date_val = f.get("followup_date")
            if not f_date_val:
                continue

            try:
                f_date_str = str(f_date_val)[:10]
                due_d = datetime.strptime(f_date_str, "%Y-%m-%d").date()
            except Exception:
                continue

            # Check if within alert window (due today, overdue, or within reminder_days)
            if due_d <= target_cutoff_date:
                f_id = str(f.get("followup_id"))
                app = app_map.get(str(f.get("application_id")), {})
                company = app.get("company_name", "Company")
                task = f.get("task", "Follow up")

                urgency = "Due Today" if due_d == today else ("Overdue" if due_d < today else f"Due on {f_date_str}")
                title = f"Follow-up {urgency}: {company}"
                msg = f"{task} (Due: {f_date_str})"

                # In-App notification (deduplicated per day)
                if inapp_enabled and not excel_service.has_notification_today(path, f_id, "followup_due"):
                    try:
                        create_inapp_notification(
                            type="followup_due",
                            title=title,
                            message=msg,
                            related_id=str(f.get("application_id") or f_id),
                            path_input=path,
                        )
                        inapp_created += 1
                    except Exception as e:
                        errors.append(f"In-app notif failed for followup {f_id}: {e}")

                # Email notification
                if email_enabled and recipient_email:
                    # Check if already notified by checking in-app record created today or send
                    try:
                        email_service.send_followup_reminder_email(
                            to_email=recipient_email,
                            followup=f,
                            application=app,
                            config=cfg,
                        )
                        emails_sent += 1
                    except Exception as e:
                        errors.append(f"Email reminder failed for followup {f_id}: {e}")

    # 2. Check Applications for interviews or follow_up_date
    for app in all_apps:
        app_id = str(app.get("application_id"))
        status = str(app.get("application_status", ""))
        scanned_apps += 1

        # Check upcoming interview
        if cfg.get("notify_on_interview", True) and status == "Interview":
            notif_key = f"interview_{app_id}"
            if not excel_service.has_notification_today(path, notif_key, "interview_upcoming"):
                company = app.get("company_name", "Company")
                title = f"Upcoming Interview: {company}"
                msg = f"Interview scheduled for {app.get('job_title', 'Position')} at {company}."

                if inapp_enabled:
                    try:
                        create_inapp_notification(
                            type="interview_upcoming",
                            title=title,
                            message=msg,
                            related_id=app_id,
                            path_input=path,
                        )
                        inapp_created += 1
                    except Exception as e:
                        errors.append(f"In-app interview notif failed for app {app_id}: {e}")

                if email_enabled and recipient_email:
                    try:
                        email_service.send_interview_reminder_email(
                            to_email=recipient_email,
                            application=app,
                            config=cfg,
                        )
                        emails_sent += 1
                    except Exception as e:
                        errors.append(f"Email interview reminder failed for app {app_id}: {e}")

    return {
        "scanned_followups": scanned_followups,
        "scanned_applications": scanned_apps,
        "inapp_created": inapp_created,
        "emails_sent": emails_sent,
        "errors": errors,
    }


def handle_status_change(
    application: Dict[str, Any],
    old_status: str,
    new_status: str,
    path_input: Optional[Union[str, Path]] = None,
) -> None:
    """Trigger notifications on application status changes."""
    path = Path(path_input or settings.excel_path).resolve()
    cfg = get_notification_settings(path)

    if not cfg.get("notify_on_status_change", True):
        return

    company = application.get("company_name", "Company")
    job_title = application.get("job_title", "Position")
    app_id = str(application.get("application_id", ""))

    title = f"Stage Updated: {company}"
    msg = f"{job_title} moved from {old_status} to {new_status}."

    if cfg.get("inapp_enabled", True):
        try:
            create_inapp_notification(
                type="status_change",
                title=title,
                message=msg,
                related_id=app_id,
                path_input=path,
            )
        except Exception as e:
            logger.error(f"Failed to create status change in-app notification: {e}")

    if cfg.get("email_enabled", False):
        recipient = cfg.get("notification_recipient_email", "").strip()
        if recipient:
            try:
                email_service.send_status_change_email(
                    to_email=recipient,
                    application=application,
                    old_status=old_status,
                    new_status=new_status,
                    config=cfg,
                )
            except Exception as e:
                logger.error(f"Failed to send status change email: {e}")
