import { beforeEach, describe, expect, it } from "vitest";
import {
  continueWithEmail,
  refundCredit,
  signOutSession,
  spendCredit,
  STARTING_CREDITS,
} from "@/lib/auth/store";

describe("auth store credits", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts a device session with two credits", () => {
    const account = continueWithEmail("founder@example.com");
    expect(account.credits).toBe(STARTING_CREDITS);
  });

  it("refunds a spend so cancel and errors do not eat a briefing", () => {
    continueWithEmail("founder@example.com");
    spendCredit("founder@example.com");
    const refunded = refundCredit("founder@example.com");
    expect(refunded?.credits).toBe(STARTING_CREDITS);
  });

  it("keeps the ledger after sign-out on this device", () => {
    continueWithEmail("founder@example.com");
    spendCredit("founder@example.com");
    signOutSession();
    const restored = continueWithEmail("founder@example.com");
    expect(restored.credits).toBe(STARTING_CREDITS - 1);
  });
});
