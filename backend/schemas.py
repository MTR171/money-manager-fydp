from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime

# Auth/User schemas:
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=6, description="New password (min 6 characters)")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    monthly_income: Optional[float] = None
    target_savings_goal: Optional[float] = None
    currency: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    monthly_income: float
    target_savings_goal: float
    currency: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserOut

# Transaction schemas:
class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    type: Literal['income', 'expense']
    category: Literal['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other']
    date: datetime
    note: Optional[str] = None

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    type: Optional[Literal['income', 'expense']] = None
    category: Optional[Literal['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other']] = None
    date: Optional[datetime] = None
    note: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    user_id: int
    amount: float
    type: str
    category: str
    date: datetime
    note: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Budget schemas:
class BudgetCreate(BaseModel):
    monthly_limit: float
    food_pct: Optional[float] = 15.0
    housing_pct: Optional[float] = 30.0
    transport_pct: Optional[float] = 10.0
    entertainment_pct: Optional[float] = 5.0
    utilities_pct: Optional[float] = 10.0
    healthcare_pct: Optional[float] = 5.0
    shopping_pct: Optional[float] = 10.0
    other_pct: Optional[float] = 15.0

class BudgetOut(BaseModel):
    id: int
    user_id: int
    monthly_limit: float
    food_pct: float
    housing_pct: float
    transport_pct: float
    entertainment_pct: float
    utilities_pct: float
    healthcare_pct: float
    shopping_pct: float
    other_pct: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Analytics schemas:
class SummaryResponse(BaseModel):
    total_income: float
    total_expense: float
    net_balance: float
    savings_rate: float
    period: str

class CategoryBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float

class RecommendationAlert(BaseModel):
    type: str
    title: str
    message: str

class RuleBasedAnalysis(BaseModel):
    budget_metrics: Dict[str, Any]
    alerts: List[RecommendationAlert]
    recommendations: List[str]

class MLPredictRequest(BaseModel):
    daily_avg_spend: float
    spending_velocity: float
    savings_ratio: float
    days_left: int
    top_category_ratio: float

class MLPredictResponse(BaseModel):
    risk_level: Literal['Low', 'Medium', 'High']
    confidence_score: float
    key_drivers: List[str]

# Budget Benchmark (50/30/20 advisor) schema
class BudgetBenchmarkCategory(BaseModel):
    category: str
    spent: float
    benchmark_limit: float
    percentage_of_benchmark: float
    status: Literal['safe', 'warning', 'over']

class BudgetBenchmark(BaseModel):
    income_ref: float
    needs_spent: float
    needs_target: float
    needs_pct: float
    wants_spent: float
    wants_target: float
    wants_pct: float
    actual_savings: float
    savings_target: float
    savings_pct: float
    projected_monthly_spend: float
    category_breakdown: List[BudgetBenchmarkCategory]
    summary: str  # e.g. "On track", "Needs attention"

# Goal schemas
class GoalCreate(BaseModel):
    title: str
    target_amount: float = Field(gt=0)
    current_amount: float = Field(default=0.0, ge=0)
    deadline: Optional[datetime] = None
    icon: str = '🎯'

class GoalDeposit(BaseModel):
    amount: float = Field(gt=0)

class GoalOut(BaseModel):
    id: int
    user_id: int
    title: str
    target_amount: float
    current_amount: float
    deadline: Optional[datetime]
    icon: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# CategoryBudget schemas
class CategoryBudgetCreate(BaseModel):
    category: Literal['Food/Dining','Housing/Rent','Transport','Entertainment','Utilities','Healthcare','Shopping','Other']
    monthly_limit: float = Field(gt=0)
    month: int = Field(ge=1, le=12)
    year: int

class CategoryBudgetOut(BaseModel):
    id: int
    user_id: int
    category: str
    monthly_limit: float
    month: int
    year: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BudgetStatusItem(BaseModel):
    category: str
    monthly_limit: float
    spent: float
    remaining: float
    percentage: float
    status: Literal['safe', 'warning', 'over']

# Bill schemas
class BillCreate(BaseModel):
    title: str
    amount: float = Field(gt=0)
    due_date: datetime
    recurring_frequency: str = 'monthly'
    category: str = 'Utilities'
    is_paid: bool = False

class BillUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    recurring_frequency: Optional[str] = None
    category: Optional[str] = None
    is_paid: Optional[bool] = None

class BillOut(BaseModel):
    id: int
    user_id: int
    title: str
    amount: float
    due_date: datetime
    is_paid: bool
    recurring_frequency: str
    category: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Cashflow trend schema
class CashflowMonth(BaseModel):
    month: str
    income: float
    expense: float
