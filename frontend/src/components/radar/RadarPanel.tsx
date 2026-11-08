// 🔒 OWNED BY PERSON 3: Composes KPI banner, charts, user table and data legend. The single component App.tsx mounts on the left.
/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import { ADAPTY_APP_ID } from "../../types/contract";
import CohortCharts from "./CohortCharts";
import KpiRoiBanner from "./KpiRoiBanner";
import RealVsEnrichedBadge from "./RealVsEnrichedBadge";
import UserRadarTable from "./UserRadarTable";
import { fetchAtRiskUsers, fetchSummary } from "./api";
import type { AnalyticsSummary, DataSource, RadarUser } from "./types";
import "./radar.css";

const APP_ID = ADAPTY_APP_ID;

interface Props {
  onSelectUser: (u: RadarUser) => void;
  selectedUserId?: string;
}

export default function RadarPanel({ onSelectUser, selectedUserId }: Props) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<RadarUser[]>([]);
  const [sources, setSources] = useState<{ summary: DataSource; users: DataSource } | null>(null);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchAtRiskUsers({ limit: 200 })]).then(([s, u]) => {
      setSummary(s.data);
      setUsers(u.data);
      setSources({ summary: s.source, users: u.source });
    });
  }, []);

  // Say exactly which part is mock, so it's obvious which backend endpoint is still missing.
  const mockParts = [
    sources?.summary === "mock" && { label: "KPIs & charts", endpoint: "GET /api/analytics/summary" },
    sources?.users === "mock" && { label: "user table", endpoint: "GET /api/users/at-risk" },
  ].filter((p): p is { label: string; endpoint: string } => Boolean(p));
  const mockLabel = mockParts.length === 2 ? "Mock data" : `Mock data: ${mockParts.map((p) => p.label).join(", ")}`;
  const mockTitle =
    `Placeholder data. Backend unavailable or VITE_USE_MOCK=true for: ` + mockParts.map((p) => p.endpoint).join(", ");

  return (
    <div className="radar-panel">
      <div className="radar-header">
        <div>
          <h2>Churn Risk Radar</h2>
          <div className="radar-muted">
            {APP_ID ? (
              <span className="radar-connected" title={`Adapty app ID: ${APP_ID}`}>
                <span className="radar-connected-dot" />
                Connected to Adapty · Lumen <code>({APP_ID.slice(0, 4)}…{APP_ID.slice(-4)})</code>
              </span>
            ) : (
              <>Adapty app not configured (set <code>VITE_ADAPTY_APP_ID</code>)</>
            )}
            {mockParts.length > 0 && <span className="radar-mock-badge" title={mockTitle}>{mockLabel}</span>}
          </div>
        </div>
        <RealVsEnrichedBadge />
      </div>

      {summary ? (
        <>
          <KpiRoiBanner summary={summary} />
          <CohortCharts summary={summary} />
          <UserRadarTable users={users} selectedUserId={selectedUserId} onSelectUser={onSelectUser} />
        </>
      ) : (
        <div className="radar-card radar-muted">Loading risk data…</div>
      )}
    </div>
  );
}
