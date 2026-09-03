#!/usr/bin/env python3
"""Standalone ML model trainer for Money Manager overspending risk prediction."""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report
import joblib
import os

# Reproducibility
np.random.seed(42)
N = 5000

# Feature generation
daily_avg_spend = np.random.exponential(scale=50, size=N).clip(5, 500)
spending_velocity = np.random.beta(2, 5, N)  # 0-1 range, mostly below 1
savings_ratio = np.random.beta(3, 2, N)  # 0-1, mostly positive
days_left = np.random.randint(1, 31, N)
top_category_ratio = np.random.beta(2, 3, N)

# Engineer risk labels with realistic business rules:
# High risk: velocity > 0.9 OR savings_ratio < 0.05 OR (velocity > 0.7 and days_left < 10)
# Medium risk: velocity 0.6-0.9 OR savings_ratio 0.05-0.20
# Low risk: otherwise

risk = []
for i in range(N):
    sv = spending_velocity[i]
    sr = savings_ratio[i]
    dl = days_left[i]
    tcr = top_category_ratio[i]
    
    if sv > 0.9 or sr < 0.05 or (sv > 0.7 and dl < 10):
        risk.append('High')
    elif sv > 0.6 or sr < 0.20 or (tcr > 0.6 and sv > 0.5):
        risk.append('Medium')
    else:
        risk.append('Low')

risk = np.array(risk)

# Add slight noise
mask = np.random.random(N) < 0.05
risk[mask] = np.random.choice(['Low', 'Medium', 'High'], mask.sum())

df = pd.DataFrame({
    'daily_avg_spend': daily_avg_spend,
    'spending_velocity': spending_velocity,
    'savings_ratio': savings_ratio,
    'days_left': days_left,
    'top_category_ratio': top_category_ratio,
    'risk_label': risk
})

X = df.drop('risk_label', axis=1)
y = df['risk_label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='weighted')

print(f"\n=== Money Manager ML Model Training Complete ===")
print(f"Training samples: {len(X_train)} | Test samples: {len(X_test)}")
print(f"Accuracy:  {acc:.4f}")
print(f"F1-Score (weighted): {f1:.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Save model
os.makedirs(os.path.dirname(os.path.abspath(__file__)), exist_ok=True)
model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'overspending_model.pkl')
joblib.dump({'model': model, 'feature_names': list(X.columns)}, model_path)
print(f"\nModel saved to: {model_path}")
