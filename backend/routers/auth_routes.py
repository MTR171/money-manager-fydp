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
from email_service import send_verification_email

router = APIRouter(prefix='/api/auth', tags=['Authentication'])


@router.post('/register', response_model=RegisterResponse, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user:
    - Enforces strong password policy
    - Generates email verification token
    - Sends verification email (with mock fallback if SMTP not configured)
    """
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
    verification_token = secrets.token_urlsafe(32)

    new_user = User(
        email=norm_email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name.strip(),
        is_verified=False,
        verification_token=verification_token
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send verification email
    verify_link = send_verification_email(
        to_email=new_user.email,
        token=verification_token,
        full_name=new_user.full_name
    )

    return RegisterResponse(
        message="Registration successful! Please check your email to verify your account before logging in.",
        email=new_user.email,
        is_verified=False,
        verification_link=verify_link
    )


@router.get('/verify-email', response_model=VerifyEmailResponse)
def verify_email(token: str = Query(..., min_length=5), db: Session = Depends(get_db)):
    """
    Verify user email address using the secure token sent via email.
    Activates user account by setting is_verified=True.
    """
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link. Please request a new verification email."
        )
    
    user.is_verified = True
    user.verification_token = None
    db.commit()

    return VerifyEmailResponse(
        status="success",
        message="Email verified successfully! You can now log in to your account."
    )


@router.post('/resend-verification')
def resend_verification(email: str = Query(...), db: Session = Depends(get_db)):
    """Resend email verification link if user has not verified yet."""
    norm_email = email.strip().lower()
    user = db.query(User).filter(
        (User.email == norm_email) | (User.email == email)
    ).first()
    if not user:
        # Don't leak whether email exists
        return {"message": "If an account with that email exists, a verification link has been sent."}
    
    if user.is_verified:
        return {"message": "Account is already verified. You can log in directly."}
    
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    db.commit()

    verify_link = send_verification_email(to_email=user.email, token=token, full_name=user.full_name)
    return {
        "message": "Verification email sent. Please check your inbox.",
        "verification_link": verify_link
    }


@router.post('/login', response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    norm_email = user_in.email.strip().lower()
    user = db.query(User).filter(
        (User.email == norm_email) | (User.email == user_in.email)
    ).first()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Block login if user email has not been verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email to log in. Check your inbox for the activation link."
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@router.get('/me', response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put('/me', response_model=UserOut)
def update_me(user_update: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name.strip()
    if user_update.monthly_income is not None:
        current_user.monthly_income = user_update.monthly_income
    if user_update.target_savings_goal is not None:
        current_user.target_savings_goal = user_update.target_savings_goal
    if user_update.currency is not None:
        current_user.currency = user_update.currency
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post('/forgot-password')
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """
    Reset a user's password directly by email using passlib bcrypt hashing.
    Enforces strong password policy.
    """
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

    return {"message": "Password reset successfully. You can now log in with your new password."}
