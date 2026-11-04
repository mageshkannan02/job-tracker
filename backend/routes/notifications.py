import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from config import settings
from models.schemas import (
    NotificationCreate,
    NotificationResponse,
    NotificationsListResponse,
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    TestEmailRequest,
)
from services import email_service, excel_service, notification_service

logger = logging.getLogger("routes.notifications")
router = APIRouter()


@router.get("", response_model=NotificationsListResponse)
@router.get("/", response_model=NotificationsListResponse, include_in_schema=False)
def list_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of items to retrieve"),
):
    """List in-app notifications with unread count."""
    notifs = excel_service.read_notifications(settings.excel_path, unread_only=unread_only, limit=limit)
    all_notifs = excel_service.read_notifications(settings.excel_path, unread_only=False, limit=500)
    unread_count = sum(1 for n in all_notifs if not n.get("is_read"))

    return {
        "notifications": notifs,
        "unread_count": unread_count,
        "total_count": len(all_notifs),
    }


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_notification(payload: NotificationCreate):
    """Create a manual notification."""
    created = excel_service.add_notification(settings.excel_path, payload.model_dump())
    return created


@router.patch("/{notification_id}/read")
def mark_as_read(notification_id: str):
    """Mark a specific notification as read."""
    updated = excel_service.mark_notification_read(settings.excel_path, notification_id, is_read=True)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID '{notification_id}' not found.",
        )
    return {"success": True, "notification_id": notification_id, "is_read": True}


@router.post("/mark-all-read")
def mark_all_as_read():
    """Mark all notifications as read."""
    count = excel_service.mark_all_notifications_read(settings.excel_path)
    return {"success": True, "updated_count": count}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str):
    """Delete a notification by ID."""
    deleted = excel_service.delete_notification(settings.excel_path, notification_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID '{notification_id}' not found.",
        )
    return {"success": True, "notification_id": notification_id}


@router.delete("")
@router.delete("/", include_in_schema=False)
def clear_all_notifications():
    """Clear all notification records."""
    cleared = excel_service.clear_all_notifications(settings.excel_path)
    return {"success": True, "cleared_count": cleared}


@router.post("/scan")
def trigger_notification_scan(force_email: bool = Query(False, description="Send emails even if email notifications are toggled off in settings")):
    """Scan upcoming follow-ups and interview schedules and trigger alerts."""
    result = notification_service.scan_and_notify_due_events(
        path_input=settings.excel_path,
        force_email=force_email,
    )
    return {
        "success": True,
        "message": f"Scan completed: {result['inapp_created']} in-app alert(s) created, {result['emails_sent']} email(s) sent.",
        "details": result,
    }


@router.get("/settings", response_model=NotificationSettingsResponse)
def get_settings():
    """Get email and in-app notification preferences."""
    return notification_service.get_notification_settings(settings.excel_path)


@router.post("/settings", response_model=NotificationSettingsResponse)
@router.put("/settings", response_model=NotificationSettingsResponse)
def update_settings(payload: NotificationSettingsUpdate):
    """Update email and in-app notification preferences."""
    data = payload.model_dump(exclude_unset=True)
    updated = notification_service.update_notification_settings(data, settings.excel_path)
    return updated


@router.post("/test-email")
def test_email(payload: TestEmailRequest):
    """Send a test email using provided or saved SMTP configuration."""
    cfg_override = payload.model_dump(exclude_unset=True)
    target = payload.recipient_email
    try:
        res = email_service.send_test_email(recipient_email=target, custom_config=cfg_override)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Test email error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send test email: {str(e)}")


@router.post("/test-in-app", response_model=NotificationResponse)
def test_in_app():
    """Create a sample in-app notification for testing."""
    created = notification_service.create_inapp_notification(
        type="system",
        title="In-App Notifications Enabled",
        message="Your notification center is active and will alert you for upcoming interviews and due follow-ups.",
        related_id="system_test",
        path_input=settings.excel_path,
    )
    return created
