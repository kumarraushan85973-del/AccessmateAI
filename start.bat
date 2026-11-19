@echo off
title AccessMate AI
color 0A
echo.
echo  Starting AccessMate AI...
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo  [!] Dependencies not found. Installing first...
    echo.
    call npm install
    echo.
)

echo  App will open at: http://localhost:3000
echo  Press Ctrl+C to stop.
echo.

start "" http://localhost:3000
node server.js
pause
