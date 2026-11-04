import json
import logging
import re
from typing import Any, Dict, List, Optional
from groq import Groq

logger = logging.getLogger("groq_service")


class GroqService:
    def __init__(self, api_key: Optional[str] = None, model: str = "llama-3.3-70b-versatile"):
        self.api_key = (api_key or "").strip()
        self.model = model
        self.client: Optional[Groq] = None

        if self.api_key:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                self.client = None

    def _ensure_client(self) -> Groq:
        if not self.client:
            raise ValueError(
                "Groq API key is not configured. Please set GROQ_API_KEY in your environment or .env file."
            )
        return self.client

    def _clean_json_response(self, text: str) -> str:
        """Strip markdown fences and whitespace from LLM response."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        return cleaned

    def extract_job_details(self, raw_text: str, url: str) -> Dict[str, Any]:
        """Call Groq to extract structured job info from raw webpage text."""
        client = self._ensure_client()

        # Truncate raw_text if excessively long to fit context window
        max_chars = 30000
        truncated_text = raw_text[:max_chars] if len(raw_text) > max_chars else raw_text

        system_prompt = (
            "You are an expert AI parser specializing in recruitment and job descriptions.\n"
            "Extract structured job information from the provided job webpage text.\n"
            "Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "company_name": "string or null",\n'
            '  "job_title": "string or null",\n'
            '  "job_description": "comprehensive summary or cleaned full text",\n'
            '  "location": "string or null (e.g. San Francisco, CA or Remote)",\n'
            '  "experience_required": "string or null (e.g. 3-5 years)",\n'
            '  "salary_range": "string or null (e.g. $120,000 - $150,000/yr)",\n'
            '  "employment_type": "FullTime | PartTime | Contract | Internship | Freelance | null",\n'
            '  "work_mode": "Remote | Hybrid | Onsite | null",\n'
            '  "required_skills": ["list", "of", "required", "skills"],\n'
            '  "preferred_skills": ["list", "of", "nice", "to", "have", "skills"],\n'
            '  "education_requirements": "string or null (e.g. BS in Computer Science or equivalent)",\n'
            '  "responsibilities": ["key", "job", "responsibilities"],\n'
            '  "company_website": "string or null"\n'
            "}\n"
            "Do not include any explanation or markdown formatting outside the JSON."
        )

        user_prompt = f"Job Posting URL: {url}\n\nWebpage Content:\n{truncated_text}"

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            raw_content = completion.choices[0].message.content or "{}"
            parsed = json.loads(self._clean_json_response(raw_content))
            parsed["job_url"] = url
            return parsed
        except Exception as e:
            logger.error(f"Error calling Groq for job details extraction: {e}")
            raise RuntimeError(f"Groq job extraction failed: {str(e)}")

    def analyze_resume_vs_job(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """Analyze resume against job description, return AnalysisResult dict."""
        client = self._ensure_client()

        system_prompt = (
            "You are a Senior Technical Recruiter and ATS (Applicant Tracking System) Evaluation Expert.\n"
            "Analyze the candidate's resume against the target job description.\n"
            "Calculate realistic, objective match scores and actionable recommendations.\n"
            "Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "match_score": 0.0 to 100.0 (overall match percentage),\n'
            '  "technical_skills_match": 0.0 to 100.0,\n'
            '  "experience_match": 0.0 to 100.0,\n'
            '  "education_match": 0.0 to 100.0,\n'
            '  "matched_skills": ["skills", "present", "in", "both"],\n'
            '  "missing_skills": ["important", "skills", "in", "job", "missing", "from", "resume"],\n'
            '  "preferred_skills": ["preferred", "or", "bonus", "skills", "identified"],\n'
            '  "keyword_coverage": 0.0 to 100.0 (ATS keyword match),\n'
            '  "suggestions": ["specific", "actionable", "suggestions", "to", "improve", "resume", "and", "candidacy"],\n'
            '  "project_relevance": "detailed assessment of how well past projects match the role",\n'
            '  "summary": "concise executive assessment of fit"\n'
            "}"
        )

        user_prompt = (
            f"--- CANDIDATE RESUME ---\n{resume_text[:20000]}\n\n"
            f"--- TARGET JOB DESCRIPTION ---\n{job_description[:20000]}"
        )

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw_content = completion.choices[0].message.content or "{}"
            result = json.loads(self._clean_json_response(raw_content))

            # Ensure all numeric fields are floats
            for num_field in ["match_score", "technical_skills_match", "experience_match", "education_match", "keyword_coverage"]:
                if num_field in result:
                    result[num_field] = float(result[num_field])
                else:
                    result[num_field] = 0.0

            # Ensure lists are lists
            for list_field in ["matched_skills", "missing_skills", "preferred_skills", "suggestions"]:
                if list_field not in result or not isinstance(result[list_field], list):
                    result[list_field] = []

            return result
        except Exception as e:
            logger.error(f"Error during resume analysis with Groq: {e}")
            raise RuntimeError(f"Resume analysis failed: {str(e)}")

    def chat(self, message: str, history: List[Dict[str, str]], context: Dict[str, Any]) -> str:
        """General chat with job application context."""
        client = self._ensure_client()

        context_str = json.dumps(context, indent=2, default=str)
        system_prompt = (
            "You are an expert AI Career Coach and Application Assistant for Autumn Suite.\n"
            "You help users manage their job search, prepare for interviews, optimize applications, and stay motivated.\n"
            f"Current User Workspace Context & Metrics:\n{context_str}\n\n"
            "Guidelines:\n"
            "- Be concise, encouraging, and highly practical.\n"
            "- Refer to real metrics and applications from the context when relevant.\n"
            "- If the user asks about specific companies, check if they are in their tracked applications.\n"
            "- Provide clear next steps and strategies."
        )

        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            )
            return completion.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"Error in Groq chat: {e}")
            raise RuntimeError(f"Assistant chat failed: {str(e)}")

    def generate_interview_questions(self, job_description: str) -> List[Dict[str, Any]]:
        """Generate categorized interview questions for a job."""
        client = self._ensure_client()

        system_prompt = (
            "You are a Principal Hiring Manager and Interview Specialist.\n"
            "Based on the provided job description, generate 10 comprehensive interview questions.\n"
            "Include technical questions, behavioral questions (STAR method), and role-specific situational questions.\n"
            "Respond ONLY with a JSON array of objects:\n"
            "[\n"
            "  {\n"
            '    "category": "Technical | Behavioral | Situational | Architecture",\n'
            '    "question": "Question text",\n'
            '    "key_points": "What interviewers look for",\n'
            '    "sample_answer_outline": "Guidance on how to structure a strong answer"\n'
            "  }\n"
            "]"
        )

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Job Description:\n{job_description[:20000]}"},
                ],
                temperature=0.3,
            )
            raw_content = completion.choices[0].message.content or "[]"
            cleaned = self._clean_json_response(raw_content)
            data = json.loads(cleaned)
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "questions" in data:
                return data["questions"]
            return []
        except Exception as e:
            logger.error(f"Error generating interview questions: {e}")
            raise RuntimeError(f"Failed to generate interview questions: {str(e)}")

    def generate_followup_email(self, application: Dict[str, Any]) -> str:
        """Draft a tailored follow-up email for an application."""
        client = self._ensure_client()

        company = application.get("company_name", "the company")
        job_title = application.get("job_title", "the position")
        recruiter = application.get("recruiter_name", "Hiring Team")
        date_applied = application.get("date_applied", "recently")
        status = application.get("application_status", "Applied")

        prompt = (
            f"Draft a polite, professional, and impactful follow-up email for a job application.\n"
            f"Role: {job_title}\n"
            f"Company: {company}\n"
            f"Recruiter / Hiring Contact: {recruiter}\n"
            f"Date Applied: {date_applied}\n"
            f"Current Status: {status}\n\n"
            "Output the email with Subject Line and Email Body ready to copy and send."
        )

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional business communication and career coach."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
            )
            return completion.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"Error generating follow-up email: {e}")
            raise RuntimeError(f"Failed to generate follow-up email: {str(e)}")

    def analyze_job_description(self, job_description: str) -> Dict[str, Any]:
        """Extract key requirements, skills, and summary from a JD."""
        client = self._ensure_client()

        system_prompt = (
            "You are an expert technical talent scout.\n"
            "Analyze the provided job description and extract key insights.\n"
            "Return ONLY a JSON object with this schema:\n"
            "{\n"
            '  "role_summary": "1-2 sentence executive overview of the role",\n'
            '  "core_technologies": ["primary", "tech", "stack"],\n'
            '  "must_have_qualifications": ["essential", "requirements"],\n'
            '  "nice_to_have_qualifications": ["preferred", "pluses"],\n'
            '  "key_responsibilities": ["top", "duties"],\n'
            '  "culture_and_benefits": ["insights", "on", "culture", "or", "perks"]\n'
            "}"
        )

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Job Description:\n{job_description[:25000]}"},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw_content = completion.choices[0].message.content or "{}"
            return json.loads(self._clean_json_response(raw_content))
        except Exception as e:
            logger.error(f"Error analyzing job description: {e}")
            raise RuntimeError(f"Failed to analyze job description: {str(e)}")
