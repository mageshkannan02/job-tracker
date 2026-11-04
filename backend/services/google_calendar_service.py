import json
import logging
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import requests
from config import settings
from services import excel_service

logger = logging.getLogger("google_calendar_service")

GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"


def get_token_storage_path() -> Path:
    return settings.data_dir / "google_calendar_tokens.json"


def save_tokens(token_data: Dict[str, Any]) -> None:
    """Store OAuth tokens in JSON file."""
    path = get_token_storage_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(token_data, f, indent=2)
    logger.info("Saved Google Calendar OAuth tokens.")


def load_tokens() -> Optional[Dict[str, Any]]:
    """Load OAuth tokens from disk."""
    path = get_token_storage_path()
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading tokens: {e}")
        return None


def delete_tokens() -> bool:
    """Remove stored tokens on disconnect."""
    path = get_token_storage_path()
    if path.exists():
        try:
            path.unlink()
            logger.info("Deleted Google Calendar OAuth tokens.")
            return True
        except Exception as e:
            logger.error(f"Error deleting tokens: {e}")
            return False
    return True


def get_client_credentials() -> Tuple[str, str, str]:
    """Retrieve Client ID, Secret, and Redirect URI from settings or stored config."""
    client_id = settings.google_client_id.strip()
    client_secret = settings.google_client_secret.strip()
    redirect_uri = settings.google_redirect_uri.strip()

    # Check Settings sheet fallback if env is blank
    if not client_id or not client_secret:
        try:
            stored_settings = excel_service.get_settings(settings.excel_path)
            if not client_id and "google_client_id" in stored_settings:
                client_id = str(stored_settings["google_client_id"]).strip()
            if not client_secret and "google_client_secret" in stored_settings:
                client_secret = str(stored_settings["google_client_secret"]).strip()
            if "google_redirect_uri" in stored_settings:
                redirect_uri = str(stored_settings["google_redirect_uri"]).strip()
        except Exception:
            pass

    return client_id, client_secret, redirect_uri


def get_auth_url(state: str = "tracker_state") -> Tuple[str, str]:
    """Generate Google OAuth 2.0 authorization URL."""
    client_id, _, redirect_uri = get_client_credentials()
    if not client_id:
        raise ValueError(
            "Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in your environment or Settings."
        )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": CALENDAR_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = f"{GOOGLE_AUTH_BASE}?{urllib.parse.urlencode(params)}"
    return url, redirect_uri


