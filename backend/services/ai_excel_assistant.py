import logging
import re
import uuid
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from config import settings
from services import excel_service
from services.groq_service import GroqService

logger = logging.getLogger("ai_excel_assistant")


def extract_excel_intent_and_execute(
    message: str,
    history: List[Dict[str, str]],
    excel_path: str,
    groq: Optional[GroqService] = None,
) -> Optional[Dict[str, Any]]:
    """
    Detect if the user is asking to write, update, query, or delete entries
    in their Excel spreadsheet. If detected, perform the operation directly
    into the Excel file and return a structured result.
    """
    msg_clean = message.strip()
    msg_lower = msg_clean.lower()

    # Read existing applications for matching context
    try:
        existing_apps = excel_service.read_applications(excel_path)
    except Exception as e:
        logger.warning(f"Error reading applications for intent matching: {e}")
        existing_apps = []

    # 1. Check for bulk addition intent (multiple rows)
    bulk_result = _try_handle_bulk_add(msg_clean, msg_lower, excel_path)
    if bulk_result:
        return bulk_result

    # 2. Check for single application addition intent
    add_result = _try_handle_add_application(msg_clean, msg_lower, excel_path, existing_apps)
    if add_result:
        return add_result

    # 3. Check for status update intent
    status_result = _try_handle_status_update(msg_clean, msg_lower, excel_path, existing_apps)
    if status_result:
        return status_result

    # 4. Check for note / detail update intent
    note_result = _try_handle_note_update(msg_clean, msg_lower, excel_path, existing_apps)
    if note_result:
        return note_result

    # 5. Check for follow-up creation intent
    followup_result = _try_handle_followup_creation(msg_clean, msg_lower, excel_path, existing_apps)
    if followup_result:
        return followup_result

    # 6. Check for deletion intent
    delete_result = _try_handle_delete_application(msg_clean, msg_lower, excel_path, existing_apps)
    if delete_result:
        return delete_result

    # 7. Check for spreadsheet inquiry / summary intent
    query_result = _try_handle_excel_summary_query(msg_clean, msg_lower, excel_path, existing_apps)
    if query_result:
        return query_result

    # If Groq is available, ask LLM if this is an Excel action we might have missed with heuristics
    if groq and groq.api_key:
        llm_action_result = _try_llm_excel_action(msg_clean, excel_path, existing_apps, groq)
        if llm_action_result:
            return llm_action_result

    return None


