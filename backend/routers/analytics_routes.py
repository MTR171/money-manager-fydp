from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
import os
import joblib
from typing import Dict, Any, List

from database import get_db
from models import User, Transaction, Budget, CategoryBudget
from auth import get_current_user
from schemas import (
    RuleBasedAnalysis, RecommendationAlert, MLPredictRequest, MLPredictResponse,
    CategoryBreakdown, CashflowMonth, BudgetBenchmark, BudgetBenchmarkCategory
)

router = APIRouter(prefix='/api/analytics', tags=['Analytics'])

# ─── ML Model Loading ───────────────────────────────────────────────────────────

_ML_MODEL_CACHE = None
_ML_MODEL_LOADED = False


def load_ml_model():
    """Load ML model once and cache. Returns None gracefully if not found."""
    global _ML_MODEL_CACHE, _ML_MODEL_LOADED
    if _ML_MODEL_LOADED:
        return _ML_MODEL_CACHE
    model_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'ml', 'overspending_model.pkl'
    )
    try:
        if os.path.exists(model_path):
            _ML_MODEL_CACHE = joblib.load(model_path)
            print(f"[ML] Model loaded from {model_path}")
        else:
            print(f"[ML] Model not found at {model_path}. Using rule-based fallback.")
    except Exception as e:
        print(f"[ML] Failed to load model: {e}. Using rule-based fallback.")
    _ML_MODEL_LOADED = True
    return _ML_MODEL_CACHE


# ─── Rule-Based Fallback ────────────────────────────────────────────────────────

