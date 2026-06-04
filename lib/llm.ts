// DeepSeek (OpenAI-compatible) chat client.
// Robust JSON mode: forces a JSON object response, strips stray fences,
// parses, and retries with exponential backoff + jitter on transport/parse
// failure. Server-only — never import from a client component.

// Accept either the generic LLM_* names or the provider-specific DEEPSEEK_*
// names used in .env.example — whichever is set.
const API_KEY = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
const BASE_URL = (process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatJSONOptions {
  temperature?: number;
  maxRetries?: number;
  maxTokens?: number;
}

/**
 * Calls the LLM and returns the parsed JSON object from its reply.
 * Throws if the model is unreachable or never returns valid JSON.
 */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  { temperature = 0.7, maxRetries = 3, maxTokens }: ChatJSONOptions = {},
): Promise<T> {
  if (!API_KEY) throw new Error("LLM_API_KEY (or DEEPSEEK_API_KEY) is not set");

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature,
          response_format: { type: "json_object" },
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
          messages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`LLM ${response.status}: ${detail.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM returned an empty completion");

      return parseJSONObject<T>(content);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const backoff = 400 * 2 ** attempt + Math.random() * 250;
        await sleep(backoff);
      }
    }
  }

  throw new Error(`LLM request failed after ${maxRetries} attempts: ${String(lastError)}`);
}

// Strip ```json fences if a model wraps the object, then parse. Falls back to
// the first {...} span so a stray prose preamble can't break the turn.
function parseJSONObject<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("LLM response was not valid JSON");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
