import logging
from fastapi import APIRouter, HTTPException, status

from config import settings
from models.schemas import ApplicationCreate, ApplicationResponse, ExtractedJob, ExtractJobRequest
from pydantic import BaseModel
from services import excel_service, extractor_service
from services.groq_service import GroqService

logger = logging.getLogger("routes.extractor")
router = APIRouter()


class ExtractTextRequest(BaseModel):
    text: str


@router.post("/extract-text", response_model=ExtractedJob)
async def extract_job_from_text(request: ExtractTextRequest):
    """Extract structured job posting details directly from raw text."""
    if not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description text cannot be empty.",
        )
    groq_service = GroqService(api_key=settings.groq_api_key, model=settings.groq_model)
    try:
        extracted_dict = groq_service.extract_job_details(request.text, "manual://pasted-text")
        return extracted_dict
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(ve))
    except Exception as e:
        logger.error(f"Groq raw text extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI job parsing failed: {str(e)}",
        )


@router.post("/extract", response_model=ExtractedJob)
async def extract_job(request: ExtractJobRequest):
    """Extract structured job posting details from a public URL using web scraping and Groq AI."""
    try:
        validated_url = extractor_service.validate_url(request.url)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    try:
        raw_text, method = await extractor_service.extract_job_text(validated_url)
        logger.info(f"Extracted job text from {validated_url} using method: {method}")
    except Exception as e:
        logger.error(f"Failed to fetch content from URL {request.url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to scrape job page content: {str(e)}",
        )

    groq_service = GroqService(api_key=settings.groq_api_key, model=settings.groq_model)
    try:
        extracted_dict = groq_service.extract_job_details(raw_text, validated_url)
        return extracted_dict
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(ve))
    except Exception as e:
        logger.error(f"Groq extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI job parsing failed: {str(e)}",
        )


@router.post("/save", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def save_extracted_job(payload: ApplicationCreate):
    """Save an extracted job posting directly into tracked applications."""
    try:
        new_app = excel_service.add_application(settings.excel_path, payload.model_dump())
        return new_app
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ve))
    except Exception as e:
        logger.error(f"Error saving extracted job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save extracted application.",
        )
