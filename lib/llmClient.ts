import OpenAI from "openai";
import {
  PROVIDERS,
  detectProviderFromKey,
  pickModel,
  providerFor,
  type LlmConfig,
  type ProviderId,
} from "@/lib/llmProviders";
import { isRejectedLlmKey, redactSecrets } from "@/lib/userLlmKey";

export type ModelRole = "main" | "mini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  role?: ModelRole;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
};

export type ChatResponse = {
  choices: { message: { role: string; content: string } }[];
};

export interface NormalizedLlmClient {
  providerId: ProviderId;
  resolveModel(role: ModelRole): string;
  listModels(opts?: { signal?: AbortSignal }): Promise<string[]>;
  chat: {
    completions: {
      create(
        req: ChatRequest,
        opts?: { signal?: AbortSignal },
      ): Promise<ChatResponse>;
    };
  };
}

type ModelMap = { main: string; mini: string };

function openAiCompatible(
  providerId: ProviderId,
  apiKey: string,
  baseURL: string,
  models: ModelMap,
): NormalizedLlmClient {
  const client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 2 });
  const resolveModel = (role: ModelRole) => models[role] || models.main;
  return {
    providerId,
    resolveModel,
    async listModels() {
      const res = await client.models.list();
      return (res.data || []).map((m) => m.id);
    },
    chat: {
      completions: {
        async create(req, opts) {
          const model = req.model || resolveModel(req.role ?? "main");
          const res = await client.chat.completions.create(
            {
              model,
              messages: req.messages,
              temperature: req.temperature,
              max_tokens: req.max_tokens,
            },
            { signal: opts?.signal },
          );
          return {
            choices: (res.choices || []).map((c) => ({
              message: {
                role: c.message?.role ?? "assistant",
                content: c.message?.content ?? "",
              },
            })),
          };
        },
      },
    },
  };
}

function googleClient(apiKey: string, models: ModelMap): NormalizedLlmClient {
  const base = PROVIDERS.google.baseURL;
  const resolveModel = (role: ModelRole) => models[role] || models.main;
  return {
    providerId: "google",
    resolveModel,
    async listModels() {
      const res = await fetch(
        `${base}/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) throw await httpError(res, "google");
      const data = (await res.json()) as { models?: { name?: string }[] };
      return (data.models || []).map((m) =>
        String(m.name || "").replace(/^models\//, ""),
      );
    },
    chat: {
      completions: {
        async create(req, opts) {
          const model = req.model || resolveModel(req.role ?? "main");
          const system = req.messages
            .filter((m) => m.role === "system")
            .map((m) => m.content)
            .join("\n\n");
          const contents = req.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));
          const generationConfig: Record<string, unknown> = {};
          if (typeof req.temperature === "number") {
            generationConfig.temperature = req.temperature;
          }
          if (typeof req.max_tokens === "number") {
            generationConfig.maxOutputTokens = req.max_tokens;
          }
          const body: Record<string, unknown> = { contents, generationConfig };
          if (system) body.systemInstruction = { parts: [{ text: system }] };

          const res = await fetch(
            `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              signal: opts?.signal,
              body: JSON.stringify(body),
            },
          );
          if (!res.ok) throw await httpError(res, "google");
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const content = (data.candidates?.[0]?.content?.parts || [])
            .map((p) => p.text || "")
            .join("");
          return { choices: [{ message: { role: "assistant", content } }] };
        },
      },
    },
  };
}

export function createClient(config: LlmConfig): NormalizedLlmClient {
  const def = providerFor(config.provider);
  const model = config.model || def.defaultModel;
  if (config.provider === "google") {
    return googleClient(config.apiKey, { main: model, mini: model });
  }
  return openAiCompatible("openai", config.apiKey, def.baseURL, {
    main: model,
    mini: model,
  });
}

/** Server-owned client, driven by env vars. Used when no user key is supplied. */
export function createServerClient(): NormalizedLlmClient {
  const main = process.env.OPENAI_MODEL || "gpt-4o";
  const mini =
    process.env.OPENAI_REPAIR_MODEL ||
    process.env.OPENAI_RESEARCH_MODEL ||
    "gpt-4o-mini";
  return openAiCompatible(
    "openai",
    process.env.OPENAI_API_KEY || "missing",
    PROVIDERS.openai.baseURL,
    { main, mini },
  );
}

async function httpError(res: Response, providerId: ProviderId) {
  let detail = "";
  try {
    const json = (await res.json()) as {
      error?: { message?: string };
      message?: string;
    };
    detail = json?.error?.message || json?.message || "";
  } catch {
    try {
      detail = await res.text();
    } catch {
      detail = "";
    }
  }
  const err = new Error(detail || `Request failed (${res.status})`);
  const rejected =
    res.status === 401 ||
    /api key not valid|api_key_invalid|incorrect api key|invalid api key/i.test(
      detail,
    );
  Object.assign(err, { status: res.status, provider: providerId, rejected });
  return err;
}

/** Client-safe, provider-aware message for a failed model call. */
export function describeLlmError(
  err: unknown,
  providerId?: ProviderId,
): string {
  const label = providerId ? providerFor(providerId).label : "The provider";
  const status = (err as { status?: number })?.status;
  const rejected = isRejectedLlmKey(err);
  if (rejected) {
    return `${label} rejected that API key. Check it and try again.`;
  }
  if (status === 402) {
    return `${label} says the account has no credit. Check billing and try again.`;
  }
  if (status === 404) {
    return `${label} doesn't recognise that model. Choose another model.`;
  }
  if (status === 429) {
    return `${label} is rate limiting this key. Wait a moment and try again.`;
  }
  if (typeof status === "number" && status >= 500) {
    return `${label} had a server error. Try again shortly.`;
  }
  const raw = err instanceof Error ? err.message : "";
  if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout|aborted/i.test(raw)) {
    return `Couldn't reach ${label}. Check your connection and try again.`;
  }
  const clean = redactSecrets(raw).replace(/\s+/g, " ").trim().slice(0, 200);
  return clean || `${label} request failed.`;
}

export type LlmConfigInput = {
  apiKey: string;
  provider?: ProviderId | null;
  model?: string;
};

/**
 * Verifies a key with a cheap model-list call and returns a ready config.
 * Detection from the key shape picks the provider; when unknown, both known
 * providers are tried so the caller never has to ask.
 */
export async function resolveLlmConfig(
  input: LlmConfigInput,
): Promise<{ config: LlmConfig | null; error: string | null; models: string[] }> {
  const candidates: ProviderId[] = input.provider
    ? [input.provider]
    : (() => {
        const detected = detectProviderFromKey(input.apiKey);
        return detected ? [detected] : ["openai", "google"];
      })();

  let lastError: unknown = null;
  for (const providerId of candidates) {
    const def = providerFor(providerId);
    const draft: LlmConfig = {
      provider: providerId,
      apiKey: input.apiKey,
      model: input.model?.trim() || def.defaultModel,
    };
    try {
      const client = createClient(draft);
      const models = await client.listModels();
      const model = input.model?.trim() || pickModel(models, providerId) || def.defaultModel;
      return { config: { ...draft, model }, error: null, models };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    config: null,
    error: describeLlmError(lastError, candidates[0]),
    models: [],
  };
}
