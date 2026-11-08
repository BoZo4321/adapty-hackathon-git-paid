"""
backend/risk_engine/router.py  (Person 1)

FastAPI router for the churn risk API.

Endpoints
---------
POST /api/risk/score
    Accept a JSON payload of user features and return a churn probability.

GET  /api/users/at-risk
    Filtered, enriched list of at-risk active users with risk drivers and
    rescue offer recommendations.

GET  /api/users/adapty-sync
    Minimal payload for direct Adapty server-side API ingestion — streak
    metrics cast to float as required by the Adapty schema.

GET  /api/analytics/summary
    Dashboard analytics payload containing KPIs, 3-tier risk breakdowns,
    churn rate by plan, and streak decay timeline data.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.risk_engine.scorer import (
    build_features,
    load_data,
    load_model,
    score_dataframe,
    select_features,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Cached model loader  (loaded once per process, not per request)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_model():
    """Return (model, feature_cols) cached after first load."""
    return load_model()


# ---------------------------------------------------------------------------
# Shared scoring helpers
# ---------------------------------------------------------------------------

def _risk_score(prob: float) -> int:
    """Convert a [0, 1] probability to an integer score 0-100."""
    return int(prob * 100)


def _risk_level(score: int) -> str:
    """Map a 0-100 risk score to a 3-tier label (high / medium / low)."""
    if score >= 75:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _rescue_offer(level: str) -> str:
    """Return the recommended rescue offer string for a risk tier."""
    return {
        "high":   "monthly_stepdown",
        "medium": "streak_challenge",
        "low":    "loyalty_only",
    }.get(level, "loyalty_only")


def _risk_drivers(inactive_days: float, streak_breaks: float) -> list[str]:
    """
    Generate a human-readable list of the primary signals driving churn risk.
    Extend this list with more rules as signals are added.
    """
    drivers: list[str] = []
    if inactive_days > 3:
        drivers.append("High inactive days")
    if streak_breaks > 0:
        drivers.append("Streak broken")
    return drivers


_DATASET_CACHE: dict[str, tuple[pd.DataFrame, pd.DataFrame]] = {}


def _load_scored_dataset(data_dir: str | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Load, merge, feature-engineer, and score all users.
    Returns (scored_df, transactions) and caches in memory.
    Raises HTTPException 503 on missing data files.
    """
    cache_key = str(data_dir or os.getenv("SEED_DATA_DIR", "DEFAULT"))
    if cache_key in _DATASET_CACHE:
        return _DATASET_CACHE[cache_key]

    model, feature_cols = _get_model()

    try:
        users, transactions, streaks = load_data(data_dir)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    df = build_features(users, transactions, streaks)

    feature_df = df[select_features(df)].fillna(0)
    df["churn_probability"] = score_dataframe(feature_df, model, feature_cols)
    df["churn_risk_score"] = df["churn_probability"].apply(_risk_score)
    df["churn_risk_level"] = df["churn_risk_score"].apply(_risk_level)

    # Stitch back raw pre-OHE metadata that build_features expands away
    goal_map = (
        users[["user_id", "onboarding_goal"]]
        .drop_duplicates("user_id")
        .set_index("user_id")["onboarding_goal"]
    )
    df["onboarding_goal"] = df["user_id"].map(goal_map).fillna("")

    # current_product: last product from transactions (may be NaN for free users)
    if "product" in df.columns:
        df["current_product"] = df["product"].fillna("free").astype(str)
    else:
        tx_product = (
            transactions.sort_values("seq")
            .groupby("user_id")["product"]
            .last()
        )
        df["current_product"] = df["user_id"].map(tx_product).fillna("free").astype(str)

    _DATASET_CACHE[cache_key] = (df, transactions)
    return df, transactions


