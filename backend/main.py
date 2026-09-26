import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, DATABASE_URL, SessionLocal
from models import User
from routers import auth_routes, transaction_routes, analytics_routes, goals_routes, budgets_routes, bills_routes

# ── Create tables if they don't exist (non-destructive) ───────────────────────
Base.metadata.create_all(bind=engine)

PRIMARY_DEMO_EMAIL = "rifat2305101290@diu.edu.bd"


def ensure_database_schema():
    """
    1. Add any missing columns to existing tables (safe ALTER TABLE).
    2. Ensure the primary demo account is NOT locked out (is_verified=True).
       NEVER modifies user passwords or transactions.
    """
    from sqlalchemy import inspect, text, func

    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                # Add columns that may be missing in older deployments
                if "is_verified" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
                if "verification_token" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR"))
                if "otp_code" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_code VARCHAR"))
                if "otp_expiry" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_expiry TIMESTAMP"))

                # If SMTP is not configured → auto-verify ALL users so nobody is locked out
                if not os.getenv("SMTP_USER"):
                    conn.execute(text(
                        "UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"
                    ))
                    print("[Database] Auto-verified all users (SMTP not configured)")
                else:
                    # Always unblock the primary demo account regardless
                    conn.execute(text(
                        "UPDATE users SET is_verified = 1, otp_code = NULL, otp_expiry = NULL "
                        "WHERE LOWER(email) = 'rifat2305101290@diu.edu.bd'"
                    ))
    except Exception as e:
        print(f"[Database] Schema migration notice: {e}")


ensure_database_schema()

app = FastAPI(
    title="Money Manager API",
    description="AI-powered personal finance management API",
    version="1.2.9",
)

# ── CORS (open for multi-device / mobile LAN / tunnel / Render) ───────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── LAN / ngrok / Render CORS header middleware ───────────────────────────────
@app.middleware("http")
async def cors_headers(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin") or "*"
    response.headers["ngrok-skip-browser-warning"] = "1"
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = (
        "Authorization, Content-Type, Accept, Origin, X-Requested-With, ngrok-skip-browser-warning"
    )
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_routes.router)
app.include_router(transaction_routes.router)
app.include_router(analytics_routes.router)
app.include_router(goals_routes.router)
app.include_router(budgets_routes.router)
app.include_router(bills_routes.router)


# ── Root & Health ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"
    return {"message": "Money Manager API v1.2.9", "status": "running", "database": db_type}


@app.get("/health")
def health_check():
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"
    return {"status": "healthy", "database": db_type}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
