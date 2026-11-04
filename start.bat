@echo off
setlocal

echo.
echo ============================================
echo       Autumn Suite - Startup Script
echo ============================================
echo.

:: ---- Detect Python command (py launcher or python) ----
set PYTHON_CMD=
py -3.11 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py -3.11
) else (
    python --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python
    ) else (
        echo [ERROR] Python 3.11+ not found. Install from https://python.org
        pause
        exit /b 1
    )
)
echo     Using Python: %PYTHON_CMD%

:: ---- Check Node ----
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: ---- Backend setup ----
echo [1/4] Setting up backend...
cd /d "%~dp0backend"

if not exist venv (
    echo     Creating Python virtual environment...
    %PYTHON_CMD% -m venv venv
)

call venv\Scripts\activate.bat

echo     Installing Python dependencies...
pip install -r requirements.txt --quiet

echo     Installing Playwright browser (Chromium)...
playwright install chromium --quiet 2>nul || echo     [WARN] Playwright install skipped - run manually if needed

if not exist .env (
    echo.
    echo [NOTICE] No .env file found. Creating from .env.example...
    copy .env.example .env
    echo.
    echo ============================================
    echo  ACTION REQUIRED: Edit backend\.env and
    echo  add your GROQ_API_KEY before continuing.
    echo  Get a free key at: https://console.groq.com
    echo ============================================
    echo.
    pause
)

:: ---- Frontend setup ----
echo [2/4] Setting up frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo     Installing npm packages...
    npm install --silent
)

:: ---- Start backend in new window ----
echo [3/4] Starting backend server...
cd /d "%~dp0backend"
start "Autumn Suite - Backend (port 8000)" cmd /k "venv\Scripts\activate.bat && uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Wait a moment for backend to boot
timeout /t 3 /nobreak >nul

:: ---- Start frontend in new window ----
echo [4/4] Starting frontend server...
cd /d "%~dp0frontend"
start "Autumn Suite - Frontend (port 5173)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   Application is starting up!
echo ============================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://127.0.0.1:8000
echo   API Docs:  http://127.0.0.1:8000/docs
echo.
echo   Both servers are running in separate windows.
echo   Close those windows to stop the servers.
echo.

:: Open browser
start "" "http://localhost:5173"

pause
