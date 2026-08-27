"use client";

import { useState, useRef, useCallback } from "react";
import { extractVerdict } from "@/lib/extractVerdict";
import { prependHistory } from "@/lib/historyStorage";
import type { AgentResult, SynthesisResult, HistoryEntry, IdeaInput } from "@/lib/types";
import type { Competitor, Positioning, LaunchStrategy, SourceLink } from "@/lib/research/types";

export type ResearchAgentStatus = {
  agent: string;
  status: "pending" | "searching" | "analyzing" | "planning" | "done" | "error";
};

export type BriefRun = {
  loading: boolean;
  cancelled: boolean;
  error: string | null;

  researchAgents: ResearchAgentStatus[];
  agentResults: Record<string, AgentResult>;
  synthesis: SynthesisResult | null;

  competitors: Competitor[];
  pricing: any;
  funding: any;
  gaps: any;
  distribution: any;
  positioning: Positioning | null;
  launch: LaunchStrategy | null;
  sources: SourceLink[];
  processingTime: string | null;

  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setCancelled: (v: boolean) => void;
  setAgentResults: React.Dispatch<React.SetStateAction<Record<string, AgentResult>>>;
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
  onRunStart?: (idea: IdeaInput) => void
): BriefRun {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [researchAgents, setResearchAgents] = useState<ResearchAgentStatus[]>([]);
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({});
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [funding, setFunding] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);
  const [positioning, setPositioning] = useState<Positioning | null>(null);
  const [launch, setLaunch] = useState<LaunchStrategy | null>(null);
  const [sources, setSources] = useState<SourceLink[]>([]);
  const [processingTime, setProcessingTime] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setCompetitors([]);
    setPricing(null);
    setFunding(null);
    setGaps(null);
    setDistribution(null);
    setPositioning(null);
    setLaunch(null);
    setSources([]);
    setProcessingTime(null);
    setResearchAgents([]);
    setAgentResults({});
    setSynthesis(null);
    setError(null);
  }, []);

  const saveToHistory = useCallback((idea: IdeaInput, agents: AgentResult[], synth: SynthesisResult) => {
    onHistory({
      title: idea.title,
      description: idea.description,
      date: new Date().toLocaleDateString(),
      verdict: extractVerdict(synth.output, synth.scores.overall) || "",
      overall: synth.scores.overall,
      agents,
      synthesis: synth,
    });
  }, [onHistory]);

  const handleEvent = useCallback((data: any) => {
    if (!data || typeof data !== "object") return;

    // Research events
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
    onRunStart?.(idea);
    setLoading(true);
    setCancelled(false);
    setError(null);
    reset();

    const controller = new AbortController();
    abortRef.current = controller;

    let localAgents: Record<string, AgentResult> = {};
    let localSynth: SynthesisResult | null = null;

    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idea),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent(data);

              // Track local state for history
              if (data.agent && data.output !== undefined && data.scores) {
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

      setLoading(false);
      if (localSynth) saveToHistory(idea, Object.values(localAgents), localSynth);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong");
      }
      setLoading(false);
    }
  }, [handleEvent, saveToHistory, reset, onRunStart]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setCancelled(true);
    setLoading(false);
  }, []);

  return {
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
    setLoading,
    setError,
    setCancelled,
    setAgentResults,
    setSynthesis,
    run,
    cancel,
    reset,
  };
}
