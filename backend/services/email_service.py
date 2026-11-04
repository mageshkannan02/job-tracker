import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Union

from config import settings
from services import excel_service

logger = logging.getLogger("email_service")


def get_smtp_config(override_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Retrieve SMTP configuration merging Excel settings, config defaults, and overrides."""
    excel_cfg = {}
    try:
        excel_cfg = excel_service.get_settings(settings.excel_path)
    except Exception as e:
        logger.warning(f"Could not load settings from Excel: {e}")

    def _get_val(key: str, default: Any) -> Any:
        if override_config and override_config.get(key) is not None and override_config.get(key) != "":
            return override_config[key]
        if key in excel_cfg and excel_cfg[key] is not None and excel_cfg[key] != "":
            return excel_cfg[key]
        return getattr(settings, key, default)

    # Boolean helpers
    def _get_bool(key: str, default: bool) -> bool:
        v = _get_val(key, default)
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    smtp_host = str(_get_val("smtp_host", "smtp.gmail.com")).strip()
    try:
        smtp_port = int(_get_val("smtp_port", 587))
    except (ValueError, TypeError):
        smtp_port = 587

    smtp_username = str(_get_val("smtp_username", "")).strip()
    smtp_password = str(_get_val("smtp_password", "")).strip()
    smtp_use_tls = _get_bool("smtp_use_tls", True)
    email_enabled = _get_bool("email_enabled", False)

    notification_sender_email = str(_get_val("notification_sender_email", "")).strip()
    if not notification_sender_email:
        notification_sender_email = smtp_username

    notification_recipient_email = str(_get_val("notification_recipient_email", "")).strip()

    return {
        "email_enabled": email_enabled,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_username": smtp_username,
        "smtp_password": smtp_password,
        "smtp_use_tls": smtp_use_tls,
        "notification_sender_email": notification_sender_email,
        "notification_recipient_email": notification_recipient_email,
    }


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send an email using SMTP credentials with HTML and plain-text fallback."""
    cfg = get_smtp_config(config)

    target_email = to_email or cfg.get("notification_recipient_email")
    if not target_email or not target_email.strip():
        raise ValueError("Recipient email address is required.")

    target_email = target_email.strip()
    sender_email = cfg.get("notification_sender_email") or cfg.get("smtp_username") or "noreply@jobtracker.local"
    smtp_host = cfg.get("smtp_host")
    smtp_port = cfg.get("smtp_port", 587)
    username = cfg.get("smtp_username")
    password = cfg.get("smtp_password")
    use_tls = cfg.get("smtp_use_tls", True)

    if not smtp_host:
        raise ValueError("SMTP host is not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Autumn Suite <{sender_email}>"
    msg["To"] = target_email
    msg["Date"] = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")

    # Plain text fallback
    if not text_body:
        text_body = "You have a new notification from Autumn Suite. Please open the dashboard to view details."
    msg.attach(MIMEText(text_body, "plain", "utf-8"))

    # HTML part
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        logger.info(f"Connecting to SMTP server {smtp_host}:{smtp_port} (TLS={use_tls})...")
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            if use_tls:
                server.ehlo()
                server.starttls()
                server.ehlo()

        if username and password:
            server.login(username, password)

        server.sendmail(sender_email, [target_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully sent email '{subject}' to {target_email}")
        return {
            "success": True,
            "message": f"Email successfully sent to {target_email}",
            "recipient": target_email,
            "subject": subject,
        }
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication error: {e}")
        raise ValueError(f"SMTP Authentication failed. Please check your username and app password. Error: {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}")
    except smtplib.SMTPConnectError as e:
        logger.error(f"SMTP Connection error: {e}")
        raise ValueError(f"Failed to connect to SMTP server {smtp_host}:{smtp_port}. Error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        raise ValueError(f"Failed to send email: {str(e)}")


def _get_base_email_html(title: str, content_html: str, callout_badge: str = "Notification") -> str:
    """Wrap content in an attractive, mobile-responsive HTML email template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }}
    .email-container {{
      max-width: 600px;
      margin: 24px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }}
    .header {{
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      padding: 24px 32px;
      color: #ffffff;
    }}
    .header-tag {{
      display: inline-block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      background-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 20px;
      margin-bottom: 8px;
    }}
    .header h1 {{
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
    }}
    .body-content {{
      padding: 32px;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }}
    .badge-urgent {{
      background-color: #fee2e2;
      color: #b91c1c;
    }}
    .badge-warning {{
      background-color: #fef3c7;
      color: #b45309;
    }}
    .badge-info {{
      background-color: #dbeafe;
      color: #1d4ed8;
    }}
    .badge-success {{
      background-color: #dcfce7;
      color: #15803d;
    }}
    .card-box {{
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
    }}
    .row {{
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 13px;
    }}
    .row:last-child {{
      border-bottom: none;
    }}
    .label {{
      color: #64748b;
      font-weight: 500;
    }}
    .val {{
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }}
    .cta-btn {{
      display: inline-block;
      margin-top: 24px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
    }}
    .footer {{
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }}
    .footer a {{
      color: #2563eb;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="header-tag">{callout_badge}</div>
      <h1>{title}</h1>
    </div>
    <div class="body-content">
      {content_html}
    </div>
    <div class="footer">
      Sent by <strong>Autumn Suite</strong> &bull; Local Career Pipeline Assistant<br>
      You can manage your notification preferences in the Settings page.
    </div>
  </div>
</body>
</html>"""


def send_test_email(
    recipient_email: Optional[str] = None,
    custom_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send an instant test email to verify SMTP configuration."""
    cfg = get_smtp_config(custom_config)
    target = recipient_email or cfg.get("notification_recipient_email")
    if not target:
        raise ValueError("No recipient email specified for test email.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = "Autumn Suite - SMTP Test Notification"

    content = f"""
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
      Hello! This is a test message confirming that your email notification settings in <strong>Autumn Suite</strong> are working properly.
    </p>

    <div class="card-box">
      <div class="row">
        <span class="label">Status</span>
        <span class="val"><span class="badge badge-success">&#10003; Connected & Verified</span></span>
      </div>
      <div class="row">
        <span class="label">SMTP Server</span>
        <span class="val">{cfg.get('smtp_host')}:{cfg.get('smtp_port')}</span>
      </div>
      <div class="row">
        <span class="label">Sender Address</span>
        <span class="val">{cfg.get('notification_sender_email')}</span>
      </div>
      <div class="row">
        <span class="label">Recipient Address</span>
        <span class="val">{target}</span>
      </div>
      <div class="row">
        <span class="label">TLS Encryption</span>
        <span class="val">{'Enabled' if cfg.get('smtp_use_tls') else 'Disabled'}</span>
      </div>
      <div class="row">
        <span class="label">Test Timestamp</span>
        <span class="val">{now_str}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      You will receive alerts here for upcoming interview deadlines, overdue follow-up tasks, and key status changes.
    </p>

    <center>
      <a href="http://127.0.0.1:5173/dashboard" class="cta-btn">Open Autumn Suite</a>
    </center>
    """

    html = _get_base_email_html("SMTP Verification Test", content, callout_badge="Test Notification")
    return send_email(target, subject, html, config=cfg)


def send_followup_reminder_email(
    to_email: str,
    followup: Dict[str, Any],
    application: Optional[Dict[str, Any]] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send reminder email for an upcoming or overdue follow-up task."""
    task = followup.get("task", "Follow up on job application")
    due_date = str(followup.get("followup_date", "Today"))[:10]
    notes = followup.get("notes") or ""

    company = application.get("company_name", "Company") if application else "Company"
    job_title = application.get("job_title", "Position") if application else ""

    subject = f"Follow-Up Reminder: {task} ({company})"

    content = f"""
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
      You have a scheduled follow-up reminder for <strong>{company}</strong>:
    </p>

    <div class="card-box">
      <div class="row">
        <span class="label">Task</span>
        <span class="val">{task}</span>
      </div>
      <div class="row">
        <span class="label">Company</span>
        <span class="val">{company}</span>
      </div>
      {f'<div class="row"><span class="label">Role</span><span class="val">{job_title}</span></div>' if job_title else ''}
      <div class="row">
        <span class="label">Due Date</span>
        <span class="val"><span class="badge badge-warning">{due_date}</span></span>
      </div>
      {f'<div class="row"><span class="label">Notes</span><span class="val">{notes}</span></div>' if notes else ''}
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      Staying prompt on follow-ups significantly increases recruiter response rates and keeps you top-of-mind.
    </p>

    <center>
      <a href="http://127.0.0.1:5173/applications" class="cta-btn">View in Autumn Suite</a>
    </center>
    """

    html = _get_base_email_html(f"Follow-Up Due: {company}", content, callout_badge="Task Reminder")
    return send_email(to_email, subject, html, config=config)


def send_interview_reminder_email(
    to_email: str,
    application: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send reminder email for an upcoming interview."""
    company = application.get("company_name", "Company")
    job_title = application.get("job_title", "Position")
    recruiter = application.get("recruiter_name") or "Recruiter"
    interview_date = str(application.get("follow_up_date") or application.get("date_applied") or "Upcoming")[:10]
    location = application.get("location") or "Remote / Online"

    subject = f"Interview Reminder: {job_title} at {company}"

    content = f"""
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
      You have an interview scheduled with <strong>{company}</strong>! Here are the opportunity details:
    </p>

    <div class="card-box">
      <div class="row">
        <span class="label">Company</span>
        <span class="val">{company}</span>
      </div>
      <div class="row">
        <span class="label">Job Title</span>
        <span class="val">{job_title}</span>
      </div>
      <div class="row">
        <span class="label">Scheduled Date</span>
        <span class="val"><span class="badge badge-urgent">{interview_date}</span></span>
      </div>
      <div class="row">
        <span class="label">Contact</span>
        <span class="val">{recruiter}</span>
      </div>
      <div class="row">
        <span class="label">Location</span>
        <span class="val">{location}</span>
      </div>
    </div>

    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1e40af; margin-top: 16px;">
      <strong>Quick Prep Tip:</strong> Review common behavioral questions (STAR method), research {company}'s latest company news, and have 2-3 thoughtful questions prepared for the interviewer.
    </div>

    <center>
      <a href="http://127.0.0.1:5173/assistant" class="cta-btn">Practice with AI Assistant</a>
    </center>
    """

    html = _get_base_email_html(f"Interview Reminder: {company}", content, callout_badge="Upcoming Interview")
    return send_email(to_email, subject, html, config=config)


def send_status_change_email(
    to_email: str,
    application: Dict[str, Any],
    old_status: str,
    new_status: str,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send notification email when an application advances stages."""
    company = application.get("company_name", "Company")
    job_title = application.get("job_title", "Position")

    subject = f"Application Status Update: {company} ({new_status})"

    badge_class = "badge-info"
    if new_status in ("Interview", "Offer"):
        badge_class = "badge-success"
    elif new_status in ("Rejected", "NoResponse"):
        badge_class = "badge-urgent"

    content = f"""
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
      Your application for <strong>{job_title}</strong> at <strong>{company}</strong> has changed status:
    </p>

    <div class="card-box">
      <div class="row">
        <span class="label">Company</span>
        <span class="val">{company}</span>
      </div>
      <div class="row">
        <span class="label">Position</span>
        <span class="val">{job_title}</span>
      </div>
      <div class="row">
        <span class="label">Previous Stage</span>
        <span class="val">{old_status}</span>
      </div>
      <div class="row">
        <span class="label">New Stage</span>
        <span class="val"><span class="badge {badge_class}">{new_status}</span></span>
      </div>
    </div>

    <center>
      <a href="http://127.0.0.1:5173/applications" class="cta-btn">View Pipeline</a>
    </center>
    """

    html = _get_base_email_html(f"Stage Update: {company}", content, callout_badge="Application Update")
    return send_email(to_email, subject, html, config=config)


def send_job_watcher_digest_email(
    to_email: str,
    run_summary: Dict[str, Any],
    top_jobs: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send daily job discovery digest email with newly discovered opportunities."""
    companies_count = run_summary.get("companies_checked", 0)
    new_jobs_count = run_summary.get("new_jobs_found", 0)
    matched_count = run_summary.get("jobs_matching_resume", 0)
    top_score = run_summary.get("highest_matching_score", 0.0)

    subject = f"Daily AI Job Digest: {new_jobs_count} New Roles Discovered ({matched_count} Matches)"

    # Build job list cards
    jobs_cards_html = ""
    for j in top_jobs[:5]:
        c_name = j.get("company_name", "Company")
        j_title = j.get("job_title", "Position")
        loc = j.get("location") or "Remote / Hybrid"
        score = j.get("match_score") or 0.0
        url = j.get("job_url") or "http://127.0.0.1:5173/watcher"
        desc = (j.get("description") or "")[:200]
        if len(j.get("description") or "") > 200:
            desc += "..."

        score_badge_class = "badge-success" if score >= 75 else ("badge-warning" if score >= 50 else "badge-info")

        jobs_cards_html += f"""
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <strong style="font-size: 15px; color: #0f172a;">{j_title}</strong>
            <span class="badge {score_badge_class}">{score:.0f}% Match</span>
          </div>
          <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">
            <strong>{c_name}</strong> &bull; {loc}
          </div>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 10px 0; line-height: 1.4;">
            {desc}
          </p>
          <a href="{url}" style="font-size: 12px; color: #2563eb; font-weight: 600; text-decoration: none;" target="_blank">
            View Job Posting &rarr;
          </a>
        </div>
        """

    content = f"""
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
      Here is your automated daily job discovery summary from <strong>Autumn Suite</strong>.
    </p>

    <div class="card-box">
      <div class="row">
        <span class="label">Companies Monitored</span>
        <span class="val">{companies_count}</span>
      </div>
      <div class="row">
        <span class="label">New Jobs Found Today</span>
        <span class="val"><span class="badge badge-info">{new_jobs_count}</span></span>
      </div>
      <div class="row">
        <span class="label">Resume Matched Roles</span>
        <span class="val"><span class="badge badge-success">{matched_count}</span></span>
      </div>
      <div class="row">
        <span class="label">Highest Compatibility Score</span>
        <span class="val">{top_score:.0f}%</span>
      </div>
    </div>

    <h3 style="font-size: 15px; font-weight: 700; margin: 20px 0 10px 0; color: #1e293b;">
      Highest Matching Opportunities:
    </h3>

    {jobs_cards_html if jobs_cards_html else '<p style="font-size: 13px; color: #64748b;">No new jobs above threshold found today.</p>'}

    <center>
      <a href="http://127.0.0.1:5173/watcher" class="cta-btn">Review Discovered Jobs</a>
    </center>
    """

    html = _get_base_email_html("Daily Job Watcher Digest", content, callout_badge="Daily Discovery")
    return send_email(to_email, subject, html, config=config)

