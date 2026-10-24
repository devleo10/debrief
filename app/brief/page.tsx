"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Logo from "@/components/Logo";
import {
  Search,
  DollarSign,
  BarChart3,
  Target,
  Megaphone,
  Compass,
  Rocket,
  Code2,
  Mic,
  Square,
  ArrowRight,
  ChevronLeft,
  X,
} from "lucide-react";
import { agentOrder, agentMetaMap } from "@/lib/agentMeta";
import { extractVerdict } from "@/lib/extractVerdict";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { stripStructuredBlocks } from "@/lib/extractScores";
import {
  buildReportMarkdown,
  downloadReportMarkdown,
  type ReportInput,
} from "@/lib/reportMarkdown";
import type { ResearchResult } from "@/lib/research/types";
import {
  loadHistory,
  prependHistory,
  clearHistory,
} from "@/lib/historyStorage";
import type {
  AgentResult,
  SynthesisResult,
  HistoryEntry,
  IdeaInput,
} from "@/lib/types";
import HistoryPanel from "@/components/HistoryPanel";
import { ReportErrorBoundary } from "@/components/ReportErrorBoundary";
import LegalFooter from "@/components/LegalFooter";
import AccountMenu from "@/components/AccountMenu";
import { useAuth, writePendingIdea, clearPendingIdea } from "@/lib/auth/AuthProvider";
import {
  refundAnonCredit,
  spendAnonCredit,
  STARTING_CREDITS,
} from "@/lib/auth/store";
import { fillFormFromQuick } from "@/lib/ideaDraft";
import {
  parseReadout,
  previewLine,
  readoutSection,
} from "@/lib/parseReadout";
import { useBriefRun, type ResearchAgentStatus } from "./useBriefRun";
import LlmKeyField from "@/components/LlmKeyField";
import { hasStoredLlmKey } from "@/lib/llmKeyStorage";
const Report = dynamic(() => import("./report/Report"), { ssr: false });
import "../globals.css";
import "./brief.css";

type Phase = "form" | "results";
type InputMode = "quick" | "detailed";

// --- Research agent config (for loading chips) ---

const RESEARCH_AGENTS: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  competitors: { label: "Competitors", icon: <Search size={14} /> },
  github: { label: "GitHub", icon: <Code2 size={14} /> },
  pricing: { label: "Pricing", icon: <DollarSign size={14} /> },
  funding: { label: "Market Data", icon: <BarChart3 size={14} /> },
  gaps: { label: "Pain Points", icon: <Target size={14} /> },
  distribution: { label: "Distribution", icon: <Megaphone size={14} /> },
  positioning: { label: "Positioning", icon: <Compass size={14} /> },
  launch: { label: "Launch Plan", icon: <Rocket size={14} /> },
};

// --- Voice hook ---

// --- Form field definitions ---

type FieldDef = {
  key: keyof typeof initialState;
  label: string;
  placeholder: string;
  textarea?: boolean;
};

const CONTEXT_GROUPS: {
  id: string;
  label: string;
  hint: string;
  fields: FieldDef[];
}[] = [
  {
    id: "user",
    label: "Who it's for",
    hint: "Sharper user = sharper criticism",
    fields: [
      {
        key: "targetUser",
        label: "Target user",
        placeholder: "Solo freelance designers using Gmail + Google Calendar",
      },
      {
        key: "problem",
        label: "Problem",
        placeholder: "The painful job-to-be-done",
        textarea: true,
      },
      {
        key: "successMetric",
        label: "Success metric",
        placeholder: "What proves this is working?",
      },
    ],
  },
  {
    id: "business",
    label: "Solution & business",
    hint: "The VC can't judge what you haven't priced",
    fields: [
      {
        key: "solution",
        label: "Solution",
        placeholder: "How your product solves the problem",
        textarea: true,
      },
      {
        key: "differentiator",
        label: "Differentiator",
        placeholder: "What makes this non-obvious?",
      },
      {
        key: "businessModel",
        label: "Business model",
        placeholder: "SaaS, usage-based, marketplace...",
      },
      {
        key: "pricing",
        label: "Pricing",
        placeholder: "$20/mo, $99/mo, or per-seat",
      },
    ],
  },
  {
    id: "gtm",
    label: "Market & constraints",
    hint: "The Devil's Advocate needs to know what you're up against",
    fields: [
      {
        key: "distribution",
        label: "Distribution",
        placeholder: "How will you get the first 100 users?",
      },
      {
        key: "competitors",
        label: "Competitors",
        placeholder: "Direct and indirect alternatives",
      },
      {
        key: "constraints",
        label: "Constraints",
        placeholder: "Time, budget, compliance, data access",
      },
      {
        key: "timeline",
        label: "Timeline",
        placeholder: "MVP in 4 weeks, beta in 3 months",
      },
      {
        key: "context",
        label: "Anything else",
        placeholder: "Anything else the agents should know",
      },
    ],
  },
];

