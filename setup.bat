@echo off
title AccessMate AI - Setup
color 0A
echo.
echo  ============================================
echo       AccessMate AI - First Time Setup
echo  ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org/
    echo  Download the LTS version, install it, then run this script again.
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js found:
node -v
echo.

:: Install dependencies
echo  [1/2] Installing dependencies...
echo.
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo.
echo  [2/2] Dependencies installed successfully!
echo.
echo  ============================================
echo     Setup Complete! Starting AccessMate AI
echo  ============================================
echo.
echo  The app will open in your browser automatically.
echo  If not, go to: http://localhost:3000
echo.
echo  IMPORTANT: Click "Settings" in the app to
echo  enter your free Gemini API key.
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" http://localhost:3000

:: Start server
node server.js
pause
