import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
from docx import Document

logger = logging.getLogger("resume_service")

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize_filename(filename: str) -> str:
    """Remove unsafe characters from filename."""
    name = Path(filename).name
    # Keep alphanumeric, underscores, hyphens, and periods
    sanitized = re.sub(r"[^\w\.-]", "_", name)
    return sanitized or "resume"


def extract_text_from_pdf(file_path: Path) -> str:
    """Extract text from PDF using PyMuPDF."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")

    text_parts: List[str] = []
    doc = fitz.open(str(path))
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if text and text.strip():
                text_parts.append(text.strip())
    finally:
        doc.close()

    full_text = "\n\n".join(text_parts)
    return full_text.strip()


def extract_text_from_docx(file_path: Path) -> str:
    """Extract text from DOCX using python-docx."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"DOCX file not found: {path}")

    doc = Document(str(path))
    text_parts: List[str] = []

    # Paragraphs
    for p in doc.paragraphs:
        if p.text and p.text.strip():
            text_parts.append(p.text.strip())

    # Tables
    for table in doc.tables:
        for row in table.rows:
            row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_texts:
                text_parts.append(" | ".join(row_texts))

    full_text = "\n\n".join(text_parts)
    return full_text.strip()


def save_resume(file_content: bytes, filename: str, resume_dir: Path) -> Dict[str, Any]:
    """Save uploaded resume, return metadata dict with resume_id, filename, path, uploaded_at."""
    resume_dir = Path(resume_dir).resolve()
    resume_dir.mkdir(parents=True, exist_ok=True)

    clean_name = sanitize_filename(filename)
    suffix = Path(clean_name).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid file type '{suffix}'. Only PDF and DOCX files are supported.")

    file_size = len(file_content)
    if file_size > MAX_RESUME_SIZE:
        raise ValueError(f"File size exceeds 10MB limit. Current size: {file_size / (1024 * 1024):.2f}MB")

    resume_id = str(uuid.uuid4())
    stored_filename = f"{resume_id}_{clean_name}"
    file_path = resume_dir / stored_filename
    meta_path = resume_dir / f"{resume_id}.json"

    # Write file content
    with open(file_path, "wb") as f:
        f.write(file_content)

    metadata = {
        "resume_id": resume_id,
        "filename": clean_name,
        "file_path": str(file_path),
        "file_size": file_size,
        "uploaded_at": datetime.utcnow().isoformat(),
    }

    # Write metadata JSON
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Resume saved: {metadata['filename']} (ID: {resume_id})")
    return metadata


def list_resumes(resume_dir: Path) -> List[Dict[str, Any]]:
    """List all resumes in directory with metadata."""
    resume_dir = Path(resume_dir).resolve()
    if not resume_dir.exists():
        return []

    resumes: List[Dict[str, Any]] = []

    # Read each metadata JSON
    for meta_file in resume_dir.glob("*.json"):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "resume_id" in data and "file_path" in data:
                    # Verify underlying file exists
                    if Path(data["file_path"]).exists():
                        resumes.append(data)
        except Exception as e:
            logger.warning(f"Error reading metadata file {meta_file}: {e}")

    # Sort newest first
    resumes.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return resumes


def delete_resume(resume_id: str, resume_dir: Path) -> bool:
    """Delete resume file by ID."""
    resume_dir = Path(resume_dir).resolve()
    meta_path = resume_dir / f"{resume_id}.json"

    file_to_delete: Optional[Path] = None

    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "file_path" in data:
                    file_to_delete = Path(data["file_path"])
        except Exception:
            pass
        try:
            meta_path.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete metadata {meta_path}: {e}")

    # Also search for files starting with resume_id
    deleted_any = False
    if file_to_delete and file_to_delete.exists():
        try:
            file_to_delete.unlink()
            deleted_any = True
        except Exception as e:
            logger.warning(f"Failed to delete resume file {file_to_delete}: {e}")

    for p in resume_dir.glob(f"{resume_id}_*"):
        try:
            p.unlink()
            deleted_any = True
        except Exception as e:
            logger.warning(f"Failed to delete file {p}: {e}")

    return deleted_any or not meta_path.exists()


def get_resume_text(resume_id: str, resume_dir: Path) -> str:
    """Get extracted text from a resume by ID."""
    resume_dir = Path(resume_dir).resolve()
    meta_path = resume_dir / f"{resume_id}.json"

    target_file: Optional[Path] = None

    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "file_path" in data and Path(data["file_path"]).exists():
                    target_file = Path(data["file_path"])
        except Exception:
            pass

    if not target_file:
        # Search by filename prefix
        matching = list(resume_dir.glob(f"{resume_id}_*"))
        if matching:
            target_file = matching[0]

    if not target_file or not target_file.exists():
        raise FileNotFoundError(f"Resume with id '{resume_id}' not found.")

    suffix = target_file.suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(target_file)
    elif suffix == ".docx":
        return extract_text_from_docx(target_file)
    else:
        raise ValueError(f"Unsupported resume file extension: {suffix}")
