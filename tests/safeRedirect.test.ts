import { describe, expect, it } from "vitest";
import { sanitizeAuthNextPath } from "@/lib/auth/safeRedirect";

describe("sanitizeAuthNextPath", () => {
  it("allows internal brief paths", () => {
    expect(sanitizeAuthNextPath("/brief?idea=hello&autostart=1")).toBe(
      "/brief?idea=hello&autostart=1",
    );
  });

  it("blocks open redirects", () => {
    expect(sanitizeAuthNextPath("//evil.com")).toBe("/brief");
    expect(sanitizeAuthNextPath("https://evil.com")).toBe("/brief");
  });
});
