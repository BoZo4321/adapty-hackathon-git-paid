/**
 * 🔒 OWNED BY PERSON 4 — Interactive iPhone Frame with 3 Risk Tabs:
 * - 🟢 Low Risk: No Paywall (In-App Active Streak Celebration inside Lumen)
 * - 🟡 Mid Risk: Upgrade to Higher Tier (Locks in commitment on Annual / Pro Annual AI Studio)
 * - 🔴 High / Critical Risk: 10% Rescue Discount on any Upper Tier (Streak Recovery Paywall)
 * Also includes a live `schemaVersion: 12` JSON inspector toggle.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  AtRiskUser,
  LIVE_ADAPTY_PRODUCTS,
  OnboardingGoal,
  PaywallCopy,
  ProductKey,
} from "../../types/contract";

export type SimulatorTierTab = "low" | "mid" | "high";

interface Props {
  user: AtRiskUser;
  copyOverride?: Partial<PaywallCopy> | null;
  selectedUpperTier?: ProductKey;
}

const GOAL_DISPLAY: Record<OnboardingGoal, { name: string; emoji: string; samplePrompt: string }> = {
  social_content: {
    name: "Social Content",
    emoji: "📱",
    samplePrompt: "Neon cyber-glow reel cover • 4K HDR export",
  },
  selfies: {
    name: "Selfies & Portraits",
    emoji: "🤳",
    samplePrompt: "Studio softbox skin retouch + golden hour lens",
  },
  product_photos: {
    name: "Product Photos",
    emoji: "🛍️",
    samplePrompt: "Marble podium shadow + instant background removal",
  },
  travel: {
    name: "Travel Memories",
    emoji: "✈️",
    samplePrompt: "Sunset sky replacement + crowd eraser",
  },
  family: {
    name: "Family Moments",
    emoji: "👨‍👩‍👧",
    samplePrompt: "Warm vintage film grain + 4x face unblur",
  },
};

export function buildTierPaywallCopy(
  user: AtRiskUser,
  tierTab: SimulatorTierTab,
  upperTierKey: ProductKey = "annual",
  override?: Partial<PaywallCopy> | null
): PaywallCopy {
  const goal = GOAL_DISPLAY[user.onboarding_goal] || GOAL_DISPLAY.social_content;
  const prod = LIVE_ADAPTY_PRODUCTS[upperTierKey] || LIVE_ADAPTY_PRODUCTS.annual;

  if (tierTab === "mid") {
    // 🟡 Mid Risk: Upgrade to Higher Tier (Annual or Pro Annual AI Studio)
    const upgradeKey: ProductKey =
      user.product === "annual" ? "pro_annual" : upperTierKey === "weekly" ? "annual" : upperTierKey;
    const upProd = LIVE_ADAPTY_PRODUCTS[upgradeKey];

    return {
      headline:
        override?.headline ||
        `Take your ${user.streak_best}-day ${goal.name} streak to Pro`,
      subtitle:
        override?.subtitle ||
        `You've imported ${user.photos_imported} photos! Upgrade from ${user.product} to ${upProd.title} for priority AI batch rendering.`,
      badge_text: "🟡 MID RISK • TIER UPGRADE",
      features: [
        {
          icon: "✨",
          title: `Unlimited ${goal.name} AI Batch Edits`,
          subtitle: "Process up to 50 photos at once with zero queue",
        },
        {
          icon: "🎨",
          title: "Pro AI Studio Presets",
          subtitle: `New weekly packs tailored for ${goal.name.toLowerCase()}`,
        },
        {
          icon: "🔒",
          title: "Streak Freeze Protection Included",
          subtitle: `Never lose your ${user.streak_best}-day record if you miss a day`,
        },
      ],
      plan_title: upProd.title,
      plan_price_display: `$${upProd.priceUsd.toFixed(2)} ${upProd.periodLabel}`,
      plan_subtext: "Full access • Cancel anytime in 1 tap",
      cta_text: override?.cta_text || `Upgrade to ${upProd.title}`,
      target_product_key: upgradeKey,
      target_product_uuid: upProd.uuid,
      flow_product_id: upProd.flowProductId,
    };
  }

  // 🔴 High / Critical Risk: 10% Discount on Any Upper Tier (Streak Rescue)
  const rescueKey: ProductKey =
    upperTierKey === "weekly" ? "monthly" : upperTierKey;
  const rescueProd = LIVE_ADAPTY_PRODUCTS[rescueKey];
  const discountedPrice = (rescueProd.priceUsd * 0.9).toFixed(2);

  return {
    headline:
      override?.headline ||
      `Don't lose your ${user.streak_best}-day ${goal.name} streak!`,
    subtitle:
      override?.subtitle ||
      `You've been inactive for ${user.inactive_days} days (${user.streak_breaks} streak breaks). Restore your streak now with 10% OFF ${rescueProd.title}.`,
    badge_text: "🔴 HIGH RISK • 10% OFF UPPER TIER RESCUE",
    features: [
      {
        icon: "🔥",
        title: `Instant ${user.streak_best}-Day Streak Restoration`,
        subtitle: `Pick up right where you left off in ${goal.name}`,
      },
      {
        icon: "💸",
        title: `10% OFF ${rescueProd.title}`,
        subtitle: `Drop from $${rescueProd.priceUsd} down to $${discountedPrice} ${rescueProd.periodLabel}`,
      },
      {
        icon: "🖼️",
        title: "Full 4K Export • Zero Watermark",
        subtitle: "Keep all your saved presets and edits unlocked",
      },
    ],
    plan_title: `${rescueProd.title} (10% Rescue Offer)`,
    plan_price_display: `$${discountedPrice} ${rescueProd.periodLabel}`,
    plan_original_price: `$${rescueProd.priceUsd.toFixed(2)}`,
    plan_subtext: "10% streak recovery discount applied • Cancel anytime",
    cta_text: override?.cta_text || `Claim 10% Off & Restore ${user.streak_best}d Streak`,
    target_product_key: rescueKey,
    target_product_uuid: rescueProd.uuid,
    flow_product_id: rescueProd.flowProductId,
  };
}

export function buildSchemaV12PreviewJson(copy: PaywallCopy): Record<string, unknown> {
  return {
    schemaVersion: 12,
    defaultLocale: "en",
    _meta: {
      screens: {
        scr_paywall: {
          products: [
            {
              id: copy.target_product_uuid,
              flowProductId: copy.flow_product_id,
            },
          ],
        },
      },
    },
    screens: [
      {
        id: "scr_paywall",
        caption: "Paywall",
        products: [{ id: copy.target_product_uuid }],
        elements: {
          map: {
            el_400T: {
              id: "el_400T",
              type: "text",
              font: { preset: "h1" },
              text_en: copy.headline,
            },
            el_401T: {
              id: "el_401T",
              type: "text",
              font: { preset: "body" },
              text_en: copy.subtitle,
            },
            el_420P: {
              id: "el_420P",
              type: "product",
              product: { id: copy.target_product_uuid },
              plan_title_el_422T: copy.plan_title,
            },
            el_429T: {
              id: "el_429T",
              type: "text",
              caption: "CTA label",
              text_en: copy.cta_text,
            },
          },
        },
      },
    ],
  };
}

export const MobilePreview: React.FC<Props> = ({
  user,
  copyOverride,
  selectedUpperTier = "annual",
}) => {
  const [activeTab, setActiveTab] = useState<SimulatorTierTab>("high");
  const [showJson, setShowJson] = useState<boolean>(false);

  // Auto-switch the iPhone tab whenever the selected user's risk level changes
  useEffect(() => {
    if (user.churn_risk_level === "low") {
      setActiveTab("low");
    } else if (user.churn_risk_level === "medium") {
      setActiveTab("mid");
    } else {
      setActiveTab("high");
    }
  }, [user.user_id, user.churn_risk_level]);

  const activeCopy = useMemo(
    () => buildTierPaywallCopy(user, activeTab, selectedUpperTier, copyOverride),
    [user, activeTab, selectedUpperTier, copyOverride]
  );

  const compiledJson = useMemo(() => buildSchemaV12PreviewJson(activeCopy), [activeCopy]);
  const goal = GOAL_DISPLAY[user.onboarding_goal] || GOAL_DISPLAY.social_content;

  return (
    <section
      style={{
        background: "#171524",
        border: "1px solid #2b2740",
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
      }}
    >
      {/* Top Header + JSON Inspector Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 15, color: "#fff" }}>
            Live iPhone Flow Simulator ({user.user_id})
          </h3>
          <div style={{ fontSize: 11, color: "#8e8a9f", marginTop: 2 }}>
            Adapty Flow Builder <code>schemaVersion: 12</code> • SHA-1 v5{" "}
            <code>flowProductId</code> verified
          </div>
        </div>

        <button
          onClick={() => setShowJson((prev) => !prev)}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid #352f52",
            background: showJson ? "#6c4cf5" : "#1e1b2e",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showJson ? "📱 Show iPhone UI" : "{ } Inspect schemaVersion: 12 JSON"}
        </button>
      </div>

      {/* 3 Risk State Switcher Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          background: "#110f1b",
          padding: 5,
          borderRadius: 10,
          marginBottom: 16,
          border: "1px solid #252238",
        }}
      >
        {[
          {
            id: "low" as SimulatorTierTab,
            label: "🟢 Low Risk",
            sub: "No Paywall",
            activeBg: "rgba(16, 185, 129, 0.2)",
            border: "#10b981",
          },
          {
            id: "mid" as SimulatorTierTab,
            label: "🟡 Mid Risk",
            sub: "Upgrade Tier",
            activeBg: "rgba(245, 158, 11, 0.2)",
            border: "#f59e0b",
          },
          {
            id: "high" as SimulatorTierTab,
            label: "🔴 High Risk",
            sub: "10% Off Upper Tier",
            activeBg: "rgba(239, 68, 68, 0.22)",
            border: "#ef4444",
          },
        ].map((tab) => {
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "7px 8px",
                borderRadius: 8,
                border: isCurrent ? `1px solid ${tab.border}` : "1px solid transparent",
                background: isCurrent ? tab.activeBg : "transparent",
                color: "#fff",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{tab.label}</div>
              <div style={{ fontSize: 10, color: "#cfccda" }}>{tab.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Main View: Either JSON Inspector or iPhone 15 Frame */}
      {showJson ? (
        <div
          style={{
            background: "#0d0b14",
            border: "1px solid #2b2740",
            borderRadius: 12,
            padding: 14,
            maxHeight: 490,
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: 11,
            color: "#a7f3d0",
          }}
        >
          <div style={{ color: "#c084fc", marginBottom: 8, fontWeight: 700 }}>
            // Compiled Flow Builder Config (Ready for `adapty flows config update`)
          </div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(compiledJson, null, 2)}
          </pre>
        </div>
      ) : (
        /* iPhone Frame */
        <div
          style={{
            width: 320,
            margin: "0 auto",
            borderRadius: 36,
            padding: 10,
            background: "#0b0a10",
            border: "3px solid #352f52",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
          }}
        >
          {/* Inner iPhone Screen */}
          <div
            style={{
              borderRadius: 28,
              background: activeTab === "low" ? "#14121c" : "#ffffff",
              color: activeTab === "low" ? "#ffffff" : "#14121c",
              minHeight: 490,
              padding: "14px 18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Dynamic Island Notch */}
            <div
              style={{
                width: 86,
                height: 18,
                borderRadius: 999,
                background: "#000",
                margin: "0 auto 12px",
              }}
            />

            {activeTab === "low" ? (
              /* 🟢 LOW RISK SCREEN: NO PAYWALL — Healthy Active Lumen Editor */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11,
                    color: "#a9a5b8",
                  }}
                >
                  <span>
                    <strong>Lumen Studio</strong> • {goal.emoji} {goal.name}
                  </span>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    🔥 {Math.max(user.streak_days, 7)}d Streak
                  </span>
                </div>

                {/* Simulated Photo Canvas inside Lumen */}
                <div
                  style={{
                    height: 190,
                    borderRadius: 16,
                    background:
                      "linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 38, marginBottom: 6 }}>{goal.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {goal.samplePrompt}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    AI Enhancement Complete • No Watermark
                  </div>
                </div>

                {/* Streak Status Card */}
                <div
                  style={{
                    background: "#1f1c2e",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#34d399",
                      marginBottom: 4,
                    }}
                  >
                    🟢 Low Churn Risk ({user.churn_risk_score}/100) — No Paywall Shown
                  </div>
                  <div style={{ fontSize: 11, color: "#cfccda", lineHeight: 1.4 }}>
                    Subscriber is actively editing (<code>streak_days: {user.streak_days}</code>,{" "}
                    <code>inactive_days: {user.inactive_days}</code>). Engine suppresses win-back
                    interruptions to protect user experience & full-price LTV.
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#24212f",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#a9a5b8",
                  }}
                >
                  ✓ Active Plan: {user.product} (${user.price_usd})
                </div>
              </div>
            ) : (
              /* 🟡 MID RISK OR 🔴 HIGH RISK SCREEN: ADAPTY FLOW BUILDER PAYWALL (winback.json) */
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Top Close 'X' button (el_397S) + Risk Pill */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: activeTab === "high" ? "#fee2e2" : "#fef3c7",
                      color: activeTab === "high" ? "#dc2626" : "#d97706",
                    }}
                  >
                    {activeCopy.badge_text}
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "1px solid #e4e2ec",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#333",
                    }}
                    title="el_397S (closeFlow)"
                  >
                    ✕
                  </div>
                </div>

                {/* Streak Telemetry Pill inside Paywall */}
                <div
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    fontSize: 10,
                    background: "#f4f3f8",
                    color: "#3d3950",
                    padding: "4px 8px",
                    borderRadius: 6,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  <span>🔥 Peak: {user.streak_best}d</span>
                  <span>•</span>
                  <span>⏳ Idle: {user.inactive_days}d</span>
                  <span>•</span>
                  <span>💔 Breaks: {user.streak_breaks}</span>
                </div>

                {/* el_400T: Headline (h1) */}
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#14121c",
                    lineHeight: 1.2,
                  }}
                >
                  {activeCopy.headline}
                </h2>

                {/* el_401T: Subtitle (body) */}
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 12,
                    color: "#7d7990",
                    lineHeight: 1.4,
                  }}
                >
                  {activeCopy.subtitle}
                </p>

                {/* el_403S: 3 Feature Rows */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {activeCopy.features.map((feat, idx) => (
                    <div
                      key={idx}
                      style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: "rgba(108, 76, 245, 0.12)",
                          color: "#6c4cf5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {feat.icon}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#24212f",
                          }}
                        >
                          {feat.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#7d7990" }}>
                          {feat.subtitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* el_420P: Selected Product Card */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "2px solid #24212f",
                    background: "#f4f3f8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#14121c",
                      }}
                    >
                      {activeCopy.plan_title}
                    </div>
                    <div style={{ fontSize: 11, color: "#3d3950", marginTop: 2 }}>
                      {activeCopy.plan_original_price && (
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#ef4444",
                            marginRight: 6,
                            fontWeight: 600,
                          }}
                        >
                          {activeCopy.plan_original_price}
                        </span>
                      )}
                      <strong style={{ color: "#6c4cf5" }}>
                        {activeCopy.plan_price_display}
                      </strong>
                    </div>
                    <div style={{ fontSize: 10, color: "#7d7990", marginTop: 2 }}>
                      {activeCopy.plan_subtext}
                    </div>
                  </div>

                  {/* Selected Radio Dot (el_424S) */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "2px solid #24212f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#24212f",
                      }}
                    />
                  </div>
                </div>

                {/* el_428S + el_429T: CTA Purchase Button (visual only, no action in the preview) */}
                <button
                  type="button"
                  tabIndex={-1}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 12,
                    background: "#6c4cf5",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "default",
                    marginTop: "auto",
                  }}
                >
                  {activeCopy.cta_text}
                </button>

                {/* el_430S: Footer Links (Terms • Restore • Privacy) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px 0",
                    fontSize: 10,
                    color: "#7d7990",
                  }}
                >
                  <span>Terms</span>
                  <span>Restore</span>
                  <span>Privacy</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
