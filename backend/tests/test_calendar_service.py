import pytest
from datetime import datetime
from services import excel_service, google_calendar_service


def test_build_google_calendar_web_url():
    url = google_calendar_service.build_google_calendar_web_url(
        title="Technical Interview: Stripe",
        details="Senior Software Engineer screening",
        location="Remote (Google Meet)",
        start_date="2026-11-15",
    )
    assert "calendar.google.com" in url
    assert "action=TEMPLATE" in url
    assert "Technical+Interview" in url or "Technical%20Interview" in url or "Stripe" in url
    assert "20261115" in url


def test_generate_ical_feed(temp_excel):
    # Add application
    app_data = {
        "company_name": "Google",
        "job_title": "Staff AI Engineer",
        "application_status": "Interview",
        "date_applied": "2026-11-04",
        "follow_up_date": "2026-11-12",
        "location": "Mountain View, CA",
    }
    app = excel_service.add_application(temp_excel, app_data)

    # Add follow-up
    followup_data = {
        "application_id": app["application_id"],
        "task": "Review system design notes",
        "followup_date": "2026-11-10",
        "notes": "Focus on distributed cache",
    }
    excel_service.add_followup(temp_excel, followup_data)

    ical_content = google_calendar_service.generate_ical_feed(temp_excel)
    assert "BEGIN:VCALENDAR" in ical_content
    assert "END:VCALENDAR" in ical_content
    assert "BEGIN:VEVENT" in ical_content
    assert "Google" in ical_content
    assert "Review system design notes" in ical_content


def test_calendar_status_and_links(client, temp_excel):
    # Test status endpoint
    resp = client.get("/api/calendar/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "connected" in data
    assert "configured" in data

    # Test feed endpoint
    resp = client.get("/api/calendar/feed.ics")
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    assert "BEGIN:VCALENDAR" in resp.text

    # Test export.ics endpoint
    resp = client.get("/api/calendar/export.ics")
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("content-disposition", "")

    # Test link endpoint
    resp = client.get("/api/calendar/link?title=Interview&date=2026-11-20")
    assert resp.status_code == 200
    assert "url" in resp.json()
    assert "calendar.google.com" in resp.json()["url"]

