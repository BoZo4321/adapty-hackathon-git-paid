#!/usr/bin/env python3
"""
backend/risk_engine/enrich_streaks.py  (Person 1)

Adds the 4 daily-streak variables of Contract A to every user of the Lumen offline
dataset (users.csv, 50,000 users), consistent with transactions.csv:

    streak_days    current streak at the snapshot date
    streak_best    longest streak the user ever had
    inactive_days  days since the last qualifying action
    streak_breaks  how many times the streak broke

The seed repo has no daily activity, so it is simulated:
  * activity starts on the install date and never goes past the snapshot date
  * day 0 counts only if ai_edits_first_day > 0 (qualifying action = AI edit)
  * engagement comes from ai_edits_first_day, photos_imported, push_opt_in, plan
  * payers are more active while subscribed; activity drops after access ends
  * SOME voluntary cancels / refunds fade out 4-21 days before cancelling;
    price-sensitive weekly payers mostly don't (they leave over price, not habit);
    billing failures don't fade (involuntary churn)
  * random lapses for everyone, so the signal is noisy on purpose

Outputs (default <project>/data/streaks/):
  streaks.csv       user_id + the 4 variables (state at the snapshot date)
  activity_log.csv  user_id, date for every active day. scorer.py uses it with
                       compute_streak_features(..., as_of=<cutoff>) to train without
                       seeing activity from after the cancel.
  _sim_truth.csv    only with --with-truth: the simulator's hidden archetype, for
                       checking risk_archetype rules. NEVER a model feature.

Standard library only (Python 3.9+).

  python backend/risk_engine/enrich_streaks.py --data-dir C:/path/adapty-seed-data-hack/data/offline
  (or set SEED_DATA_DIR in .env / environment)
"""
from __future__ import annotations

import argparse
import os
import csv
import gzip
import math
import random
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

PRICE_SENSITIVE = {"IN", "BR", "MX", "TR", "RS", "PL"}
CHURN_REASONS = {"voluntarily_cancelled", "refund"}


