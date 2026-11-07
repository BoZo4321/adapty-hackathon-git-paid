# OWNED BY PERSON 2: Server-Side API PATCH /profile/ custom_attributes updater
"""Push per-user churn/streak scores to Adapty as profile custom attributes.

Dry run by default. Usage (from repo root):
    python -m backend.adapty_engine.profile_sync                     # dry run, data/sample_users.json
    python -m backend.adapty_engine.profile_sync --limit 1 --apply   # send ONE real request
    python -m backend.adapty_engine.profile_sync --input path.json --apply --delay 0.5

The secret key is read from .env (ADAPTY_SECRET_KEY) and is never printed or logged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "data" / "sample_users.json"
PROFILE_URL = "https://api.adapty.io/api/v2/server-side-api/profile/"

CUSTOMER_PREFIX = "lumen_942195_"
MAX_ADAPTY_USER_NUM = 4999  # only u00000-u04999 exist in Adapty

# Attributes created by hand in the Adapty dashboard. key -> spec
ATTRIBUTES: dict[str, dict[str, Any]] = {
    "churn_risk_level": {"type": "string", "allowed": ("low", "medium", "high")},
    "streak_days": {"type": "number"},
    "streak_best": {"type": "number"},
    "inactive_days": {"type": "number"},
    "streak_breaks": {"type": "number"},
}
_KEY_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,30}$")
assert all(_KEY_RE.match(k) for k in ATTRIBUTES), "invalid attribute key"


class UserError(ValueError):
    """Bad input record; the user is skipped, nothing is sent."""


def resolve_customer_user_id(user: dict[str, Any]) -> str:
    """Return lumen_942195_NNNNN from customer_user_id or offline user_id (uNNNNN)."""
    cid = user.get("customer_user_id")
    if not cid:
        uid = str(user.get("user_id", ""))
        m = re.fullmatch(r"u(\d{5})", uid)
        if not m:
            raise UserError(f"no customer_user_id and unusable user_id {uid!r}")
        cid = CUSTOMER_PREFIX + m.group(1)
    m = re.fullmatch(re.escape(CUSTOMER_PREFIX) + r"(\d{5})", str(cid))
    if not m:
        raise UserError(f"customer_user_id {cid!r} does not match {CUSTOMER_PREFIX}NNNNN")
    if int(m.group(1)) > MAX_ADAPTY_USER_NUM:
        raise UserError(f"{cid} is outside u00000-u{MAX_ADAPTY_USER_NUM:05d} (not in Adapty)")
    return str(cid)


def build_custom_attributes(user: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate the 5 fields and return Adapty's [{"key", "value"}] list."""
    out: list[dict[str, Any]] = []
    for key, spec in ATTRIBUTES.items():
        if key not in user or user[key] is None:
            raise UserError(f"missing field {key!r}")
        value = user[key]
        if spec["type"] == "string":
            if not isinstance(value, str) or value not in spec["allowed"]:
                raise UserError(f"{key}={value!r} not in {spec['allowed']}")
        else:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise UserError(f"{key}={value!r} is not a number")
            if value < 0:
                raise UserError(f"{key}={value!r} is negative")
            # Adapty rejects JSON ints ("value is not a valid float"); send 21.0 not 21.
            value = float(value)
        out.append({"key": key, "value": value})
    return out


def build_request(user: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """(customer_user_id, json body) for one user. No installation_meta on purpose."""
    cid = resolve_customer_user_id(user)
    return cid, {"custom_attributes": build_custom_attributes(user)}


def load_secret_key() -> str:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
    key = os.getenv("ADAPTY_SECRET_KEY", "").strip()
    if not key:
        raise SystemExit("ADAPTY_SECRET_KEY is not set in .env")
    return key


def _redact(text: str, secret: str) -> str:
    return text.replace(secret, "***") if secret else text


def send_one(client: Any, secret: str, cid: str, body: dict[str, Any]) -> tuple[int, str]:
    """PATCH one profile. Returns (status_code, raw response text, secret redacted)."""
    resp = client.patch(
        PROFILE_URL,
        headers={
            "Authorization": f"Api-Key {secret}",
            "adapty-customer-user-id": cid,
            "Content-Type": "application/json",
        },
        content=json.dumps(body),
    )
    return resp.status_code, _redact(resp.text, secret)


def sync_profiles(
    users: list[dict[str, Any]],
    *,
    apply: bool = False,
    limit: int | None = None,
    delay: float = 0.5,
    keep_going: bool = False,
    verbose: bool = True,
) -> list[dict[str, Any]]:
    """Sync users one at a time. Returns one result dict per processed user."""
    selected = users[:limit] if limit is not None else users
    results: list[dict[str, Any]] = []
    secret = load_secret_key() if apply else ""
    client = None
    if apply:
        import httpx

        client = httpx.Client(timeout=20.0)

    def log(msg: str) -> None:
        if verbose:
            print(msg, flush=True)

    try:
        for i, user in enumerate(selected):
            try:
                cid, body = build_request(user)
            except UserError as e:
                log(f"[{i}] SKIP invalid user: {e}")
                results.append({"ok": False, "error": str(e), "user": user})
                continue

            if not apply:
                log(f"[{i}] DRY RUN  PATCH {PROFILE_URL}  adapty-customer-user-id: {cid}")
                log("      body: " + json.dumps(body))
                results.append({"ok": True, "dry_run": True, "customer_user_id": cid, "body": body})
                continue

            if i > 0 and delay > 0:
                time.sleep(delay)
            try:
                status, text = send_one(client, secret, cid, body)
            except Exception as e:  # network error; message never contains headers
                status, text = 0, _redact(f"{type(e).__name__}: {e}", secret)
            ok = 200 <= status < 300
            log(f"[{i}] {'OK  ' if ok else 'FAIL'} {status}  {cid}")
            log(f"      raw response: {text}")
            results.append({"ok": ok, "status": status, "customer_user_id": cid, "response": text})
            if not ok and not keep_going:
                log("Stopping at first failure (use --keep-going to continue).")
                break
    finally:
        if client is not None:
            client.close()
    return results


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Sync churn/streak custom attributes to Adapty profiles.")
    p.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="JSON list of users")
    p.add_argument("--apply", action="store_true", help="actually send requests (default: dry run)")
    p.add_argument("--limit", type=int, default=None, help="process only the first N users")
    p.add_argument("--delay", type=float, default=0.5, help="seconds between requests (default 0.5)")
    p.add_argument("--keep-going", action="store_true", help="don't stop at the first failed request")
    args = p.parse_args(argv)

    users = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(users, list):
        raise SystemExit("input must be a JSON list of users")

    mode = "APPLY" if args.apply else "DRY RUN (add --apply to send)"
    print(f"{mode}: {args.input}  users={len(users)} limit={args.limit}")
    results = sync_profiles(
        users, apply=args.apply, limit=args.limit, delay=args.delay, keep_going=args.keep_going
    )
    n_ok = sum(r["ok"] for r in results)
    print(f"done: {n_ok}/{len(results)} ok")
    return 0 if n_ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
