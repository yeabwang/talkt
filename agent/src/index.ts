// Worker entrypoint. Registers as the named agent `talkt-interviewer`; on each
// dispatch it parses the job metadata, builds the Inference voice session, greets,
// arms the hard time cap, and on close posts the transcript + outcome back to the
// app. No Prisma, no Trigger SDK, no provider API keys — Inference bills through
// the LiveKit credentials, and the only bridge to the app is callback.ts.
import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";

import { postSessionEnded, type Outcome } from "./callback.js";
import { type EndReason, InterviewerAgent } from "./interviewer.js";
import { parseJob } from "./job.js";
import { resolveAgentModelConfig } from "./model-config.js";
import { firstMessage } from "./prompt.js";
import { historyToTurns } from "./transcript.js";

// SpeechHandle exposes waitForPlayout(); typed loosely so the wrap path can await
// the goodbye finishing before we close, without depending on its exact type.
interface PlayoutHandle {
  waitForPlayout?: () => Promise<void>;
}
async function waitForPlayout(handle: unknown): Promise<void> {
  const h = handle as PlayoutHandle;
  if (typeof h?.waitForPlayout === "function") {
    try {
      await h.waitForPlayout();
    } catch {
      /* interrupted/closed — proceed to end */
    }
  }
}

export default defineAgent({
  // Load Silero VAD once per worker process, not per call.
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    // Parse the dispatch script. Malformed metadata aborts the job rather than
    // improvising an interview.
    let job;
    try {
      job = parseJob(ctx.job.metadata ?? "");
    } catch (err) {
      console.error("[entry] aborting job — bad metadata:", err);
      return;
    }

    // Declared up front so the close handler (which may fire before the cap is
    // armed, e.g. an immediate disconnect) can clear it without a TDZ error.
    const capTimer: { current?: ReturnType<typeof setTimeout> } = {};

    const vad = ctx.proc.userData.vad as silero.VAD;
    const models = resolveAgentModelConfig({ persona: job.persona, languageCode: job.languageCode });
    const session = new voice.AgentSession({
      vad,
      stt: new inference.STT({
        model: models.stt.model,
        language: models.stt.language,
      }),
      llm: new inference.LLM({ model: models.llm.model }),
      tts: new inference.TTS({ model: models.tts.model, voice: models.tts.voice, language: models.tts.language }),
      // The turn-detection model decides end-of-turn so the interviewer doesn't
      // talk over the candidate.
      turnHandling: { turnDetection: new livekit.turnDetector.MultilingualModel() },
    });

    // Single end path shared by the tool and the time cap. `reason` stays null
    // until one of them fires; on close, null => the candidate bailed (abandoned).
    const control: { reason: EndReason | null; ended: boolean } = { reason: null, ended: false };
    const end = async (reason: EndReason): Promise<void> => {
      if (control.ended) return; // guard double-close (tool vs time cap)
      control.ended = true;
      control.reason = reason;
      await session.close();
    };

    // Post exactly once. Both the close event and the shutdown backstop call this;
    // the server endpoint is idempotent, and `posted` keeps us from double-POSTing.
    let posted = false;
    const finalize = async (): Promise<void> => {
      if (posted) return;
      posted = true;
      if (capTimer.current) clearTimeout(capTimer.current);
      const transcript = historyToTurns(session);
      const outcome: Outcome = control.reason ? "completed" : "abandoned";
      try {
        await postSessionEnded({ attemptId: job.attemptId, transcript, outcome });
      } catch (err) {
        console.error("[entry] session-ended callback failed:", err);
      }
    };

    // Primary completion signal. agents-js issue #896: shutdown callbacks can be
    // skipped on some hangups, so the close event is primary and the shutdown
    // callback below is belt-and-suspenders (finalize is idempotent).
    session.on(voice.AgentSessionEventTypes.Close, (ev: { reason?: unknown }) => {
      console.info("[entry] session closed:", ev?.reason, "-> outcome:", control.reason ? "completed" : "abandoned");
      void finalize();
    });
    ctx.addShutdownCallback(async () => {
      await finalize();
    });

    const agent = new InterviewerAgent(job, end);

    await session.start({ agent, room: ctx.room });
    await ctx.connect();

    // Fixed opening line (not LLM-generated), so say() rather than generateReply().
    session.say(firstMessage(job));

    // Hard time cap (the second completion path): warmly wrap, then close as time.
    capTimer.current = setTimeout(async () => {
      if (control.ended) return;
      const handle = session.generateReply({ instructions: "Wrap up warmly now and say goodbye." });
      await waitForPlayout(handle);
      await end("time");
    }, job.maxDurationSeconds * 1000);
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "talkt-interviewer",
  }),
);
