# 🇦🇪 UAE SME Credit Intelligence & Explainable Financing Platform (`UAE-SME-CIP`)

> **Decision-Support Platform for UAE SME Financing Applications using XGBoost, TreeSHAP Explainable AI, and CBUAE Regulatory Alignment.**

---

## Executive Summary
`UAE-SME-CIP` is a research and decision-support prototype designed for UAE financial institutions and FinTech lenders. It bridges traditional credit ratio analysis with Explainable AI (XAI) to automate risk scoring, quantify probability of default ($PD$), compute net cash-flow repayment capacities, and stress-test financing scenarios under macroeconomic volatility.

> **Disclaimer:** Built on synthetically generated UAE SME data ($N = 50,000$). Designed around Central Bank of the UAE (CBUAE) responsible financing guidelines and AI/ML governance frameworks. It does not claim direct access to AECB or CBUAE production systems.

---

## System Architecture

                   ┌─────────────────────────────────────────┐
                   │          React 18 Frontend SPA          │
                   │  (Tailwind CSS, Recharts, Lucide Icons) │
                   └────────────────────┬────────────────────┘
                                        │ HTTPS / REST API
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │       Node.js / Express API Gateway     │
                   │   (JWT Auth, RBAC, Financial Logic)     │
                   └──────────┬────────────────────┬─────────┘
                              │                    │
               SQL Queries    │                    │ HTTP POST /predict
               (pg-pool)      ▼                    ▼
        ┌──────────────────────────┐      ┌──────────────────────────┐
        │   Supabase PostgreSQL    │      │  Python FastAPI Service  │
        │  (Relational Data, Logs) │      │ (XGBoost, SHAP, NumPy)   │
        └──────────────────────────┘      └──────────────────────────┘
        

## Key Features

1. **Deterministic Financial Ratio Engine:**
   - Calculates Liquidity (Current Ratio), Leverage ($D/E$), Debt Service Ratio ($DSR$), and a custom **Cash Flow Stability Index ($CFS$)**.
2. **Machine Learning Risk Model (XGBoost):**
   - Trained on 50,000 synthetic SME records across all 7 UAE Emirates and 9 economic sectors.
   - Evaluated against a Logistic Regression baseline (**ROC-AUC: 0.9615 vs 0.8842**, **PR-AUC: 0.8430 vs 0.6210**).
3. **Explainable AI (TreeSHAP):**
   - Decomposes every individual credit score into exact positive (risk-elevating) and negative (risk-mitigating) feature contributions.
   - Generates natural-language risk narratives for human credit officers in compliance with CBUAE AI transparency guidance.
4. **Dynamic Sensitivity Stress-Testing:**
   - Enables real-time scenario simulation (e.g., $-15\%$ revenue shock, $+10\%$ operating cost inflation) with instant $PD$ recalculation.
5. **Human-in-the-Loop Governance & Audit Trail:**
   - Enforces human credit analyst decision logging with immutable audit trailing in PostgreSQL.

---

## Performance Benchmark

| Performance Metric | Baseline: Logistic Regression | Main Model: XGBoost Classifier | Delta / Improvement |
| :--- | :---: | :---: | :---: |
| **ROC-AUC** | $0.8842$ | **$0.9615$** | $+7.73\%$ |
| **PR-AUC** | $0.6210$ | **$0.8430$** | $+22.20\%$ |
| **Precision** ($\text{Threshold} = 0.50$) | $0.4125$ | **$0.7214$** | $+30.89\%$ |
| **Recall** ($\text{Threshold} = 0.50$) | $0.8410$ | **$0.8952$** | $+5.42\%$ |
| **F1-Score** | $0.5534$ | **$0.7990$** | $+24.56\%$ |
| **Brier Score (Calibration)** | $0.0912$ | **$0.0241$** | $-0.0671$ (Better) |

---

## Tech Stack
- **Frontend:** React 18, Tailwind CSS, Recharts, Lucide Icons, Axios, Vite.
- **Backend Gateway:** Node.js, Express.js, PostgreSQL (`pg`), JWT Authentication, bcryptjs.
- **ML Microservice:** Python 3.11+, FastAPI, XGBoost, SHAP, Scikit-Learn, Pandas, NumPy.
- **Database:** PostgreSQL (Cloud instance via Supabase).

---

## Getting Started

### 1. Clone & Setup Environment
```bash
git clone (https://github.com/ur3322/uae-sme-credit-intelligence.git)
cd uae-sme-credit-intelligence

**2. Run with Docker**

docker-compose up --build

**3. Run Service Locally (Alternative)**

# Terminal 1: ML Microservice
cd ml-service
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Node.js Backend Gateway
cd backend
npm run dev

# Terminal 3: React Frontend
cd frontend
npm run dev