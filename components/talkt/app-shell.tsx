"use client";

import * as React from "react";

import { USAGE, type AppUser } from "@/components/talkt/data";
import { Avatar, Icon, TalkTButton, Wordmark } from "@/components/talkt/primitives";

export type TalkTRoute = "dashboard" | "library" | "detail" | "builder" | "lobby" | "live" | "results" | "reports" | "usage" | "settings";

type NavKey = "dashboard" | "library" | "reports" | "usage" | "settings";

interface NavItem {
  id: NavKey;
  label: string;
  icon: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  { items: [{ id: "dashboard", label: "Dashboard", icon: "grid" }] },
  {
    label: "Practice",
    items: [
      { id: "library", label: "Interview Templates", icon: "list" },
      { id: "reports", label: "Reports", icon: "file-text" },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "usage", label: "Usage", icon: "bar-chart" },
      { id: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

// Map each route to its active navigation item.
const ACTIVE_NAV: Partial<Record<TalkTRoute, NavKey>> = {
  dashboard: "dashboard",
  results: "reports",
  library: "library",
  detail: "library",
  builder: "library",
  reports: "reports",
  usage: "usage",
  settings: "settings",
};

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
  const activeNav = ACTIVE_NAV[route] ?? "dashboard";

  return (
    <div className="talkt-app-shell">
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: "var(--header-h)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--page-x)",
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--background) 80%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center" style={{ gap: 14 }}>
          <button type="button" onClick={() => navigate("dashboard")} aria-label="TalkT home" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <Wordmark size={20} />
          </button>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <Breadcrumb route={route} />
        </div>
        <div className="flex items-center gap-2">
          <TalkTButton variant="primary" size="sm" icon="plus" onClick={() => navigate("builder")}>
            Build interview
          </TalkTButton>
          <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" type="button">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <ProfileMenu user={user} theme={theme} onToggleTheme={onToggleTheme} navigate={navigate} onSignOut={onSignOut} />
        </div>
      </header>

      <div className="talkt-app-body">
        <aside
          style={{
            position: "sticky",
            top: "var(--header-h)",
            height: "calc(100vh - var(--header-h))",
            background: "var(--sidebar)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            padding: "16px 14px",
          }}
        >
          <nav className="flex-col" style={{ gap: 1 }}>
            {NAV_SECTIONS.map((section, index) => (
              <React.Fragment key={section.label ?? `section-${index}`}>
                {section.label ? (
                  <div className="tt-nav-label">
                    <span className="mono-label">{section.label}</span>
                  </div>
                ) : null}
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tt-nav-item"
                    data-active={activeNav === item.id}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="tt-nav-text">{item.label}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>

          <div className="grow" />

          <PlanCard navigate={navigate} />
        </aside>

        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}

function PlanCard({ navigate }: { navigate: (route: TalkTRoute) => void }) {
  const pct = Math.min(1, USAGE.minutes / USAGE.minutesLimit);
  return (
    <button
      type="button"
      onClick={() => navigate("usage")}
      className="card-hover"
      style={{ border: "1px solid var(--border)", background: "var(--card)", padding: 14, textAlign: "left", cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", gap: 9 }}
    >
      <div className="flex items-center justify-between">
        <span className="mono-label">{USAGE.planLabel}</span>
        <Icon name="arrow-right" size={14} className="muted" />
      </div>
      <div style={{ height: 4, background: "var(--border)", width: "100%" }}>
        <div style={{ height: "100%", width: `${Math.round(pct * 100)}%`, background: pct >= 0.8 ? "var(--warn)" : "var(--foreground)" }} />
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
        {USAGE.minutes} / {USAGE.minutesLimit} min used
      </span>
    </button>
  );
}

function ProfileMenu({
  user,
  theme,
  onToggleTheme,
  navigate,
  onSignOut,
}: {
  user: AppUser;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  navigate: (route: TalkTRoute) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 40,
          padding: "0 6px 0 8px",
          background: open ? "var(--card)" : "transparent",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <Avatar name={user.name} src={user.image} size={28} />
        <Icon name="chevron-down" size={15} className="muted" />
      </button>

      {open ? (
        <div
          className="card fade-in"
          style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 232, boxShadow: "var(--shadow-pop)", padding: 6, zIndex: 30 }}
        >
          <div style={{ padding: "8px 10px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--dimmed)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.email}
            </div>
          </div>
          <div className="hairline" style={{ margin: "2px 0 4px" }} />
          <MenuItem
            icon={theme === "dark" ? "sun" : "moon"}
            label={theme === "dark" ? "Light mode" : "Dark mode"}
            onClick={() => {
              onToggleTheme();
              setOpen(false);
            }}
          />
          <MenuItem
            icon="settings"
            label="Settings"
            onClick={() => {
              navigate("settings");
              setOpen(false);
            }}
          />
          <div className="hairline" style={{ margin: "4px 0" }} />
          <MenuItem icon="log-out" label="Sign out" onClick={onSignOut} />
        </div>
      ) : null}
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
    library: "Interview Templates",
    detail: "Interview Templates",
    builder: "Build interview",
    results: "Feedback",
    reports: "Reports",
    usage: "Usage",
    settings: "Settings",
  };

  return (
    <div className="flex items-center gap-2 mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
      <span style={{ color: "var(--dimmed)" }}>talkt</span>
      <Icon name="chevron-right" size={13} style={{ color: "var(--dimmed)" }} />
      <span style={{ color: "var(--foreground)" }}>{labels[route] ?? "Dashboard"}</span>
    </div>
  );
}
