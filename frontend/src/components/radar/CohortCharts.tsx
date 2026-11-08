// 🔒 OWNED BY PERSON 3: Tier size, churn-by-tier proof, churn by plan, streak decay charts
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import InfoTip from "./InfoTip";
import { SimTag } from "./RealVsEnrichedBadge";
import type { AnalyticsSummary } from "./types";
import { TIER_COLOR, TIER_LABEL, TIER_ORDER } from "./types";

const AXIS = { stroke: "#8e8a9f", fill: "#8e8a9f", fontSize: 12 };
const GRID = "#2b2740";
const TOOLTIP = {
  contentStyle: { background: "#1e1b2e", border: "1px solid #3b3358", borderRadius: 8, color: "#f4f3f8" },
  itemStyle: { color: "#f4f3f8" },
  cursor: { fill: "rgba(108, 76, 245, 0.12)" },
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
// Percentage axes always show the full 0-100% range.
const PCT_DOMAIN: [number, number] = [0, 1];
const PCT_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

// X-axis tick with the tier name and its action wrapped underneath.
function TierTick({ x, y, payload, actions }: { x?: number; y?: number; payload?: { value: string }; actions: Record<string, string> }) {
  const label = payload?.value ?? "";
  const words = (actions[label] ?? "").split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 18) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={14} textAnchor="middle" fill="#f4f3f8" fontSize={13} fontWeight={700}>{label}</text>
      {lines.map((l, i) => (
        <text key={i} dy={30 + i * 13} textAnchor="middle" fill="#8e8a9f" fontSize={11}>{l}</text>
      ))}
    </g>
  );
}

function ChartCard({ title, info, tag, children }: { title: string; info: ReactNode; tag?: ReactNode; children: ReactNode }) {
  return (
    <div className="radar-card radar-chart">
      <div className="radar-chart-title">
        {title}
        <InfoTip align="left">{info}</InfoTip>
        {tag}
      </div>
      <div className="radar-chart-body">{children}</div>
    </div>
  );
}

export default function CohortCharts({ summary }: { summary: AnalyticsSummary }) {
  const tiers = TIER_ORDER.map((t) => summary.tiers.find((x) => x.tier === t)).filter((x) => x !== undefined);
  const tierData = tiers.map((t) => ({ ...t, label: TIER_LABEL[t.tier] }));
  const actions = Object.fromEntries(tierData.map((t) => [t.label, t.action]));

  const decay = summary.streak_decay;
  const decayData = decay.days_before_event.map((d, i) => ({
    day: d === 0 ? "event" : `-${d}d`,
    churned: decay.churned[i],
    retained: decay.retained[i],
  }));

  return (
    <div className="radar-charts">
      <ChartCard
        title="Users per risk tier"
        info="How many scored subscribers fall into each risk tier, and which action each tier gets."
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={tierData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" interval={0} height={64} tick={<TierTick actions={actions} />} stroke={AXIS.stroke} />
            <YAxis tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} tickFormatter={(v: number) => v.toLocaleString("en-US")} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => [v.toLocaleString("en-US"), "Users"]} />
            <Bar dataKey="users" radius={[6, 6, 0, 0]}>
              {tierData.map((t) => <Cell key={t.tier} fill={TIER_COLOR[t.tier]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Users we flag as high risk really churn more"
        info="Share of users in each tier who actually cancelled. If the model works, high risk churns the most and low risk the least."
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={tierData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} />
            <YAxis tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} tickFormatter={pct} domain={PCT_DOMAIN} ticks={PCT_TICKS} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => [pct(v), "Actual churn rate"]} />
            <Bar dataKey="actual_churn_rate" radius={[6, 6, 0, 0]}>
              {tierData.map((t) => <Cell key={t.tier} fill={TIER_COLOR[t.tier]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Churn rate by plan" info="Share of subscribers on each plan who cancelled.">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={summary.churn_by_plan} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="plan" tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} interval={0} />
            <YAxis tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} tickFormatter={pct} domain={PCT_DOMAIN} ticks={PCT_TICKS} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => [pct(v), "Churn rate"]} />
            <Bar dataKey="churn_rate" fill="#6C4CF5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Streak before cancel: churned vs retained"
        info="Average daily streak in the days before users cancelled (churned), compared with users who stayed (retained). A falling streak is an early warning sign."
        tag={decay.simulated ? <SimTag label="Simulated data" /> : undefined}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={decayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} />
            <YAxis tick={{ fill: AXIS.fill, fontSize: AXIS.fontSize }} stroke={AXIS.stroke} label={{ value: "avg streak (days)", angle: -90, position: "insideLeft", offset: 18, fill: "#8e8a9f", fontSize: 11, style: { textAnchor: "middle" } }} />
            <Tooltip {...TOOLTIP} cursor={{ stroke: "#3b3358" }} />
            <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v: string) => <span className="radar-legend-text">{v}</span>} />
            <Line type="monotone" dataKey="churned" name="Churned" stroke={TIER_COLOR.high} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="retained" name="Retained" stroke={TIER_COLOR.low} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
