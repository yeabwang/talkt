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

import { postSessionEnded, type Outcome } from "./callback";
import { type EndReason, InterviewerAgent } from "./interviewer";
import { parseJob } from "./job";
import { firstMessage } from "./prompt";
import { historyToTurns } from "./transcript";
import { selectVoice } from "./voices";

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
    let capTimer: ReturnType<typeof setTimeout> | undefined;

    const vad = ctx.proc.userData.vad as silero.VAD;
    // Voice is selected by language + persona (agent/src/voices.ts), not hardcoded;
    // the language hint makes the multilingual voice speak the interview language.
    const ttsVoice = selectVoice(job.persona, job.languageCode);
    const session = new voice.AgentSession({
      vad,
      // [VERIFY] Inference model ids (docs.livekit.io, 2026-06-05). nova-3 has the
      // widest language coverage; English uses the en model, others go multilingual.
      stt: new inference.STT({
        model: "deepgram/nova-3",
        language: job.languageCode === "en" ? "en" : "multi",
      }),
      llm: new inference.LLM({ model: "openai/gpt-5.3-chat-latest" }),
      tts: new inference.TTS({ model: ttsVoice.model, voice: ttsVoice.voice, language: ttsVoice.language }),
      // Replaces Vapi's speakingPlans: the turn-detection model decides end-of-turn
      // so the interviewer doesn't talk over the candidate.
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
      if (capTimer) clearTimeout(capTimer);
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
    capTimer = setTimeout(async () => {
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
