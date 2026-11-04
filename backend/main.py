import asyncio
import logging
import sys
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from services.excel_service import initialize_workbook
from services import notification_service
from services.scheduler_service import scheduler_instance
from routes import (
    analyzer,
    applications,
    assistant,
    auth,
    calendar,
    dashboard,
    extractor,
    followups,
    job_watcher,
    notifications,
    resumes,
    settings as settings_router,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("main")


async def _periodic_notification_scanner():
    """Periodically check for due follow-ups and upcoming interviews in the background."""
    while True:
        try:
            # Wait 10 seconds on first run after startup, then 30 mins
            await asyncio.sleep(10)
            logger.info("Executing background notification scan for due events...")
            notification_service.scan_and_notify_due_events(settings.excel_path)
            # Periodic interval: 30 minutes
            await asyncio.sleep(1800)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Background notification scanner error: {e}")
            await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Autumn Suite backend services...")
    settings.init_directories()
    initialize_workbook(settings.excel_path)
    logger.info(f"Connected to Excel database at: {settings.excel_path}")

    # Start background reminder scanner
    scanner_task = asyncio.create_task(_periodic_notification_scanner())

    # Start APScheduler for AI Job Watcher
    try:
        scheduler_instance.start()
    except Exception as e:
        logger.error(f"Failed to start Job Watcher scheduler: {e}")

    yield

    try:
        scheduler_instance.shutdown()
    except Exception as e:
        logger.warning(f"Error shutting down Job Watcher scheduler: {e}")

    scanner_task.cancel()
    try:
        await scanner_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down Autumn Suite backend.")


app = FastAPI(
    title="Autumn Suite API",
    version="1.0.0",
    description="Backend API for Autumn Suite powered by Excel and Groq AI.",
    lifespan=lifespan,
)

# CORS configuration
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    f"http://localhost:{settings.frontend_port}",
    f"http://127.0.0.1:{settings.frontend_port}",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api prefix
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(extractor.router, prefix="/api/extractor", tags=["Extractor"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(analyzer.router, prefix="/api/analyzer", tags=["Analyzer"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["Assistant"])
app.include_router(followups.router, prefix="/api/followups", tags=["FollowUps"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["GoogleCalendar"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(job_watcher.router, prefix="/api/watcher", tags=["JobWatcher"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "excel_storage": settings.excel_path.exists(),
        "model": settings.groq_model,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )
