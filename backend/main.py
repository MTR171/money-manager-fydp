from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine, Base
import models  # noqa: F401 — ensures models are registered before create_all
from routers import auth_routes, transaction_routes, analytics_routes
import re

# Create all DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Money Manager API",
    description="AI-powered personal finance management API",
    version="1.0.0",
)

# ── CORS Configuration ────────────────────────────────────────────────────────
#
# Strategy: use allow_origin_regex to accept any ngrok domain alongside
# localhost variants — without the invalid allow_origins="*" +
# allow_credentials=True combination (which Starlette rejects).
#
# Since we authenticate via JWT Bearer tokens (not cookies), there is no
# requirement for allow_credentials=True.  Setting it False is correct and
# lets us use the flexible regex pattern below.
#
# Accepted origins:
#   • http(s)://localhost:<any port>
#   • http(s)://127.0.0.1:<any port>
#   • https://*.ngrok-free.app      (free-tier ngrok)
#   • https://*.ngrok.io            (legacy ngrok)
#   • https://*.ngrok.app           (ngrok paid)
#   • http://0.0.0.0:<any port>     (LAN dev)
# ─────────────────────────────────────────────────────────────────────────────
CORS_ORIGIN_REGEX = (
    r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?"       # localhost
    r"|https://[a-zA-Z0-9\-]+\.ngrok-free\.app"                   # free ngrok
    r"|https://[a-zA-Z0-9\-]+\.ngrok\.io"                         # ngrok legacy
    r"|https://[a-zA-Z0-9\-]+\.ngrok\.app"                        # ngrok paid
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],            # empty list — regex handles everything
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,     # False is required when not using explicit origins
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Ngrok browser-warning bypass ──────────────────────────────────────────────
# Ngrok free tunnels inject a browser interstitial page unless the request
# carries the header `ngrok-skip-browser-warning: 1`.  The Axios client
# already sends this header (see frontend/src/api/client.js), but this
# middleware adds it to every response so the browser itself is never blocked.
@app.middleware("http")
async def add_ngrok_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "1"
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_routes.router)
app.include_router(transaction_routes.router)
app.include_router(analytics_routes.router)


# ── Root endpoints ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Money Manager API v1.0.0", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
