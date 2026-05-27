@echo off
REM Start script for development on Windows
REM This will open separate terminals for frontend and backend

echo Starting School Uniform Detection System...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo Python and Node.js found!
echo.

REM Start backend in new terminal
echo Starting Backend (Flask) on port 5000...
start "Backend" cmd /k "cd backend && python -m venv venv && call venv\Scripts\activate.bat && pip install -r requirements.txt && python app.py"

REM Wait a bit for backend to start
timeout /t 5 /nobreak

REM Start frontend in new terminal
echo Starting Frontend (Vite) on port 5173...
start "Frontend" cmd /k "npm install && npm run dev"

echo.
echo Startup complete!
echo - Backend: http://localhost:5000
echo - Frontend: http://localhost:5173
echo.
echo When both are ready, open http://localhost:5173 in your browser.
echo.
pause
