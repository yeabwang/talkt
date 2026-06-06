import "server-only";

// Server-only Vapi client. Holds VAPI_PRIVATE_KEY — never import from a client
// component. Creates and deletes the ephemeral per-attempt assistant.
import { VapiClient } from "@vapi-ai/server-sdk";

import type { AssistantPayload } from "@/lib/vapi/assistant";

let client: VapiClient | null = null;

function getClient(): VapiClient {
  const token = process.env.VAPI_PRIVATE_KEY;
  if (!token) throw new Error("VAPI_PRIVATE_KEY is not set — cannot create the interview assistant.");
  client ??= new VapiClient({ token });
  return client;
}

/** Create the ephemeral assistant; returns its id. */
export async function createAssistant(payload: AssistantPayload): Promise<string> {
  // The SDK's create type is a broad union; our payload is a precise subset.
  const created = await getClient().assistants.create(payload as never);
  if (!created?.id) throw new Error("Vapi assistant creation returned no id.");
  return created.id;
}

/** Best-effort delete of the ephemeral assistant (called from the webhook). */
export async function deleteAssistant(assistantId: string): Promise<void> {
  // NOTE: SDK's assistants.delete() takes { id: string }, not a plain string.
  try {
    await getClient().assistants.delete({ id: assistantId });
  } catch (err) {
    console.error("[vapi] assistant delete failed:", assistantId, err);
  }
}