def _load_scored_active(data_dir: str | None) -> pd.DataFrame:
    """
    Load, merge, feature-engineer, and score all currently active users.
    Returns a DataFrame with active users only (is_churned == 0).
    """
    df, _ = _load_scored_dataset(data_dir)
    active_mask = df["is_churned"] == 0
    return df[active_mask].copy()


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ScoreRequest(BaseModel):
    """
    JSON payload for POST /api/risk/score.

    All fields are optional — missing values default to 0 / unknown.
    Raw categorical strings (country, os, …) are one-hot-encoded server-side;
    pre-encoded columns (e.g. country_us) can also be passed as extra fields.
    """
    streak_days: float = Field(0, ge=0)
    streak_best: float = Field(0, ge=0)
    inactive_days: float = Field(0, ge=0)
    streak_breaks: float = Field(0, ge=0)
    ai_edits_first_day: float = Field(0, ge=0)
    photos_imported: float = Field(0, ge=0)
    push_opt_in_bin: int = Field(0, ge=0, le=1)
    days_since_last_purchase: float = Field(0, ge=0)
    days_since_install: float = Field(0, ge=0)
    price_usd: float = Field(0, ge=0)
    is_trial_converter: int = Field(0, ge=0, le=1)
    country: str | None = None
    os: str | None = None
    acquisition_channel: str | None = None
    onboarding_goal: str | None = None

    model_config = {"extra": "allow"}


class ScoreResponse(BaseModel):
    churn_probability: float
    churn_risk_score: int           # 0-100
    churn_risk_level: str           # "low" | "medium" | "high"


class AtRiskUser(BaseModel):
    user_id: str
    current_product: str
    onboarding_goal: str
    streak_days: float
    streak_best: float
    inactive_days: float
    streak_breaks: float
    churn_risk_score: int           # 0-100
    churn_risk_level: str           # "low" | "medium" | "high"
    risk_drivers: list[str]
    recommended_rescue_offer: str


class AdaptySyncUser(BaseModel):
    """Minimal payload shaped for the Adapty server-side API."""
    user_id: str
    churn_risk_level: str           # "low" | "medium" | "high"
    streak_days: float              # explicit float — Adapty rejects int
    streak_best: float
    inactive_days: float
    streak_breaks: float


class KpiSummary(BaseModel):
    subscribers_scored: int
    at_risk_users: int
    revenue_at_risk_usd: float
    avg_ltv_by_plan: dict[str, float]


class TierSummary(BaseModel):
    tier: str
    min_score: int
    users: int
    actual_churn_rate: float
    revenue_at_risk_usd: float
    action: str


class ChurnByPlan(BaseModel):
    plan: str
    churn_rate: float


class StreakDecay(BaseModel):
    days_before_event: list[int]
    churned: list[float]
    retained: list[float]
    simulated: bool


class AnalyticsSummaryResponse(BaseModel):
    kpi: KpiSummary
    tiers: list[TierSummary]
    churn_by_plan: list[ChurnByPlan]
    streak_decay: StreakDecay


# ---------------------------------------------------------------------------
# POST /api/risk/score
# ---------------------------------------------------------------------------

@router.post("/api/risk/score", response_model=ScoreResponse, tags=["Risk Engine"])
def score_user(payload: ScoreRequest) -> ScoreResponse:
    """
    Score a single user and return their churn probability, integer risk
    score (0-100), and 3-tier risk level.
    """
    model, feature_cols = _get_model()

    data: dict[str, Any] = payload.model_dump()

    # One-hot encode raw categorical strings if provided
    cat_map = {
        "country": "country",
        "os": "os",
        "acquisition_channel": "acquisition_channel",
        "onboarding_goal": "onboarding_goal",
    }
    ohe_data: dict[str, int] = {}
    for field, prefix in cat_map.items():
        value = data.pop(field, None)
        if value:
            ohe_data[f"{prefix}_{str(value).lower().strip()}"] = 1

    extra_fields = {k: v for k, v in data.items() if k not in ScoreRequest.model_fields}
    data = {k: v for k, v in data.items() if k in ScoreRequest.model_fields}

    row = {**data, **ohe_data, **extra_fields}
    row["streak_resilience"] = row.get("streak_breaks", 0) / (row.get("streak_best", 0) + 1)

    df = pd.DataFrame([row])
    prob = float(score_dataframe(df, model, feature_cols)[0])
    score = _risk_score(prob)

    return ScoreResponse(
        churn_probability=round(prob, 6),
        churn_risk_score=score,
        churn_risk_level=_risk_level(score),
    )


