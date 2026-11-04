import pytest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

from services import excel_service
from services.duplicate_detection_service import (
    DuplicateDetectionService,
    canonicalize_url,
    normalize_company_name,
    normalize_job_title,
)
from services.job_discovery_service import (
    JobDiscoveryService,
    GreenhouseAdapter,
    LeverAdapter,
    LinkedInAlertAdapter,
)
from services.scheduler_service import JobWatcherScheduler


def test_url_canonicalization():
    url1 = "https://example.com/jobs/123/?utm_source=linkedin&utm_medium=job_alert#section"
    url2 = "http://example.com:80/jobs/123"
    assert canonicalize_url(url1) == "https://example.com/jobs/123"
    assert canonicalize_url(url2) == "http://example.com/jobs/123"


def test_normalization():
    assert normalize_company_name("Google LLC") == "google"
    assert normalize_company_name("Atlassian Corporation Pvt Ltd.") == "atlassian"
    assert normalize_job_title("Senior Software Engineer (Backend - Remote)") == "senior software engineer"


def test_duplicate_detection():
    existing_discovered = [
        {
            "discovered_job_id": "job-1",
            "company_name": "Stripe",
            "job_title": "Backend Engineer",
            "job_url": "https://stripe.com/jobs/999",
            "is_applied": False,
        }
    ]
    existing_apps = [
        {
            "application_id": "app-1",
            "company_name": "Atlassian",
            "job_title": "Full Stack Developer",
            "job_url": "https://atlassian.com/careers/123",
        }
    ]

    # Duplicate by URL with existing application
    cand1 = {"company_name": "Atlassian", "job_title": "Full Stack", "job_url": "https://atlassian.com/careers/123?utm_campaign=email"}
    is_dup, dup_type, item, is_applied = DuplicateDetectionService.is_duplicate(cand1, existing_discovered, existing_apps)
    assert is_dup is True
    assert dup_type == "application_url"
    assert is_applied is True

    # Duplicate by DiscoveredJobs
    cand2 = {"company_name": "Stripe Inc", "job_title": "Backend Engineer", "job_url": "https://stripe.com/jobs/999"}
    is_dup, dup_type, item, is_applied = DuplicateDetectionService.is_duplicate(cand2, existing_discovered, existing_apps)
    assert is_dup is True
    assert dup_type in ("canonical_url", "company_and_title")
    assert is_applied is False

    # Genuinely new job
    cand3 = {"company_name": "Netflix", "job_title": "Cloud SRE", "job_url": "https://jobs.lever.co/netflix/456"}
    is_dup, dup_type, item, is_applied = DuplicateDetectionService.is_duplicate(cand3, existing_discovered, existing_apps)
    assert is_dup is False


def test_excel_company_monitoring(tmp_path):
    test_excel = tmp_path / "test_tracker.xlsx"
    excel_service.initialize_workbook(test_excel)

    # 1. Add company
    c_data = {
        "company_name": "TestCorp",
        "website": "https://testcorp.com",
        "careers_url": "https://testcorp.com/careers",
        "search_keywords": ["SWE", "Backend"],
        "monitoring_enabled": True,
    }
    created = excel_service.add_monitored_company(test_excel, c_data)
    assert created["company_name"] == "TestCorp"
    cid = created["company_id"]

    # 2. Read companies
    all_comps = excel_service.read_monitored_companies(test_excel)
    assert len(all_comps) == 1
    assert all_comps[0]["company_name"] == "TestCorp"

    # 3. Update company
    updated = excel_service.update_monitored_company(test_excel, cid, {"monitoring_enabled": False})
    assert updated["monitoring_enabled"] is False

    # 4. Delete company
    del_res = excel_service.delete_monitored_company(test_excel, cid)
    assert del_res is True
    assert len(excel_service.read_monitored_companies(test_excel)) == 0


