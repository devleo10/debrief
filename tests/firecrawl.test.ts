import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firecrawlEnabled,
  pricingPageUrls,
  scrapeUrl,
} from "@/lib/research/firecrawl";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("pricingPageUrls", () => {
  it("prefers search hits that are already pricing pages", () => {
    const urls = pricingPageUrls(
      [{ url: "https://calendly.com/" }],
      [
        { url: "https://calendly.com/pricing" },
        { url: "https://twitter.com/calendly/status/1" },
      ],
    );
    expect(urls[0]).toBe("https://calendly.com/pricing");
    expect(urls).not.toContain("https://twitter.com/calendly/status/1");
  });

  it("derives /pricing from a competitor homepage", () => {
    const urls = pricingPageUrls([{ url: "https://geekbot.com/features" }], []);
    expect(urls).toEqual(["https://geekbot.com/pricing"]);
  });
});

describe("firecrawlEnabled", () => {
  it("is off when FIRECRAWL_DISABLED=1", () => {
    vi.stubEnv("FIRECRAWL_DISABLED", "1");
    vi.stubEnv("VITEST", "");
    expect(firecrawlEnabled()).toBe(false);
  });
});

describe("scrapeUrl", () => {
  it("returns markdown from a v2 success body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { markdown: "# Standard\n$10 / seat" },
        }),
      })),
    );
    const page = await scrapeUrl("https://calendly.com/pricing");
    expect(page?.markdown).toContain("$10");
    expect(page?.url).toBe("https://calendly.com/pricing");
  });

  it("returns null on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })),
    );
    expect(await scrapeUrl("https://example.com/pricing")).toBeNull();
  });
});
