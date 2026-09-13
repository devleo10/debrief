import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BODY_BYTES,
  originAllowed,
  readJsonCapped,
} from "@/lib/requestGuard";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("originAllowed", () => {
  it("requires a matching origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new Request("https://debrief.example/api/start", {
      method: "POST",
      headers: {
        host: "debrief.example",
        origin: "https://evil.example",
      },
    });
    expect(originAllowed(req)).toBe(false);
  });

  it("allows the same host in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new Request("https://debrief.example/api/start", {
      method: "POST",
      headers: {
        host: "debrief.example",
        origin: "https://debrief.example",
      },
    });
    expect(originAllowed(req)).toBe(true);
  });
});

describe("readJsonCapped", () => {
  it("rejects oversize content-length before reading the rest", async () => {
    const req = new Request("http://localhost/api/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_BODY_BYTES + 1),
      },
      body: "{}",
    });
    await expect(readJsonCapped(req)).rejects.toThrow("payload too large");
  });
});
