@echo off
echo ========================================
echo Health Care Surgical Mart POS System
echo Development Server Startup
echo ========================================
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd server && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo Servers are starting...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo Health:   http://localhost:5000/health
echo.
echo Press Ctrl+C in each window to stop
echo ========================================
