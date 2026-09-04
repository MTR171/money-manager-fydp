from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import GoalCreate, GoalDeposit, GoalOut
from models import Goal
from auth import get_current_user, User

router = APIRouter(prefix='/api/goals', tags=['Goals'])

@router.get('/', response_model=List[GoalOut])
def list_goals(current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    return db.query(Goal).filter(Goal.user_id==current_user.id).order_by(Goal.created_at.desc()).all()

@router.post('/', response_model=GoalOut, status_code=201)
def create_goal(goal_in: GoalCreate, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    goal = Goal(user_id=current_user.id, **goal_in.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal

@router.patch('/{goal_id}/deposit', response_model=GoalOut)
def deposit_to_goal(goal_id: int, deposit: GoalDeposit, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id==goal_id, Goal.user_id==current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    goal.current_amount = min(goal.current_amount + deposit.amount, goal.target_amount)
    db.commit()
    db.refresh(goal)
    return goal

@router.delete('/{goal_id}', status_code=204)
def delete_goal(goal_id: int, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id==goal_id, Goal.user_id==current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    db.delete(goal)
    db.commit()
