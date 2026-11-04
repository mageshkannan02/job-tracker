# 🍂 Autumn Suite

An AI-powered personal career & job application management suite built with **FastAPI** + **React** + **Excel storage**. No database required — all data is stored in a single `.xlsx` workbook.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Application Tracker** | Kanban board, table, and calendar views with drag-and-drop |
| **AI Job Watcher** | Automated daily discovery of newly published roles matching your profile across target companies |
| **Job URL Extractor** | Paste any public job URL — AI extracts all details automatically |
| **Resume Analyzer** | Upload PDF/DOCX resume, get ATS match score vs. any job description |
| **AI Assistant** | Chat with Groq AI — queries your real application data from Excel |
| **Analytics Dashboard** | Charts, conversion rates, trends — all computed live from Excel |
| **Follow-Up Manager** | Track tasks and deadlines linked to applications |
| **Google Calendar Sync** | Automated 2-way OAuth sync, live iCal subscription feed, and 1-click event links |
| **Excel Storage** | All data lives in `data/job_tracker.xlsx` — portable and inspectable |

---

## 🛠️ Tech Stack

**Backend:** Python 3.11+, FastAPI, Pydantic v2, Pandas, OpenPyXL, BeautifulSoup4, Playwright, PyMuPDF, python-docx, Groq SDK, FileLock

**Frontend:** React 18, Vite 5, TypeScript, Tailwind CSS v3, shadcn/ui, Recharts, @dnd-kit, React Hook Form, Zod, Sonner, Axios

---

## 📋 Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- A [Groq API key](https://console.groq.com) (free tier available)

---

## 🚀 Quick Start

### Option A — Automated (Windows)

```bat
# Double-click or run in terminal:
start.bat
```

### Option B — Automated (Linux / macOS)

```bash
chmod +x start.sh
./start.sh
```

### Option C — Manual Setup

#### 1. Clone / Extract the project

```bash
cd job-tracker
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/macOS)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser (for JS-rendered pages)
playwright install chromium

# Configure environment
copy .env.example .env       # Windows
cp .env.example .env         # Linux/macOS

# Edit .env and add your Groq API key
# GROQ_API_KEY=gsk_...

# Start the backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### 3. Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

#### 4. Open the application

| URL | Description |
|---|---|
| http://localhost:5173 | React frontend |
| http://127.0.0.1:8000/docs | FastAPI Swagger UI |
| http://127.0.0.1:8000/api/health | Health check |

---

## ⚙️ Configuration

All configuration lives in `backend/.env`:

```env
# Required — get your free key at https://console.groq.com
GROQ_API_KEY=gsk_your_key_here

# AI model (llama-3.3-70b-versatile recommended)
GROQ_MODEL=llama-3.3-70b-versatile

# Server settings
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_PORT=5173

