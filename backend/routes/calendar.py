import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
from pydantic import BaseModel

from config import settings
from services import excel_service, google_calendar_service

logger = logging.getLogger("routes.calendar")
router = APIRouter()


class GoogleCalendarConfig(BaseModel):
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: Optional[str] = None


class SingleEventSyncRequest(BaseModel):
    title: str
    description: str
    date: str
    location: Optional[str] = "Remote"


@router.get("/status")
def get_calendar_status() -> Dict[str, Any]:
    """Retrieve Google Calendar connection status, configuration, and sync statistics."""
    try:
        return google_calendar_service.get_sync_status()
    except Exception as e:
        logger.error(f"Error checking calendar status: {e}")
        return {
            "configured": False,
            "connected": False,
            "error": str(e),
            "pending_followup_events": 0,
            "pending_interview_events": 0,
        }


@router.post("/config")
def save_calendar_config(config: GoogleCalendarConfig) -> Dict[str, Any]:
    """Save Google OAuth Client ID and Secret in Excel settings."""
    payload = {
        "google_client_id": config.google_client_id.strip(),
        "google_client_secret": config.google_client_secret.strip(),
    }
    if config.google_redirect_uri:
        payload["google_redirect_uri"] = config.google_redirect_uri.strip()

    updated = excel_service.update_settings(settings.excel_path, payload)
    return {
        "success": True,
        "message": "Google Calendar configuration saved successfully.",
        "settings": updated,
    }


@router.get("/auth-url")
def get_google_auth_url(state: Optional[str] = "gcal_sync") -> Dict[str, Any]:
    """Get the Google OAuth 2.0 authorization URL for user login."""
    try:
        auth_url, redirect_uri = google_calendar_service.get_auth_url(state=state or "gcal_sync")
        return {"auth_url": auth_url, "redirect_uri": redirect_uri}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/callback")
def google_oauth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """OAuth 2.0 callback endpoint from Google."""
    frontend_settings_url = getattr(settings, "frontend_url", "").rstrip("/") + "/settings" if getattr(settings, "frontend_url", "") else "/settings"

    if error:
        logger.warning(f"Google OAuth error returned: {error}")
        return RedirectResponse(
            url=f"{frontend_settings_url}?gcal_error={error}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_settings_url}?gcal_error=no_code_provided",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        google_calendar_service.exchange_code_for_tokens(code)
        # Update settings with timestamp
        excel_service.update_settings(
            settings.excel_path,
            {"gcal_last_connected": excel_service._serialize_value(None)},
        )
        return RedirectResponse(
            url=f"{frontend_settings_url}?gcal_success=true",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as e:
        logger.error(f"Token exchange failed in callback: {e}")
        return RedirectResponse(
            url=f"{frontend_settings_url}?gcal_error={str(e)}",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/sync")
def sync_calendar_events() -> Dict[str, Any]:
    """Sync all pending follow-ups and interview dates directly to user's Google Calendar."""
    tokens = google_calendar_service.load_tokens()
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Calendar is not connected. Please authorize in Settings first.",
        )

    try:
        result = google_calendar_service.sync_all_events(settings.excel_path)
        excel_service.update_settings(
            settings.excel_path,
            {"gcal_last_synced": result.get("synced_at")},
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error syncing events to Google Calendar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync with Google Calendar: {str(e)}",
        )


@router.post("/disconnect")
def disconnect_calendar() -> Dict[str, Any]:
    """Disconnect Google Calendar and clear local authorization tokens."""
    success = google_calendar_service.delete_tokens()
    return {"success": success, "message": "Google Calendar disconnected."}


@router.get("/feed.ics")
def get_ical_feed():
    """Live iCalendar (.ics) feed URL for subscribing within Google Calendar (Settings -> Add calendar -> From URL)."""
    ical_content = google_calendar_service.generate_ical_feed(settings.excel_path)
    return PlainTextResponse(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'inline; filename="job_tracker_feed.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.get("/export.ics")
def export_ical_file():
    """Download standard .ics calendar file for 1-click import into Google Calendar or Apple Calendar."""
    ical_content = google_calendar_service.generate_ical_feed(settings.excel_path)
    return PlainTextResponse(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="job_tracker_events.ics"',
        },
    )


@router.get("/link")
def get_google_calendar_web_link(
    title: Optional[str] = Query(None),
    details: Optional[str] = Query(""),
    date: Optional[str] = Query(None),
    location: Optional[str] = Query("Remote"),
    application_id: Optional[str] = Query(None),
    followup_id: Optional[str] = Query(None),
) -> Dict[str, str]:
    """Build a direct 1-click 'Add to Google Calendar' web link (no credentials needed)."""
    event_title = title or "Job Application Deadline"
    event_details = details or ""
    event_date = date or ""
    event_location = location or "Remote"

    if followup_id:
        followups = excel_service.read_followups(settings.excel_path)
        apps = excel_service.read_applications(settings.excel_path)
        app_map = {a.get("application_id"): a for a in apps}
        for f in followups:
            if str(f.get("followup_id")) == str(followup_id):
                app = app_map.get(f.get("application_id"), {})
                company = app.get("company_name") or "Company"
                event_title = f"Follow-up: {company} - {f.get('task') or 'Task'}"
                event_date = str(f.get("followup_date") or "")
                event_location = app.get("location") or "Remote"
                event_details = f"Role: {app.get('job_title')}\nTask: {f.get('task')}\nNotes: {f.get('notes') or ''}"
                break

    elif application_id:
        app = excel_service.get_application_by_id(settings.excel_path, application_id)
        if app:
            company = app.get("company_name") or "Company"
            role = app.get("job_title") or "Position"
            event_title = f"Interview/Follow-up: {role} at {company}"
            event_date = str(app.get("follow_up_date") or app.get("date_applied") or "")
            event_location = app.get("location") or "Remote"
            event_details = f"Company: {company}\nRole: {role}\nStatus: {app.get('application_status')}\nPosting: {app.get('job_url') or ''}"

    link = google_calendar_service.build_google_calendar_web_url(
        title=event_title,
        details=event_details,
        location=event_location,
        start_date=event_date,
        all_day=True,
    )
    return {"url": link, "title": event_title, "date": event_date}

