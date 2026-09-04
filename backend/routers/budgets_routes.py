from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import CategoryBudgetCreate, CategoryBudgetOut, BudgetStatusItem
from models import CategoryBudget, Transaction
from auth import get_current_user, User

router = APIRouter(prefix='/api/budgets', tags=['Budgets'])

CATEGORIES = ['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other']

@router.get('/status', response_model=List[BudgetStatusItem])
def get_budget_status(
    month: int,
    year: int,
    current_user=Depends(get_current_user),
    db: Session=Depends(get_db)
):
    # Get user category budgets for the month/year
    budgets = db.query(CategoryBudget).filter(
        CategoryBudget.user_id == current_user.id,
        CategoryBudget.month == month,
        CategoryBudget.year == year
    ).all()
    budget_map = {b.category: b.monthly_limit for b in budgets}

    # Get user transactions for the month/year
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'expense'
    ).all()
    
    # Filter in memory because of date
    month_trans = [t for t in transactions if t.date.month == month and t.date.year == year]
    spent_map = {}
    for t in month_trans:
        spent_map[t.category] = spent_map.get(t.category, 0.0) + t.amount

    result = []
    for cat in CATEGORIES:
        limit = budget_map.get(cat, 0.0)
        spent = spent_map.get(cat, 0.0)
        remaining = max(limit - spent, 0.0) if limit > 0 else 0.0
        pct = (spent / limit) * 100 if limit > 0 else 0.0
        
        stat = 'safe'
        if pct >= 100:
            stat = 'over'
        elif pct >= 80:
            stat = 'warning'
            
        result.append(BudgetStatusItem(
            category=cat,
            monthly_limit=limit,
            spent=spent,
            remaining=remaining,
            percentage=pct,
            status=stat
        ))
    return result

@router.post('/', response_model=CategoryBudgetOut)
def upsert_budget(
    budget_in: CategoryBudgetCreate,
    current_user=Depends(get_current_user),
    db: Session=Depends(get_db)
):
    budget = db.query(CategoryBudget).filter(
        CategoryBudget.user_id == current_user.id,
        CategoryBudget.category == budget_in.category,
        CategoryBudget.month == budget_in.month,
        CategoryBudget.year == budget_in.year
    ).first()
    
    if budget:
        budget.monthly_limit = budget_in.monthly_limit
    else:
        budget = CategoryBudget(user_id=current_user.id, **budget_in.model_dump())
        db.add(budget)
        
    db.commit()
    db.refresh(budget)
    return budget

@router.get('/', response_model=List[CategoryBudgetOut])
def list_budgets(current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    return db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()

@router.delete('/{budget_id}', status_code=204)
def delete_budget(budget_id: int, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    budget = db.query(CategoryBudget).filter(CategoryBudget.id == budget_id, CategoryBudget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail='Budget not found')
    db.delete(budget)
    db.commit()
