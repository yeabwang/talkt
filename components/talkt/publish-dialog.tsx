"use client";

import * as React from "react";

import { Icon, TalkTButton } from "@/components/talkt/primitives";

/**
 * Publish dialog with optional anonymous attribution.
 */
export function PublishDialog({
  defaultName,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  defaultName: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (opts: { displayName?: string; anonymous: boolean }) => void;
  onClose: () => void;
}) {
  const [anonymous, setAnonymous] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const credit = anonymous ? "Community" : defaultName || "Community";

  return (
    <div
      className="fade-in"
      onClick={() => (busy ? null : onClose())}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "color-mix(in srgb, var(--background) 70%, transparent)", display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Publish interview"
        style={{ width: "100%", maxWidth: 440, padding: 26 }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span className="mono-label">Contribute to the community</span>
          <button type="button" onClick={() => (busy ? null : onClose())} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <p className="caption" style={{ marginBottom: 20 }}>
          Share this interview template with the community. Anyone can find and take it, and members can vote the template up or down.
        </p>

        <div className="flex items-center justify-between" style={{ padding: "12px 14px", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <span className="caption" style={{ color: "var(--foreground)", fontWeight: 500 }}>
            Credited to
          </span>
          <span className="mono flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            <Icon name="user" size={13} />
            {credit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAnonymous((v) => !v)}
          disabled={busy}
          className="flex items-center gap-2"
          style={{ marginTop: 14, background: "none", border: 0, cursor: busy ? "default" : "pointer", padding: 0 }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--border)",
              background: anonymous ? "var(--foreground)" : "var(--card)",
              color: "var(--background)",
            }}
          >
            {anonymous ? <Icon name="check" size={12} /> : null}
          </span>
          <span className="caption" style={{ color: "var(--foreground)" }}>
            Publish anonymously
          </span>
        </button>

        {error ? (
          <div className="flex items-center gap-2" style={{ marginTop: 16, fontSize: 13, color: "var(--error)" }}>
            <Icon name="alert-triangle" size={15} /> {error}
          </div>
        ) : null}

        <div className="flex items-center gap-2" style={{ marginTop: 24, justifyContent: "flex-end" }}>
          <TalkTButton variant="ghost" onClick={() => (busy ? null : onClose())} disabled={busy}>
            Cancel
          </TalkTButton>
          <TalkTButton
            variant="primary"
            icon="shield"
            disabled={busy}
            onClick={() => onConfirm({ displayName: anonymous ? undefined : defaultName, anonymous })}
          >
            {busy ? "Publishing..." : "Publish"}
          </TalkTButton>
        </div>
      </div>
    </div>
  );
}
