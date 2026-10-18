import { AsyncLocalStorage } from "node:async_hooks";
import OpenAI from "openai";
import { isRejectedLlmKey } from "@/lib/userLlmKey";

const requestClient = new AsyncLocalStorage<OpenAI>();

let serverClient: OpenAI | null = null;

function createClient(apiKey: string, maxRetries = 2) {
  return new OpenAI({
    apiKey,
    timeout: 60_000,
    maxRetries,
  });
}

/** Lazy so `next build` can import the route without OPENAI_API_KEY in CI. */
export function getOpenAI() {
  const scoped = requestClient.getStore();
  if (scoped) return scoped;
  if (!serverClient) {
    serverClient = createClient(process.env.OPENAI_API_KEY || "missing");
  }
  return serverClient;
}

/** Uses the caller's key for every model call inside `fn`, including streamed work. */
export function runWithUserLlmKey<T>(apiKey: string | null, fn: () => T): T {
  if (!apiKey) return fn();
  return requestClient.run(createClient(apiKey), fn);
}

/**
 * One cheap completion before search, so a bad key does not spend research quota.
 * Returns a client-safe error, or null when the key can run a briefing.
 */
export async function probeOpenAIKey(apiKey: string): Promise<string | null> {
  const client = new OpenAI({
    apiKey,
    timeout: 20_000,
    maxRetries: 0,
  });
  try {
    await client.chat.completions.create({
      model: process.env.OPENAI_RESEARCH_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
    });
    return null;
  } catch (err) {
    if (isRejectedLlmKey(err)) {
      return "OpenAI rejected that API key. Check it and try again.";
    }
    return "Could not reach OpenAI with that key. Check billing and model access, then try again.";
  }
}
