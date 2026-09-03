# 💰 Money Manager — AI Finance Tracker

> Final Year Design Project (FYDP) | Full-Stack + ML System

A production-ready personal finance management application with AI-powered overspending risk prediction, rule-based financial recommendations, and a modern React dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.10+) + Pydantic v2 |
| Database | SQLAlchemy ORM → SQLite (dev) / PostgreSQL (prod) |
| ML Engine | Scikit-learn Random Forest + Pandas + Joblib |
| Auth | JWT Bearer Tokens + Passlib bcrypt |
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |

---

## Project Structure

```
FYDP/
├── backend/
│   ├── requirements.txt
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── database.py                # SQLAlchemy engine + session
│   ├── models.py                  # ORM: User, Transaction, Budget
│   ├── schemas.py                 # Pydantic v2 schemas
│   ├── auth.py                    # JWT + bcrypt utilities
│   ├── ml/
│   │   ├── train_model.py         # Synthetic dataset + RF trainer
│   │   └── overspending_model.pkl # Generated after training
│   └── routers/
│       ├── auth_routes.py         # /api/auth/*
│       ├── transaction_routes.py  # /api/transactions/*
│       └── analytics_routes.py   # /api/analytics/*
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                # Root: Auth + Dashboard routing
        ├── api/client.js          # Axios instance + API helpers
        └── components/
            ├── DashboardCards.jsx
            ├── ExpenseCharts.jsx
            ├── TransactionModal.jsx
            └── AIRecommendations.jsx
```

---

## Quick Start

### Prerequisites
- Python 3.10+ — [python.org/downloads](https://www.python.org/downloads/)
- Node.js 18+ — [nodejs.org](https://nodejs.org/)

### Backend Setup

```powershell
# 1. Navigate to backend
cd e:\FYDP\backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate venv (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Train the ML model (generates overspending_model.pkl)
python ml/train_model.py

# 6. Start backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API runs at: **http://localhost:8000**
Interactive docs at: **http://localhost:8000/docs**

### Frontend Setup

```powershell
# In a NEW terminal
cd e:\FYDP\frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account → returns JWT |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/me` | Update income, savings goal, currency |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions/` | Add transaction |
| GET | `/api/transactions/` | List with filters (date, category, type) |
| GET | `/api/transactions/{id}` | Get single |
| PUT | `/api/transactions/{id}` | Update |
| DELETE | `/api/transactions/{id}` | Delete |
| GET | `/api/transactions/summary/daily` | Daily summary |
| GET | `/api/transactions/summary/weekly` | Weekly summary |
| GET | `/api/transactions/summary/monthly` | Monthly summary |
| GET | `/api/transactions/summary/category-breakdown` | Pie chart data |

### Analytics (AI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/recommendations` | 50/30/20 rule analysis + alerts |
| POST | `/api/analytics/predict-risk` | ML overspending risk prediction |
| GET | `/api/analytics/dashboard-summary` | Full dashboard data payload |
