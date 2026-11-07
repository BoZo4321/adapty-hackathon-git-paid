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

export type ChurnRiskLevel = "critical" | "high" | "medium" | "low";

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

// Live Adapty catalog UUIDs from `adapty products list --app 6a2a9879-18a9-41ff-9adc-622ce922a1bf --json`
export const LIVE_ADAPTY_PRODUCTS: Record<
  ProductKey,
  { uuid: string; title: string; priceUsd: number; periodLabel: string; flowProductId: string }
> = {
  weekly: {
    uuid: "eb8068ca-3908-4aea-b11d-634d5fde5885",
    title: "Premium Weekly (3-day trial)",
    priceUsd: 6.99,
    periodLabel: "/ week",
    flowProductId: "84b7b865-6b4e-5d71-8f5e-3d58e67a7e09",
  },
  monthly: {
    uuid: "a13bea2f-e5ff-4f28-bbd9-f6d6111f2a78",
    title: "Premium Monthly",
    priceUsd: 12.99,
    periodLabel: "/ month",
    flowProductId: "2e00e60b-1c82-53b0-9c74-8b2f88c21970",
  },
  annual: {
    uuid: "a17e9b0c-0c72-40c6-8445-ee4980fcad2e",
    title: "Premium Annual",
    priceUsd: 49.99,
    periodLabel: "/ year",
    flowProductId: "6e81a5cf-8d0a-5e24-9b96-2e820e61c63c",
  },
  annual_trial: {
    uuid: "93782929-2d97-4d03-bc9e-6d63852680c2",
    title: "Premium Annual (7-day trial)",
    priceUsd: 49.99,
    periodLabel: "/ year",
    flowProductId: "f12d8461-3b7d-5615-9294-725d76b3b241",
  },
  pro_annual: {
    uuid: "3ba6c281-7754-4d7c-81f1-31f8109bbc3d",
    title: "Pro Annual - AI Studio",
    priceUsd: 89.99,
    periodLabel: "/ year",
    flowProductId: "99a3c422-72b0-5d9b-8385-55e6a734b86a",
  },
  lifetime: {
    uuid: "064cbcf7-9f9c-4f4b-a3f5-ab50ca120365",
    title: "Premium Lifetime",
    priceUsd: 99.99,
    periodLabel: "one-time",
    flowProductId: "d4c5c819-0983-5396-9668-334a0877f809",
  },
};