const OPTIONAL_KEYS = CONTEXT_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const initialState = {
  title: "",
  description: "",
  targetUser: "",
  problem: "",
  solution: "",
  differentiator: "",
  businessModel: "",
  pricing: "",
  distribution: "",
  competitors: "",
  constraints: "",
  successMetric: "",
  timeline: "",
  context: "",
};

const QUICK_EXAMPLES = [
  {
    label: "AI calendar for designers",
    text: "AI calendar for freelance designers that reads client emails and turns project deadlines into calendar blocks",
  },
  {
    label: "Cross-border payments API",
    text: "Cross-border payment API for African SaaS companies selling to US customers",
  },
  {
    label: "Contract review for law firms",
    text: "Contract review workspace for small law firms that summarizes risk and drafts client-ready revisions",
  },
];

const FULL_EXAMPLES: IdeaInput[] = [
  {
    title: "AI calendar assistant for freelance designers",
    description:
      "Reads client emails, proposes project timelines, and auto-creates calendar blocks.",
    targetUser: "Solo freelance designers using Gmail + Google Calendar",
    problem: "Scheduling client work is manual and error-prone.",
    solution:
      "Auto-suggest timelines and calendar blocks from client requests.",
    differentiator: "Designer-specific templates and client-ready timelines.",
    businessModel: "Subscription SaaS",
    pricing: "$15/mo solo, $39/mo for small studios",
    distribution: "Designer communities, YouTube creator partnerships",
    competitors: "Motion.io, Bonsai, Notion templates",
    constraints: "Must integrate Gmail + Google Calendar APIs",
    successMetric: "3+ timelines created in week one",
    timeline: "MVP in 6 weeks",
    context: "Solo dev, targeting Product Hunt launch.",
  },
  {
    title: "Code review bot for pull requests",
    description:
      "AI bot reviews PRs for bugs, style, and security before humans review.",
    targetUser: "Small eng teams (2-10 devs) on GitHub",
    problem: "Reviews are slow and inconsistently catch bugs.",
    solution: "Inline automated review comments with priority labels.",
    differentiator: "Team-specific rules trained on repo history.",
    businessModel: "Per-seat SaaS",
    pricing: "$20/dev/mo",
    distribution: "GitHub Marketplace, DevRel",
    competitors: "CodeRabbit, ReviewGPT",
    constraints: "Must work in private repos",
    successMetric: "Cuts review time by 30%",
    timeline: "Beta in 4 weeks",
    context: "Selling to team leads, already on GitHub Actions.",
  },
];

const DOSSIER_PITCHES = [
  "Scanning competitors...",
  "Searching GitHub for similar repos...",
  "Pulling pricing data...",
  "Mapping the funding landscape...",
  "Finding market gaps...",
];

const ROOM_PITCHES = [
  "The VC is reading your dossier...",
  "The engineer is counting API calls...",
  "The indie hacker checked Product Hunt...",
  "Summoning the devil's advocate...",
];

function getIdea(state: typeof initialState): IdeaInput {
  const idea: Record<string, string> = {};
  for (const key of Object.keys(state) as (keyof typeof initialState)[]) {
    idea[key] = state[key].trim();
  }
  return idea as unknown as IdeaInput;
}

function ideaFromQuick(quick: string): IdeaInput {
  const filled = fillFormFromQuick(
    { title: "", description: "" },
    quick,
  );
  return { title: filled.title, description: filled.description } as IdeaInput;
}

