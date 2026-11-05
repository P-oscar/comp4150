@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is unavailable. Open index.html directly in Edge or Chrome instead.
  pause
  exit /b 1
)
node server.cjs
pause
