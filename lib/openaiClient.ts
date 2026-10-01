import OpenAI from "openai";

let client: OpenAI | null = null;

/** Lazy so `next build` can import the route without OPENAI_API_KEY in CI. */
export function getOpenAI() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "missing",
      timeout: 60_000,
      maxRetries: 2,
    });
  }
  return client;
}
