export function titleFromIdeaText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed.slice(0, 60).trim();
}

export function fillFormFromQuick<T extends { title: string; description: string }>(
  prev: T,
  quick: string,
): T {
  const text = quick.trim();
  if (!text) return prev;
  return {
    ...prev,
    title: prev.title.trim() || titleFromIdeaText(text),
    description: prev.description.trim() || text,
  };
}
