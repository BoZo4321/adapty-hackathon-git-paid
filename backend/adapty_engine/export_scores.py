"""Export churn scores for Adapty users u00000-u04999 in profile_sync input format.

Reuses Person 1's pipeline unchanged: backend.risk_engine.router._load_scored_dataset
(load_data -> build_features -> select_features -> score_dataframe -> _risk_score).
Read-only with respect to the data; writes only the two JSON files into --out-dir.

Usage:
  1. python -m backend.adapty_engine.export_scores [--out-dir data/adapty_sync]
  2. python -m backend.adapty_engine.profile_sync --input data/adapty_sync/first_500.json --limit 3
  3. python -m backend.adapty_engine.profile_sync --input data/adapty_sync/first_500.json --apply --keep-going
"""
import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path

from backend.risk_engine.router import _load_scored_dataset
from backend.adapty_engine.profile_sync import churn_risk_level_for  # 40/75

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_DIR = REPO_ROOT / "data" / "adapty_sync"

STREAK_COLS = ["streak_days", "streak_best", "inactive_days", "streak_breaks"]
ID_RE = re.compile(r"^u(\d{5})$")
MAX_NUM = 4999
SPLIT_AT = 500  # u00000-u00499 -> first_500, u00500-u04999 -> rest_4500


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Export churn scores for Adapty users u00000-u04999.")
    p.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR,
                   help=f"output folder (default: {DEFAULT_OUT_DIR})")
    args = p.parse_args(argv)
    out_dir: Path = args.out_dir

    df, _ = _load_scored_dataset(None)  # same default data path as the API
    print(f"scored rows total: {len(df)}")

    # Which users had no row in streaks.csv (Person 1's code fills those with 0)
    from backend.risk_engine.scorer import load_data
    _, _, streaks = load_data(None)
    streak_ids = set(streaks["user_id"].astype(str))

    first, rest = [], []
    skipped = []          # (user_id, reason)
    seen = set()
    no_streak_row = []

    for _, row in df.iterrows():
        uid = str(row["user_id"])
        m = ID_RE.match(uid)
        if not m or int(m.group(1)) > MAX_NUM:
            continue  # not in Adapty, filtered by design (not counted as skipped)
        if uid in seen:
            skipped.append((uid, "duplicate user_id in scored dataset"))
            continue
        seen.add(uid)

        score = row["churn_risk_score"]
        vals = {c: row[c] for c in STREAK_COLS}
        bad = [k for k, v in {"churn_risk_score": score, **vals}.items()
               if v is None or not math.isfinite(float(v))]
        if bad:
            skipped.append((uid, f"non-finite value(s): {', '.join(bad)}"))
            continue
        if uid not in streak_ids:
            no_streak_row.append(uid)

        rec = {
            "user_id": uid,
            "churn_risk_score": int(score),
            **{c: float(vals[c]) for c in STREAK_COLS},
        }
        (first if int(m.group(1)) < SPLIT_AT else rest).append(rec)

    first.sort(key=lambda r: r["user_id"])
    rest.sort(key=lambda r: r["user_id"])

    expected = {f"u{i:05d}" for i in range(MAX_NUM + 1)}
    missing = sorted(expected - seen)

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in (("first_500.json", first), ("rest_4500.json", rest)):
        path = out_dir / name
        path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        levels = Counter(churn_risk_level_for(float(r["churn_risk_score"])) for r in rows)
        print(f"\n{path}: {len(rows)} rows")
        print(f"  low={levels['low']}  medium={levels['medium']}  high={levels['high']}")
        if rows:
            print(f"  first={rows[0]['user_id']}  last={rows[-1]['user_id']}")

    print(f"\nskipped: {len(skipped)}")
    for uid, reason in skipped[:20]:
        print(f"  {uid}: {reason}")
    print(f"expected ids missing from users.csv: {len(missing)}"
          + (f"  e.g. {missing[:10]}" if missing else ""))
    print(f"exported ids with no streaks.csv row (streaks filled 0 by scorer.py:196): "
          f"{len(no_streak_row)}" + (f"  e.g. {no_streak_row[:10]}" if no_streak_row else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
