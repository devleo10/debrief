import { describe, expect, it } from "vitest";
import { fillFormFromQuick, titleFromIdeaText } from "@/lib/ideaDraft";

describe("fillFormFromQuick", () => {
  it("copies a quick idea into empty title and description", () => {
    const next = fillFormFromQuick(
      { title: "", description: "" },
      "AI calendar for freelance designers that reads client emails.",
    );
    expect(next.title).toBe("AI calendar for freelance designers that reads client emails");
    expect(next.description).toContain("AI calendar for freelance designers");
  });

  it("does not overwrite fields the founder already filled", () => {
    const next = fillFormFromQuick(
      { title: "Kept title", description: "Kept description" },
      "A totally different idea",
    );
    expect(next.title).toBe("Kept title");
    expect(next.description).toBe("Kept description");
  });

  it("leaves the form alone when the quick box is empty", () => {
    const next = fillFormFromQuick({ title: "", description: "" }, "   ");
    expect(next.title).toBe("");
    expect(next.description).toBe("");
  });
});

describe("titleFromIdeaText", () => {
  it("uses the first sentence", () => {
    expect(titleFromIdeaText("First. Second")).toBe("First");
  });
});
