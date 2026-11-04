import asyncio
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from config import settings
from models.schemas import (
    DiscoveredJobResponse,
    DiscoveredJobUpdate,
    IngestJobAlertRequest,
    JobWatcherRunSummary,
    JobWatcherSettings,
    JobWatcherSettingsUpdate,
    JobWatcherStatusResponse,
    MonitoredCompanyCreate,
    MonitoredCompanyResponse,
    MonitoredCompanyUpdate,
)
from services import excel_service, resume_service
from services.job_discovery_service import JobDiscoveryService
from services.scheduler_service import scheduler_instance

logger = logging.getLogger("routes.job_watcher")
router = APIRouter()


@router.get("/status", response_model=JobWatcherStatusResponse)
def get_watcher_status():
    """Retrieve scheduler running status, next run time, and statistics."""
    return scheduler_instance.get_status()


@router.get("/settings", response_model=JobWatcherSettings)
def get_watcher_settings():
    """Get the current AI Job Watcher discovery schedule and filter settings."""
    return scheduler_instance.get_settings()


@router.post("/settings", response_model=JobWatcherSettings)
@router.put("/settings", response_model=JobWatcherSettings)
def update_watcher_settings(payload: JobWatcherSettingsUpdate):
    """Update discovery schedule, target keywords, and notification threshold."""
    updated = scheduler_instance.update_settings(payload.model_dump(exclude_unset=True))
    return updated


@router.get("/companies", response_model=List[MonitoredCompanyResponse])
def get_monitored_companies():
    """List all companies being monitored for new job openings."""
    return excel_service.read_monitored_companies(settings.excel_path)