# Storage paths (relative to backend/)
DATA_DIR=./data
RESUME_DIR=./resumes
BACKUP_DIR=./backups
```

> **Note:** The `.env` file is git-ignored. Never commit your API key.

---

## 📁 Project Structure

```
job-tracker/
├── backend/
│   ├── main.py                   # FastAPI application entry point
│   ├── config.py                 # Settings from environment variables
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/                     # Auto-created — Excel workbook lives here
│   │   └── job_tracker.xlsx
│   ├── resumes/                  # Auto-created — uploaded resume files
│   ├── backups/                  # Auto-created — timestamped Excel backups
│   ├── models/
│   │   └── schemas.py            # All Pydantic request/response models
│   ├── services/
│   │   ├── excel_service.py      # Centralized Excel CRUD (thread-safe)
│   │   ├── groq_service.py       # Groq AI integration
│   │   ├── extractor_service.py  # Job URL scraping (BS4 + Playwright)
│   │   └── resume_service.py     # PDF/DOCX text extraction
│   ├── routes/
│   │   ├── applications.py       # CRUD + status updates
│   │   ├── dashboard.py          # Stats + chart data
│   │   ├── extractor.py          # Job URL extraction
│   │   ├── resumes.py            # Resume upload/listing
│   │   ├── analyzer.py           # Resume vs. JD analysis
│   │   ├── assistant.py          # AI chatbot
│   │   ├── followups.py          # Follow-up task CRUD
│   │   └── settings.py           # App settings + export
│   └── tests/
│       ├── conftest.py
│       ├── test_excel_service.py
│       ├── test_applications.py
│       └── test_dashboard.py
└── frontend/
    ├── src/
    │   ├── types/index.ts        # All TypeScript interfaces
    │   ├── lib/api.ts            # Typed Axios API client
    │   ├── lib/utils.ts          # Helpers, status colors
    │   ├── hooks/                # useApplications, useDashboard
    │   ├── components/
    │   │   ├── ui/               # shadcn/ui components
    │   │   ├── layout/           # Sidebar, TopBar, Layout
    │   │   ├── applications/     # KanbanBoard, Table, Calendar, Form
    │   │   ├── dashboard/        # StatCard, Charts
    │   │   └── common/           # EmptyState, Spinner, ConfirmDialog
    │   └── pages/                # Dashboard, Applications, Extractor, ...
    └── dist/                     # Production build output
