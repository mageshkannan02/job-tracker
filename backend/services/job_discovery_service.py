import asyncio
import json
import logging
import re
import urllib.robotparser
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from config import settings
from services import excel_service, extractor_service, resume_service
from services.duplicate_detection_service import (
    DuplicateDetectionService,
    canonicalize_url,
    normalize_company_name,
)
from services.groq_service import GroqService

logger = logging.getLogger("job_discovery_service")

# Concurrency semaphore for web requests
REQUEST_SEMAPHORE = asyncio.Semaphore(4)
ROBOTS_CACHE: Dict[str, urllib.robotparser.RobotFileParser] = {}


def check_robots_allowed(url: str, user_agent: str = "*") -> bool:
    """Check whether robots.txt allows crawling the given URL."""
    try:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        if base not in ROBOTS_CACHE:
            robots_url = f"{base}/robots.txt"
            rp = urllib.robotparser.RobotFileParser()
            try:
                resp = requests.get(robots_url, headers=extractor_service.DEFAULT_HEADERS, timeout=5)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                else:
                    rp.allow_all = True
            except Exception:
                rp.allow_all = True
            ROBOTS_CACHE[base] = rp
        return ROBOTS_CACHE[base].can_fetch(user_agent, url)
    except Exception as e:
        logger.debug(f"robots.txt check error for {url}: {e}")
        return True


# =====================================================================
# Source-Specific Adapters
# =====================================================================

