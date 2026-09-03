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
