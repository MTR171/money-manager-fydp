from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import BillCreate, BillUpdate, BillOut
from models import Bill
from auth import get_current_user, User

router = APIRouter(prefix='/api/bills', tags=['Bills'])

@router.get('/', response_model=List[BillOut])
def list_bills(current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    return db.query(Bill).filter(Bill.user_id == current_user.id).order_by(Bill.due_date.asc()).all()

@router.post('/', response_model=BillOut, status_code=201)
def create_bill(bill_in: BillCreate, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    bill = Bill(user_id=current_user.id, **bill_in.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill

@router.put('/{bill_id}', response_model=BillOut)
def update_bill(bill_id: int, bill_in: BillUpdate, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    update_data = bill_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bill, key, value)
        
    db.commit()
    db.refresh(bill)
    return bill

@router.delete('/{bill_id}', status_code=204)
def delete_bill(bill_id: int, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    db.delete(bill)
    db.commit()

@router.patch('/{bill_id}/toggle-paid', response_model=BillOut)
def toggle_bill_paid(bill_id: int, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    bill.is_paid = not bill.is_paid
    db.commit()
    db.refresh(bill)
    return bill
