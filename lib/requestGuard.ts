export const MAX_BODY_BYTES = 64 * 1024;

/** Prefer the platform IP. Fall back to the last XFF hop, not the first (spoofable) one. */
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || "unknown";
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function originAllowed(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export async function readJsonCapped(
  req: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > maxBytes) {
    throw new Error("payload too large");
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("payload too large");
  }
  return JSON.parse(new TextDecoder().decode(buf));
}
