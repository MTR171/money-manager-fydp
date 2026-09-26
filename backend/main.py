import os
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, DATABASE_URL, SessionLocal
from models import User, Transaction
from routers import auth_routes, transaction_routes, analytics_routes, goals_routes, budgets_routes, bills_routes

# ── Create tables if they don't exist (non-destructive) ───────────────────────
Base.metadata.create_all(bind=engine)

PRIMARY_DEMO_EMAIL = "rifat2305101290@diu.edu.bd"
PRIMARY_DEMO_HASH = "$2b$12$09frS.Kl17YzQbtVVkv.zOiG0iAtgCAMqYQuBJsuYq7uwixSxQTcy"

# Up-to-date transaction history (Sep 3, 2026 – Sep 25, 2026, 68 records)
UP_TO_DATE_TRANSACTIONS = [
    {"amount": 340.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 25, 12, 0), "note": None},
    {"amount": 70.0,    "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 23, 12, 0), "note": None},
    {"amount": 1000.0,  "type": "income",  "category": "Food/Dining",   "date": datetime(2026, 9, 23, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 23, 12, 0), "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 23, 12, 0), "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 23, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 22, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 21, 12, 0), "note": None},
    {"amount": 13.0,    "type": "expense", "category": "Other",         "date": datetime(2026, 9, 21, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 20, 12, 0), "note": None},
    {"amount": 62.0,    "type": "expense", "category": "Other",         "date": datetime(2026, 9, 20, 12, 0), "note": None},
    {"amount": 500.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 19, 12, 0), "note": "Bijoy"},
    {"amount": 400.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 19, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 19, 12, 0), "note": None},
    {"amount": 97.0,    "type": "expense", "category": "Other",         "date": datetime(2026, 9, 19, 12, 0), "note": None},
    {"amount": 500.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 19, 12, 0), "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 17, 12, 0), "note": None},
    {"amount": 2365.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 16, 12, 0), "note": None},
    {"amount": 500.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 16, 12, 0), "note": None},
    {"amount": 630.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 15, 12, 0), "note": "Paid Bill: WiFi"},
    {"amount": 500.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 15, 12, 0), "note": "badsha"},
    {"amount": 500.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 15, 12, 0), "note": "Rafi bhai"},
    {"amount": 200.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 15, 12, 0), "note": None},
    {"amount": 150.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 15, 12, 0), "note": None},
    {"amount": 303.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 15, 12, 0), "note": None},
    {"amount": 25.0,    "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 15, 12, 0), "note": None},
    {"amount": 200.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 15, 12, 0), "note": "Zuba"},
    {"amount": 150.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 15, 12, 0), "note": None},
    {"amount": 1500.0,  "type": "income",  "category": "Other",         "date": datetime(2026, 9, 13, 12, 0), "note": "House owner owed me"},
    {"amount": 5000.0,  "type": "income",  "category": "Other",         "date": datetime(2026, 9, 13, 12, 0), "note": "Borrowed from Meem"},
    {"amount": 500.0,   "type": "income",  "category": "Transport",     "date": datetime(2026, 9, 13, 12, 0), "note": None},
    {"amount": 222.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 9, 12, 0),  "note": "Sagor owe me"},
    {"amount": 250.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 9, 12, 0),  "note": "electricity bill"},
    {"amount": 630.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 9, 12, 0),  "note": "MLBB Weekly pass"},
    {"amount": 120.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 9, 12, 0),  "note": "mobile recharge"},
    {"amount": 210.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 8, 12, 0),  "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 7, 12, 0),  "note": None},
    {"amount": 500.0,   "type": "income",  "category": "Other",         "date": datetime(2026, 9, 7, 12, 0),  "note": "Zobaer Owed"},
    {"amount": 35500.0, "type": "income",  "category": "Utilities",     "date": datetime(2026, 9, 6, 12, 0),  "note": None},
    {"amount": 29525.0, "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 6, 12, 0),  "note": "Registration fees"},
    {"amount": 22000.0, "type": "income",  "category": "Utilities",     "date": datetime(2026, 9, 6, 12, 0),  "note": "From Meem"},
    {"amount": 23264.0, "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 6, 12, 0),  "note": "From bKash(Meem)"},
    {"amount": 5525.0,  "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 6, 12, 0),  "note": "From Rocket(Meem)"},
    {"amount": 2000.0,  "type": "income",  "category": "Shopping",      "date": datetime(2026, 9, 6, 12, 0),  "note": "From Authoy"},
    {"amount": 2024.0,  "type": "expense", "category": "Shopping",      "date": datetime(2026, 9, 6, 12, 0),  "note": "Paid"},
    {"amount": 254.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 6, 12, 0),  "note": None},
    {"amount": 7.0,     "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 6, 12, 0),  "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 4, 12, 0),  "note": None},
    {"amount": 600.0,   "type": "income",  "category": "Other",         "date": datetime(2026, 9, 4, 12, 0),  "note": "Mom gave me"},
    {"amount": 550.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 4, 12, 0),  "note": None},
    {"amount": 1500.0,  "type": "expense", "category": "Transport",     "date": datetime(2026, 9, 3, 12, 0),  "note": "Paid Bill: Travel"},
    {"amount": 5200.0,  "type": "expense", "category": "Housing/Rent",  "date": datetime(2026, 9, 3, 12, 0),  "note": "Paid Bill: rent"},
    {"amount": 15000.0, "type": "income",  "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": "allowance"},
    {"amount": 300.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": "lend money to Imran"},
    {"amount": 2000.0,  "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 3, 12, 0),  "note": "party"},
    {"amount": 1500.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": "Owed to Badsha"},
    {"amount": 500.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 3, 12, 0),  "note": "owed to Aurko"},
    {"amount": 600.0,   "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 3, 12, 0),  "note": "owed to sakib bhai"},
    {"amount": 1000.0,  "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": "owed to Authoy"},
    {"amount": 2000.0,  "type": "income",  "category": "Food/Dining",   "date": datetime(2026, 9, 3, 12, 0),  "note": "borrowed from Authoy"},
    {"amount": 1550.0,  "type": "expense", "category": "Food/Dining",   "date": datetime(2026, 9, 3, 12, 0),  "note": "last month food bill"},
    {"amount": 2250.0,  "type": "income",  "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": "from fd"},
    {"amount": 700.0,   "type": "expense", "category": "Entertainment", "date": datetime(2026, 9, 3, 12, 0),  "note": "Guitar strings"},
    {"amount": 250.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 3, 12, 0),  "note": None},
    {"amount": 100.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 3, 12, 0),  "note": "recharge"},
    {"amount": 500.0,   "type": "expense", "category": "Utilities",     "date": datetime(2026, 9, 3, 12, 0),  "note": None},
    {"amount": 250.0,   "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": None},
    {"amount": 14.0,    "type": "expense", "category": "Other",         "date": datetime(2026, 9, 3, 12, 0),  "note": None},
]


