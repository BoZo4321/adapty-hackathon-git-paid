// 🔒 OWNED BY PERSON 3: Transparency legend for judges (real vs simulated data)

export function SimTag({ label = "Simulated" }: { label?: string }) {
  return <span className="radar-sim-tag" title="Simulated data, not from the real Lumen dataset">{label}</span>;
}

export default function RealVsEnrichedBadge() {
  return (
    <div className="radar-legend">
      <span className="radar-legend-item">
        <span className="radar-legend-dot radar-legend-real" />
        <strong>Real data:</strong> Lumen dataset + Adapty
      </span>
      <span className="radar-legend-item">
        <SimTag label="SIM" />
        <strong>Simulated:</strong> daily streaks, revenue estimate
      </span>
    </div>
  );
}