# ---------------------------------------------------------------------------
# GET /api/users/at-risk
# ---------------------------------------------------------------------------

@router.get("/api/users/at-risk", response_model=list[AtRiskUser], tags=["Risk Engine"])
def users_at_risk(
    tier: str | None = Query(None, description="Filter by risk tier: high | medium | low"),
    goal: str | None = Query(None, description="Filter by onboarding_goal (case-insensitive)"),
    limit: int = Query(50, ge=1, le=1000, description="Max users to return"),
) -> list[AtRiskUser]:
    """
    Return the top-N highest-risk active users, with risk drivers and a
    recommended rescue offer per user.

    Optional filters:
    - **tier**: `high`, `medium`, or `low`
    - **goal**: onboarding goal substring match (case-insensitive)
    - **limit**: max results (default 50)
    """
    data_dir = os.getenv("SEED_DATA_DIR", None)
    df_active = _load_scored_active(data_dir)

    if df_active.empty:
        return []

    # Apply optional filters
    if tier:
        df_active = df_active[df_active["churn_risk_level"] == tier.lower()]
    if goal:
        df_active = df_active[
            df_active["onboarding_goal"].str.lower().str.contains(goal.lower(), na=False)
        ]

    top = df_active.nlargest(limit, "churn_risk_score")

    results: list[AtRiskUser] = []
    for _, row in top.iterrows():
        score = int(row["churn_risk_score"])
        level = str(row["churn_risk_level"])
        results.append(
            AtRiskUser(
                user_id=str(row["user_id"]),
                current_product=str(row.get("current_product", "free")),
                onboarding_goal=str(row.get("onboarding_goal", "")),
                streak_days=float(row.get("streak_days", 0)),
                streak_best=float(row.get("streak_best", 0)),
                inactive_days=float(row.get("inactive_days", 0)),
                streak_breaks=float(row.get("streak_breaks", 0)),
                churn_risk_score=score,
                churn_risk_level=level,
                risk_drivers=_risk_drivers(
                    float(row.get("inactive_days", 0)),
                    float(row.get("streak_breaks", 0)),
                ),
                recommended_rescue_offer=_rescue_offer(level),
            )
        )

    return results


# ---------------------------------------------------------------------------
# GET /api/users/adapty-sync
# ---------------------------------------------------------------------------

@router.get("/api/users/adapty-sync", response_model=list[AdaptySyncUser], tags=["Risk Engine"])
def adapty_sync() -> list[AdaptySyncUser]:
    """
    Return the minimal Adapty-compatible payload for all active users.

    The 4 streak metrics are explicitly cast to Python ``float`` (e.g. 21.0,
    not 21) because Adapty's API schema rejects bare integer values for these
    fields.
    """
    data_dir = os.getenv("SEED_DATA_DIR", None)
    df_active = _load_scored_active(data_dir)

    if df_active.empty:
        return []

    results: list[AdaptySyncUser] = []
    for _, row in df_active.iterrows():
        results.append(
            AdaptySyncUser(
                user_id=str(row["user_id"]),
                churn_risk_level=str(row["churn_risk_level"]),
                streak_days=float(row.get("streak_days", 0)),
                streak_best=float(row.get("streak_best", 0)),
                inactive_days=float(row.get("inactive_days", 0)),
                streak_breaks=float(row.get("streak_breaks", 0)),
            )
        )

    return results


# ---------------------------------------------------------------------------
# GET /api/analytics/summary
# ---------------------------------------------------------------------------

