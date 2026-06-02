import Link from "next/link";

import { Wordmark } from "@/components/talkt/primitives";

export function InfoPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 40,
        maxWidth: 760,
        margin: "0 auto",
        gap: 28,
      }}
    >
      <Link href="/" style={{ textDecoration: "none", color: "inherit", width: "fit-content" }}>
        <Wordmark size={22} />
      </Link>
      <div className="fade-up">
        <div className="mono-label" style={{ marginBottom: 14 }}>
          {eyebrow}
        </div>
        <h1 className="h1-app" style={{ marginBottom: 18 }}>
          {title}
        </h1>
        <div className="body-lg muted" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {children ?? <p style={{ margin: 0 }}>Coming soon.</p>}
        </div>
      </div>
    </main>
  );
}
