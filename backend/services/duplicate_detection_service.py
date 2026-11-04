import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

logger = logging.getLogger("duplicate_detection_service")

# Common tracking / marketing query params to remove
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "referer", "referrer", "source", "src", "gh_src", "lever-source",
    "fbclid", "gclid", "msclkid", "dclid", "mc_cid", "mc_eid", "trk", "trkinfo"
}

# Company suffix clean regex
COMPANY_SUFFIX_REGEX = re.compile(
    r"\b(inc\.?|incorporated|llc\.?|ltd\.?|limited|pvt\.?|private|corp\.?|corporation|co\.?|technologies|solutions|group|services)\b",
    re.IGNORECASE
)


def canonicalize_url(url: Optional[str]) -> str:
    """Normalize a URL to canonical form for duplicate detection."""
    if not url or not isinstance(url, str):
        return ""

    url = url.strip()
    try:
        parsed = urlparse(url)
        if not parsed.netloc:
            return url.lower()

        # Lowercase scheme and netloc
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        # Remove default ports
        if netloc.endswith(":80") and scheme == "http":
            netloc = netloc[:-3]
        elif netloc.endswith(":443") and scheme == "https":
            netloc = netloc[:-4]

        # Path: remove trailing slashes (except root) and multiple slashes
        path = re.sub(r"/+", "/", parsed.path)
        if len(path) > 1 and path.endswith("/"):
            path = path[:-1]

        # Filter query params
        query_tuples = parse_qsl(parsed.query, keep_blank_values=False)
        filtered_queries = [
            (k, v) for k, v in query_tuples
            if k.lower() not in TRACKING_PARAMS
        ]
        filtered_queries.sort(key=lambda x: x[0].lower())
        new_query = urlencode(filtered_queries)

        # Drop fragment
        canonical = urlunparse((scheme, netloc, path, parsed.params, new_query, ""))
        return canonical
    except Exception as e:
        logger.debug(f"URL canonicalization fallback for '{url}': {e}")
        return url.strip().lower().rstrip("/")


def normalize_company_name(name: Optional[str]) -> str:
    """Normalize company name to canonical lowercase without legal suffixes."""
    if not name or not isinstance(name, str):
        return ""
    cleaned = name.lower().strip()
    cleaned = COMPANY_SUFFIX_REGEX.sub("", cleaned)
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_job_title(title: Optional[str]) -> str:
    """Normalize job title for robust similarity checking."""
    if not title or not isinstance(title, str):
        return ""
    cleaned = title.lower().strip()
    # Remove parenthetical tags like (remote), (hybrid), (f/m/d), (req 1234)
    cleaned = re.sub(r"\([^)]*\)", "", cleaned)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    # Remove level/id clutter like "#12345" or "- R12345"
    cleaned = re.sub(r"[-–|/].*?(req|id|requisition|\d{4,}).*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_external_job_id(url: Optional[str]) -> Optional[str]:
    """Attempt to extract external job ID from URL structure (Greenhouse, Lever, etc.)."""
    if not url:
        return None
    try:
        parsed = urlparse(url)
        # Check query parameters for gh_jid, id, jobId, reqId
        queries = dict(parse_qsl(parsed.query))
        for key in ("gh_jid", "job_id", "jobId", "id", "requisitionId", "reqId"):
            if key in queries and queries[key].strip():
                return queries[key].strip()

        # Check path segments (e.g. /jobs/1234567 or /postings/abc-123)
        parts = [p for p in parsed.path.split("/") if p]
        if parts:
            last = parts[-1]
            # Match numeric IDs or UUID-like strings
            if re.match(r"^\d{5,12}$", last) or re.match(r"^[0-9a-fA-F-]{8,}$", last):
                return last
    except Exception:
        pass
    return None


class DuplicateDetectionService:
    @staticmethod
    def is_duplicate(
        discovered_job: Dict[str, Any],
        existing_discovered_jobs: List[Dict[str, Any]],
        existing_applications: List[Dict[str, Any]],
    ) -> Tuple[bool, str, Optional[Dict[str, Any]], bool]:
        """
        Check if discovered_job is a duplicate of any existing discovered job or application.
        
        Returns:
            (is_duplicate, duplicate_type, matched_item, is_already_applied)
        """
        cand_url = canonicalize_url(discovered_job.get("job_url"))
        cand_comp = normalize_company_name(discovered_job.get("company_name"))
        cand_title = normalize_job_title(discovered_job.get("job_title"))
        cand_ext_id = extract_external_job_id(discovered_job.get("job_url"))

        # 1. Check against existing Applications
        for app in existing_applications:
            app_url = canonicalize_url(app.get("job_url") or app.get("company_website"))
            app_comp = normalize_company_name(app.get("company_name"))
            app_title = normalize_job_title(app.get("job_title"))

            if cand_url and app_url and cand_url == app_url:
                return True, "application_url", app, True

            if cand_comp and cand_title and app_comp and app_title:
                if cand_comp == app_comp and (cand_title == app_title or cand_title in app_title or app_title in cand_title):
                    return True, "application_title_match", app, True

        # 2. Check against existing DiscoveredJobs
        for ej in existing_discovered_jobs:
            ej_url = canonicalize_url(ej.get("job_url"))
            ej_comp = normalize_company_name(ej.get("company_name"))
            ej_title = normalize_job_title(ej.get("job_title"))
            ej_ext_id = extract_external_job_id(ej.get("job_url"))

            # Check external ID match if present
            if cand_ext_id and ej_ext_id and cand_ext_id == ej_ext_id and cand_comp == ej_comp:
                return True, "external_id", ej, bool(ej.get("is_applied"))

            # Check canonical URL
            if cand_url and ej_url and cand_url == ej_url:
                return True, "canonical_url", ej, bool(ej.get("is_applied"))

            # Check company + title exact match
            if cand_comp and cand_title and ej_comp and ej_title:
                if cand_comp == ej_comp and cand_title == ej_title:
                    return True, "company_and_title", ej, bool(ej.get("is_applied"))

        return False, "none", None, False
