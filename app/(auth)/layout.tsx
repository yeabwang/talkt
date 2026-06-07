import Link from "next/link";

import { Wordmark } from "@/components/talkt/primitives";

// Shared brand shell for Clerk sign-in and sign-up screens.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="talkt-auth-layout">
      <aside
        className="bg-grid-lines relative"
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          borderRight: "1px solid var(--border)",
          background: "var(--sidebar)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 40,
        }}
      >
        <div className="grainy-t" aria-hidden="true">
          T
        </div>
        <div className="noise-overlay" style={{ opacity: 0.1 }} />
        <div className="relative">
          <Wordmark size={22} />
        </div>

        <div className="relative" style={{ maxWidth: 520 }}>
          <div className="mono-label" style={{ marginBottom: 18 }}>
            Spoken interview practice
          </div>
          <h1 className="h1-hero" style={{ marginBottom: 20 }}>
            Practice the interview out loud.
          </h1>
          <p className="body-lg muted" style={{ margin: 0 }}>
            Walk in ready. Rehearse out loud with an AI interviewer and get scored the moment you
            hang up. Any role.
          </p>
          <div style={{ display: "flex", gap: 28, marginTop: 36, flexWrap: "wrap" }}>
            {[
              ["Questions", "1,000+"],
              ["Industries", "200+"],
              ["Interviews", "900+"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {value}
                </div>
                <div className="mono-label" style={{ marginTop: 6 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <nav className="relative mono flex" style={{ fontSize: 12, color: "var(--dimmed)", gap: 18 }}>
          {[
            ["About", "/about"],
            ["Pricing", "/pricing"],
            ["Feedback", "/feedback"],
          ].map(([label, href]) => (
            <Link key={href} href={href} style={{ color: "inherit", textDecoration: "none" }} className="auth-footer-link">
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          minHeight: "100vh",
        }}
      >
        <div className="fade-up">{children}</div>
      </main>
    </div>
  );
}
