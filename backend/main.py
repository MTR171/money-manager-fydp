import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine, Base, DATABASE_URL
import models  # noqa: F401
from routers import auth_routes, transaction_routes, analytics_routes, goals_routes, budgets_routes, bills_routes

# ── Non-Destructive Database Schema Verification ──────────────────────────────
# Base.metadata.create_all emits 'CREATE TABLE IF NOT EXISTS' without altering or dropping existing rows
Base.metadata.create_all(bind=engine)


def ensure_database_schema():
    """Safely adds newly required columns (is_verified, verification_token) and unblocks existing locked users."""
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "is_verified" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
                if "verification_token" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR"))
                
                # Unblock target locked user rifat2305101290@diu.edu.bd immediately
                conn.execute(text("UPDATE users SET is_verified = 1 WHERE LOWER(email) = 'rifat2305101290@diu.edu.bd'"))
                
                # If SMTP is not configured in environment, auto-verify all users so nobody is locked out
                if not os.getenv("SMTP_USER"):
                    conn.execute(text("UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"))
                    print("[Database] Schema verified: unblocked all users (SMTP not configured).")
                else:
                    print("[Database] Schema verified: rifat2305101290@diu.edu.bd unblocked.")
    except Exception as e:
        print(f"[Database] Schema auto-migration notice: {e}")


ensure_database_schema()

app = FastAPI(
    title="Money Manager API",
    description="AI-powered personal finance management API",
    version="1.0.0",
)

# ── CORS Configuration ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Ngrok browser-warning bypass ──────────────────────────────────────────────
@app.middleware("http")
async def add_ngrok_header(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "1"
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_routes.router)
app.include_router(transaction_routes.router)
app.include_router(analytics_routes.router)
app.include_router(goals_routes.router)
app.include_router(budgets_routes.router)
app.include_router(bills_routes.router)

# ── Root & Health Endpoints ───────────────────────────────────────────────────
@app.get("/")
def root():
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"
    return {"message": "Money Manager API v1.0.0", "status": "running", "database": db_type}

@app.get("/health")
def health_check():
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"
    return {"status": "healthy", "database": db_type}