export const STARTING_CREDITS = 2;
export const ANON_TRIAL_CREDITS = 1;
export const CREDIT_COST = 1;

export type Account = {
  email: string;
  credits: number;
};

type Ledger = Record<string, Account>;

const USER_KEY = "debrief.session";
const LEDGER_KEY = "debrief.ledger";
const ANON_KEY = "debrief.anonCredits";
export const PENDING_IDEA_KEY = "debrief.pendingIdea";

function readAnonCreditsRaw(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (raw === null) return ANON_TRIAL_CREDITS;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

export function readAnonCredits(): number {
  return readAnonCreditsRaw() ?? 0;
}

export function spendAnonCredit(cost = CREDIT_COST): number {
  const current = readAnonCreditsRaw() ?? 0;
  if (current < cost) throw new Error("No free trials left.");
  const next = current - cost;
  localStorage.setItem(ANON_KEY, String(next));
  return next;
}

export function refundAnonCredit(cost = CREDIT_COST): number {
  const current = readAnonCreditsRaw() ?? 0;
  const next = current + cost;
  localStorage.setItem(ANON_KEY, String(next));
  return next;
}

function readLedger(): Ledger {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as Ledger) : {};
  } catch {
    return {};
  }
}

function writeLedger(ledger: Ledger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

export function readSession(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const email = localStorage.getItem(USER_KEY);
    if (!email) return null;
    return readLedger()[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function continueWithEmail(emailRaw: string): Account {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email.");
  }
  const ledger = readLedger();
  if (!ledger[email]) {
    ledger[email] = { email, credits: STARTING_CREDITS };
    writeLedger(ledger);
  }
  localStorage.setItem(USER_KEY, email);
  return ledger[email];
}

export function signOutSession() {
  localStorage.removeItem(USER_KEY);
}

export function spendCredit(email: string, cost = CREDIT_COST): Account {
  const ledger = readLedger();
  const key = email.toLowerCase();
  const account = ledger[key];
  if (!account) throw new Error("Sign in to run a briefing.");
  if (account.credits < cost) throw new Error("No briefings left.");
  account.credits -= cost;
  ledger[key] = account;
  writeLedger(ledger);
  return account;
}

export function refundCredit(email: string, cost = CREDIT_COST): Account | null {
  const ledger = readLedger();
  const key = email.toLowerCase();
  const account = ledger[key];
  if (!account) return null;
  account.credits += cost;
  ledger[key] = account;
  writeLedger(ledger);
  return account;
}
