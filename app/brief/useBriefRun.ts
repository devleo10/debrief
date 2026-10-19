"use client";

import { useState, useRef, useCallback } from "react";
import { extractVerdict } from "@/lib/extractVerdict";
import { prependHistory } from "@/lib/historyStorage";
import type { AgentResult, ClashResult, SynthesisResult, HistoryEntry, IdeaInput } from "@/lib/types";
import type {
  Competitor,
  Positioning,
  LaunchStrategy,
  SourceLink,
  ResearchResult,
  GitHubLandscape,
} from "@/lib/research/types";
import type { RunIntegrity } from "@/lib/runIntegrity";
import { readStoredLlmConfig } from "@/lib/llmKeyStorage";
import { toastError } from "@/lib/toast";

export type ResearchAgentStatus = {
  agent: string;
  status:
    | "pending"
    | "searching"
    | "scraping"
    | "analyzing"
    | "planning"
    | "done"
    | "error";
};

export type BriefRun = {
  loading: boolean;
  cancelled: boolean;
  error: string | null;

  researchAgents: ResearchAgentStatus[];
  agentResults: Record<string, AgentResult>;
  clashes: ClashResult[];
  synthesis: SynthesisResult | null;

  competitors: Competitor[];
  pricing: any;
  funding: any;
  gaps: any;
  distribution: any;
  positioning: Positioning | null;
  launch: LaunchStrategy | null;
  github: GitHubLandscape | null;
  sources: SourceLink[];
  processingTime: string | null;
  brief: NonNullable<ResearchResult["brief"]> | null;
  integrity: RunIntegrity | null;

  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setCancelled: (v: boolean) => void;
  setAgentResults: React.Dispatch<React.SetStateAction<Record<string, AgentResult>>>;
  setClashes: React.Dispatch<React.SetStateAction<ClashResult[]>>;
  setSynthesis: React.Dispatch<React.SetStateAction<SynthesisResult | null>>;

  run: (idea: IdeaInput) => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

/**
 * Encapsulates the SSE briefing run against POST /api/start:
 * stream parsing, per-agent/report state updates, cancellation.
 * Event handling semantics mirror the original inline implementation.
 */
export function useBriefRun(
  onHistory: (entry: HistoryEntry) => void,
  onRunStart?: (idea: IdeaInput) => void,
  onFailure?: () => void,
  onOutOfCredits?: () => void,
  onAuthRequired?: () => void,
): BriefRun {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [researchAgents, setResearchAgents] = useState<ResearchAgentStatus[]>([]);
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({});
  const [clashes, setClashes] = useState<ClashResult[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [funding, setFunding] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);
  const [positioning, setPositioning] = useState<Positioning | null>(null);
  const [launch, setLaunch] = useState<LaunchStrategy | null>(null);
  const [github, setGithub] = useState<GitHubLandscape | null>(null);
  const [sources, setSources] = useState<SourceLink[]>([]);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
  const [brief, setBrief] = useState<NonNullable<ResearchResult["brief"]> | null>(
    null,
  );
  const [integrity, setIntegrity] = useState<RunIntegrity | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;
  const onOutOfCreditsRef = useRef(onOutOfCredits);
  onOutOfCreditsRef.current = onOutOfCredits;
  const onAuthRequiredRef = useRef(onAuthRequired);
  onAuthRequiredRef.current = onAuthRequired;

  const reset = useCallback(() => {
    setCompetitors([]);
    setPricing(null);
    setFunding(null);
    setGaps(null);
    setDistribution(null);
    setPositioning(null);
    setLaunch(null);
    setGithub(null);
    setSources([]);
    setProcessingTime(null);
    setBrief(null);
    setIntegrity(null);
    setResearchAgents([]);
    setAgentResults({});
    setClashes([]);
    setSynthesis(null);
    setError(null);
  }, []);

  const saveToHistory = useCallback((idea: IdeaInput, agents: AgentResult[], synth: SynthesisResult, runClashes: ClashResult[]) => {
    onHistory({
      title: idea.title,
      description: idea.description,
      date: new Date().toLocaleDateString(),
      verdict: extractVerdict(synth.output, synth.scores.overall) || "",
      overall: synth.scores.overall,
      agents,
      clashes: runClashes,
      synthesis: synth,
    });
  }, [onHistory]);

  const handleEvent = useCallback((data: any) => {
    if (!data || typeof data !== "object") return;

    if (data.type === "status" && data.agent && data.status) {
      setResearchAgents((prev) => {
        const existing = prev.find((a: ResearchAgentStatus) => a.agent === data.agent);
        if (existing) {
          return prev.map((a) =>
            a.agent === data.agent ? { ...a, status: data.status } : a
          );
        }
        return [...prev, { agent: data.agent, status: data.status }];
      });
    } else if (data.type === "brief" && data.data) {
      setBrief(data.data);
    } else if (data.type === "competitor" && data.data) {
      setCompetitors((prev) => [...prev, data.data]);
    } else if (data.type === "pricing" && data.data) {
      setPricing(data.data);
    } else if (data.type === "funding" && data.data) {
      setFunding(data.data);
    } else if (data.type === "gaps" && data.data) {
      setGaps(data.data);
    } else if (data.type === "distribution" && data.data) {
      setDistribution(data.data);
    } else if (data.type === "sources" && Array.isArray(data.data)) {
      setSources(data.data);
    } else if (data.type === "positioning" && data.data) {
      setPositioning(data.data);
    } else if (data.type === "launch" && data.data) {
      setLaunch(data.data);
    } else if (data.type === "github" && data.data) {
      setGithub(data.data);
    } else if (data.type === "integrity") {
      setIntegrity({
        type: "integrity",
        fallback: Boolean(data.fallback),
        sources: Number(data.sources) || 0,
        fetched: Number(data.fetched) || 0,
        discarded: Number(data.discarded) || 0,
        agentFailures: Number(data.agentFailures) || 0,
        agreement: data.agreement === "unanimous" ? "unanimous" : "split",
      });
    } else if (data.type === "clash" && data.agent) {
      setClashes((prev) => [
        ...prev,
        { agent: data.agent, output: String(data.output || "") },
      ]);
    }
    // Validation events
    else if (data.agent && data.output !== undefined && data.scores) {
      setAgentResults(prev => ({ ...prev, [data.agent]: data }));
    } else if (data.output !== undefined && data.scores) {
      setSynthesis(data);
    }
    // Common events
    else if (data.type === "done") {
      setProcessingTime(data.processing_time);
    } else if (data.type === "error") {
      setError(data.message);
    } else if (data.message && !data.type) {
      setError(data.message);
    }
  }, []);

  const run = useCallback(async (idea: IdeaInput) => {
    abortRef.current?.abort();
    const runId = ++runIdRef.current;
    const stillThisRun = () => runIdRef.current === runId;

    reset();
    setLoading(true);
    setCancelled(false);
    setError(null);
    onRunStart?.(idea);

    const controller = new AbortController();
    abortRef.current = controller;

    let localAgents: Record<string, AgentResult> = {};
    let localClashes: ClashResult[] = [];
    let localSynth: SynthesisResult | null = null;
    let streamError = "";

    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `run-${Date.now()}-${runId}`;

    const llmConfig = readStoredLlmConfig();

    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        credentials: "same-origin",
        body: JSON.stringify(
          llmConfig
            ? {
                ...idea,
                llmKey: llmConfig.apiKey,
                llmProvider: llmConfig.provider,
                llmModel: llmConfig.model,
              }
            : idea,
        ),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          onAuthRequiredRef.current?.();
          throw new Error(err.error || "Sign in to run a briefing.");
        }
        if (res.status === 402) {
          onOutOfCreditsRef.current?.();
          throw new Error(err.error || "No briefings left.");
        }
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (!stillThisRun()) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (!stillThisRun()) return;
              handleEvent(data);

              if (data.type === "error" && typeof data.message === "string") {
                streamError = data.message;
              } else if (data.type === "clash" && data.agent) {
                localClashes.push({ agent: data.agent, output: String(data.output || "") });
              } else if (data.agent && data.output !== undefined && data.scores) {
                localAgents[data.agent] = data;
              } else if (data.output !== undefined && data.scores && !data.agent) {
                localSynth = data;
              }
            } catch (e: any) {
              if (e?.message && !(e instanceof SyntaxError)) throw e;
            }
          }
        }
      }

      if (!stillThisRun()) return;
      setLoading(false);
      if (localSynth) {
        saveToHistory(idea, Object.values(localAgents), localSynth, localClashes);
      } else {
        if (!llmConfig) {
          try {
            await fetch("/api/account/refund-briefing", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idempotencyKey,
                reason: "incomplete_report",
              }),
            });
          } catch {
            // Server may have already refunded on stream error.
          }
        }
        const message = llmConfig
          ? streamError ||
            "Report did not complete. This run used your own API key, so no briefing credit was charged."
          : "Report did not complete. Your credit was restored if it was charged.";
        setError(message);
        toastError(message);
        onFailureRef.current?.();
      }
    } catch (err: any) {
      if (!stillThisRun()) return;
      if (err.name !== "AbortError") {
        const message = err.message || "Something went wrong";
        setError(message);
        toastError(message);
        onFailureRef.current?.();
      }
      setLoading(false);
    }
  }, [handleEvent, saveToHistory, reset, onRunStart]);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    setCancelled(true);
    setLoading(false);
    onFailureRef.current?.();
  }, []);

  return {
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
    run,
    cancel,
    reset,
  };
}
