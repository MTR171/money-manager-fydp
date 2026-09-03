@echo off
setlocal EnableDelayedExpansion
title Money Manager — Mobile Launcher

echo.
echo ================================================================
echo    Money Manager — 1-Click Mobile Launcher  ^(via Ngrok^)
echo ================================================================
echo.

REM ── Navigate to the directory where this script lives ─────────────
cd /d "%~dp0"

REM ════════════════════════════════════════════════════════════════════
REM  1. VERIFY PYTHON
REM ════════════════════════════════════════════════════════════════════
echo [CHECK] Looking for Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python not found in PATH.
    echo.
    echo  Please install Python 3.10 or newer from:
    echo    https://www.python.org/downloads/
    echo.
    echo  During installation, tick "Add Python to PATH".
    echo.
    echo  Alternatively, install via winget:
    echo    winget install Python.Python.3.11
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo [CHECK] Found %%v


REM ════════════════════════════════════════════════════════════════════
REM  2. VERIFY NODE.JS
REM ════════════════════════════════════════════════════════════════════
echo [CHECK] Looking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js not found in PATH.
    echo.
    echo  Please install Node.js LTS from:
    echo    https://nodejs.org/
    echo.
    echo  Alternatively, install via winget:
    echo    winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo [CHECK] Found Node.js %%v


REM ════════════════════════════════════════════════════════════════════
REM  3. ENSURE PYTHON VIRTUAL ENVIRONMENT EXISTS
REM ════════════════════════════════════════════════════════════════════
if not exist "backend\venv\Scripts\activate.bat" (
    echo.
    echo [SETUP] Virtual environment not found — creating now...
    python -m venv backend\venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [SETUP] Installing backend Python packages...
    call backend\venv\Scripts\activate.bat
    pip install -r backend\requirements.txt --quiet
    if errorlevel 1 (
        echo [ERROR] pip install failed. Check backend\requirements.txt
        pause
        exit /b 1
    )
    echo [SETUP] Backend packages installed OK.
) else (
    echo [CHECK] Backend venv found.
    call backend\venv\Scripts\activate.bat
)


REM ════════════════════════════════════════════════════════════════════
REM  4. ENSURE pyngrok IS INSTALLED IN THE ACTIVE ENVIRONMENT
REM ════════════════════════════════════════════════════════════════════
python -c "import pyngrok" >nul 2>&1
if errorlevel 1 (
    echo [SETUP] Installing pyngrok...
    pip install pyngrok --quiet
    echo [SETUP] pyngrok installed OK.
) else (
    echo [CHECK] pyngrok is available.
)


REM ════════════════════════════════════════════════════════════════════
REM  5. ENSURE qrcode IS INSTALLED
REM ════════════════════════════════════════════════════════════════════
python -c "import qrcode" >nul 2>&1
if errorlevel 1 (
    echo [SETUP] Installing qrcode...
    pip install qrcode --quiet
    echo [SETUP] qrcode installed OK.
) else (
    echo [CHECK] qrcode is available.
)


REM ════════════════════════════════════════════════════════════════════
REM  6. ENSURE FRONTEND NPM PACKAGES ARE INSTALLED
REM ════════════════════════════════════════════════════════════════════
if not exist "frontend\node_modules" (
    echo.
    echo [SETUP] Installing frontend npm packages...
    cd frontend
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    cd ..
    echo [SETUP] npm packages installed OK.
) else (
    echo [CHECK] Frontend node_modules found.
)


REM ════════════════════════════════════════════════════════════════════
REM  7. TRAIN ML MODEL IF MISSING
REM ════════════════════════════════════════════════════════════════════
if not exist "backend\ml\overspending_model.pkl" (
    echo.
    echo [ML] Training overspending risk model ^(first run only^)...
    python backend\ml\train_model.py
    if errorlevel 1 (
        echo [WARN] Model training failed — backend will use rule-based fallback.
    ) else (
        echo [ML] Model trained and saved successfully.
    )
) else (
    echo [CHECK] ML model found.
)


REM ════════════════════════════════════════════════════════════════════
REM  8. OPTIONAL: NGROK AUTH TOKEN
REM    Set NGROK_AUTHTOKEN environment variable before running this
REM    script to use a stable URL, e.g.:
REM      set NGROK_AUTHTOKEN=your_token_here && run_mobile.bat
REM    Or sign in at https://dashboard.ngrok.com to get a free token.
REM ════════════════════════════════════════════════════════════════════
echo.
if defined NGROK_AUTHTOKEN (
    echo [NGROK] Auth token detected from environment.
) else (
    echo [NGROK] No NGROK_AUTHTOKEN set — using free ephemeral tunnel.
    echo          For a stable URL, set it first:
    echo            set NGROK_AUTHTOKEN=your_token ^&^& run_mobile.bat
)


REM ════════════════════════════════════════════════════════════════════
REM  9. LAUNCH TUNNEL RUNNER  (manages backend + frontend + tunnels)
REM ════════════════════════════════════════════════════════════════════
echo.
echo ================================================================
echo  Launching tunnel_runner.py — this manages everything.
echo  A QR code and mobile URL will appear below.
echo  Press Ctrl+C once when you want to shut everything down.
echo ================================================================
echo.

python tunnel_runner.py %*

REM %* passes any extra CLI args (e.g. --token, --region) straight through

echo.
echo [INFO] Tunnel runner exited.
pause