def rule_based_predict(features: dict) -> dict:
    """Rule-based risk classification when ML model is unavailable."""
    sv = features.get('spending_velocity', 0)
    sr = features.get('savings_ratio', 0)
    dl = features.get('days_left', 15)
    tcr = features.get('top_category_ratio', 0)

    key_drivers = []

    if sv > 0.9:
        key_drivers.append("Critical spending velocity")
    if sr < 0.05:
        key_drivers.append("Near-zero savings ratio")
    if sv > 0.7 and dl < 10:
        key_drivers.append("High spending with few days left in month")
    if tcr > 0.6:
        key_drivers.append("Single category dominates spending")

    if sv > 0.9 or sr < 0.05 or (sv > 0.7 and dl < 10):
        return {
            "risk_level": "High",
            "confidence_score": 0.85,
            "key_drivers": key_drivers or ["Multiple high-risk financial signals detected"]
        }
    elif sv > 0.6 or sr < 0.20 or (tcr > 0.6 and sv > 0.5):
        return {
            "risk_level": "Medium",
            "confidence_score": 0.72,
            "key_drivers": key_drivers or ["Moderate spending relative to income"]
        }
    else:
        return {
            "risk_level": "Low",
            "confidence_score": 0.88,
            "key_drivers": ["Healthy spending velocity", "Adequate savings ratio"]
        }


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get('/recommendations', response_model=RuleBasedAnalysis)
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns spending alerts and recommendations evaluated against the user's
    OWN custom CategoryBudget limits (set in the Budgets page).

    The 50/30/20 rule is NOT used here as a hard constraint — it lives
    separately in GET /api/analytics/budget-benchmark as an optional advisor.
    """
    today = date.today()
    all_trans = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    monthly_trans = [
        t for t in all_trans
        if t.date.year == today.year and t.date.month == today.month
    ]

    total_expense = sum(t.amount for t in monthly_trans if t.type == 'expense')
    total_income_trans = sum(t.amount for t in monthly_trans if t.type == 'income')

    income = current_user.monthly_income if current_user.monthly_income > 0 else (
        total_income_trans if total_income_trans > 0 else 1.0
    )

    # Per-category actual spend this month
    cat_amounts: Dict[str, float] = {}
    for t in monthly_trans:
        if t.type == 'expense':
            cat_amounts[t.category] = cat_amounts.get(t.category, 0) + t.amount

    # ── Load user-defined custom budgets for this month/year ─────────────────
    custom_budgets = db.query(CategoryBudget).filter(
        CategoryBudget.user_id == current_user.id,
        CategoryBudget.month == today.month,
        CategoryBudget.year == today.year,
    ).all()
    custom_limit_map: Dict[str, float] = {cb.category: cb.monthly_limit for cb in custom_budgets}

    # ── Spending velocity ─────────────────────────────────────────────────────
    days_elapsed = max(today.day, 1)
    projected_monthly_spend = (total_expense / days_elapsed) * 30
    actual_savings = income - total_expense

    # ── Budget metrics (kept for UI display; now uses custom limits) ──────────
    budget_metrics: Dict[str, Any] = {
        "income_ref": round(income, 2),
        "total_expense": round(total_expense, 2),
        "actual_savings": round(actual_savings, 2),
        "projected_monthly_spend": round(projected_monthly_spend, 2),
        "custom_budgets_set": len(custom_limit_map),
    }

    alerts: List[RecommendationAlert] = []
    recommendations: List[str] = []

    # ── 1. Alerts from custom category budgets (primary rule engine) ──────────
    if custom_limit_map:
        for cat, limit in custom_limit_map.items():
            spent = cat_amounts.get(cat, 0)
            pct = (spent / limit * 100) if limit > 0 else 0
            if pct >= 100:
                alerts.append(RecommendationAlert(
                    type="danger",
                    title=f"{cat} Budget Exceeded",
                    message=f"You've spent {spent:.0f} on {cat} vs your custom limit of {limit:.0f} ({pct:.0f}% used). Reduce {cat} spending to stay on track."
                ))
            elif pct >= 80:
                alerts.append(RecommendationAlert(
                    type="warning",
                    title=f"{cat} Near Budget Limit",
                    message=f"You've used {pct:.0f}% of your {cat} budget ({spent:.0f} / {limit:.0f}). Only {limit - spent:.0f} remaining."
                ))
    else:
        # No custom budgets — friendly nudge instead of a hard alert
        recommendations.append(
            "💡 No custom category budgets are set yet. Visit the Budgets page to set your own monthly spending limits per category."
        )

    # ── 2. Spending velocity alert (always active) ────────────────────────────
    if projected_monthly_spend > income:
        overshoot = projected_monthly_spend - income
        alerts.append(RecommendationAlert(
            type="danger",
            title="Overspending Velocity Alert",
            message=f"At your current daily rate, you'll overspend by {overshoot:.0f} this month. Try to cut back immediately."
        ))

    # ── 3. Savings health alerts (always active) ──────────────────────────────
    if actual_savings < 0:
        alerts.append(RecommendationAlert(
            type="danger",
            title="Negative Savings — Deficit Month",
            message=f"You're spending {abs(actual_savings):.0f} more than you earn this month. Review your largest expense categories."
        ))
    elif income > 0 and (actual_savings / income) < 0.10:
        alerts.append(RecommendationAlert(
            type="warning",
            title="Low Savings Rate",
            message=f"Your savings rate is only {(actual_savings/income*100):.0f}% this month. Consider reducing discretionary spending."
        ))

    # ── 4. Positive recommendations ───────────────────────────────────────────
    if actual_savings >= income * 0.20:
        recommendations.append(f"✅ Excellent! You're saving {(actual_savings/income*100):.0f}% of your income this month. Consider investing the surplus.")
    if not alerts:
        recommendations.append("✅ All your custom budgets are healthy this month. Great financial discipline!")

    recommendations.append("💡 Check the 50/30/20 Advisor tab in Budgets to compare your spending against the global benchmark.")
    recommendations.append("💡 Automate bill payments to avoid late fees and reduce financial stress.")

    if current_user.target_savings_goal > 0:
        progress_pct = min((actual_savings / current_user.target_savings_goal) * 100, 100)
        recommendations.append(
            f"🎯 Savings goal progress: {actual_savings:.0f} / {current_user.target_savings_goal:.0f} ({progress_pct:.0f}%)"
        )

    return RuleBasedAnalysis(
        budget_metrics=budget_metrics,
        alerts=alerts,
        recommendations=recommendations
    )


# ── 50/30/20 Financial Health Benchmark (optional advisor) ────────────────────

# Canonical 50/30/20 allocation per category (derived from standard guidance)
NEEDS_CATEGORIES = ['Housing/Rent', 'Transport', 'Utilities', 'Healthcare']
WANTS_CATEGORIES = ['Food/Dining', 'Entertainment', 'Shopping']
CATEGORY_50_30_20_PCT = {
    'Food/Dining':    0.15,
    'Housing/Rent':   0.30,
    'Transport':      0.10,
    'Entertainment':  0.05,
    'Utilities':      0.10,
    'Healthcare':     0.05,
    'Shopping':       0.10,
    'Other':          0.15,
}


@router.get('/budget-benchmark', response_model=BudgetBenchmark)
def get_budget_benchmark(
    month: int = Query(default=None, ge=1, le=12),
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    50/30/20 Financial Health Benchmark — ADVISORY ONLY.
    Shows how the user's spending compares against the standard 50/30/20 rule.
    Does NOT generate blocking alerts; provides educational context only.
    """
    today = date.today()
    m = month or today.month
    y = year or today.year

    monthly_trans = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).all()
    monthly_trans = [t for t in monthly_trans if t.date.year == y and t.date.month == m]

    total_expense = sum(t.amount for t in monthly_trans if t.type == 'expense')
    total_income_trans = sum(t.amount for t in monthly_trans if t.type == 'income')

    income = current_user.monthly_income if current_user.monthly_income > 0 else (
        total_income_trans if total_income_trans > 0 else 1.0
    )

    cat_amounts: Dict[str, float] = {}
    for t in monthly_trans:
        if t.type == 'expense':
            cat_amounts[t.category] = cat_amounts.get(t.category, 0) + t.amount

    needs_spent = sum(cat_amounts.get(c, 0) for c in NEEDS_CATEGORIES)
    wants_spent = sum(cat_amounts.get(c, 0) for c in WANTS_CATEGORIES)
    actual_savings = income - total_expense

    needs_target = income * 0.50
    wants_target = income * 0.30
    savings_target = income * 0.20

    days_elapsed = max(today.day, 1)
    projected = (total_expense / days_elapsed) * 30

    # Per-category benchmark breakdown
    breakdown = []
    for cat, pct in CATEGORY_50_30_20_PCT.items():
        spent = cat_amounts.get(cat, 0)
        limit = income * pct
        pct_used = (spent / limit * 100) if limit > 0 else 0
        breakdown.append(BudgetBenchmarkCategory(
            category=cat,
            spent=round(spent, 2),
            benchmark_limit=round(limit, 2),
            percentage_of_benchmark=round(pct_used, 1),
            status='over' if pct_used >= 100 else ('warning' if pct_used >= 80 else 'safe'),
        ))

    over_count = sum(1 for b in breakdown if b.status == 'over')
    summary = "On Track" if over_count == 0 and actual_savings >= savings_target else \
              "Needs Attention" if over_count <= 2 else "High Risk"

    return BudgetBenchmark(
        income_ref=round(income, 2),
        needs_spent=round(needs_spent, 2),
        needs_target=round(needs_target, 2),
        needs_pct=round((needs_spent / needs_target * 100) if needs_target > 0 else 0, 1),
        wants_spent=round(wants_spent, 2),
        wants_target=round(wants_target, 2),
        wants_pct=round((wants_spent / wants_target * 100) if wants_target > 0 else 0, 1),
        actual_savings=round(actual_savings, 2),
        savings_target=round(savings_target, 2),
        savings_pct=round((actual_savings / income * 100) if income > 0 else 0, 1),
        projected_monthly_spend=round(projected, 2),
        category_breakdown=breakdown,
        summary=summary,
    )


