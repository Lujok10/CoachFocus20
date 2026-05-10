@echo off
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo npm install failed. Try: npm cache clean --force && npm install
  pause
  exit /b %errorlevel%
)
echo Starting Focus20...
call npm run dev
pause
