import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from config import settings
from models.schemas import FollowUpCreate, FollowUpResponse, FollowUpUpdate
from services import excel_service

logger = logging.getLogger("routes.followups")
router = APIRouter()


@router.get("", response_model=List[FollowUpResponse])
@router.get("/", response_model=List[FollowUpResponse], include_in_schema=False)
def list_followups(
    application_id: Optional[str] = Query(None, description="Filter by application ID"),
    completed: Optional[bool] = Query(None, description="Filter by completion status"),
):
    """List all follow-up reminders with optional filtering."""
    all_followups = excel_service.read_followups(settings.excel_path)

    if application_id is not None:
        all_followups = [f for f in all_followups if str(f.get("application_id")) == str(application_id)]

    if completed is not None:
        all_followups = [f for f in all_followups if bool(f.get("completed")) == completed]

    return all_followups


@router.get("/{followup_id}", response_model=FollowUpResponse)
def get_followup(followup_id: str):
    """Retrieve single follow-up reminder."""
    all_followups = excel_service.read_followups(settings.excel_path)
    for f in all_followups:
        if str(f.get("followup_id")) == str(followup_id):
            return f
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Follow-up with ID '{followup_id}' not found.",
    )


@router.post("", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_followup(payload: FollowUpCreate):
    """Create a new follow-up reminder."""
    created = excel_service.add_followup(settings.excel_path, payload.model_dump())
    return created


@router.put("/{followup_id}", response_model=FollowUpResponse)
def update_followup(followup_id: str, payload: FollowUpUpdate):
    """Update follow-up reminder fields."""
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = excel_service.update_followup(settings.excel_path, followup_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID '{followup_id}' not found.",
        )
    return updated


@router.delete("/{followup_id}", status_code=status.HTTP_200_OK)
def delete_followup(followup_id: str):
    """Delete a follow-up reminder."""
    deleted = excel_service.delete_followup(settings.excel_path, followup_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID '{followup_id}' not found.",
        )
    return {"message": "Follow-up deleted successfully", "followup_id": followup_id}
