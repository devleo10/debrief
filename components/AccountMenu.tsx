"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

export default function AccountMenu() {
  const { user, ready, openAuth, signOut } = useAuth();
  if (!ready || !user) {
    return (
      <button type="button" className="nav-btn" onClick={ready ? openAuth : undefined} disabled={!ready}>
        Sign in
      </button>
    );
  }

  return (
    <div className="account-menu">
      <span className="credit-pill">{user.credits} left</span>
      <button type="button" className="nav-btn" onClick={signOut}>
        {user.email.split("@")[0]}
      </button>
    </div>
  );
}
