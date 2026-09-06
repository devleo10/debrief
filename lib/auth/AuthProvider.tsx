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
import AuthGate from "@/components/AuthGate";

type AuthContextValue = {
  user: Account | null;
  ready: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  continueEmail: (email: string) => Account;
  signOut: () => void;
  spend: () => Account;
  refund: () => void;
  startingCredits: number;
  creditCost: number;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    setUser(readSession());
    setReady(true);
  }, []);

  const continueEmail = useCallback((email: string) => {
    const account = continueWithEmail(email);
    setUser(account);
    setAuthOpen(false);
    return account;
  }, []);

  const signOut = useCallback(() => {
    signOutSession();
    setUser(null);
  }, []);

  const spend = useCallback(() => {
    if (!user) throw new Error("Sign in to run a briefing.");
    const next = spendCredit(user.email);
    setUser(next);
    return next;
  }, [user]);

  const refund = useCallback(() => {
    if (!user) return;
    const next = refundCredit(user.email);
    if (next) setUser(next);
  }, [user]);

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
      startingCredits: STARTING_CREDITS,
      creditCost: CREDIT_COST,
    }),
    [user, ready, authOpen, continueEmail, signOut, spend, refund],
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
