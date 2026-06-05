import { llm } from "@livekit/agents";
import { describe, expect, it } from "vitest";

import { CommittedTranscript } from "../src/transcript.js";

describe("CommittedTranscript", () => {
  it("records only committed user and assistant messages", () => {
    const transcript = new CommittedTranscript();

    transcript.add(
      llm.ChatMessage.create({
        role: "assistant",
        content: "Here is the complete question, including the final word.",
      }),
    );
    transcript.add(
      llm.ChatMessage.create({
        role: "user",
        content: "Here is my complete answer.",
      }),
    );
    transcript.add({ type: "agent_handoff" } as never);

    expect(transcript.turns()).toEqual([
      { role: "assistant", text: "Here is the complete question, including the final word." },
      { role: "user", text: "Here is my complete answer." },
    ]);
  });

  it("falls back to session history only when no committed items were captured", () => {
    const transcript = new CommittedTranscript({
      history: {
        items: [
          { type: "message", role: "assistant", textContent: "Fallback question." },
          { type: "message", role: "user", textContent: "Fallback answer." },
        ],
      },
    });

    expect(transcript.turns()).toEqual([
      { role: "assistant", text: "Fallback question." },
      { role: "user", text: "Fallback answer." },
    ]);
  });
});
