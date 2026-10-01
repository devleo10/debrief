/** Only allow same-origin relative paths in auth redirects. */
export function sanitizeAuthNextPath(next: string | null, fallback = "/brief"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}
