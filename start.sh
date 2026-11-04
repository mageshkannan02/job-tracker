#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "============================================"
echo "  Smart Job Tracker - Startup Script"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 not found. Install Python 3.11+ from https://python.org"
    exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Backend setup
echo "[1/4] Setting up backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d venv ]; then
    echo "     Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "     Installing Python dependencies..."
pip install -r requirements.txt --quiet

echo "     Installing Playwright Chromium..."
playwright install chromium 2>/dev/null || echo "     [WARN] Playwright install skipped"

if [ ! -f .env ]; then
    echo ""
    echo "[NOTICE] No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "============================================"
    echo " ACTION REQUIRED: Edit backend/.env and"
    echo " add your GROQ_API_KEY before continuing."
    echo " Get a free key at: https://console.groq.com"
    echo "============================================"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Frontend setup
echo "[2/4] Setting up frontend..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d node_modules ]; then
    echo "     Installing npm packages..."
    npm install --silent
fi

# Start backend
echo "[3/4] Starting backend server..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
echo "     Backend PID: $BACKEND_PID"

sleep 2

# Start frontend
echo "[4/4] Starting frontend server..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "     Frontend PID: $FRONTEND_PID"

sleep 2

echo ""
echo "============================================"
echo "  Application is running!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://127.0.0.1:8000"
echo "  API Docs:  http://127.0.0.1:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Open browser if possible
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173" 2>/dev/null &
elif command -v open &>/dev/null; then
    open "http://localhost:5173" 2>/dev/null &
fi

# Wait and cleanup on Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait

