import os
import shutil
import threading
import uuid
import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from filelock import FileLock
import openpyxl
from openpyxl import Workbook, load_workbook

logger = logging.getLogger("excel_service")

COLUMNS = {
    "Applications": [
        "application_id",
        "company_name",
        "company_website",
        "company_logo",
        "job_title",
        "job_description",
        "job_url",
        "location",
        "work_mode",
        "employment_type",
        "experience_required",
        "salary_range",
        "required_skills",
        "application_source",
        "date_discovered",
        "date_applied",
        "application_status",
        "recruiter_name",
        "recruiter_email",
        "follow_up_date",
        "resume_version",
        "match_score",
        "notes",
        "created_at",
        "updated_at",
        "is_favorite",
    ],
    "StatusHistory": [
        "history_id",
        "application_id",
        "previous_status",
        "new_status",
        "changed_at",
        "notes",
    ],
    "FollowUps": [
        "followup_id",
        "application_id",
        "task",
        "followup_date",
        "completed",
        "notes",
    ],
    "Analysis": [
        "analysis_id",
        "application_id",
        "resume_name",
        "match_score",
        "matched_skills",
        "missing_skills",
        "experience_match",
        "recommendations",
        "analyzed_at",
    ],
    "Settings": [
        "key",
        "value",
        "updated_at",
    ],
    "Notifications": [
        "notification_id",
        "type",
        "title",
        "message",
        "related_id",
        "is_read",
        "created_at",
    ],
    "DiscoveredJobs": [
        "discovered_job_id",
        "company_name",
        "job_title",
        "job_url",
        "description",
        "location",
        "experience",
        "employment_type",
        "work_mode",
        "salary",
        "required_skills",
        "posted_date",
        "discovered_date",
        "source",
        "match_score",
        "matched_skills",
        "missing_skills",
        "is_new",
        "is_applied",
        "last_verified",
    ],
    "CompanyMonitoring": [
        "company_id",
        "company_name",
        "website",
        "careers_url",
        "search_keywords",
        "last_checked",
        "monitoring_enabled",
    ],
}

LOCK = threading.RLock()
_FILE_LOCKS: Dict[str, FileLock] = {}
_LOCKS_GUARD = threading.Lock()


def _get_path(path_input: Union[str, Path]) -> Path:
    return Path(path_input).resolve()


def _get_lock(path: Path) -> FileLock:
    resolved = str(path.resolve())
    with _LOCKS_GUARD:
        if resolved not in _FILE_LOCKS:
            lock_file = path.parent / f"{path.name}.lock"
            _FILE_LOCKS[resolved] = FileLock(str(lock_file), timeout=20)
        return _FILE_LOCKS[resolved]


def _serialize_value(val: Any) -> Any:
    if val is None:
        return ""
    if hasattr(val, "value"):
        val = val.value
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, (list, tuple)):
        return ", ".join(str(x) for x in val)
    if isinstance(val, bool):
        return str(val)
    return val


def _deserialize_cell(val: Any) -> Any:
    if val is None or val == "":
        return None
    if isinstance(val, str):
        if val.startswith("ApplicationStatus."):
            val = val.split(".", 1)[1]
        elif val.startswith("WorkMode."):
            val = val.split(".", 1)[1]
        elif val.startswith("EmploymentType."):
            val = val.split(".", 1)[1]
    return val


