// Session chat history -> { role, text }[] for grading. Matches the grade-attempt
// payload shape exactly (role "user"|"assistant", trimmed text, empties dropped)
// so the existing Trigger task consumes it unchanged (see trigger/grade-attempt.ts
// GradeAttemptPayload and lib/transcript.ts).

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

// Structural shape of the bits of voice.AgentSession.history we read. Kept loose
// so transcript.ts stays a pure, LiveKit-free unit (testable without the SDK).
interface HistoryItemLike {
  type?: unknown;
  role?: unknown;
  // ChatMessage exposes a `textContent` getter joining its text parts.
  textContent?: unknown;
  // Fallback: raw content array of string | { value } parts.
  content?: unknown;
}
interface SessionLike {
  history?: { items?: HistoryItemLike[] } | undefined;
}

function itemText(item: HistoryItemLike): string {
  if (typeof item.textContent === "string") return item.textContent;
  if (Array.isArray(item.content)) {
    return item.content
      .map((c) => (typeof c === "string" ? c : isValuePart(c) ? c.value : ""))
      .join("\n");
  }
  return "";
}

function isValuePart(c: unknown): c is { value: string } {
  return !!c && typeof c === "object" && typeof (c as { value?: unknown }).value === "string";
}

/**
 * Flatten the session's chat history into grading turns. Only `message` items
 * with a user/assistant role survive; system/developer messages, tool calls, and
 * tool outputs are dropped, as is any turn that trims to empty.
 */
export function historyToTurns(session: SessionLike): Turn[] {
  const items = session.history?.items ?? [];
  const out: Turn[] = [];
  for (const item of items) {
    if (item.type !== "message") continue;
    if (item.role !== "user" && item.role !== "assistant") continue;
    const text = itemText(item).trim();
    if (!text) continue;
    out.push({ role: item.role, text });
  }
  return out;
}

/**
 * Records transcript from LiveKit's committed conversation items. This avoids
 * grading from in-flight transcription streams, which can be partial or delta
 * chunks while the agent is still speaking.
 */
export class CommittedTranscript {
  private readonly committed: Turn[] = [];

  constructor(private readonly fallback?: SessionLike) {}

  add(item: HistoryItemLike): void {
    if (item.type !== "message") return;
    if (item.role !== "user" && item.role !== "assistant") return;
    const text = itemText(item).trim();
    if (!text) return;
    this.committed.push({ role: item.role, text });
  }

  turns(): Turn[] {
    return this.committed.length ? [...this.committed] : historyToTurns(this.fallback ?? {});
  }
}
