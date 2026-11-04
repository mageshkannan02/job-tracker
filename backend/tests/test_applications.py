from fastapi import status


def test_list_applications_empty(client):
    """Verify listing applications when store is empty."""
    response = client.get("/api/applications")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_create_application_success(client, sample_application_data):
    """Verify application creation returns 201 and persists."""
    response = client.post("/api/applications", json=sample_application_data)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "application_id" in data
    assert data["company_name"] == sample_application_data["company_name"]
    assert data["job_title"] == sample_application_data["job_title"]
    assert data["required_skills"] == sample_application_data["required_skills"]

    # Verify listing includes it
    list_resp = client.get("/api/applications")
    assert list_resp.status_code == status.HTTP_200_OK
    assert len(list_resp.json()) == 1


def test_create_duplicate_application(client, sample_application_data):
    """Verify creating a duplicate application returns 409 Conflict."""
    first = client.post("/api/applications", json=sample_application_data)
    assert first.status_code == status.HTTP_201_CREATED

    duplicate = client.post("/api/applications", json=sample_application_data)
    assert duplicate.status_code == status.HTTP_409_CONFLICT
    assert "already exists" in duplicate.json()["detail"]


def test_get_application(client, sample_application_data):
    """Verify retrieving application by ID, and 404 for unknown ID."""
    created = client.post("/api/applications", json=sample_application_data).json()
    app_id = created["application_id"]

    response = client.get(f"/api/applications/{app_id}")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["application_id"] == app_id

    # 404 for missing
    missing = client.get("/api/applications/non-existent-id")
    assert missing.status_code == status.HTTP_404_NOT_FOUND


def test_update_application(client, sample_application_data):
    """Verify PUT update endpoint."""
    created = client.post("/api/applications", json=sample_application_data).json()
    app_id = created["application_id"]

    update_payload = {
        "job_title": "Lead Backend Architect",
        "salary_range": "$200,000 - $240,000",
        "notes": "Spoke with VP of Engineering.",
    }
    response = client.put(f"/api/applications/{app_id}", json=update_payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["job_title"] == "Lead Backend Architect"
    assert data["salary_range"] == "$200,000 - $240,000"

    # Non-existent
    missing = client.put("/api/applications/unknown", json={"job_title": "Test"})
    assert missing.status_code == status.HTTP_404_NOT_FOUND


def test_delete_application(client, sample_application_data):
    """Verify DELETE endpoint."""
    created = client.post("/api/applications", json=sample_application_data).json()
    app_id = created["application_id"]

    response = client.delete(f"/api/applications/{app_id}")
    assert response.status_code == status.HTTP_200_OK

    # Subsequent GET returns 404
    get_resp = client.get(f"/api/applications/{app_id}")
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND

    # Repeat delete returns 404
    rep_delete = client.delete(f"/api/applications/{app_id}")
    assert rep_delete.status_code == status.HTTP_404_NOT_FOUND


def test_patch_application_status(client, sample_application_data):
    """Verify status update and status history."""
    created = client.post("/api/applications", json=sample_application_data).json()
    app_id = created["application_id"]

    patch_payload = {
        "status": "Interview",
        "notes": "Passed initial screening phone call.",
    }
    response = client.patch(f"/api/applications/{app_id}/status", json=patch_payload)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["application_status"] == "Interview"

    # Verify history
    hist_resp = client.get(f"/api/applications/{app_id}/history")
    assert hist_resp.status_code == status.HTTP_200_OK
    history = hist_resp.json()
    assert len(history) == 1
    assert history[0]["previous_status"] == "Applied"
    assert history[0]["new_status"] == "Interview"


def test_filter_and_search_applications(client):
    """Verify searching and filtering applications."""
    app1 = {
        "company_name": "Google",
        "job_title": "Site Reliability Engineer",
        "location": "Sunnyvale, CA",
        "application_status": "Applied",
        "required_skills": ["Go", "Kubernetes", "Linux"],
    }
    app2 = {
        "company_name": "Meta",
        "job_title": "Product Engineer",
        "location": "Remote",
        "application_status": "Interview",
        "required_skills": ["React", "Python", "GraphQL"],
    }
    app3 = {
        "company_name": "Stripe",
        "job_title": "Backend Infrastructure Engineer",
        "location": "Seattle, WA",
        "application_status": "Offer",
        "required_skills": ["Ruby", "Go", "Distributed Systems"],
    }

    client.post("/api/applications", json=app1)
    client.post("/api/applications", json=app2)
    client.post("/api/applications", json=app3)

    # Search by keyword
    search_resp = client.get("/api/applications?search=Reliability")
    assert search_resp.status_code == 200
    assert len(search_resp.json()) == 1
    assert search_resp.json()[0]["company_name"] == "Google"

    # Filter by status
    status_resp = client.get("/api/applications?status=Interview")
    assert status_resp.status_code == 200
    assert len(status_resp.json()) == 1
    assert status_resp.json()[0]["company_name"] == "Meta"

    # Filter by location
    loc_resp = client.get("/api/applications?location=remote")
    assert loc_resp.status_code == 200
    assert len(loc_resp.json()) == 1
    assert loc_resp.json()[0]["company_name"] == "Meta"


def test_application_favorite_toggle_and_filter(client, sample_application_data):
    """Verify favoriting/high-priority toggle, filtering, and company-level favorite."""
    created = client.post("/api/applications", json=sample_application_data).json()
    app_id = created["application_id"]
    assert created.get("is_favorite") is False

    # Toggle to favorite
    fav_resp = client.patch(f"/api/applications/{app_id}/favorite?is_favorite=true")
    assert fav_resp.status_code == 200
    assert fav_resp.json()["is_favorite"] is True

    # Filter by favorite=true
    fav_list = client.get("/api/applications?is_favorite=true").json()
    assert len(fav_list) == 1
    assert fav_list[0]["application_id"] == app_id

    # Filter by favorite=false
    non_fav_list = client.get("/api/applications?is_favorite=false").json()
    assert len(non_fav_list) == 0

    # Toggle company favorite
    comp_resp = client.post(
        "/api/applications/company-favorite",
        json={"company_name": sample_application_data["company_name"], "is_favorite": False},
    )
    assert comp_resp.status_code == 200
    assert comp_resp.json()["count_updated"] == 1

    # Verify is_favorite is now False
    app_after = client.get(f"/api/applications/{app_id}").json()
    assert app_after["is_favorite"] is False
