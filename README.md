# Revenue Rescue - stop churn (Adapty Hackathon Belgrade 2026)
<!-- 🔒 OWNED BY PERSON 4 -->

> Catch churn **before** it happens. A proactive churn-rescue engine for subscription apps on Adapty, demoed on **Lumen**, a fictional AI photo editor.

## 1. What it does

Classic win-back reacts **after** a subscriber cancels, when it is already hard to win them back. Revenue Rescue acts **while they are still paying**:

1. **Score.** An XGBoost model gives every user a churn-risk score from 0 to 100, based on their profile, plan, purchase history and 4 daily-streak signals (`streak_days`, `streak_best`, `inactive_days`, `streak_breaks`).
2. **Segment.** Users fall into 3 risk tiers, each with its own action:

   | Tier | Score | Action |
   |---|---|---|
   | 🔴 High | ≥ 75 | Rescue offer: step-down / discount before they cancel |
   | 🟡 Mid | 40-74 | Upsell to a higher tier with streak protection |
   | 🟢 Low | < 40 | No paywall, the active streak is celebrated |

3. **Sync to Adapty.** Scores and streaks are written to Adapty profiles as custom attributes. Adapty segments (`Churn risk: high` / `medium`) pick them up and show the matching Flow Builder paywall on the `streak_retention` placement.

## 2. Who it's for

Growth and monetization teams of subscription apps on Adapty who want proactive retention driven by Adapty attributes, segments and remote paywalls, without writing paywall logic in the app.

## 3. Dashboard

- **Header:** Adapty connection status, `Mock data` badge (only if the backend is unavailable) and a legend for real vs simulated data.
- **At-risk subscribers** (top left): active users sorted by risk score, with tier and goal filters. Hover a row to see the risk drivers, click it to preview that user's paywall. The highest-risk user is preselected.
- **Live iPhone Flow Simulator** (top right): the paywall the selected user would see in their risk tier.
- **Churn Risk Radar** (below):
  - KPI cards: users scored, plus high, mid and low risk users
  - Estimated revenue saved at 0-100% retention, split by tier
  - Users per tier, actual churn per tier, churn by plan, streak before cancel

## 4. What's real vs simulated

| Component | Status | Details |
|---|:---:|---|
| Users and demographics | ✅ Real | 50,000 users from the Lumen seed dataset (`data/users.csv.gz`) |
| Transactions | ✅ Real | 29,794 purchase events from 14,304 paying users (`data/transactions.csv.gz`) |
| Churn model | ✅ Real | XGBoost, 45 features, stratified 80/20 split. Holdout: ROC-AUC 0.87, accuracy 0.81, recall 0.74, precision 0.43 |
| Churn by plan, churn per tier | ✅ Real | Computed from the dataset (e.g. weekly 80%, annual_trial 71%, monthly 22%) |
| Adapty integration | ✅ Real | App `9717a53d…`: custom attributes, 2 segments, 2 flows, placement `streak_retention`. Profiles `u00000`-`u04999` are synced with backend scripts |
| Daily streaks | 🧪 Simulated (calculated tomorrow) | The dataset has no daily activity, so the 4 streak signals are generated (`enrich_streaks.py`). Marked `SIM` in the UI |
| Streak before cancel chart | 🧪 Simulated (calculated tomorrow) | Built from the simulated streaks |
| Revenue saved | 🧪 Estimate | Revenue at risk × an assumed retention share. Marked `Estimate` in the UI |
| Paywall copy in the simulator | 🧪 Preview | Generated in the browser per tier. The real paywalls live in Adapty Flow Builder (`backend/adapty_engine/flow_templates/`) |

Notes:
- "Users scored" counts all 50,000 users, including ~35,700 who never paid. They count as not churned.
- "Revenue at risk" is the sum of each user's latest purchase price in the tier. Prices for weekly and annual plans are mixed, so it is not MRR.

## 5. Architecture

```
Lumen seed CSVs (data/*.csv.gz)  +  simulated streaks (data/streaks/)
        │  loaded once, scored by the XGBoost model (backend/risk_engine/churn_model.json)
        ▼
FastAPI backend (backend/, port 8000)
  ├── risk_engine
  │     GET  /api/analytics/summary   → KPIs and charts
  │     GET  /api/users/at-risk       → user table (active users, top N by risk)
  │     GET  /api/users/adapty-sync   → score + streaks for all active users
  │     POST /api/risk/score          → score one user
  └── adapty_engine
        POST /api/adapty/deploy       → sync one user (no longer used by the UI)
        export_scores + profile_sync  → batch sync, run from the terminal
        │
        │  PATCH /api/v2/server-side-api/profile/  (secret key from the root .env)
        ▼
Adapty (app 9717a53d…)
  custom attributes: churn_risk, churn_risk_level, streak_days, streak_best, inactive_days, streak_breaks
  → segments "Churn risk: high" / "Churn risk: medium"
  → flows "Churn high - Streak rescue" / "Churn medium - Streak upsell"
  → placement "streak_retention"  (low risk: the app does not open it)

React + Vite dashboard (frontend/, port 5173)
        │  /api/*  (Vite proxy → port 8000)
        └── reads only from the backend, never from Adapty
```

- **Two separate paths.** The dashboard shows the 50,000 users from the CSVs, scored on the machine that runs the backend. The 5,000 Adapty profiles (`u00000`-`u04999`) get their scores through the batch sync and are visible in the Adapty dashboard.
- **Segments, flows and the placement were created in Adapty once.** The sync only updates profile attributes, Adapty routes each user to the right paywall.
- **No secrets in the frontend.** Only the backend sync scripts use the Adapty secret key.

## 6. How to run

**Requirements:** Python 3.10+, Node.js 18+

**1. Backend dependencies**
```bash
python -m pip install -r backend/requirements.txt
```

**2. Seed data.** Nothing to do, the data is in the repo:
- `data/users.csv.gz` and `data/transactions.csv.gz`: the Lumen seed dataset from the organizers ([kpotehin/adapty-seed-data-hack](https://github.com/kpotehin/adapty-seed-data-hack), `data/offline/`)
- `data/streaks/streaks.csv` and `activity_log.csv`: the simulated daily streaks

The backend reads `users.csv(.gz)` and `transactions.csv(.gz)` from `data/` (or `data/offline/`). To regenerate the streaks, run `python backend/risk_engine/enrich_streaks.py --data-dir <folder>`, where `<folder>` contains the unzipped `users.csv` and `transactions.csv`.

**3. Backend** (keep this terminal open):
```bash
python -m uvicorn backend.main:app --port 8000
```
API docs: http://localhost:8000/docs

**4. Frontend** (second terminal):
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173. The first load takes a few seconds while 50,000 users are scored.

**Tests:** `python -m pytest backend` (42 tests)

**Adapty secret key:** only needed for syncing to Adapty (`profile_sync`). Put it in the root `.env` as `ADAPTY_SECRET_KEY`. The dashboard runs without it.

## 7. What we'd do next

1. **A/B test + uplift charts.** Rescue vs. control in the placement, with charts of users moving high → mid → low.
2. **Real win-back offers.** App Store and Google Play offers attached to Monthly in Adapty.
3. **SDK in the app.** The app opens the placement for medium and high users, and scores sync nightly.
4. **Better model.** Real activity data instead of simulated streaks, more data, fine-tuning.
