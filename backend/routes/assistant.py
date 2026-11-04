import logging
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status

from config import settings
from models.schemas import ActionRequest, ChatRequest
from services import excel_service
from services import ai_excel_assistant
from services.groq_service import GroqService

logger = logging.getLogger("routes.assistant")
router = APIRouter()


def _extract_recent_context() -> Dict[str, Any]:
    """Compile application statistics and recent entries for assistant context."""
    stats = excel_service.get_dashboard_stats(settings.excel_path)
    all_apps = excel_service.read_applications(settings.excel_path)

    # Sort recent applications
    sorted_apps = sorted(
        all_apps,
        key=lambda a: str(a.get("created_at") or a.get("date_applied") or ""),
        reverse=True,
    )
    recent_summary = [
        {
            "application_id": a.get("application_id"),
            "company_name": a.get("company_name"),
            "job_title": a.get("job_title"),
            "status": a.get("application_status"),
            "date_applied": a.get("date_applied"),
            "match_score": a.get("match_score"),
        }
        for a in sorted_apps[:8]
    ]

    return {
        "total_tracked": stats.get("total", 0),
        "status_breakdown": stats.get("by_status", {}),
        "metrics": {
            "interview_rate": f"{stats.get('interview_rate', 0)}%",
            "offer_rate": f"{stats.get('offer_rate', 0)}%",
            "rejection_rate": f"{stats.get('rejection_rate', 0)}%",
            "response_rate": f"{stats.get('response_rate', 0)}%",
            "avg_time_to_response_days": stats.get("avg_time_to_response", 0),
        },
        "recent_applications": recent_summary,
    }


@router.post("/chat")
def assistant_chat(request: ChatRequest):
    """Smart AI assistant with workspace context awareness, automated Excel reading & writing, and tool routing."""
    context = _extract_recent_context()
    groq = GroqService(api_key=settings.groq_api_key, model=settings.groq_model)
    history_list = [{"role": m.role, "content": m.content} for m in request.history]

    # PRIMARY ROUTE: Direct Natural Language Excel Spreadsheet Operations
    # Supports: Adding new applications, updating statuses, updating notes, creating followups, deleting, and bulk adding.
    excel_result = ai_excel_assistant.extract_excel_intent_and_execute(
        message=request.message,
        history=history_list,
        excel_path=settings.excel_path,
        groq=groq,
    )
    if excel_result:
        return excel_result

    user_msg_lower = request.message.lower()
    tool_used = None
    structured_data = None

    # Tool detection 1: Interview questions
    if any(k in user_msg_lower for k in ("interview question", "interview prep", "questions to prepare")):
        tool_used = "generate_interview_questions"
        # Search if a specific company or role is mentioned
        all_apps = excel_service.read_applications(settings.excel_path)
        matching_app = None
        for app in all_apps:
            comp = str(app.get("company_name") or "").lower()
            title = str(app.get("job_title") or "").lower()
            if comp and comp in user_msg_lower:
                matching_app = app
                break
            if title and title in user_msg_lower:
                matching_app = app
                break

        jd_text = ""
        if matching_app and matching_app.get("job_description"):
            jd_text = f"Role: {matching_app.get('job_title')} at {matching_app.get('company_name')}\n{matching_app.get('job_description')}"
        else:
            jd_text = request.message

        try:
            questions = groq.generate_interview_questions(jd_text)
            structured_data = questions
            # Build assistant summary
            q_formatted = "\n\n".join(
                f"**[{q.get('category', 'Question')}] {q.get('question', '')}**\n- *Focus*: {q.get('key_points', '')}\n- *Strategy*: {q.get('sample_answer_outline', '')}"
                for q in questions[:6]
            )
            response_text = (
                f"Here are targeted interview questions based on your request:\n\n{q_formatted}\n\n"
                "Would you like to practice answers for any of these specific questions?"
            )
            return {"reply": response_text, "response": response_text, "tool_used": tool_used, "data": structured_data}
        except Exception as e:
            logger.warning(f"Failed specialized interview question generation: {e}")

    # Tool detection 2: Follow-up email
    if any(k in user_msg_lower for k in ("follow-up email", "follow up email", "followup email", "draft an email")):
        tool_used = "generate_followup_email"
        all_apps = excel_service.read_applications(settings.excel_path)
        matching_app = None
        for app in all_apps:
            comp = str(app.get("company_name") or "").lower()
            title = str(app.get("job_title") or "").lower()
            if comp and comp in user_msg_lower:
                matching_app = app
                break
            if title and title in user_msg_lower:
                matching_app = app
                break

        app_dict = matching_app or (all_apps[0] if all_apps else {"company_name": "Target Company", "job_title": "Position"})
        try:
            email_text = groq.generate_followup_email(app_dict)
            return {
                "reply": email_text,
                "response": email_text,
                "tool_used": tool_used,
                "data": {"application_id": app_dict.get("application_id")},
            }
        except Exception as e:
            logger.warning(f"Failed specialized followup email generation: {e}")

    # Default: General contextual conversation
    try:
        if groq.api_key:
            chat_resp = groq.chat(request.message, history_list, context)
            return {"reply": chat_resp, "response": chat_resp, "tool_used": None, "data": None}
        else:
            # Fallback when Groq API key is not configured: provide helpful coaching and explain Excel capabilities
            total = context.get("total_tracked", 0)
            metrics = context.get("metrics", {})
            interview_rate = metrics.get("interview_rate", "0%")
            
            fallback_text = (
                f"Hello! I am your **AI Career & Excel Spreadsheet Assistant**.\n\n"
                f"📊 **Current Excel Tracker Summary** (`applications.xlsx`):\n"
                f"- **Total Tracked Applications**: {total}\n"
                f"- **Interview Rate**: {interview_rate}\n\n"
                f"💡 **What I can write directly to your Excel sheet**:\n"
                f"1. **Add new jobs**: *\"Add to excel: Senior Frontend Engineer at Linear, $160k, Applied today\"*\n"
                f"2. **Update status**: *\"Update Google to Interview\"* or *\"Change Netflix to Offer\"*\n"
                f"3. **Add notes**: *\"Add note to Stripe: Completed technical screening with recruiter\"*\n"
                f"4. **Schedule follow-ups**: *\"Add follow-up task for Amazon next Monday: Check in with recruiter\"*\n"
                f"5. **Batch additions**: *\"Add these 3 jobs to Excel: 1. Apple iOS, 2. Figma React, 3. Uber Backend\"*\n\n"
                f"Give me an instruction above, and I will write directly into your spreadsheet!"
            )
            return {"reply": fallback_text, "response": fallback_text, "tool_used": "excel_assistant_guide", "data": context}
    except Exception as e:
        logger.error(f"Assistant chat failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant chat failed: {str(e)}",
        )


