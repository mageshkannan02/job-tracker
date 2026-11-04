import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from config import settings
from models.schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStatus,
    ApplicationUpdate,
    StatusHistoryResponse,
    StatusUpdate,
)
from services import excel_service

logger = logging.getLogger("routes.applications")
router = APIRouter()


@router.get("", response_model=List[ApplicationResponse])
@router.get("/", response_model=List[ApplicationResponse], include_in_schema=False)
def list_applications(
    search: Optional[str] = Query(None, description="Search term matching company, title, or skills"),
    status: Optional[ApplicationStatus] = Query(None, description="Filter by application status"),
    location: Optional[str] = Query(None, description="Filter by location (case-insensitive substring)"),
    is_favorite: Optional[bool] = Query(None, description="Filter by favorite / high priority status"),
    sort_by: Optional[str] = Query("created_at", description="Field to sort by (e.g. created_at, date_applied, match_score)"),
    sort_dir: Optional[str] = Query("desc", description="Sort direction: 'asc' or 'desc'"),
):
    """List applications with optional search, status/location filters, favorite filter, and sorting."""
    apps = excel_service.read_applications(settings.excel_path)

    # Favorite filter
    if is_favorite is not None:
        apps = [a for a in apps if bool(a.get("is_favorite", False)) == is_favorite]

    # Search filter
    if search:
        s_lower = search.strip().lower()
        filtered = []
        for app in apps:
            company = str(app.get("company_name") or "").lower()
            title = str(app.get("job_title") or "").lower()
            notes = str(app.get("notes") or "").lower()
            skills = " ".join(app.get("required_skills") or []).lower()
            if s_lower in company or s_lower in title or s_lower in notes or s_lower in skills:
                filtered.append(app)
        apps = filtered

    # Status filter
    if status:
        target_status = status.value if hasattr(status, "value") else str(status)
        apps = [a for a in apps if str(a.get("application_status") or "").lower() == target_status.lower()]

    # Location filter
    if location:
        loc_lower = location.strip().lower()
        apps = [a for a in apps if loc_lower in str(a.get("location") or "").lower()]

    # Sort
    reverse = (sort_dir or "desc").lower() == "desc"
    field = sort_by or "created_at"

    def sort_key(item):
        val = item.get(field)
        if val is None:
            return "" if not reverse else chr(0)
        return str(val)

    apps.sort(key=sort_key, reverse=reverse)
    return apps


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: str):
    """Get single application by ID."""
    app = excel_service.get_application_by_id(settings.excel_path, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    return app


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_application(payload: ApplicationCreate):
    """Create a new application."""
    data = payload.model_dump()
    try:
        new_app = excel_service.add_application(settings.excel_path, data)
        return new_app
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating application: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save application.")


@router.put("/{application_id}", response_model=ApplicationResponse)
def update_application(application_id: str, payload: ApplicationUpdate):
    """Update existing application fields."""
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = excel_service.update_application(settings.excel_path, application_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    return updated


@router.delete("/{application_id}", status_code=status.HTTP_200_OK)
def delete_application(application_id: str):
    """Delete application by ID."""
    deleted = excel_service.delete_application(settings.excel_path, application_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    return {"message": "Application deleted successfully", "application_id": application_id}


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
def update_status(application_id: str, payload: StatusUpdate):
    """Update application status and log into status history."""
    existing_app = excel_service.get_application_by_id(settings.excel_path, application_id)
    old_status = str(existing_app.get("application_status") or "") if existing_app else "Unknown"

    new_status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)
    updated = excel_service.update_status(
        settings.excel_path,
        application_id,
        new_status,
        notes=payload.notes or "",
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )

    # Trigger in-app & email notification if stage changed
    if old_status != new_status:
        try:
            from services import notification_service
            notification_service.handle_status_change(updated, old_status, new_status, settings.excel_path)
        except Exception as ne:
            logger.warning(f"Could not trigger status change notification: {ne}")

    return updated


@router.get("/{application_id}/history", response_model=List[StatusHistoryResponse])
def get_application_history(application_id: str):
    """Get status change history for an application."""
    app = excel_service.get_application_by_id(settings.excel_path, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    history = excel_service.read_status_history(settings.excel_path, app_id=application_id)
    return history


@router.patch("/{application_id}/favorite", response_model=ApplicationResponse)
def toggle_favorite(
    application_id: str,
    is_favorite: Optional[bool] = Query(None, description="Set favorite state directly or toggle if omitted"),
):
    """Toggle or set favorite / high-priority status for an application."""
    app = excel_service.get_application_by_id(settings.excel_path, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    current_fav = bool(app.get("is_favorite", False))
    new_val = is_favorite if is_favorite is not None else not current_fav
    updated = excel_service.update_application(settings.excel_path, application_id, {"is_favorite": new_val})
    return updated


@router.post("/company-favorite")
def toggle_company_favorite(payload: Dict[str, Any]):
    """Mark all applications of a company as favorite/high priority or remove favorite."""
    company_name = str(payload.get("company_name", "")).strip()
    is_favorite = bool(payload.get("is_favorite", True))
    if not company_name:
        raise HTTPException(status_code=400, detail="company_name is required")

    apps = excel_service.read_applications(settings.excel_path)
    matched = [a for a in apps if str(a.get("company_name", "")).strip().lower() == company_name.lower()]
    for a in matched:
        excel_service.update_application(settings.excel_path, a["application_id"], {"is_favorite": is_favorite})

    return {
        "company_name": company_name,
        "is_favorite": is_favorite,
        "count_updated": len(matched),
    }
