#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║       Money Manager — Ngrok Mobile Tunnel Runner             ║
║  Starts backend, frontend, creates tunnels, prints QR code   ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python tunnel_runner.py              # uses free ngrok (no auth)
    python tunnel_runner.py --token XYZ  # uses your ngrok auth token

Requirements (auto-installed):
    pyngrok, qrcode
"""

import argparse
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

# ── Auto-install pyngrok ──────────────────────────────────────────────────────
def _ensure_package(import_name: str, pip_name: str | None = None) -> None:
    pip_name = pip_name or import_name
    try:
        __import__(import_name)
    except ImportError:
        print(f"[SETUP] Installing {pip_name}...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", pip_name, "--quiet"],
            stdout=subprocess.DEVNULL if sys.platform == "win32" else None,
        )
        print(f"[SETUP] {pip_name} installed OK.")

_ensure_package("pyngrok")
_ensure_package("qrcode")

from pyngrok import ngrok, conf as ngrok_conf  # noqa: E402

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR= ROOT / "frontend"

# Windows venv executables
_WIN = sys.platform == "win32"
VENV_SCRIPTS  = BACKEND_DIR / "venv" / ("Scripts" if _WIN else "bin")
VENV_PYTHON   = VENV_SCRIPTS / ("python.exe" if _WIN else "python")
VENV_UVICORN  = VENV_SCRIPTS / ("uvicorn.exe" if _WIN else "uvicorn")
NPM_CMD       = "npm.cmd" if _WIN else "npm"

BACKEND_PORT  = 8000
FRONTEND_PORT = 5173

# ── Global process registry ───────────────────────────────────────────────────
_procs: list[subprocess.Popen] = []


def _kill_all(sig=None, frame=None) -> None:
    """Graceful shutdown: terminate subprocesses and ngrok tunnels."""
    print("\n[SHUTDOWN] Stopping all services...")
    for p in _procs:
        try:
            if p.poll() is None:
                p.terminate()
        except Exception:
            pass
    try:
        ngrok.kill()
    except Exception:
        pass
    print("[SHUTDOWN] Done. See you next time! 👋")
    sys.exit(0)


signal.signal(signal.SIGINT, _kill_all)
signal.signal(signal.SIGTERM, _kill_all)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _wait_for_port(host: str, port: int, timeout: float = 40.0) -> bool:
    """Poll until the TCP port accepts connections or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.4)
    return False


def _stream(proc: subprocess.Popen, label: str) -> None:
    """Forward subprocess stdout/stderr lines to console (daemon thread)."""
    def _reader():
        assert proc.stdout is not None
        for raw in iter(proc.stdout.readline, b""):
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                print(f"  [{label}] {line}")
    threading.Thread(target=_reader, daemon=True).start()


def _ensure_venv() -> None:
    """Create backend venv and install requirements if missing."""
    if VENV_PYTHON.exists():
        return
    print("[SETUP] Creating Python virtual environment...")
    subprocess.check_call([sys.executable, "-m", "venv", str(VENV_SCRIPTS.parent)])
    req = BACKEND_DIR / "requirements.txt"
    if req.exists():
        print("[SETUP] Installing backend requirements (this may take a minute)...")
        subprocess.check_call(
            [str(VENV_PYTHON), "-m", "pip", "install", "-r", str(req), "--quiet"]
        )
        print("[SETUP] Backend requirements installed.")


def _ensure_node_modules() -> None:
    """Run npm install if node_modules is missing."""
    if (FRONTEND_DIR / "node_modules").exists():
        return
    print("[SETUP] Installing frontend npm packages (this may take a minute)...")
    subprocess.check_call([NPM_CMD, "install"], cwd=str(FRONTEND_DIR))
    print("[SETUP] npm install done.")


def _ensure_ml_model() -> None:
    """Train ML model if the .pkl file is absent."""
    model_path = BACKEND_DIR / "ml" / "overspending_model.pkl"
    if model_path.exists():
        return
    print("[ML] Model not found — training now (≈10 seconds)...")
    python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
    subprocess.check_call(
        [python, str(BACKEND_DIR / "ml" / "train_model.py")],
        cwd=str(BACKEND_DIR),
    )
    print("[ML] Model trained and saved.")


def _start_backend() -> subprocess.Popen:
    """Launch uvicorn inside the backend venv."""
    if VENV_UVICORN.exists():
        cmd = [str(VENV_UVICORN), "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)]
    else:
        python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
        cmd = [python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)]

    proc = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if _WIN else {}),
    )
    _procs.append(proc)
    return proc


def _start_frontend() -> subprocess.Popen:
    """Launch Vite dev server."""
    proc = subprocess.Popen(
        [NPM_CMD, "run", "dev", "--", "--host", "0.0.0.0"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if _WIN else {}),
    )
    _procs.append(proc)
    return proc


def _write_frontend_env(backend_ngrok_url: str) -> None:
    """Overwrite frontend/.env so Vite bakes the correct backend URL at build/start time."""
    env_path = FRONTEND_DIR / ".env"
    env_path.write_text(
        f"# Auto-generated by tunnel_runner.py — DO NOT EDIT MANUALLY\n"
        f"VITE_API_URL={backend_ngrok_url}\n",
        encoding="utf-8",
    )
    print(f"[ENV] {env_path} → VITE_API_URL={backend_ngrok_url}")


