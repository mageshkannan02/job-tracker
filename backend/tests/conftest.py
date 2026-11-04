import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from config import settings
from services.excel_service import initialize_workbook
from main import app


@pytest.fixture
def temp_excel(tmp_path: Path):
    """Fixture providing an initialized temporary Excel workbook."""
    path = tmp_path / "test_tracker.xlsx"
    initialize_workbook(path)
    return path


@pytest.fixture
def temp_dirs(tmp_path: Path, monkeypatch):
    """Fixture overriding application data directories with temporary directories."""
    data_dir = tmp_path / "data"
    resume_dir = tmp_path / "resumes"
    backup_dir = tmp_path / "backups"

    data_dir.mkdir(parents=True, exist_ok=True)
    resume_dir.mkdir(parents=True, exist_ok=True)
    backup_dir.mkdir(parents=True, exist_ok=True)

    excel_path = data_dir / "job_tracker.xlsx"
    initialize_workbook(excel_path)

    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "resume_dir", resume_dir)
    monkeypatch.setattr(settings, "backup_dir", backup_dir)

    return {
        "data_dir": data_dir,
        "resume_dir": resume_dir,
        "backup_dir": backup_dir,
        "excel_path": excel_path,
    }


@pytest.fixture
def client(temp_dirs):
    """Fixture providing a FastAPI TestClient configured with isolated temp storage."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_application_data():
    """Realistic sample job application payload."""
    return {
        "company_name": "Acme Innovations",
        "company_website": "https://acme-innovations.example.com",
        "company_logo": "https://acme-innovations.example.com/logo.png",
        "job_title": "Senior Python Backend Engineer",
        "job_description": "We are seeking a seasoned Python engineer experienced with FastAPI, distributed systems, and LLMs.",
        "job_url": "https://acme-innovations.example.com/jobs/senior-python",
        "location": "San Francisco, CA",
        "work_mode": "Hybrid",
        "employment_type": "FullTime",
        "experience_required": "5+ years",
        "salary_range": "$160,000 - $190,000",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Pytest"],
        "application_source": "LinkedIn",
        "date_discovered": "2026-10-15",
        "date_applied": "2026-10-16",
        "application_status": "Applied",
        "recruiter_name": "Jane Doe",
        "recruiter_email": "jane.doe@acme-innovations.example.com",
        "follow_up_date": "2026-10-23",
        "resume_version": "Backend_v3.pdf",
        "match_score": 88.5,
        "notes": "Applied via referral from Alice.",
    }
