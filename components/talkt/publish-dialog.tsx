"use client";

import * as React from "react";

import { Icon, TalkTButton } from "@/components/talkt/primitives";

/**
 * Publish-to-directory dialog. Collects the public display name and an
 * anonymous toggle, then hands them to `onConfirm`. Pure UI — the caller wires
 * up persistence/publish (builder persists first; the detail page already has a
 * stored interview).
 */
// Mount this only while open (callers render it conditionally) so each open
// starts with fresh form state — no reset effect needed.
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
  const [name, setName] = React.useState(defaultName);
  const [anonymous, setAnonymous] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const canConfirm = anonymous || name.trim().length > 0;

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
          <span className="mono-label">Publish to directory</span>
          <button type="button" onClick={() => (busy ? null : onClose())} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <p className="caption" style={{ marginBottom: 20 }}>
          Anyone can find, take, and vote on this interview. You can&apos;t edit it after publishing.
        </p>

        <label className="mono-label" style={{ display: "block", marginBottom: 8 }}>
          Shown as
        </label>
        <input
          className="field"
          value={anonymous ? "" : name}
          placeholder={anonymous ? "Anonymous" : "Your display name"}
          disabled={anonymous || busy}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />

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
            disabled={!canConfirm || busy}
            onClick={() => onConfirm({ displayName: anonymous ? undefined : name.trim(), anonymous })}
          >
            {busy ? "Publishing..." : "Publish"}
          </TalkTButton>
        </div>
      </div>
    </div>
  );
}