def test_excel_discovered_jobs_and_convert(tmp_path):
    test_excel = tmp_path / "test_tracker.xlsx"
    excel_service.initialize_workbook(test_excel)

    job_data = {
        "company_name": "Acme Inc",
        "job_title": "Staff Software Engineer",
        "job_url": "https://acme.com/jobs/101",
        "description": "Building next gen cloud services using Python and Go.",
        "location": "Remote",
        "experience": "5+ years",
        "required_skills": ["Python", "Go", "Kubernetes"],
        "match_score": 88.0,
    }

    # Save discovered job
    saved = excel_service.save_discovered_job(test_excel, job_data)
    assert saved["is_new"] is True
    assert saved["match_score"] == 88.0
    jid = saved["discovered_job_id"]

    # Convert to Application
    app = excel_service.convert_discovered_to_application(test_excel, jid, status="Wishlist")
    assert app["company_name"] == "Acme Inc"
    assert app["application_status"] == "Wishlist"

    # Verify discovered job status updated
    updated_j = excel_service.get_discovered_job_by_id(test_excel, jid)
    assert updated_j["is_applied"] is True
    assert updated_j["is_new"] is False


def test_linkedin_alert_text_parsing():
    adapter = LinkedInAlertAdapter()
    sample_text = """
    Your Job Alert for Software Engineer in India:
    Senior Software Engineer at Microsoft
    Bengaluru, Karnataka, India
    https://www.linkedin.com/jobs/view/3998821910/?eBP=CwEAAAGQt
    """
    jobs = adapter.parse_alert_text(sample_text)
    assert len(jobs) == 1
    assert "linkedin.com/jobs/view/3998821910" in jobs[0]["job_url"]
    assert jobs[0]["job_id"] == "3998821910"


def test_api_watcher_status(client):
    res = client.get("/api/watcher/status")
    assert res.status_code == 200
    data = res.json()
    assert "scheduler_running" in data
    assert "monitored_companies_count" in data


def test_api_watcher_companies_crud(client):
    # 1. Add company
    payload = {
        "company_name": "Figma",
        "careers_url": "https://boards.greenhouse.io/figma",
        "search_keywords": ["Fullstack", "Frontend"],
        "monitoring_enabled": True,
    }
    create_res = client.post("/api/watcher/companies", json=payload)
    assert create_res.status_code == 201
    cid = create_res.json()["company_id"]

    # 2. List companies
    list_res = client.get("/api/watcher/companies")
    assert list_res.status_code == 200
    assert any(c["company_id"] == cid for c in list_res.json())

    # 3. Update company
    update_res = client.put(f"/api/watcher/companies/{cid}", json={"monitoring_enabled": False})
    assert update_res.status_code == 200
    assert update_res.json()["monitoring_enabled"] is False

    # 4. Delete company
    del_res = client.delete(f"/api/watcher/companies/{cid}")
    assert del_res.status_code == 200


def test_api_watcher_jobs_lifecycle(client, temp_dirs):
    excel_path = temp_dirs["excel_path"]
    job = {
        "company_name": "Databricks",
        "job_title": "Software Engineer, Infrastructure",
        "job_url": "https://databricks.com/jobs/infra-101",
        "description": "Distributed systems engineer working with Go and Kubernetes.",
        "location": "Bengaluru",
        "match_score": 85.0,
    }
    saved = excel_service.save_discovered_job(excel_path, job)
    jid = saved["discovered_job_id"]

    # 1. List jobs
    res = client.get("/api/watcher/jobs?company=Databricks")
    assert res.status_code == 200
    jobs = res.json()
    assert len(jobs) == 1
    assert jobs[0]["job_title"] == "Software Engineer, Infrastructure"

    # 2. Apply job (convert to application)
    apply_res = client.post(f"/api/watcher/jobs/{jid}/apply")
    assert apply_res.status_code == 200
    assert apply_res.json()["success"] is True

    # Check that it's now marked is_applied
    get_res = client.get(f"/api/watcher/jobs/{jid}")
    assert get_res.json()["is_applied"] is True

    # 3. Delete / dismiss
    del_res = client.delete(f"/api/watcher/jobs/{jid}")
    assert del_res.status_code == 200


def test_api_watcher_settings(client):
    res = client.get("/api/watcher/settings")
    assert res.status_code == 200
    current = res.json()

    update_payload = {
        "enabled": True,
        "daily_time": "10:30",
        "min_match_score": 75,
    }
    update_res = client.post("/api/watcher/settings", json=update_payload)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["daily_time"] == "10:30"
    assert updated["min_match_score"] == 75


def test_api_watcher_ingest_alert(client):
    alert_text = """
    Software Engineer at Cisco
    https://www.linkedin.com/jobs/view/1234567890/
    """
    res = client.post("/api/watcher/ingest-alert", json={"alert_text": alert_text})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["jobs"]) == 1

