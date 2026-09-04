from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta

from database import get_db
from models import User, Transaction
from auth import get_current_user
from schemas import TransactionCreate, TransactionUpdate, TransactionOut, SummaryResponse, CategoryBreakdown

router = APIRouter(prefix='/api/transactions', tags=['Transactions'])


def _parse_date(date_str: str) -> datetime:
    """Parse ISO date string safely."""
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return datetime.strptime(date_str[:10], "%Y-%m-%d")


def _compute_summary(transactions: List[Transaction], period_name: str) -> SummaryResponse:
    total_income = sum(t.amount for t in transactions if t.type == 'income')
    total_expense = sum(t.amount for t in transactions if t.type == 'expense')
    net = total_income - total_expense
    savings_rate = (net / total_income * 100) if total_income > 0 else 0.0
    return SummaryResponse(
        total_income=total_income,
        total_expense=total_expense,
        net_balance=net,
        savings_rate=savings_rate,
        period=period_name
    )


# ─── Summary endpoints MUST come BEFORE /{transaction_id} to avoid routing conflict ───

@router.get('/summary/daily', response_model=SummaryResponse)
def get_daily_summary(
    date_str: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_date = _parse_date(date_str).date() if date_str else date.today()
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).all()
    daily_trans = [t for t in transactions if t.date.date() == target_date]
    return _compute_summary(daily_trans, str(target_date))


@router.get('/summary/weekly', response_model=SummaryResponse)
def get_weekly_summary(
    week_start: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if week_start:
        start = _parse_date(week_start).date()
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday of this week
    end = start + timedelta(days=6)

    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).all()
    weekly_trans = [t for t in transactions if start <= t.date.date() <= end]
    return _compute_summary(weekly_trans, f"{start} to {end}")


@router.get('/summary/monthly', response_model=SummaryResponse)
def get_monthly_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    monthly_trans = [t for t in transactions if t.date.year == target_year and t.date.month == target_month]
    return _compute_summary(monthly_trans, f"{target_year}-{target_month:02d}")


@router.get('/summary/category-breakdown', response_model=List[CategoryBreakdown])
def get_category_breakdown(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'expense'
    ).all()
    monthly_trans = [t for t in transactions if t.date.year == target_year and t.date.month == target_month]

    total_expense = sum(t.amount for t in monthly_trans)
    cat_amounts: dict = {}
    for t in monthly_trans:
        cat_amounts[t.category] = cat_amounts.get(t.category, 0) + t.amount

    return [
        CategoryBreakdown(
            category=cat,
            amount=amt,
            percentage=(amt / total_expense * 100) if total_expense > 0 else 0
        )
        for cat, amt in cat_amounts.items()
    ]


# ─── CRUD endpoints ───

@router.post('/', response_model=TransactionOut)
def create_transaction(
    trans_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note_val = trans_in.note if trans_in.note is not None else trans_in.description
    new_trans = Transaction(
        user_id=current_user.id,
        amount=trans_in.amount,
        type=trans_in.type,
        category=trans_in.category,
        date=trans_in.date,
        note=note_val
    )
    db.add(new_trans)
    db.commit()
    db.refresh(new_trans)
    return new_trans


@router.get('/', response_model=List[TransactionOut])
def list_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if start_date:
        query = query.filter(Transaction.date >= _parse_date(start_date))
    if end_date:
        query = query.filter(Transaction.date <= _parse_date(end_date))
    if category:
        query = query.filter(Transaction.category == category)
    if type:
        query = query.filter(Transaction.type == type)

    return query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()


@router.get('/{transaction_id}', response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    trans = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return trans


@router.put('/{transaction_id}', response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    trans_in: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    trans = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if trans_in.amount is not None:
        trans.amount = trans_in.amount
    if trans_in.type is not None:
        trans.type = trans_in.type
    if trans_in.category is not None:
        trans.category = trans_in.category
    if trans_in.date is not None:
        trans.date = trans_in.date
    if trans_in.note is not None:
        trans.note = trans_in.note
    elif trans_in.description is not None:
        trans.note = trans_in.description

    db.commit()
    db.refresh(trans)
    return trans


@router.delete('/{transaction_id}')
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    trans = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(trans)
    db.commit()
    return {"message": "Transaction deleted successfully"}