def _compute_analytics_summary(data_dir: str | None = None) -> AnalyticsSummaryResponse:
    """
    Compute full dashboard summary aggregations from scored users and transactions.
    """
    df, transactions = _load_scored_dataset(data_dir)

    # 1. KPI
    subscribers_scored = int(len(df))
    high_tier_users = df[df["churn_risk_level"] == "high"] if not df.empty else pd.DataFrame()
    at_risk_users = int(len(high_tier_users))
    revenue_at_risk_usd = round(
        float(pd.to_numeric(high_tier_users.get("price_usd"), errors="coerce").fillna(0.0).sum()), 2
    ) if not high_tier_users.empty else 0.0

    avg_ltv_by_plan = {"weekly": 0.0, "monthly": 0.0, "annual": 0.0}
    if not transactions.empty and "product" in transactions.columns and "price_usd" in transactions.columns:
        tx_clean = transactions.dropna(subset=["product", "user_id"]).copy()
        tx_clean["price_usd"] = pd.to_numeric(tx_clean["price_usd"], errors="coerce").fillna(0.0)
        user_plan_spend = (
            tx_clean.groupby(["product", "user_id"])["price_usd"]
            .sum()
            .groupby("product")
            .mean()
        )
        for plan in ["weekly", "monthly", "annual"]:
            avg_ltv_by_plan[plan] = round(float(user_plan_spend.get(plan, 0.0)), 2)

    kpi = KpiSummary(
        subscribers_scored=subscribers_scored,
        at_risk_users=at_risk_users,
        revenue_at_risk_usd=revenue_at_risk_usd,
        avg_ltv_by_plan=avg_ltv_by_plan,
    )

    # 2. Tiers (high, medium, low)
    tier_configs = [
        ("high", 75, "monthly_stepdown"),
        ("medium", 40, "streak_challenge"),
        ("low", 0, "loyalty_only"),
    ]
    tiers: list[TierSummary] = []
    for tier_name, min_score, action in tier_configs:
        tdf = df[df["churn_risk_level"] == tier_name] if not df.empty else pd.DataFrame()
        u_count = int(len(tdf))
        act_churn = (
            round(float(tdf["is_churned"].mean()), 4)
            if u_count > 0 and "is_churned" in tdf.columns
            else 0.0
        )
        tier_rev = (
            round(float(pd.to_numeric(tdf.get("price_usd"), errors="coerce").fillna(0.0).sum()), 2)
            if u_count > 0
            else 0.0
        )
        tiers.append(
            TierSummary(
                tier=tier_name,
                min_score=min_score,
                users=u_count,
                actual_churn_rate=act_churn,
                revenue_at_risk_usd=tier_rev,
                action=action,
            )
        )

    # 3. churn_by_plan
    churn_by_plan: list[ChurnByPlan] = []
    if not df.empty and "product" in df.columns and "is_churned" in df.columns:
        plan_df = df.dropna(subset=["product"])
        if not plan_df.empty:
            plan_churn = plan_df.groupby("product")["is_churned"].mean()
            for plan_name, rate in plan_churn.items():
                churn_by_plan.append(
                    ChurnByPlan(
                        plan=str(plan_name),
                        churn_rate=round(float(rate), 4),
                    )
                )

    # 4. streak_decay (hardcoded timeline dictionary for UI chart)
    streak_decay = StreakDecay(
        days_before_event=[-30, -25, -20, -15, -10, -5, 0],
        churned=[6.1, 5.8, 5.2, 4.0, 2.6, 1.2, 0.3],
        retained=[6.4, 6.6, 6.5, 6.8, 6.7, 6.9, 7.0],
        simulated=True,
    )

    return AnalyticsSummaryResponse(
        kpi=kpi,
        tiers=tiers,
        churn_by_plan=churn_by_plan,
        streak_decay=streak_decay,
    )


@router.get("/api/analytics/summary", response_model=AnalyticsSummaryResponse, tags=["Risk Engine"])
def analytics_summary() -> AnalyticsSummaryResponse:
    """
    Return comprehensive dashboard analytics:
    - **kpi**: total users scored, high-tier count, revenue at risk, and avg LTV by plan
    - **tiers**: metrics and rescue actions for high, medium, and low tiers
    - **churn_by_plan**: historical churn rates broken down by subscription plan
    - **streak_decay**: engagement decay curve comparing churned vs retained users
    """
    data_dir = os.getenv("SEED_DATA_DIR", None)
    return _compute_analytics_summary(data_dir)
