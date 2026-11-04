import io
import fitz
from fastapi import status
from unittest.mock import MagicMock
import pytest

from services.groq_service import GroqService


@pytest.fixture
def sample_pdf_stream():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "Jane Smith\nPrincipal Backend Engineer\nPython, Docker, Redis")
    pdf_bytes = doc.tobytes()
    doc.close()
    return io.BytesIO(pdf_bytes)


def test_health_check(client):
    """Verify /api/health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert "excel_storage" in data


def test_resume_upload_and_routes(client, sample_pdf_stream):
    """Verify resume upload, text retrieval, list, and delete endpoints."""
    # 1. Upload
    response = client.post(
        "/api/resumes/upload",
        files={"file": ("jane_smith.pdf", sample_pdf_stream, "application/pdf")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    resume_id = data["resume_id"]
    assert data["filename"] == "jane_smith.pdf"

    # 2. List
    list_resp = client.get("/api/resumes")
    assert list_resp.status_code == status.HTTP_200_OK
    assert len(list_resp.json()) == 1

    # 3. Get text
    text_resp = client.get(f"/api/resumes/{resume_id}/text")
    assert text_resp.status_code == status.HTTP_200_OK
    assert "Jane Smith" in text_resp.json()["text"]

    # 4. Delete
    del_resp = client.delete(f"/api/resumes/{resume_id}")
    assert del_resp.status_code == status.HTTP_200_OK
    assert client.get(f"/api/resumes/{resume_id}/text").status_code == status.HTTP_404_NOT_FOUND


def test_followups_endpoints(client, sample_application_data):
    """Verify follow-up reminders API."""
    created_app = client.post("/api/applications", json=sample_application_data).json()
    app_id = created_app["application_id"]

    # Create follow-up
    create_payload = {
        "application_id": app_id,
        "task": "Follow up with recruiter Jane Doe",
        "followup_date": "2026-11-10",
        "notes": "Ask about round 2 next steps",
    }
    resp = client.post("/api/followups", json=create_payload)
    assert resp.status_code == status.HTTP_201_CREATED
    followup = resp.json()
    f_id = followup["followup_id"]

    # List
    list_resp = client.get(f"/api/followups?application_id={app_id}")
    assert list_resp.status_code == status.HTTP_200_OK
    assert len(list_resp.json()) == 1

    # Update
    update_resp = client.put(f"/api/followups/{f_id}", json={"completed": True})
    assert update_resp.status_code == status.HTTP_200_OK
    assert update_resp.json()["completed"] is True

    # Delete
    del_resp = client.delete(f"/api/followups/{f_id}")
    assert del_resp.status_code == status.HTTP_200_OK


def test_settings_endpoints(client):
    """Verify settings read, update, and excel export."""
    # 1. Get settings
    get_resp = client.get("/api/settings")
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["schema_version"] == "1.0.0"

    # 2. Update settings
    put_resp = client.put("/api/settings", json={"theme": "dark", "notifications": "enabled"})
    assert put_resp.status_code == status.HTTP_200_OK
    assert put_resp.json()["settings"]["theme"] == "dark"

    # 3. Export excel
    export_resp = client.get("/api/settings/export/excel")
    assert export_resp.status_code == status.HTTP_200_OK
    assert len(export_resp.content) > 0


def test_analyzer_endpoint_with_mock(client, sample_pdf_stream, monkeypatch):
    """Verify /api/analyzer/analyze with mocked Groq service."""
    # Upload resume first
    up_resp = client.post(
        "/api/resumes/upload",
        files={"file": ("jane_smith.pdf", sample_pdf_stream, "application/pdf")},
    )
    resume_id = up_resp.json()["resume_id"]

    # Mock GroqService.analyze_resume_vs_job
    mock_result = {
        "match_score": 90.0,
        "technical_skills_match": 95.0,
        "experience_match": 85.0,
        "education_match": 90.0,
        "matched_skills": ["Python", "Docker"],
        "missing_skills": ["Go"],
        "preferred_skills": ["Redis"],
        "keyword_coverage": 88.0,
        "suggestions": ["Add more details on Redis usage"],
        "project_relevance": "High",
        "summary": "Great match for the role.",
    }
    monkeypatch.setattr(GroqService, "analyze_resume_vs_job", MagicMock(return_value=mock_result))

    req_payload = {
        "resume_id": resume_id,
        "job_description": "Looking for a Python and Docker engineer.",
    }
    analyze_resp = client.post("/api/analyzer/analyze", json=req_payload)
    assert analyze_resp.status_code == status.HTTP_200_OK
    res = analyze_resp.json()
    assert res["match_score"] == 90.0
    assert "Python" in res["matched_skills"]

    # Verify history
    hist_resp = client.get("/api/analyzer/history")
    assert hist_resp.status_code == status.HTTP_200_OK
    assert len(hist_resp.json()) == 1


def test_assistant_chat_and_action(client, monkeypatch):
    """Verify assistant chat and action execution."""
    # Mock groq chat
    monkeypatch.setattr(GroqService, "chat", MagicMock(return_value="You have 0 applications currently."))

    chat_resp = client.post(
        "/api/assistant/chat",
        json={"message": "How is my job hunt going?", "history": []},
    )
    assert chat_resp.status_code == status.HTTP_200_OK
    assert "applications" in chat_resp.json()["response"]

    # Action execution
    action_resp = client.post(
        "/api/assistant/action",
        json={
            "action_type": "add_application",
            "payload": {
                "company_name": "OpenAI",
                "job_title": "AI Research Engineer",
                "application_status": "Wishlist",
            },
        },
    )
    assert action_resp.status_code == status.HTTP_200_OK
    assert action_resp.json()["success"] is True
