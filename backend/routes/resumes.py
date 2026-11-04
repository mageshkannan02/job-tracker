import logging
from typing import Any, Dict, List
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from config import settings
from models.schemas import ResumeMetadata
from services import resume_service

logger = logging.getLogger("routes.resumes")
router = APIRouter()


@router.post("/upload", response_model=ResumeMetadata, status_code=status.HTTP_201_CREATED)
async def upload_resume(file: UploadFile = File(...)):
    """Upload a resume file (PDF or DOCX, max 10MB) and extract its metadata."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided with upload.",
        )

    # Read content
    try:
        content = await file.read()
    except Exception as e:
        logger.error(f"Error reading uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file.",
        )

    try:
        meta = resume_service.save_resume(content, file.filename, settings.resume_dir)
        return meta
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to save resume: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error saving resume file.",
        )


@router.get("", response_model=List[ResumeMetadata])
@router.get("/", response_model=List[ResumeMetadata], include_in_schema=False)
def list_resumes():
    """List all uploaded resumes and their metadata."""
    return resume_service.list_resumes(settings.resume_dir)


@router.get("/{resume_id}", response_model=ResumeMetadata)
def get_resume(resume_id: str):
    """Get metadata for a specific resume."""
    resumes = resume_service.list_resumes(settings.resume_dir)
    for r in resumes:
        if r.get("resume_id") == resume_id:
            return r
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Resume with ID '{resume_id}' not found.",
    )


@router.get("/{resume_id}/text")
def get_resume_text_content(resume_id: str) -> Dict[str, Any]:
    """Retrieve full parsed text content extracted from a resume."""
    try:
        text = resume_service.get_resume_text(resume_id, settings.resume_dir)
        return {"resume_id": resume_id, "text": text}
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume with ID '{resume_id}' not found.",
        )
    except Exception as e:
        logger.error(f"Failed to extract text from resume {resume_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not extract text: {str(e)}",
        )


@router.delete("/{resume_id}", status_code=status.HTTP_200_OK)
def delete_resume_endpoint(resume_id: str):
    """Delete a resume by ID."""
    deleted = resume_service.delete_resume(resume_id, settings.resume_dir)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume with ID '{resume_id}' not found.",
        )
    return {"message": "Resume deleted successfully", "resume_id": resume_id}
