// A tiny, framework-free load-status union so screens can distinguish
// "still loading" from "loaded but empty" — the distinction that prevents
// misleading empty-state flashes.

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "failed"; error: string };

export const idle = <T>(): Loadable<T> => ({ status: "idle" });
export const loading = <T>(): Loadable<T> => ({ status: "loading" });
export const loaded = <T>(data: T): Loadable<T> => ({ status: "loaded", data });
export const failed = <T>(error: string): Loadable<T> => ({ status: "failed", error });

/** True once a request has settled (loaded or failed) — safe to show empty/error UI. */
export function isResolved<T>(s: Loadable<T>): boolean {
  return s.status === "loaded" || s.status === "failed";
}

/** True while a request is still outstanding (idle or loading) — show a skeleton. */
export function isPending<T>(s: Loadable<T>): boolean {
  return !isResolved(s);
}