# ----------------------------------------------------------------------------- helpers
def d(ts: str) -> date | None:
    return datetime.strptime(ts[:10], "%Y-%m-%d").date() if ts else None


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def read_csv(path: Path) -> list[dict]:
    with open(path, "rt", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def write_csv(path: Path, header: list[str], rows) -> None:
    with open(path, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)

# ----------------------------------------------------------------- feature computation
def compute_streak_features(active_days: set[date], start: date, as_of: date,
                            cadence: str = "daily", freezes: int = 1) -> dict:
    """Streak state at `as_of`, using only activity on or before `as_of`.

    Reusable for training: call it with an earlier `as_of` (e.g. 7 days before a cancel)
    so the model never sees activity from after the moment it is supposed to predict.

    cadence  daily | weekly: one period = one day or one 7-day block from install
    freezes  missed periods in a row that do not break the streak (they don't add to it)
    """
    plen = 1 if cadence == "daily" else 7
    n_periods = (as_of - start).days // plen + 1
    active_periods = {(x - start).days // plen for x in active_days if start <= x <= as_of}

    streak = best = breaks = 0
    missed = 0
    for p in range(n_periods):
        if p in active_periods:
            streak += 1
            missed = 0
            best = max(best, streak)
        else:
            # the current period is still open, missing it so far is not a miss
            if p == n_periods - 1:
                break
            missed += 1
            if missed > freezes and streak > 0:
                streak = 0
                breaks += 1

    seen = [x for x in active_days if start <= x <= as_of]
    last = max(seen) if seen else None
    return {
        "streak_days": streak,           # in periods (days for daily, weeks for weekly)
        "streak_best": best,
        "inactive_days": (as_of - (last or start)).days,
        "streak_breaks": breaks,
    }


# ------------------------------------------------------------------------- simulation
def user_story(u: dict, txs: list[dict], as_of: date, rng: random.Random) -> dict:
    """Decide the shape of the user's activity from their real attributes and purchases."""
    install = d(u["install_at"])
    edits = float(u["ai_edits_first_day"] or 0)
    photos = float(u["photos_imported"] or 0)
    push = u["push_opt_in"] == "yes"

    base = sigmoid(-1.1 + 0.45 * math.log1p(edits) + 0.25 * math.log1p(photos)
                   + (0.35 if push else 0) + rng.gauss(0, 0.5))

    s = {"install": install, "base": base, "edits": edits, "pay_from": None,
         "access_end": None, "fade_end": None, "fade_len": 0, "archetype": "free"}

    if not txs:
        # free users: engagement wears off after a while, longer if they started strong
        mean_life = 3 + 2.5 * edits + 0.3 * photos
        s["fade_end"] = install + timedelta(days=int(rng.expovariate(1 / mean_life)) + 1)
        s["fade_len"] = rng.randint(2, 6)
        s["archetype"] = "done" if edits <= 2 else "free_faded"
        return s

    txs = sorted(txs, key=lambda r: int(r["seq"]))
    first, last = txs[0], txs[-1]
    s["pay_from"] = d(first["purchased_at"])
    s["base"] = min(0.92, base + 0.15)
    product = last["product"]
    reason = last["cancellation_reason"]

    if last["purchase_type"] == "one_time_purchase":
        s["archetype"] = "lifetime"
        return s

    if reason == "billing_error":
        s["access_end"] = d(last["billing_issue_detected_at"]) or d(last["expires_at"])
        s["archetype"] = "billing"
        return s

    if reason in CHURN_REASONS:
        event = d(last["refunded_at"]) if reason == "refund" else d(last["renew_status_changed_at"])
        event = event or d(last["expires_at"])
        s["access_end"] = min(d(last["expires_at"]), as_of) if reason != "refund" else event
        price_user = product == "weekly" and (u["country"] in PRICE_SENSITIVE or rng.random() < 0.35)
        if price_user:
            s["archetype"] = "price"
            fade_p = 0.25                      # leaves over money, mostly still active
        elif edits <= 1 and len(txs) <= 2:
            s["archetype"] = "done"
            fade_p = 0.55
        else:
            s["archetype"] = "habit"
            fade_p = 0.70
        if rng.random() < fade_p:
            s["fade_end"] = event
            s["fade_len"] = rng.randint(4, 21)  # starts drifting 4–21 days before cancelling
        return s

    s["archetype"] = "active_sub"
    return s


def simulate_days(s: dict, as_of: date, rng: random.Random) -> set[date]:
    install = s["install"]
    active = set()
    if s["edits"] > 0:
        active.add(install)

    # random lapses: a few breaks of 2–10 days for everyone
    lapses = set()
    span = (as_of - install).days
    for _ in range(int(rng.expovariate(1 / max(1.0, span / 30)))):
        st = install + timedelta(days=rng.randint(1, max(1, span)))
        for k in range(rng.randint(2, 10)):
            lapses.add(st + timedelta(days=k))

    day = install + timedelta(days=1)
    while day <= as_of:
        p = s["base"]
        if s["pay_from"] and day < s["pay_from"]:
            p *= 0.8                                    # trial / pre-purchase
        if s["fade_end"]:
            start_fade = s["fade_end"] - timedelta(days=s["fade_len"])
            if day >= s["fade_end"]:
                p = 0.04
            elif day >= start_fade:
                frac = (day - start_fade).days / max(1, s["fade_len"])
                p = p * (1 - frac) + 0.04 * frac
        if s["access_end"] and day > s["access_end"]:
            p = min(p, 0.03)                            # lost premium, rarely comes back
        if day in lapses:
            p *= 0.1
        if rng.random() < p:
            active.add(day)
        day += timedelta(days=1)
    return active


# ------------------------------------------------------------------------------- main
PROJECT_ROOT = Path(__file__).resolve().parents[2]
STREAK_COLUMNS = ["streak_days", "streak_best", "inactive_days", "streak_breaks"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default=os.getenv("SEED_DATA_DIR", str(PROJECT_ROOT / "data" / "offline")),
                    help="folder with users.csv and transactions.csv (env SEED_DATA_DIR)")
    ap.add_argument("--out-dir", default=str(PROJECT_ROOT / "data" / "streaks"))
    ap.add_argument("--as-of", default=None,
                    help="snapshot date YYYY-MM-DD (default: latest timestamp in the data)")
    ap.add_argument("--cadence", choices=["daily", "weekly"], default="daily")
    ap.add_argument("--freezes", type=int, default=1, help="missed periods allowed without a break")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--with-truth", action="store_true", help="also write _sim_truth.csv")
    a = ap.parse_args()

    data, out = Path(a.data_dir), Path(a.out_dir)
    if not (data / "users.csv").exists():
        raise SystemExit(f"users.csv not found in {data}. Pass --data-dir or set SEED_DATA_DIR.")
    out.mkdir(parents=True, exist_ok=True)
    users = read_csv(data / "users.csv")
    txs = read_csv(data / "transactions.csv")
    by_user = defaultdict(list)
    for t in txs:
        by_user[t["user_id"]].append(t)

    if a.as_of:
        as_of = date.fromisoformat(a.as_of)
    else:
        stamps = [t[k] for t in txs for k in ("purchased_at", "renew_status_changed_at",
                                              "refunded_at", "billing_issue_detected_at") if t[k]]
        as_of = max(d(x) for x in stamps + [u["install_at"] for u in users])

    rng = random.Random(a.seed)
    rows, truth, log_rows = [], [], []
    for u in users:
        s = user_story(u, by_user.get(u["user_id"], []), as_of, rng)
        days = simulate_days(s, as_of, rng)
        f = compute_streak_features(days, s["install"], as_of, a.cadence, a.freezes)
        rows.append([u["user_id"]] + [f[c] for c in STREAK_COLUMNS])
        truth.append([u["user_id"], s["archetype"], int(bool(s["fade_end"]))])
        log_rows.extend((u["user_id"], x.isoformat()) for x in sorted(days))

    write_csv(out / "streaks.csv", ["user_id"] + STREAK_COLUMNS, rows)
    write_csv(out / "activity_log.csv", ["user_id", "date"], log_rows)
    if a.with_truth:
        write_csv(out / "_sim_truth.csv", ["user_id", "archetype", "faded"], truth)

    n = len(rows)
    print(f"snapshot {as_of} | cadence {a.cadence} | freezes {a.freezes} | users {n:,}")
    print(f"active streak (>0): {sum(r[1] > 0 for r in rows) / n:.1%} | "
          f"median streak_best: {sorted(r[2] for r in rows)[n // 2]} | activity rows: {len(log_rows):,}")
    print(f"written to {out}")


if __name__ == "__main__":
    main()
