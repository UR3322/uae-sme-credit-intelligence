import hmac
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

model = None
preprocessor = None
explainer = None
model_meta = None
ARTIFACT_DIR = Path(__file__).resolve().parent


def load_artifacts():
    global model, preprocessor, explainer, model_meta
    try:
        model = joblib.load(ARTIFACT_DIR / 'xgboost_model.pkl')
        preprocessor = joblib.load(ARTIFACT_DIR / 'preprocessor.pkl')
        with (ARTIFACT_DIR / 'model_metadata.json').open(encoding='utf-8') as f:
            model_meta = json.load(f)
        explainer = shap.TreeExplainer(model)
        expected_features = getattr(preprocessor, 'feature_names_in_', None)
        if expected_features is not None and len(expected_features) != len(model_meta.get('numerical_cols', [])) + len(model_meta.get('categorical_cols', [])):
            raise ValueError('Model metadata does not match preprocessing input schema.')
        print('ML model and explanation artifacts loaded.')
    except Exception as exc:
        raise RuntimeError('ML artifacts failed to load; verify trusted artifact files and metadata.') from exc


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not os.getenv('ML_SERVICE_API_KEY'):
        raise RuntimeError('ML_SERVICE_API_KEY must be configured.')
    load_artifacts()
    yield


app = FastAPI(
    title='UAE SME Credit Risk & XAI Engine',
    description='Prototype scoring service. Outputs are not validated for real lending decisions.',
    version='1.1.0',
    lifespan=lifespan,
    docs_url=None if os.getenv('ENVIRONMENT') == 'production' else '/docs',
    redoc_url=None if os.getenv('ENVIRONMENT') == 'production' else '/redoc',
)


def require_service_key(x_ml_api_key: str | None = Header(default=None)):
    expected = os.getenv('ML_SERVICE_API_KEY', '')
    if not expected or not x_ml_api_key or not hmac.compare_digest(x_ml_api_key, expected):
        raise HTTPException(status_code=401, detail='Service authentication required.')


class SMEApplicationInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    emirate: str = Field(..., min_length=2, max_length=40, examples=['Dubai'])
    industry: str = Field(..., min_length=2, max_length=40, examples=['Wholesale'])
    business_age_years: int = Field(..., ge=0, le=200, examples=[6])
    employee_count: int = Field(..., ge=1, le=1_000_000, examples=[34])
    annual_revenue: float = Field(..., gt=0, le=1_000_000_000_000, allow_inf_nan=False, examples=[4800000.0])
    net_profit_margin: float = Field(..., ge=-1, le=1, allow_inf_nan=False, examples=[0.12])
    net_profit: float = Field(..., ge=-1_000_000_000_000, le=1_000_000_000_000, allow_inf_nan=False, examples=[576000.0])
    current_ratio: float = Field(..., gt=0, le=1_000_000, allow_inf_nan=False, examples=[1.45])
    debt_to_equity: float = Field(..., ge=0, le=1_000_000, allow_inf_nan=False, examples=[1.85])
    avg_monthly_inflow: float = Field(..., gt=0, le=1_000_000_000_000, allow_inf_nan=False, examples=[400000.0])
    avg_monthly_outflow: float = Field(..., ge=0, le=1_000_000_000_000, allow_inf_nan=False, examples=[352000.0])
    negative_cf_months: int = Field(..., ge=0, le=12, examples=[1])
    cfs_score: float = Field(..., ge=0, le=100, allow_inf_nan=False, examples=[78.5])
    late_payments_12m: int = Field(..., ge=0, le=120, examples=[0])
    monthly_debt_service: float = Field(..., ge=0, le=1_000_000_000_000, allow_inf_nan=False, examples=[32000.0])
    dsr: float = Field(..., ge=0, le=1_000_000, allow_inf_nan=False, examples=[8.0])
    requested_amount: float = Field(..., gt=0, le=1_000_000_000_000, allow_inf_nan=False, examples=[500000.0])
    requested_tenure_months: int = Field(..., ge=1, le=120, examples=[36])


class ScenarioStressInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    application_data: SMEApplicationInput
    revenue_delta_pct: float = Field(0.0, ge=-0.9, le=5.0, allow_inf_nan=False)
    expense_delta_pct: float = Field(0.0, ge=-0.9, le=5.0, allow_inf_nan=False)
    debt_service_delta_pct: float = Field(0.0, ge=-0.9, le=5.0, allow_inf_nan=False)


def compute_risk_metrics(probability_of_default: float) -> dict[str, Any]:
    pd_val = min(1.0, max(0.0, float(probability_of_default)))
    risk_score = int(np.round(pd_val * 100))
    if pd_val < 0.05:
        category, notice = 'LOW', 'LOW MODEL RISK BAND — HUMAN REVIEW REQUIRED'
    elif pd_val < 0.15:
        category, notice = 'MEDIUM', 'MEDIUM MODEL RISK BAND — HUMAN REVIEW REQUIRED'
    else:
        category, notice = 'HIGH', 'HIGH MODEL RISK BAND — HUMAN REVIEW REQUIRED'
    return {'probability_of_default': round(pd_val, 4), 'risk_score': risk_score,
            'risk_category': category, 'model_notice': notice}


