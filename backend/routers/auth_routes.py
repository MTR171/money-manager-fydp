import os
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    UserCreate, UserLogin, UserOut, TokenResponse, UserUpdate,
    PasswordResetRequest, RegisterResponse, VerifyEmailResponse,
    validate_password_strength
)
from models import User
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from email_service import send_verification_email, is_smtp_configured, get_verification_url

router = APIRouter(prefix='/api/auth', tags=['Authentication'])

@router.post('/register', response_model=RegisterResponse, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Explicit password strength verification (guarantees HTTP 400 on failure)
    try:
        validate_password_strength(user_in.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    norm_email = user_in.email.strip().lower()
    db_user = db.query(User).filter(
        (User.email == norm_email) | (User.email == user_in.email)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user_in.password)
    otp_code = secrets.choice('0123456789') * 6
    otp_expiry = datetime.utcnow() + timedelta(minutes=5)

    new_user = User(
        email=norm_email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name.strip(),
        is_verified=False,
        verification_token=None,
        otp_code=otp_code,
        otp_expiry=otp_expiry
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send OTP via email
    email_sent = send_verification_email(
        to_email=new_user.email,
        token=otp_code,
        full_name=new_user.full_name,
        subject="Your OTP for Money Manager Account Verification"
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP via email. Please try again later."
        )

    return RegisterResponse(
        message="Registration successful! Please check your email to verify your account before logging in.",
        email=new_user.email,
        is_verified=False,
        verification_link=None
    )

@router.post('/verify-otp', response_model=VerifyEmailResponse)
def verify_otp(token: str = Query(..., min_length=6), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.otp_code == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please try again."
        )
    
    if user.otp_expiry < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP."
        )
    
    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    db.commit()

    return VerifyEmailResponse(
        status="success",
        message="OTP verified successfully! You can now log in to your account."
    )

@router.post('/forgot-password')
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    try:
        validate_password_strength(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    norm_email = payload.email.strip().lower()
    user = db.query(User).filter(
        (User.email == norm_email) | (User.email == payload.email)
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address."
        )

    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    # Trigger email notification
    send_verification_email(
        to_email=user.email,
        token=user.email,
        full_name=user.full_name,
        subject="Your Password has been Reset"
    )

    return {"message": "Password reset successfully. You can now log in with your new password."}
