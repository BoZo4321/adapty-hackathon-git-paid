// 🔒 OWNED BY PERSON 3: Composes KPI banner and charts. The user table lives in AtRiskSubscribers, the status/legend in RadarStatus.
/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import CohortCharts from "./CohortCharts";
import KpiRoiBanner from "./KpiRoiBanner";
import { fetchSummary } from "./api";
import type { AnalyticsSummary, DataSource } from "./types";
import "./radar.css";

// onSourceChange lets the page header (RadarStatus) show the "Mock data" badge for this data.
export default function RadarPanel({ onSourceChange }: { onSourceChange?: (s: DataSource) => void }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    fetchSummary().then((s) => {
      setSummary(s.data);
      onSourceChange?.(s.source);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="radar-panel">
      <div className="radar-header">
        <h2>Churn Risk Radar</h2>
      </div>

      {summary ? (
        <>
          <KpiRoiBanner summary={summary} />
          <CohortCharts summary={summary} />
        </>
      ) : (
        <div className="radar-card radar-muted">Loading risk data…</div>
      )}
    </div>
  );
}
