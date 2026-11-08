/**
 * Shared frozen TypeScript contract mirroring contracts/api_schema.json
 * across Person 1 (Risk Engine), Person 2 (Adapty Compiler),
 * Person 3 (Radar Dashboard), and Person 4 (Mobile Paywall Simulator).
 */

export type OnboardingGoal =
  | "product_photos"
  | "selfies"
  | "social_content"
  | "travel"
  | "family";

export type AcquisitionChannel =
  | "organic"
  | "meta_ads"
  | "google_uac"
  | "tiktok_ads"
  | "apple_search_ads";

export type ProductKey =
  | "weekly"
  | "monthly"
  | "annual"
  | "annual_trial"
  | "pro_annual"
  | "lifetime";

export type ChurnRiskLevel = "high" | "medium" | "low";

export const ADAPTY_APP_ID =
  (import.meta.env?.VITE_ADAPTY_APP_ID as string) ||
  "9717a53d-de9c-4ae8-be1a-6e540e6a8098";

export const ADAPTY_CUSTOMER_PREFIX = "lumen_942195_";

export function formatAdaptyCuid(userId: string, existingCuid?: string): string {
  if (existingCuid && existingCuid.startsWith(ADAPTY_CUSTOMER_PREFIX)) {
    return existingCuid;
  }
  const digits = String(userId || "00000").replace(/^u/i, "");
  return `${ADAPTY_CUSTOMER_PREFIX}${digits.padStart(5, "0")}`;
}

export type RiskArchetype =
  | "weekly_price_fatigue"
  | "tiktok_impulse_refund_bomb"
  | "silent_trial_dropout"
  | "healthy_engaged";

export interface AtRiskUser {
  user_id: string;
  adapty_cuid: string;
  platform: "iOS" | "Android";
  country: string;
  acquisition_channel: AcquisitionChannel;
  onboarding_goal: OnboardingGoal;
  ai_edits_first_day: number;
  photos_imported: number;
  push_opt_in: "yes" | "no";
  product: ProductKey;
  price_usd: number;

  // Exact 4 Daily Activity Streak variables (Enriched)
  streak_days: number;
  streak_best: number;
  inactive_days: number;
  streak_breaks: number;

  // Multi-signal risk outputs
  churn_risk_score: number;
  churn_risk_level: ChurnRiskLevel;
  risk_archetype: RiskArchetype;
  risk_reasons: string[];
  recommended_rescue_offer: string;
  recommended_product_key: ProductKey;
}

export interface PaywallCopy {
  headline: string;
  subtitle: string;
  badge_text: string;
  features: { icon: string; title: string; subtitle: string }[];
  plan_title: string;
  plan_price_display: string;
  plan_original_price?: string;
  plan_subtext: string;
  cta_text: string;
  target_product_key: ProductKey;
  target_product_uuid: string;
  flow_product_id: string;
}

export interface AnalyticsSummary {
  total_subscribers: number;
  active_subscribers: number;
  high_risk_subscribers: number;
  mid_risk_subscribers: number;
  low_risk_subscribers: number;
  revenue_at_risk_usd: number;
  archetype_counts: {
    weekly_price_fatigue: number;
    tiktok_impulse_refund_bomb: number;
    silent_trial_dropout: number;
  };
  streak_decay_curve: {
    inactive_days: string;
    avg_churn_risk_score: number;
    users_count: number;
    in_golden_window?: boolean;
  }[];
}

// Canonical Adapty Flow Builder template product UUIDs (`adapty-hackathon/lumen/product/<key>`)
// mapped by Person 2's backend compiler to live App 9717a53d-de9c-4ae8-be1a-6e540e6a8098
export const LIVE_ADAPTY_PRODUCTS: Record<
  ProductKey,
  { uuid: string; title: string; priceUsd: number; periodLabel: string; flowProductId: string }
