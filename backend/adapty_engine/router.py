"""Adapty deploy endpoint used by the frontend DeployModal.

Segments, flows and the placement already exist in Adapty, so deploy only syncs ONE user's
churn/streak custom attributes (via profile_sync) and reports which segment/flow/placement
that user now falls into. flow_json, flow_name, segment_title and adapty_cuid from the
frontend are accepted but ignored.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from backend.adapty_engine.profile_sync import UserError, build_request, sync_profiles

router = APIRouter()

PLACEMENT = {"id": "7df9b0a3-e070-4e73-b643-ca9339995300", "developer_id": "streak_retention"}

TARGETS_BY_LEVEL: dict[str, dict[str, Any] | None] = {
    "low": None,
    "medium": {
        "segment": {"id": "5fe66529-d3be-4e24-ad45-b1ce3567446f", "title": "Churn risk: medium"},
        "flow": {"id": "533a36d2-5a0e-494d-9433-a4f08020b1f2", "name": "Churn medium - Streak upsell"},
        "placement": PLACEMENT,
    },
    "high": {
        "segment": {"id": "d64118e7-d384-424a-9fac-5abce6afecd9", "title": "Churn risk: high"},
        "flow": {"id": "f14fe0a9-67ac-445a-b0dd-cbf4ba785bf7", "name": "Churn high - Streak rescue"},
        "placement": PLACEMENT,
    },
}
LOW_RISK_NOTE = "low risk: app does not open the placement"

SYNC_FIELDS = ("user_id", "churn_risk_score", "streak_days", "streak_best", "inactive_days", "streak_breaks")


class DeployRequest(BaseModel):
    """Body sent by DeployModal.tsx. Unknown extra fields are accepted."""
    model_config = ConfigDict(extra="allow")

    user: dict[str, Any]
    flow_name: str | None = None      # ignored
    segment_title: str | None = None  # ignored
    flow_json: Any = None             # ignored: frontend preview is not a valid Adapty config
    dry_run: bool = True              # safe default if the field is missing


def to_sync_input(user: dict[str, Any]) -> dict[str, Any]:
    """Map an AtRiskUser (contract.ts) to profile_sync input. Drops adapty_cuid and everything else."""
    return {k: user[k] for k in SYNC_FIELDS if k in user}


@router.post("/api/adapty/deploy", tags=["Adapty"])
def deploy(req: DeployRequest) -> dict[str, Any]:
    sync_input = to_sync_input(req.user)
    try:
        customer_user_id, body = build_request(sync_input)  # validates; cuid derived from user_id
    except UserError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    attributes = body["custom_attributes"]
    values = {a["key"]: a["value"] for a in attributes}
    level = values["churn_risk_level"]

    try:
        result = sync_profiles([sync_input], apply=not req.dry_run, delay=0, verbose=False)[0]
    except SystemExit as e:  # profile_sync exits if ADAPTY_SECRET_KEY is missing (live mode only)
        raise HTTPException(status_code=500, detail=str(e)) from None

    if req.dry_run:
        adapty = {"sent": False, "status": None}
    else:
        adapty = {"sent": True, "status": result.get("status")}
        if not result.get("ok"):
            # result["response"] is already secret-redacted by profile_sync
            raise HTTPException(status_code=502, detail={
                "message": "Adapty profile update failed",
                "adapty_status": result.get("status"),
                "adapty_error": result.get("response") or result.get("error"),
            })

    targets = TARGETS_BY_LEVEL[level]
    return {
        "mode": "dry_run" if req.dry_run else "live",
        "customer_user_id": customer_user_id,
        "churn_risk_score": values["churn_risk"],
        "churn_risk_level": level,
        "attributes": attributes,
        "adapty": adapty,
        "targets": targets,
        "note": LOW_RISK_NOTE if targets is None else None,
    }
