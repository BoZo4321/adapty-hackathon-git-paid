#!/usr/bin/env python3
"""
backend/risk_engine/scorer.py  (Person 1)

Multi-signal churn prediction model using XGBoost.

Loads users.csv, transactions.csv, and streaks.csv, engineers features,
trains an XGBClassifier to predict is_churned, prints evaluation metrics,
and saves the model to churn_model.json inside this directory.

Supports both plain .csv and gzip-compressed .csv.gz files.

Usage:
    python backend/risk_engine/scorer.py
    python backend/risk_engine/scorer.py --data-dir /path/to/data
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from xgboost import XGBClassifier

warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = Path(__file__).parent / "churn_model.json"

# Candidate data directories, searched in order
_DATA_CANDIDATES = [
    PROJECT_ROOT / "data",
    PROJECT_ROOT / "data" / "offline",
    PROJECT_ROOT / "data" / "streaks",
]

SNAPSHOT_DATE = datetime(2026, 11, 7, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------
def _find_file(filename: str, directories: list[Path]) -> Path:
    """
    Search ``directories`` for ``filename`` or ``filename + '.gz'``.
    Raises FileNotFoundError if not found anywhere.
    """
    for d in directories:
        for name in (filename, filename + ".gz"):
            p = d / name
            if p.exists():
                return p
    searched = [str(d / filename) for d in directories]
    raise FileNotFoundError(
        f"Could not find '{filename}' (plain or .gz) in any of:\n  "
        + "\n  ".join(searched)
    )


def _read(filename: str, data_dirs: list[Path]) -> pd.DataFrame:
    """Read a CSV (plain or gzipped) from the first matching directory."""
    path = _find_file(filename, data_dirs)
    compression = "gzip" if path.suffix == ".gz" else None
    df = pd.read_csv(path, compression=compression, low_memory=False)
    print(f"  Loaded {path.name:35s}  shape={df.shape}")
    return df


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_data(data_dir: str | Path | None = None) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load users, transactions, and streaks DataFrames.

    ``data_dir`` overrides the default search paths. If the directory
    contains subdirectories ``offline/`` and ``streaks/``, those are
    also added to the search list automatically.
    """
    if data_dir:
        base = Path(data_dir)
        dirs = [base, base / "offline", base / "streaks"]
    else:
        dirs = list(_DATA_CANDIDATES)

    # Also honour the SEED_DATA_DIR env var as a fallback
    env_dir = os.getenv("SEED_DATA_DIR")
    if env_dir:
        ep = Path(env_dir)
        dirs = [ep, ep / "streaks"] + dirs

    # Deduplicate while preserving order
    seen: set[Path] = set()
    dirs = [d for d in dirs if not (d in seen or seen.add(d))]

    print("Loading CSVs …")
    users = _read("users.csv", dirs)
    transactions = _read("transactions.csv", dirs)

    # streaks may live in a sub-folder
    streak_dirs = dirs + [d / "streaks" for d in dirs]
    streaks = _read("streaks.csv", streak_dirs)

    return users, transactions, streaks


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------
def _parse_dt(series: pd.Series) -> pd.Series:
    """Coerce a string column to timezone-aware UTC datetimes, NaT on failure."""
    return pd.to_datetime(series, errors="coerce", utc=True)