def _print_qr(url: str) -> None:
    """Print ASCII QR code to terminal."""
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=1,
        )
        qr.add_data(url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
    except Exception as exc:
        print(f"  [QR] Could not render QR ({exc}). Install: pip install qrcode")


def _print_banner() -> None:
    w = 62
    print("\n" + "═" * w)
    print("   💰  Money Manager — Ngrok Mobile Tunnel Runner".center(w))
    print("═" * w)


def _print_summary(frontend_url: str, backend_url: str) -> None:
    w = 62
    print("\n" + "═" * w)
    print("  ✅  ALL SERVICES RUNNING — share with any device:".center(w))
    print("═" * w)
    print(f"\n  📱  Open on your phone:")
    print(f"      {frontend_url}\n")
    print(f"  🔌  Backend API (Swagger docs):")
    print(f"      {backend_url}/docs\n")
    print("─" * w)
    print("  📷  Scan QR code to open on mobile:\n")
    _print_qr(frontend_url)
    print("─" * w)
    print("  ℹ️   Press Ctrl+C to stop all services.")
    print("═" * w + "\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Money Manager Ngrok Tunnel Runner")
    parser.add_argument(
        "--token", "-t",
        default=os.environ.get("NGROK_AUTHTOKEN", ""),
        help="Ngrok auth token (or set NGROK_AUTHTOKEN env var). "
             "Get a free token at https://dashboard.ngrok.com/get-started/your-authtoken",
    )
    parser.add_argument(
        "--region", "-r",
        default="us",
        help="Ngrok region (us, eu, ap, au, sa, jp, in). Default: us",
    )
    args = parser.parse_args()

    _print_banner()

    # ── Pre-flight checks ─────────────────────────────────────────
    print("\n[SETUP] Running pre-flight checks...")
    _ensure_venv()
    _ensure_node_modules()
    _ensure_ml_model()
    print("[SETUP] All checks passed.\n")

    # ── Configure Ngrok ───────────────────────────────────────────
    if args.token:
        ngrok_conf.get_default().auth_token = args.token
        print(f"[NGROK] Auth token set.")
    else:
        print("[NGROK] No auth token — using ephemeral free tunnel.")
        print("[NGROK] ℹ️  For stable URLs, run:")
        print("            python tunnel_runner.py --token YOUR_TOKEN")
        print("        Get a free token: https://dashboard.ngrok.com\n")

    ngrok_conf.get_default().region = args.region

    # ── Start backend & wait ──────────────────────────────────────
    print(f"[BACKEND] Starting FastAPI on port {BACKEND_PORT}...")
    backend_proc = _start_backend()
    _stream(backend_proc, "BACKEND")

    if not _wait_for_port("127.0.0.1", BACKEND_PORT, timeout=35):
        print(f"[WARN] Backend didn't respond in time — proceeding anyway.")
    else:
        print(f"[BACKEND] ✓ Up on http://localhost:{BACKEND_PORT}")

    # ── Create Ngrok tunnels ──────────────────────────────────────
    print(f"\n[NGROK] Opening tunnels...")
    try:
        backend_tunnel  = ngrok.connect(BACKEND_PORT,  "http", bind_tls=True)
        frontend_tunnel = ngrok.connect(FRONTEND_PORT, "http", bind_tls=True)
    except Exception as exc:
        print(f"\n[ERROR] Ngrok tunnel creation failed: {exc}")
        print("[HINT] Common fixes:")
        print("  • Error 'too many connections' → sign up at ngrok.com and use --token")
        print("  • Error 'ERR_NGROK_108'        → ngrok config add-authtoken YOUR_TOKEN")
        print("  • Error 'connection refused'   → ensure ngrok binary is installed:")
        print("                                    pip install pyngrok   (already done)")
        print("                                    pyngrok installs the binary on first run.")
        _kill_all()
        return

    backend_url  = backend_tunnel.public_url
    frontend_url = frontend_tunnel.public_url

    # Ngrok free-tier returns http:// — upgrade to https://
    backend_url  = backend_url.replace("http://", "https://")
    frontend_url = frontend_url.replace("http://", "https://")

    print(f"[NGROK] ✓ Backend  → {backend_url}")
    print(f"[NGROK] ✓ Frontend → {frontend_url}")

    # ── Write .env BEFORE starting Vite so it bakes the URL ──────
    _write_frontend_env(backend_url)

    # ── Start frontend ────────────────────────────────────────────
    print(f"\n[FRONTEND] Starting Vite on port {FRONTEND_PORT}...")
    frontend_proc = _start_frontend()
    _stream(frontend_proc, "FRONTEND")

    if not _wait_for_port("127.0.0.1", FRONTEND_PORT, timeout=60):
        print(f"[WARN] Frontend didn't respond in time — check [FRONTEND] logs above.")
    else:
        print(f"[FRONTEND] ✓ Up on http://localhost:{FRONTEND_PORT}")

    # ── Print summary + QR ────────────────────────────────────────
    _print_summary(frontend_url, backend_url)

    # ── Keep-alive loop ───────────────────────────────────────────
    print("[INFO] Monitoring services (Ctrl+C to stop)...\n")
    try:
        while True:
            time.sleep(5)

            # Auto-restart backend if it crashed
            if backend_proc.poll() is not None:
                print("[WARN] Backend crashed — restarting...")
                backend_proc = _start_backend()
                _stream(backend_proc, "BACKEND")
                if _wait_for_port("127.0.0.1", BACKEND_PORT, timeout=20):
                    print("[BACKEND] ✓ Restarted successfully.")

            # Auto-restart frontend if it crashed
            if frontend_proc.poll() is not None:
                print("[WARN] Frontend crashed — restarting...")
                frontend_proc = _start_frontend()
                _stream(frontend_proc, "FRONTEND")
                if _wait_for_port("127.0.0.1", FRONTEND_PORT, timeout=30):
                    print("[FRONTEND] ✓ Restarted successfully.")

    except KeyboardInterrupt:
        _kill_all()


if __name__ == "__main__":
    main()
