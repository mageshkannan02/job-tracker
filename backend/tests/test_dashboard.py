from datetime import date, timedelta
from fastapi import status


def test_dashboard_stats_empty(client):
    """Verify stats on empty dataset."""
    response = client.get("/api/dashboard/stats")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 0
    assert data["interview_rate"] == 0.0
    assert data["offer_rate"] == 0.0
    assert data["rejection_rate"] == 0.0
    assert data["response_rate"] == 0.0
    assert data["avg_time_to_response"] == 0.0


def test_dashboard_stats_and_charts_calculated(client):
    """Verify stats and charts with varied realistic application states."""
    today = date.today()
    d_applied = (today - timedelta(days=10)).isoformat()

    apps = [
        {
            "company_name": "Alphabet",
            "job_title": "Backend Software Engineer",
            "location": "Mountain View, CA",
            "application_status": "Interview",
            "date_applied": d_applied,
        },
        {
            "company_name": "Alphabet",
            "job_title": "Systems Engineer",
            "location": "New York, NY",
            "application_status": "Offer",
            "date_applied": d_applied,
        },
        {
            "company_name": "Netflix",
            "job_title": "Senior Data Platform Engineer",
            "location": "Los Gatos, CA",
            "application_status": "Rejected",
            "date_applied": d_applied,
        },
        {
            "company_name": "Apple",
            "job_title": "CoreOS Engineer",
            "location": "Cupertino, CA",
            "application_status": "Applied",
            "date_applied": d_applied,
        },
        {
            "company_name": "Amazon",
            "job_title": "Cloud Architect",
            "location": "Seattle, WA",
            "application_status": "Wishlist",
        },
    ]

    for app in apps:
        resp = client.post("/api/applications", json=app)
        assert resp.status_code == 201

    # Fetch stats
    stats_resp = client.get("/api/dashboard/stats")
    assert stats_resp.status_code == status.HTTP_200_OK
    stats = stats_resp.json()

    assert stats["total"] == 5
    assert stats["by_status"]["Interview"] == 1
    assert stats["by_status"]["Offer"] == 1
    assert stats["by_status"]["Rejected"] == 1
    assert stats["by_status"]["Applied"] == 1
    assert stats["by_status"]["Wishlist"] == 1

    # Applied or further: 5 - 1 (Wishlist) = 4
    # Interview rate (Interview + Offer) = 2 / 4 = 50.0%
    assert stats["interview_rate"] == 50.0
    # Offer rate (Offer) = 1 / 4 = 25.0%
    assert stats["offer_rate"] == 25.0
    # Rejection rate = 1 / 4 = 25.0%
    assert stats["rejection_rate"] == 25.0
    # Response rate (Interview + Offer + Rejected) = 3 / 4 = 75.0%
    assert stats["response_rate"] == 75.0

    # Top companies: Alphabet should be #1 with 2 applications
    assert len(stats["top_companies"]) > 0
    assert stats["top_companies"][0]["company"] == "Alphabet"
    assert stats["top_companies"][0]["count"] == 2

    # Fetch charts endpoint
    charts_resp = client.get("/api/dashboard/charts")
    assert charts_resp.status_code == status.HTTP_200_OK
    charts = charts_resp.json()

    assert "status_distribution" in charts
    assert isinstance(charts["status_distribution"], list)
    status_map = {item["status"]: item["count"] for item in charts["status_distribution"]}
    assert status_map["Offer"] == 1

    assert "monthly_trends" in charts
    assert len(charts["monthly_trends"]) == 12

    assert "weekly_activity" in charts
    assert len(charts["weekly_activity"]) == 8

    assert "top_companies" in charts
    assert "top_locations" in charts
    assert charts["metrics"]["total_applications"] == 5


def test_dashboard_date_range_filter(client):
    """Verify stats and charts respect custom date ranges."""
    today = date.today()
    past_30 = (today - timedelta(days=30)).isoformat()
    past_10 = (today - timedelta(days=10)).isoformat()
    past_2 = (today - timedelta(days=2)).isoformat()

    client.post(
        "/api/applications",
        json={
            "company_name": "OldCo",
            "job_title": "Old Dev",
            "application_status": "Applied",
            "date_applied": past_30,
        },
    )
    client.post(
        "/api/applications",
        json={
            "company_name": "MidCo",
            "job_title": "Mid Dev",
            "application_status": "Interview",
            "date_applied": past_10,
        },
    )
    client.post(
        "/api/applications",
        json={
            "company_name": "NewCo",
            "job_title": "New Dev",
            "application_status": "Offer",
            "date_applied": past_2,
        },
    )

    # Filter to only last 5 days
    start = (today - timedelta(days=5)).isoformat()
    end = today.isoformat()
    resp = client.get(f"/api/dashboard/stats?start_date={start}&end_date={end}")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total"] == 1
    assert stats["by_status"]["Offer"] == 1
    assert stats["by_status"]["Applied"] == 0

    charts_resp = client.get(f"/api/dashboard/charts?start_date={start}&end_date={end}")
    assert charts_resp.status_code == 200
    charts = charts_resp.json()
    assert charts["metrics"]["total_applications"] == 1
