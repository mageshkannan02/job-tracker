@echo off
setlocal
echo =======================================================
echo     Autumn Suite - AI Job Watcher Background Daemon
echo =======================================================
echo.
echo Starting Autumn Suite background discovery scheduler...
echo Scheduled daily discovery runs at the configured time.
echo.

cd /d "%~dp0backend"

:: Detect Python
set PYTHON_CMD=python
py -3.11 --version >nul 2>&1 && set PYTHON_CMD=py -3.11

if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

echo Starting backend service with APScheduler...
python -m uvicorn main:app --host 127.0.0.1 --port 8000
