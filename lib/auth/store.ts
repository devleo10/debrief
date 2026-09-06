export const STARTING_CREDITS = 2;
export const CREDIT_COST = 1;

export type Account = {
  email: string;
  credits: number;
};

type Ledger = Record<string, Account>;

const USER_KEY = "debrief.session";
const LEDGER_KEY = "debrief.ledger";
export const PENDING_IDEA_KEY = "debrief.pendingIdea";

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
