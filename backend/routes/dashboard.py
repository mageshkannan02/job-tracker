import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Query

from config import settings
from models.schemas import DashboardStats
from services import excel_service

logger = logging.getLogger("routes.dashboard")
router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Retrieve summarized statistics across all applications with optional date filtering."""
    stats = excel_service.get_dashboard_stats(
        settings.excel_path, start_date=start_date, end_date=end_date
    )
    return stats


@router.get("/charts")
def get_charts_data(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """Retrieve formatted data optimized for dashboard charting components with optional date filtering."""
    stats = excel_service.get_dashboard_stats(
        settings.excel_path, start_date=start_date, end_date=end_date
    )

    # Format status distribution as list of objects for frontend chart libraries (Recharts, Chart.js, etc.)
    status_distribution = [
        {"status": k, "count": v} for k, v in stats.get("by_status", {}).items()
    ]

    return {
        "status_distribution": status_distribution,
        "monthly_trends": stats.get("applications_by_month", []),
        "weekly_activity": stats.get("applications_by_week", []),
        "top_companies": stats.get("top_companies", []),
        "top_locations": stats.get("top_locations", []),
        "metrics": {
            "interview_rate": stats.get("interview_rate", 0.0),
            "offer_rate": stats.get("offer_rate", 0.0),
            "rejection_rate": stats.get("rejection_rate", 0.0),
            "response_rate": stats.get("response_rate", 0.0),
            "avg_time_to_response": stats.get("avg_time_to_response", 0.0),
            "total_applications": stats.get("total", 0),
        },
    }
