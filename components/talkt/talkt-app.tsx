"use client";

import * as React from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { fetchAttempts, fetchDirectory, fetchRecommended, type CallSession } from "@/components/talkt/api";
import { AppShell, type TalkTRoute } from "@/components/talkt/app-shell";
import { BuilderScreen } from "@/components/talkt/builder-screen";
import { type AppUser, type Attempt, type Interview } from "@/components/talkt/data";
import { type Loadable, idle, loading, loaded, isPending } from "@/lib/loadable";
import { DashboardScreen } from "@/components/talkt/dashboard-screen";
import { LibraryScreen, InterviewDetailScreen } from "@/components/talkt/library-screen";
import { LiveInterviewScreen } from "@/components/talkt/live-screen";
import { LobbyScreen } from "@/components/talkt/lobby-screen";
import { ReportsScreen } from "@/components/talkt/reports-screen";
import { ResultsScreen } from "@/components/talkt/results-screen";
import { SettingsScreen } from "@/components/talkt/settings-screen";
import { UsageScreen } from "@/components/talkt/usage-screen";

type Theme = "dark" | "light";

const USER_CACHE_KEY = "talkt-user";

interface AppPathState {
  route: TalkTRoute;
  params: Record<string, unknown>;
}

function decodeSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function routeFromPath(pathname: string | null): AppPathState {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  const first = parts[0];
  const second = decodeSegment(parts[1]);

  if (!first || first === "dashboard") return { route: "dashboard", params: {} };
  if (first === "templates") {
    return second ? { route: "detail", params: { interviewId: second } } : { route: "library", params: {} };
  }
  if (first === "builder") return { route: "builder", params: {} };
  if (first === "reports") return { route: "reports", params: {} };
  if (first === "usage") return { route: "usage", params: {} };
  if (first === "settings") return { route: "settings", params: {} };
  if (first === "results") {
    return second ? { route: "results", params: { attemptId: second } } : { route: "results", params: {} };
  }
  if ((first === "interviews" || first === "interview") && second) {
    return parts[2] === "live"
      ? { route: "live", params: { interviewId: second } }
      : { route: "lobby", params: { interviewId: second } };
  }
  return { route: "dashboard", params: {} };
}

function idFromParams(params: Record<string, unknown>): string | undefined {
  const interview = params.interview as Interview | undefined;
  return interview?.id ?? (params.interviewId as string | undefined);
}

function pathForRoute(route: TalkTRoute, params: Record<string, unknown> = {}): string {
  const interviewId = idFromParams(params);
  const attemptId = params.attemptId as string | undefined;
  switch (route) {
    case "dashboard":
      return "/dashboard";
    case "library":
      return "/templates";
    case "detail":
      return interviewId ? `/templates/${encodeURIComponent(interviewId)}` : "/templates";
    case "builder":
      return "/builder";
    case "reports":
      return "/reports";
    case "usage":
      return "/usage";
    case "settings":
      return "/settings";
    case "results":
      return attemptId ? `/results/${encodeURIComponent(attemptId)}` : "/results";
    case "lobby":
      return interviewId ? `/interviews/${encodeURIComponent(interviewId)}` : "/templates";
    case "live":
      return interviewId ? `/interviews/${encodeURIComponent(interviewId)}/live` : "/templates";
    default:
      return "/dashboard";
  }
}

function mergePathParams(next: AppPathState, current: Record<string, unknown>): Record<string, unknown> {
  const currentInterview = current.interview as Interview | undefined;
  const nextInterviewId = next.params.interviewId as string | undefined;
  const currentAttemptId = current.attemptId as string | undefined;
  const nextAttemptId = next.params.attemptId as string | undefined;

  if ((next.route === "lobby" || next.route === "detail") && currentInterview?.id === nextInterviewId) {
    return { ...next.params, interview: currentInterview };
  }
  if (next.route === "live" && current.session && currentInterview?.id === nextInterviewId) {
    return {
      ...next.params,
      interview: currentInterview,
      session: current.session,
      camStream: current.camStream,
    };
  }
  if (next.route === "results" && currentAttemptId && currentAttemptId === nextAttemptId) {
    return { ...next.params, interview: current.interview, fromHistory: current.fromHistory, transcript: current.transcript };
  }
  return next.params;
}

// Minimal Clerk user shape consumed by this shell.
interface ClerkUserLike {
  id: string;
  fullName: string | null;
  firstName: string | null;
  username: string | null;
  hasImage: boolean;
  imageUrl: string;
  primaryEmailAddress?: { emailAddress: string } | null;
}

