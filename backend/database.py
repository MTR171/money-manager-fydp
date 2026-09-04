import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ── Database URL Configuration ───────────────────────────────────────────────
# Priority:
# 1. DATABASE_URL from environment (PostgreSQL / Supabase / Neon / Render / Heroku)
# 2. POSTGRES_URL from environment
# 3. Persistent SQLite file with absolute path (prevents working-directory mismatch)

raw_db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")

if raw_db_url:
    # SQLAlchemy 1.4+ requires 'postgresql://' instead of legacy 'postgres://'
    if raw_db_url.startswith("postgres://"):
        DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL = raw_db_url
else:
    # Ensure SQLite uses a stable absolute path relative to this backend directory
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    sqlite_path = os.getenv("SQLITE_DB_PATH") or os.path.join(BASE_DIR, "moneymanager.db")
    DATABASE_URL = f"sqlite:///{sqlite_path}"

# ── Engine Configuration ─────────────────────────────────────────────────────
engine_kwargs = {
    "pool_pre_ping": True,  # Automatically detect and reconnect dropped/stale connections
}

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pool settings for cloud deployments
    engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "10"))
    engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    engine_kwargs["pool_recycle"] = int(os.getenv("DB_POOL_RECYCLE", "1800"))

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