def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens."""
    client_id, client_secret, redirect_uri = get_client_credentials()
    if not client_id or not client_secret:
        raise ValueError("Google Client ID and Client Secret must be configured.")

    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    if resp.status_code != 200:
        logger.error(f"Failed to exchange code: {resp.text}")
        raise ValueError(f"Google token exchange failed: {resp.text}")

    data = resp.json()
    now_ts = int(datetime.now(timezone.utc).timestamp())
    expires_in = data.get("expires_in", 3600)
    data["expires_at"] = now_ts + expires_in
    data["connected_at"] = datetime.now(timezone.utc).isoformat()

    save_tokens(data)
    return data


def refresh_access_token() -> str:
    """Use refresh_token to acquire a fresh access_token."""
    tokens = load_tokens()
    if not tokens or "refresh_token" not in tokens:
        raise ValueError("No refresh token available. User must re-authenticate with Google.")

    client_id, client_secret, _ = get_client_credentials()
    if not client_id or not client_secret:
        raise ValueError("Google Client ID and Client Secret are required to refresh token.")

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": tokens["refresh_token"],
        "grant_type": "refresh_token",
    }

    resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    if resp.status_code != 200:
        logger.error(f"Failed to refresh access token: {resp.text}")
        raise ValueError(f"Unable to refresh Google access token: {resp.text}")

    data = resp.json()
    tokens["access_token"] = data["access_token"]
    now_ts = int(datetime.now(timezone.utc).timestamp())
    tokens["expires_at"] = now_ts + data.get("expires_in", 3600)

    save_tokens(tokens)
    return tokens["access_token"]


def get_valid_access_token() -> str:
    """Return a valid access token, automatically refreshing if close to expiry."""
    tokens = load_tokens()
    if not tokens or "access_token" not in tokens:
        raise ValueError("Not connected to Google Calendar.")

    now_ts = int(datetime.now(timezone.utc).timestamp())
    expires_at = tokens.get("expires_at", 0)

    # If token expires within 2 minutes, refresh it
    if now_ts >= (expires_at - 120):
        return refresh_access_token()

    return tokens["access_token"]


def get_sync_status() -> Dict[str, Any]:
    """Check connectivity and status of Google Calendar integration."""
    client_id, _, redirect_uri = get_client_credentials()
    tokens = load_tokens()
    is_connected = bool(tokens and ("access_token" in tokens or "refresh_token" in tokens))

    calendar_email = None
    if is_connected:
        try:
            token = get_valid_access_token()
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(
                f"{GOOGLE_CALENDAR_API_BASE}/users/me/calendarList/primary",
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                calendar_email = resp.json().get("id")
        except Exception as e:
            logger.warning(f"Could not verify Google Calendar primary account: {e}")

    # Count pending events that are eligible for sync
    all_followups = excel_service.read_followups(settings.excel_path)
    pending_followups = [f for f in all_followups if not f.get("completed") and f.get("followup_date")]

    all_apps = excel_service.read_applications(settings.excel_path)
    interview_apps = [a for a in all_apps if a.get("application_status") == "Interview" or a.get("follow_up_date")]

    return {
        "configured": bool(client_id),
        "connected": is_connected,
        "calendar_email": calendar_email,
        "redirect_uri": redirect_uri,
        "pending_followup_events": len(pending_followups),
        "pending_interview_events": len(interview_apps),
        "total_syncable_events": len(pending_followups) + len(interview_apps),
        "connected_at": tokens.get("connected_at") if tokens else None,
    }


def create_google_calendar_event(
    summary: str,
    description: str,
    start_date_str: str,
    end_date_str: Optional[str] = None,
    location: Optional[str] = None,
    all_day: bool = True,
) -> Dict[str, Any]:
    """Push an individual event to Google Calendar v3 API."""
    token = get_valid_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Format event payload
    event_body: Dict[str, Any] = {
        "summary": summary,
        "description": description,
    }

    if location:
        event_body["location"] = location

    # Parse date
    clean_date = start_date_str.split("T")[0].strip()

    if all_day:
        event_body["start"] = {"date": clean_date}
        # For Google Calendar, all-day events end date is exclusive (next day)
        try:
            dt = datetime.strptime(clean_date, "%Y-%m-%d").date()
            next_day = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
            event_body["end"] = {"date": next_day}
        except Exception:
            event_body["end"] = {"date": clean_date}
    else:
        # Time-based event
        event_body["start"] = {"dateTime": f"{clean_date}T09:00:00Z"}
        event_body["end"] = {"dateTime": f"{clean_date}T10:00:00Z"}

    # Add reminders
    event_body["reminders"] = {
        "useDefault": False,
        "overrides": [
            {"method": "email", "minutes": 24 * 60},  # 1 day before
            {"method": "popup", "minutes": 60},       # 1 hour before
        ],
    }

    resp = requests.post(
        f"{GOOGLE_CALENDAR_API_BASE}/calendars/primary/events",
        headers=headers,
        json=event_body,
        timeout=15,
    )

    if resp.status_code not in (200, 201):
        raise ValueError(f"Google Calendar API rejected event: {resp.text}")

    return resp.json()


def sync_all_events(excel_path: Path) -> Dict[str, Any]:
    """Sync all pending follow-ups and interview deadlines from Excel to Google Calendar."""
    synced_events: List[Dict[str, Any]] = []
    failed_events: List[Dict[str, Any]] = []

    # 1. Sync pending FollowUps
    followups = excel_service.read_followups(excel_path)
    apps = excel_service.read_applications(excel_path)
    app_map = {a.get("application_id"): a for a in apps}

    for f in followups:
        if f.get("completed"):
            continue
        date_str = str(f.get("followup_date") or "").strip()
        if not date_str:
            continue

        app = app_map.get(f.get("application_id"), {})
        company = app.get("company_name") or "Application"
        role = app.get("job_title") or ""
        task_name = f.get("task") or "Follow-up Task"

        summary = f"[Autumn Suite] Follow-up: {company} - {task_name}"
        desc_lines = [
            f"Target Company: {company}",
            f"Role: {role}",
            f"Task: {task_name}",
        ]
        if f.get("notes"):
            desc_lines.append(f"Notes: {f.get('notes')}")
        if app.get("recruiter_name"):
            desc_lines.append(f"Recruiter: {app.get('recruiter_name')} ({app.get('recruiter_email') or 'No email'})")
        if app.get("job_url"):
            desc_lines.append(f"Job URL: {app.get('job_url')}")

        description = "\n".join(desc_lines)
        location = app.get("location") or "Remote"

        try:
            gcal_event = create_google_calendar_event(
                summary=summary,
                description=description,
                start_date_str=date_str,
                location=location,
                all_day=True,
            )
            synced_events.append({
                "type": "followup",
                "id": f.get("followup_id"),
                "summary": summary,
                "gcal_id": gcal_event.get("id"),
                "html_link": gcal_event.get("htmlLink"),
            })
        except Exception as e:
            failed_events.append({
                "type": "followup",
                "id": f.get("followup_id"),
                "summary": summary,
                "error": str(e),
            })

    # 2. Sync Applications with Interviews or upcoming follow-up dates
    for app in apps:
        app_status = app.get("application_status")
        followup_date = str(app.get("follow_up_date") or "").strip()

        if app_status == "Interview" and followup_date:
            company = app.get("company_name") or "Company"
            role = app.get("job_title") or "Role"
            summary = f"[Autumn Suite] Interview: {role} at {company}"
            description = (
                f"Company: {company}\n"
                f"Position: {role}\n"
                f"Status: Interview Stage\n"
                f"Recruiter: {app.get('recruiter_name') or 'N/A'}\n"
                f"Notes: {app.get('notes') or ''}\n"
                f"Posting: {app.get('job_url') or ''}"
            )
            try:
                gcal_event = create_google_calendar_event(
                    summary=summary,
                    description=description,
                    start_date_str=followup_date,
                    location=app.get("location") or "Remote",
                    all_day=True,
                )
                synced_events.append({
                    "type": "interview",
                    "id": app.get("application_id"),
                    "summary": summary,
                    "gcal_id": gcal_event.get("id"),
                    "html_link": gcal_event.get("htmlLink"),
                })
            except Exception as e:
                failed_events.append({
                    "type": "interview",
                    "id": app.get("application_id"),
                    "summary": summary,
                    "error": str(e),
                })

    return {
        "success": True,
        "synced_count": len(synced_events),
        "failed_count": len(failed_events),
        "synced_events": synced_events,
        "failed_events": failed_events,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


def build_google_calendar_web_url(
    title: str,
    details: str,
    location: str = "",
    start_date: str = "",
    end_date: Optional[str] = None,
    all_day: bool = True,
) -> str:
    """Generate a 1-click Google Calendar web event creation link (zero-config, works without OAuth)."""
    clean_date = start_date.split("T")[0].replace("-", "").strip() if start_date else ""
    if not clean_date:
        clean_date = datetime.now(timezone.utc).strftime("%Y%m%d")

    if end_date:
        clean_end = end_date.split("T")[0].replace("-", "").strip()
    else:
        # Default 1 day
        try:
            dt = datetime.strptime(clean_date, "%Y%m%d")
            clean_end = (dt + timedelta(days=1)).strftime("%Y%m%d")
        except Exception:
            clean_end = clean_date

    dates_param = f"{clean_date}/{clean_end}" if all_day else f"{clean_date}T090000Z/{clean_date}T100000Z"

    params = {
        "action": "TEMPLATE",
        "text": title,
        "details": details,
        "dates": dates_param,
    }
    if location:
        params["location"] = location

    return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"


def generate_ical_feed(excel_path: Path) -> str:
    """Generate RFC 5545 iCalendar (.ics) feed content for live Google Calendar subscription."""
    followups = excel_service.read_followups(excel_path)
    apps = excel_service.read_applications(excel_path)
    app_map = {a.get("application_id"): a for a in apps}

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Autumn Suite//Google Calendar Sync//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Autumn Suite Applications & Follow-ups",
        "X-WR-TIMEZONE:UTC",
    ]

    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def _sanitize(text: Any) -> str:
        s = str(text or "")
        return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    # 1. FollowUp Events
    for f in followups:
        date_str = str(f.get("followup_date") or "").strip()
        if not date_str:
            continue
        clean_d = date_str.split("T")[0].replace("-", "")

        app = app_map.get(f.get("application_id"), {})
        company = app.get("company_name") or "Application"
        task = f.get("task") or "Follow-up Task"
        summary = f"Follow-up: {company} - {task}"
        desc = f"Task: {task}\\nCompany: {company}\\nRole: {app.get('job_title', '')}\\nStatus: {app.get('application_status', '')}"
        if f.get("notes"):
            desc += f"\\nNotes: {_sanitize(f.get('notes'))}"

        uid = f"followup-{f.get('followup_id')}@jobtracker.local"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART;VALUE=DATE:{clean_d}",
            f"SUMMARY:{_sanitize(summary)}",
            f"DESCRIPTION:{desc}",
            f"LOCATION:{_sanitize(app.get('location') or 'Remote')}",
            f"STATUS:{'COMPLETED' if f.get('completed') else 'CONFIRMED'}",
            "CATEGORIES:Autumn Suite,Follow-up",
            "END:VEVENT",
        ])

    # 2. Application Events (Interviews, Follow-up Deadlines)
    for app in apps:
        app_date = str(app.get("follow_up_date") or app.get("date_applied") or "").strip()
        if not app_date:
            continue
        clean_d = app_date.split("T")[0].replace("-", "")

        company = app.get("company_name") or "Opportunity"
        role = app.get("job_title") or "Role"
        status_name = app.get("application_status") or "Tracked"

        summary = f"[{status_name}] {role} at {company}"
        desc = (
            f"Company: {company}\\nRole: {role}\\nStatus: {status_name}"
            f"\\nRecruiter: {app.get('recruiter_name', 'N/A')}"
            f"\\nJob URL: {app.get('job_url', '')}"
        )
        uid = f"app-{app.get('application_id')}@jobtracker.local"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART;VALUE=DATE:{clean_d}",
            f"SUMMARY:{_sanitize(summary)}",
            f"DESCRIPTION:{desc}",
            f"LOCATION:{_sanitize(app.get('location') or 'Remote')}",
            "STATUS:CONFIRMED",
            f"CATEGORIES:Autumn Suite,{status_name}",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)

