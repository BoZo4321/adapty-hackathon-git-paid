/**
 * 🔒 OWNED BY PERSON 4 — AI Paywall Copy & Live 4-Streak Simulator Controls
 * Lets you tweak the 4 daily streak variables (streak_days, streak_best, inactive_days, streak_breaks)
 * or upper-tier product selection and watch the iPhone simulator switch between Low / Mid / High risk!
 */
import React from "react";
import { AtRiskUser, PaywallCopy, ProductKey } from "../../types/contract";

interface Props {
  user: AtRiskUser;
  onUpdateUser: (updated: AtRiskUser) => void;
  copyOverride?: Partial<PaywallCopy> | null;
  onUpdateCopyOverride?: (override: Partial<PaywallCopy> | null) => void;
  selectedUpperTier?: ProductKey;
  onSelectUpperTier?: (tier: ProductKey) => void;
}

function recalculateRiskFromStreaks(u: AtRiskUser): AtRiskUser {
  let score = 20;
  const reasons: string[] = [];

  if (u.streak_days === 0 && u.inactive_days >= 3) {
    score += 40;
    reasons.push(`Broken ${u.streak_best}d streak + ${u.inactive_days}d inactive`);
  } else if (u.inactive_days >= 2) {
    score += 22;
    reasons.push(`${u.inactive_days} days inactive (slowing momentum)`);
  }

  score += Math.min(24, u.streak_breaks * 8);
  if (u.product === "weekly") {
    score += 12;
  }
  if (u.streak_days >= 7 && u.inactive_days === 0) {
    score = 12;
    reasons.length = 0;
    reasons.push(`Active ${u.streak_days}-day streak • Healthy retention`);
  }

  const bounded = Math.max(5, Math.min(99, score));
  const level: AtRiskUser["churn_risk_level"] =
    bounded >= 75 ? "critical" : bounded >= 60 ? "high" : bounded >= 35 ? "medium" : "low";

  return {
    ...u,
    churn_risk_score: bounded,
    churn_risk_level: level,
    risk_reasons: reasons.length ? reasons : u.risk_reasons,
  };
}

export const CopyEditor: React.FC<Props> = ({
  user,
  onUpdateUser,
  copyOverride,
  onUpdateCopyOverride,
  selectedUpperTier = "annual",
  onSelectUpperTier,
}) => {
  const handleStreakChange = (
    field: "streak_days" | "streak_best" | "inactive_days" | "streak_breaks",
    val: number
  ) => {
    const next = { ...user, [field]: val };
    if (field === "streak_days" && val > 0) {
      next.inactive_days = 0;
      if (val > next.streak_best) next.streak_best = val;
    }
    onUpdateUser(recalculateRiskFromStreaks(next));
  };

  return (
    <section
      style={{
        background: "#171524",
        border: "1px solid #2b2740",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: "#fff" }}>
          Interactive Streak & Paywall Copy Controls
        </h3>
        <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 700 }}>
          Risk Score: {user.churn_risk_score}/100 ({user.churn_risk_level.toUpperCase()})
        </span>
      </div>

      {/* 4 Daily Streak Sliders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          background: "#1e1b2e",
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <code>streak_days</code>
            <strong>{user.streak_days}d</strong>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            value={user.streak_days}
            onChange={(e) => handleStreakChange("streak_days", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#10b981" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <code>streak_best</code>
            <strong>{user.streak_best}d</strong>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={user.streak_best}
            onChange={(e) => handleStreakChange("streak_best", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#a855f7" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <code>inactive_days</code>
            <strong>{user.inactive_days}d</strong>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            value={user.inactive_days}
            onChange={(e) => handleStreakChange("inactive_days", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#f59e0b" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <code>streak_breaks</code>
            <strong>{user.streak_breaks}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={6}
            value={user.streak_breaks}
            onChange={(e) => handleStreakChange("streak_breaks", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ef4444" }}
          />
        </div>
      </div>

      {/* Target Upper-Tier Product Selector + Copy Override */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "#a9a5b8" }}>
            Target Upper-Tier Catalog Product:
          </label>
          <select
            value={selectedUpperTier}
            onChange={(e) => onSelectUpperTier?.(e.target.value as ProductKey)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              background: "#1e1b2e",
              border: "1px solid #352f52",
              color: "#fff",
              fontSize: 11,
            }}
          >
            <option value="monthly">lumen.monthly ($12.99/mo)</option>
            <option value="annual">lumen.annual ($49.99/yr)</option>
            <option value="pro_annual">lumen.pro_annual ($89.99/yr AI Studio)</option>
            <option value="lifetime">lumen.lifetime ($99.99)</option>
          </select>
        </div>

        {onUpdateCopyOverride && (
          <input
            type="text"
            placeholder="Optional custom headline override (el_400T)..."
            value={copyOverride?.headline || ""}
            onChange={(e) =>
              onUpdateCopyOverride({
                ...(copyOverride || {}),
                headline: e.target.value || undefined,
              })
            }
            style={{
              padding: "7px 10px",
              borderRadius: 6,
              background: "#1e1b2e",
              border: "1px solid #352f52",
              color: "#fff",
              fontSize: 12,
            }}
          />
        )}
      </div>
    </section>
  );
};
