"use client";

import * as React from "react";

import { USAGE } from "@/components/talkt/data";
import { SectionHeader } from "@/components/talkt/primitives";

const PERIODS = ["7d", "30d", "90d", "All"] as const;
type Period = (typeof PERIODS)[number];

// Usage summary for the current plan.
export function UsageScreen() {
  const [period, setPeriod] = React.useState<Period>("30d");
  const usage = USAGE;

  return (
    <div className="fade-up talkt-page">
      <div className="flex items-center justify-between talkt-mobile-stack" style={{ marginBottom: 26, gap: 16 }}>
        <div>
          <h1 className="h1-app" style={{ marginBottom: 6 }}>
            Usage
          </h1>
          <p className="caption" style={{ margin: 0 }}>
            Minutes, tokens and cost against your {usage.planLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex" style={{ border: "1px solid var(--border)" }}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              className="mono"
              onClick={() => setPeriod(value)}
              style={{
                padding: "7px 12px",
                fontSize: 12,
                background: period === value ? "var(--card)" : "transparent",
                color: period === value ? "var(--foreground)" : "var(--muted-foreground)",
                border: 0,
                borderLeft: value === PERIODS[0] ? 0 : "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="talkt-usage-stats" style={{ marginBottom: 44 }}>
        <StatCard label="Minutes" value={String(usage.minutes)} sub={`of ${usage.minutesLimit} this period`} pct={usage.minutes / usage.minutesLimit} />
        <StatCard label="Tokens" value={formatTokens(usage.tokens)} sub={`of ${formatTokens(usage.tokensLimit)}`} pct={usage.tokens / usage.tokensLimit} />
        <StatCard label="Interviews" value={String(usage.interviews)} sub="this period" />
        <StatCard label="Est. cost" value={`$${usage.estCost.toFixed(2)}`} sub={`of $${usage.costBudget} budget`} pct={usage.estCost / usage.costBudget} />
      </div>

      <SectionHeader
        num="01"
        label="Minutes over time"
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
            peak {Math.max(...usage.trend)}m · avg {Math.round(usage.trend.reduce((sum, value) => sum + value, 0) / usage.trend.length)}m
          </span>
        }
      />
      <div className="card rounded-lg" style={{ padding: 24, marginBottom: 44 }}>
        <UsageChart data={usage.trend} />
      </div>

      <SectionHeader num="02" label="Breakdown by interview" />
      <div style={{ border: "1px solid var(--border)" }}>
        <div
          className="mono-label"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          <span>Interview</span>
          <span style={{ textAlign: "right" }}>Attempts</span>
          <span style={{ textAlign: "right" }}>Minutes</span>
          <span style={{ textAlign: "right" }}>Tokens</span>
        </div>
        {usage.breakdown.map((row) => (
          <div
            key={row.interviewId}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "14px 18px", borderBottom: "1px solid var(--border)", alignItems: "center" }}
          >
            <span style={{ fontWeight: 500, fontSize: 14 }}>{row.title}</span>
            <span className="mono" style={{ textAlign: "right", fontSize: 13, color: "var(--muted-foreground)" }}>
              {row.attempts}
            </span>
            <span className="mono" style={{ textAlign: "right", fontSize: 13, color: "var(--muted-foreground)" }}>
              {row.minutes}
            </span>
            <span className="mono" style={{ textAlign: "right", fontSize: 13, color: "var(--muted-foreground)" }}>
              {formatTokens(row.tokens)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, pct }: { label: string; value: string; sub: string; pct?: number }) {
  const ratio = pct === undefined ? undefined : Math.min(1, pct);
  const over = ratio !== undefined && ratio >= 0.8;
  return (
    <div style={{ background: "var(--card)", padding: 22, display: "flex", flexDirection: "column", gap: 12, minHeight: 132 }}>
      <span className="mono-label">{label}</span>
      <span className="stat-value" style={{ fontSize: 30 }}>
        {value}
      </span>
      <div className="grow" />
      {ratio !== undefined ? (
        <div style={{ height: 4, background: "var(--border)", width: "100%" }}>
          <div style={{ height: "100%", width: `${Math.round(ratio * 100)}%`, background: over ? "var(--warn)" : "var(--foreground)" }} />
        </div>
      ) : null}
      <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
        {sub}
      </span>
    </div>
  );
}

function UsageChart({ data, height = 140 }: { data: number[]; height?: number }) {
  const width = 720;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * width : 0;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return [x, y] as const;
  });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true">
      <path d={`${path} L${width} ${height} L0 ${height} Z`} fill="var(--foreground)" opacity={0.04} />
      <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle key={index} cx={point[0]} cy={point[1]} r={2.5} fill="var(--foreground)" />
      ))}
    </svg>
  );
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
