/// <reference types="vite/client" />
// Radar data calls (backend owned by Person 1). Falls back to mock JSON so the demo never breaks.
// No API keys here: the frontend only talks to our own backend.
import type { AtRiskUser } from "../../types/contract";
import summaryMock from "./mock/summary.json";
import usersMock from "./mock/users.json";
import type { AnalyticsSummary, Loaded, RiskTier } from "./types";
import { tierOf } from "./types";

// Empty by default: requests go to /api/... and the Vite dev proxy forwards them to the backend
// on :8000 (same as the simulator), so the backend needs no CORS setup. Set VITE_API_BASE only
// when the backend lives on another host.
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// Accept both the shared contract names and the alternative names from the P3 spec
// (current_product / risk_drivers), so a naming mismatch with the backend doesn't blank the table.
function normalizeUser(raw: Record<string, unknown>): AtRiskUser {
  const u = { ...raw } as Record<string, unknown>;
  if (u.product === undefined && u.current_product !== undefined) u.product = u.current_product;
  if (u.risk_reasons === undefined && u.risk_drivers !== undefined) u.risk_reasons = u.risk_drivers;
  if (!Array.isArray(u.risk_reasons)) u.risk_reasons = [];
  return u as unknown as AtRiskUser;
}

export async function fetchSummary(): Promise<Loaded<AnalyticsSummary>> {
  if (!USE_MOCK) {
    try {
      const data = await getJson<AnalyticsSummary>("/api/analytics/summary");
      if (!data?.kpi || !Array.isArray(data.tiers)) throw new Error("unexpected summary shape");
      return { data, source: "api" };
    } catch (err) {
      console.warn("[radar] /api/analytics/summary failed, using mock data:", err);
    }
  } else {
    console.warn("[radar] VITE_USE_MOCK=true, using mock summary");
  }
  return { data: summaryMock as AnalyticsSummary, source: "mock" };
}

export interface UserQuery {
  tier?: RiskTier;
  goal?: string;
  limit?: number;
}

export async function fetchAtRiskUsers(query: UserQuery = {}): Promise<Loaded<AtRiskUser[]>> {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (query.tier) params.set("tier", query.tier);
    if (query.goal) params.set("goal", query.goal);
    if (query.limit) params.set("limit", String(query.limit));
    try {
      const raw = await getJson<Record<string, unknown>[]>(`/api/users/at-risk?${params}`);
      if (!Array.isArray(raw)) throw new Error("unexpected users shape");
      return { data: raw.map(normalizeUser), source: "api" };
    } catch (err) {
      console.warn("[radar] /api/users/at-risk failed, using mock data:", err);
    }
  } else {
    console.warn("[radar] VITE_USE_MOCK=true, using mock users");
  }
  let users = (usersMock as Record<string, unknown>[]).map(normalizeUser);
  if (query.tier) users = users.filter((u) => tierOf(u.churn_risk_level) === query.tier);
  if (query.goal) users = users.filter((u) => u.onboarding_goal === query.goal);
  if (query.limit) users = users.slice(0, query.limit);
  return { data: users, source: "mock" };
}
