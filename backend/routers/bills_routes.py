from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from schemas import BillCreate, BillUpdate, BillOut
from models import Bill, Transaction
from auth import get_current_user, User

router = APIRouter(prefix='/api/bills', tags=['Bills'])


def _record_bill_payment_transaction(db: Session, user_id: int, bill: Bill):
    """Insert expense transaction when a bill is paid."""
    trans = Transaction(
        user_id=user_id,
        amount=bill.amount,
        type="expense",
        category=bill.category or "Utilities",
        date=datetime.utcnow(),
        note=f"Paid Bill: {bill.title}"
    )
    db.add(trans)


def _remove_bill_payment_transaction(db: Session, user_id: int, bill: Bill):
    """Remove auto-generated transaction when a bill is unmarked as paid."""
    existing_trans = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.note == f"Paid Bill: {bill.title}"
    ).order_by(Transaction.id.desc()).first()
    if existing_trans:
        db.delete(existing_trans)


@router.get('/', response_model=List[BillOut])
def list_bills(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Bill).filter(Bill.user_id == current_user.id).order_by(Bill.due_date.asc()).all()


@router.post('/', response_model=BillOut, status_code=201)
def create_bill(bill_in: BillCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = Bill(user_id=current_user.id, **bill_in.model_dump())
    db.add(bill)
    if bill.is_paid:
        _record_bill_payment_transaction(db, current_user.id, bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.post('/{bill_id}/pay', response_model=BillOut)
def pay_bill(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Explicit endpoint to mark bill as paid and insert expense transaction."""
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    if not bill.is_paid:
        bill.is_paid = True
        _record_bill_payment_transaction(db, current_user.id, bill)
        db.commit()
        db.refresh(bill)
    return bill


@router.patch('/{bill_id}/toggle-paid', response_model=BillOut)
def toggle_bill_paid(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Toggle bill paid state and create/remove expense transaction accordingly."""
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    bill.is_paid = not bill.is_paid
    if bill.is_paid:
        _record_bill_payment_transaction(db, current_user.id, bill)
    else:
        _remove_bill_payment_transaction(db, current_user.id, bill)

    db.commit()
    db.refresh(bill)
    return bill


@router.patch('/{bill_id}', response_model=BillOut)
def patch_bill(bill_id: int, bill_in: BillUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Support PATCH /bills/{id} with auto-transaction creation on is_paid transition."""
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    was_paid = bill.is_paid
    update_data = bill_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bill, key, value)
    
    if 'is_paid' in update_data:
        if bill.is_paid and not was_paid:
            _record_bill_payment_transaction(db, current_user.id, bill)
        elif not bill.is_paid and was_paid:
            _remove_bill_payment_transaction(db, current_user.id, bill)

    db.commit()
    db.refresh(bill)
    return bill


@router.put('/{bill_id}', response_model=BillOut)
def update_bill(bill_id: int, bill_in: BillUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return patch_bill(bill_id, bill_in, current_user, db)


@router.delete('/{bill_id}', status_code=204)
def delete_bill(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    db.delete(bill)
    db.commit()
