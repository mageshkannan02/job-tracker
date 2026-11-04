import io
from pathlib import Path
import fitz
from docx import Document
import pytest

from services import resume_service


@pytest.fixture
def sample_pdf_bytes():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "Alex Morgan\nSenior Python Engineer\nSkills: FastAPI, Docker, Pytest")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.fixture
def sample_docx_bytes():
    doc = Document()
    doc.add_paragraph("Alex Morgan - DOCX Resume")
    doc.add_paragraph("Skills: Kubernetes, Python, React")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_resume_save_and_extract_pdf(tmp_path, sample_pdf_bytes):
    """Verify PDF resume saving, metadata generation, and text extraction."""
    meta = resume_service.save_resume(sample_pdf_bytes, "alex_resume.pdf", tmp_path)
    assert meta["resume_id"] is not None
    assert meta["filename"] == "alex_resume.pdf"
    assert Path(meta["file_path"]).exists()

    # Extract text
    text = resume_service.get_resume_text(meta["resume_id"], tmp_path)
    assert "Alex Morgan" in text
    assert "FastAPI" in text


def test_resume_save_and_extract_docx(tmp_path, sample_docx_bytes):
    """Verify DOCX resume saving, metadata generation, and text extraction."""
    meta = resume_service.save_resume(sample_docx_bytes, "alex_resume.docx", tmp_path)
    assert meta["resume_id"] is not None

    text = resume_service.get_resume_text(meta["resume_id"], tmp_path)
    assert "Alex Morgan - DOCX Resume" in text
    assert "Kubernetes" in text


def test_resume_validation_invalid_type(tmp_path):
    """Verify non-supported extensions are rejected."""
    with pytest.raises(ValueError, match="Invalid file type"):
        resume_service.save_resume(b"fake executable", "malware.exe", tmp_path)

    with pytest.raises(ValueError, match="Invalid file type"):
        resume_service.save_resume(b"plain text", "notes.txt", tmp_path)


def test_list_and_delete_resume(tmp_path, sample_pdf_bytes):
    """Verify listing and deleting resumes."""
    meta1 = resume_service.save_resume(sample_pdf_bytes, "r1.pdf", tmp_path)
    meta2 = resume_service.save_resume(sample_pdf_bytes, "r2.pdf", tmp_path)

    resumes = resume_service.list_resumes(tmp_path)
    assert len(resumes) == 2

    # Delete first
    deleted = resume_service.delete_resume(meta1["resume_id"], tmp_path)
    assert deleted is True

    remaining = resume_service.list_resumes(tmp_path)
    assert len(remaining) == 1
    assert remaining[0]["resume_id"] == meta2["resume_id"]
