import { AsyncLocalStorage } from "node:async_hooks";
import {
  createClient,
  createServerClient,
  type NormalizedLlmClient,
} from "@/lib/llmClient";
import type { LlmConfig } from "@/lib/llmProviders";

const requestClient = new AsyncLocalStorage<NormalizedLlmClient>();

let serverClient: NormalizedLlmClient | null = null;

/** Lazy so `next build` can import the route without OPENAI_API_KEY in CI. */
export function getOpenAI(): NormalizedLlmClient {
  const scoped = requestClient.getStore();
  if (scoped) return scoped;
  if (!serverClient) serverClient = createServerClient();
  return serverClient;
}

/** Uses the caller's provider/key for every model call inside `fn`. */
export function runWithUserLlmConfig<T>(
  config: LlmConfig | null,
  fn: () => T,
): T {
  if (!config) return fn();
  return requestClient.run(createClient(config), fn);
}

export type { NormalizedLlmClient };
