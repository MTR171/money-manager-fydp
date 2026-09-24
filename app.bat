@echo off
start cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
start cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0"
start http://localhost:5173