function OutOfCreditsBanner() {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <div className="error-banner" role="alert">
      <span>
        No briefings left. Add your own API key above to run on your account, or{" "}
        <Link href="/buy">buy briefings</Link>. Credits land after the payment
        is confirmed.
        {support ? (
          <>
            {" "}
            Or email <a href={`mailto:${support}`}>{support}</a> if checkout is
            unavailable.
          </>
        ) : null}
      </span>
    </div>
  );
}

// --- Page ---

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="app">
          <nav className="app-nav">
            <Link href="/" className="wordmark"><Logo /></Link>
          </nav>
          <main className="form-page">
            <p className="brief-form-sub">Loading...</p>
          </main>
        </div>
      }
    >
      <BriefPage />
    </Suspense>
  );
}

function BriefPage() {
  const searchParams = useSearchParams();
  const { user, ready, openAuth, spend, refund, usingSupabase, refreshProfile } = useAuth();
  const spentRef = useRef(false);
  const spentAnonRef = useRef(false);
  const autostartRef = useRef(false);
  const refundRef = useRef(refund);
  refundRef.current = refund;

  const giveBackCredit = useCallback(() => {
    if (usingSupabase) {
      void refreshProfile();
      return;
    }
    if (spentAnonRef.current) {
      spentAnonRef.current = false;
      refundAnonCredit();
      return;
    }
    if (!spentRef.current) return;
    spentRef.current = false;
    refundRef.current();
  }, [usingSupabase, refreshProfile]);

  // Input state
  const [phase, setPhase] = useState<Phase>("form");
  const [mode, setMode] = useState<InputMode>(
    searchParams.get("mode") === "detailed" ? "detailed" : "quick",
  );
  const [quickInput, setQuickInput] = useState(
    () => searchParams.get("idea") || "",
  );
  const [form, setForm] = useState(() =>
    fillFormFromQuick(initialState, searchParams.get("idea") || ""),
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showDetails, setShowDetails] = useState(
    searchParams.get("mode") === "detailed",
  );
  const [lastIdea, setLastIdea] = useState<IdeaInput | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [usingOwnKey, setUsingOwnKey] = useState(false);
  const onOwnKey = useCallback((active: boolean) => {
    setUsingOwnKey(active);
    if (active) setOutOfCredits(false);
  }, []);

  // Voice — shared Web Speech hook; onText composes into the quick input.
  const voiceRaw = useSpeechInput();
  const voice = {
    supported: voiceRaw.supported,
    listening: voiceRaw.listeningField !== null,
    interimText: voiceRaw.interim,
    error: voiceRaw.error?.message ?? "",
    start: (currentValue: string) =>
      voiceRaw.start("quick", currentValue, (text) => setQuickInput(text)),
    stop: voiceRaw.stop,
  };

  // Loading state
  const [pitchIndex, setPitchIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Brief run (SSE + report state)
  const run_ = useBriefRun(
    useCallback((entry: HistoryEntry) => {
      setHistory((prev) => prependHistory(entry, prev));
    }, []),
    useCallback((idea: IdeaInput) => {
      setLastIdea(idea);
    }, []),
    giveBackCredit,
    useCallback(() => {
      setOutOfCredits(true);
      void refreshProfile();
    }, [refreshProfile]),
    useCallback(() => {
      openAuth();
    }, [openAuth]),
  );
  const {
    loading,
    cancelled,
    error,
    researchAgents,
    agentResults,
    clashes,
    synthesis,
    competitors,
    pricing,
    funding,
    gaps,
    distribution,
    positioning,
    launch,
    github,
    sources,
    processingTime,
    brief,
    integrity,
    setLoading,
    setError,
    setCancelled,
    setAgentResults,
    setClashes,
    setSynthesis,
    run: runUnified,
    cancel: handleCancel,
    reset: resetState,
  } = run_;

  // UI state
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading && usingSupabase) {
      void refreshProfile();
    }
  }, [loading, usingSupabase, refreshProfile]);

  useEffect(() => {
    if (!loading && synthesis && !error) {
      spentRef.current = false;
      spentAnonRef.current = false;
    }
  }, [loading, synthesis, error]);

  const setField = useCallback(
    (key: keyof typeof initialState) => (value: string) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Load history
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Pitch rotation
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setPitchIndex((i) => i + 1), 2500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  const hasResults = competitors.length > 0 || !!github?.repos?.length || !!synthesis;
  const filledContext = OPTIONAL_KEYS.filter((k) => form[k].trim()).length;
  const dossierTotal = Object.keys(RESEARCH_AGENTS).length;
  const roomTotal = agentOrder.length;
  const researchDone = researchAgents.filter((a) => a.status === "done").length;
  const validateDone = Object.keys(agentResults).length;
  const dossierComplete = researchDone >= dossierTotal;
  const loadingPitch = dossierComplete
    ? ROOM_PITCHES[pitchIndex % ROOM_PITCHES.length]
    : DOSSIER_PITCHES[pitchIndex % DOSSIER_PITCHES.length];
  const activeScan = researchAgents.find(
    (a) =>
      a.status !== "pending" && a.status !== "done" && a.status !== "error",
  );
  const workingLabel = !dossierComplete
    ? activeScan
      ? `${RESEARCH_AGENTS[activeScan.agent]?.label ?? activeScan.agent}, ${activeScan.status}`
      : researchDone === 0
        ? "Opening the live market scan"
        : `${researchDone}/${dossierTotal} scans complete`
    : validateDone < roomTotal
      ? `${validateDone}/${roomTotal} experts reporting`
      : "Forcing a verdict";
  const elapsedClock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const overallPct = Math.round(
    ((researchDone + validateDone) / (dossierTotal + roomTotal)) * 100,
  );

  useEffect(() => {
    setPitchIndex(0);
  }, [dossierComplete]);

  // Escape cancels a running briefing
  useEffect(() => {
    if (!loading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, handleCancel]);

  const beginRun = useCallback((idea: IdeaInput) => {
    const ownKey = hasStoredLlmKey();
    if (!user) {
      if (usingSupabase) {
        writePendingIdea(idea.description);
        openAuth();
        return;
      }
      if (!ownKey) {
        try {
          spendAnonCredit();
          spentAnonRef.current = true;
        } catch {
          writePendingIdea(idea.description);
          openAuth();
          return;
        }
      }
    } else if (!ownKey && user.credits < 1) {
      setOutOfCredits(true);
      return;
    } else if (!ownKey && !usingSupabase) {
      try {
        spend();
        spentRef.current = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not start.";
        if (/no briefings left/i.test(message)) {
          setOutOfCredits(true);
        } else {
          setError(message);
        }
        return;
      }
    }
    voiceRaw.stop();
    setOutOfCredits(false);
    setError(null);
    setCancelled(false);
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "auto" });
    void runUnified(idea);
    if (usingSupabase) {
      clearPendingIdea();
    }
  }, [user, usingSupabase, openAuth, spend, runUnified, voiceRaw, setCancelled, setError]);

  useEffect(() => {
    if (!ready || autostartRef.current) return;
    const ideaParam = searchParams.get("idea")?.trim();
    if (searchParams.get("autostart") !== "1" || !ideaParam) return;
    autostartRef.current = true;
    beginRun(ideaFromQuick(ideaParam));
  }, [ready, searchParams, beginRun]);

  const handleQuickSubmit = () => {
    if (!quickInput.trim()) return;
    const idea = ideaFromQuick(quickInput);
    setForm((prev) => fillFormFromQuick(prev, quickInput));
    beginRun(idea);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    beginRun(getIdea(form));
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleNew = () => {
    setQuickInput("");
    setForm(initialState);
    setOpenGroups({});
    setMode("quick");
    setShowDetails(false);
    setPhase("form");
    setError(null);
    setOutOfCredits(false);
    resetState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditIdea = () => {
    if (lastIdea) {
      const updates: Record<string, string> = {};
      for (const k of Object.keys(
        initialState,
      ) as (keyof typeof initialState)[]) {
        updates[k] = (lastIdea as any)[k] || "";
      }
      setForm((prev) => ({ ...prev, ...updates }));
      setQuickInput(lastIdea.description || "");
    }
    setPhase("form");
    setMode("detailed");
    setShowDetails(true);
    setError(null);
    setOutOfCredits(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    const agents: Record<string, AgentResult> = {};
    for (const a of entry.agents) agents[a.agent] = a;
    setAgentResults(agents);
    setClashes(entry.clashes || []);
    setSynthesis(entry.synthesis);
    setLastIdea({ title: entry.title, description: entry.description });
    setQuickInput(entry.description || "");
    setForm((prev) => ({
      ...prev,
      title: entry.title,
      description: entry.description,
    }));
    setError(null);
    setLoading(false);
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fillFullExample = (ex: IdeaInput) => {
    const updates: Record<string, string> = {};
    for (const k of Object.keys(
      initialState,
    ) as (keyof typeof initialState)[]) {
      updates[k] = (ex as any)[k] || "";
    }
    setForm((prev) => ({ ...prev, ...updates }));
    setQuickInput(ex.description || "");
    setOpenGroups({ user: true, business: true, gtm: true });
  };

  const verdict = synthesis
    ? extractVerdict(synthesis.output, synthesis.scores.overall)
    : null;
  const synthesisText = synthesis
    ? stripStructuredBlocks(synthesis.output)
    : "";
  const displayTitle =
    positioning?.category ||
    (lastIdea?.title && lastIdea.title.length <= 90
      ? lastIdea.title
      : "Startup briefing");
  const ideaExcerpt = lastIdea?.description || lastIdea?.title || "";
  const readoutSections = parseReadout(synthesisText);
  const nextMove = readoutSection(readoutSections, "NEXT MOVE");
  const killCriteria = readoutSection(readoutSections, "KILL CRITERIA");
  const whySections = readoutSections.filter(
    (section) =>
      section.label !== "VERDICT" &&
      section.label !== "NEXT MOVE" &&
      section.label !== "KILL CRITERIA",
  );
  // The one reason for the verdict, promoted out of the agent list.
  const fatalFlaw =
    readoutSection(readoutSections, "KILL SHOT REVIEW") ||
    (agentResults.devil
      ? previewLine(stripStructuredBlocks(agentResults.devil.output), 320)
      : "");

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `${verdict || ""} — ${lastIdea?.title || ""}\n\n${synthesisText}`.trim(),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const [copiedReport, setCopiedReport] = useState(false);
  const reportInput: ReportInput = {
    title: lastIdea?.title || form.title || "Untitled idea",
    description: lastIdea?.description || form.description || "",
    date: new Date().toLocaleDateString(),
    verdict,
    scores: synthesis?.scores ?? null,
    agents: Object.values(agentResults),
    clashes,
    synthesis,
    research:
      sources.length > 0 || github
        ? ({ sources, github } as unknown as ResearchResult)
        : null,
  };
  const handleCopyReport = () => {
    navigator.clipboard.writeText(buildReportMarkdown(reportInput));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 1500);
  };
  const handleDownloadReport = () => downloadReportMarkdown(reportInput);

  // Iteration loop: prefill the form with the validated idea and carry the
  // strongest feedback forward so the rerun attacks the revised version.
  const handleRerunWithChanges = () => {
    if (lastIdea) {
      const updates: Record<string, string> = {};
      for (const k of Object.keys(
        initialState,
      ) as (keyof typeof initialState)[]) {
        updates[k] = (lastIdea as any)[k] || "";
      }
      setForm((prev) => ({ ...prev, ...updates }));
      setQuickInput(lastIdea.description || "");
    }
    const insight =
      nextMove ||
      synthesisText
        .split("\n")
        .find((l) => /next move|pivot/i.test(l)) ||
      "";
    if (insight.trim()) {
      setForm((prev) => ({
        ...prev,
        context: [
          prev.context,
          `Revision goal from the previous review: ${insight.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 1900),
      }));
    }
    setPhase("form");
    setMode("detailed");
  };

  return (
    <div className="app">
      {/* ===== NAV ===== */}
      <nav className="app-nav">
        <Link href="/" className="wordmark">
          <Logo />
        </Link>
        <span className="brief-nav-slot" aria-hidden />
        <div className="topnav-actions">
          <AccountMenu />
          {phase === "results" && (
            <>
              <button
                className="nav-btn"
                onClick={handleEditIdea}
                disabled={loading}
              >
                Edit idea
              </button>
              <button
                className="nav-btn nav-btn-accent"
                onClick={handleNew}
                disabled={loading}
              >
                New briefing
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ===== FORM PHASE ===== */}
      {phase === "form" && (
        <main className="form-page">
          {/* Quick mode (default) */}
          {mode === "quick" && !showDetails && (
            <div className="research-quick">
              <div className="brief-form-header">
                <div className="brief-step-kicker">New briefing</div>
                <h1 className="brief-form-title">State the idea.</h1>
                <p className="brief-form-sub">
                  Product, customer, and the painful workflow. The panel
                  researches the live market and returns a ship, pivot, or kill
                  verdict.
                </p>
              </div>

              <div className="briefing-console form-console">
                <div className="console-toolbar subtle">
                  <span className="console-status idle">READY</span>
                  <strong>Describe the startup</strong>
                  <em>~60 seconds</em>
                </div>
                <div className="console-body form-console-body">
                  <p className="quick-hint">
                    Include who it is for, what workflow changes, and how you
                    reach the first users.
                  </p>

                  <div className="quick-input-area">
                    <div className="quick-textarea-wrap">
                      <textarea
                        className="quick-textarea"
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleQuickSubmit();
                          }
                        }}
                        placeholder="AI calendar for freelance designers that reads client emails and turns deadlines into calendar blocks"
                        rows={5}
                        aria-label="Describe your startup idea"
                      />
                      {voice.supported && (
                        <button
                          className={`mic-btn ${voice.listening ? "listening" : ""}`}
                          onClick={
                            voice.listening
                              ? voice.stop
                              : () => voice.start(quickInput)
                          }
                          aria-label={
                            voice.listening
                              ? "Stop voice input"
                              : "Start voice input"
                          }
                          title={
                            voice.listening
                              ? "Stop dictation"
                              : "Dictate your idea"
                          }
                        >
                          {voice.listening ? (
                            <Square size={14} />
                          ) : (
                            <Mic size={14} />
                          )}
                        </button>
                      )}
                      {voice.listening && (
                        <div className="mic-live" aria-live="polite">
                          <span className="mic-live-dot" />
                          <span
                            className={`mic-live-text ${voice.interimText ? "has-text" : ""}`}
                          >
                            {voice.interimText ||
                              "Listening... speak clearly and pause to commit words"}
                          </span>
                          <span className="mic-live-stop">
                            Tap square to stop
                          </span>
                        </div>
                      )}
                      {voice.error && (
                        <div className="mic-error" role="alert">
                          {voice.error}
                        </div>
                      )}
                    </div>
                    <button
                      className="quick-submit"
                      onClick={handleQuickSubmit}
                      disabled={!quickInput.trim() || loading}
                    >
                      {loading
                        ? "Starting…"
                        : usingOwnKey
                          ? "Run on your key"
                          : "Run briefing"}
                      <ArrowRight size={16} />
                    </button>
                    <LlmKeyField onActive={onOwnKey} />
                  </div>

                  <button
                    className="toggle-mode-btn"
                    onClick={() => {
                      setForm((prev) => fillFormFromQuick(prev, quickInput));
                      setMode("detailed");
                      setShowDetails(true);
                    }}
                  >
                    Add more detail for a sharper briefing
                  </button>

                  <div className="quick-examples">
                    <span className="examples-label">Try an example</span>
                    {QUICK_EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        className="example-btn"
                        onClick={() => setQuickInput(ex.text)}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="quick-output-preview outside-console"
                aria-label="Briefing output"
              >
                <div>
                  <strong>Act 1</strong>
                  <span>Market dossier</span>
                </div>
                <div>
                  <strong>Act 2</strong>
                  <span>Expert room</span>
                </div>
                <div>
                  <strong>Verdict</strong>
                  <span>Ship, pivot, or kill</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed mode */}
          {(mode === "detailed" || showDetails) && (
            <div className="research-detailed">
              <div className="detailed-header">
                <button
                  className="back-btn"
                  onClick={() => {
                    setMode("quick");
                    setShowDetails(false);
                  }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="brief-step-kicker">Step 1 · Detailed input</div>
                <h1 className="brief-form-title">Detailed briefing</h1>
                <p className="brief-form-sub">
                  More context = sharper dossier and a tougher room. Title and
                  description required.
                </p>
              </div>

              <div className="briefing-console form-console">
                <div className="console-toolbar subtle">
                  <span className="console-status idle">STRUCTURED BRIEF</span>
                  <strong>Full founder context</strong>
                  <em>
                    {filledContext}/{OPTIONAL_KEYS.length} fields
                  </em>
                </div>
                <div className="console-body form-console-body">
                  <form className="detailed-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label htmlFor="d-title">Idea Title *</label>
                      <input
                        id="d-title"
                        type="text"
                        value={form.title}
                        onChange={(e) => setField("title")(e.target.value)}
                        placeholder='One line. "AI-powered resume builder"'
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="d-desc">Description *</label>
                      <textarea
                        id="d-desc"
                        value={form.description}
                        onChange={(e) =>
                          setField("description")(e.target.value)
                        }
                        placeholder="Describe the product and the workflow end to end. Vague in, vague out."
                        rows={4}
                      />
                    </div>

                    <div className="context-header">
                      <span className="context-label">Optional context</span>
                      <span className="context-meter">
                        {filledContext}/{OPTIONAL_KEYS.length} filled
                      </span>
                    </div>

                    {CONTEXT_GROUPS.map((group) => {
                      const filled = group.fields.filter((f) =>
                        form[f.key].trim(),
                      ).length;
                      const open = !!openGroups[group.id];
                      return (
                        <div
                          key={group.id}
                          className={`context-group ${open ? "open" : ""}`}
                        >
                          <button
                            type="button"
                            className="context-toggle"
                            onClick={() =>
                              setOpenGroups((prev) => ({
                                ...prev,
                                [group.id]: !prev[group.id],
                              }))
                            }
                          >
                            <span className="context-toggle-chevron">
                              {open ? "\u2212" : "+"}
                            </span>
                            <span className="context-toggle-label">
                              {group.label}
                            </span>
                            <span className="context-toggle-hint">
                              {filled > 0
                                ? `${filled}/${group.fields.length} filled`
                                : group.hint}
                            </span>
                          </button>
                          {open && (
                            <div className="context-fields">
                              {group.fields.map((f) => (
                                <div
                                  key={f.key}
                                  className={`field ${f.textarea ? "field-wide" : ""}`}
                                >
                                  <label htmlFor={f.key}>{f.label}</label>
                                  {f.textarea ? (
                                    <textarea
                                      id={f.key}
                                      value={form[f.key]}
                                      onChange={(e) =>
                                        setField(f.key)(e.target.value)
                                      }
                                      placeholder={f.placeholder}
                                      rows={3}
                                    />
                                  ) : (
                                    <input
                                      id={f.key}
                                      type="text"
                                      value={form[f.key]}
                                      onChange={(e) =>
                                        setField(f.key)(e.target.value)
                                      }
                                      placeholder={f.placeholder}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={
                        !form.title.trim() ||
                        !form.description.trim() ||
                        loading
                      }
                    >
                      {loading
                        ? "Running briefing..."
                        : usingOwnKey
                          ? "Run on your key"
                          : "Run briefing"}
                    </button>
                    <LlmKeyField onActive={onOwnKey} />
                    <div className="submit-meta">
                      ~60 seconds · ship, pivot, or kill
                    </div>
                  </form>
                </div>
              </div>

              <div className="examples">
                <span className="examples-label">
                  OR STRESS-TEST AN EXAMPLE
                </span>
                <div className="examples-row">
                  {FULL_EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      className="example-chip"
                      onClick={() => fillFullExample(ex)}
                    >
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {outOfCredits && !usingOwnKey && <OutOfCreditsBanner />}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <HistoryPanel
            entries={history}
            onSelect={loadHistoryEntry}
            onClear={handleClearHistory}
          />
        </main>
      )}

      {/* ===== RESULTS PHASE ===== */}
      {phase === "results" && (
        <main className="results-page" ref={resultsRef}>
          {loading && (
            <div className="run-stage">
              <header className="run-head">
                <p className="run-now">
                  <i />
                  Live
                </p>
                <div className="run-head-row">
                  <h2>
                    {dossierComplete ? "The room is in session" : "Building the dossier"}
                  </h2>
                  <div className="run-clock" aria-label="Elapsed time">
                    {elapsedClock}
                  </div>
                </div>
                <p className="run-idea">{lastIdea?.title || "Your idea"}</p>
                <p className="progress-subtitle">{workingLabel}</p>
                <div
                  className="run-meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={overallPct}
                  aria-label="Briefing progress"
                >
                  <div
                    className={`run-meter-fill ${overallPct === 0 ? "indeterminate" : ""}`}
                    style={{ width: `${Math.max(overallPct, 6)}%` }}
                  />
                </div>
                <p className="run-count">
                  {researchDone + validateDone} of {dossierTotal + roomTotal} complete
                </p>
              </header>

              <div className="run-acts">
                <section
                  className={`run-act ${!dossierComplete ? "is-active" : "is-done"}`}
                >
                  <div className="run-act-top">
                    <span>01</span>
                    <strong>Dossier</strong>
                    <em>
                      {researchDone}/{dossierTotal}
                    </em>
                  </div>
                  <ul className="run-list" role="status" aria-live="polite">
                    {Object.entries(RESEARCH_AGENTS).map(
                      ([key, { label, icon }]) => {
                        const status = researchAgents.find(
                          (a: ResearchAgentStatus) => a.agent === key,
                        );
                        const state = status?.status || "pending";
                        return (
                          <li key={key} className={`run-item ${state}`}>
                            <span className="icon">{icon}</span>
                            <span className="label">{label}</span>
                            <span className="mark">
                              {state === "done" ? "Done" : state === "pending" ? "" : "Live"}
                            </span>
                          </li>
                        );
                      },
                    )}
                  </ul>
                </section>

                <section
                  className={`run-act ${dossierComplete ? "is-active" : "is-wait"}`}
                >
                  <div className="run-act-top">
                    <span>02</span>
                    <strong>The room</strong>
                    <em>
                      {validateDone}/{roomTotal}
                    </em>
                  </div>
                  <ul className="run-list" role="status" aria-live="polite">
                    {agentOrder.map((name) => {
                      const meta = agentMetaMap[name];
                      const result = agentResults[name];
                      const state = result
                        ? result.error
                          ? "failed"
                          : "done"
                        : dossierComplete
                          ? "pending"
                          : "waiting";
                      return (
                        <li key={name} className={`run-item ${state}`}>
                          <span className="icon" style={{ color: meta.color }}>
                            {meta.icon}
                          </span>
                          <span className="label">{meta.label}</span>
                          <span className="mark">
                            {state === "done"
                              ? "Done"
                              : state === "failed"
                                ? "Fail"
                                : state === "pending"
                                  ? "Next"
                                  : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>

              <footer className="run-foot">
                <p className="loading-quip">{loadingPitch}</p>
                <button className="cancel-btn" onClick={handleCancel}>
                  <X size={14} />
                  Cancel
                </button>
              </footer>
            </div>
          )}

          {!loading && error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {lastIdea && (
                <button
                  className="error-retry"
                  onClick={() => beginRun(lastIdea)}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!loading && cancelled && !hasResults && (
            <div className="error-banner">
              <span>Cancelled.</span>
              <button onClick={() => setCancelled(false)}>Dismiss</button>
            </div>
          )}

          {!loading && hasResults && (
            <ReportErrorBoundary>
              <Report
                displayTitle={displayTitle}
                processingTime={processingTime || ""}
                oneLiner={positioning?.one_liner || ""}
                ideaExcerpt={ideaExcerpt}
                verdict={verdict}
                scores={synthesis?.scores ?? null}
                synthesisText={synthesisText}
                whySections={whySections}
                fatalFlaw={fatalFlaw}
                nextMove={nextMove}
                killCriteria={killCriteria}
                integrity={integrity}
                evidence={{
                  brief: brief || null,
                  competitors,
                  github: github || null,
                  pricing,
                  funding,
                  gaps,
                  distribution,
                  positioning,
                  launch,
                }}
                sources={sources}
                discardedSources={integrity?.discarded ?? 0}
                agentOrder={agentOrder}
                agentResults={agentResults}
                clashes={clashes}
                loading={loading}
                hasSynthesis={Boolean(synthesis)}
                signedIn={Boolean(user)}
                startingCredits={STARTING_CREDITS}
                copiedVerdict={copied}
                copiedReport={copiedReport}
                onCopyVerdict={handleCopy}
                onCopyReport={handleCopyReport}
                onDownloadReport={handleDownloadReport}
                onRerun={handleRerunWithChanges}
                onNew={handleNew}
                onAuth={openAuth}
              />
            </ReportErrorBoundary>
          )}

          <HistoryPanel
            entries={history}
            onSelect={loadHistoryEntry}
            onClear={handleClearHistory}
          />
          <LegalFooter className="footer" />
        </main>
      )}
    </div>
  );
}
