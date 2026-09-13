const INSTRUCTION_LINE =
  /^\s*(ignore (all |any )?previous instructions|you are now|system prompt:|do not follow|new instructions:).*$/gim;

/** Bound scraped markdown and drop instruction-shaped lines before the LLM sees it. */
export function quarantineScrapedMarkdown(
  markdown: string,
  maxChars = 4_000,
): string {
  return markdown
    .replace(INSTRUCTION_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}
