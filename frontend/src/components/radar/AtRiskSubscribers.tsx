// 🔒 OWNED BY PERSON 3: At-risk subscribers table as a standalone block (mounted above the phone in App.tsx).
import { useEffect, useState } from "react";
import UserRadarTable from "./UserRadarTable";
import { fetchAtRiskUsers } from "./api";
import type { DataSource, RadarUser } from "./types";
import "./radar.css";

interface Props {
  onSelectUser: (u: RadarUser) => void;
  selectedUserId?: string;
}

export default function AtRiskSubscribers({ onSelectUser, selectedUserId }: Props) {
  const [users, setUsers] = useState<RadarUser[] | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);

  useEffect(() => {
    fetchAtRiskUsers({ limit: 200 }).then((u) => {
      setUsers(u.data);
      setSource(u.source);
      // Preselect the first row (highest risk score) so the phone shows a real user on start.
      const first = [...u.data].sort((a, b) => b.churn_risk_score - a.churn_risk_score)[0];
      if (first) onSelectUser(first);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // .radar-panel provides the radar CSS variables; .radar-fill makes the table exactly as tall as the
  // simulator next to it (rows scroll inside) instead of stretching the row.
  return (
    <div className="radar-panel radar-fill">
      {users ? (
        <UserRadarTable
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          usingMock={source === "mock"}
        />
      ) : (
        <div className="radar-card radar-muted">Loading subscribers…</div>
      )}
    </div>
  );
}