def build_features(
    users: pd.DataFrame,
    transactions: pd.DataFrame,
    streaks: pd.DataFrame,
    snapshot: datetime = SNAPSHOT_DATE,
) -> pd.DataFrame:
    """
    Merge tables and engineer the full feature matrix + target label.

    Returns a DataFrame that contains both features and ``is_churned``.
    """
    snapshot_ts = pd.Timestamp(snapshot)

    # ------------------------------------------------------------------
    # 1.  Target label: is_churned
    #     A user is churned if renew_status == False  OR
    #     cancellation_reason is not null, on their *latest* transaction.
    # ------------------------------------------------------------------
    tx = transactions.copy()
    tx["purchased_at_dt"] = _parse_dt(tx["purchased_at"])

    # Sort so the last row per user is the most recent purchase
    tx_sorted = tx.sort_values("purchased_at_dt", na_position="first")

    # Boolean coercion: "False"/"True" strings → Python bool
    if tx["renew_status"].dtype == object:
        tx_sorted["renew_status"] = (
            tx_sorted["renew_status"]
            .astype(str)
            .str.strip()
            .str.lower()
            .map({"true": True, "false": False, "1": True, "0": False})
        )

    tx_last = tx_sorted.groupby("user_id").last().reset_index()

    tx_last["is_churned"] = (
        (tx_last["renew_status"] == False)  # noqa: E712  (intentional == False)
        | tx_last["cancellation_reason"].notna()
    ).astype(int)

    # is_trial_converter: had an annual_trial offer *before* a paid subscription
    trial_users = (
        tx[tx["offer"].astype(str).str.lower().str.contains("annual_trial", na=False)]
        ["user_id"]
        .unique()
    )
    tx_last["is_trial_converter"] = tx_last["user_id"].isin(trial_users).astype(int)

    # days_since_last_purchase
    tx_last["last_purchased_at"] = _parse_dt(tx_last["purchased_at"])
    tx_last["days_since_last_purchase"] = (
        (snapshot_ts - tx_last["last_purchased_at"])
        .dt.total_seconds()
        .div(86_400)
        .clip(lower=0)
    )

    # ------------------------------------------------------------------
    # 2.  Merge: users ← tx_last ← streaks
    # ------------------------------------------------------------------
    merged = users.merge(tx_last, on="user_id", how="left")
    merged = merged.merge(streaks, on="user_id", how="left")

    # Users with no transactions are considered NOT churned (never paid)
    merged["is_churned"] = merged["is_churned"].fillna(0).astype(int)

    # ------------------------------------------------------------------
    # 3.  Streak features
    # ------------------------------------------------------------------
    for col in ("streak_days", "streak_best", "inactive_days", "streak_breaks"):
        merged[col] = pd.to_numeric(merged.get(col), errors="coerce").fillna(0)

    merged["streak_resilience"] = (
        merged["streak_breaks"] / (merged["streak_best"] + 1)
    )

    # ------------------------------------------------------------------
    # 4.  Numeric / boolean columns from users
    # ------------------------------------------------------------------
    merged["ai_edits_first_day"] = pd.to_numeric(
        merged.get("ai_edits_first_day"), errors="coerce"
    ).fillna(0)
    merged["photos_imported"] = pd.to_numeric(
        merged.get("photos_imported"), errors="coerce"
    ).fillna(0)
    merged["push_opt_in_bin"] = (
        merged.get("push_opt_in", pd.Series(dtype=str))
        .astype(str)
        .str.lower()
        .eq("yes")
        .astype(int)
    )

    # price_usd
    merged["price_usd"] = pd.to_numeric(merged.get("price_usd"), errors="coerce").fillna(0)

    # days_since_install
    merged["install_at_dt"] = _parse_dt(merged.get("install_at"))
    merged["days_since_install"] = (
        (snapshot_ts - merged["install_at_dt"])
        .dt.total_seconds()
        .div(86_400)
        .clip(lower=0)
        .fillna(0)
    )

    # fill remaining days_since_last_purchase NaN (non-payers) with days_since_install
    merged["days_since_last_purchase"] = (
        merged["days_since_last_purchase"]
        .fillna(merged["days_since_install"])
    )
    merged["is_trial_converter"] = merged["is_trial_converter"].fillna(0).astype(int)

    # ------------------------------------------------------------------
    # 5.  One-hot encode categoricals
    #     Fill NaNs with "unknown" *before* get_dummies so no string column
    #     ever has a numeric fill value (avoids Pandas4Warning).
    #     Use dtype=float so OHE columns are already float — no astype needed.
    # ------------------------------------------------------------------
    cat_cols = ["country", "os", "acquisition_channel", "onboarding_goal"]
    for col in cat_cols:
        if col in merged.columns:
            merged[col] = merged[col].fillna("unknown").astype(str).str.lower().str.strip()

    merged = pd.get_dummies(merged, columns=[c for c in cat_cols if c in merged.columns], dtype=float)

    # Drop the raw push_opt_in string column — only the binary _bin version is used
    merged = merged.drop(columns=["push_opt_in"], errors="ignore")

    return merged


# ---------------------------------------------------------------------------
# Feature columns (everything except identifiers and leakage cols)
# ---------------------------------------------------------------------------
_EXCLUDE = {
    "user_id", "is_churned",
    # raw date strings — numeric versions (days_since_*) are used instead
    "install_at", "purchased_at", "expires_at", "originally_purchased_at",
    "renew_status_changed_at", "billing_issue_detected_at", "refunded_at",
    "last_purchased_at", "install_at_dt",
    # raw un-encoded string — binary push_opt_in_bin is used instead
    "push_opt_in",
    # transaction attributes not suitable as direct features
    "purchase_type", "product", "price_local", "renew_status",
    # high-cardinality / leakage
    "store_product_id", "currency", "locale", "app_version",
    "platform", "device", "placement", "flow", "ab_test",
    "cancellation_reason", "offer",
    # transaction sequence number — not predictive
    "seq",
}


