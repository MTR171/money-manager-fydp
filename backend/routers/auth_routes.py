from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from schemas import UserCreate, UserLogin, UserOut, TokenResponse, UserUpdate, PasswordResetRequest
from models import User
from auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix='/api/auth', tags=['Authentication'])


@router.post('/register', response_model=TokenResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    norm_email = user_in.email.strip().lower()
    db_user = db.query(User).filter(
        (User.email == norm_email) | (User.email == user_in.email)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        email=norm_email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name.strip()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}


@router.post('/login', response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    norm_email = user_in.email.strip().lower()
    user = db.query(User).filter(
        (User.email == norm_email) | (User.email == user_in.email)
    ).first()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
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
    Consistent with registration and login logic.
    """
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