function deriveUser(clerkUser: ClerkUserLike): AppUser {
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  return {
    name: clerkUser.fullName ?? clerkUser.firstName ?? clerkUser.username ?? (email || "TalkT user"),
    email,
    firstName: clerkUser.firstName ?? undefined,
    image: clerkUser.hasImage ? clerkUser.imageUrl : undefined,
  };
}

function readCachedUser(): { id: string; user: AppUser } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; user?: AppUser };
    if (!parsed.id || !parsed.user) return null;
    return { id: parsed.id, user: parsed.user };
  } catch {
    return null;
  }
}

function writeCachedUser(id: string, user: AppUser) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify({ id, user }));
  } catch {
    /* Session cache is best-effort. */
  }
}

function clearCachedUser() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function TalkTApp() {
  const pathname = usePathname();
  const pathState = React.useMemo(() => routeFromPath(pathname), [pathname]);
  const { isLoaded, user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [route, setRoute] = React.useState<TalkTRoute>(pathState.route);
  const [params, setParams] = React.useState<Record<string, unknown>>(pathState.params);
  // Session-local interviews are merged with the public directory.
  const [sessionInterviews, setSessionInterviews] = React.useState<Interview[]>([]);
  const [directory, setDirectory] = React.useState<Interview[]>([]);
  const [recommended, setRecommended] = React.useState<Interview[]>([]);
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  // Load status gates skeletons versus empty states.
  const [directoryStatus, setDirectoryStatus] = React.useState<Loadable<true>>(idle());
  const [attemptsStatus, setAttemptsStatus] = React.useState<Loadable<true>>(idle());

  // Cached profile is only a pre-Clerk fallback after client mount.
  const [cachedUser, setCachedUser] = React.useState<AppUser | null>(null);
  const clerkAppUser = React.useMemo(() => {
    if (!isLoaded || !clerkUser) return null;
    return deriveUser(clerkUser);
  }, [isLoaded, clerkUser]);
  const user = isLoaded ? clerkAppUser : cachedUser;

  // Hydrate the session cache after mount to avoid server/client divergence.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const cached = readCachedUser();
      if (cached) setCachedUser(cached.user);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) {
      clearCachedUser();
      return;
    }
    writeCachedUser(clerkUser.id, deriveUser(clerkUser));
  }, [isLoaded, clerkUser]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("talkt-theme");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("talkt-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => document.documentElement.classList.add("anim"));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Load the directory once Clerk resolves the user.
  React.useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    let cancelled = false;
    void (async () => {
      setDirectoryStatus(loading());
      // Preferred order is personalized; fallback is the plain ranked directory.
      try {
        const rec = await fetchRecommended();
        if (!cancelled && rec.length) {
          setRecommended(rec);
          setDirectory(rec);
          setDirectoryStatus(loaded(true));
          return;
        }
      } catch {
        /* fall through to the plain directory */
      }
      try {
        const dir = await fetchDirectory();
        if (!cancelled) setDirectory(dir);
      } catch {
        /* Directory stays empty when the DB is unavailable. */
      }
      if (!cancelled) setDirectoryStatus(loaded(true));
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, clerkUser]);

  // Refresh graded history when a visible screen needs it.
  React.useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    if (route !== "dashboard" && route !== "reports") return;
    let cancelled = false;
    void (async () => {
      setAttemptsStatus((s) => (s.status === "loaded" ? s : loading()));
      try {
        const list = await fetchAttempts();
        if (!cancelled) setAttempts(list);
      } catch {
        /* History stays empty when the DB is unavailable. */
      }
      if (!cancelled) setAttemptsStatus(loaded(true));
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, clerkUser, route]);

  // Merge personalized directory results with session-local custom interviews.
  const allInterviews = React.useMemo(() => {
    const base = recommended.length ? recommended : directory;
    const ids = new Set(base.map((interview) => interview.id));
    const extras = sessionInterviews.filter((interview) => !ids.has(interview.id));
    return [...base, ...extras];
  }, [recommended, directory, sessionInterviews]);
  const findInterview = React.useCallback((id?: string) => allInterviews.find((interview) => interview.id === id), [allInterviews]);
  const directoryLoading = isPending(directoryStatus) && allInterviews.length === 0;
  const attemptsLoading = isPending(attemptsStatus) && attempts.length === 0;
  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoute(pathState.route);
      setParams((current) => mergePathParams(pathState, current));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathState]);

  const navigate = React.useCallback((nextRoute: TalkTRoute, nextParams: Record<string, unknown> = {}) => {
    setParams(nextParams);
    setRoute(nextRoute);
    const nextPath = pathForRoute(nextRoute, nextParams);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
    window.scrollTo(0, 0);
  }, []);

  const signOut = () => {
    void clerkSignOut({ redirectUrl: "/sign-in" });
  };

  const startInterview = (interview: Interview) => {
    if (interview.custom && !findInterview(interview.id)) {
      setSessionInterviews((current) => [interview, ...current]);
    }
    navigate("lobby", { interview });
  };

  // Wait for Clerk or the client-only cached profile before rendering the shell.
  if (!user) return null;

  const paramInterview = params.interview as Interview | undefined;
  const paramInterviewId = params.interviewId as string | undefined;
  const interview = paramInterview ?? findInterview(paramInterviewId);

  // Direct lobby/live URLs may resolve before the directory finishes loading.
  if (route === "lobby" || route === "live") {
    const active = interview ?? allInterviews[0];
    if (!active) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", padding: 32 }}>
          <div className="text-center" style={{ maxWidth: 360 }}>
            {directoryLoading ? (
              <p className="caption">Loading interview…</p>
            ) : (
              <>
                <p className="caption" style={{ marginBottom: 16 }}>Interview not found.</p>
                <button className="btn btn-secondary" type="button" onClick={() => navigate("dashboard")}>
                  Back to dashboard
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
  }

  if (route === "lobby") {
    const active = interview ?? allInterviews[0];
    return (
      <LobbyScreen
        interview={active}
        user={user}
        navigate={navigate}
        onJoin={(session, camStream) => navigate("live", { interview: active, session, camStream })}
      />
    );
  }

  if (route === "live") {
    const active = interview ?? allInterviews[0];
    const session = params.session as CallSession | undefined;
    const camStream = (params.camStream as MediaStream | null | undefined) ?? null;
    // Direct live URLs need a fresh lobby join to create the call session.
    if (!session) return <LobbyScreen interview={active} user={user} navigate={navigate} onJoin={(s, cam) => navigate("live", { interview: active, session: s, camStream: cam })} />;
    return (
      <LiveInterviewScreen
        interview={active}
        user={user}
        session={session}
        camStream={camStream}
        onEnd={(attemptId, transcript) => navigate("results", { interview: active, attemptId, transcript })}
        onCancel={() => navigate("dashboard")}
      />
    );
  }

  let body: React.ReactNode = null;

  if (route === "dashboard") {
    body = <DashboardScreen user={user} navigate={navigate} startInterview={startInterview} attempts={attempts} allInterviews={allInterviews} loading={directoryLoading || attemptsLoading} />;
  } else if (route === "library") {
    body = <LibraryScreen navigate={navigate} startInterview={startInterview} allInterviews={allInterviews} loading={directoryLoading} />;
  } else if (route === "detail") {
    body = interview ? (
      <InterviewDetailScreen interview={interview} navigate={navigate} startInterview={startInterview} user={user} />
    ) : (
      <LibraryScreen navigate={navigate} startInterview={startInterview} allInterviews={allInterviews} loading={directoryLoading} />
    );
  } else if (route === "builder") {
    body = <BuilderScreen navigate={navigate} startInterview={startInterview} user={user} />;
  } else if (route === "reports") {
    body = <ReportsScreen navigate={navigate} startInterview={startInterview} attempts={attempts} allInterviews={allInterviews} loading={attemptsLoading} />;
  } else if (route === "usage") {
    body = <UsageScreen />;
  } else if (route === "settings") {
    body = <SettingsScreen user={user} onSignOut={signOut} />;
  } else if (route === "results") {
    const active = interview ?? allInterviews[0];
    const attemptId = params.attemptId as string | undefined;
    const transcript = params.transcript as { role: string; text: string }[] | undefined;
    body = (
      <ResultsScreen
        interview={active}
        attemptId={attemptId}
        transcript={transcript}
        navigate={navigate}
        startInterview={startInterview}
      />
    );
  }

  return (
    <AppShell user={user} theme={theme} onToggleTheme={toggleTheme} route={route} navigate={navigate} onSignOut={signOut}>
      {body}
    </AppShell>
  );
}
