"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Search,
  DollarSign,
  BarChart3,
  Target,
  Megaphone,
  Compass,
  Rocket,
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
import AgentCard from "@/components/AgentCard";
import VerdictBanner from "@/components/VerdictBanner";
import HistoryPanel from "@/components/HistoryPanel";
import { ReportErrorBoundary } from "@/components/ReportErrorBoundary";
import LegalFooter from "@/components/LegalFooter";
import { useBriefRun, type ResearchAgentStatus } from "./useBriefRun";
import {
  CompetitorsSection,
  PricingSection,
  FundingSection,
  GapsSection,
  DistributionSection,
  PositioningSection,
  LaunchSection,
  SourcesSection,
  BriefFrameSection,
} from "./ReportSections";
const Scorecard = dynamic(() => import("@/components/Scorecard"), {
  ssr: false,
});
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
  "AI calendar for freelance designers that reads client emails and turns project deadlines into calendar blocks",
  "Cross-border payment API for African SaaS companies selling to US customers",
  "Contract review workspace for small law firms that summarizes risk and drafts client-ready revisions",
];

const QUICK_PROMPTS = [
  "Who is it for?",
  "What painful workflow changes?",
  "How will you reach the first users?",
];

const READOUT_LABELS = [
  "CONSENSUS",
  "TENSION",
  "DIFFERENTIATION & CREDIBILITY",
  "KILL SHOT REVIEW",
  "VERDICT",
  "NEXT MOVE",
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

// --- Page ---

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="app">
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

  // Input state
  const [phase, setPhase] = useState<Phase>("form");
  const [mode, setMode] = useState<InputMode>(
    searchParams.get("mode") === "detailed" ? "detailed" : "quick",
  );
  const [quickInput, setQuickInput] = useState("");
  const [form, setForm] = useState(initialState);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showDetails, setShowDetails] = useState(
    searchParams.get("mode") === "detailed",
  );
  const [lastIdea, setLastIdea] = useState<IdeaInput | null>(null);

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
  const [dossierExpanded, setDossierExpanded] = useState(true);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Brief run (SSE + report state)
  const run_ = useBriefRun(
    useCallback((entry: HistoryEntry) => {
      setHistory((prev) => prependHistory(entry, prev));
    }, []),
    useCallback((idea: IdeaInput) => setLastIdea(idea), []),
  );
  const {
    loading,
    cancelled,
    error,
    researchAgents,
    agentResults,
    synthesis,
    competitors,
    pricing,
    funding,
    gaps,
    distribution,
    positioning,
    launch,
    sources,
    processingTime,
    brief,
    setLoading,
    setError,
    setCancelled,
    setAgentResults,
    setSynthesis,
    run: runUnified,
    cancel: handleCancel,
    reset: resetState,
  } = run_;

  // UI state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

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

  const hasResults = competitors.length > 0 || !!synthesis;
  const filledContext = OPTIONAL_KEYS.filter((k) => form[k].trim()).length;
  const dossierTotal = Object.keys(RESEARCH_AGENTS).length;
  const roomTotal = agentOrder.length;
  const researchDone = researchAgents.filter((a) => a.status === "done").length;
  const validateDone = Object.keys(agentResults).length;
  const dossierComplete = researchDone >= dossierTotal;
  const loadingPitch = dossierComplete
    ? ROOM_PITCHES[pitchIndex % ROOM_PITCHES.length]
    : DOSSIER_PITCHES[pitchIndex % DOSSIER_PITCHES.length];

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

  const handleQuickSubmit = () => {
    if (!quickInput.trim()) return;
    const firstSentence =
      quickInput.split(/[.!?\n]/)[0]?.trim() || quickInput.slice(0, 60).trim();
    setForm((prev) => ({
      ...prev,
      title: firstSentence,
      description: quickInput.trim(),
    }));
    runUnified({
      title: firstSentence,
      description: quickInput.trim(),
    } as IdeaInput);
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.title.trim() || !form.description.trim()) return;
      voice.stop();
      runUnified(getIdea(form));
    },
    [form, runUnified, voice],
  );

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    const agents: Record<string, AgentResult> = {};
    for (const a of entry.agents) agents[a.agent] = a;
    setAgentResults(agents);
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
  const readoutSections = (() => {
    if (!synthesisText) return [];
    const matches = [
      ...synthesisText.matchAll(
        /(?:^|\n)\s*(?:\d+\.\s*)?\*?\*?([A-Z][A-Z &]+)\*?\*?\s*[—:-]\s*([\s\S]*?)(?=\n\s*(?:\d+\.\s*)?\*?\*?(?:CONSENSUS|TENSION|DIFFERENTIATION & CREDIBILITY|KILL SHOT REVIEW|VERDICT|NEXT MOVE)\*?\*?\s*[—:-]|$)/g,
      ),
    ];
    return matches
      .map((m) => ({ label: m[1].trim(), body: m[2].trim() }))
      .filter((section) => READOUT_LABELS.includes(section.label));
  })();

  const pivotMatch = (() => {
    if (!synthesisText || verdict !== "PIVOT") return null;
    const lines = synthesisText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes("pivot"))
        return lines
          .slice(i, i + 3)
          .join("\n")
          .trim();
    }
    return null;
  })();

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
    synthesis,
    research:
      sources.length > 0 ? ({ sources } as unknown as ResearchResult) : null,
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
      pivotMatch ||
      readoutSections.find((s) => s.label === "NEXT MOVE")?.body ||
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
      <nav className="topnav">
        <Link href="/" className="wordmark">
          DEBRIEF
        </Link>
        {phase === "results" && (
          <div className="topnav-actions">
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
          </div>
        )}
      </nav>

      {/* ===== FORM PHASE ===== */}
      {phase === "form" && (
        <main className="form-page">
          {/* Quick mode (default) */}
          {mode === "quick" && !showDetails && (
            <div className="research-quick">
              <div className="brief-form-header">
                <div className="brief-step-kicker">Step 1 · Input</div>
                <h1 className="brief-form-title">Your idea</h1>
                <p className="brief-form-sub">
                  Give us the product, customer, and painful workflow.
                  We&apos;ll research the market, score the idea, and return a
                  verdict you can act on.
                </p>
              </div>

              <div className="briefing-console form-console">
                <div className="console-toolbar subtle">
                  <span className="console-status idle">NEW BRIEFING</span>
                  <strong>Describe the startup</strong>
                  <em>Act 1 + 2</em>
                </div>
                <div className="console-body form-console-body">
                  <div className="quick-guidance" aria-label="What to include">
                    {QUICK_PROMPTS.map((prompt) => (
                      <span key={prompt}>{prompt}</span>
                    ))}
                  </div>

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
                        placeholder="e.g., AI calendar assistant for freelance designers that reads client emails and schedules project timelines automatically"
                        rows={3}
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
                      Run briefing <ArrowRight size={16} />
                    </button>
                  </div>

                  <button
                    className="toggle-mode-btn"
                    onClick={() => {
                      setMode("detailed");
                      setShowDetails(true);
                    }}
                  >
                    Add more detail for a sharper briefing
                  </button>

                  <div className="quick-examples">
                    <span className="examples-label">TRY:</span>
                    {QUICK_EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        className="example-btn"
                        onClick={() => setQuickInput(ex)}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>

                  <div className="submit-meta">
                    No account · usually under a minute
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
                      {loading ? "Running briefing..." : "Run briefing"}
                    </button>
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

          {error && <div className="error-banner">{error}</div>}
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
          {/* Loading */}
          {loading && (
            <div className="briefing-console loading-console">
              <div className="console-toolbar">
                <span className="console-status running">
                  <i className="live-dot" /> RUNNING BRIEFING
                </span>
                <strong>{lastIdea?.title || "Your idea"}</strong>
                <em>
                  {researchDone + validateDone}/{dossierTotal + roomTotal}
                </em>
              </div>
              <div className="console-body">
                <div className="research-progress">
                  <div className="progress-header">
                    <h2>
                      {dossierComplete
                        ? "Act 2 — The room"
                        : "Act 1 — Building your dossier"}
                    </h2>
                    <p className="progress-subtitle">
                      {dossierComplete
                        ? `${validateDone}/${roomTotal} experts reported`
                        : `${researchDone}/${dossierTotal} scans complete`}
                    </p>
                  </div>

                  <div
                    className={`act-panel ${!dossierComplete ? "active" : "done"}`}
                  >
                    <div className="act-phase">
                      <div
                        className={`act-phase-label ${!dossierComplete ? "active" : "done"}`}
                      >
                        Act 1 · The dossier
                      </div>
                      <div
                        className="agent-roster"
                        role="status"
                        aria-live="polite"
                      >
                        {Object.entries(RESEARCH_AGENTS).map(
                          ([key, { label, icon }]) => {
                            const status = researchAgents.find(
                              (a: ResearchAgentStatus) => a.agent === key,
                            );
                            return (
                              <div
                                key={key}
                                className={`agent-chip ${status?.status || "pending"}`}
                              >
                                <span className="icon">{icon}</span>
                                <span className="label">{label}</span>
                                <span className="status">
                                  {status?.status === "done"
                                    ? "\u2713"
                                    : status?.status !== "pending"
                                      ? "..."
                                      : ""}
                                </span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`act-panel ${dossierComplete ? "active" : "pending"}`}
                  >
                    <div className="act-phase">
                      <div
                        className={`act-phase-label ${dossierComplete ? "active" : "pending"}`}
                      >
                        Act 2 · The room
                      </div>
                      <div
                        className="agent-roster"
                        role="status"
                        aria-live="polite"
                      >
                        {agentOrder.map((name) => {
                          const meta = agentMetaMap[name];
                          const result = agentResults[name];
                          return (
                            <div
                              key={name}
                              className={`agent-chip ${result ? (result.error ? "failed" : "done") : dossierComplete ? "pending" : "waiting"}`}
                            >
                              <span
                                className="icon"
                                style={{ color: meta.color }}
                              >
                                {meta.icon}
                              </span>
                              <span className="label">{meta.label}</span>
                              <span className="status">
                                {result
                                  ? result.error
                                    ? "\u2715"
                                    : "\u2713"
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div className="progress-segment">
                      <div
                        className="progress-fill dossier"
                        style={{
                          width: `${Math.min((researchDone / dossierTotal) * 100, 100)}%`,
                        }}
                      />
                      <span className="progress-label">Act 1 · Dossier</span>
                    </div>
                    <div className="progress-segment">
                      <div
                        className="progress-fill room"
                        style={{
                          width: `${Math.min((validateDone / roomTotal) * 100, 100)}%`,
                        }}
                      />
                      <span className="progress-label">Act 2 · Room</span>
                    </div>
                  </div>

                  <p className="loading-quip">{loadingPitch}</p>

                  <button className="cancel-btn" onClick={handleCancel}>
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {lastIdea && (
                <button
                  className="error-retry"
                  onClick={() => runUnified(lastIdea)}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {cancelled && !hasResults && (
            <div className="error-banner">
              <span>Cancelled.</span>
              <button onClick={() => setCancelled(false)}>Dismiss</button>
            </div>
          )}

          {/* Report */}
          {hasResults && !loading && (
            <ReportErrorBoundary>
              <div className="briefing-console report-console">
                <div className="console-toolbar complete">
                  <span className="console-status done">BRIEFING COMPLETE</span>
                  <strong>{displayTitle}</strong>
                  {processingTime ? <em>{processingTime}</em> : <em>Ready</em>}
                  {synthesis && (
                    <>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={handleRerunWithChanges}
                        aria-label="Rerun the briefing with your changes"
                      >
                        Rerun with changes
                      </button>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={handleCopyReport}
                        aria-label="Copy full report as Markdown"
                      >
                        {copiedReport ? "Copied ✓" : "Copy report"}
                      </button>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={handleDownloadReport}
                        aria-label="Download full report as Markdown file"
                      >
                        Download .md
                      </button>
                    </>
                  )}
                </div>
                <div className="console-body">
                  <div className="research-report">
                    {/* Header */}
                    <div className="report-header compact">
                      <div className="report-kicker">Final output</div>
                      {positioning?.one_liner && (
                        <p className="one-liner">{positioning.one_liner}</p>
                      )}
                      {ideaExcerpt && (
                        <p className="idea-excerpt">{ideaExcerpt}</p>
                      )}
                    </div>

                    {/* Verdict */}
                    {synthesis && (
                      <div className="verdict-enter">
                        <VerdictBanner
                          verdict={verdict}
                          overall={synthesis.scores.overall}
                          onCopy={handleCopy}
                          copied={copied}
                        />
                        <Scorecard scores={synthesis.scores} />
                        <p className="calibration-note">
                          Calibration is harsh by design: 7+ is rare, most
                          ideas land 3-6. A low score with specific reasons is
                          the tool working, not failing.
                        </p>
                        {pivotMatch && (
                          <div className="pivot-box">
                            <div className="pivot-label">Next move</div>
                            <div className="pivot-text">{pivotMatch}</div>
                          </div>
                        )}
                        <section
                          className="report-section verdict-section"
                          aria-label="Why"
                        >
                          <h2>The readout</h2>
                          {readoutSections.length > 0 ? (
                            <div className="readout-grid">
                              {readoutSections.map((section) => (
                                <article
                                  key={section.label}
                                  className={`readout-card ${section.label === "KILL SHOT REVIEW" ? "danger" : ""}`}
                                >
                                  <div className="readout-label">
                                    {section.label}
                                  </div>
                                  <p>{section.body}</p>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="synthesis-content">
                              {synthesisText}
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                    {/* Summary strip */}
                    {positioning && (
                      <div className="summary-strip">
                        <div className="summary-item">
                          <span className="summary-label">Category</span>
                          <span className="summary-value">
                            {positioning.category}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Target</span>
                          <span className="summary-value">
                            {positioning.target_user}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Edge</span>
                          <span className="summary-value">
                            {positioning.competitive_advantage}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* === ACT 1: THE DOSSIER === */}
                    {(brief ||
                      competitors.length > 0 ||
                      pricing ||
                      funding ||
                      gaps ||
                      distribution ||
                      positioning ||
                      launch) && (
                      <div className="report-act">
                        <button
                          type="button"
                          className="report-act-toggle"
                          onClick={() => setDossierExpanded((v) => !v)}
                          aria-expanded={dossierExpanded}
                        >
                          <span className="report-act-label">
                            Act 1 · The dossier
                          </span>
                          <span className="report-act-hint">
                            {dossierExpanded ? "Collapse" : "Expand"}
                          </span>
                        </button>
                        {dossierExpanded && (
                          <div className="report-act-body">
                            {brief && <BriefFrameSection brief={brief} />}
                            {competitors.length > 0 && (
                              <CompetitorsSection competitors={competitors} />
                            )}

                            {pricing && <PricingSection pricing={pricing} />}

                            {funding && <FundingSection funding={funding} />}

                            {gaps && <GapsSection gaps={gaps} />}

                            {distribution && (
                              <DistributionSection
                                distribution={distribution}
                              />
                            )}

                            {positioning && (
                              <PositioningSection positioning={positioning} />
                            )}

                            {launch && <LaunchSection launch={launch} />}

                            <SourcesSection sources={sources} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* === ACT 2: THE ROOM === */}

                    <section className="agents-section report-act-room">
                      <div className="report-act-label static">
                        Act 2 · The room
                      </div>
                      <p className="report-act-desc">
                        Seven experts stress-tested your idea against the
                        dossier.
                      </p>
                      {agentOrder.map((name) => (
                        <AgentCard
                          key={name}
                          name={name}
                          result={agentResults[name]}
                          loading={loading && !agentResults[name]}
                          collapsed={
                            collapsed[name] ?? !agentMetaMap[name]?.isDevil
                          }
                          onToggle={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [name]: !(
                                prev[name] ?? !agentMetaMap[name]?.isDevil
                              ),
                            }))
                          }
                        />
                      ))}
                    </section>

                    {/* Footer */}
                    <div className="report-footer">
                      <button className="start-over-btn" onClick={handleNew}>
                        Run another briefing
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