def select_features(df: pd.DataFrame) -> list[str]:
    """Return the list of feature column names (excludes target + IDs + raw strings/datetimes)."""
    return [
        c for c in df.columns
        if c not in _EXCLUDE
        and df[c].dtype != object                       # drop any residual str columns
        and not pd.api.types.is_datetime64_any_dtype(df[c])  # drop any datetime columns
    ]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def train(data_dir: str | Path | None = None) -> XGBClassifier:
    """
    Full training pipeline:
      load → feature-engineer → split → fit → evaluate → save model.

    Returns the trained XGBClassifier.
    """
    users, transactions, streaks = load_data(data_dir)

    print("\nEngineering features …")
    df = build_features(users, transactions, streaks)

    feature_cols = select_features(df)
    # select_features already guarantees no object/datetime columns.
    # Safe numeric cast: fill NaN with 0 column-by-column so Pandas never
    # tries to fill a str/datetime dtype with an int literal.
    X = df[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = df["is_churned"].astype(int)

    print(f"\nDataset: {len(df):,} rows | {len(feature_cols)} features")
    print(f"Class balance: churned={y.sum():,} ({y.mean():.1%})  active={len(y) - y.sum():,}")

    # 80/20 split, stratified
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # XGBoost handles class imbalance via scale_pos_weight
    neg, pos = (y_train == 0).sum(), (y_train == 1).sum()
    scale = neg / max(pos, 1)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    print("\nTraining XGBClassifier …")
    model.fit(X_train, y_train)

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    accuracy  = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall    = recall_score(y_test, y_pred, zero_division=0)
    roc_auc   = roc_auc_score(y_test, y_prob) if y_test.nunique() > 1 else float("nan")

    print("\n" + "=" * 50)
    print("  EVALUATION (held-out 20 %)")
    print("=" * 50)
    print(f"  Accuracy  : {accuracy:.4f}")
    print(f"  Precision : {precision:.4f}")
    print(f"  Recall    : {recall:.4f}")
    print(f"  ROC-AUC   : {roc_auc:.4f}")
    print("=" * 50)

    # Top-5 feature importances
    importances = pd.Series(model.feature_importances_, index=feature_cols)
    top5 = importances.nlargest(5)
    print("\n  Top-5 features by importance:")
    for feat, imp in top5.items():
        print(f"    {feat:<45s} {imp:.4f}")

    # ------------------------------------------------------------------
    # Save model + feature list
    # ------------------------------------------------------------------
    model.save_model(str(MODEL_PATH))
    feature_path = MODEL_PATH.with_suffix(".features.txt")
    feature_path.write_text("\n".join(feature_cols), encoding="utf-8")
    print(f"\n  Model saved  → {MODEL_PATH}")
    print(f"  Feature list → {feature_path}")

    return model


# ---------------------------------------------------------------------------
# Inference helpers (re-used by router.py)
# ---------------------------------------------------------------------------
def load_model() -> tuple[XGBClassifier, list[str]]:
    """Load the saved model and its feature list from disk."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run scorer.py first to train it."
        )
    model = XGBClassifier()
    model.load_model(str(MODEL_PATH))

    feature_path = MODEL_PATH.with_suffix(".features.txt")
    if feature_path.exists():
        features = feature_path.read_text(encoding="utf-8").splitlines()
    else:
        # Fall back to booster feature names
        features = model.get_booster().feature_names or []

    return model, features


def score_dataframe(
    df_features: pd.DataFrame,
    model: XGBClassifier,
    feature_cols: list[str],
) -> np.ndarray:
    """
    Given a DataFrame that already has the right columns, return churn probabilities.
    Missing columns are filled with 0 (safe default for one-hot dummies).
    """
    X = pd.DataFrame(0, index=df_features.index, columns=feature_cols, dtype=float)
    common = [c for c in feature_cols if c in df_features.columns]
    X[common] = df_features[common].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    return model.predict_proba(X)[:, 1]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--data-dir",
        default=os.getenv("SEED_DATA_DIR", None),
        help="Directory containing users.csv[.gz], transactions.csv[.gz], streaks.csv[.gz]",
    )
    args = ap.parse_args()
    train(args.data_dir)
