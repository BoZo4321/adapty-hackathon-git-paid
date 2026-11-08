// 🔒 OWNED BY PERSON 3: Adapty connection status, mock-data badge and real-vs-simulated legend (page header).
import { ADAPTY_APP_ID } from "../../types/contract";
import RealVsEnrichedBadge from "./RealVsEnrichedBadge";
import "./radar.css";

export default function RadarStatus({ usingMock }: { usingMock: boolean }) {
  return (
    <div className="radar-status">
      <span className="radar-muted">
        {ADAPTY_APP_ID ? (
          <span className="radar-connected" title={`Adapty app ID: ${ADAPTY_APP_ID}`}>
            <span className="radar-connected-dot" />
            Connected to Adapty · Lumen <code>({ADAPTY_APP_ID.slice(0, 4)}…{ADAPTY_APP_ID.slice(-4)})</code>
          </span>
        ) : (
          <>Adapty app not configured (set <code>VITE_ADAPTY_APP_ID</code>)</>
        )}
        {usingMock && (
          <span className="radar-mock-badge" title="Placeholder data. Backend unavailable or VITE_USE_MOCK=true for: GET /api/analytics/summary">
            Mock data
          </span>
        )}
      </span>
      <RealVsEnrichedBadge />
    </div>
  );
}
