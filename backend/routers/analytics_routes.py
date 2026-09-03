from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
import os
import joblib
from typing import Dict, Any, List

from database import get_db
from models import User, Transaction, Budget
from auth import get_current_user
from schemas import (
    RuleBasedAnalysis, RecommendationAlert, MLPredictRequest, MLPredictResponse,
    CategoryBreakdown
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
    today = date.today()
    all_trans = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    monthly_trans = [
        t for t in all_trans
        if t.date.year == today.year and t.date.month == today.month
    ]

    total_expense = sum(t.amount for t in monthly_trans if t.type == 'expense')
    total_income_trans = sum(t.amount for t in monthly_trans if t.type == 'income')

    # Use profile income if set, else fall back to recorded income
    income = current_user.monthly_income if current_user.monthly_income > 0 else (
        total_income_trans if total_income_trans > 0 else 1.0
    )

    # Category spending
    cat_amounts: Dict[str, float] = {}
    for t in monthly_trans:
        if t.type == 'expense':
            cat_amounts[t.category] = cat_amounts.get(t.category, 0) + t.amount

    # 50/30/20 Rule
    needs_categories = ['Housing/Rent', 'Transport', 'Utilities', 'Healthcare']
    wants_categories = ['Food/Dining', 'Entertainment', 'Shopping']

    needs_spent = sum(cat_amounts.get(c, 0) for c in needs_categories)
    wants_spent = sum(cat_amounts.get(c, 0) for c in wants_categories)
    other_spent = sum(amt for cat, amt in cat_amounts.items()
                      if cat not in needs_categories and cat not in wants_categories)

    needs_target = income * 0.50
    wants_target = income * 0.30
    savings_target = income * 0.20
    actual_savings = income - total_expense

    # Spending velocity (annualized to monthly)
    days_elapsed = max(today.day, 1)
    projected_monthly_spend = (total_expense / days_elapsed) * 30

    budget_metrics = {
        "needs_spent": round(needs_spent, 2),
        "needs_target": round(needs_target, 2),
        "needs_utilization_pct": round((needs_spent / needs_target * 100) if needs_target > 0 else 0, 1),
        "wants_spent": round(wants_spent, 2),
        "wants_target": round(wants_target, 2),
        "wants_utilization_pct": round((wants_spent / wants_target * 100) if wants_target > 0 else 0, 1),
        "actual_savings": round(actual_savings, 2),
        "savings_target": round(savings_target, 2),
        "projected_monthly_spend": round(projected_monthly_spend, 2),
    }

    alerts: List[RecommendationAlert] = []
    recommendations: List[str] = []

    # 50/30/20 alerts
    if needs_spent > needs_target:
        alerts.append(RecommendationAlert(
            type="danger",
            title="Needs Budget Exceeded (50% rule)",
            message=f"You've spent ${needs_spent:.0f} on needs vs the recommended ${needs_target:.0f} (50% of income)."
        ))
    elif needs_spent > needs_target * 0.8:
        alerts.append(RecommendationAlert(
            type="warning",
            title="Needs Budget at 80%",
            message=f"Your needs spending is approaching the 50% budget limit. ${needs_target - needs_spent:.0f} remaining."
        ))

    if wants_spent > wants_target:
        alerts.append(RecommendationAlert(
            type="danger",
            title="Wants Budget Exceeded (30% rule)",
            message=f"Discretionary spending (${wants_spent:.0f}) exceeds the 30% limit (${wants_target:.0f})."
        ))
    elif wants_spent > wants_target * 0.8:
        alerts.append(RecommendationAlert(
            type="warning",
            title="Wants Budget at 80%",
            message=f"Discretionary spending is 80% of the recommended limit. Consider reducing non-essentials."
        ))

    # Spending velocity alert
    if projected_monthly_spend > income:
        overshoot = projected_monthly_spend - income
        alerts.append(RecommendationAlert(
            type="danger",
            title="Overspending Velocity Alert",
            message=f"At your current rate, you'll overspend by ${overshoot:.0f} this month."
        ))

    # Savings alerts
    if actual_savings < 0:
        alerts.append(RecommendationAlert(
            type="danger",
            title="Negative Savings",
            message=f"You're spending more than you earn this month (deficit: ${abs(actual_savings):.0f})."
        ))
    elif actual_savings < savings_target:
        shortfall = savings_target - actual_savings
        alerts.append(RecommendationAlert(
            type="warning",
            title="Savings Below Target",
            message=f"You're ${shortfall:.0f} below your 20% savings target of ${savings_target:.0f}."
        ))

    # Category-specific alerts (>80% and >100% per category budget)
    cat_budget_map = {
        'Food/Dining': income * 0.15,
        'Housing/Rent': income * 0.30,
        'Transport': income * 0.10,
        'Entertainment': income * 0.05,
        'Utilities': income * 0.10,
        'Healthcare': income * 0.05,
        'Shopping': income * 0.10,
        'Other': income * 0.15,
    }
    for cat, budget_amt in cat_budget_map.items():
        spent = cat_amounts.get(cat, 0)
        if spent > budget_amt:
            alerts.append(RecommendationAlert(
                type="warning",
                title=f"{cat} Over Budget",
                message=f"Spent ${spent:.0f} on {cat} vs ${budget_amt:.0f} budget (100% exceeded)."
            ))
        elif spent > budget_amt * 0.8:
            alerts.append(RecommendationAlert(
                type="info",
                title=f"{cat} Near Budget",
                message=f"You've used 80%+ of your {cat} budget (${spent:.0f} / ${budget_amt:.0f})."
            ))

    # Positive recommendations
    if actual_savings >= savings_target:
        recommendations.append(f"✅ Great job! You're on track to save ${actual_savings:.0f} this month, meeting your 20% savings goal.")
    if needs_spent <= needs_target * 0.7:
        recommendations.append("✅ Your essential expenses are well within the 50% budget. Keep it up!")
    if not alerts:
        recommendations.append("✅ Your finances look healthy this month. Consider investing your surplus savings.")

    recommendations.append("💡 Review your top spending category and set a specific limit to avoid overspending.")
    recommendations.append("💡 Automate bill payments to avoid late fees and reduce financial stress.")

    if current_user.target_savings_goal > 0:
        progress_pct = min((actual_savings / current_user.target_savings_goal) * 100, 100)
        recommendations.append(
            f"🎯 Savings goal progress: ${actual_savings:.0f} / ${current_user.target_savings_goal:.0f} ({progress_pct:.0f}%)"
        )

    return RuleBasedAnalysis(
        budget_metrics=budget_metrics,
        alerts=alerts,
        recommendations=recommendations
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

    monthly_trans = [
        t for t in all_trans
        if t.date.year == today.year and t.date.month == today.month
    ]

    total_expense = sum(t.amount for t in monthly_trans if t.type == 'expense')
    total_income = sum(t.amount for t in monthly_trans if t.type == 'income')
    net_balance = total_income - total_expense
    savings_rate = (net_balance / total_income * 100) if total_income > 0 else 0.0

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
