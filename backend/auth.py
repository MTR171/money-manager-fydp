import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import User

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ── JWT Secret Configuration ──────────────────────────────────────────────────
# Reads from environment variable SECRET_KEY, falling back to a deterministic,
# fixed production key so server reboots/restarts and multi-device logins
# NEVER invalidate existing user sessions across devices.
SECRET_KEY = os.getenv("SECRET_KEY") or "moneymanager-secure-fixed-production-jwt-secret-key-2024"
ALGORITHM = "HS256"

# Default token lifespan: 30 days (43,200 minutes) for seamless multi-device persistence
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

# ── Cryptography & OAuth2 ─────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Safely verify plain password against bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"[Auth] Password verification warning: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Generate bcrypt hash from plain password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a stateless JWT access token.
    Includes a unique 'jti' and 'iat' per device login so concurrent sessions
    across multiple devices remain completely independent and never collide.
    """
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": int(now.timestamp()),
        "jti": secrets.token_hex(8),
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Stateless cryptographic JWT verification.
    Does not check against any single-session database token column, allowing
    unlimited concurrent sessions for the same user across desktop, mobile, and tablet.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    user_id = payload.get("uid")
    email: str = payload.get("sub")

    user = None
    if user_id is not None:
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
        except (ValueError, TypeError):
            user = None

    if user is None and email is not None:
        norm_email = email.strip().lower()
        user = db.query(User).filter(func.lower(User.email) == norm_email).first()
        if user is None:
            user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception
    return user

