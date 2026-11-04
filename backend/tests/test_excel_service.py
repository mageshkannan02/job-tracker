from datetime import date, datetime
import pytest
from openpyxl import load_workbook

from services import excel_service
from services.excel_service import COLUMNS


def test_initialize_workbook(temp_excel):
    """Verify workbook initializes with all 5 sheets and correct headers."""
    wb = load_workbook(temp_excel)
    for sheet_name, cols in COLUMNS.items():
        assert sheet_name in wb.sheetnames
        ws = wb[sheet_name]
        headers = [cell.value for cell in ws[1]]
        assert headers == cols
    wb.close()


def test_add_and_read_application(temp_excel, sample_application_data):
    """Verify adding and reading an application works with list deserialization."""
    app = excel_service.add_application(temp_excel, sample_application_data)
    assert "application_id" in app
    assert app["company_name"] == sample_application_data["company_name"]
    assert app["required_skills"] == sample_application_data["required_skills"]

    apps = excel_service.read_applications(temp_excel)
    assert len(apps) == 1
    assert apps[0]["application_id"] == app["application_id"]
    assert apps[0]["job_title"] == "Senior Python Backend Engineer"
    assert isinstance(apps[0]["required_skills"], list)
    assert "FastAPI" in apps[0]["required_skills"]


def test_duplicate_application_prevention(temp_excel, sample_application_data):
    """Verify duplicates by URL and (Company + Title) are rejected."""
    excel_service.add_application(temp_excel, sample_application_data)

    # Duplicate by URL
    with pytest.raises(ValueError, match="already exists"):
        excel_service.add_application(temp_excel, {
            "company_name": "Different Company",
            "job_title": "Different Title",
            "job_url": sample_application_data["job_url"],
        })

    # Duplicate by company_name + job_title
    with pytest.raises(ValueError, match="already exists"):
        excel_service.add_application(temp_excel, {
            "company_name": sample_application_data["company_name"].upper(),
            "job_title": sample_application_data["job_title"].lower(),
            "job_url": "https://different-url.example.com",
        })


def test_get_application_by_id(temp_excel, sample_application_data):
    """Verify fetching single application by ID."""
    created = excel_service.add_application(temp_excel, sample_application_data)
    app_id = created["application_id"]

    fetched = excel_service.get_application_by_id(temp_excel, app_id)
    assert fetched is not None
    assert fetched["application_id"] == app_id
    assert fetched["company_name"] == sample_application_data["company_name"]

    non_existent = excel_service.get_application_by_id(temp_excel, "non-existent-id")
    assert non_existent is None


def test_update_application(temp_excel, sample_application_data):
    """Verify updating application fields."""
    created = excel_service.add_application(temp_excel, sample_application_data)
    app_id = created["application_id"]

    updated = excel_service.update_application(temp_excel, app_id, {
        "salary_range": "$180,000 - $210,000",
        "notes": "Updated after first screening.",
        "match_score": 92.0,
    })

    assert updated is not None
    assert updated["salary_range"] == "$180,000 - $210,000"
    assert updated["notes"] == "Updated after first screening."
    assert updated["match_score"] == 92.0
    assert updated["updated_at"] >= created["updated_at"]

    # Verify persistence
    read_back = excel_service.get_application_by_id(temp_excel, app_id)
    assert read_back["salary_range"] == "$180,000 - $210,000"


def test_delete_application(temp_excel, sample_application_data):
    """Verify deleting application removes the row."""
    created = excel_service.add_application(temp_excel, sample_application_data)
    app_id = created["application_id"]

    assert excel_service.delete_application(temp_excel, app_id) is True
    assert excel_service.get_application_by_id(temp_excel, app_id) is None
    assert len(excel_service.read_applications(temp_excel)) == 0

    # Delete non-existent
    assert excel_service.delete_application(temp_excel, "non-existent-id") is False


def test_update_status_and_history(temp_excel, sample_application_data):
    """Verify status update logs into StatusHistory."""
    created = excel_service.add_application(temp_excel, sample_application_data)
    app_id = created["application_id"]

    updated = excel_service.update_status(
        temp_excel,
        app_id,
        "Interview",
        notes="Recruiter scheduled technical interview.",
    )
    assert updated is not None
    assert updated["application_status"] == "Interview"

    history = excel_service.read_status_history(temp_excel, app_id=app_id)
    assert len(history) == 1
    assert history[0]["application_id"] == app_id
    assert history[0]["previous_status"] == "Applied"
    assert history[0]["new_status"] == "Interview"
    assert "technical interview" in history[0]["notes"]


def test_followups_crud(temp_excel):
    """Verify FollowUps CRUD operations."""
    followup_data = {
        "application_id": "app-123",
        "task": "Send thank you note after round 2",
        "followup_date": "2026-11-05",
        "completed": False,
        "notes": "Mention discussion about architecture.",
    }

    created = excel_service.add_followup(temp_excel, followup_data)
    f_id = created["followup_id"]
    assert f_id is not None
    assert created["task"] == followup_data["task"]

    all_f = excel_service.read_followups(temp_excel)
    assert len(all_f) == 1
    assert all_f[0]["completed"] is False

    # Update
    updated = excel_service.update_followup(temp_excel, f_id, {"completed": True, "notes": "Sent!"})
    assert updated is not None
    assert updated["completed"] is True

    # Read back
    refreshed = excel_service.read_followups(temp_excel)
    assert refreshed[0]["completed"] is True

    # Delete
    assert excel_service.delete_followup(temp_excel, f_id) is True
    assert len(excel_service.read_followups(temp_excel)) == 0


def test_analysis_sheet(temp_excel):
    """Verify saving and retrieving resume analysis records."""
    analysis_data = {
        "application_id": "app-456",
        "resume_name": "FullStack_Resume.pdf",
        "match_score": 85.0,
        "matched_skills": ["Python", "Docker", "SQL"],
        "missing_skills": ["Kubernetes"],
        "experience_match": "Strong senior experience",
        "recommendations": ["Highlight k8s experience if any"],
    }

    saved = excel_service.save_analysis(temp_excel, analysis_data)
    assert "analysis_id" in saved
    assert saved["match_score"] == 85.0

    records = excel_service.get_analysis_history(temp_excel, app_id="app-456")
    assert len(records) == 1
    assert records[0]["resume_name"] == "FullStack_Resume.pdf"
    assert "Python" in records[0]["matched_skills"]


def test_settings_upsert(temp_excel):
    """Verify settings upsert behavior."""
    initial = excel_service.get_settings(temp_excel)
    assert isinstance(initial, dict)

    excel_service.update_settings(temp_excel, {"dark_mode": "true", "daily_goal": "5"})
    settings = excel_service.get_settings(temp_excel)
    assert settings.get("dark_mode") == "true"
    assert settings.get("daily_goal") == "5"

    # Upsert existing key
    excel_service.update_settings(temp_excel, {"dark_mode": "false"})
    updated_settings = excel_service.get_settings(temp_excel)
    assert updated_settings.get("dark_mode") == "false"
    assert updated_settings.get("daily_goal") == "5"
