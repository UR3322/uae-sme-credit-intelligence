import json
import joblib
import numpy as np
import pandas as pd
import shap
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any

# Global Model & Artifact References
model = None
preprocessor = None
explainer = None
model_meta = None

def load_artifacts():
    global model, preprocessor, explainer, model_meta
    try:
        model = joblib.load("xgboost_model.pkl")
        preprocessor = joblib.load("preprocessor.pkl")
        
        with open("model_metadata.json", "r") as f:
            model_meta = json.load(f)
            
        explainer = shap.TreeExplainer(model)
        print("✅ ML Model, Preprocessor, and SHAP Explainer loaded successfully.")
    except Exception as e:
        print(f"❌ Error loading model artifacts: {str(e)}")
        raise RuntimeError(f"Failed to initialize ML Service artifacts: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield

app = FastAPI(
    title="UAE SME Credit Risk & XAI Engine",
    description="Microservice providing XGBoost risk scoring, SHAP explainability, and sensitivity scenario testing.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SMEApplicationInput(BaseModel):
    emirate: str = Field(..., examples=["Dubai"])
    industry: str = Field(..., examples=["Wholesale"])
    business_age_years: int = Field(..., ge=0, examples=[6])
    employee_count: int = Field(..., ge=1, examples=[34])
    annual_revenue: float = Field(..., gt=0, examples=[4800000.0])
    net_profit_margin: float = Field(..., examples=[0.12])
    net_profit: float = Field(..., examples=[576000.0])
    current_ratio: float = Field(..., gt=0, examples=[1.45])
    debt_to_equity: float = Field(..., ge=0, examples=[1.85])
    avg_monthly_inflow: float = Field(..., gt=0, examples=[400000.0])
    avg_monthly_outflow: float = Field(..., gt=0, examples=[352000.0])
    negative_cf_months: int = Field(..., ge=0, le=12, examples=[1])
    cfs_score: float = Field(..., ge=0, le=100, examples=[78.5])
    late_payments_12m: int = Field(..., ge=0, examples=[0])
    monthly_debt_service: float = Field(..., ge=0, examples=[32000.0])
    dsr: float = Field(..., ge=0, examples=[8.0])
    requested_amount: float = Field(..., gt=0, examples=[500000.0])
    requested_tenure_months: int = Field(..., gt=0, examples=[36])

class ScenarioStressInput(BaseModel):
    application_data: SMEApplicationInput
    revenue_delta_pct: float = Field(0.0, examples=[-0.15])
    expense_delta_pct: float = Field(0.0, examples=[0.10])
    debt_service_delta_pct: float = Field(0.0, examples=[0.20])

def compute_risk_metrics(probability_of_default: float) -> Dict[str, Any]:
    pd_val = float(probability_of_default)
    risk_score = int(np.round(pd_val * 100))
    
    if pd_val < 0.05:
        category = "LOW"
        recommendation = "RECOMMENDED FOR APPROVAL"
    elif pd_val < 0.15:
        category = "MEDIUM"
        recommendation = "RECOMMENDED FOR ANALYST REVIEW"
    else:
        category = "HIGH"
        recommendation = "RECOMMENDED FOR RISK COMMITTEE REFERRAL / REJECTION"
        
    return {
        "probability_of_default": round(pd_val, 4),
        "risk_score": risk_score,
        "risk_category": category,
        "model_recommendation": recommendation
    }

def calculate_affordability(data: SMEApplicationInput) -> Dict[str, float]:
    net_monthly_cashflow = max(0.0, data.avg_monthly_inflow - data.avg_monthly_outflow)
    available_repayment_capacity = net_monthly_cashflow * 0.40
    
    supported_amount = min(
        data.requested_amount,
        available_repayment_capacity * data.requested_tenure_months
    )
    
    return {
        "requested_amount": round(data.requested_amount, 2),
        "model_supported_amount": round(supported_amount, 2),
        "monthly_repayment_capacity": round(available_repayment_capacity, 2),
        "estimated_monthly_payment": round(data.requested_amount / data.requested_tenure_months, 2)
    }

def generate_natural_language_explanation(top_positive: List[Dict], top_negative: List[Dict]) -> str:
    pos_drivers = ", ".join([f"'{item['feature']}'" for item in top_positive[:2]])
    neg_drivers = ", ".join([f"'{item['feature']}'" for item in top_negative[:2]])
    
    narrative = []
    if pos_drivers:
        narrative.append(f"Risk score is primarily elevated due to adverse indicators in {pos_drivers}.")
    if neg_drivers:
        narrative.append(f"Risk is mitigated by strong underlying performance in {neg_drivers}.")
    
    return " ".join(narrative) if narrative else "Applicant risk profile aligns with baseline portfolio norms."

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "HEALTHY", "service": "UAE-SME-CIP ML Service", "model_loaded": model is not None}

@app.get("/model-metadata", tags=["Model Governance"])
def get_metadata():
    if not model_meta:
        raise HTTPException(status_code=500, detail="Metadata not loaded.")
    return model_meta

@app.post("/predict", tags=["Inference"])
def predict_credit_risk(payload: SMEApplicationInput):
    try:
        df_raw = pd.DataFrame([payload.model_dump()])
        X_proc = preprocessor.transform(df_raw)
        
        pd_prob = float(model.predict_proba(X_proc)[0, 1])
        risk_metrics = compute_risk_metrics(pd_prob)
        affordability = calculate_affordability(payload)
        
        return {
            **risk_metrics,
            "affordability_analysis": affordability
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inference error: {str(e)}")

@app.post("/explain", tags=["Explainability"])
def explain_decision(payload: SMEApplicationInput):
    try:
        df_raw = pd.DataFrame([payload.model_dump()])
        X_proc = preprocessor.transform(df_raw)
        
        shap_values = explainer.shap_values(X_proc)[0]
        base_value = float(explainer.expected_value)
        feature_names = model_meta["feature_names"]
        
        shap_contributions = []
        for name, value in zip(feature_names, shap_values):
            shap_contributions.append({
                "feature": name,
                "shap_value": round(float(value), 4),
                "impact_direction": "INCREASES_RISK" if value > 0 else "DECREASES_RISK"
            })
            
        shap_contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        
        top_positive = [f for f in shap_contributions if f["shap_value"] > 0]
        top_negative = [f for f in shap_contributions if f["shap_value"] < 0]
        
        narrative = generate_natural_language_explanation(top_positive, top_negative)
        
        return {
            "base_value": round(base_value, 4),
            "top_risk_drivers": top_positive[:5],
            "top_mitigating_factors": top_negative[:5],
            "all_shap_values": shap_contributions,
            "analyst_narrative": narrative
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Explanation error: {str(e)}")

@app.post("/simulate-scenario", tags=["Scenario Testing"])
def simulate_scenario(payload: ScenarioStressInput):
    try:
        base_data = payload.application_data.model_dump()
        
        base_data["annual_revenue"] *= (1.0 + payload.revenue_delta_pct)
        base_data["avg_monthly_inflow"] *= (1.0 + payload.revenue_delta_pct)
        base_data["avg_monthly_outflow"] *= (1.0 + payload.expense_delta_pct)
        base_data["monthly_debt_service"] *= (1.0 + payload.debt_service_delta_pct)
        
        base_data["dsr"] = (base_data["monthly_debt_service"] / base_data["avg_monthly_inflow"]) * 100.0
        base_data["net_profit"] = base_data["annual_revenue"] - (base_data["avg_monthly_outflow"] * 12)
        base_data["net_profit_margin"] = base_data["net_profit"] / base_data["annual_revenue"]
        
        stressed_input = SMEApplicationInput(**base_data)
        
        df_proc = preprocessor.transform(pd.DataFrame([stressed_input.model_dump()]))
        stressed_pd = float(model.predict_proba(df_proc)[0, 1])
        
        stressed_metrics = compute_risk_metrics(stressed_pd)
        stressed_affordability = calculate_affordability(stressed_input)
        
        return {
            "scenario_applied": {
                "revenue_delta_pct": payload.revenue_delta_pct,
                "expense_delta_pct": payload.expense_delta_pct,
                "debt_service_delta_pct": payload.debt_service_delta_pct
            },
            "stressed_metrics": stressed_metrics,
            "stressed_affordability": stressed_affordability
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Scenario error: {str(e)}")