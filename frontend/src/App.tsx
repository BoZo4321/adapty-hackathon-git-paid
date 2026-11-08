import React, { useState } from "react";
import { AtRiskUser, PaywallCopy, ProductKey } from "./types/contract";
import { MobilePreview } from "./components/simulator/MobilePreview";
import RadarPanel from "./components/radar/RadarPanel";
import AtRiskSubscribers from "./components/radar/AtRiskSubscribers";
import RadarStatus from "./components/radar/RadarStatus";
import type { DataSource } from "./components/radar/types";

const SAMPLE_USERS: AtRiskUser[] = [
  {
    user_id: "u00042",
    adapty_cuid: "lumen_942195_00042",
    platform: "iOS",
    country: "US",
    acquisition_channel: "meta_ads",
    onboarding_goal: "social_content",
    ai_edits_first_day: 4,
    photos_imported: 11,
    push_opt_in: "no",
    product: "weekly",
    price_usd: 6.99,
    streak_days: 0,
    streak_best: 12,
    inactive_days: 4,
    streak_breaks: 2,
    churn_risk_score: 92,
    churn_risk_level: "high",
    risk_archetype: "weekly_price_fatigue",
    risk_reasons: [
      "High inactive days",
      "Streak broken",
    ],
    recommended_rescue_offer: "monthly_stepdown",
    recommended_product_key: "annual",
  },
  {
    user_id: "u00512",
    adapty_cuid: "lumen_942195_00512",
    platform: "iOS",
    country: "GB",
    acquisition_channel: "apple_search_ads",
    onboarding_goal: "product_photos",
    ai_edits_first_day: 3,
    photos_imported: 19,
    push_opt_in: "yes",
    product: "monthly",
    price_usd: 12.99,
    streak_days: 2,
    streak_best: 8,
    inactive_days: 2,
    streak_breaks: 1,
    churn_risk_score: 48,
    churn_risk_level: "medium",
    risk_archetype: "weekly_price_fatigue",
    risk_reasons: [
      "Streak broken",
    ],
    recommended_rescue_offer: "streak_challenge",
    recommended_product_key: "pro_annual",
  },
  {
    user_id: "u01410",
    adapty_cuid: "lumen_942195_01410",
    platform: "iOS",
    country: "US",
    acquisition_channel: "organic",
    onboarding_goal: "selfies",
    ai_edits_first_day: 6,
    photos_imported: 24,
    push_opt_in: "yes",
    product: "annual",
    price_usd: 49.99,
    streak_days: 14,
    streak_best: 14,
    inactive_days: 0,
    streak_breaks: 0,
    churn_risk_score: 12,
    churn_risk_level: "low",
    risk_archetype: "healthy_engaged",
    risk_reasons: [],
    recommended_rescue_offer: "loyalty_only",
    recommended_product_key: "annual",
  },
];

export default function App() {
  const [selectedUser, setSelectedUser] = useState<AtRiskUser>(SAMPLE_USERS[0]);
  const [copyOverride, setCopyOverride] = useState<Partial<PaywallCopy> | null>(null);
  const [selectedUpperTier] = useState<ProductKey>("annual");
  const [summarySource, setSummarySource] = useState<DataSource | null>(null);

  return (
    <div style={{ maxWidth: 1680, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: "1px solid #2b2740",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            Revenue Rescue - stop churn
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#a9a5b8" }}>
            Lumen AI Photo Editor
          </p>
          <RadarStatus usingMock={summarySource === "mock"} />
        </div>
      </header>

      {/* Top row: at-risk table (clicking a row selects the user) next to Person 4's 3-Tier iPhone Simulator */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 24, alignItems: "stretch", marginBottom: 24 }}>
        <AtRiskSubscribers
          selectedUserId={selectedUser.user_id}
          onSelectUser={(u) => {
            setSelectedUser(u);
            setCopyOverride(null);
          }}
        />
        <MobilePreview
          user={selectedUser}
          copyOverride={copyOverride}
          selectedUpperTier={selectedUpperTier}
        />
      </div>

      {/* Below, full width: Person 3's Churn Risk Radar (KPIs + charts) */}
      <RadarPanel onSourceChange={setSummarySource} />
    </div>
  );
}
