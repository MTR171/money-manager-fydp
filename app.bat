@echo off
start cmd /k "cd /d E:\FYDP\backend && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000"
start cmd /k "cd /d E:\FYDP\frontend && npm run dev"
start http://localhost:5173