> = {
  weekly: {
    uuid: "09b35529-8573-5d62-8c20-b847f2e70e36",
    title: "Premium Weekly (3-day trial)",
    priceUsd: 6.99,
    periodLabel: "/ week",
    flowProductId: "ecddfd5b-a3de-5089-b462-2a0ea780dde4",
  },
  monthly: {
    uuid: "4876f9ea-4d63-58ef-a66c-a1e4f746aac5",
    title: "Premium Monthly",
    priceUsd: 12.99,
    periodLabel: "/ month",
    flowProductId: "517bc7af-8ef0-54dc-8445-9d6384073731",
  },
  annual: {
    uuid: "18755bbe-50ec-5f20-84b2-e68178485d9d",
    title: "Premium Annual",
    priceUsd: 49.99,
    periodLabel: "/ year",
    flowProductId: "4505773a-000e-557d-8a8a-8990ab599eca",
  },
  annual_trial: {
    uuid: "ef2c376e-fe61-5d27-8bfc-1e0c5978bff7",
    title: "Premium Annual (7-day trial)",
    priceUsd: 49.99,
    periodLabel: "/ year",
    flowProductId: "20a15e70-b6bf-5ab3-bdc4-daabeba71119",
  },
  pro_annual: {
    uuid: "11870fdd-9668-5395-a1f6-829195deb5f7",
    title: "Pro Annual - AI Studio",
    priceUsd: 89.99,
    periodLabel: "/ year",
    flowProductId: "6eea1768-ef41-56f7-b3bc-9c49876730d3",
  },
  lifetime: {
    uuid: "59bff13b-6eb6-5d72-9104-8273672e172f",
    title: "Premium Lifetime",
    priceUsd: 99.99,
    periodLabel: "one-time",
    flowProductId: "c5b2fd53-ba2d-529f-bc76-b079152541c9",
  },
};

export const FALLBACK_SUMMARY: AnalyticsSummary = {
  total_subscribers: 14304,
  active_subscribers: 6692,
  high_risk_subscribers: 1420,
  mid_risk_subscribers: 1850,
  low_risk_subscribers: 3422,
  revenue_at_risk_usd: 18445,
  archetype_counts: {
    weekly_price_fatigue: 640,
    tiktok_impulse_refund_bomb: 395,
    silent_trial_dropout: 385,
  },
  streak_decay_curve: [
    { inactive_days: "0d", avg_churn_risk_score: 12, users_count: 3422 },
    { inactive_days: "1d", avg_churn_risk_score: 38, users_count: 1120 },
    { inactive_days: "2d", avg_churn_risk_score: 54, users_count: 730, in_golden_window: true },
    { inactive_days: "3d", avg_churn_risk_score: 78, users_count: 610, in_golden_window: true },
    { inactive_days: "4d", avg_churn_risk_score: 89, users_count: 490, in_golden_window: true },
    { inactive_days: "5d+", avg_churn_risk_score: 95, users_count: 320 },
  ],
};

