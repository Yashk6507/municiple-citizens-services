@echo off
REM Municipal Portal Verification Script for Windows
REM This script checks if all required files and configurations are in place

echo ========================================
echo Municipal Portal - Setup Verification
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js found
    node --version
) else (
    echo [X] Node.js not found. Please install Node.js v14+
    pause
    exit /b 1
)

REM Check npm
echo Checking npm...
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] npm found
    npm --version
) else (
    echo [X] npm not found
    pause
    exit /b 1
)

REM Check required files
echo.
echo Checking required files...

set FILES=server-new.js supabase.js supabase-setup.sql .env.example package.json README.md QUICKSTART.md public\index.html public\app.js public\styles.css

for %%f in (%FILES%) do (
    if exist "%%f" (
        echo [OK] %%f
    ) else (
        echo [X] %%f - MISSING
    )
)

REM Check directories
echo.
echo Checking directories...

if exist "uploads" (
    echo [OK] uploads\
) else (
    echo [!] uploads\ - Not found
)

if exist "public" (
    echo [OK] public\
) else (
    echo [X] public\ - MISSING
)

if exist "node_modules" (
    echo [OK] node_modules\
) else (
    echo [!] node_modules\ - Not found
)

REM Check .env file
echo.
echo Checking environment configuration...
if exist ".env" (
    echo [OK] .env file exists
    findstr /C:"your-project.supabase.co" .env >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [!] .env file needs configuration ^(still has placeholder values^)
    ) else (
        echo [OK] .env appears to be configured
    )
) else (
    echo [X] .env file not found
    echo    Run: copy .env.example .env
)

REM Check node_modules
echo.
echo Checking dependencies...
if exist "node_modules" (
    if exist "node_modules\@supabase" (
        echo [OK] Dependencies installed ^(Supabase found^)
    ) else (
        echo [!] Dependencies may need updating
        echo    Run: npm install
    )
) else (
    echo [X] Dependencies not installed
    echo    Run: npm install
)

REM Summary
echo.
echo ========================================
echo Verification Summary
echo ========================================
echo.

if exist ".env" (
    if exist "node_modules\@supabase" (
        echo [OK] Setup appears complete!
        echo.
        echo Next steps:
        echo   1. Edit .env with your Supabase credentials
        echo   2. Run SQL in supabase-setup.sql
        echo   3. Start server: npm start
    ) else (
        goto incomplete
    )
) else (
    goto incomplete
)

goto end

:incomplete
echo [!] Setup incomplete
echo.
echo Required actions:
if not exist ".env" echo   - Create .env file: copy .env.example .env
if not exist "node_modules" echo   - Install dependencies: npm install
echo   - Configure .env with Supabase credentials
echo   - Run supabase-setup.sql in Supabase

:end
echo.
pause
