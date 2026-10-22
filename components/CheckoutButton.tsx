"use client";

import { useState } from "react";

export default function CheckoutButton({
  label = "Buy more briefings",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Could not start checkout.");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setLoading(false);
    }
  };

  return (
    <span className="checkout-action">
      <button type="button" className="nav-btn" onClick={() => void start()} disabled={loading}>
        {loading ? "Opening checkout…" : label}
      </button>
      {error ? (
        <span className="checkout-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
