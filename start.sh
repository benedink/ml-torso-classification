#!/bin/bash
# Start script for development on macOS/Linux
# This will run frontend and backend in the same terminal

set -e

echo "Starting School Uniform Detection System..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    echo "Install from: https://www.python.org/"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

echo "✓ Python found: $(python3 --version)"
echo "✓ Node.js found: $(node --version)"
echo ""

# Make script executable
chmod +x "$0"

# Start backend in background
echo "Starting Backend (Flask)..."
(
    cd backend
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    if [ ! -f ".installed" ]; then
        pip install -q -r requirements.txt
        touch .installed
    fi
    python app.py
) &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo ""
echo "Starting Frontend (Vite)..."
npm install > /dev/null 2>&1 || true
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=============================================="
echo "✓ Backend running on http://localhost:5000"
echo "✓ Frontend running on http://localhost:5173"
echo "=============================================="
echo ""
echo "Open http://localhost:5173 in your browser"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
