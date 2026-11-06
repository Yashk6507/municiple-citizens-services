@echo off
REM Municipal Portal Setup Script for Windows
REM This script helps you set up the Supabase-powered municipal portal

echo ==========================================
echo Municipal Portal Setup
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is not installed. Please install Node.js v14 or higher.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version

REM Check if .env exists
if not exist .env (
    echo.
    echo [!] No .env file found. Creating from .env.example...
    copy .env.example .env
    echo [OK] Created .env file
    echo.
    echo [!] IMPORTANT: Edit the .env file with your Supabase credentials before starting!
    echo.
    echo You need to:
    echo   1. Create a Supabase account at https://supabase.com
    echo   2. Create a new project
    echo   3. Copy your SUPABASE_URL and API keys to .env
    echo   4. Run the SQL in supabase-setup.sql in your Supabase SQL Editor
    echo.
) else (
    echo [OK] .env file exists
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo [OK] Dependencies installed successfully
) else (
    echo [X] Failed to install dependencies
    pause
    exit /b 1
)

REM Create uploads directory
if not exist uploads (
    mkdir uploads
    echo [OK] Created uploads directory
)

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Edit .env with your Supabase credentials
echo   2. Run the SQL in supabase-setup.sql in Supabase
echo   3. Start the server: npm start
echo.
echo After starting, visit: http://localhost:4000
echo Default admin: admin@municipal.local / Admin@123
echo.
pause