def _save_wb(wb: Workbook, path: Path) -> None:
    """Save workbook atomically (write to temp file, then rename/replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = path.parent / f"{path.stem}_{uuid.uuid4().hex}.tmp"
    try:
        wb.save(temp_file)
        wb.close()
        # Atomic replace on Windows/Linux
        os.replace(temp_file, path)
    except Exception as e:
        if temp_file.exists():
            try:
                temp_file.unlink()
            except Exception:
                pass
        logger.error(f"Failed to atomically save workbook to {path}: {e}")
        raise


def backup_workbook(path_input: Union[str, Path], backup_dir: Optional[Union[str, Path]] = None) -> Optional[Path]:
    """Copy workbook to backup directory with timestamp in filename."""
    path = _get_path(path_input)
    if not path.exists():
        return None

    if backup_dir is None:
        # Default backup directory parallel to data directory or inside parent
        backup_directory = path.parent.parent / "backups"
        if not backup_directory.parent.exists():
            backup_directory = path.parent / "backups"
    else:
        backup_directory = Path(backup_dir).resolve()

    backup_directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    backup_path = backup_directory / f"{path.stem}_{timestamp}{path.suffix}"
    try:
        shutil.copy2(path, backup_path)
        logger.info(f"Backup created at {backup_path}")
        return backup_path
    except Exception as e:
        logger.warning(f"Could not create backup of {path}: {e}")
        return None


def initialize_workbook(path_input: Union[str, Path], force_reset: bool = False) -> None:
    """Create workbook with all 5 sheets and headers if not exists. If force_reset=True, overwrites with a fresh workbook."""
    path = _get_path(path_input)
    path.parent.mkdir(parents=True, exist_ok=True)

    with LOCK:
        with _get_lock(path):
            if not path.exists() or force_reset:
                wb = Workbook()
                # Remove default sheet after creating our sheets
                default_sheet = wb.active

                for sheet_name, cols in COLUMNS.items():
                    ws = wb.create_sheet(title=sheet_name)
                    ws.append(cols)

                if default_sheet and default_sheet.title not in COLUMNS:
                    wb.remove(default_sheet)

                _save_wb(wb, path)
                logger.info(f"Initialized new job tracker workbook at {path} (force_reset={force_reset})")
            else:
                wb = load_workbook(path)
                modified = False
                for sheet_name, cols in COLUMNS.items():
                    if sheet_name not in wb.sheetnames:
                        ws = wb.create_sheet(title=sheet_name)
                        ws.append(cols)
                        modified = True
                    else:
                        ws = wb[sheet_name]
                        if ws.max_row == 0:
                            ws.append(cols)
                            modified = True
                        else:
                            # Ensure any newly introduced schema columns are present in row 1
                            existing_headers = [cell.value for cell in ws[1] if cell.value is not None]
                            for col in cols:
                                if col not in existing_headers:
                                    next_col = len(existing_headers) + 1
                                    ws.cell(row=1, column=next_col, value=col)
                                    existing_headers.append(col)
                                    modified = True
                if modified:
                    backup_workbook(path)
                    _save_wb(wb, path)
                    logger.info(f"Updated missing sheets in workbook at {path}")
                else:
                    wb.close()


def _load_wb(path: Path) -> Workbook:
    """Load workbook, initialize if missing."""
    if not path.exists():
        initialize_workbook(path)
    return load_workbook(path)


def read_applications(path_input: Union[str, Path]) -> List[Dict[str, Any]]:
    """Read Applications sheet, return list of dicts. Handle empty sheet, missing columns."""
    path = _get_path(path_input)
    if not path.exists():
        initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Applications" not in wb.sheetnames:
                wb.close()
                return []

            ws = wb["Applications"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results: List[Dict[str, Any]] = []

            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)

                    if col == "required_skills":
                        if isinstance(val, str) and val.strip():
                            row_dict[col] = [s.strip() for s in val.split(",") if s.strip()]
                        elif isinstance(val, list):
                            row_dict[col] = val
                        else:
                            row_dict[col] = []
                    elif col == "match_score" and val is not None:
                        try:
                            row_dict[col] = float(val)
                        except (ValueError, TypeError):
                            row_dict[col] = None
                    elif col == "is_favorite":
                        if isinstance(val, bool):
                            row_dict[col] = val
                        elif isinstance(val, str):
                            row_dict[col] = val.strip().lower() in ("true", "1", "yes")
                        elif isinstance(val, (int, float)):
                            row_dict[col] = bool(val)
                        else:
                            row_dict[col] = False
                    else:
                        row_dict[col] = val

                row_dict.setdefault("is_favorite", False)
                results.append(row_dict)

            return results


def get_application_by_id(path_input: Union[str, Path], app_id: str) -> Optional[Dict[str, Any]]:
    """Return single application dict or None."""
    apps = read_applications(path_input)
    for app in apps:
        if str(app.get("application_id")) == str(app_id):
            return app
    return None


def add_application(path_input: Union[str, Path], data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate UUID, set created_at/updated_at, append row. Check for duplicate by job_url OR (company_name + job_title). Backup before write. Return the new application dict."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            existing_apps = read_applications(path)

            new_url = str(data.get("job_url") or "").strip().lower()
            new_company = str(data.get("company_name") or "").strip().lower()
            new_title = str(data.get("job_title") or "").strip().lower()

            for app in existing_apps:
                curr_url = str(app.get("job_url") or "").strip().lower()
                curr_company = str(app.get("company_name") or "").strip().lower()
                curr_title = str(app.get("job_title") or "").strip().lower()

                if new_url and curr_url and new_url == curr_url:
                    raise ValueError(f"Application already exists for job URL: {data.get('job_url')}")
                if new_company and new_title and (new_company == curr_company and new_title == curr_title):
                    raise ValueError(f"Application already exists for '{data.get('job_title')}' at '{data.get('company_name')}'")

            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["Applications"]

            app_id = data.get("application_id") or str(uuid.uuid4())
            now_iso = datetime.utcnow().isoformat()

            app_dict = dict(data)
            for k, v in list(app_dict.items()):
                if hasattr(v, "value"):
                    app_dict[k] = v.value
                elif isinstance(v, str):
                    if v.startswith("ApplicationStatus."):
                        app_dict[k] = v.split(".", 1)[1]
                    elif v.startswith("WorkMode."):
                        app_dict[k] = v.split(".", 1)[1]
                    elif v.startswith("EmploymentType."):
                        app_dict[k] = v.split(".", 1)[1]
            app_dict["application_id"] = app_id
            app_dict["created_at"] = data.get("created_at") or now_iso
            app_dict["updated_at"] = now_iso

            # Prepare row values according to Applications headers in worksheet
            sheet_headers = [c.value for c in ws[1] if c.value is not None]
            headers = sheet_headers if sheet_headers else COLUMNS["Applications"]
            row_values = []
            for col in headers:
                val = app_dict.get(col)
                row_values.append(_serialize_value(val))

            ws.append(row_values)
            _save_wb(wb, path)

            # Format return dict
            if isinstance(app_dict.get("required_skills"), str):
                app_dict["required_skills"] = [s.strip() for s in app_dict["required_skills"].split(",") if s.strip()]
            elif app_dict.get("required_skills") is None:
                app_dict["required_skills"] = []

            return app_dict


def update_application(path_input: Union[str, Path], app_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Find row, update only provided fields, set updated_at. Backup before write."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            ws = wb["Applications"]

            headers = [cell.value for cell in ws[1]]
            if "application_id" not in headers:
                wb.close()
                return None

            id_col_idx = headers.index("application_id") + 1
            target_row_idx = None

            for row_idx in range(2, ws.max_row + 1):
                cell_val = ws.cell(row=row_idx, column=id_col_idx).value
                if cell_val is not None and str(cell_val) == str(app_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return None

            backup_workbook(path)

            now_iso = datetime.utcnow().isoformat()
            updated_data = dict(data)
            updated_data["updated_at"] = now_iso

            # Update cells
            for col_name, new_val in updated_data.items():
                if col_name in headers and col_name != "application_id":
                    col_idx = headers.index(col_name) + 1
                    ws.cell(row=target_row_idx, column=col_idx, value=_serialize_value(new_val))

            # Ensure updated_at is written
            updated_col_idx = headers.index("updated_at") + 1
            ws.cell(row=target_row_idx, column=updated_col_idx, value=now_iso)

            # Read back updated application
            row_dict = {}
            for idx, col in enumerate(headers):
                c_val = ws.cell(row=target_row_idx, column=idx + 1).value
                c_val = _deserialize_cell(c_val)
                if col == "required_skills":
                    if isinstance(c_val, str) and c_val.strip():
                        row_dict[col] = [s.strip() for s in c_val.split(",") if s.strip()]
                    elif isinstance(c_val, list):
                        row_dict[col] = c_val
                    else:
                        row_dict[col] = []
                elif col == "match_score" and c_val is not None:
                    try:
                        row_dict[col] = float(c_val)
                    except (ValueError, TypeError):
                        row_dict[col] = None
                elif col == "is_favorite":
                    if isinstance(c_val, bool):
                        row_dict[col] = c_val
                    elif isinstance(c_val, str):
                        row_dict[col] = c_val.strip().lower() in ("true", "1", "yes")
                    elif isinstance(c_val, (int, float)):
                        row_dict[col] = bool(c_val)
                    else:
                        row_dict[col] = False
                else:
                    row_dict[col] = c_val

            row_dict.setdefault("is_favorite", False)
            _save_wb(wb, path)
            return row_dict


def delete_application(path_input: Union[str, Path], app_id: str) -> bool:
    """Remove row by application_id. Backup before write."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            ws = wb["Applications"]

            headers = [cell.value for cell in ws[1]]
            if "application_id" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("application_id") + 1
            target_row_idx = None

            for row_idx in range(2, ws.max_row + 1):
                cell_val = ws.cell(row=row_idx, column=id_col_idx).value
                if cell_val is not None and str(cell_val) == str(app_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return False

            backup_workbook(path)
            ws.delete_rows(target_row_idx, 1)
            _save_wb(wb, path)
            return True


def add_status_history(
    path_input: Union[str, Path],
    app_id: str,
    prev_status: Optional[str],
    new_status: str,
    notes: str = "",
) -> Dict[str, Any]:
    """Append to StatusHistory sheet."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["StatusHistory"]

            history_id = str(uuid.uuid4())
            changed_at = datetime.utcnow().isoformat()

            history_entry = {
                "history_id": history_id,
                "application_id": str(app_id),
                "previous_status": str(prev_status) if prev_status else "",
                "new_status": str(new_status),
                "changed_at": changed_at,
                "notes": str(notes or ""),
            }

            headers = COLUMNS["StatusHistory"]
            ws.append([history_entry.get(c, "") for c in headers])
            _save_wb(wb, path)
            return history_entry


def update_status(path_input: Union[str, Path], app_id: str, new_status: Any, notes: str = "") -> Optional[Dict[str, Any]]:
    """Update status field, call add_status_history, return updated app."""
    current_app = get_application_by_id(path_input, app_id)
    if not current_app:
        return None

    status_str = new_status.value if hasattr(new_status, "value") else str(new_status)
    if status_str.startswith("ApplicationStatus."):
        status_str = status_str.split(".", 1)[1]

    prev_status = current_app.get("application_status")
    updated_app = update_application(
        path_input,
        app_id,
        {
            "application_status": status_str,
            "notes": (f"{current_app.get('notes', '')}\n[Status Change]: {notes}").strip() if notes and current_app.get("notes") else (notes or current_app.get("notes")),
        },
    )
    add_status_history(path_input, app_id, prev_status, status_str, notes=notes)
    return updated_app


def read_status_history(path_input: Union[str, Path], app_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Read StatusHistory sheet, return list of dicts."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "StatusHistory" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["StatusHistory"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results = []
            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {headers[i]: _deserialize_cell(row[i]) for i in range(min(len(headers), len(row)))}
                if app_id is None or str(row_dict.get("application_id")) == str(app_id):
                    results.append(row_dict)
            return results


def read_followups(path_input: Union[str, Path]) -> List[Dict[str, Any]]:
    """Read FollowUps sheet, return list of dicts."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "FollowUps" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["FollowUps"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results = []
            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)
                    if col == "completed":
                        if isinstance(val, bool):
                            row_dict[col] = val
                        elif isinstance(val, str):
                            row_dict[col] = val.strip().lower() in ("true", "1", "yes")
                        elif isinstance(val, (int, float)):
                            row_dict[col] = bool(val)
                        else:
                            row_dict[col] = False
                    else:
                        row_dict[col] = val
                results.append(row_dict)
            return results