def ensure_database_schema():
    """
    1. Safely adds any missing columns to existing tables.
    2. Ensures the primary account exists and is unlocked.
    3. Upgrades the obsolete 15-row Sep 3 seed if present, or initializes a
       brand-new empty container with the 68 up-to-date transactions.
       NEVER re-seeds if the user already has custom transactions or cleared them.
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

                if not os.getenv("SMTP_USER"):
                    conn.execute(text(
                        "UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"
                    ))
                else:
                    conn.execute(text(
                        "UPDATE users SET is_verified = 1, otp_code = NULL, otp_expiry = NULL "
                        "WHERE LOWER(email) = 'rifat2305101290@diu.edu.bd'"
                    ))
    except Exception as e:
        print(f"[Database] Schema migration notice: {e}")

    db = SessionLocal()
    try:
        demo_user = db.query(User).filter(func.lower(User.email) == PRIMARY_DEMO_EMAIL).first()
        is_brand_new_user = False
        if not demo_user:
            is_brand_new_user = True
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
                otp_expiry=None,
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print(f"[Database] Provisioned primary user account: {PRIMARY_DEMO_EMAIL}")
        else:
            if not demo_user.is_verified or not demo_user.is_active or demo_user.otp_code:
                demo_user.is_verified = True
                demo_user.is_active = True
                demo_user.verification_token = None
                demo_user.otp_code = None
                demo_user.otp_expiry = None
                db.commit()

        existing_txs = db.query(Transaction).filter(Transaction.user_id == demo_user.id).all()
        has_obsolete_15_seed = (
            len(existing_txs) == 15
            and any(t.note == "Monthly salary / allowance" for t in existing_txs)
        )

        if is_brand_new_user or has_obsolete_15_seed:
            if has_obsolete_15_seed:
                db.query(Transaction).filter(Transaction.user_id == demo_user.id).delete()
                db.commit()
            for item in UP_TO_DATE_TRANSACTIONS:
                db.add(Transaction(
                    user_id=demo_user.id,
                    amount=item["amount"],
                    type=item["type"],
                    category=item["category"],
                    date=item["date"],
                    note=item["note"],
                ))
            db.commit()
            print(f"[Database] Loaded {len(UP_TO_DATE_TRANSACTIONS)} up-to-date transactions for {PRIMARY_DEMO_EMAIL}")
    except Exception as e:
        db.rollback()
        print(f"[Database] Initialization notice: {e}")
    finally:
        db.close()


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