@router.post('/predict-risk', response_model=MLPredictResponse)
def predict_risk(
    request: MLPredictRequest,
    current_user: User = Depends(get_current_user)
):
    """Predict overspending risk using ML model (with rule-based fallback)."""
    model_data = load_ml_model()

    if model_data:
        try:
            import pandas as pd
            model = model_data['model']
            feature_names = model_data.get('feature_names', [
                'daily_avg_spend', 'spending_velocity', 'savings_ratio',
                'days_left', 'top_category_ratio'
            ])
            df = pd.DataFrame([{
                'daily_avg_spend': request.daily_avg_spend,
                'spending_velocity': request.spending_velocity,
                'savings_ratio': request.savings_ratio,
                'days_left': request.days_left,
                'top_category_ratio': request.top_category_ratio
            }])[feature_names]

            pred = model.predict(df)[0]
            proba = model.predict_proba(df)[0]
            classes = list(model.classes_)
            confidence = float(proba[classes.index(pred)])

            # Feature importance → key drivers
            importances = model.feature_importances_
            feat_imp = sorted(zip(feature_names, importances), key=lambda x: -x[1])
            key_drivers = [
                f"{name.replace('_', ' ').title()}: {request.model_dump()[name]:.3f}"
                for name, _ in feat_imp[:3]
            ]

            return MLPredictResponse(
                risk_level=pred,
                confidence_score=round(confidence, 3),
                key_drivers=key_drivers
            )
        except Exception as e:
            print(f"[ML] Inference failed: {e}. Falling back to rule-based.")

    # Rule-based fallback
    res = rule_based_predict(request.model_dump())
    return MLPredictResponse(**res)


