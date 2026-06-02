"use client";

import * as React from "react";

import type { AppUser } from "@/components/talkt/data";
import { TalkTButton, Wordmark } from "@/components/talkt/primitives";

export function AuthScreen({ onAuthed }: { onAuthed: (user: AppUser) => void }) {
  const [mode, setMode] = React.useState<"signup" | "signin">("signup");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const isSignup = mode === "signup";

  const completeAuth = () => {
    onAuthed({
      name: name.trim() || "Alex Park",
      email: email.trim() || "alex@example.com",
    });
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    completeAuth();
  };

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

        <div className="relative" style={{ maxWidth: 420 }}>
          <div className="mono-label" style={{ marginBottom: 18 }}>
            Spoken interview practice
          </div>
          <h1 className="h1-hero" style={{ marginBottom: 20 }}>
            Practice the interview out loud.
          </h1>
          <p className="body-lg muted" style={{ margin: 0 }}>
            Real-time voice interviews with an AI interviewer, scored the moment you hang up. Pick a
            template or build your own - for any role.
          </p>
          <div style={{ display: "flex", gap: 28, marginTop: 36, flexWrap: "wrap" }}>
            {[
              ["Templates", "40+"],
              ["Avg. setup", "< 1 min"],
              ["Feedback", "Seconds"],
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

        <div className="relative mono" style={{ fontSize: 12, color: "var(--dimmed)" }}>
          Voice · Templates · Custom builder · Scored feedback
        </div>
      </aside>

      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, minHeight: "100vh" }}>
        <div className="fade-up" style={{ width: "100%", maxWidth: 380 }}>
          <div className="mono-label" style={{ marginBottom: 14 }}>
            {isSignup ? "01 · Create account" : "01 · Welcome back"}
          </div>
          <h2 className="h1-app" style={{ marginBottom: 8 }}>
            {isSignup ? "Start practicing" : "Sign in to TalkT"}
          </h2>
          <p className="caption" style={{ marginBottom: 28 }}>
            {isSignup ? "Your attempts and feedback stay private to you." : "Pick up where you left off."}
          </p>

          <form onSubmit={submit} className="flex-col" style={{ gap: 14 }}>
            <button type="button" className="btn btn-secondary btn-block" onClick={completeAuth} style={{ height: 44, gap: 10 }}>
              <GoogleG /> Continue with Google
            </button>
            <div className="flex items-center gap-3" style={{ margin: "4px 0" }}>
              <div className="grow hairline" />
              <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
                OR
              </span>
              <div className="grow hairline" />
            </div>

            {isSignup ? (
              <label className="flex-col" style={{ gap: 7 }}>
                <span className="mono-label">Name</span>
                <input className="field" placeholder="Alex Park" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            <label className="flex-col" style={{ gap: 7 }}>
              <span className="mono-label">Email</span>
              <input
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="flex-col" style={{ gap: 7 }}>
              <span className="mono-label">Password</span>
              <input className="field" type="password" placeholder="••••••••" />
            </label>

            <TalkTButton variant="primary" size="lg" className="btn-block" type="submit" iconRight="arrow-right" style={{ marginTop: 6 }}>
              {isSignup ? "Create account" : "Sign in"}
            </TalkTButton>
          </form>

          <p className="caption" style={{ marginTop: 22 }}>
            {isSignup ? "Already have an account? " : "New to TalkT? "}
            <button
              type="button"
              onClick={() => setMode(isSignup ? "signin" : "signup")}
              style={{
                background: "none",
                border: 0,
                color: "var(--foreground)",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                padding: 0,
                font: "inherit",
              }}
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="mono" style={{ marginTop: 36, fontSize: 11, color: "var(--dimmed)" }}>
            Secured by Clerk · By continuing you agree to the terms.
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="var(--google-blue)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="var(--google-green)" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="var(--google-yellow)" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="var(--google-red)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