class BaseJobSourceAdapter(ABC):
    """Abstract base class for all job discovery source adapters."""
    name: str = "Base"

    @abstractmethod
    def can_handle(self, company: Dict[str, Any]) -> bool:
        """Return True if this adapter can discover jobs for this company."""
        pass

    @abstractmethod
    async def discover_jobs(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        """Return list of discovered raw job listings."""
        pass


class GreenhouseAdapter(BaseJobSourceAdapter):
    name = "Greenhouse"

    def _extract_board_token(self, company: Dict[str, Any]) -> Optional[str]:
        careers_url = str(company.get("careers_url") or company.get("website") or "")
        # Match boards.greenhouse.io/<token> or greenhouse.io/embed/job_board?for=<token>
        match = re.search(r"boards\.greenhouse\.io/(?:embed/job_board\?for=)?([a-zA-Z0-9_-]+)", careers_url, re.IGNORECASE)
        if match:
            return match.group(1).lower()

        match_embed = re.search(r"[?&]for=([a-zA-Z0-9_-]+)", careers_url, re.IGNORECASE)
        if match_embed:
            return match_embed.group(1).lower()

        # Check company name slug
        comp_slug = re.sub(r"[^\w]", "", str(company.get("company_name", "")).lower())
        return comp_slug if comp_slug in ("stripe", "figma", "airbnb", "reddit", "datadog", "brex", "affirm") else None

    def can_handle(self, company: Dict[str, Any]) -> bool:
        return self._extract_board_token(company) is not None

    async def discover_jobs(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        board_token = self._extract_board_token(company)
        if not board_token:
            return []

        api_url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
        logger.info(f"GreenhouseAdapter querying public API for '{company.get('company_name')}': {api_url}")

        async with REQUEST_SEMAPHORE:
            def _fetch():
                resp = requests.get(api_url, headers=extractor_service.DEFAULT_HEADERS, timeout=12)
                if resp.status_code == 200:
                    return resp.json().get("jobs", [])
                return []

            try:
                jobs_data = await asyncio.to_thread(_fetch)
            except Exception as e:
                logger.warning(f"Greenhouse fetch failed for {board_token}: {e}")
                return []

        results = []
        kw_regexes = [re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE) for kw in search_keywords if kw]

        for item in jobs_data:
            title = item.get("title", "")
            loc = (item.get("location") or {}).get("name", "")
            content = item.get("content", "")
            job_url = item.get("absolute_url") or f"https://boards.greenhouse.io/{board_token}/jobs/{item.get('id')}"

            # Check keyword match
            if kw_regexes:
                text_to_match = f"{title} {content[:500]}"
                if not any(rx.search(text_to_match) for rx in kw_regexes):
                    continue

            # Strip html in description
            soup = BeautifulSoup(content, "html.parser")
            clean_desc = soup.get_text(separator="\n", strip=True)

            results.append({
                "job_id": str(item.get("id")),
                "company_name": company.get("company_name"),
                "job_title": title,
                "job_url": job_url,
                "description": clean_desc[:10000] if clean_desc else title,
                "location": loc,
                "employment_type": "FullTime",
                "work_mode": "Remote" if "remote" in loc.lower() or "remote" in title.lower() else "Hybrid",
                "source": "Greenhouse Public API",
                "posted_date": str(item.get("updated_at") or "")[:10] or None,
            })

        return results


class LeverAdapter(BaseJobSourceAdapter):
    name = "Lever"

    def _extract_site_token(self, company: Dict[str, Any]) -> Optional[str]:
        careers_url = str(company.get("careers_url") or company.get("website") or "")
        match = re.search(r"jobs\.lever\.co/([a-zA-Z0-9_-]+)", careers_url, re.IGNORECASE)
        if match:
            return match.group(1).lower()

        comp_slug = re.sub(r"[^\w]", "", str(company.get("company_name", "")).lower())
        return comp_slug if comp_slug in ("netflix", "spotify", "palantir", "atlassian") else None

    def can_handle(self, company: Dict[str, Any]) -> bool:
        return self._extract_site_token(company) is not None

    async def discover_jobs(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        site = self._extract_site_token(company)
        if not site:
            return []

        api_url = f"https://api.lever.co/v0/postings/{site}?mode=json"
        logger.info(f"LeverAdapter querying public API for '{company.get('company_name')}': {api_url}")

        async with REQUEST_SEMAPHORE:
            def _fetch():
                resp = requests.get(api_url, headers=extractor_service.DEFAULT_HEADERS, timeout=12)
                if resp.status_code == 200:
                    return resp.json()
                return []

            try:
                jobs_data = await asyncio.to_thread(_fetch)
            except Exception as e:
                logger.warning(f"Lever fetch failed for {site}: {e}")
                return []

        results = []
        kw_regexes = [re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE) for kw in search_keywords if kw]

        for item in jobs_data:
            title = item.get("text", "")
            categories = item.get("categories") or {}
            loc = categories.get("location") or ""
            commitment = categories.get("commitment") or "FullTime"
            workplace = item.get("workplaceType") or "hybrid"
            desc_plain = item.get("descriptionPlain") or ""
            job_url = item.get("hostedUrl") or item.get("applyUrl") or ""

            if kw_regexes:
                text_to_match = f"{title} {desc_plain[:500]}"
                if not any(rx.search(text_to_match) for rx in kw_regexes):
                    continue

            results.append({
                "job_id": str(item.get("id")),
                "company_name": company.get("company_name"),
                "job_title": title,
                "job_url": job_url,
                "description": desc_plain[:10000] if desc_plain else title,
                "location": loc,
                "employment_type": commitment,
                "work_mode": "Remote" if workplace.lower() == "remote" or "remote" in loc.lower() else "Hybrid",
                "source": "Lever Public API",
                "posted_date": datetime.utcfromtimestamp(item.get("createdAt", 0) / 1000).strftime("%Y-%m-%d") if item.get("createdAt") else None,
            })

        return results


class CareerPageScraperAdapter(BaseJobSourceAdapter):
    name = "CareerPageScraper"

    def can_handle(self, company: Dict[str, Any]) -> bool:
        url = company.get("careers_url") or company.get("website")
        return bool(url and url.startswith("http"))

    async def discover_jobs(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        url = company.get("careers_url") or company.get("website")
        if not url:
            return []

        if not check_robots_allowed(url):
            logger.info(f"Skipping {url} as disallowed by robots.txt")
            return []

        logger.info(f"CareerPageScraperAdapter inspecting public careers page: {url}")
        results = []

        try:
            valid_url = extractor_service.validate_url(url)
            text_content, method = await extractor_service.extract_job_text(valid_url)
        except Exception as e:
            logger.warning(f"Could not load career page {url}: {e}")
            return []

        # Parse links using BeautifulSoup on the raw response
        def _get_links():
            try:
                resp = requests.get(valid_url, headers=extractor_service.DEFAULT_HEADERS, timeout=10)
                if resp.status_code != 200:
                    return []
                soup = BeautifulSoup(resp.content, "html.parser")
                found = []
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    title = a.get_text(separator=" ", strip=True)
                    full_link = urljoin(valid_url, href)
                    if any(p in full_link.lower() for p in ("/job/", "/jobs/", "/careers/", "/position/", "/opening/", "/role/")):
                        if len(title) > 3 and not any(skip in title.lower() for skip in ("cookie", "privacy", "sign in", "login", "view all", "next", "previous")):
                            found.append((full_link, title))
                return found
            except Exception:
                return []

        candidate_links = await asyncio.to_thread(_get_links)

        kw_regexes = [re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE) for kw in search_keywords if kw]

        seen_urls = set()
        for link, title in candidate_links[:15]:
            c_url = canonicalize_url(link)
            if c_url in seen_urls:
                continue
            seen_urls.add(c_url)

            if kw_regexes and not any(rx.search(title) for rx in kw_regexes):
                continue

            results.append({
                "job_id": None,
                "company_name": company.get("company_name"),
                "job_title": title or "Software Engineer / Tech Role",
                "job_url": link,
                "description": f"Position at {company.get('company_name')} discovered on careers page.",
                "location": "India / Remote",
                "employment_type": "FullTime",
                "work_mode": "Hybrid",
                "source": "Company Career Page",
                "posted_date": None,
            })

        return results


class LinkedInAlertAdapter(BaseJobSourceAdapter):
    """
    Adapter to ingest user-configured LinkedIn job alert emails or notification text.
    Strict compliance:
      - Does NOT scrape authenticated LinkedIn pages.
      - Does NOT request LinkedIn credentials or cookies.
      - Does NOT bypass CAPTCHAs or site boundaries.
      - Simply parses the user's alert text or email format into structured listings.
    """
    name = "LinkedInJobAlert"

    def can_handle(self, company: Dict[str, Any]) -> bool:
        return False  # Invoked directly via ingest_alert_text

    async def discover_jobs(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        return []

    def parse_alert_text(self, text: str, source: str = "LinkedIn Job Alert") -> List[Dict[str, Any]]:
        """Parse text copied from a LinkedIn job alert email or web alert notification."""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        jobs = []

        # Find URLs and surrounding titles/companies
        url_pattern = re.compile(r"https?://(?:www\.)?linkedin\.com/jobs/view/(\d+)[^\s]*")
        for i, line in enumerate(lines):
            match = url_pattern.search(line)
            if match:
                job_url = match.group(0)
                ext_id = match.group(1)
                # Look backwards for title and company
                title = "Software Engineer"
                comp = "Unknown Company"
                loc = "Remote / India"

                for prev_idx in range(max(0, i - 3), i):
                    prev = lines[prev_idx]
                    if " at " in prev:
                        parts = prev.split(" at ", 1)
                        title = parts[0].strip()
                        comp = parts[1].strip()
                    elif not any(x in prev.lower() for x in ("job", "alert", "notification", "view", "apply")):
                        if prev_idx == i - 1 and len(prev) < 60:
                            comp = prev

                jobs.append({
                    "job_id": ext_id,
                    "company_name": comp,
                    "job_title": title,
                    "job_url": job_url,
                    "description": f"LinkedIn Alert: {title} at {comp}",
                    "location": loc,
                    "employment_type": "FullTime",
                    "work_mode": "Hybrid",
                    "source": source,
                    "posted_date": datetime.utcnow().strftime("%Y-%m-%d"),
                })

        return jobs


# =====================================================================
# Main Job Discovery Service
# =====================================================================

class JobDiscoveryService:
    def __init__(self, groq_service: Optional[GroqService] = None):
        self.groq_service = groq_service or GroqService(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )
        self.adapters: List[BaseJobSourceAdapter] = [
            GreenhouseAdapter(),
            LeverAdapter(),
            CareerPageScraperAdapter(),
        ]
        self.alert_adapter = LinkedInAlertAdapter()

    def register_adapter(self, adapter: BaseJobSourceAdapter) -> None:
        """Allow plugins or custom adapters to be plugged in dynamically."""
        self.adapters.insert(0, adapter)

    async def run_discovery_for_company(
        self,
        company: Dict[str, Any],
        search_keywords: List[str],
        preferred_locations: List[str],
    ) -> List[Dict[str, Any]]:
        """Run through registered adapters for a single company."""
        comp_keywords = company.get("search_keywords") or search_keywords
        if isinstance(comp_keywords, str):
            comp_keywords = [k.strip() for k in comp_keywords.split(",") if k.strip()]

        for adapter in self.adapters:
            if adapter.can_handle(company):
                try:
                    logger.info(f"Using {adapter.name} for company: {company.get('company_name')}")
                    jobs = await adapter.discover_jobs(company, comp_keywords, preferred_locations)
                    if jobs:
                        return jobs
                except Exception as e:
                    logger.error(f"Adapter {adapter.name} error for {company.get('company_name')}: {e}")
        return []

    def evaluate_match_with_groq(
        self,
        job_description: str,
        resume_text: str,
    ) -> Dict[str, Any]:
        """
        Analyze job description against resume using Groq AI.
        Falls back gracefully to intelligent keyword evaluation if Groq is unavailable.
        """
        if self.groq_service.client and resume_text and job_description:
            try:
                system_prompt = (
                    "You are a Senior Technical Recruiter and ATS Matching Engine.\n"
                    "Compare the candidate's resume with the job description.\n"
                    "Provide an objective, realistic compatibility evaluation.\n"
                    "Never invent skills that are not explicitly in the text.\n"
                    "Respond ONLY with valid JSON in this exact structure:\n"
                    "{\n"
                    '  "overall_compatibility_score": 0.0 to 100.0,\n'
                    '  "technical_skill_match": 0.0 to 100.0,\n'
                    '  "matched_skills": ["list of skills found in both"],\n'
                    '  "missing_skills": ["important skills required but missing from resume"],\n'
                    '  "experience_compatibility": "Strong | Moderate | Growth Opportunity",\n'
                    '  "job_relevance": "High | Medium | Low",\n'
                    '  "recommended_action": "Apply Immediately | Tailor Resume First | Review Skills | Skip"\n'
                    "}"
                )
                user_prompt = (
                    f"--- CANDIDATE RESUME ---\n{resume_text[:12000]}\n\n"
                    f"--- JOB DESCRIPTION ---\n{job_description[:12000]}"
                )
                completion = self.groq_service.client.chat.completions.create(
                    model=self.groq_service.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"},
                )
                content = completion.choices[0].message.content or "{}"
                data = json.loads(self.groq_service._clean_json_response(content))

                return {
                    "overall_compatibility_score": float(data.get("overall_compatibility_score") or 0.0),
                    "technical_skill_match": float(data.get("technical_skill_match") or 0.0),
                    "matched_skills": list(data.get("matched_skills") or []),
                    "missing_skills": list(data.get("missing_skills") or []),
                    "experience_compatibility": str(data.get("experience_compatibility") or "Moderate"),
                    "job_relevance": str(data.get("job_relevance") or "Medium"),
                    "recommended_action": str(data.get("recommended_action") or "Review Skills"),
                }
            except Exception as e:
                logger.warning(f"Groq matching failed, falling back to heuristic: {e}")

        # Intelligent ATS Heuristic Fallback
        return self._heuristic_match(job_description, resume_text)

    def _heuristic_match(self, job_description: str, resume_text: str) -> Dict[str, Any]:
        """Local keyword heuristic when Groq client is not initialized."""
        known_techs = [
            "python", "java", "c++", "c#", "go", "golang", "javascript", "typescript",
            "react", "angular", "vue", "node", "nodejs", "aws", "azure", "gcp",
            "docker", "kubernetes", "sql", "postgresql", "mysql", "mongodb", "redis",
            "kafka", "microservices", "ci/cd", "rest", "graphql", "git", "linux", "fastapi"
        ]
        job_lower = (job_description or "").lower()
        res_lower = (resume_text or "").lower()

        required = [t for t in known_techs if re.search(r"\b" + re.escape(t) + r"\b", job_lower)]
        if not required:
            required = ["software engineering", "backend", "cloud"]

        matched = [t.capitalize() for t in required if re.search(r"\b" + re.escape(t) + r"\b", res_lower)]
        missing = [t.capitalize() for t in required if not re.search(r"\b" + re.escape(t) + r"\b", res_lower)]

        if not required:
            score = 65.0
        else:
            score = round((len(matched) / max(1, len(required))) * 100.0, 1)

        action = "Apply Immediately" if score >= 75 else ("Tailor Resume First" if score >= 50 else "Review Skills")
        relevance = "High" if score >= 75 else ("Medium" if score >= 50 else "Low")

        return {
            "overall_compatibility_score": score,
            "technical_skill_match": score,
            "matched_skills": matched,
            "missing_skills": missing,
            "experience_compatibility": "Moderate",
            "job_relevance": relevance,
            "recommended_action": action,
        }

    async def execute_discovery_run(
        self,
        companies: Optional[List[Dict[str, Any]]] = None,
        search_keywords: Optional[List[str]] = None,
        preferred_locations: Optional[List[str]] = None,
        min_match_score: int = 60,
        selected_resume_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute full discovery cycle over monitored companies."""
        start_time = datetime.utcnow()
        excel_path = settings.excel_path

        # Load companies if not provided
        if companies is None:
            all_comps = excel_service.read_monitored_companies(excel_path)
            companies = [c for c in all_comps if c.get("monitoring_enabled", True)]

        # If still no companies, sync from Applications sheet
        if not companies:
            excel_service.sync_companies_from_applications(excel_path)
            all_comps = excel_service.read_monitored_companies(excel_path)
            companies = [c for c in all_comps if c.get("monitoring_enabled", True)]

        target_keywords = search_keywords or ["Software Engineer", "Frontend", "Backend", "Full Stack", "DevOps"]
        locations = preferred_locations or ["Bengaluru", "Hyderabad", "Remote", "Chennai", "Pune"]

        # Load candidate resume text
        resume_text = ""
        try:
            if selected_resume_id:
                resume_text = resume_service.get_resume_text(selected_resume_id, settings.resume_dir)
            else:
                all_resumes = resume_service.get_all_resumes(settings.resume_dir)
                if all_resumes:
                    resume_text = resume_service.get_resume_text(all_resumes[0]["resume_id"], settings.resume_dir)
        except Exception as e:
            logger.warning(f"Could not load resume text: {e}")

        existing_discovered = excel_service.read_discovered_jobs(excel_path)
        existing_applications = excel_service.read_applications(excel_path)

        new_jobs_found = 0
        jobs_matching_resume = 0
        highest_score = 0.0
        failed_sources = []
        newly_saved_jobs = []

        logger.info(f"Starting discovery run across {len(companies)} monitored companies...")

        for comp in companies:
            comp_name = comp.get("company_name", "Unknown")
            try:
                raw_jobs = await self.run_discovery_for_company(comp, target_keywords, locations)
                # Update last_checked for company
                excel_service.update_monitored_company(
                    excel_path,
                    comp.get("company_id"),
                    {"last_checked": datetime.utcnow().isoformat()},
                )

                for rj in raw_jobs:
                    # Check duplicate
                    is_dup, dup_type, existing_item, is_applied = DuplicateDetectionService.is_duplicate(
                        rj, existing_discovered, existing_applications
                    )

                    if is_dup and is_applied:
                        continue  # Already applied, skip

                    # Evaluate Groq match
                    desc = rj.get("description") or rj.get("job_title") or ""
                    match_result = self.evaluate_match_with_groq(desc, resume_text)
                    score = match_result["overall_compatibility_score"]

                    if score > highest_score:
                        highest_score = score

                    job_record = {
                        "discovered_job_id": rj.get("job_id"),
                        "company_name": comp_name,
                        "job_title": rj.get("job_title"),
                        "job_url": rj.get("job_url"),
                        "description": desc,
                        "location": rj.get("location") or "Remote / Hybrid",
                        "experience": rj.get("experience") or "0-4 years",
                        "employment_type": rj.get("employment_type") or "FullTime",
                        "work_mode": rj.get("work_mode") or "Hybrid",
                        "salary": rj.get("salary"),
                        "required_skills": match_result.get("matched_skills", []) + match_result.get("missing_skills", []),
                        "posted_date": rj.get("posted_date"),
                        "discovered_date": datetime.utcnow().strftime("%Y-%m-%d"),
                        "source": rj.get("source") or "Company Careers Page",
                        "match_score": score,
                        "matched_skills": match_result.get("matched_skills", []),
                        "missing_skills": match_result.get("missing_skills", []),
                        "is_new": not is_dup,
                        "is_applied": is_applied,
                        "last_verified": datetime.utcnow().isoformat(),
                    }

                    saved = excel_service.save_discovered_job(excel_path, job_record)
                    if not is_dup:
                        new_jobs_found += 1
                        newly_saved_jobs.append(saved)
                        if score >= min_match_score:
                            jobs_matching_resume += 1

            except Exception as comp_err:
                logger.error(f"Discovery error for company '{comp_name}': {comp_err}")
                failed_sources.append({"company": comp_name, "error": str(comp_err)})

        duration = (datetime.utcnow() - start_time).total_seconds()
        summary_text = (
            f"Checked {len(companies)} companies. Discovered {new_jobs_found} new opportunities. "
            f"{jobs_matching_resume} matched your resume (score >= {min_match_score}%)."
        )

        run_summary = {
            "run_id": f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "timestamp": datetime.utcnow().isoformat(),
            "status": "completed" if not failed_sources else "completed_with_warnings",
            "companies_checked": len(companies),
            "new_jobs_found": new_jobs_found,
            "jobs_matching_resume": jobs_matching_resume,
            "highest_matching_score": highest_score,
            "failed_sources": failed_sources,
            "duration_seconds": round(duration, 2),
            "summary": summary_text,
            "newly_saved_jobs": newly_saved_jobs,
        }

        # Create in-app notification if new jobs found
        if new_jobs_found > 0:
            try:
                from services import notification_service
                notification_service.create_inapp_notification(
                    type="job_watcher_digest",
                    title="AI Job Watcher: New Opportunities Discovered",
                    message=summary_text,
                )
            except Exception as e:
                logger.warning(f"Could not create in-app notification: {e}")

        return run_summary