export const FALLBACK_USERS: AtRiskUser[] = [
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
      "Paying $6.99/wk (~$28/mo price fatigue)",
      "12-day peak Social Content streak broken twice",
      "4 days inactive + push_opt_in=no",
    ],
    recommended_rescue_offer: "monthly_stepdown",
    recommended_product_key: "annual",
  },
  {
    user_id: "u00108",
    adapty_cuid: "lumen_942195_00108",
    platform: "iOS",
    country: "GB",
    acquisition_channel: "tiktok_ads",
    onboarding_goal: "selfies",
    ai_edits_first_day: 1,
    photos_imported: 2,
    push_opt_in: "no",
    product: "weekly",
    price_usd: 6.99,
    streak_days: 0,
    streak_best: 3,
    inactive_days: 3,
    streak_breaks: 2,
    churn_risk_score: 95,
    churn_risk_level: "high",
    risk_archetype: "tiktok_impulse_refund_bomb",
    risk_reasons: [
      "TikTok Weekly impulse cohort (28.6% refund rate)",
      "Only 1 AI edit on Day 1 + 3 days inactive",
    ],
    recommended_rescue_offer: "monthly_stepdown",
    recommended_product_key: "monthly",
  },
  {
    user_id: "u00215",
    adapty_cuid: "lumen_942195_00215",
    platform: "Android",
    country: "DE",
    acquisition_channel: "google_uac",
    onboarding_goal: "product_photos",
    ai_edits_first_day: 0,
    photos_imported: 1,
    push_opt_in: "no",
    product: "annual_trial",
    price_usd: 49.99,
    streak_days: 0,
    streak_best: 1,
    inactive_days: 5,
    streak_breaks: 1,
    churn_risk_score: 88,
    churn_risk_level: "high",
    risk_archetype: "silent_trial_dropout",
    risk_reasons: [
      "Annual 7-day trial + push_opt_in=no (68.5% trial cancel rate)",
      "0 AI edits on Day 1 + 5 days inactive mid-trial",
    ],
    recommended_rescue_offer: "monthly_stepdown",
    recommended_product_key: "monthly",
  },
  {
    user_id: "u00390",
    adapty_cuid: "lumen_942195_00390",
    platform: "iOS",
    country: "CA",
    acquisition_channel: "apple_search_ads",
    onboarding_goal: "travel",
    ai_edits_first_day: 5,
    photos_imported: 18,
    push_opt_in: "no",
    product: "weekly",
    price_usd: 6.99,
    streak_days: 0,
    streak_best: 9,
    inactive_days: 3,
    streak_breaks: 2,
    churn_risk_score: 79,
    churn_risk_level: "high",
    risk_archetype: "weekly_price_fatigue",
    risk_reasons: [
      "9-day Travel streak broken + 3 days idle on Weekly plan",
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
      "Mid Risk: 8-day peak streak slowed to 2d (1 break)",
      "Prime candidate for Annual / Pro Studio tier upgrade",
    ],
    recommended_rescue_offer: "streak_challenge",
    recommended_product_key: "pro_annual",
  },
  {
    user_id: "u00784",
    adapty_cuid: "lumen_942195_00784",
    platform: "Android",
    country: "FR",
    acquisition_channel: "organic",
    onboarding_goal: "family",
    ai_edits_first_day: 3,
    photos_imported: 14,
    push_opt_in: "yes",
    product: "weekly",
    price_usd: 6.99,
    streak_days: 1,
    streak_best: 6,
    inactive_days: 2,
    streak_breaks: 1,
    churn_risk_score: 42,
    churn_risk_level: "medium",
    risk_archetype: "weekly_price_fatigue",
    risk_reasons: [
      "Mid Risk: 6-day Family streak slowing down — upgrade to Annual",
    ],
    recommended_rescue_offer: "streak_challenge",
    recommended_product_key: "annual",
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
    risk_reasons: [
      "Low Risk: Active 14-day unbeaten streak • No paywall interruption",
    ],
    recommended_rescue_offer: "loyalty_only",
    recommended_product_key: "annual",
  },
  {
    user_id: "u01890",
    adapty_cuid: "lumen_942195_01890",
    platform: "iOS",
    country: "NL",
    acquisition_channel: "organic",
    onboarding_goal: "travel",
    ai_edits_first_day: 7,
    photos_imported: 31,
    push_opt_in: "yes",
    product: "pro_annual",
    price_usd: 89.99,
    streak_days: 21,
    streak_best: 21,
    inactive_days: 0,
    streak_breaks: 0,
    churn_risk_score: 8,
    churn_risk_level: "low",
    risk_archetype: "healthy_engaged",
    risk_reasons: [
      "Low Risk: 21-day Pro Studio streak • Suppress all paywalls",
    ],
    recommended_rescue_offer: "loyalty_only",
    recommended_product_key: "pro_annual",
  },
];
