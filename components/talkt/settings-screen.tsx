"use client";

import * as React from "react";

import type { AppUser } from "@/components/talkt/data";
import { SectionHeader, TalkTButton } from "@/components/talkt/primitives";

// Profile and account.
export function SettingsScreen({
  user,
  onSignOut,
}: {
  user: AppUser;
  onSignOut: () => void;
}) {
  return (
    <div className="fade-up talkt-page" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 className="h1-app" style={{ marginBottom: 6 }}>
          Settings
        </h1>
        <p className="caption" style={{ margin: 0 }}>
          Manage your account, appearance and practice defaults.
        </p>
      </div>

      <SectionHeader num="01" label="Profile" />
      <div className="card rounded-lg" style={{ padding: 24, marginBottom: 44, display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Name">
          <input className="field" defaultValue={user.name} />
        </Field>
        <Field label="Email">
          <input className="field" defaultValue={user.email} readOnly style={{ color: "var(--muted-foreground)" }} />
        </Field>
        <div className="flex" style={{ justifyContent: "flex-end" }}>
          <TalkTButton variant="primary" size="sm">
            Save changes
          </TalkTButton>
        </div>
      </div>

      <SectionHeader num="02" label="Account" />
      <div className="card rounded-lg flex items-center justify-between" style={{ padding: 20 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Sign out</div>
          <div className="caption" style={{ margin: 0 }}>
            End your session on this device.
          </div>
        </div>
        <TalkTButton variant="secondary" size="sm" icon="log-out" onClick={onSignOut}>
          Sign out
        </TalkTButton>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex-col" style={{ display: "flex", gap: 7 }}>
      <span className="mono-label">{label}</span>
      {children}
    </label>
  );
}
