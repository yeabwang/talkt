"use client";

import * as React from "react";
import { useClerk, useUser } from "@clerk/nextjs";

import { AppShell, type TalkTRoute } from "@/components/talkt/app-shell";
import { BuilderScreen } from "@/components/talkt/builder-screen";
import { ATTEMPTS, CUSTOM_INTERVIEWS, TEMPLATES, type AppUser, type Interview } from "@/components/talkt/data";
import { DashboardScreen } from "@/components/talkt/dashboard-screen";
import { LibraryScreen, InterviewDetailScreen } from "@/components/talkt/library-screen";
import { LiveInterviewScreen } from "@/components/talkt/live-screen";
import { LobbyScreen } from "@/components/talkt/lobby-screen";
import { ReportsScreen } from "@/components/talkt/reports-screen";
import { ResultsScreen } from "@/components/talkt/results-screen";
import { SettingsScreen } from "@/components/talkt/settings-screen";
import { UsageScreen } from "@/components/talkt/usage-screen";

type Theme = "dark" | "light";

export function TalkTApp() {
  const { isLoaded, user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [route, setRoute] = React.useState<TalkTRoute>("dashboard");
  const [params, setParams] = React.useState<Record<string, unknown>>({});
  const [sessionInterviews, setSessionInterviews] = React.useState<Interview[]>(CUSTOM_INTERVIEWS);
  const attempts = ATTEMPTS;

  const user = React.useMemo<AppUser | null>(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    return {
      name: clerkUser.fullName ?? clerkUser.username ?? (email || "TalkT user"),
      email,
    };
  }, [clerkUser]);

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

  const allInterviews = React.useMemo(() => [...TEMPLATES, ...sessionInterviews], [sessionInterviews]);
  const findInterview = React.useCallback((id?: string) => allInterviews.find((interview) => interview.id === id), [allInterviews]);
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

  // "/" is protected by proxy.ts, so a reaching user is authenticated; this
  // only guards the brief pre-hydration window before Clerk resolves.
  if (!isLoaded || !user) return null;

  const paramInterview = params.interview as Interview | undefined;
  const paramInterviewId = params.interviewId as string | undefined;
  const interview = paramInterview ?? findInterview(paramInterviewId);

  if (route === "lobby") {
    const active = interview ?? allInterviews[0];
    return <LobbyScreen interview={active} user={user} navigate={navigate} onJoin={() => navigate("live", { interview: active })} />;
  }

  if (route === "live") {
    const active = interview ?? allInterviews[0];
    return (
      <LiveInterviewScreen
        interview={active}
        user={user}
        onEnd={() => navigate("results", { interview: active })}
        onCancel={() => navigate("dashboard")}
      />
    );
  }

  let body: React.ReactNode = null;

  if (route === "dashboard") {
    body = <DashboardScreen user={user} navigate={navigate} startInterview={startInterview} attempts={attempts} allInterviews={allInterviews} />;
  } else if (route === "library") {
    body = <LibraryScreen navigate={navigate} startInterview={startInterview} allInterviews={allInterviews} />;
  } else if (route === "detail") {
    body = interview ? (
      <InterviewDetailScreen interview={interview} navigate={navigate} startInterview={startInterview} />
    ) : (
      <LibraryScreen navigate={navigate} startInterview={startInterview} allInterviews={allInterviews} />
    );
  } else if (route === "builder") {
    body = <BuilderScreen navigate={navigate} startInterview={startInterview} />;
  } else if (route === "reports") {
    body = <ReportsScreen navigate={navigate} startInterview={startInterview} attempts={attempts} allInterviews={allInterviews} />;
  } else if (route === "usage") {
    body = <UsageScreen />;
  } else if (route === "settings") {
    body = <SettingsScreen user={user} onSignOut={signOut} />;
  } else if (route === "results") {
    const active = interview ?? allInterviews[0];
    const attemptId = params.attemptId as string | undefined;
    const attempt = attemptId ? attempts.find((item) => item.id === attemptId) : null;
    body = (
      <ResultsScreen
        interview={active}
        attempt={attempt}
        navigate={navigate}
        startInterview={startInterview}
        instant={Boolean(params.fromHistory)}
      />
    );
  }

  return (
    <AppShell user={user} theme={theme} onToggleTheme={toggleTheme} route={route} navigate={navigate} onSignOut={signOut}>
      {body}
    </AppShell>
  );
}
