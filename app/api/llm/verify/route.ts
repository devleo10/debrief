import { resolveLlmConfig } from "@/lib/llmClient";
import { isProviderId } from "@/lib/llmProviders";
import { parseLlmKeyInput } from "@/lib/userLlmKey";
import { clientIp, originAllowed, readJsonCapped } from "@/lib/requestGuard";
import { verifyKeyLimiter } from "@/lib/rateLimit";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (!originAllowed(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req.headers);
  if (!verifyKeyLimiter.check(ip)) {
    return Response.json(
      { error: "Too many key checks. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await readJsonCapped(req);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (err) {
    const tooLarge = (err as Error)?.message === "payload too large";
    return Response.json(
      { error: tooLarge ? "Request too large" : "Invalid JSON body" },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const { key, error } = parseLlmKeyInput(body.llmKey);
  if (error) return Response.json({ error }, { status: 400 });
  if (!key) {
    return Response.json({ error: "Paste an API key first." }, { status: 400 });
  }

  const provider = isProviderId(body.llmProvider) ? body.llmProvider : null;
  const model =
    typeof body.llmModel === "string" ? body.llmModel.trim().slice(0, 120) : "";

  const resolved = await resolveLlmConfig({ apiKey: key, provider, model });
  if (resolved.error || !resolved.config) {
    return Response.json(
      { error: resolved.error || "That API key didn't work." },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    provider: resolved.config.provider,
    model: resolved.config.model,
    models: resolved.models.slice(0, 40),
  });
}
