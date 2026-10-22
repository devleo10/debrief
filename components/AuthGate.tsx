"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearPendingIdea, readPendingIdea, useAuth } from "@/lib/auth/AuthProvider";

export default function AuthGate() {
  const {
    authOpen,
    closeAuth,
    continueEmail,
    continueGoogle,
    startingCredits,
    usingSupabase,
  } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!authOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await continueEmail(email);
      if (usingSupabase) {
        setSent(true);
        return;
      }
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
        <p className="auth-kicker">
          {usingSupabase ? "Account required" : "On this device"}
        </p>
        <h2 id="auth-title">
          {sent
            ? "Check your email."
            : usingSupabase
              ? "Sign in to run the panel."
              : "Continue with email on this device."}
        </h2>
        <p className="auth-sub">
          {sent ? (
            <>We sent a sign-in link to <strong>{email.trim().toLowerCase()}</strong>. Open it on this device to continue.</>
          ) : usingSupabase ? (
            <>
              The box is open so you can write. The verdict needs an account.
              {startingCredits} free briefings on first sign-in.
            </>
          ) : (
            <>
              No password, no server account. We store this email and your remaining
              briefings in this browser. {startingCredits} free briefings the first
              time.
            </>
          )}
        </p>
        {!sent && usingSupabase ? (
          <button
            type="button"
            className="auth-google"
            onClick={() => {
              setError("");
              void continueGoogle().catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Could not continue.");
              });
            }}
          >
            Continue with Google
          </button>
        ) : null}
        {!sent ? (
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
              {usingSupabase ? "Send sign-in link" : "Continue on this device"}
            </button>
          </form>
        ) : (
          <button type="button" className="dx-cta auth-go" onClick={closeAuth}>
            Got it
          </button>
        )}
        {!sent ? (
          <p className="auth-fine">
            {usingSupabase
              ? "Same email later restores your remaining credits."
              : "Same email in this browser restores remaining credits. Clearing site data signs you out."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
