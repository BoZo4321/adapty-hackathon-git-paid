// Radar-only types. Per-user records (Contract A) use the shared AtRiskUser from types/contract.ts;
// the analytics summary isn't in the shared contract yet, so it lives here until P1 freezes it.
import type { AtRiskUser, ChurnRiskLevel } from "../../types/contract";

export type RiskTier = "high" | "medium" | "low";

export interface TierSummary {
  tier: RiskTier;
  min_score: number;
  users: number;
  avg_risk: number; // 0-1
  actual_churn_rate: number; // 0-1
  revenue_at_risk_usd: number;
  action: string;
}

export interface AnalyticsSummary {
  kpi: { subscribers_scored: number; at_risk_users: number; revenue_at_risk_usd: number };
  tiers: TierSummary[];
  churn_by_plan: { plan: string; churn_rate: number }[];
  streak_decay: { days_before_event: number[]; churned: number[]; retained: number[]; simulated: boolean };
}

export type DataSource = "api" | "mock";

export interface Loaded<T> {
  data: T;
  source: DataSource;
}

export const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];

export const TIER_COLOR: Record<RiskTier, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

export const TIER_LABEL: Record<RiskTier, string> = {
  high: "High",
  medium: "Mid",
  low: "Low",
};

// "critical" is a sub-level of the high tier.
export function tierOf(level: ChurnRiskLevel): RiskTier {
  return level === "critical" || level === "high" ? "high" : level;
}

export type RadarUser = AtRiskUser;
