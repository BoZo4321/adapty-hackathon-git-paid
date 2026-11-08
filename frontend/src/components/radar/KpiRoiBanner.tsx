// 🔒 OWNED BY PERSON 3: KPI cards + "estimated revenue saved" by retention scenario
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useState } from "react";
import InfoTip from "./InfoTip";
import { SimTag } from "./RealVsEnrichedBadge";
import type { AnalyticsSummary, RiskTier } from "./types";

const RETAIN_MIN = 0;
const RETAIN_MAX = 100;
const RETAIN_STEP = 10;

const SERIES = [
  { key: "total", name: "At-risk", legend: "High + Mid risk", color: "#6C4CF5" },
  { key: "high", name: "High risk", legend: "High risk only", color: "#ef4444" },
  { key: "mid", name: "Mid risk", legend: "Mid risk only", color: "#f59e0b" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

interface HoverPoint {
  key: SeriesKey;
  index: number;
  x: number;
  y: number;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usdShort = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : usd(n));
const num = (n: number) => n.toLocaleString("en-US");


export default function KpiRoiBanner({ summary }: { summary: AnalyticsSummary }) {
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const hoverSeries = hover ? SERIES.find((s) => s.key === hover.key) : undefined;

  const tier = (t: RiskTier) => summary.tiers.find((x) => x.tier === t);
  const high = tier("high");
  const mid = tier("medium");
  const low = tier("low");
  const highRev = high?.revenue_at_risk_usd ?? 0;
  const midRev = mid?.revenue_at_risk_usd ?? 0;
  // Low tier gets no rescue action, so it's excluded from the estimate.
  const atRisk = highRev + midRev;

  const scenarios: ({ pct: string } & Record<SeriesKey, number>)[] = [];
  for (let p = RETAIN_MIN; p <= RETAIN_MAX; p += RETAIN_STEP) {
    scenarios.push({ pct: `${p}%`, total: atRisk * (p / 100), high: highRev * (p / 100), mid: midRev * (p / 100) });
  }

  return (
    <>
      <div className="radar-kpis">
        <div className="radar-kpi">
          <div className="radar-kpi-label">
            Subscribers scored
            <InfoTip align="left">
              Subscribers our model gave a churn-risk score from 0 to 100, based on their profile, plan
              and 4 daily-streak signals.
            </InfoTip>
          </div>
          <div className="radar-kpi-value">{num(summary.kpi.subscribers_scored)}</div>
        </div>
        <div className="radar-kpi radar-kpi-high">
          <div className="radar-kpi-label">
            High risk
            <InfoTip align="left">
              Score {high?.min_score ?? "?"}+: likely to cancel soon. They get a rescue offer
              {high?.action ? <> ({high.action})</> : null}. Revenue at risk is what we lose if they cancel.
            </InfoTip>
          </div>
          <div className="radar-kpi-value">{num(high?.users ?? 0)}<span className="radar-kpi-unit">users</span></div>
          <div className="radar-kpi-sub">{usd(highRev)} revenue at risk</div>
        </div>
        <div className="radar-kpi radar-kpi-mid">
          <div className="radar-kpi-label">
            Mid risk
            <InfoTip align="left">
              Score {mid?.min_score ?? "?"}–{high ? high.min_score - 1 : "?"}: engagement is slowing.
              They get an offer before they drift away{mid?.action ? <> ({mid.action})</> : null}.
            </InfoTip>
          </div>
          <div className="radar-kpi-value">{num(mid?.users ?? 0)}<span className="radar-kpi-unit">users</span></div>
          <div className="radar-kpi-sub">{usd(midRev)} revenue at risk</div>
        </div>
        <div className="radar-kpi radar-kpi-low">
          <div className="radar-kpi-label">
            Low risk
            <InfoTip>
              Score below {mid?.min_score ?? "?"}: engaged users with an active streak. No paywall is
              shown, so they are not counted in revenue saved.
            </InfoTip>
          </div>
          <div className="radar-kpi-value">{num(low?.users ?? 0)}<span className="radar-kpi-unit">users</span></div>
          <div className="radar-kpi-sub">No revenue at risk</div>
        </div>
      </div>

      <div className="radar-card radar-chart">
        <div className="radar-chart-title">
          Estimated revenue saved by retention rate
          <InfoTip>
            Revenue at risk from <strong>high + mid</strong> risk users × the share our rescue action
            retains. <strong>Low-risk users are not included</strong>: they get no rescue offer, so they
            bring no additional revenue. The retention shares are assumptions, <strong>not measured results</strong>.
          </InfoTip>
          <SimTag label="Estimate" />
        </div>
        {/* Own tooltip instead of recharts': shows only the hovered line and stays put so the number can be copied. */}
        <div className="radar-linechart" onMouseLeave={() => setHover(null)}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={scenarios} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#2b2740" vertical={false} />
              <XAxis
                dataKey="pct"
                height={42}
                tick={{ fill: "#8e8a9f", fontSize: 12 }}
                stroke="#8e8a9f"
                label={{ value: "users retained", position: "insideBottom", offset: 2, fill: "#8e8a9f", fontSize: 11 }}
              />
              <YAxis tick={{ fill: "#8e8a9f", fontSize: 12 }} stroke="#8e8a9f" tickFormatter={usdShort} />
              <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10, paddingLeft: 25 }} formatter={(v: string) => <span className="radar-legend-text">{v}</span>} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.legend}
                  stroke={s.color}
                  strokeWidth={2.5}
                  activeDot={false}
                  dot={(p: { cx?: number; cy?: number; index?: number }) => {
                    const i = p.index ?? 0;
                    const active = hover?.key === s.key && hover.index === i;
                    return (
                      <g key={`${s.key}-${i}`}>
                        <circle cx={p.cx} cy={p.cy} r={active ? 5 : 3} fill={s.color} />
                        <circle
                          cx={p.cx}
                          cy={p.cy}
                          r={11}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHover({ key: s.key, index: i, x: p.cx ?? 0, y: p.cy ?? 0 })}
                        />
                      </g>
                    );
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {hover && hoverSeries && (
            <div className="radar-point-tip" style={{ left: hover.x, top: hover.y }}>
              <div className="radar-point-tip-pct">{scenarios[hover.index].pct}</div>
              <div>
                <span className="radar-point-tip-dot" style={{ background: hoverSeries.color }} />
                {hoverSeries.name}: <strong>{usd(scenarios[hover.index][hover.key])}</strong>
              </div>
            </div>
          )}
        </div>
        <div className="radar-kpi-formula">{usd(atRisk)} at risk</div>
      </div>
    </>
  );
}