@router.get('/dashboard-summary')
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    today = date.today()
    all_trans = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc()).all()

    # Dynamic Net Balance: strictly sum(all income transactions) - sum(all expense transactions)
    all_income = sum(t.amount for t in all_trans if t.type == 'income')
    all_expense = sum(t.amount for t in all_trans if t.type == 'expense')
    net_balance = all_income - all_expense

    monthly_trans = [
        t for t in all_trans
        if t.date.year == today.year and t.date.month == today.month
    ]

    total_expense = sum(t.amount for t in monthly_trans if t.type == 'expense')
    total_income = sum(t.amount for t in monthly_trans if t.type == 'income')
    savings_rate = ((total_income - total_expense) / total_income * 100) if total_income > 0 else 0.0

    income_ref = current_user.monthly_income if current_user.monthly_income > 0 else (
        total_income if total_income > 0 else 1.0
    )
    days_elapsed = max(today.day, 1)
    days_left = max(30 - today.day, 1)
    daily_avg = total_expense / days_elapsed
    spending_velocity = (daily_avg * 30) / income_ref

    # Category breakdown
    cat_amounts: Dict[str, float] = {}
    for t in monthly_trans:
        if t.type == 'expense':
            cat_amounts[t.category] = cat_amounts.get(t.category, 0) + t.amount

    top_cat_amt = max(cat_amounts.values()) if cat_amounts else 0
    top_category_ratio = (top_cat_amt / total_expense) if total_expense > 0 else 0

    category_breakdown = [
        {
            "category": cat,
            "amount": round(amt, 2),
            "percentage": round((amt / total_expense * 100) if total_expense > 0 else 0, 1)
        }
        for cat, amt in sorted(cat_amounts.items(), key=lambda x: -x[1])
    ]

    # Risk prediction inline
    risk_features = MLPredictRequest(
        daily_avg_spend=round(daily_avg, 2),
        spending_velocity=round(min(spending_velocity, 2.0), 4),
        savings_ratio=round(max((income_ref - total_expense) / income_ref, -1.0), 4),
        days_left=days_left,
        top_category_ratio=round(top_category_ratio, 4)
    )
    risk_response = predict_risk(risk_features, current_user)

    # Weekly trend: last 4 complete weeks
    weekly_trend = []
    for i in range(3, -1, -1):
        week_end = today - timedelta(days=today.weekday()) + timedelta(days=6) - timedelta(weeks=i)
        week_start = week_end - timedelta(days=6)
        week_expense = sum(
            t.amount for t in all_trans
            if t.type == 'expense' and week_start <= t.date.date() <= week_end
        )
        label = f"W{4 - i}" if i > 0 else "This Week"
        weekly_trend.append({"week": label, "amount": round(week_expense, 2)})

    # Budget info
    budget = db.query(Budget).filter(Budget.user_id == current_user.id).first()
    budget_info = {
        "monthly_limit": budget.monthly_limit if budget else income_ref,
        "has_budget": budget is not None
    }

    return {
        "current_month": {
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "net_balance": round(net_balance, 2),
            "savings_rate": round(savings_rate, 2)
        },
        "risk_prediction": risk_response.model_dump(),
        "category_breakdown": category_breakdown,
        "recent_transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "category": t.category,
                "date": t.date.isoformat(),
                "note": t.note
            }
            for t in all_trans[:10]
        ],
        "weekly_trend": weekly_trend,
        "budget": budget_info,
        "user": {
            "monthly_income": current_user.monthly_income,
            "target_savings_goal": current_user.target_savings_goal,
            "currency": current_user.currency
        }
    }

@router.get('/cashflow-trend', response_model=List[CashflowMonth])
def get_cashflow_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    months = min(max(months, 1), 12)
    today = date.today()
    
    all_trans = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    
    result = []
    import calendar
    for i in range(months - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
            
        month_trans = [t for t in all_trans if t.date.year == y and t.date.month == m]
        income = sum(t.amount for t in month_trans if t.type == 'income')
        expense = sum(t.amount for t in month_trans if t.type == 'expense')
        
        month_str = calendar.month_abbr[m]
        result.append(CashflowMonth(month=month_str, income=income, expense=expense))
        
    return result
