"use client";

import * as React from "react";

// Shimmer blocks sized to the real cards so the layout doesn't shift when data
// arrives. Pure presentation; driven by callers' load status.

function Shimmer({ style }: { style?: React.CSSProperties }) {
  return <div className="talkt-skeleton" style={{ borderRadius: 8, background: "var(--surface-2)", ...style }} aria-hidden />;
}

/** Grid of placeholder interview cards for the library/dashboard directory. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="talkt-library-grid" role="status" aria-label="Loading interviews" style={{ background: "var(--border)", border: "1px solid var(--border)" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--card)", padding: 22, minHeight: 196 }}>
          <Shimmer style={{ height: 38, width: 38, marginBottom: 18 }} />
          <Shimmer style={{ height: 16, width: "70%", marginBottom: 10 }} />
          <Shimmer style={{ height: 12, width: "90%", marginBottom: 6 }} />
          <Shimmer style={{ height: 12, width: "55%" }} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for the dashboard resume hero. */
export function HeroSkeleton() {
  return (
    <div className="card rounded-lg" style={{ minHeight: 248, padding: 30 }} role="status" aria-label="Loading dashboard">
      <Shimmer style={{ height: 12, width: 180, marginBottom: 18 }} />
      <Shimmer style={{ height: 26, width: "60%", marginBottom: 12 }} />
      <Shimmer style={{ height: 14, width: "75%" }} />
    </div>
  );
}

/**
 * Full-page placeholder shown while an already-graded report's stored feedback
 * loads — the same calm shimmer the dashboard uses, not the live grading-steps
 * screen (which is only for a fresh interview being scored).
 */
export function ReportSkeleton() {
  return (
    <div className="fade-up talkt-page" style={{ paddingTop: 40 }} role="status" aria-label="Loading report">
      <div style={{ marginBottom: 30 }}>
        <Shimmer style={{ height: 12, width: 140, marginBottom: 12 }} />
        <Shimmer style={{ height: 28, width: "45%", marginBottom: 10 }} />
        <Shimmer style={{ height: 12, width: 260 }} />
      </div>
      <div className="card rounded-lg" style={{ padding: 32, display: "flex", gap: 40, alignItems: "center", marginBottom: 30 }}>
        <Shimmer style={{ height: 140, width: 140, borderRadius: "50%" }} />
        <div style={{ flex: 1 }}>
          <Shimmer style={{ height: 12, width: 90, marginBottom: 14 }} />
          <Shimmer style={{ height: 14, width: "100%", marginBottom: 8 }} />
          <Shimmer style={{ height: 14, width: "80%" }} />
        </div>
      </div>
      <CardGridSkeleton count={4} />
    </div>
  );
}

/** Placeholder rows for the reports history list. */
export function ReportsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading reports">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card rounded-lg" style={{ padding: 18, marginBottom: 12, display: "flex", gap: 16 }}>
          <Shimmer style={{ height: 40, width: 40 }} />
          <div style={{ flex: 1 }}>
            <Shimmer style={{ height: 14, width: "40%", marginBottom: 8 }} />
            <Shimmer style={{ height: 12, width: "25%" }} />
          </div>
          <Shimmer style={{ height: 28, width: 48 }} />
        </div>
      ))}
    </div>
  );
}
