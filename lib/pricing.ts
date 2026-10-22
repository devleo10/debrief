/** Public prices. A run on our keys is about 40¢ (search plus models). */

export type BriefingPack = {
  id: "five" | "fifteen" | "forty";
  credits: number;
  /** Smallest currency unit (USD cents). */
  priceCents: number;
  name: string;
};

export const BRIEFING_PACKS: readonly BriefingPack[] = [
  { id: "five", credits: 5, priceCents: 500, name: "Five briefings" },
  { id: "fifteen", credits: 15, priceCents: 1200, name: "Fifteen briefings" },
  { id: "forty", credits: 40, priceCents: 2400, name: "Forty briefings" },
];

export function briefingPack(id: string | undefined | null): BriefingPack | null {
  if (!id) return null;
  return BRIEFING_PACKS.find((pack) => pack.id === id) ?? null;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Whole cents per briefing. Packs divide evenly. */
export function unitCents(pack: BriefingPack): number {
  return pack.priceCents / pack.credits;
}

export function unitLabel(pack: BriefingPack): string {
  const cents = unitCents(pack);
  if (cents >= 100) return formatUsd(cents);
  return `${cents}¢`;
}
