"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  continueWithEmail,
  CREDIT_COST,
  PENDING_IDEA_KEY,
  readSession,
  refundCredit,
  signOutSession,
  spendCredit,
  STARTING_CREDITS,
  type Account,
} from "./store";
import { sanitizeAuthNextPath } from "./safeRedirect";
import AuthGate from "@/components/AuthGate";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type AuthContextValue = {
  user: Account | null;
  ready: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  continueEmail: (email: string) => Promise<Account>;
  signOut: () => Promise<void>;
  spend: () => Account;
  refund: () => void;
  refreshProfile: () => Promise<void>;
  startingCredits: number;
  creditCost: number;
  usingSupabase: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildAuthCallbackUrl(nextPath: string): string {
  const next = sanitizeAuthNextPath(nextPath);
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const usingSupabase = isSupabaseAuthConfigured();
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!usingSupabase) {
      setUser(readSession());
      return;
    }

    const res = await fetch("/api/account", { credentials: "same-origin" });
    if (res.status === 401) {
      setUser(null);
      return;
    }
    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = (await res.json()) as Account;
    setUser(data);
  }, [usingSupabase]);

  useEffect(() => {
    if (!usingSupabase) {
      setUser(readSession());
      setReady(true);
      return;
    }

    const supabase = createClient();
    let active = true;

    const sync = async () => {
      try {
        await refreshProfile();
      } finally {
        if (active) setReady(true);
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [usingSupabase, refreshProfile]);

  const continueEmail = useCallback(
    async (email: string) => {
      if (!usingSupabase) {
        const account = continueWithEmail(email);
        setUser(account);
        setAuthOpen(false);
        return account;
      }

      const supabase = createClient();
      const normalized = email.trim().toLowerCase();
      if (!normalized || !normalized.includes("@")) {
        throw new Error("Enter a valid email.");
      }

      const pending = readPendingIdea().trim();
      const nextPath = pending
        ? `/brief?idea=${encodeURIComponent(pending)}&autostart=1`
        : "/brief";

      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(nextPath),
        },
      });

      if (error) throw new Error(error.message);

      setAuthOpen(false);
      return { email: normalized, credits: STARTING_CREDITS };
    },
    [usingSupabase],
  );

  const signOut = useCallback(async () => {
    if (!usingSupabase) {
      signOutSession();
      setUser(null);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, [usingSupabase]);

  const spend = useCallback(() => {
    if (usingSupabase) {
      throw new Error("Credits are spent when the briefing starts.");
    }
    if (!user) throw new Error("Sign in to run a briefing.");
    const next = spendCredit(user.email);
    setUser(next);
    return next;
  }, [usingSupabase, user]);

  const refund = useCallback(() => {
    if (usingSupabase) return;
    if (!user) return;
    const next = refundCredit(user.email);
    if (next) setUser(next);
  }, [usingSupabase, user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      continueEmail,
      signOut,
      spend,
      refund,
      refreshProfile,
      startingCredits: STARTING_CREDITS,
      creditCost: CREDIT_COST,
      usingSupabase,
    }),
    [
      user,
      ready,
      authOpen,
      continueEmail,
      signOut,
      spend,
      refund,
      refreshProfile,
      usingSupabase,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthGate />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function readPendingIdea() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PENDING_IDEA_KEY) || "";
}

export function writePendingIdea(idea: string) {
  sessionStorage.setItem(PENDING_IDEA_KEY, idea);
}

export function clearPendingIdea() {
  sessionStorage.removeItem(PENDING_IDEA_KEY);
}
