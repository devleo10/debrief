"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearPendingIdea, readPendingIdea, useAuth } from "@/lib/auth/AuthProvider";

export default function AuthGate() {
  const { authOpen, closeAuth, continueEmail, startingCredits } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!authOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      continueEmail(email);
      const pending = readPendingIdea();
      clearPendingIdea();
      if (pending.trim()) {
        router.push(`/brief?idea=${encodeURIComponent(pending.trim())}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.");
    }
  };

  return (
    <div className="auth-scrim" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-scrim-bg" type="button" aria-label="Close" onClick={closeAuth} />
      <div className="auth-card">
        <p className="auth-kicker">On this device</p>
        <h2 id="auth-title">Continue with email on this device.</h2>
        <p className="auth-sub">
          No password, no server account. We store this email and your remaining
          briefings in this browser. {startingCredits} free briefings the first
          time.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="dx-cta auth-go">
            Continue on this device
          </button>
        </form>
        <p className="auth-fine">
          Same email in this browser restores remaining credits. Clearing site
          data signs you out.
        </p>
      </div>
    </div>
  );
}
