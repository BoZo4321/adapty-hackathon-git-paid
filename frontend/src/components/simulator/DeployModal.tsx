/**
 * 🔒 OWNED BY PERSON 4 — 3-Step Live Execution Stepper Modal
 * Executes (or Dry-Runs) the 3 real Adapty actions:
 * 1. PATCH https://api.adapty.io/api/v2/server-side-api/profile/ (syncs the 4 streak + churn_risk_level attributes)
 * 2. adapty segments create --app 9717a53d-de9c-4ae8-be1a-6e540e6a8098
 * 3. adapty flows create / config update (schemaVersion: 12) / publish
 */
import React, { useState } from "react";
import { ADAPTY_APP_ID, AtRiskUser, formatAdaptyCuid, PaywallCopy } from "../../types/contract";

interface Props {
  user: AtRiskUser;
  compiledFlowJson?: Record<string, unknown>;
  activeCopy?: PaywallCopy;
  onClose: () => void;
}

export const DeployModal: React.FC<Props> = ({
  user,
  compiledFlowJson,
  activeCopy,
  onClose,
}) => {
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [resultLog, setResultLog] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cuid = formatAdaptyCuid(user.user_id, user.adapty_cuid);
  const flowName = `Proactive ${user.churn_risk_level.toUpperCase()} Rescue - ${user.onboarding_goal} (${user.user_id})`;
  const segmentTitle = `Streak Rescue - ${user.onboarding_goal} (${user.churn_risk_level})`;

  const handleDeploy = async () => {
    setStatus("running");
    setErrorMessage(null);
    setResultLog(null);

    try {
      const resp = await fetch("/api/adapty/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: { ...user, adapty_cuid: cuid },
          flow_name: flowName,
          segment_title: segmentTitle,
          flow_json: compiledFlowJson,
          target_product_key: activeCopy?.target_product_key,
          copy: activeCopy,
          dry_run: dryRun,
        }),
      });

      const rawText = await resp.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!resp.ok) {
        const detail =
          (parsed && (parsed.detail || parsed.error || parsed.message)) ||
          rawText ||
          resp.statusText;
        const detailStr =
          typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
        setErrorMessage(`HTTP ${resp.status}: ${detailStr}`);
        if (parsed) {
          setResultLog(parsed);
        }
        setStatus("error");
        return;
      }

      setResultLog(parsed ?? { status: "ok", raw: rawText });
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Deploy request failed: ${msg}`);
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#171524",
          border: "1px solid #3b3358",
          borderRadius: 14,
          width: "100%",
          maxWidth: 640,
          padding: 22,
          color: "#f4f3f8",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17 }}>
            🚀 3-Step Live Adapty Execution ({cuid})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#a9a5b8",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Stepper Overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#1e1b2e",
              border: "1px solid #2d2942",
              fontSize: 12,
            }}
          >
            <strong style={{ color: "#34d399" }}>
              Step 1 — Server-Side Profile API (<code>PATCH /profile/</code>)
            </strong>
            <div style={{ color: "#cfccda", marginTop: 4 }}>
              Updates <code>{cuid}</code> with:{" "}
              <code>streak_days={Number(user.streak_days).toFixed(1)}</code>,{" "}
              <code>streak_best={Number(user.streak_best).toFixed(1)}</code>,{" "}
              <code>inactive_days={Number(user.inactive_days).toFixed(1)}</code>,{" "}
              <code>streak_breaks={Number(user.streak_breaks).toFixed(1)}</code>,{" "}
              <code>churn_risk_level="{user.churn_risk_level}"</code>.
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#1e1b2e",
              border: "1px solid #2d2942",
              fontSize: 12,
            }}
          >
            <strong style={{ color: "#c084fc" }}>
              Step 2 — Dynamic Segment CLI (<code>adapty segments create</code>)
            </strong>
            <div style={{ color: "#cfccda", marginTop: 4 }}>
              Creates segment <code>"{segmentTitle}"</code> in App{" "}
              <code>{ADAPTY_APP_ID}</code>.
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#1e1b2e",
              border: "1px solid #2d2942",
              fontSize: 12,
            }}
          >
            <strong style={{ color: "#60a5fa" }}>
              Step 3 — Flow Builder Compiler & Publish (<code>schemaVersion: 12</code>)
            </strong>
            <div style={{ color: "#cfccda", marginTop: 4 }}>
              Validates SHA-1 v5 <code>flowProductId</code> and runs{" "}
              <code>adapty flows create → config update → publish</code> for{" "}
              <code>"{flowName}"</code>.
            </div>
          </div>
        </div>

        {/* Dry Run Toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "#cfccda",
            marginBottom: 14,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry-Run Mode (preview API & CLI commands without mutating live Adapty app)
        </label>

        {errorMessage && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.14)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 14,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <strong style={{ color: "#f87171", display: "block", marginBottom: 4 }}>
              ✕ Backend Error
            </strong>
            {errorMessage}
          </div>
        )}

        {resultLog && (
          <pre
            style={{
              background: "#0d0b14",
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${status === "error" ? "#ef4444" : "#2b2740"}`,
              fontSize: 11,
              color: status === "error" ? "#fca5a5" : "#a7f3d0",
              overflowX: "auto",
              marginBottom: 14,
            }}
          >
            {JSON.stringify(resultLog, null, 2)}
          </pre>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid #352f52",
              background: "transparent",
              color: "#cfccda",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            onClick={handleDeploy}
            disabled={status === "running"}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: status === "error" ? "#dc2626" : "#6c4cf5",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {status === "running"
              ? "Executing Adapty API + CLI..."
              : status === "done"
              ? "✓ Executed (Run Again)"
              : status === "error"
              ? "⚠ Failed — Retry Deploy"
              : "Execute 3-Step Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
};
