# 🔒 OWNED BY PERSON 1: Automated unit tests & evals for risk archetypes & streak bounds
"""
Unit tests for backend/risk_engine/scorer.py and router.py.

Run with:
    pytest backend/risk_engine/tests/test_risk_engine.py -v
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock

from backend.risk_engine.scorer import (
    build_features,
    select_features,
    score_dataframe,
)
from backend.risk_engine.router import (
    _risk_level,
    _risk_score,
    _risk_drivers,
    _rescue_offer,
    analytics_summary,
    _compute_analytics_summary,
)


# ---------------------------------------------------------------------------
# Fixtures — minimal synthetic DataFrames
# ---------------------------------------------------------------------------

@pytest.fixture()
def tiny_users() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "user_id": ["u1", "u2", "u3"],
            "platform": ["ios", "android", "ios"],
            "country": ["US", "BR", "DE"],
            "device": ["iPhone", "Pixel", "iPad"],
            "os": ["ios", "android", "ios"],
            "locale": ["en_US", "pt_BR", "de_DE"],
            "install_at": ["2026-01-01", "2026-03-15", "2026-06-01"],
            "acquisition_channel": ["paid_social", "organic", "paid_search"],
            "onboarding_goal": ["weight_loss", "sleep", "fitness"],
            "ai_edits_first_day": [5, 0, 2],
            "photos_imported": [10, 0, 3],
            "push_opt_in": ["yes", "no", "yes"],
            "app_version": ["1.0", "1.1", "1.0"],
            "placement": ["home", "home", "settings"],
            "flow": ["a", "b", "a"],
            "ab_test": ["ctrl", "ctrl", "test"],
        }
    )


@pytest.fixture()
def tiny_transactions() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "user_id": ["u1", "u2"],
            "seq": [1, 1],
            "purchase_type": ["auto_renewable_subscription", "auto_renewable_subscription"],
            "product": ["annual", "weekly"],
            "store_product_id": ["com.app.annual", "com.app.weekly"],
            "purchased_at": ["2026-02-01", "2026-04-01"],
            "expires_at": ["2027-02-01", "2026-04-08"],
            "originally_purchased_at": ["2026-02-01", "2026-04-01"],
            "price_local": [49.99, 4.99],
            "currency": ["USD", "BRL"],
            "price_usd": [49.99, 2.50],
            "offer": ["annual_trial", None],
            "renew_status": [True, False],
            "renew_status_changed_at": [None, "2026-04-05"],
            "billing_issue_detected_at": [None, None],
            "refunded_at": [None, None],
            "cancellation_reason": [None, "voluntarily_cancelled"],
        }
    )


@pytest.fixture()
def tiny_streaks() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "user_id": ["u1", "u2", "u3"],
            "streak_days": [14, 2, 0],
            "streak_best": [21, 5, 0],
            "inactive_days": [0, 10, 30],
            "streak_breaks": [1, 3, 0],
        }
    )


# ---------------------------------------------------------------------------
# build_features tests
# ---------------------------------------------------------------------------

class TestBuildFeatures:
    def test_shape_includes_all_users(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        assert len(df) == 3, "All 3 users should be in the output"

    def test_target_label_churned(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        # u2 has renew_status=False AND cancellation_reason set → churned
        u2 = df[df["user_id"] == "u2"].iloc[0]
        assert u2["is_churned"] == 1

    def test_target_label_active(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        # u1 has renew_status=True and no cancellation_reason → active
        u1 = df[df["user_id"] == "u1"].iloc[0]
        assert u1["is_churned"] == 0

    def test_target_label_no_tx(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        # u3 has no transaction → treated as active (0)
        u3 = df[df["user_id"] == "u3"].iloc[0]
        assert u3["is_churned"] == 0

    def test_streak_resilience(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        u1 = df[df["user_id"] == "u1"].iloc[0]
        expected = 1 / (21 + 1)
        assert abs(u1["streak_resilience"] - expected) < 1e-6

    def test_is_trial_converter(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        # u1 had annual_trial offer → converter
        u1 = df[df["user_id"] == "u1"].iloc[0]
        assert u1["is_trial_converter"] == 1
        # u2 had no annual_trial offer
        u2 = df[df["user_id"] == "u2"].iloc[0]
        assert u2["is_trial_converter"] == 0

    def test_ohe_columns_present(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        # At least one OHE country column must be present
        country_cols = [c for c in df.columns if c.startswith("country_")]
        assert len(country_cols) >= 1

    def test_no_object_columns_in_features(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        feature_cols = select_features(df)
        obj_cols = [c for c in feature_cols if df[c].dtype == object]
        assert obj_cols == [], f"Object-dtype columns in features: {obj_cols}"

    def test_no_nan_in_features(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        feature_cols = select_features(df)
        X = df[feature_cols].fillna(0)
        assert not X.isnull().any().any()


# ---------------------------------------------------------------------------
# Streak resilience bounds
# ---------------------------------------------------------------------------

class TestStreakResilience:
    @pytest.mark.parametrize(
        "breaks, best, expected",
        [
            (0, 0, 0.0),   # no breaks, never had a streak → 0
            (5, 9, 0.5),   # moderate
            (10, 9, 1.0),  # maximum stress
        ],
    )
    def test_resilience_values(self, breaks, best, expected):
        result = breaks / (best + 1)
        assert abs(result - expected) < 1e-9

    def test_resilience_always_non_negative(self):
        for breaks in range(10):
            for best in range(10):
                r = breaks / (best + 1)
                assert r >= 0


# ---------------------------------------------------------------------------
# score_dataframe tests
# ---------------------------------------------------------------------------

class TestScoreDataframe:
    def _make_mock_model(self, n_features: int = 3) -> MagicMock:
        model = MagicMock()
        model.predict_proba.return_value = np.array([[0.6, 0.4], [0.3, 0.7]])
        return model

    def test_returns_probabilities(self):
        model = self._make_mock_model()
        feature_cols = ["streak_days", "inactive_days", "days_since_last_purchase"]
        df = pd.DataFrame(
            {"streak_days": [5, 1], "inactive_days": [0, 10], "days_since_last_purchase": [7, 60]}
        )
        probs = score_dataframe(df, model, feature_cols)
        assert len(probs) == 2
        assert all(0 <= p <= 1 for p in probs)

    def test_missing_columns_filled_with_zero(self):
        model = self._make_mock_model()
        feature_cols = ["streak_days", "extra_feature_not_in_df"]
        df = pd.DataFrame({"streak_days": [5]})
        # Should not raise
        probs = score_dataframe(df, model, feature_cols)
        called_X = model.predict_proba.call_args[0][0]
        assert called_X["extra_feature_not_in_df"].iloc[0] == 0.0

    def test_extra_df_columns_ignored(self):
        model = self._make_mock_model()
        feature_cols = ["streak_days"]
        df = pd.DataFrame({"streak_days": [5], "not_a_feature": [999]})
        probs = score_dataframe(df, model, feature_cols)
        called_X = model.predict_proba.call_args[0][0]
        assert "not_a_feature" not in called_X.columns


# ---------------------------------------------------------------------------
# _risk_level threshold tests (router helper)
# ---------------------------------------------------------------------------

class TestRiskLevel:
    @pytest.mark.parametrize(
        "score, expected",
        [
            (0, "low"),
            (39, "low"),
            (40, "medium"),
            (57, "medium"),
            (74, "medium"),
            (75, "high"),
            (90, "high"),
            (100, "high"),
        ],
    )
    def test_boundaries(self, score, expected):
        assert _risk_level(score) == expected

    def test_returns_string(self):
        assert isinstance(_risk_level(50), str)

    def test_valid_values_only(self):
        for score in [0, 20, 40, 60, 75, 100]:
            assert _risk_level(score) in {"low", "medium", "high"}


class TestRiskScore:
    @pytest.mark.parametrize(
        "prob, expected",
        [
            (0.0, 0),
            (0.399, 39),
            (0.40, 40),
            (0.749, 74),
            (0.75, 75),
            (1.0, 100),
        ],
    )
    def test_risk_score_int(self, prob, expected):
        assert _risk_score(prob) == expected
        assert isinstance(_risk_score(prob), int)


class TestRescueOffer:
    def test_offers_per_tier(self):
        assert _rescue_offer("high") == "monthly_stepdown"
        assert _rescue_offer("medium") == "streak_challenge"
        assert _rescue_offer("low") == "loyalty_only"


class TestRiskDrivers:
    def test_inactive_driver(self):
        drivers = _risk_drivers(inactive_days=4, streak_breaks=0)
        assert "High inactive days" in drivers
        assert "Streak broken" not in drivers

    def test_streak_broken_driver(self):
        drivers = _risk_drivers(inactive_days=1, streak_breaks=2)
        assert "Streak broken" in drivers
        assert "High inactive days" not in drivers

    def test_both_drivers(self):
        drivers = _risk_drivers(inactive_days=5, streak_breaks=1)
        assert len(drivers) == 2
        assert "High inactive days" in drivers
        assert "Streak broken" in drivers

    def test_no_drivers(self):
        assert _risk_drivers(inactive_days=0, streak_breaks=0) == []


# ---------------------------------------------------------------------------
# Regression: push_opt_in must not appear in features (dtype-safety bug)
# ---------------------------------------------------------------------------

class TestFeatureDtypeSafety:
    def test_push_opt_in_not_in_features(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        feature_cols = select_features(df)
        assert "push_opt_in" not in feature_cols, (
            "Raw 'push_opt_in' string column leaked into features; "
            "use 'push_opt_in_bin' instead."
        )

    def test_no_datetime_columns_in_features(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        feature_cols = select_features(df)
        dt_cols = [c for c in feature_cols if pd.api.types.is_datetime64_any_dtype(df[c])]
        assert dt_cols == [], f"Datetime columns found in features: {dt_cols}"

    def test_all_features_castable_to_float(self, tiny_users, tiny_transactions, tiny_streaks):
        df = build_features(tiny_users, tiny_transactions, tiny_streaks)
        feature_cols = select_features(df)
        # This must not raise
        X = df[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0.0)
        assert X.shape[1] == len(feature_cols)


# ---------------------------------------------------------------------------
# Analytics summary endpoint tests (GET /api/analytics/summary)
# ---------------------------------------------------------------------------

class TestAnalyticsSummary:
    def test_analytics_summary_live(self):
        res = analytics_summary()

        # 1. KPI
        assert res.kpi.subscribers_scored > 0
        assert res.kpi.at_risk_users >= 0
        assert res.kpi.revenue_at_risk_usd >= 0.0
        assert "weekly" in res.kpi.avg_ltv_by_plan
        assert "monthly" in res.kpi.avg_ltv_by_plan
        assert "annual" in res.kpi.avg_ltv_by_plan

        # 2. Tiers: exactly 3 tiers (high, medium, low)
        assert len(res.tiers) == 3
        tiers_by_name = {t.tier: t for t in res.tiers}
        assert set(tiers_by_name.keys()) == {"high", "medium", "low"}

        assert tiers_by_name["high"].min_score == 75
        assert tiers_by_name["high"].action == "monthly_stepdown"
        assert tiers_by_name["medium"].min_score == 40
        assert tiers_by_name["medium"].action == "streak_challenge"
        assert tiers_by_name["low"].min_score == 0
        assert tiers_by_name["low"].action == "loyalty_only"

        for t in res.tiers:
            assert t.users >= 0
            assert 0.0 <= t.actual_churn_rate <= 1.0
            assert t.revenue_at_risk_usd >= 0.0

        # Total users across tiers must equal subscribers_scored
        assert sum(t.users for t in res.tiers) == res.kpi.subscribers_scored

        # 3. Churn by plan
        assert len(res.churn_by_plan) > 0
        for item in res.churn_by_plan:
            assert isinstance(item.plan, str)
            assert 0.0 <= item.churn_rate <= 1.0

        # 4. Streak decay exact timeline
        assert res.streak_decay.days_before_event == [-30, -25, -20, -15, -10, -5, 0]
        assert res.streak_decay.churned == [6.1, 5.8, 5.2, 4.0, 2.6, 1.2, 0.3]
        assert res.streak_decay.retained == [6.4, 6.6, 6.5, 6.8, 6.7, 6.9, 7.0]
        assert res.streak_decay.simulated is True

    def test_missing_data_graceful_handling(self):
        # Mock empty data
        empty_df = pd.DataFrame(columns=["user_id", "is_churned", "churn_risk_level", "price_usd", "product"])
        empty_tx = pd.DataFrame(columns=["user_id", "product", "price_usd"])

        with patch("backend.risk_engine.router._load_scored_dataset", return_value=(empty_df, empty_tx)):
            res = _compute_analytics_summary()
            assert res.kpi.subscribers_scored == 0
            assert res.kpi.at_risk_users == 0
            assert res.kpi.revenue_at_risk_usd == 0.0
            assert res.kpi.avg_ltv_by_plan == {"weekly": 0.0, "monthly": 0.0, "annual": 0.0}
            assert len(res.tiers) == 3
            assert res.churn_by_plan == []
            assert res.streak_decay.simulated is True

