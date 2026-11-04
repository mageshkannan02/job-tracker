import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from config import settings
from services import excel_service

logger = logging.getLogger("routes.settings")
router = APIRouter()

SCHEMA_VERSION = "1.0.0"


@router.get("")
@router.get("/", include_in_schema=False)
def get_user_settings() -> Dict[str, Any]:
    """Retrieve application settings and current storage schema version."""
    settings_data = excel_service.get_settings(settings.excel_path)
    return {
        "schema_version": SCHEMA_VERSION,
        "excel_path": str(settings.excel_path),
        "settings": settings_data,
    }


@router.post("")
@router.post("/", include_in_schema=False)
@router.put("")
@router.put("/", include_in_schema=False)
def update_user_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert application configuration settings in Excel."""
    updated = excel_service.update_settings(settings.excel_path, payload)
    return {
        "schema_version": SCHEMA_VERSION,
        "message": "Settings updated successfully",
        "settings": updated,
    }


@router.post("/clear-data")
def clear_all_applications():
    """Clear all applications, history, follow-ups, and analysis for resetting data."""
    # Reinitialize a clean workbook
    if settings.excel_path.exists():
        excel_service.backup_workbook(settings.excel_path)
    excel_service.initialize_workbook(settings.excel_path, force_reset=True)
    return {"success": True, "message": "All application records have been cleared."}


@router.get("/export")
@router.get("/export/excel")
def export_excel_database():
    """Download the underlying Excel database file."""
    path = excel_service.export_data(settings.excel_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Excel database file not found.",
        )
    return FileResponse(
        path=str(path),
        filename="job_tracker_database.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
