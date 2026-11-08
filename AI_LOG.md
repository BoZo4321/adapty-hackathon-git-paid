# AI Log – Git Paid

We designed the product, the architecture and the data contracts ourselves, and used AI for the parts that are slow or error-prone by hand: complex data processing, large config files, and checking our own work. Every AI change was reviewed by a person before it reached `main` or the live Adapty app.

## Tools and what we used them for

- **Claude Code** and the **Antigravity IDE agent**: pandas aggregations and the XGBoost pipeline, editing Adapty Flow Builder configs (60+ KB of JSON), wiring the dashboard to the backend.
- **Adapty CLI with Adapty agent skills**: creating segments, flows and the placement from the terminal.
- **Claude chat**: a second reviewer for scripts and for every claim in the pitch.

## Setup

- **Scoped prompts:** each agent got its owned files, the folders it must not touch, and rules (no secrets in the frontend, build must pass). Four of us worked in parallel without merge conflicts.
- **Contract first:** we fixed the API contract (0–100 score, 40/75 tiers, float streak values) before any code was generated.
- **Human approval for writes:** agents ran in manual mode; anything that writes to Adapty started as a dry run.
- **Secrets never in prompts.** No subagents and no extra MCP servers: one focused agent per person was faster.

## Prompts that worked well

1. *"Return churn_risk_score (int 0–100) and 3 tiers: high ≥ 75, medium 40–74, low < 40. Cast the 4 streak metrics to float (21.0, not 21) because Adapty rejects integers."*
2. *"Change ONLY the text strings of these elements, then deep-compare the original and the copy and print every JSON path that differs."* We built two new Adapty paywalls from existing configs, with proof that only 6 text fields changed.
3. *"When the backend fails, never show success. Display the real server error."*

## One thing AI got wrong, and how we caught it

The first version of the paywall simulator scored users with a JavaScript formula the AI invented, with its own thresholds, instead of our model. It also showed "✓ Executed" when the backend returned an error. We caught it in manual testing (a 95-risk user dropped to 31 when a slider moved) and in code review, and wired the UI to the real model and real errors.

## What we'd never delegate to AI

- Numbers and claims we show to judges.
- The Adapty secret key and writes to the live Adapty app.
- Business rules: risk cut-offs and who gets a discount.