def add_followup(path_input: Union[str, Path], data: Dict[str, Any]) -> Dict[str, Any]:
    """Append to FollowUps sheet with UUID."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["FollowUps"]

            followup_id = data.get("followup_id") or str(uuid.uuid4())
            followup_dict = {
                "followup_id": followup_id,
                "application_id": str(data.get("application_id", "")),
                "task": str(data.get("task", "")),
                "followup_date": _serialize_value(data.get("followup_date")),
                "completed": bool(data.get("completed", False)),
                "notes": str(data.get("notes") or ""),
            }

            headers = COLUMNS["FollowUps"]
            ws.append([_serialize_value(followup_dict.get(c)) for c in headers])
            _save_wb(wb, path)
            return followup_dict


def update_followup(path_input: Union[str, Path], followup_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update followup row."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            ws = wb["FollowUps"]
            headers = [cell.value for cell in ws[1]]
            if "followup_id" not in headers:
                wb.close()
                return None

            id_col_idx = headers.index("followup_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(followup_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return None

            backup_workbook(path)
            for k, v in data.items():
                if k in headers and k != "followup_id":
                    col_idx = headers.index(k) + 1
                    ws.cell(row=target_row_idx, column=col_idx, value=_serialize_value(v))

            row_dict = {}
            for idx, col in enumerate(headers):
                c_val = ws.cell(row=target_row_idx, column=idx + 1).value
                c_val = _deserialize_cell(c_val)
                if col == "completed":
                    if isinstance(c_val, bool):
                        row_dict[col] = c_val
                    elif isinstance(c_val, str):
                        row_dict[col] = c_val.strip().lower() in ("true", "1", "yes")
                    else:
                        row_dict[col] = bool(c_val)
                else:
                    row_dict[col] = c_val

            _save_wb(wb, path)
            return row_dict


def delete_followup(path_input: Union[str, Path], followup_id: str) -> bool:
    """Delete followup row."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            ws = wb["FollowUps"]
            headers = [cell.value for cell in ws[1]]
            if "followup_id" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("followup_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(followup_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return False

            backup_workbook(path)
            ws.delete_rows(target_row_idx, 1)
            _save_wb(wb, path)
            return True


def save_analysis(path_input: Union[str, Path], data: Dict[str, Any]) -> Dict[str, Any]:
    """Append to Analysis sheet with UUID."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["Analysis"]

            analysis_id = data.get("analysis_id") or str(uuid.uuid4())
            analyzed_at = data.get("analyzed_at") or datetime.utcnow().isoformat()

            analysis_entry = {
                "analysis_id": analysis_id,
                "application_id": str(data.get("application_id") or ""),
                "resume_name": str(data.get("resume_name") or ""),
                "match_score": data.get("match_score", 0.0),
                "matched_skills": _serialize_value(data.get("matched_skills", [])),
                "missing_skills": _serialize_value(data.get("missing_skills", [])),
                "experience_match": str(data.get("experience_match") or ""),
                "recommendations": _serialize_value(data.get("recommendations") or data.get("suggestions", [])),
                "analyzed_at": analyzed_at,
            }

            headers = COLUMNS["Analysis"]
            ws.append([_serialize_value(analysis_entry.get(c)) for c in headers])
            _save_wb(wb, path)
            return analysis_entry


def get_analysis_history(path_input: Union[str, Path], app_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Read Analysis sheet."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Analysis" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["Analysis"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results = []
            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)
                    if col in ("matched_skills", "missing_skills", "recommendations"):
                        if isinstance(val, str) and val.strip():
                            row_dict[col] = [s.strip() for s in val.split(",") if s.strip()]
                        elif isinstance(val, list):
                            row_dict[col] = val
                        else:
                            row_dict[col] = []
                    elif col == "match_score" and val is not None:
                        try:
                            row_dict[col] = float(val)
                        except (ValueError, TypeError):
                            row_dict[col] = 0.0
                    else:
                        row_dict[col] = val

                if app_id is None or str(row_dict.get("application_id")) == str(app_id):
                    results.append(row_dict)
            return results


def get_settings(path_input: Union[str, Path]) -> Dict[str, Any]:
    """Read Settings sheet as key-value dict."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Settings" not in wb.sheetnames:
                wb.close()
                return {}
            ws = wb["Settings"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows or len(rows) < 2:
                return {}

            settings_dict = {}
            for row in rows[1:]:
                if row and row[0] is not None:
                    k = str(row[0])
                    v = row[1] if len(row) > 1 else None
                    settings_dict[k] = _deserialize_cell(v)
            return settings_dict


def update_settings(path_input: Union[str, Path], settings_data: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert settings rows."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["Settings"]

            now_iso = datetime.utcnow().isoformat()
            existing_keys: Dict[str, int] = {}
            for row_idx in range(2, ws.max_row + 1):
                key_cell = ws.cell(row=row_idx, column=1).value
                if key_cell is not None:
                    existing_keys[str(key_cell)] = row_idx

            for k, v in settings_data.items():
                val_str = _serialize_value(v)
                if k in existing_keys:
                    r_idx = existing_keys[k]
                    ws.cell(row=r_idx, column=2, value=val_str)
                    ws.cell(row=r_idx, column=3, value=now_iso)
                else:
                    ws.append([k, val_str, now_iso])

            _save_wb(wb, path)
            return get_settings(path)


def export_data(path_input: Union[str, Path]) -> Path:
    """Return path, it's the Excel file itself."""
    path = _get_path(path_input)
    initialize_workbook(path)
    return path


def get_dashboard_stats(
    path_input: Union[str, Path],
    start_date: Optional[Union[str, date]] = None,
    end_date: Optional[Union[str, date]] = None,
) -> Dict[str, Any]:
    """Calculate from Applications sheet with optional date range filtering:
    - total, by_status counts, applications_by_month, applications_by_week,
      top_companies, top_locations, rates, avg_time_to_response
    """
    apps = read_applications(path_input)

    # Parse start and end date filters if provided
    start_d: Optional[date] = None
    if start_date:
        if isinstance(start_date, (datetime, date)):
            start_d = start_date.date() if isinstance(start_date, datetime) else start_date
        elif isinstance(start_date, str) and start_date.strip():
            try:
                start_d = datetime.strptime(start_date.strip()[:10], "%Y-%m-%d").date()
            except Exception:
                start_d = None

    end_d: Optional[date] = None
    if end_date:
        if isinstance(end_date, (datetime, date)):
            end_d = end_date.date() if isinstance(end_date, datetime) else end_date
        elif isinstance(end_date, str) and end_date.strip():
            try:
                end_d = datetime.strptime(end_date.strip()[:10], "%Y-%m-%d").date()
            except Exception:
                end_d = None

    status_keys = ["Wishlist", "Applied", "Assessment", "Interview", "Offer", "Rejected", "NoResponse"]
    by_status = {k: 0 for k in status_keys}

    company_counts: Dict[str, int] = {}
    location_counts: Dict[str, int] = {}

    today = date.today()
    month_counts: Dict[str, int] = {}
    week_counts: Dict[str, int] = {}

    if start_d and end_d and start_d <= end_d:
        # Pre-populate custom month range
        curr_y, curr_m = start_d.year, start_d.month
        target_y, target_m = end_d.year, end_d.month
        while (curr_y < target_y) or (curr_y == target_y and curr_m <= target_m):
            key = f"{curr_y:04d}-{curr_m:02d}"
            month_counts[key] = 0
            curr_m += 1
            if curr_m > 12:
                curr_m = 1
                curr_y += 1

        # Pre-populate custom week range
        curr_w = start_d
        while curr_w <= end_d:
            y_w, w_num, _ = curr_w.isocalendar()
            key = f"{y_w:04d}-W{w_num:02d}"
            if key not in week_counts:
                week_counts[key] = 0
            curr_w += timedelta(days=7)
        y_end, w_end, _ = end_d.isocalendar()
        week_counts[f"{y_end:04d}-W{w_end:02d}"] = 0
    else:
        # Pre-populate last 12 months (e.g. 2025-12 to 2026-11)
        for i in range(11, -1, -1):
            m_year = today.year
            m_month = today.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1
            key = f"{m_year:04d}-{m_month:02d}"
            month_counts[key] = 0

        # Pre-populate last 8 weeks (e.g. 2026-W40)
        for i in range(7, -1, -1):
            dt = today - timedelta(weeks=i)
            year, week_num, _ = dt.isocalendar()
            key = f"{year:04d}-W{week_num:02d}"
            week_counts[key] = 0

    response_time_deltas: List[float] = []
    filtered_total = 0

    for app in apps:
        # Date resolution: prefer date_applied, fallback to date_discovered, created_at
        app_date_val = app.get("date_applied") or app.get("date_discovered") or app.get("created_at")
        parsed_dt: Optional[date] = None
        if app_date_val:
            try:
                if isinstance(app_date_val, str):
                    clean_str = app_date_val[:10]
                    parsed_dt = datetime.strptime(clean_str, "%Y-%m-%d").date()
                elif isinstance(app_date_val, datetime):
                    parsed_dt = app_date_val.date()
                elif isinstance(app_date_val, date):
                    parsed_dt = app_date_val
            except Exception:
                parsed_dt = None

        # Filter by custom dates if specified
        if start_d and parsed_dt and parsed_dt < start_d:
            continue
        if end_d and parsed_dt and parsed_dt > end_d:
            continue

        filtered_total += 1

        # Status counting
        raw_status = str(app.get("application_status") or "Wishlist")
        if raw_status in by_status:
            by_status[raw_status] += 1
        else:
            by_status[raw_status] = by_status.get(raw_status, 0) + 1

        # Company counting
        company = str(app.get("company_name") or "").strip()
        if company:
            company_counts[company] = company_counts.get(company, 0) + 1

        # Location counting
        location = str(app.get("location") or "").strip()
        if location:
            location_counts[location] = location_counts.get(location, 0) + 1

        # Bucketing into monthly & weekly counts
        if parsed_dt:
            m_key = f"{parsed_dt.year:04d}-{parsed_dt.month:02d}"
            if m_key in month_counts:
                month_counts[m_key] += 1
            elif start_d or end_d:
                month_counts[m_key] = month_counts.get(m_key, 0) + 1

            y_w, w_num, _ = parsed_dt.isocalendar()
            w_key = f"{y_w:04d}-W{w_num:02d}"
            if w_key in week_counts:
                week_counts[w_key] += 1
            elif start_d or end_d:
                week_counts[w_key] = week_counts.get(w_key, 0) + 1

        # Time to response calculation
        if app.get("date_applied") and app.get("application_status") in ("Assessment", "Interview", "Offer", "Rejected"):
            try:
                date_applied_str = str(app.get("date_applied"))[:10]
                d_applied = datetime.strptime(date_applied_str, "%Y-%m-%d").date()

                resp_str = str(app.get("updated_at") or app.get("created_at"))[:10]
                d_resp = datetime.strptime(resp_str, "%Y-%m-%d").date()

                delta_days = (d_resp - d_applied).days
                if delta_days >= 0:
                    response_time_deltas.append(float(delta_days))
            except Exception:
                pass

    # Top companies and locations
    top_companies = [
        {"company": k, "count": v}
        for k, v in sorted(company_counts.items(), key=lambda item: item[1], reverse=True)[:10]
    ]
    top_locations = [
        {"location": k, "count": v}
        for k, v in sorted(location_counts.items(), key=lambda item: item[1], reverse=True)[:10]
    ]

    applications_by_month = [{"month": k, "count": v} for k, v in month_counts.items()]
    applications_by_week = [{"week": k, "count": v} for k, v in week_counts.items()]

    total = filtered_total

    # Metric rates
    # Candidates for rates: Wishlist items are not yet applied, so active applications = total - Wishlist
    applied_or_further = total - by_status.get("Wishlist", 0)
    denominator = applied_or_further if applied_or_further > 0 else (total if total > 0 else 1)

    interview_counts = by_status.get("Interview", 0) + by_status.get("Offer", 0)
    interview_rate = round((interview_counts / denominator) * 100.0, 2)

    offer_count = by_status.get("Offer", 0)
    offer_rate = round((offer_count / denominator) * 100.0, 2)

    rejection_count = by_status.get("Rejected", 0)
    rejection_rate = round((rejection_count / denominator) * 100.0, 2)

    responded_count = (
        by_status.get("Assessment", 0)
        + by_status.get("Interview", 0)
        + by_status.get("Offer", 0)
        + by_status.get("Rejected", 0)
    )
    response_rate = round((responded_count / denominator) * 100.0, 2)

    avg_time_to_response = (
        round(sum(response_time_deltas) / len(response_time_deltas), 2)
        if response_time_deltas
        else 0.0
    )

    return {
        "total": total,
        "by_status": by_status,
        "applications_by_month": applications_by_month,
        "applications_by_week": applications_by_week,
        "top_companies": top_companies,
        "top_locations": top_locations,
        "interview_rate": interview_rate,
        "offer_rate": offer_rate,
        "rejection_rate": rejection_rate,
        "response_rate": response_rate,
        "avg_time_to_response": avg_time_to_response,
    }


def read_notifications(
    path_input: Union[str, Path],
    unread_only: bool = False,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Read notifications sheet with optional unread filter and row limit."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Notifications" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["Notifications"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows or len(rows) < 2:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results = []
            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)
                    if col == "is_read":
                        if isinstance(val, bool):
                            row_dict[col] = val
                        elif isinstance(val, str):
                            row_dict[col] = val.strip().lower() in ("true", "1", "yes")
                        elif isinstance(val, (int, float)):
                            row_dict[col] = bool(val)
                        else:
                            row_dict[col] = False
                    else:
                        row_dict[col] = val
                if unread_only and row_dict.get("is_read"):
                    continue
                results.append(row_dict)

            # Sort descending by created_at
            results.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
            return results[:limit]


def add_notification(path_input: Union[str, Path], data: Dict[str, Any]) -> Dict[str, Any]:
    """Append a new notification to the Notifications sheet."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["Notifications"]

            notif_id = str(data.get("notification_id") or uuid.uuid4())
            created_at = data.get("created_at") or datetime.utcnow().isoformat()
            is_read = bool(data.get("is_read", False))

            notif_dict = {
                "notification_id": notif_id,
                "type": str(data.get("type", "system")),
                "title": str(data.get("title", "")),
                "message": str(data.get("message", "")),
                "related_id": str(data.get("related_id") or ""),
                "is_read": is_read,
                "created_at": created_at,
            }

            headers = COLUMNS["Notifications"]
            ws.append([_serialize_value(notif_dict.get(c)) for c in headers])
            _save_wb(wb, path)
            return notif_dict


def mark_notification_read(path_input: Union[str, Path], notification_id: str, is_read: bool = True) -> bool:
    """Update read status of a notification."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Notifications" not in wb.sheetnames:
                wb.close()
                return False
            ws = wb["Notifications"]
            headers = [cell.value for cell in ws[1]]
            if "notification_id" not in headers or "is_read" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("notification_id") + 1
            read_col_idx = headers.index("is_read") + 1

            found = False
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(notification_id):
                    ws.cell(row=row_idx, column=read_col_idx, value=_serialize_value(is_read))
                    found = True
                    break

            if found:
                backup_workbook(path)
                _save_wb(wb, path)
            else:
                wb.close()
            return found


def mark_all_notifications_read(path_input: Union[str, Path]) -> int:
    """Mark all notifications as read in the workbook."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Notifications" not in wb.sheetnames:
                wb.close()
                return 0
            ws = wb["Notifications"]
            headers = [cell.value for cell in ws[1]]
            if "is_read" not in headers:
                wb.close()
                return 0

            read_col_idx = headers.index("is_read") + 1
            updated_count = 0
            for row_idx in range(2, ws.max_row + 1):
                current_val = ws.cell(row=row_idx, column=read_col_idx).value
                if current_val is None or str(current_val).strip().lower() not in ("true", "1", "yes"):
                    ws.cell(row=row_idx, column=read_col_idx, value="True")
                    updated_count += 1

            if updated_count > 0:
                backup_workbook(path)
                _save_wb(wb, path)
            else:
                wb.close()
            return updated_count


def delete_notification(path_input: Union[str, Path], notification_id: str) -> bool:
    """Delete a notification by ID."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Notifications" not in wb.sheetnames:
                wb.close()
                return False
            ws = wb["Notifications"]
            headers = [cell.value for cell in ws[1]]
            if "notification_id" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("notification_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(notification_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return False

            backup_workbook(path)
            ws.delete_rows(target_row_idx, 1)
            _save_wb(wb, path)
            return True


def clear_all_notifications(path_input: Union[str, Path]) -> int:
    """Clear all notification records from sheet."""
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "Notifications" not in wb.sheetnames:
                wb.close()
                return 0
            ws = wb["Notifications"]
            total_rows = ws.max_row
            if total_rows > 1:
                backup_workbook(path)
                ws.delete_rows(2, total_rows - 1)
                _save_wb(wb, path)
                return total_rows - 1
            wb.close()
            return 0


def has_notification_today(
    path_input: Union[str, Path],
    related_id: str,
    notif_type: str,
) -> bool:
    """Checks if a notification for the given related_id and type was already created today."""
    if not related_id:
        return False
    all_notifs = read_notifications(path_input, limit=200)
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    for n in all_notifs:
        if str(n.get("related_id")) == str(related_id) and str(n.get("type")) == str(notif_type):
            created_at = str(n.get("created_at") or "")[:10]
            if created_at == today_str:
                return True
    return False


# ==========================================
# CompanyMonitoring Operations
# ==========================================

def read_monitored_companies(path_input: Union[str, Path]) -> List[Dict[str, Any]]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "CompanyMonitoring" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["CompanyMonitoring"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows or len(rows) <= 1:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results: List[Dict[str, Any]] = []

            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)
                    if col == "monitoring_enabled":
                        if isinstance(val, bool):
                            row_dict[col] = val
                        elif isinstance(val, str):
                            row_dict[col] = val.strip().lower() in ("true", "1", "yes")
                        else:
                            row_dict[col] = bool(val) if val is not None else True
                    elif col == "search_keywords":
                        if isinstance(val, str) and val.strip():
                            row_dict[col] = [s.strip() for s in val.split(",") if s.strip()]
                        elif isinstance(val, list):
                            row_dict[col] = val
                        else:
                            row_dict[col] = []
                    else:
                        row_dict[col] = val
                results.append(row_dict)
            return results


def get_monitored_company(path_input: Union[str, Path], company_id: str) -> Optional[Dict[str, Any]]:
    companies = read_monitored_companies(path_input)
    for c in companies:
        if str(c.get("company_id")) == str(company_id):
            return c
    return None


def add_monitored_company(path_input: Union[str, Path], data: Dict[str, Any]) -> Dict[str, Any]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            existing = read_monitored_companies(path)
            new_name = str(data.get("company_name") or "").strip().lower()
            if not new_name:
                raise ValueError("Company name is required.")

            for c in existing:
                if str(c.get("company_name") or "").strip().lower() == new_name:
                    raise ValueError(f"Company '{data.get('company_name')}' is already being monitored.")

            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["CompanyMonitoring"]

            company_id = data.get("company_id") or str(uuid.uuid4())
            record = dict(data)
            record["company_id"] = company_id
            if "monitoring_enabled" not in record or record["monitoring_enabled"] is None:
                record["monitoring_enabled"] = True

            headers = COLUMNS["CompanyMonitoring"]
            row_values = [_serialize_value(record.get(col)) for col in headers]
            ws.append(row_values)
            _save_wb(wb, path)

            if isinstance(record.get("search_keywords"), str):
                record["search_keywords"] = [s.strip() for s in record["search_keywords"].split(",") if s.strip()]
            return record


def update_monitored_company(path_input: Union[str, Path], company_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "CompanyMonitoring" not in wb.sheetnames:
                wb.close()
                return None
            ws = wb["CompanyMonitoring"]
            headers = [cell.value for cell in ws[1]]
            if "company_id" not in headers:
                wb.close()
                return None

            id_col_idx = headers.index("company_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(company_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return None

            backup_workbook(path)
            for col_name, new_val in data.items():
                if col_name in headers and col_name != "company_id":
                    col_idx = headers.index(col_name) + 1
                    ws.cell(row=target_row_idx, column=col_idx, value=_serialize_value(new_val))

            _save_wb(wb, path)
            return get_monitored_company(path, company_id)


def delete_monitored_company(path_input: Union[str, Path], company_id: str) -> bool:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "CompanyMonitoring" not in wb.sheetnames:
                wb.close()
                return False
            ws = wb["CompanyMonitoring"]
            headers = [cell.value for cell in ws[1]]
            if "company_id" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("company_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(company_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return False

            backup_workbook(path)
            ws.delete_rows(target_row_idx, 1)
            _save_wb(wb, path)
            return True


def sync_companies_from_applications(path_input: Union[str, Path]) -> Dict[str, Any]:
    """Populate CompanyMonitoring with unique companies from Applications worksheet."""
    path = _get_path(path_input)
    apps = read_applications(path)
    existing_companies = read_monitored_companies(path)
    existing_names = {
        str(c.get("company_name", "")).strip().lower(): c
        for c in existing_companies
    }

    added = []
    for app in apps:
        comp_name = str(app.get("company_name") or "").strip()
        if not comp_name:
            continue
        comp_key = comp_name.lower()
        if comp_key in existing_names:
            continue

        website = app.get("company_website") or app.get("job_url") or ""
        careers_url = app.get("job_url") or website
        skills = app.get("required_skills") or []
        job_title = app.get("job_title") or "Software Engineer"
        keywords = list(dict.fromkeys([job_title, "SWE", "SDE", "Backend", "Full Stack"] + [s for s in skills if isinstance(s, str)][:3]))

        comp_record = {
            "company_name": comp_name,
            "website": website,
            "careers_url": careers_url,
            "search_keywords": keywords,
            "last_checked": None,
            "monitoring_enabled": True,
        }
        created = add_monitored_company(path, comp_record)
        existing_names[comp_key] = created
        added.append(created)

    return {
        "added_count": len(added),
        "total_monitored": len(existing_names),
        "added": added,
    }


# ==========================================
# DiscoveredJobs Operations
# ==========================================

def read_discovered_jobs(
    path_input: Union[str, Path],
    search: Optional[str] = None,
    company: Optional[str] = None,
    min_score: Optional[float] = None,
    is_new: Optional[bool] = None,
    is_applied: Optional[bool] = None,
    source: Optional[str] = None,
) -> List[Dict[str, Any]]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "DiscoveredJobs" not in wb.sheetnames:
                wb.close()
                return []
            ws = wb["DiscoveredJobs"]
            rows = list(ws.iter_rows(values_only=True))
            wb.close()

            if not rows or len(rows) <= 1:
                return []

            headers = [str(h) for h in rows[0] if h is not None]
            results: List[Dict[str, Any]] = []

            for row in rows[1:]:
                if not any(row):
                    continue
                row_dict = {}
                for idx, col in enumerate(headers):
                    val = row[idx] if idx < len(row) else None
                    val = _deserialize_cell(val)

                    if col in ("required_skills", "matched_skills", "missing_skills"):
                        if isinstance(val, str) and val.strip():
                            row_dict[col] = [s.strip() for s in val.split(",") if s.strip()]
                        elif isinstance(val, list):
                            row_dict[col] = val
                        else:
                            row_dict[col] = []
                    elif col == "match_score" and val is not None:
                        try:
                            row_dict[col] = float(val)
                        except (ValueError, TypeError):
                            row_dict[col] = None
                    elif col in ("is_new", "is_applied"):
                        if isinstance(val, bool):
                            row_dict[col] = val
                        elif isinstance(val, str):
                            row_dict[col] = val.strip().lower() in ("true", "1", "yes")
                        else:
                            row_dict[col] = bool(val) if val is not None else False
                    else:
                        row_dict[col] = val

                # Filtering
                if company and company.lower() not in str(row_dict.get("company_name", "")).lower():
                    continue
                if search:
                    q = search.lower()
                    title = str(row_dict.get("job_title", "")).lower()
                    c_name = str(row_dict.get("company_name", "")).lower()
                    desc = str(row_dict.get("description", "")).lower()
                    loc = str(row_dict.get("location", "")).lower()
                    if q not in title and q not in c_name and q not in desc and q not in loc:
                        continue
                if min_score is not None:
                    score = row_dict.get("match_score")
                    if score is None or score < min_score:
                        continue
                if is_new is not None and row_dict.get("is_new") != is_new:
                    continue
                if is_applied is not None and row_dict.get("is_applied") != is_applied:
                    continue
                if source and str(row_dict.get("source", "")).lower() != source.lower():
                    continue

                results.append(row_dict)

            # Sort by discovered_date desc / match_score desc
            results.sort(
                key=lambda x: (
                    str(x.get("discovered_date") or ""),
                    x.get("match_score") or 0.0,
                ),
                reverse=True,
            )
            return results


def get_discovered_job_by_id(path_input: Union[str, Path], discovered_job_id: str) -> Optional[Dict[str, Any]]:
    jobs = read_discovered_jobs(path_input)
    for j in jobs:
        if str(j.get("discovered_job_id")) == str(discovered_job_id):
            return j
    return None


def save_discovered_job(path_input: Union[str, Path], job_data: Dict[str, Any]) -> Dict[str, Any]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            existing_jobs = read_discovered_jobs(path)
            now_iso = datetime.utcnow().isoformat()
            today_str = datetime.utcnow().strftime("%Y-%m-%d")

            # Check duplicate by URL or company+title
            target_job_url = str(job_data.get("job_url") or "").strip().lower()
            target_comp = str(job_data.get("company_name") or "").strip().lower()
            target_title = str(job_data.get("job_title") or "").strip().lower()

            existing_match = None
            for ej in existing_jobs:
                ej_url = str(ej.get("job_url") or "").strip().lower()
                ej_comp = str(ej.get("company_name") or "").strip().lower()
                ej_title = str(ej.get("job_title") or "").strip().lower()

                if target_job_url and ej_url and target_job_url == ej_url:
                    existing_match = ej
                    break
                if target_comp and target_title and target_comp == ej_comp and target_title == ej_title:
                    existing_match = ej
                    break

            if existing_match:
                # Update existing listing (mark is_new=False if previously discovered, update last_verified)
                job_id = existing_match["discovered_job_id"]
                updates = dict(job_data)
                updates["is_new"] = False
                updates["last_verified"] = now_iso
                updates["discovered_date"] = existing_match.get("discovered_date") or today_str
                if existing_match.get("is_applied"):
                    updates["is_applied"] = True

                update_discovered_job(path, job_id, updates)
                return get_discovered_job_by_id(path, job_id) or updates

            # New job listing
            backup_workbook(path)
            wb = _load_wb(path)
            ws = wb["DiscoveredJobs"]

            job_id = job_data.get("discovered_job_id") or str(uuid.uuid4())
            record = dict(job_data)
            record["discovered_job_id"] = job_id
            record["is_new"] = True
            record["is_applied"] = False
            record["discovered_date"] = record.get("discovered_date") or today_str
            record["last_verified"] = now_iso

            headers = COLUMNS["DiscoveredJobs"]
            row_values = [_serialize_value(record.get(col)) for col in headers]
            ws.append(row_values)
            _save_wb(wb, path)

            for list_col in ("required_skills", "matched_skills", "missing_skills"):
                if isinstance(record.get(list_col), str):
                    record[list_col] = [s.strip() for s in record[list_col].split(",") if s.strip()]
                elif record.get(list_col) is None:
                    record[list_col] = []

            return record


def update_discovered_job(path_input: Union[str, Path], discovered_job_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "DiscoveredJobs" not in wb.sheetnames:
                wb.close()
                return None
            ws = wb["DiscoveredJobs"]
            headers = [cell.value for cell in ws[1]]
            if "discovered_job_id" not in headers:
                wb.close()
                return None

            id_col_idx = headers.index("discovered_job_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(discovered_job_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return None

            backup_workbook(path)
            for col_name, new_val in data.items():
                if col_name in headers and col_name != "discovered_job_id":
                    col_idx = headers.index(col_name) + 1
                    ws.cell(row=target_row_idx, column=col_idx, value=_serialize_value(new_val))

            _save_wb(wb, path)
            return get_discovered_job_by_id(path, discovered_job_id)


def delete_discovered_job(path_input: Union[str, Path], discovered_job_id: str) -> bool:
    path = _get_path(path_input)
    initialize_workbook(path)

    with LOCK:
        with _get_lock(path):
            wb = _load_wb(path)
            if "DiscoveredJobs" not in wb.sheetnames:
                wb.close()
                return False
            ws = wb["DiscoveredJobs"]
            headers = [cell.value for cell in ws[1]]
            if "discovered_job_id" not in headers:
                wb.close()
                return False

            id_col_idx = headers.index("discovered_job_id") + 1
            target_row_idx = None
            for row_idx in range(2, ws.max_row + 1):
                if str(ws.cell(row=row_idx, column=id_col_idx).value) == str(discovered_job_id):
                    target_row_idx = row_idx
                    break

            if target_row_idx is None:
                wb.close()
                return False

            backup_workbook(path)
            ws.delete_rows(target_row_idx, 1)
            _save_wb(wb, path)
            return True


def convert_discovered_to_application(
    path_input: Union[str, Path],
    discovered_job_id: str,
    status: str = "Wishlist",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Convert discovered job directly into an Application in the tracker."""
    path = _get_path(path_input)
    job = get_discovered_job_by_id(path, discovered_job_id)
    if not job:
        raise ValueError(f"Discovered job not found: {discovered_job_id}")

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    app_notes = notes or f"Discovered via AI Job Watcher ({job.get('source') or 'Career Board'})."
    if job.get("missing_skills"):
        app_notes += f"\nMissing Skills: {', '.join(job['missing_skills'])}"

    app_data = {
        "company_name": job.get("company_name") or "Unknown Company",
        "company_website": job.get("job_url") or "",
        "job_title": job.get("job_title") or "Position",
        "job_description": job.get("description") or "",
        "job_url": job.get("job_url") or "",
        "location": job.get("location") or "",
        "work_mode": job.get("work_mode") or "Hybrid",
        "employment_type": job.get("employment_type") or "FullTime",
        "experience_required": job.get("experience") or "",
        "salary_range": job.get("salary") or "",
        "required_skills": job.get("required_skills") or [],
        "application_source": f"AI Job Watcher - {job.get('source') or 'Automated'}",
        "date_discovered": job.get("discovered_date") or today_str,
        "application_status": status,
        "match_score": job.get("match_score"),
        "notes": app_notes,
    }

    try:
        new_app = add_application(path, app_data)
    except ValueError as e:
        if "already exists" in str(e).lower():
            apps = read_applications(path)
            new_app = next(
                (a for a in apps if str(a.get("job_url", "")).strip().lower() == str(job.get("job_url", "")).strip().lower()),
                None
            )
            if not new_app:
                new_app = next(
                    (a for a in apps if str(a.get("company_name", "")).strip().lower() == str(job.get("company_name", "")).strip().lower() and str(a.get("job_title", "")).strip().lower() == str(job.get("job_title", "")).strip().lower()),
                    None
                )
            if not new_app:
                raise e
        else:
            raise e

    # Mark as applied in DiscoveredJobs
    update_discovered_job(path, discovered_job_id, {"is_applied": True, "is_new": False})
    return new_app

