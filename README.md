# Revenue Rescue - stop churn (Adapty Hackathon Belgrade 2026)
<!-- 🔒 OWNED BY PERSON 4 -->

A proactive churn-rescue engine for subscription apps on Adapty, demoed on **Lumen**, a fictional AI photo editor.

Classic win-back tries to bring users back **after** they cancel. Revenue Rescue acts **before**: it scores every subscriber's churn risk, spots who is about to leave and shows them a personalized rescue paywall while they are still paying.

## How it works

1. **Score**: each subscriber gets a churn-risk score (0-100) from their profile, plan and 4 daily-streak signals (`streak_days`, `streak_best`, `inactive_days`, `streak_breaks`).
2. **Segment**: users fall into 3 risk tiers, each with its own action:
   - 🔴 **High risk**: rescue offer (10% off an upper tier)
   - 🟡 **Mid risk**: upgrade offer to a higher tier
   - 🟢 **Low risk**: no paywall, the active streak is celebrated
3. **Deploy**: the rescue paywall is pushed to Adapty: profile attributes (Server-Side API), segment and flow (Adapty CLI).

## Dashboard

**Left: Churn Risk Radar**
- KPI cards: subscribers scored, high, mid and low risk users
- Estimated revenue saved by retention rate (0-100%), split by risk tier
- Cohort charts: users per tier, actual churn per tier, churn by plan, streak before cancel
- At-risk user table with filters. Hover a row to see why the user is at risk, click it to preview their paywall

**Right: Paywall Simulator**
- iPhone preview of the paywall for the selected user's risk tier
- Streak sliders and copy overrides to see how the paywall changes
- "Deploy to Adapty" with a 3-step execution log and dry-run mode

## Data

| | Source |
|---|---|
| ✅ **Real** | Lumen seed dataset (50k users, ~30k transactions) + Adapty app |
| 🧪 **Simulated** | Daily streaks (the dataset has no daily activity), revenue-saved estimate |

Simulated data is marked with a `SIM` / `Estimate` tag in the UI.

## Architecture

```
React + Vite (frontend/)  --/api proxy-->  FastAPI (backend/)  -->  Adapty Server-Side API + CLI
```

The frontend never talks to Adapty directly and holds no secret keys.

| Endpoint | Used by |
|---|---|
| `GET /api/analytics/summary` | Radar KPIs and charts |
| `GET /api/users/at-risk` | Radar user table |
| `POST /api/adapty/deploy` | Deploy modal |

> **Status:** the frontend is wired to these endpoints. Until a backend endpoint is live, the UI falls back to mock data and shows a **"Mock data"** badge naming the missing endpoint.

## Run

```bash
# frontend
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

Backend secrets go in the root `.env` (see `.env.example`).