```

---

## 📊 Excel Workbook Structure

The file `data/job_tracker.xlsx` contains 7 worksheets:

| Sheet | Purpose |
|---|---|
| **Applications** | All job applications with 25 fields |
| **StatusHistory** | Every status change with timestamp |
| **FollowUps** | Follow-up tasks linked to applications |
| **Analysis** | Resume analysis results |
| **DiscoveredJobs** | AI Job Watcher discovered roles with ATS match scores and skill gaps |
| **CompanyMonitoring** | Unique companies and endpoints tracked for automated daily discovery |
| **Settings** | Application preferences and scheduler configuration |
| **Notifications** | In-app alerts and notifications |

The workbook is **auto-created** on first backend startup. You can open it in Excel at any time — the backend uses file locking to prevent corruption during concurrent access.

**Backups** are automatically created before every write operation in `backups/` with timestamps.

---

## 🛰️ AI Job Watcher & Background Scheduler

The **AI Job Watcher** module automates continuous discovery of newly published job openings from your target companies.

### How It Works
1. **Endpoint Adapters**: Connects to public Greenhouse boards, Lever postings APIs, company career pages (with robots.txt validation), and user-configured LinkedIn job alerts.
2. **Duplicate Detection**: Canonical URL normalization, external job ID matching, and company/title deduplication guarantee you are never spammed with repeating jobs.
3. **Groq AI Compatibility Match**: Evaluates candidate resumes against discovered job descriptions, calculating match scores, matched skills, missing skills, and recommended actions.
4. **Daily APScheduler**: Automatically executes daily at 9:00 AM local time (or user-configured schedule and timezone).
5. **In-App & Email Digest**: Notifies you of high-scoring new opportunities and provides 1-click addition into your tracking pipeline.

### Running Scheduler on System Startup
Scheduled checks execute when the application backend is active. To run the scheduler automatically in the background on Windows startup:
- Create a shortcut to `start_watcher_daemon.bat`.
- Press `Win + R`, type `shell:startup`, and press Enter.
- Place the shortcut in your Startup folder. The background scheduler will now launch silently on Windows boot.


---

## 🤖 AI Features Setup

The Groq AI features require an API key. The free tier is sufficient for personal use.

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create an API key
3. Add it to `backend/.env`:
   ```
   GROQ_API_KEY=gsk_...
   ```

**Features requiring Groq:**
- Job URL extraction (AI parses raw page text into structured data)
- Resume analysis (ATS match scoring)
- AI Assistant chat
- Interview question generation
- Follow-up email drafting

**Features that work without Groq:**
- Application CRUD (all views)
- Dashboard analytics
- Follow-up management
- Google Calendar 1-click links and live iCal feed
- Excel import/export

---

## 📅 Google Calendar Synchronization

Smart Job Tracker offers three flexible ways to keep interviews and follow-up deadlines synced with Google Calendar:

### Method 1: Live iCal Feed (Zero Config)
1. In the app, navigate to **Settings** $\to$ **Google Calendar Synchronization**.
2. Click **Copy Feed Link** next to the Live iCal Feed URL (`http://127.0.0.1:8000/api/calendar/feed.ics`).
3. Open [Google Calendar](https://calendar.google.com).
4. In the left sidebar, click the **+** next to **Other calendars** $\to$ **From URL**.
5. Paste the link and click **Add calendar**. All upcoming deadlines and interviews will automatically sync to Google Calendar!

### Method 2: One-Click Event Creation
In any application detail view or calendar view, click **Add to Google Calendar** to immediately open an event pre-filled with the role, company name, recruiter contact, notes, and dates.

### Method 3: Direct Google OAuth 2.0 Integration (Automatic Push)
1. In [Google Cloud Console](https://console.cloud.google.com), create an OAuth 2.0 Client ID (Web application) with Authorized Redirect URI: `http://127.0.0.1:8000/api/calendar/callback`.
2. Add your credentials in `backend/.env` or in the Settings page:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```
3. Click **Connect Google Account** in Settings to authorize direct two-way synchronization.
4. Click **Sync Events Now** whenever you want to push all pending reminders and interview schedules to your primary Google Calendar.

---

## 🌐 Job URL Extractor

Supported sources (best effort — availability depends on the site's anti-bot policy):

| Site | Method |
|---|---|
| Company career pages | Requests + BeautifulSoup |
| Indeed, Naukri, Wellfound | Requests → Playwright fallback |
| LinkedIn public job pages | Requests (limited) |
| Other public job boards | Requests → Playwright fallback |

> **Note:** Sites behind authentication, CAPTCHAs, or paywalls cannot be extracted. Use the manual "Paste Job Description" fallback instead.

**Security:** All user-supplied URLs are validated before fetching. Private IPs, localhost, and link-local addresses are blocked (SSRF protection).

---

## 🧪 Running Tests

```bash
cd backend

# Activate venv first
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/macOS

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=. --cov-report=term-missing
```

Tests use temporary Excel files and mocked Groq responses — no API key required.

---

## 📦 Data Export

Export your full data as Excel:

- **In the app:** Settings page → "Export Data" button
- **Direct API:** `GET http://127.0.0.1:8000/api/settings/export/excel`
- **Direct file:** Copy `backend/data/job_tracker.xlsx`

---

## 🔧 Troubleshooting

**Backend won't start:**
- Ensure Python 3.11+ is installed: `python --version`
- Ensure the virtual environment is activated
- Check `.env` exists in `backend/` (copy from `.env.example`)

**Playwright / extraction fails:**
- Run `playwright install chromium` in the activated venv

**AI features return errors:**
- Verify `GROQ_API_KEY` is set correctly in `backend/.env`
- Check the key at [console.groq.com](https://console.groq.com)
- Confirm the model name: `llama-3.3-70b-versatile`

**Excel file locked:**
- Only one instance of the backend should run at a time
- If a lock file (`.lock`) is left behind after a crash, delete it from `data/`

**Frontend can't reach backend:**
- Confirm backend is running on port 8000: `http://127.0.0.1:8000/api/health`
- Check CORS isn't blocked — both servers must be on `localhost` / `127.0.0.1`

---

## 🛡️ Security Notes

- API keys are stored only in `backend/.env` — never sent to the frontend
- All user-provided URLs are validated before fetching (SSRF protection)
- Resume files are stored locally only — never sent to external services except for analysis text via Groq
- The app runs entirely on your local machine — no cloud dependency except Groq API calls

---

## 📄 License

MIT — Personal use project. Feel free to fork and customize.