@router.post("/action")
def execute_assistant_action(action: ActionRequest):
    """Execute confirmed mutations requested by the user or assistant."""
    action_type = action.action_type.strip().lower()
    payload = action.payload

    if action_type == "update_status":
        app_id = payload.get("application_id")
        new_status = payload.get("status")
        notes = payload.get("notes", "")
        if not app_id or not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing 'application_id' or 'status' in payload.",
            )
        updated = excel_service.update_status(settings.excel_path, app_id, new_status, notes=notes)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
        return {"success": True, "action": "update_status", "result": updated}

    elif action_type == "create_followup":
        app_id = payload.get("application_id")
        task = payload.get("task")
        followup_date = payload.get("followup_date")
        if not app_id or not task or not followup_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing 'application_id', 'task', or 'followup_date' in payload.",
            )
        created = excel_service.add_followup(settings.excel_path, payload)
        return {"success": True, "action": "create_followup", "result": created}

    elif action_type == "add_application":
        if "company_name" not in payload or "job_title" not in payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required 'company_name' or 'job_title' in payload.",
            )
        try:
            created = excel_service.add_application(settings.excel_path, payload)
            return {"success": True, "action": "add_application", "result": created}
        except ValueError as ve:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ve))

    elif action_type == "update_notes":
        app_id = payload.get("application_id")
        notes = payload.get("notes")
        if not app_id or notes is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing 'application_id' or 'notes' in payload.",
            )
        updated = excel_service.update_application(settings.excel_path, app_id, {"notes": notes})
        return {"success": True, "action": "update_notes", "result": updated}

    elif action_type == "delete_application":
        app_id = payload.get("application_id")
        if not app_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing 'application_id' in payload.",
            )
        success = excel_service.delete_application(settings.excel_path, app_id)
        return {"success": success, "action": "delete_application", "result": {"deleted_id": app_id}}

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported action type '{action.action_type}'.",
        )
