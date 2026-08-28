export function liveSearchConfigured(): boolean {
  return Boolean(
    process.env.EXA_API_KEY?.trim() || process.env.TAVILY_API_KEY?.trim(),
  );
}

/** Production must use Exa or Tavily. Set ALLOW_MOCK_SEARCH=1 only for staging. */
export function mockSearchAllowed(): boolean {
  if (process.env.ALLOW_MOCK_SEARCH === "1") return true;
  return process.env.NODE_ENV !== "production";
}
