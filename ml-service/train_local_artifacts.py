import json
import joblib
import numpy as np
import pandas as pd
from scipy.stats import truncnorm
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
import xgboost as xgb

def get_truncated_normal(mean=0, sd=1, low=0, upp=10, size=1):
    return truncnorm.rvs((low - mean) / sd, (upp - mean) / sd, loc=mean, scale=sd, size=size)

def generate_data(n_samples=10000, seed=42):
    print("⏳ Generating synthetic UAE SME dataset...")
    np.random.seed(seed)
    
    company_ids = [f"UAE-SME-{i+10000:05d}" for i in range(n_samples)]
    emirates = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
    company_emirates = np.random.choice(emirates, size=n_samples, p=[0.45, 0.30, 0.15, 0.04, 0.03, 0.02, 0.01])
    industries = ['Wholesale', 'Retail', 'Construction', 'Manufacturing', 'Services', 'Logistics', 'Technology', 'Healthcare', 'F&B']
    company_industries = np.random.choice(industries, size=n_samples)
    
    business_age = np.random.randint(1, 26, size=n_samples)
    employee_count = np.random.randint(2, 251, size=n_samples)
    
    annual_revenue = np.clip(np.exp(np.random.normal(loc=15.2, scale=0.85, size=n_samples)), 500_000, 25_000_000)
    net_profit_margin = np.clip(np.random.normal(loc=0.12, scale=0.08, size=n_samples), -0.15, 0.40)
    net_profit = annual_revenue * net_profit_margin
    
    current_ratio = get_truncated_normal(mean=1.4, sd=0.5, low=0.2, upp=5.0, size=n_samples)
    debt_to_equity = get_truncated_normal(mean=1.8, sd=1.0, low=0.0, upp=8.0, size=n_samples)
    
    avg_monthly_inflow = annual_revenue / 12.0
    avg_monthly_outflow = avg_monthly_inflow * (1.0 - net_profit_margin)
    negative_cf_months = np.clip(np.random.poisson(lam=0.6, size=n_samples), 0, 6)
    
    cfs_score = np.clip(100.0 - ((avg_monthly_inflow * 0.2 / avg_monthly_inflow) * 50.0 + (negative_cf_months * 10.0)), 0.0, 100.0)
    late_payments_12m = np.clip(np.random.poisson(lam=0.8, size=n_samples), 0, 12)
    monthly_debt_service = (avg_monthly_inflow * 0.15) * (debt_to_equity / 1.8) * np.random.uniform(0.7, 1.3, size=n_samples)
    dsr = (monthly_debt_service / avg_monthly_inflow) * 100.0
    
    requested_amount = annual_revenue * np.random.uniform(0.10, 0.30, size=n_samples)
    requested_tenure_months = np.random.choice([12, 24, 36, 48, 60], size=n_samples)
    
    z = -2.50 + (0.04 * dsr) + (0.80 * debt_to_equity) + (0.50 * late_payments_12m) - (0.03 * cfs_score) - (0.80 * current_ratio)
    simulated_pd = np.nan_to_num(1.0 / (1.0 + np.exp(-z)), nan=0.08)
    target_default = (np.random.uniform(0.0, 1.0, size=n_samples) < simulated_pd).astype(int)
    
    return pd.DataFrame({
        'company_id': company_ids,
        'emirate': company_emirates,
        'industry': company_industries,
        'business_age_years': business_age,
        'employee_count': employee_count,
        'annual_revenue': np.round(annual_revenue, 2),
        'net_profit_margin': np.round(net_profit_margin, 4),
        'net_profit': np.round(net_profit, 2),
        'current_ratio': np.round(current_ratio, 2),
        'debt_to_equity': np.round(debt_to_equity, 2),
        'avg_monthly_inflow': np.round(avg_monthly_inflow, 2),
        'avg_monthly_outflow': np.round(avg_monthly_outflow, 2),
        'negative_cf_months': negative_cf_months,
        'cfs_score': np.round(cfs_score, 2),
        'late_payments_12m': late_payments_12m,
        'monthly_debt_service': np.round(monthly_debt_service, 2),
        'dsr': np.round(dsr, 2),
        'requested_amount': np.round(requested_amount, 2),
        'requested_tenure_months': requested_tenure_months,
        'simulated_pd': np.round(simulated_pd, 4),
        'target_default': target_default
    })

def main():
    df = generate_data()
    
    drop_cols = ['company_id', 'simulated_pd', 'target_default']
    X = df.drop(columns=drop_cols)
    y = df['target_default']
    
    categorical_cols = ['emirate', 'industry']
    numerical_cols = [c for c in X.columns if c not in categorical_cols]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())]), numerical_cols),
            ('cat', Pipeline([('imputer', SimpleImputer(strategy='most_frequent')), ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))]), categorical_cols)
        ]
    )
    
    print("⏳ Fitting local preprocessor...")
    X_train_proc = preprocessor.fit_transform(X_train)
    
    cat_feature_names = list(preprocessor.named_transformers_['cat'].named_steps['encoder'].get_feature_names_out(categorical_cols))
    all_feature_names = numerical_cols + cat_feature_names
    
    scale_pos_weight = (len(y_train) - sum(y_train)) / sum(y_train)
    
    print("⏳ Training local XGBoost model...")
    xgb_clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.05,
        scale_pos_weight=scale_pos_weight,
        eval_metric='logloss',
        random_state=42
    )
    xgb_clf.fit(X_train_proc, y_train)
    
    print("💾 Saving local binary artifacts...")
    joblib.dump(preprocessor, "preprocessor.pkl")
    joblib.dump(xgb_clf, "xgboost_model.pkl")
    
    metadata = {
        "feature_names": all_feature_names,
        "numerical_cols": numerical_cols,
        "categorical_cols": categorical_cols
    }
    with open("model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    print("🎉 Fresh model artifacts successfully created locally!")

if __name__ == "__main__":
    main()