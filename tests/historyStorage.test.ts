import { beforeEach, describe, expect, it } from "vitest";
import { clearHistory, loadHistory, prependHistory, saveHistory } from "@/lib/historyStorage";
import type { HistoryEntry } from "@/lib/types";
import { emptyScores } from "@/lib/extractScores";

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    title: "AI standup bot",
    description: "Summarizes Slack standups automatically.",
    date: "2026-08-26T10:00:00.000Z",
    verdict: "PIVOT",
    overall: 5,
    agents: [],
    synthesis: { output: "readout", scores: emptyScores() },
    ...overrides,
  };
}

describe("historyStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearHistory();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("round-trips entries through save and load", () => {
    saveHistory([makeEntry()]);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("AI standup bot");
  });

  it("caps stored entries at 20, keeping the newest", () => {
    const entries = Array.from({ length: 25 }, (_, i) =>
      makeEntry({ title: `idea ${i}`, date: new Date(i).toISOString() })
    );
    const saved = saveHistory(entries);
    expect(saved).toHaveLength(20);
    expect(saved[0].title).toBe("idea 0");
  });

  it("survives corrupted JSON in storage", () => {
    localStorage.setItem("idea-validator-history", "{not json");
    expect(loadHistory()).toEqual([]);
  });

  it("ignores non-array payloads", () => {
    localStorage.setItem("idea-validator-history", JSON.stringify({ oops: true }));
    expect(loadHistory()).toEqual([]);
  });

  describe("prependHistory", () => {
    it("adds the new entry at the front", () => {
      const first = prependHistory(makeEntry({ title: "old" }), []);
      const second = prependHistory(makeEntry({ title: "new" }), first);
      expect(second.map((e) => e.title)).toEqual(["new", "old"]);
    });

    it("dedupes on normalized title + description", () => {
      const existing = [makeEntry()];
      const updated = prependHistory(makeEntry({ verdict: "KILL IT", overall: 2 }), existing);
      expect(updated).toHaveLength(1);
      expect(updated[0].verdict).toBe("KILL IT");
      expect(updated[0].overall).toBe(2);
    });

    it("treats case and surrounding whitespace as equivalent when deduping", () => {
      const existing = [makeEntry({ title: "  AI Standup Bot " })];
      const updated = prependHistory(makeEntry({ title: "ai standup bot" }), existing);
      expect(updated).toHaveLength(1);
    });
  });
});
