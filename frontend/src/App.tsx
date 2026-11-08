import React, { useState } from "react";
import { AtRiskUser, PaywallCopy, ProductKey } from "./types/contract";
import { MobilePreview } from "./components/simulator/MobilePreview";
import { CopyEditor } from "./components/simulator/CopyEditor";
import { DeployModal } from "./components/simulator/DeployModal";
import RadarPanel from "./components/radar/RadarPanel";

const SAMPLE_USERS: AtRiskUser[] = [
  {
    user_id: "u00042",
    adapty_cuid: "lumen_live_00042",
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
    churn_risk_level: "critical",
    risk_archetype: "weekly_price_fatigue",
    risk_reasons: [
      "Paying $6.99/wk (~$28/mo price fatigue)",
      "12-day Social Content streak broken twice",
      "4 days inactive + push_opt_in=no",
    ],
    recommended_rescue_offer: "10pct_off_upper_tier_streak_rescue",
    recommended_product_key: "annual",
  },
  {
    user_id: "u00512",
    adapty_cuid: "lumen_live_00512",
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
      "Slowing momentum (2 days idle after 8-day streak)",
      "Good candidate for Annual / Pro Studio tier upgrade",
    ],
    recommended_rescue_offer: "upgrade_to_higher_tier",
    recommended_product_key: "pro_annual",
  },
  {
    user_id: "u01410",
    adapty_cuid: "lumen_live_01410",
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
    risk_reasons: ["Active 14-day unbeaten streak • No paywall needed"],
    recommended_rescue_offer: "none_healthy_streak",
    recommended_product_key: "annual",
  },
];

export default function App() {
  const [selectedUser, setSelectedUser] = useState<AtRiskUser>(SAMPLE_USERS[0]);
  const [copyOverride, setCopyOverride] = useState<Partial<PaywallCopy> | null>(null);
  const [selectedUpperTier, setSelectedUpperTier] = useState<ProductKey>("annual");
  const [deployData, setDeployData] = useState<{
    flowJson: Record<string, unknown>;
    copy: PaywallCopy;
  } | null>(null);

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
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 24, alignItems: "start" }}>
        {/* Left Column: Person 3's Churn Risk Radar (clicking a table row selects the user) */}
        <RadarPanel
          selectedUserId={selectedUser.user_id}
          onSelectUser={(u) => {
            setSelectedUser(u);
            setCopyOverride(null);
          }}
        />

        {/* Right Column: Person 4's 3-Tier iPhone Simulator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CopyEditor
            user={selectedUser}
            onUpdateUser={setSelectedUser}
            copyOverride={copyOverride}
            onUpdateCopyOverride={setCopyOverride}
            selectedUpperTier={selectedUpperTier}
            onSelectUpperTier={setSelectedUpperTier}
          />
          <MobilePreview
            user={selectedUser}
            copyOverride={copyOverride}
            selectedUpperTier={selectedUpperTier}
            onOpenDeploy={(flowJson, copy) => setDeployData({ flowJson, copy })}
          />
        </div>
      </div>

      {deployData && (
        <DeployModal
          user={selectedUser}
          compiledFlowJson={deployData.flowJson}
          activeCopy={deployData.copy}
          onClose={() => setDeployData(null)}
        />
      )}
    </div>
  );
}
