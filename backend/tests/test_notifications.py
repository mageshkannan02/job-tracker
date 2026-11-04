from datetime import date, datetime
from unittest.mock import MagicMock, patch
from fastapi import status
import pytest

from services import email_service, excel_service, notification_service


def test_excel_notifications_crud(temp_excel):
    """Test reading, adding, updating, and deleting notifications in Excel."""
    # 1. Initial read should be empty
    notifs = excel_service.read_notifications(temp_excel)
    assert notifs == []

    # 2. Add notifications
    n1 = excel_service.add_notification(
        temp_excel,
        {
            "type": "followup_due",
            "title": "Follow up with Acme",
            "message": "Send thank you note",
            "related_id": "app-123",
            "is_read": False,
        },
    )
    assert n1["notification_id"] is not None
    assert n1["title"] == "Follow up with Acme"
    assert n1["is_read"] is False

    n2 = excel_service.add_notification(
        temp_excel,
        {
            "type": "interview_upcoming",
            "title": "Interview with Beta Corp",
            "message": "Technical round at 2 PM",
            "related_id": "app-456",
            "is_read": False,
        },
    )

    # 3. Read all and unread
    all_notifs = excel_service.read_notifications(temp_excel)
    assert len(all_notifs) == 2

    # Check deduplication helper
    assert excel_service.has_notification_today(temp_excel, "app-123", "followup_due") is True
    assert excel_service.has_notification_today(temp_excel, "non-existent", "followup_due") is False

    # 4. Mark single as read
    updated = excel_service.mark_notification_read(temp_excel, n1["notification_id"], is_read=True)
    assert updated is True

    unread = excel_service.read_notifications(temp_excel, unread_only=True)
    assert len(unread) == 1
    assert unread[0]["notification_id"] == n2["notification_id"]

    # 5. Mark all as read
    count = excel_service.mark_all_notifications_read(temp_excel)
    assert count == 1  # n2 was unread
    unread_now = excel_service.read_notifications(temp_excel, unread_only=True)
    assert len(unread_now) == 0

    # 6. Delete notification
    deleted = excel_service.delete_notification(temp_excel, n1["notification_id"])
    assert deleted is True
    remaining = excel_service.read_notifications(temp_excel)
    assert len(remaining) == 1
    assert remaining[0]["notification_id"] == n2["notification_id"]

    # 7. Clear all notifications
    cleared = excel_service.clear_all_notifications(temp_excel)
    assert cleared == 1
    assert len(excel_service.read_notifications(temp_excel)) == 0


def test_email_service_send_mocked():
    """Verify email sending with mocked SMTP connection."""
    with patch("smtplib.SMTP") as mock_smtp:
        mock_instance = MagicMock()
        mock_smtp.return_value = mock_instance

        custom_cfg = {
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "smtp_username": "user@example.com",
            "smtp_password": "secretpassword",
            "smtp_use_tls": True,
            "notification_sender_email": "user@example.com",
            "notification_recipient_email": "alerts@example.com",
        }

        # Send custom test email
        res = email_service.send_test_email(recipient_email="alerts@example.com", custom_config=custom_cfg)
        assert res["success"] is True
        assert res["recipient"] == "alerts@example.com"
        mock_smtp.assert_called_with("smtp.example.com", 587, timeout=15)
        mock_instance.starttls.assert_called_once()
        mock_instance.login.assert_called_with("user@example.com", "secretpassword")
        mock_instance.sendmail.assert_called_once()

        # Followup reminder email
        followup = {
            "task": "Review offer letter",
            "followup_date": "2026-11-05",
            "notes": "Negotiate start date",
        }
        app = {"company_name": "Google", "job_title": "SWE III"}
        res2 = email_service.send_followup_reminder_email("alerts@example.com", followup, app, config=custom_cfg)
        assert res2["success"] is True

        # Interview reminder email
        res3 = email_service.send_interview_reminder_email("alerts@example.com", app, config=custom_cfg)
        assert res3["success"] is True

        # Status change email
        res4 = email_service.send_status_change_email("alerts@example.com", app, "Applied", "Interview", config=custom_cfg)
        assert res4["success"] is True


def test_notification_routes(client):
    """Test full API routes for notifications."""
    # 1. Get initial notifications
    res = client.get("/api/notifications")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "notifications" in data
    assert data["unread_count"] == 0

    # 2. Create in-app test notification
    test_notif_res = client.post("/api/notifications/test-in-app")
    assert test_notif_res.status_code == status.HTTP_200_OK
    notif_data = test_notif_res.json()
    assert notif_data["title"] == "In-App Notifications Enabled"
    notif_id = notif_data["notification_id"]

    # Verify count is 1
    res2 = client.get("/api/notifications")
    assert res2.json()["unread_count"] == 1
    assert len(res2.json()["notifications"]) == 1

    # 3. Mark as read
    read_res = client.patch(f"/api/notifications/{notif_id}/read")
    assert read_res.status_code == status.HTTP_200_OK
    assert read_res.json()["is_read"] is True

    res3 = client.get("/api/notifications")
    assert res3.json()["unread_count"] == 0

    # 4. Settings read and update
    settings_res = client.get("/api/notifications/settings")
    assert settings_res.status_code == status.HTTP_200_OK
    assert "inapp_enabled" in settings_res.json()

    update_res = client.post(
        "/api/notifications/settings",
        json={
            "email_enabled": True,
            "smtp_host": "smtp.test.com",
            "smtp_port": 587,
            "smtp_username": "tester@test.com",
            "notification_recipient_email": "candidate@test.com",
            "reminder_days_before": 2,
        },
    )
    assert update_res.status_code == status.HTTP_200_OK
    updated_settings = update_res.json()
    assert updated_settings["email_enabled"] is True
    assert updated_settings["smtp_host"] == "smtp.test.com"
    assert updated_settings["notification_recipient_email"] == "candidate@test.com"

    # 5. Scan endpoint with mock email
    with patch("services.email_service.send_email") as mock_send:
        mock_send.return_value = {"success": True}
        scan_res = client.post("/api/notifications/scan")
        assert scan_res.status_code == status.HTTP_200_OK
        assert scan_res.json()["success"] is True

    # 6. Test email endpoint with mock
    with patch("services.email_service.send_test_email") as mock_test_send:
        mock_test_send.return_value = {"success": True, "message": "Test sent"}
        test_email_resp = client.post(
            "/api/notifications/test-email",
            json={"recipient_email": "candidate@test.com"},
        )
        assert test_email_resp.status_code == status.HTTP_200_OK
        assert test_email_resp.json()["success"] is True

    # 7. Clear all notifications
    clear_res = client.delete("/api/notifications")
    assert clear_res.status_code == status.HTTP_200_OK
    assert client.get("/api/notifications").json()["total_count"] == 0
