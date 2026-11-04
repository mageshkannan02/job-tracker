import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from config import settings
from models.schemas import AnalysisResult, AnalyzeRequest
from services import excel_service, resume_service
from services.groq_service import GroqService

logger = logging.getLogger("routes.analyzer")
router = APIRouter()


@router.post("/analyze", response_model=AnalysisResult)
def analyze_resume(request: AnalyzeRequest):
    """Analyze a resume against a job description or tracked application using Groq AI."""
    # Step 1: Retrieve resume text
    try:
        resume_text = resume_service.get_resume_text(request.resume_id, settings.resume_dir)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume with ID '{request.resume_id}' not found.",
        )
    except Exception as e:
        logger.error(f"Error reading resume text: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read resume content.",
        )

    # Step 2: Determine job description
    target_app = None
    job_description = request.job_description or ""

    if request.application_id:
        target_app = excel_service.get_application_by_id(settings.excel_path, request.application_id)
        if not target_app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application with ID '{request.application_id}' not found.",
            )
        if not job_description:
            job_description = target_app.get("job_description") or ""

    if not job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description is required for analysis (provide either 'job_description' text or an 'application_id' with saved job description).",
        )

    # Step 3: Run AI analysis
    groq = GroqService(api_key=settings.groq_api_key, model=settings.groq_model)
    try:
        analysis_result = groq.analyze_resume_vs_job(resume_text, job_description)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(ve))
    except Exception as e:
        logger.error(f"Groq resume analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume analysis failed: {str(e)}",
        )

    # Step 4: Find resume name
    resume_name = "Resume"
    for r in resume_service.list_resumes(settings.resume_dir):
        if r.get("resume_id") == request.resume_id:
            resume_name = r.get("filename", "Resume")
            break

    # Step 5: Save record into Analysis sheet
    analysis_record = {
        "application_id": request.application_id or "",
        "resume_name": resume_name,
        "match_score": analysis_result.get("match_score", 0.0),
        "matched_skills": analysis_result.get("matched_skills", []),
        "missing_skills": analysis_result.get("missing_skills", []),
        "experience_match": str(analysis_result.get("experience_match", 0.0)),
        "recommendations": analysis_result.get("suggestions", []),
    }
    excel_service.save_analysis(settings.excel_path, analysis_record)

    # Step 6: Update application match_score if application_id is provided
    if request.application_id and target_app:
        try:
            excel_service.update_application(
                settings.excel_path,
                request.application_id,
                {"match_score": analysis_result.get("match_score", 0.0)},
            )
        except Exception as e:
            logger.warning(f"Could not update application match_score: {e}")

    return analysis_result


@router.get("/history", response_model=List[Dict[str, Any]])
def get_history(
    application_id: Optional[str] = Query(None, description="Optional application ID filter"),
):
    """Retrieve saved resume analysis history."""
    return excel_service.get_analysis_history(settings.excel_path, app_id=application_id)


@router.get("/{analysis_id}")
def get_analysis_record(analysis_id: str):
    """Retrieve single analysis record by ID."""
    history = excel_service.get_analysis_history(settings.excel_path)
    for item in history:
        if str(item.get("analysis_id")) == str(analysis_id):
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Analysis record with ID '{analysis_id}' not found.",
    )
