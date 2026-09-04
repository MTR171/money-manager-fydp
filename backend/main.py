from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine, Base
import models  # noqa: F401
from routers import auth_routes, transaction_routes, analytics_routes, goals_routes, budgets_routes, bills_routes

# Create all DB tables
Base.metadata.create_all(bind=engine)

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

# ── Root endpoints ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Money Manager API v1.0.0", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}