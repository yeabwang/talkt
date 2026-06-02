"use client";

import * as React from "react";

import type { AppUser } from "@/components/talkt/data";
import { Avatar, Icon, TalkTButton, Wordmark } from "@/components/talkt/primitives";

export type TalkTRoute = "dashboard" | "library" | "detail" | "builder" | "lobby" | "live" | "results";

export function AppShell({
  user,
  theme,
  onToggleTheme,
  route,
  navigate,
  onSignOut,
  children,
}: {
  user: AppUser;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  route: TalkTRoute;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const nav = [
    { id: "dashboard" as const, label: "Dashboard", icon: "grid" },
    { id: "library" as const, label: "Interviews", icon: "list" },
  ];
  const activeNav =
    (
      {
        dashboard: "dashboard",
        library: "library",
        detail: "library",
        builder: "library",
        results: "dashboard",
      } as Partial<Record<TalkTRoute, "dashboard" | "library">>
    )[route] ?? "dashboard";

  return (
    <div className="talkt-app-shell">
      <aside
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "18px 14px",
        }}
      >
        <div style={{ padding: "4px 8px 22px" }}>
          <button type="button" onClick={() => navigate("dashboard")} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <Wordmark size={20} />
          </button>
        </div>

        <TalkTButton variant="primary" icon="plus" onClick={() => navigate("builder")} style={{ marginBottom: 22, height: 38 }}>
          Build interview
        </TalkTButton>

        <nav className="flex-col" style={{ gap: 2 }}>
          {nav.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  height: 38,
                  padding: "0 10px",
                  background: active ? "var(--card)" : "transparent",
                  border: `1px solid ${active ? "var(--border)" : "transparent"}`,
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  transition: "all var(--dur-fast) var(--ease-out)",
                }}
              >
                <Icon name={item.icon} size={17} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="grow" />

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: 8,
              background: menuOpen ? "var(--card)" : "transparent",
              border: `1px solid ${menuOpen ? "var(--border)" : "transparent"}`,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Avatar name={user.name} size={30} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--dimmed)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
            </div>
            <Icon name="chevron-down" size={15} className="muted" />
          </button>

          {menuOpen ? (
            <div className="card fade-in" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, boxShadow: "var(--shadow-pop)", padding: 6, zIndex: 30 }}>
              <MenuItem
                icon={theme === "dark" ? "sun" : "moon"}
                label={theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={() => {
                  onToggleTheme();
                  setMenuOpen(false);
                }}
              />
              <MenuItem icon="settings" label="Settings" onClick={() => setMenuOpen(false)} />
              <div className="hairline" style={{ margin: "4px 0" }} />
              <MenuItem icon="log-out" label="Sign out" onClick={onSignOut} />
            </div>
          ) : null}
        </div>
      </aside>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            height: "var(--header-h)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            borderBottom: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--background) 80%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <Breadcrumb route={route} />
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" type="button">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
            <TalkTButton variant="secondary" size="sm" icon="search">
              Search
            </TalkTButton>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 10px",
        background: "transparent",
        border: 0,
        cursor: "pointer",
        color: "var(--muted-foreground)",
        fontSize: 13,
        textAlign: "left",
        transition: "all var(--dur-fast)",
      }}
    >
      <Icon name={icon} size={16} /> {label}
    </button>
  );
}

function Breadcrumb({ route }: { route: TalkTRoute }) {
  const labels: Partial<Record<TalkTRoute, string>> = {
    dashboard: "Dashboard",
    library: "Interviews",
    detail: "Interviews",
    builder: "Build interview",
    results: "Feedback",
  };

  return (
    <div className="flex items-center gap-2 mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
      <span style={{ color: "var(--dimmed)" }}>talkt</span>
      <Icon name="chevron-right" size={13} style={{ color: "var(--dimmed)" }} />
      <span style={{ color: "var(--foreground)" }}>{labels[route] ?? "Dashboard"}</span>
    </div>
  );
}
