"""
auth_routes.py — Full authentication API router.
Mounted at /api/auth/* via main.py
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from schemas import (
    UserCreate, UserLogin, UserOut, UserUpdate,
    TokenResponse, RegisterResponse, VerifyEmailResponse,
    PasswordResetRequest, validate_password_strength,
)
from email_service import send_verification_email, is_smtp_configured, get_verification_url

router = APIRouter(prefix='/api/auth', tags=['Authentication'])


# ── Register ──────────────────────────────────────────────────────────────────
@router.post('/register', response_model=RegisterResponse, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Validate password strength (HTTP 400 on failure)
    try:
        validate_password_strength(user_in.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    norm_email = user_in.email.strip().lower()
    existing = db.query(User).filter(
        func.lower(User.email) == norm_email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate a proper 6-digit OTP (each digit is independently random)
    otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))
    otp_expiry = datetime.utcnow() + timedelta(minutes=10)

    hashed_pwd = get_password_hash(user_in.password)

    smtp_ready = is_smtp_configured()

    new_user = User(
        email=norm_email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name.strip(),
        is_active=True,
        # Auto-verify if SMTP not configured (development / Render without email env vars)
        is_verified=(not smtp_ready),
        verification_token=None,
        otp_code=otp_code if smtp_ready else None,
        otp_expiry=otp_expiry if smtp_ready else None,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if smtp_ready:
        # Send OTP email
        send_verification_email(
            to_email=new_user.email,
            token=otp_code,
            full_name=new_user.full_name,
            subject="Your OTP for Money Manager Account Verification",
        )
        return RegisterResponse(
            message="Registration successful! Please check your email for the 6-digit OTP to verify your account.",
            email=new_user.email,
            is_verified=False,
            verification_link=None,
            access_token=None,
            user=None,
        )
    else:
        # SMTP not configured — auto-verify and return token immediately
        token = create_access_token(data={"sub": new_user.email})
        return RegisterResponse(
            message="Registration successful! Your account has been automatically verified.",
            email=new_user.email,
            is_verified=True,
            verification_link=None,
            access_token=token,
            user=UserOut.model_validate(new_user),
        )


# ── Verify OTP ────────────────────────────────────────────────────────────────
@router.post('/verify-otp', response_model=VerifyEmailResponse)
def verify_otp(token: str = Query(..., min_length=4, max_length=10), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.otp_code == token.strip()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check the code and try again.")

    if user.otp_expiry and user.otp_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please register again or request a new OTP.")

    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    db.commit()

    return VerifyEmailResponse(
        status="success",
        message="Email verified successfully! You can now log in to your account.",
    )


# ── Verify via link token (legacy / email link flow) ──────────────────────────
@router.get('/verify-email', response_model=VerifyEmailResponse)
def verify_email_link(token: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        # Also try matching otp_code (in case the token IS the OTP)
        user = db.query(User).filter(User.otp_code == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    user.is_verified = True
    user.verification_token = None
    user.otp_code = None
    user.otp_expiry = None
    db.commit()

    return VerifyEmailResponse(status="success", message="Email verified successfully! You can now log in.")


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post('/login', response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    norm_email = credentials.email.strip().lower()
    user = db.query(User).filter(
        func.lower(User.email) == norm_email
    ).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive. Please contact support.")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your email for the OTP and verify your account first.",
        )

    access_token = create_access_token(data={"sub": user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


# ── Get current user ──────────────────────────────────────────────────────────
@router.get('/me', response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Update profile ────────────────────────────────────────────────────────────
@router.put('/me', response_model=UserOut)
def update_me(
    updates: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if updates.full_name is not None:
        current_user.full_name = updates.full_name.strip()
    if updates.monthly_income is not None:
        current_user.monthly_income = updates.monthly_income
    if updates.target_savings_goal is not None:
        current_user.target_savings_goal = updates.target_savings_goal
    if updates.currency is not None:
        current_user.currency = updates.currency
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Forgot / Reset Password ───────────────────────────────────────────────────
@router.post('/forgot-password')
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    try:
        validate_password_strength(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    norm_email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email address.")

    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    # Send notification (non-blocking — ignore failure)
    try:
        send_verification_email(
            to_email=user.email,
            token=user.email,
            full_name=user.full_name,
            subject="Your Money Manager Password Has Been Reset",
        )
    except Exception:
        pass

    return {"message": "Password reset successfully. You can now log in with your new password."}


# ── Resend Verification / OTP ─────────────────────────────────────────────────
@router.post('/resend-verification')
def resend_verification(email: str = Query(...), db: Session = Depends(get_db)):
    norm_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    if user.is_verified:
        return {"message": "Account is already verified. You can log in."}

    # Generate new OTP
    new_otp = ''.join(secrets.choice('0123456789') for _ in range(6))
    user.otp_code = new_otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    send_verification_email(
        to_email=user.email,
        token=new_otp,
        full_name=user.full_name,
        subject="Your New OTP for Money Manager Account Verification",
    )
    return {"message": "A new OTP has been sent to your email address."}


# ── Quick verify (dev/admin bypass — auto-verifies by email) ──────────────────
@router.get('/quick-verify')
def quick_verify(email: str = Query(...), db: Session = Depends(get_db)):
    norm_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    user.verification_token = None
    db.commit()
    return {"message": f"Account {user.email} verified successfully.", "status": "success"}