def calculate_affordability(data: SMEApplicationInput) -> dict[str, float]:
    net_monthly_cashflow = max(0.0, data.avg_monthly_inflow - data.avg_monthly_outflow)
    capacity = net_monthly_cashflow * 0.40
    supported = min(data.requested_amount, capacity * data.requested_tenure_months)
    return {'requested_amount': round(data.requested_amount, 2),
            'model_supported_amount': round(supported, 2),
            'monthly_repayment_capacity': round(capacity, 2),
            'estimated_monthly_payment': round(data.requested_amount / data.requested_tenure_months, 2)}


def generate_natural_language_explanation(top_positive: list[dict], top_negative: list[dict]) -> str:
    adverse = ', '.join(f"'{item['feature']}'" for item in top_positive[:2])
    mitigating = ', '.join(f"'{item['feature']}'" for item in top_negative[:2])
    narrative = []
    if adverse:
        narrative.append(f'Risk score is elevated by {adverse}.')
    if mitigating:
        narrative.append(f'Potential mitigating signals include {mitigating}.')
    return ' '.join(narrative) if narrative else 'No feature-level explanation is available.'


@app.get('/health', tags=['System'])
def health_check():
    return {'status': 'HEALTHY' if model is not None else 'STARTING', 'model_loaded': model is not None}


@app.get('/model-metadata', tags=['Model Governance'], dependencies=[Depends(require_service_key)])
def get_metadata():
    if not model_meta:
        raise HTTPException(status_code=503, detail='Metadata not loaded.')
    return model_meta


@app.post('/predict', tags=['Inference'], dependencies=[Depends(require_service_key)])
def predict_credit_risk(payload: SMEApplicationInput):
    try:
        frame = pd.DataFrame([payload.model_dump()])
        processed = preprocessor.transform(frame)
        probability = float(model.predict_proba(processed)[0, 1])
        return {**compute_risk_metrics(probability), 'affordability_analysis': calculate_affordability(payload)}
    except Exception as exc:
        print('Inference failed:', type(exc).__name__)
        raise HTTPException(status_code=500, detail='Inference failed; verify model artifacts and input schema.') from exc


@app.post('/explain', tags=['Explainability'], dependencies=[Depends(require_service_key)])
def explain_decision(payload: SMEApplicationInput):
    try:
        processed = preprocessor.transform(pd.DataFrame([payload.model_dump()]))
        shap_values = explainer.shap_values(processed)[0]
        base = np.asarray(explainer.expected_value).reshape(-1)[-1]
        feature_names = model_meta['feature_names']
        contributions = [
            {'feature': name, 'shap_value': round(float(value), 4),
             'impact_direction': 'INCREASES_RISK' if value > 0 else 'DECREASES_RISK'}
            for name, value in zip(feature_names, shap_values)
        ]
        contributions.sort(key=lambda item: abs(item['shap_value']), reverse=True)
        positive = [item for item in contributions if item['shap_value'] > 0]
        negative = [item for item in contributions if item['shap_value'] < 0]
        return {'base_value': round(float(base), 4), 'top_risk_drivers': positive[:5],
                'top_mitigating_factors': negative[:5], 'all_shap_values': contributions,
                'analyst_narrative': generate_natural_language_explanation(positive, negative)}
    except Exception as exc:
        print('Explanation failed:', type(exc).__name__)
        raise HTTPException(status_code=500, detail='Explanation failed; verify model artifacts and input schema.') from exc


@app.post('/simulate-scenario', tags=['Scenario Testing'], dependencies=[Depends(require_service_key)])
def simulate_scenario(payload: ScenarioStressInput):
    try:
        values = payload.application_data.model_dump()
        values['annual_revenue'] *= 1.0 + payload.revenue_delta_pct
        values['avg_monthly_inflow'] *= 1.0 + payload.revenue_delta_pct
        values['avg_monthly_outflow'] *= 1.0 + payload.expense_delta_pct
        values['monthly_debt_service'] *= 1.0 + payload.debt_service_delta_pct
        values['dsr'] = values['monthly_debt_service'] / values['avg_monthly_inflow'] * 100.0
        values['net_profit'] = values['annual_revenue'] - values['avg_monthly_outflow'] * 12
        values['net_profit_margin'] = values['net_profit'] / values['annual_revenue']
        stressed_input = SMEApplicationInput(**values)
        frame = pd.DataFrame([stressed_input.model_dump()])
        probability = float(model.predict_proba(preprocessor.transform(frame))[0, 1])
        return {'scenario_applied': {'revenue_delta_pct': payload.revenue_delta_pct,
                                     'expense_delta_pct': payload.expense_delta_pct,
                                     'debt_service_delta_pct': payload.debt_service_delta_pct},
                'stressed_metrics': compute_risk_metrics(probability),
                'stressed_affordability': calculate_affordability(stressed_input)}
    except Exception as exc:
        print('Scenario analysis failed:', type(exc).__name__)
        raise HTTPException(status_code=500, detail='Scenario analysis failed; verify model artifacts and input schema.') from exc