def _try_handle_add_application(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Detect intent to write a new application row into the Excel sheet."""
    # Triggers for adding a job
    add_keywords = [
        "add to excel", "write to excel", "add application", "write application",
        "log application", "track application", "new application", "insert into excel",
        "add job", "log job", "record job", "applied to", "i applied for", "i applied to",
        "add this to my excel", "put this in excel", "save to excel", "record in sheet"
    ]

    has_add_intent = any(k in msg_lower for k in add_keywords) or (
        ("excel" in msg_lower or "sheet" in msg_lower) and any(w in msg_lower for w in ["add", "write", "log", "record", "track"])
    )

    if not has_add_intent:
        return None

    # Parse details from message
    parsed = _parse_application_fields(msg)
    if not parsed.get("company_name") and not parsed.get("job_title"):
        return None

    company = parsed.get("company_name") or "Target Company"
    title = parsed.get("job_title") or "Software Engineer"
    status_val = parsed.get("application_status") or "Applied"
    salary = parsed.get("salary_range") or ""
    work_mode = parsed.get("work_mode") or "Remote"
    location = parsed.get("location") or ""
    notes = parsed.get("notes") or f"Logged via AI Assistant on {datetime.now().strftime('%Y-%m-%d')}"
    job_url = parsed.get("job_url") or ""

    app_payload = {
        "company_name": company,
        "job_title": title,
        "application_status": status_val,
        "salary_range": salary,
        "work_mode": work_mode,
        "location": location,
        "notes": notes,
        "job_url": job_url,
        "date_applied": datetime.now().strftime("%Y-%m-%d"),
        "application_source": "AI Assistant Excel Writer",
    }

    try:
        created = excel_service.add_application(excel_path, app_payload)
        app_id = created.get("application_id")

        salary_line = f"- **Salary**: {salary}\n" if salary else ""
        reply = (
            f"✍️ **Successfully written to Excel sheet (`applications.xlsx`)!**\n\n"
            f"A new row has been added to the **Applications** worksheet:\n"
            f"- **Company**: {company}\n"
            f"- **Position**: {title}\n"
            f"- **Status**: `{status_val}`\n"
            f"{salary_line}"
            f"- **Work Mode**: {work_mode}\n"
            f"- **Date Applied**: {app_payload['date_applied']}\n\n"
            f"The application has been saved and is now actively tracked in your pipeline."
        )

        return {
            "reply": reply,
            "response": reply,
            "excel_modified": True,
            "tool_used": "excel_add_application",
            "excel_action": {
                "action_type": "add_application",
                "sheet_name": "Applications",
                "item_id": app_id,
                "company_name": company,
                "job_title": title,
                "status": status_val,
                "salary": salary,
                "notes": notes,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            },
            "data": created,
        }
    except ValueError as ve:
        # Duplicate or validation error
        reply = f"⚠️ **Could not write to Excel**: {str(ve)}"
        return {
            "reply": reply,
            "response": reply,
            "excel_modified": False,
            "tool_used": "excel_add_application_failed",
            "data": None,
        }
    except Exception as e:
        logger.error(f"Error writing application to Excel: {e}")
        reply = f"❌ An error occurred while writing to the Excel file: {str(e)}"
        return {
            "reply": reply,
            "response": reply,
            "excel_modified": False,
            "tool_used": "excel_error",
            "data": None,
        }


def _try_handle_status_update(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Detect intent to update an application status in Excel."""
    status_keywords = ["interview", "offer", "rejected", "applied", "wishlist", "assessment", "no response"]
    action_keywords = ["update", "change", "mark", "move", "set", "transition", "progress"]

    has_action = any(k in msg_lower for k in action_keywords)
    matched_status = None
    for st in ["interview", "offer", "rejected", "applied", "wishlist", "assessment", "no response"]:
        if st in msg_lower:
            matched_status = st.title().replace(" ", "")
            if matched_status == "NoResponse":
                matched_status = "NoResponse"
            break

    if not has_action or not matched_status:
        return None

    # Find the target company or job in existing apps
    target_app = None
    for app in existing_apps:
        comp = str(app.get("company_name") or "").lower()
        title = str(app.get("job_title") or "").lower()
        if comp and comp in msg_lower:
            target_app = app
            break
        if title and title in msg_lower:
            target_app = app
            break

    if not target_app:
        # If no matching company found, return helpful guide
        return None

    app_id = target_app.get("application_id")
    prev_status = target_app.get("application_status", "Applied")
    company = target_app.get("company_name", "Unknown")
    job_title = target_app.get("job_title", "Position")

    notes = f"Status updated to {matched_status} via AI Assistant"
    try:
        updated = excel_service.update_status(excel_path, app_id, matched_status, notes=notes)

        reply = (
            f"✍️ **Successfully updated Excel sheet (`applications.xlsx`)!**\n\n"
            f"- **Company**: {company}\n"
            f"- **Role**: {job_title}\n"
            f"- **Previous Status**: `{prev_status}`\n"
            f"- **New Status**: `{matched_status}`\n\n"
            f"Both the **Applications** worksheet and the **StatusHistory** audit log have been updated in your spreadsheet."
        )

        return {
            "reply": reply,
            "response": reply,
            "excel_modified": True,
            "tool_used": "excel_update_status",
            "excel_action": {
                "action_type": "update_status",
                "sheet_name": "Applications & StatusHistory",
                "item_id": app_id,
                "company_name": company,
                "job_title": job_title,
                "status": matched_status,
                "notes": notes,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            },
            "data": updated,
        }
    except Exception as e:
        logger.error(f"Error updating status in Excel: {e}")
        return None


def _try_handle_note_update(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Detect intent to append or update notes for a company in Excel."""
    if not any(k in msg_lower for k in ["add note", "update note", "note for", "log note", "write note"]):
        return None

    target_app = None
    for app in existing_apps:
        comp = str(app.get("company_name") or "").lower()
        if comp and comp in msg_lower:
            target_app = app
            break

    if not target_app:
        return None

    # Extract the note content
    note_match = re.search(r'(?:note(?:s)?\s*(?:for|to|:)?\s*[\w\s]+(?:is|:|\-)?\s*)(.+)', msg, re.IGNORECASE)
    note_content = note_match.group(1).strip() if note_match else msg

    app_id = target_app.get("application_id")
    company = target_app.get("company_name")
    existing_notes = str(target_app.get("notes") or "").strip()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    combined_notes = f"{existing_notes}\n[{timestamp}] {note_content}".strip() if existing_notes else f"[{timestamp}] {note_content}"

    try:
        updated = excel_service.update_application(excel_path, app_id, {"notes": combined_notes})
        reply = (
            f"✍️ **Note written to Excel sheet (`applications.xlsx`)!**\n\n"
            f"- **Target Application**: {company} ({target_app.get('job_title')})\n"
            f"- **Note Added**: \"{note_content}\"\n\n"
            f"The **Applications** sheet row has been updated with your new note."
        )

        return {
            "reply": reply,
            "response": reply,
            "excel_modified": True,
            "tool_used": "excel_update_notes",
            "excel_action": {
                "action_type": "update_application",
                "sheet_name": "Applications",
                "item_id": app_id,
                "company_name": company,
                "job_title": target_app.get("job_title"),
                "notes": note_content,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            },
            "data": updated,
        }
    except Exception as e:
        logger.error(f"Error writing note to Excel: {e}")
        return None


def _try_handle_followup_creation(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Detect intent to write a new follow-up row into the FollowUps sheet."""
    followup_triggers = ["follow-up", "follow up", "followup", "schedule reminder", "reminder for", "add task", "remind me"]
    if not any(k in msg_lower for k in followup_triggers):
        return None

    target_app = None
    for app in existing_apps:
        comp = str(app.get("company_name") or "").lower()
        if comp and comp in msg_lower:
            target_app = app
            break

    company = target_app.get("company_name") if target_app else "General"
    app_id = target_app.get("application_id") if target_app else (existing_apps[0].get("application_id") if existing_apps else str(uuid.uuid4()))

    # Calculate date
    target_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    if "tomorrow" in msg_lower:
        target_date = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "next week" in msg_lower or "7 days" in msg_lower:
        target_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    elif "next monday" in msg_lower:
        days_ahead = (0 - date.today().weekday()) % 7
        days_ahead = days_ahead if days_ahead > 0 else 7
        target_date = (date.today() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    task_desc = f"Follow up with {company} regarding application progress"
    # Try to extract specific task if mentioned
    task_match = re.search(r'(?:to|task|reminder|for)?\s*(send\s+[\w\s]+|call\s+[\w\s]+|email\s+[\w\s]+|check\s+[\w\s]+)', msg, re.IGNORECASE)
    if task_match:
        task_desc = task_match.group(1).strip()

    followup_data = {
        "application_id": app_id,
        "task": task_desc,
        "followup_date": target_date,
        "completed": False,
        "notes": f"Created via AI Assistant for {company}",
    }

    try:
        created = excel_service.add_followup(excel_path, followup_data)
        reply = (
            f"✍️ **Follow-up written to Excel sheet (`applications.xlsx`)!**\n\n"
            f"A new task has been recorded in the **FollowUps** worksheet:\n"
            f"- **Target**: {company}\n"
            f"- **Task**: {task_desc}\n"
            f"- **Scheduled Date**: `{target_date}`\n"
            f"- **Status**: Pending\n\n"
            f"This task is now tracked and will notify you when due."
        )

        return {
            "reply": reply,
            "response": reply,
            "excel_modified": True,
            "tool_used": "excel_create_followup",
            "excel_action": {
                "action_type": "create_followup",
                "sheet_name": "FollowUps",
                "item_id": created.get("followup_id"),
                "company_name": company,
                "notes": task_desc,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            },
            "data": created,
        }
    except Exception as e:
        logger.error(f"Error writing followup to Excel: {e}")
        return None


def _try_handle_delete_application(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Detect intent to delete an application row from Excel."""
    if not any(k in msg_lower for k in ["delete application", "remove application", "delete from excel", "remove from sheet", "delete job"]):
        return None

    target_app = None
    for app in existing_apps:
        comp = str(app.get("company_name") or "").lower()
        title = str(app.get("job_title") or "").lower()
        if comp and comp in msg_lower:
            target_app = app
            break
        if title and title in msg_lower:
            target_app = app
            break

    if not target_app:
        return None

    app_id = target_app.get("application_id")
    company = target_app.get("company_name")
    title = target_app.get("job_title")

    try:
        success = excel_service.delete_application(excel_path, app_id)
        if success:
            reply = (
                f"🗑️ **Row deleted from Excel sheet (`applications.xlsx`)!**\n\n"
                f"- **Deleted Entry**: {title} at **{company}**\n"
                f"- **Application ID**: `{app_id}`\n\n"
                f"The row has been safely removed and a backup was created automatically."
            )
            return {
                "reply": reply,
                "response": reply,
                "excel_modified": True,
                "tool_used": "excel_delete_application",
                "excel_action": {
                    "action_type": "delete_application",
                    "sheet_name": "Applications",
                    "item_id": app_id,
                    "company_name": company,
                    "job_title": title,
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                },
                "data": {"deleted_id": app_id},
            }
    except Exception as e:
        logger.error(f"Error deleting from Excel: {e}")
        return None


def _try_handle_bulk_add(
    msg: str, msg_lower: str, excel_path: str
) -> Optional[Dict[str, Any]]:
    """Detect intent to add multiple applications at once to Excel."""
    if not any(k in msg_lower for k in ["add these", "bulk add", "add the following", "multiple jobs", "batch add"]):
        return None

    lines = [l.strip() for l in msg.split("\n") if l.strip()]
    added_apps = []
    errors = []

    for line in lines:
        if not re.search(r'(?:^\d+[\.\)]|^\-|\bat\b|\bfor\b)', line, re.IGNORECASE):
            continue
        parsed = _parse_application_fields(line)
        if parsed.get("company_name") or parsed.get("job_title"):
            payload = {
                "company_name": parsed.get("company_name") or "Target Company",
                "job_title": parsed.get("job_title") or "Software Engineer",
                "application_status": parsed.get("application_status") or "Applied",
                "salary_range": parsed.get("salary_range") or "",
                "work_mode": parsed.get("work_mode") or "Remote",
                "date_applied": datetime.now().strftime("%Y-%m-%d"),
                "application_source": "AI Assistant Bulk Writer",
            }
            try:
                created = excel_service.add_application(excel_path, payload)
                added_apps.append(created)
            except Exception as e:
                errors.append(f"{payload['company_name']}: {str(e)}")

    if not added_apps:
        return None

    summary_list = "\n".join(
        f"- **{a.get('company_name')}** — {a.get('job_title')} (`{a.get('application_status')}`)"
        for a in added_apps
    )
    reply = (
        f"✍️ **Successfully batch-written {len(added_apps)} rows to Excel (`applications.xlsx`)!**\n\n"
        f"{summary_list}\n\n"
        f"All rows are now active and tracked in your spreadsheet."
    )

    return {
        "reply": reply,
        "response": reply,
        "excel_modified": True,
        "tool_used": "excel_bulk_add",
        "excel_action": {
            "action_type": "bulk_add",
            "sheet_name": "Applications",
            "details": {"count": len(added_apps)},
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        },
        "data": added_apps,
    }


def _try_handle_excel_summary_query(
    msg: str, msg_lower: str, excel_path: str, existing_apps: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Answer questions about the contents of the Excel spreadsheet."""
    query_keywords = [
        "what is in my excel", "show excel", "list my applications", "what applications",
        "how many applications", "excel summary", "sheet summary", "how many jobs",
        "my tracked jobs", "what do i have in excel", "show my sheet"
    ]

    if not any(k in msg_lower for k in query_keywords):
        return None

    stats = excel_service.get_dashboard_stats(excel_path)
    total = stats.get("total", len(existing_apps))
    by_status = stats.get("by_status", {})

    status_lines = []
    for st, count in by_status.items():
        if count > 0:
            status_lines.append(f"- **{st}**: {count}")

    status_str = "\n".join(status_lines) if status_lines else "No categorized applications yet."

    recent_apps = sorted(
        existing_apps,
        key=lambda a: str(a.get("created_at") or a.get("date_applied") or ""),
        reverse=True,
    )[:5]

    recent_str = "\n".join(
        f"1. **{a.get('company_name')}** — {a.get('job_title')} (`{a.get('application_status')}`)"
        for a in recent_apps
    ) if recent_apps else "No applications recorded yet."

    reply = (
        f"📊 **Excel Spreadsheet Overview (`applications.xlsx`)**\n\n"
        f"**Total Tracked Roles**: {total}\n\n"
        f"**Breakdown by Pipeline Status**:\n{status_str}\n\n"
        f"**Recent Entries**:\n{recent_str}\n\n"
        f"You can ask me to add new rows, update statuses, add notes, or set follow-ups anytime!"
    )

    return {
        "reply": reply,
        "response": reply,
        "excel_modified": False,
        "tool_used": "excel_summary_query",
        "data": stats,
    }


def _try_llm_excel_action(
    msg: str, excel_path: str, existing_apps: List[Dict[str, Any]], groq: GroqService
) -> Optional[Dict[str, Any]]:
    """Use Groq LLM to parse complex or informal Excel writing instructions."""
    system_prompt = (
        "You are an AI Assistant with direct write access to an Excel spreadsheet (applications.xlsx).\n"
        "Analyze the user's message. If the user wants to add, update, delete, or log an application or note into Excel, "
        "respond with a valid JSON object matching this schema:\n"
        "{\n"
        '  "is_excel_action": true,\n'
        '  "action": "add_application | update_status | update_notes | create_followup | delete_application",\n'
        '  "company_name": "string",\n'
        '  "job_title": "string",\n'
        '  "status": "Wishlist | Applied | Assessment | Interview | Offer | Rejected | NoResponse",\n'
        '  "salary_range": "string or null",\n'
        '  "work_mode": "Remote | Hybrid | Onsite | null",\n'
        '  "notes": "string or null"\n'
        "}\n"
        "If the user is NOT requesting an Excel modification, return: {\"is_excel_action\": false}"
    )

    try:
        completion = groq._ensure_client().chat.completions.create(
            model=groq.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": msg},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        import json
        raw = completion.choices[0].message.content or "{}"
        parsed = json.loads(groq._clean_json_response(raw))

        if not parsed.get("is_excel_action"):
            return None

        action = parsed.get("action")
        if action == "add_application":
            payload = {
                "company_name": parsed.get("company_name") or "Target Company",
                "job_title": parsed.get("job_title") or "Software Engineer",
                "application_status": parsed.get("status") or "Applied",
                "salary_range": parsed.get("salary_range") or "",
                "work_mode": parsed.get("work_mode") or "Remote",
                "notes": parsed.get("notes") or "Logged via AI Assistant",
                "date_applied": datetime.now().strftime("%Y-%m-%d"),
                "application_source": "AI Assistant Groq Writer",
            }
            created = excel_service.add_application(excel_path, payload)
            salary_str = payload.get("salary_range") or ""
            salary_line = f"- **Salary**: {salary_str}\n" if salary_str else ""
            reply = (
                f"✍️ **Successfully written to Excel sheet (`applications.xlsx`)!**\n\n"
                f"- **Company**: {payload['company_name']}\n"
                f"- **Role**: {payload['job_title']}\n"
                f"- **Status**: `{payload['application_status']}`\n"
                f"{salary_line}"
                f"The row has been safely appended to the **Applications** worksheet."
            )
            return {
                "reply": reply,
                "response": reply,
                "excel_modified": True,
                "tool_used": "excel_llm_add",
                "excel_action": {
                    "action_type": "add_application",
                    "sheet_name": "Applications",
                    "item_id": created.get("application_id"),
                    "company_name": payload["company_name"],
                    "job_title": payload["job_title"],
                    "status": payload["application_status"],
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                },
                "data": created,
            }
    except Exception as e:
        logger.warning(f"LLM Excel action parser error: {e}")
        return None

    return None


def _parse_application_fields(text: str) -> Dict[str, Any]:
    """Extract standard job application fields from natural language text."""
    fields: Dict[str, Any] = {}

    # Extract Salary
    salary_match = re.search(r'(\$\s*\d{2,3}(?:,\d{3})*(?:\s*-\s*\$?\d{2,3}(?:,\d{3})*)?(?:\s*(?:k|usd|per\s+year|/yr))?)', text, re.IGNORECASE)
    if salary_match:
        fields["salary_range"] = salary_match.group(1).strip()
    else:
        k_match = re.search(r'(\b\d{2,3}k\b)', text, re.IGNORECASE)
        if k_match:
            fields["salary_range"] = f"${k_match.group(1)}"

    # Extract Work Mode
    for mode in ["Remote", "Hybrid", "Onsite"]:
        if re.search(rf'\b{mode}\b', text, re.IGNORECASE):
            fields["work_mode"] = mode
            break

    # Extract Status
    for st in ["Wishlist", "Applied", "Assessment", "Interview", "Offer", "Rejected", "NoResponse"]:
        if re.search(rf'\b{st}\b', text, re.IGNORECASE):
            fields["application_status"] = st
            break

    # Extract Company and Job Title using common phrasing patterns:
    # Pattern A: "[Role] at [Company]" (e.g. "Senior React Engineer at Stripe")
    match_at = re.search(r'(?:add|write|log|track|applied\s+for|applied\s+to)?\s*([A-Za-z0-9\.\+\#\s\-/]+?)\s+\bat\b\s+([A-Za-z0-9\.\&\s\-]+?)(?:,|\.|\$|\bwith\b|\bsalary\b|\bremote\b|\bapplied\b|$)', text, re.IGNORECASE)
    if match_at:
        possible_title = match_at.group(1).strip()
        possible_company = match_at.group(2).strip()
        # Clean leading command words
        possible_title = re.sub(r'^(?:to\s+excel\s*:?|add\s*:?|write\s*:?|log\s*:?|new\s+application\s*:?|application\s*:?)', '', possible_title, flags=re.IGNORECASE).strip()
        if possible_company and len(possible_company) < 50:
            fields["company_name"] = possible_company.title()
        if possible_title and len(possible_title) < 70:
            fields["job_title"] = possible_title.title()

    # Pattern B: "Company: [Company], Role/Position: [Role]"
    if not fields.get("company_name"):
        comp_match = re.search(r'company(?:\s*name)?\s*[:=\-]\s*([A-Za-z0-9\.\&\s\-]+?)(?:,|\.|\n|$)', text, re.IGNORECASE)
        if comp_match:
            fields["company_name"] = comp_match.group(1).strip().title()

    if not fields.get("job_title"):
        title_match = re.search(r'(?:role|position|job\s*title|title)\s*[:=\-]\s*([A-Za-z0-9\.\+\#\s\-/]+?)(?:,|\.|\n|$)', text, re.IGNORECASE)
        if title_match:
            fields["job_title"] = title_match.group(1).strip().title()

    # Pattern C: "[Company] - [Role]" or "[Company]: [Role]"
    if not fields.get("company_name") or not fields.get("job_title"):
        dash_match = re.search(r'(?:add\s+to\s+excel\s*:?\s*)?([A-Za-z0-9\.\&]+)\s*[\-:]\s*([A-Za-z0-9\.\+\#\s]+?)(?:,|\.|$)', text, re.IGNORECASE)
        if dash_match and not fields.get("company_name"):
            fields["company_name"] = dash_match.group(1).strip().title()
            fields["job_title"] = dash_match.group(2).strip().title()

    return fields
