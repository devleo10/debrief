/**
 * Tolerant JSON extraction for LLM output. Models wrap JSON in markdown
 * fences, add trailing commas, or prepend prose; this recovers all of it.
 */
export function parseJson(text: string): { data: any; error?: string } {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();

  try {
    return { data: JSON.parse(cleaned) };
  } catch {}

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return { data: JSON.parse(objMatch[0].replace(/,\s*([}\]])/g, "$1")) };
    } catch {}
  }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return { data: JSON.parse(arrMatch[0].replace(/,\s*([}\]])/g, "$1")) };
    } catch {}
  }

  return { data: null, error: `Failed to parse LLM output as JSON` };
}
