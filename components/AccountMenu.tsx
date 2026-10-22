"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useStoredLlmConfig } from "@/lib/useStoredLlmConfig";
import { providerFor } from "@/lib/llmProviders";
import LlmKeyField from "@/components/LlmKeyField";

export default function AccountMenu() {
  const { user, ready, openAuth, signOut } = useAuth();
  const { config } = useStoredLlmConfig();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!ready || !user) {
    return (
      <button
        type="button"
        className="nav-btn"
        onClick={ready ? openAuth : undefined}
        disabled={!ready}
      >
        Sign in
      </button>
    );
  }

  const providerLabel = config ? providerFor(config.provider).label : null;

  return (
    <div className="account-menu" ref={menuRef}>
      {config ? (
        <button
          type="button"
          className="own-key-pill"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          title={
            config.model ? `${providerLabel} · ${config.model}` : providerLabel ?? ""
          }
        >
          Own key{providerLabel ? ` · ${providerLabel}` : ""}
        </button>
      ) : (
        <button
          type="button"
          className="nav-btn"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Use own key
        </button>
      )}
      <span className={`credit-pill${config ? " credit-pill-muted" : ""}`}>
        {user.credits} {config ? "credits unused" : "left"}
      </span>
      <button type="button" className="nav-btn" onClick={() => void signOut()}>
        {user.email.split("@")[0]}
      </button>
      {open ? (
        <div
          className="account-menu-panel"
          role="dialog"
          aria-label="Your API key"
        >
          <p className="account-menu-panel-title">Your API key</p>
          <LlmKeyField />
          <Link href="/buy" className="nav-btn" onClick={() => setOpen(false)}>
            Buy briefings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