@router.post("/companies", response_model=MonitoredCompanyResponse, status_code=status.HTTP_201_CREATED)
def add_company_to_monitor(company: MonitoredCompanyCreate):
    """Add a new company to the monitoring list."""
    try:
        return excel_service.add_monitored_company(settings.excel_path, company.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/companies/{company_id}", response_model=MonitoredCompanyResponse)
def update_monitored_company(company_id: str, updates: MonitoredCompanyUpdate):
    """Update keywords, career URL, or toggle monitoring for a company."""
    updated = excel_service.update_monitored_company(
        settings.excel_path, company_id, updates.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")
    return updated


@router.delete("/companies/{company_id}")
def delete_monitored_company(company_id: str):
    """Remove a company from the monitoring list."""
    success = excel_service.delete_monitored_company(settings.excel_path, company_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")
    return {"success": True, "message": "Company removed from monitoring."}


@router.post("/companies/sync")
def sync_companies_from_applications():
    """Import and synchronize unique companies from the Applications sheet into CompanyMonitoring."""
    result = excel_service.sync_companies_from_applications(settings.excel_path)
    return {
        "success": True,
        "message": f"Successfully synchronized. Added {result['added_count']} new companies. Total monitored: {result['total_monitored']}.",
        "added_count": result["added_count"],
        "total_monitored": result["total_monitored"],
    }


@router.get("/jobs", response_model=List[DiscoveredJobResponse])
def get_discovered_jobs(
    search: Optional[str] = Query(None, description="Search by title, company, or description"),
    company: Optional[str] = Query(None, description="Filter by company name"),
    min_score: Optional[float] = Query(None, description="Filter by minimum match score"),
    is_new: Optional[bool] = Query(None, description="Filter new unreviewed jobs"),
    is_applied: Optional[bool] = Query(None, description="Filter jobs already added to applications"),
    source: Optional[str] = Query(None, description="Filter by discovery source"),
):
    """Retrieve discovered job openings with filtering."""
    return excel_service.read_discovered_jobs(
        settings.excel_path,
        search=search,
        company=company,
        min_score=min_score,
        is_new=is_new,
        is_applied=is_applied,
        source=source,
    )


@router.get("/jobs/{job_id}", response_model=DiscoveredJobResponse)
def get_discovered_job(job_id: str):
    """Get single discovered job by ID."""
    job = excel_service.get_discovered_job_by_id(settings.excel_path, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered job not found.")
    return job


@router.patch("/jobs/{job_id}", response_model=DiscoveredJobResponse)
def update_discovered_job(job_id: str, updates: DiscoveredJobUpdate):
    """Update status or score of a discovered job."""
    updated = excel_service.update_discovered_job(
        settings.excel_path, job_id, updates.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered job not found.")
    return updated


@router.delete("/jobs/{job_id}")
def dismiss_discovered_job(job_id: str):
    """Dismiss or delete a discovered job."""
    success = excel_service.delete_discovered_job(settings.excel_path, job_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered job not found.")
    return {"success": True, "message": "Discovered job dismissed."}


@router.post("/jobs/{job_id}/apply")
def convert_discovered_job_to_application(
    job_id: str,
    status_val: str = Query("Wishlist", description="Initial application status"),
    notes: Optional[str] = Query(None, description="Optional notes"),
):
    """Convert discovered job into an application in the tracker and mark as applied."""
    try:
        app = excel_service.convert_discovered_to_application(
            settings.excel_path, job_id, status=status_val, notes=notes
        )
        return {
            "success": True,
            "message": f"Successfully created application for '{app.get('job_title')}' at '{app.get('company_name')}'.",
            "application": app,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/jobs/{job_id}/analyze")
def analyze_discovered_job(
    job_id: str,
    resume_id: Optional[str] = Query(None, description="Optional specific resume ID"),
):
    """Re-evaluate match score and missing skills for this discovered job against a resume."""
    job = excel_service.get_discovered_job_by_id(settings.excel_path, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered job not found.")

    resume_text = ""
    try:
        if resume_id:
            resume_text = resume_service.get_resume_text(resume_id, settings.resume_dir)
        else:
            resumes = resume_service.get_all_resumes(settings.resume_dir)
            if resumes:
                resume_text = resume_service.get_resume_text(resumes[0]["resume_id"], settings.resume_dir)
    except Exception as e:
        logger.warning(f"Failed to fetch resume text: {e}")

    discovery_svc = JobDiscoveryService()
    desc = job.get("description") or job.get("job_title") or ""
    match_eval = discovery_svc.evaluate_match_with_groq(desc, resume_text)

    updates = {
        "match_score": match_eval.get("overall_compatibility_score", 0.0),
        "matched_skills": match_eval.get("matched_skills", []),
        "missing_skills": match_eval.get("missing_skills", []),
    }
    updated_job = excel_service.update_discovered_job(settings.excel_path, job_id, updates)

    return {
        "job": updated_job,
        "evaluation": match_eval,
    }


@router.post("/run")
async def trigger_discovery_now(background_tasks: BackgroundTasks, wait_for_result: bool = Query(True)):
    """Trigger job discovery run immediately."""
    status_info = scheduler_instance.get_status()
    if status_info.get("is_discovering_now"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job discovery is already currently running. Please check status.",
        )

    if wait_for_result:
        try:
            summary = await scheduler_instance.run_discovery(is_manual=True)
            return summary
        except Exception as e:
            logger.error(f"Error during discovery execution: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    else:
        background_tasks.add_task(scheduler_instance.run_discovery, is_manual=True)
        return {
            "status": "started",
            "message": "AI Job Discovery run has been started in the background.",
        }


@router.get("/runs", response_model=List[JobWatcherRunSummary])
def get_run_history():
    """Retrieve history of past automated or manual discovery runs."""
    return scheduler_instance.get_history()


@router.post("/ingest-alert")
def ingest_job_alert(payload: IngestJobAlertRequest):
    """
    Ingest user-configured LinkedIn job alert emails or notification alert text.
    Complies fully with LinkedIn policies (no credentials, no web session scraping, pure text parsing).
    """
    if not payload.alert_text or not payload.alert_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alert text cannot be empty.")

    discovery_svc = JobDiscoveryService()
    parsed_jobs = discovery_svc.alert_adapter.parse_alert_text(payload.alert_text, source=payload.source or "LinkedIn Job Alert")

    if not parsed_jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract any job links or titles from the provided alert text. Please ensure it contains job URLs or titles.",
        )

    # Resume text
    resume_text = ""
    try:
        if payload.resume_id:
            resume_text = resume_service.get_resume_text(payload.resume_id, settings.resume_dir)
        else:
            all_resumes = resume_service.get_all_resumes(settings.resume_dir)
            if all_resumes:
                resume_text = resume_service.get_resume_text(all_resumes[0]["resume_id"], settings.resume_dir)
    except Exception:
        pass

    saved_jobs = []
    for rj in parsed_jobs:
        match_eval = discovery_svc.evaluate_match_with_groq(rj.get("description", ""), resume_text)
        rj["match_score"] = match_eval.get("overall_compatibility_score", 0.0)
        rj["matched_skills"] = match_eval.get("matched_skills", [])
        rj["missing_skills"] = match_eval.get("missing_skills", [])
        saved = excel_service.save_discovered_job(settings.excel_path, rj)
        saved_jobs.append(saved)

    return {
        "success": True,
        "message": f"Successfully parsed and saved {len(saved_jobs)} jobs from alert text.",
        "jobs": saved_jobs,
    }
