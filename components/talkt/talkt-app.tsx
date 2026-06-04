"use client";

import * as React from "react";
import { useClerk, useUser } from "@clerk/nextjs";

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

// Minimal shape we read off the Clerk user resource.
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
    /* sessionStorage unavailable (private mode / quota) — degrade silently */
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
  const { isLoaded, user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [route, setRoute] = React.useState<TalkTRoute>("dashboard");
  const [params, setParams] = React.useState<Record<string, unknown>>({});
  // Custom interviews the user builds this session but hasn't published yet.
  const [sessionInterviews, setSessionInterviews] = React.useState<Interview[]>([]);
  // The live, ranked directory from the API (the only source of templates now).
  const [directory, setDirectory] = React.useState<Interview[]>([]);
  const [recommended, setRecommended] = React.useState<Interview[]>([]);
  // The user's graded attempt history from the DB (Reports + dashboard).
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  // Load status so screens show skeletons (not empty states) until the first
  // fetch settles.
  const [directoryStatus, setDirectoryStatus] = React.useState<Loadable<true>>(idle());
  const [attemptsStatus, setAttemptsStatus] = React.useState<Loadable<true>>(idle());

  // Profile (name + photo) comes from Clerk once loaded. A cached copy is only a
  // pre-Clerk fallback; delay reading it so hydration still starts from null.
  const [cachedUser, setCachedUser] = React.useState<AppUser | null>(null);
  const clerkAppUser = React.useMemo(() => {
    if (!isLoaded || !clerkUser) return null;
    return deriveUser(clerkUser);
  }, [isLoaded, clerkUser]);
  const user = isLoaded ? clerkAppUser : cachedUser;

  // Fast first paint: hydrate from the session cache after mount (client only,
  // so it never diverges from the server's null render).
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

  // Load the live directory + personalized order once the user is resolved.
  React.useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    let cancelled = false;
    void (async () => {
      setDirectoryStatus(loading());
      // Recommended already returns the full directory, re-ranked for this user.
      // Use it as the primary source; only fall back to the plain directory when
      // it fails or is empty — avoiding a second full directory read.
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
        /* DB unreachable — directory stays empty */
      }
      if (!cancelled) setDirectoryStatus(loaded(true));
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, clerkUser]);

  // Load the user's graded history whenever they land on a screen that shows it
  // (refetches after a just-finished grade once they navigate back).
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
        /* DB unreachable — history stays empty */
      }
      if (!cancelled) setAttemptsStatus(loaded(true));
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, clerkUser, route]);

  // Recommendations re-rank the directory (suitable interviews float to the top)
  // — not a separate section. Fall back to plain rank order until they load.
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

  const navigate = React.useCallback((nextRoute: TalkTRoute, nextParams: Record<string, unknown> = {}) => {
    setParams(nextParams);
    setRoute(nextRoute);
    window.scrollTo(0, 0);
  }, []);

  const signOut = () => {
    void clerkSignOut({ redirectUrl: "/sign-in" });
  };

  const startInterview = (interview: Interview) => {
    if (interview.custom && !findInterview(interview.id)) {
      setSessionInterviews((current) => [interview, ...current]);
    }
    setParams({ interview });
    setRoute("lobby");
  };

  // "/" is protected by proxy.ts, so a reaching user is authenticated. A cached
  // profile lets us paint immediately; otherwise wait for Clerk to resolve.
  if (!user) return null;

  const paramInterview = params.interview as Interview | undefined;
  const paramInterviewId = params.interviewId as string | undefined;
  const interview = paramInterview ?? findInterview(paramInterviewId);

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
    // A live route without a session means a stale/direct nav — bounce to the lobby.
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
