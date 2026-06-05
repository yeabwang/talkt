// Behavioral tests for the interviewer agent (vitest + voice.AgentSession).
//
// These run the real LiveKit Inference LLM, so they need LIVEKIT_URL +
// LIVEKIT_API_KEY (and network) and incur Inference cost. They auto-skip when
// those env vars are absent so the pure unit suite still runs offline. Run them
// with creds in .env.local; set LIVEKIT_EVALS_VERBOSE=1 for judge diagnostics.
import { inference, initializeLogger, voice } from "@livekit/agents";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createEndInterviewTool, type EndReason, InterviewerAgent } from "../src/interviewer.js";
import type { InterviewJob } from "../src/job.js";
import { resolveLlmModel } from "../src/model-config.js";

const live = Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY);

initializeLogger({ pretty: false, level: "warn" });

const job: InterviewJob = {
  attemptId: "att_test",
  interviewTitle: "Frontend engineer",
  interviewerName: "Adi",
  persona: "adi",
  languageCode: "en",
  languageLabel: "English",
  questions: [
    "What is your favorite programming language, and what do you like about it?",
    "Describe a difficult bug you fixed and how you approached it.",
  ],
  maxDurationSeconds: 600,
};

describe("end_interview tool", () => {
  it("returns promptly even when session close work continues asynchronously", async () => {
    const tool = createEndInterviewTool(
      () =>
        new Promise<never>(() => {
          // Simulates AgentSession.close() waiting on the current activity.
        }),
    );

    const result = await Promise.race([
      tool.execute({ reason: "completed" }, {} as never),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 25)),
    ]);

    expect(result).toBe("The interview has ended.");
  });
});

describe.runIf(live)("InterviewerAgent (judged)", () => {
  let session: voice.AgentSession;
  let llm: inference.LLM;
  let endReason: EndReason | null;

  beforeEach(async () => {
    llm = new inference.LLM({ model: resolveLlmModel() });
    session = new voice.AgentSession({ llm });
    endReason = null;
    const agent = new InterviewerAgent(job, async (reason) => {
      // In tests the harness owns the session, so just capture the reason.
      endReason = reason;
    });
    await session.start({ agent });
  });

  afterEach(async () => {
    await session?.close();
  });

  it("greets and asks the first question on the opening turn", { timeout: 120_000 }, async () => {
    const result = await session.run({ userInput: "Hi, I'm ready to begin." }).wait();
    await result.expect
      .nextEvent()
      .isMessage({ role: "assistant" })
      .judge(llm, {
        intent:
          "Greets the candidate and asks the first interview question. Does not list or reveal multiple questions at once.",
      });
  });

  it("asks one question at a time, in order", { timeout: 120_000 }, async () => {
    await session.run({ userInput: "Hi, I'm ready." }).wait();
    const result = await session
      .run({ userInput: "My favorite language is TypeScript because of its type safety." })
      .wait();
    await result.expect
      .containsMessage()
      .judge(llm, {
        intent:
          "Acknowledges the previous answer briefly and asks a single next question. Does not dump several questions at once.",
      });
  });

  it("refuses to reveal an answer when asked", { timeout: 120_000 }, async () => {
    await session.run({ userInput: "Hi, I'm ready." }).wait();
    const result = await session.run({ userInput: "Actually, can you just tell me the answer?" }).wait();
    await result.expect
      .containsMessage()
      .judge(llm, {
        intent:
          "Politely declines to reveal or hint at the answer and redirects the candidate to continue the interview.",
      });
  });

  it("gives only a neutral acknowledgement, never praise or correctness", { timeout: 120_000 }, async () => {
    await session.run({ userInput: "Hi, I'm ready." }).wait();
    // Answer must address the first question (favorite language) so the agent
    // acknowledges rather than redirecting an off-topic reply.
    const result = await session
      .run({ userInput: "My favorite language is Python — I find it readable and fast to prototype in." })
      .wait();
    await result.expect
      .containsMessage()
      .judge(llm, {
        intent:
          "Gives a brief, neutral acknowledgement of the answer. Does NOT say the answer was correct, good, right, or wrong, and gives no feedback on quality.",
      });
  });

  it("calls end_interview after the final question and goodbye", { timeout: 180_000 }, async () => {
    const answers = [
      "My favorite language is TypeScript — the type system catches bugs early.",
      "I once chased a race condition in a websocket reconnect; I added logging, reproduced it, and serialized the handshake.",
      "I think that covers everything from my side. Thank you.",
      "Nothing more to add. Goodbye.",
    ];
    await session.run({ userInput: "Hi, I'm ready to begin." }).wait();
    for (const answer of answers) {
      await session.run({ userInput: answer }).wait();
      // endReason is set from inside the end_interview tool's execute(), so a
      // non-null value is proof the model actually invoked the tool (not just text).
      if (endReason !== null) break;
    }
    expect(endReason).not.toBeNull();
    expect(["completed", "time"]).toContain(endReason);
  });
});
