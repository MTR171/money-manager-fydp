import os
import secrets
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine, Base, DATABASE_URL, SessionLocal
import models
from routers import auth_routes, transaction_routes, analytics_routes, goals_routes, budgets_routes, bills_routes

# ── Non-Destructive Database Schema Verification ──────────────────────────────
# Base.metadata.create_all emits 'CREATE TABLE IF NOT EXISTS' without altering or dropping existing rows
Base.metadata.create_all(bind=engine)

PRIMARY_DEMO_EMAIL = "rifat2305101290@diu.edu.bd"
PRIMARY_DEMO_HASH = "$2b$12$09frS.Kl17YzQbtVVkv.zOiG0iAtgCAMqYQuBJsuYq7uwixSxQTcy"

SEED_TRANSACTIONS = [
    {"amount": 15000.0, "type": "income",  "category": "Other",         "date": datetime(2026, 9, 3), "note": "Monthly salary / allowance"},
    {"amount": 5200.0,  "type": "expense", "category": "Housing/Rent",  "date": datetime(2026, 9, 3), "note": None},
    {"amount": 3000.0,  "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 3), "note": None},
    {"amount": 1400.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": "lend money to Zobaer"},
    {"amount": 700.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": "lend money to Sagor"},
    {"amount": 1100.0,  "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 3), "note": "lend money to Bijoy"},
    {"amount": 300.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": "lend money to Imran"},
    {"amount": 7500.0,  "type": "income",  "category": "Other",         "date": datetime(2026, 9, 3), "note": "borrowed from Meem"},
    {"amount": 6000.0,  "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 3), "note": None},
    {"amount": 1500.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": "Owed to Badsha"},
    {"amount": 1500.0,  "type": "expense", "category": "Transport",     "date": datetime(2026, 9, 3), "note": "Came home"},
    {"amount": 2250.0,  "type": "income",  "category": "Other",         "date": datetime(2026, 9, 3), "note": "FD"},
    {"amount": 1550.0,  "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 3), "note": None},
    {"amount": 1000.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": None},
    {"amount": 300.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3), "note": None},
]


def ensure_database_schema():
    """
    Safely adds newly required columns (is_verified, verification_token),
    unblocks existing locked users, and automatically provisions the primary
    testing account (rifat2305101290@diu.edu.bd) so mobile/desktop browsers
    can immediately sign in.
    """
    from sqlalchemy import inspect, text, func
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "is_verified" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
                if "verification_token" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR"))
                if "otp_code" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_code VARCHAR"))
                if "otp_expiry" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_expiry TIMESTAMP"))

                # Unblock target user rifat2305101290@diu.edu.bd immediately
                conn.execute(text("UPDATE users SET is_verified = 1 WHERE LOWER(email) = 'rifat2305101290@diu.edu.bd'"))

                # If SMTP is not configured in environment, auto-verify all users so nobody is locked out
                if not os.getenv("SMTP_USER"):
                    conn.execute(text("UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"))
    except Exception as e:
        print(f"[Database] Schema auto-migration notice: {e}")

    # Ensure primary testing/demo user exists for immediate mobile & desktop sign-in
    db = SessionLocal()
    try:
        demo_user = db.query(User).filter(func.lower(User.email) == PRIMARY_DEMO_EMAIL).first()
        if not demo_user:
            demo_user = User(
                email=PRIMARY_DEMO_EMAIL,
                hashed_password=PRIMARY_DEMO_HASH,
                full_name="Touhid Rifat",
                monthly_income=15000.0,
                target_savings_goal=5000.0,
                currency="BDT",
                is_active=True,
                is_verified=True,
                verification_token=None,
                otp_code=None,
                otp_expiry=None
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print(f"[Database] Provisioned primary user account: {PRIMARY_DEMO_EMAIL}")
        else:
            if not demo_user.is_verified or not demo_user.is_active:
                demo_user.is_verified = True
                demo_user.is_active = True
                demo_user.verification_token = None
                demo_user.otp_code = None
                demo_user.otp_expiry = None
                db.commit()

        # Seed initial transactions for demo_user if they have none
        tx_count = db.query(Transaction).filter(Transaction.user_id == demo_user.id).count()
        if tx_count == 0:
            for item in SEED_TRANSACTIONS:
                db.add(Transaction(
                    user_id=demo_user.id,
                    amount=item["amount"],
                    type=item["type"],
                    category=item["category"],
                    date=item["date"],
                    note=item["note"],
                ))
            db.commit()
            print(f"[Database] Seeded {len(SEED_TRANSACTIONS)} transactions for {PRIMARY_DEMO_EMAIL}")
    except Exception as e:
        db.rollback()
        print(f"[Database] Demo user provisioning notice: {e}")
    finally:
        db.close()


ensure_database_schema()

app = FastAPI(
    title="Money Manager API",
    description="AI-powered personal finance management API",
    version="1.2.9",
)

# ── CORS Configuration (Open for Multi-Device / Mobile LAN / Tunnel / Cloud) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Multi-Device LAN Private Network Access & Ngrok header middleware ────────
@app.middleware("http")
async def add_ngrok_header(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin") or "*"
    response.headers["ngrok-skip-browser-warning"] = "1"
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With, ngrok-skip-browser-warning"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
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
