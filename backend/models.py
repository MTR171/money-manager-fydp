from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    monthly_income = Column(Float, default=0.0)
    target_savings_goal = Column(Float, default=0.0)
    currency = Column(String, default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    goals = relationship('Goal', back_populates='user')
    category_budgets = relationship('CategoryBudget', back_populates='user')
    bills = relationship('Bill', back_populates='user')

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    type = Column(String) # 'income' | 'expense'
    category = Column(String)
    date = Column(DateTime)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    monthly_limit = Column(Float)
    food_pct = Column(Float, default=15.0)
    housing_pct = Column(Float, default=30.0)
    transport_pct = Column(Float, default=10.0)
    entertainment_pct = Column(Float, default=5.0)
    utilities_pct = Column(Float, default=10.0)
    healthcare_pct = Column(Float, default=5.0)
    shopping_pct = Column(Float, default=10.0)
    other_pct = Column(Float, default=15.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="budgets")

class Goal(Base):
    __tablename__ = 'goals'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True)
    title = Column(String)  # e.g. 'Emergency Fund', 'Laptop'
    target_amount = Column(Float)
    current_amount = Column(Float, default=0.0)
    deadline = Column(DateTime, nullable=True)
    icon = Column(String, default='🎯')  # emoji icon for display
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship('User', back_populates='goals')

class CategoryBudget(Base):
    __tablename__ = 'category_budgets'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True)
    category = Column(String)  # one of the 8 categories
    monthly_limit = Column(Float)
    month = Column(Integer)  # 1-12
    year = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship('User', back_populates='category_budgets')

class Bill(Base):
    __tablename__ = 'bills'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True)
    title = Column(String)  # e.g. 'Internet', 'House Rent'
    amount = Column(Float)
    due_date = Column(DateTime)
    is_paid = Column(Boolean, default=False)
    recurring_frequency = Column(String, default='monthly')  # 'monthly','weekly','yearly','one-time'
    category = Column(String, default='Utilities')
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship('User', back_populates='bills')
