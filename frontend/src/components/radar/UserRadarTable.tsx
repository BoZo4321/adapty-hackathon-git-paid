// 🔒 OWNED BY PERSON 3: Interactive table with streak badges & risk score pills; click a row to select the user
import { useMemo, useState } from "react";
import type { OnboardingGoal } from "../../types/contract";
import InfoTip from "./InfoTip";
import { SimTag } from "./RealVsEnrichedBadge";
import type { RadarUser, RiskTier } from "./types";
import { TIER_COLOR, TIER_LABEL, TIER_ORDER, tierOf } from "./types";

const GOALS: OnboardingGoal[] = ["travel", "product_photos", "family", "selfies", "social_content"];

const OFFER_LABEL: Record<string, string> = {
  "10pct_off_upper_tier_streak_rescue": "10% off upper tier",
  upgrade_to_higher_tier: "Upgrade to higher tier",
  none_healthy_streak: "No paywall",
};
const humanize = (s: string) => OFFER_LABEL[s] ?? s.replace(/_/g, " ");

interface Props {
  users: RadarUser[];
  selectedUserId?: string;
  onSelectUser: (u: RadarUser) => void;
}

export default function UserRadarTable({ users, selectedUserId, onSelectUser }: Props) {
  const [tier, setTier] = useState<RiskTier | "all">("all");
  const [goal, setGoal] = useState<OnboardingGoal | "all">("all");

  const rows = useMemo(
    () =>
      users
        .filter((u) => tier === "all" || tierOf(u.churn_risk_level) === tier)
        .filter((u) => goal === "all" || u.onboarding_goal === goal)
        .sort((a, b) => b.churn_risk_score - a.churn_risk_score),
    [users, tier, goal]
  );

  return (
    <div className="radar-card">
      <div className="radar-table-head">
        <h3 className="radar-table-title">
          At-risk subscribers
          <InfoTip align="left">
            Subscribers sorted by churn-risk score, highest first. Hover a row to see why they are at risk,
            click it to preview their rescue paywall on the phone.
          </InfoTip>
        </h3>
        <div className="radar-filters">
          <div className="radar-seg">
            {(["all", ...TIER_ORDER] as const).map((t) => (
              <button key={t} type="button" className={tier === t ? "active" : ""} onClick={() => setTier(t)}>
                {t === "all" ? "All" : TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <select value={goal} onChange={(e) => setGoal(e.target.value as OnboardingGoal | "all")}>
            <option value="all">All goals</option>
            {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="radar-table-wrap">
        <table className="radar-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>🔥 Streak <SimTag label="SIM" /></th>
              <th>🏆 Best <SimTag label="SIM" /></th>
              <th>⏳ Inactive <SimTag label="SIM" /></th>
              <th>💔 Breaks <SimTag label="SIM" /></th>
              <th>Risk</th>
              <th>Tier</th>
              <th>Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const t = tierOf(u.churn_risk_level);
              return (
                <tr
                  key={u.user_id}
                  className={u.user_id === selectedUserId ? "selected" : ""}
                  onClick={() => onSelectUser(u)}
                >
                  <td>
                    <div className="radar-user">{u.user_id}</div>
                    <div className="radar-user-goal">{u.onboarding_goal}</div>
                  </td>
                  <td><code>{u.product}</code></td>
                  <td><span className={u.streak_days > 0 ? "radar-streak-on" : "radar-streak-off"}>{u.streak_days}</span></td>
                  <td>{u.streak_best}</td>
                  <td>{u.inactive_days >= 3 ? <span className="radar-pill radar-pill-red">{u.inactive_days}</span> : u.inactive_days}</td>
                  <td>{u.streak_breaks}</td>
                  <td className="radar-risk-cell">
                    <span className="radar-pill" style={{ background: `${TIER_COLOR[t]}26`, color: TIER_COLOR[t], borderColor: TIER_COLOR[t] }}>
                      {u.churn_risk_score}
                    </span>
                    {u.risk_reasons.length > 0 && (
                      <div className="radar-drivers">
                        <div className="radar-drivers-title">Risk drivers</div>
                        <ul>{u.risk_reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                    )}
                  </td>
                  <td><span style={{ color: TIER_COLOR[t], fontWeight: 700 }}>{TIER_LABEL[t]}</span></td>
                  <td className="radar-action">{humanize(u.recommended_rescue_offer)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="radar-empty">No users match these filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
