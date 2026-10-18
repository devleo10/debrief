"use client";

import { useEffect, useState } from "react";
import Prose from "@/components/Prose";
import AgentCard from "@/components/AgentCard";
import Disclosure from "./Disclosure";
import Ruling, { verdictTone } from "./Ruling";
import Sources from "./Sources";
import {
  BriefFrameSection,
  CompetitorsSection,
  DistributionSection,
  FundingSection,
  GapsSection,
  GitHubSection,
  LaunchSection,
  PositioningSection,
  PricingSection,
} from "../ReportSections";
import { agentMetaMap } from "@/lib/agentMeta";
import { splitCriteria } from "@/lib/parseReadout";
import { verdictContestsPitch } from "@/lib/verdictFraming";
import { integritySummary, isDegradedRun, type RunIntegrity } from "@/lib/runIntegrity";
import type { Verdict } from "@/lib/extractVerdict";
import type { AgentResult, AgentScores, ClashResult } from "@/lib/types";
import type { SourceLink } from "@/lib/research/types";
import type { EvidenceData } from "./evidence";
import "./report.css";

export type ReportProps = {
  displayTitle: string;
  processingTime: string;
  oneLiner: string;
  ideaExcerpt: string;
  verdict: Verdict;
  scores: AgentScores | null;
  synthesisText: string;
  whySections: { label: string; body: string }[];
  fatalFlaw: string;
  nextMove: string;
  killCriteria: string;
  integrity: RunIntegrity | null;
  evidence: EvidenceData;
  sources: SourceLink[];
  discardedSources: number;
  agentOrder: string[];
  agentResults: Record<string, AgentResult>;
  clashes: ClashResult[];
  loading: boolean;
  hasSynthesis: boolean;
  signedIn: boolean;
  startingCredits: number;
  copiedVerdict: boolean;
  copiedReport: boolean;
  onCopyVerdict: () => void;
  onCopyReport: () => void;
  onDownloadReport: () => void;
  onRerun: () => void;
  onNew: () => void;
  onAuth: () => void;
};

/** The ruling states one reason; the rest of the argument is a row away. */
function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const end = clean.search(/[.!?](\s|$)/);
  return end === -1 ? clean : clean.slice(0, end + 1);
}

function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** The synthesizer emits headings in caps; they are read as sentences here. */
function sentenceCase(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export default function Report(props: ReportProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Inside the room, the devil's advocate opens and the rest stay folded.
  const [shut, setShut] = useState<Record<string, boolean>>({});

  // A shared link should land with the sender's row already open.
  useEffect(() => {
    const row = new URLSearchParams(window.location.search).get("row");
    if (row) setOpen({ [row]: true });
  }, []);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const url = new URL(window.location.href);
      if (next[id]) url.searchParams.set("row", id);
      else url.searchParams.delete("row");
      window.history.replaceState(null, "", url);
      return next;
    });
  };

  const tone = verdictTone(props.verdict);
  const contested = verdictContestsPitch(props.verdict);
  // History entries carry no one-liner, so the fallback can repeat the title.
  const candidate = props.oneLiner || props.ideaExcerpt;
  const pitch =
    candidate.trim() && candidate.trim() !== props.displayTitle.trim()
      ? candidate
      : "";
  const criteria = props.killCriteria ? splitCriteria(props.killCriteria) : [];
  const ev = props.evidence;
  const rebuttals = props.clashes.filter((c) => c.output.trim());

  const repoCount = ev.github?.repos?.length ?? 0;
  const citedCount = props.sources.filter((s) => s.cited).length || props.sources.length;
  const scored = props.agentOrder
    .map((n) => props.agentResults[n]?.scores?.overall)
    .filter((v): v is number => v != null);
  const spread = scored.length
    ? `${countLabel(props.agentOrder.length, "critique")}, ${Math.min(...scored)}–${Math.max(...scored)} out of 10`
    : countLabel(props.agentOrder.length, "critique");

  const marketMeta = [
    ev.competitors.length ? countLabel(ev.competitors.length, "competitor") : null,
    repoCount ? countLabel(repoCount, "repository", "repositories") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="case-file">
      <header className="file-head">
        <p className="file-status">Briefing complete</p>
        <h1 className="file-title">{props.displayTitle}</h1>
        {pitch ? <p className="file-pitch">{pitch}</p> : null}
        <p className="file-meta">
          {props.processingTime ? <span>{props.processingTime}</span> : null}
          <span>{countLabel(citedCount, "source")}</span>
        </p>
      </header>

      {props.hasSynthesis && (
        <Ruling
          verdict={props.verdict}
          scores={props.scores}
          reason={firstSentence(props.fatalFlaw)}
          actions={
            <>
              <button type="button" className="act is-primary" onClick={props.onCopyVerdict}>
                {props.copiedVerdict ? "Verdict copied" : "Copy verdict"}
              </button>
              <button type="button" className="act" onClick={props.onDownloadReport}>
                Download
              </button>
              <button type="button" className="act" onClick={props.onCopyReport}>
                {props.copiedReport ? "Report copied" : "Copy report"}
              </button>
              <button type="button" className="act" onClick={props.onRerun}>
                Edit and rerun
              </button>
            </>
          }
        />
      )}

      {props.integrity ? (
        <p
          className={`file-integrity${isDegradedRun(props.integrity) ? " is-degraded" : ""}`}
        >
          {isDegradedRun(props.integrity)
            ? `Thin evidence: ${integritySummary(props.integrity)}.`
            : `${integritySummary(props.integrity)}.`}
        </p>
      ) : null}

      {!props.signedIn ? (
        <div className="auth-nudge">
          <p>
            Free trial used. Continue with email for {props.startingCredits} more
            briefings, stored on this device only, no password.
          </p>
          <button type="button" className="act is-primary" onClick={props.onAuth}>
            Continue with email
          </button>
        </div>
      ) : null}

      <div className="file-rows">
        {(props.whySections.length > 0 || props.synthesisText) && (
          <Disclosure
            title={tone === "ship" ? "Why it holds up" : "Why it fails"}
            meta={props.whySections.length ? countLabel(props.whySections.length, "finding") : undefined}
            tone={tone}
            open={!!open.why}
            onToggle={() => toggle("why")}
          >
            {props.whySections.length > 0 ? (
              <div className="readout-grid">
                {props.whySections.map((s) => (
                  <article
                    key={s.label}
                    className={`readout-card ${s.label === "KILL SHOT REVIEW" ? "danger" : ""}`}
                  >
                    <h3 className="readout-label">{sentenceCase(s.label)}</h3>
                    <Prose text={s.body} />
                  </article>
                ))}
              </div>
            ) : (
              <Prose className="synthesis-content" text={props.synthesisText} />
            )}
          </Disclosure>
        )}

        {props.nextMove && (
          <Disclosure
            title="What to do instead"
            open={!!open.next}
            onToggle={() => toggle("next")}
          >
            <Prose text={props.nextMove} />
          </Disclosure>
        )}

        {criteria.length > 0 && (
          <Disclosure
            title="Kill criteria"
            meta={countLabel(criteria.length, "test")}
            open={!!open.criteria}
            onToggle={() => toggle("criteria")}
          >
            <ul className="criteria-list">
              {criteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Disclosure>
        )}

        {(ev.competitors.length > 0 || ev.github || ev.brief?.inferred) && (
          <Disclosure
            title="The market"
            meta={marketMeta || undefined}
            open={!!open.market}
            onToggle={() => toggle("market")}
          >
            {ev.brief?.inferred ? <BriefFrameSection brief={ev.brief} /> : null}
            {ev.competitors.length > 0 && (
              <CompetitorsSection competitors={ev.competitors} />
            )}
            {ev.github && <GitHubSection github={ev.github} />}
          </Disclosure>
        )}

        {(ev.pricing || ev.funding) && (
          <Disclosure
            title="Pricing and funding"
            open={!!open.money}
            onToggle={() => toggle("money")}
          >
            {ev.pricing && <PricingSection pricing={ev.pricing} />}
            {ev.funding && <FundingSection funding={ev.funding} />}
          </Disclosure>
        )}

        {(ev.gaps || ev.positioning) && (
          <Disclosure
            title="Gaps and positioning"
            meta={contested ? "contested by the verdict" : undefined}
            open={!!open.gaps}
            onToggle={() => toggle("gaps")}
          >
            {ev.gaps && <GapsSection gaps={ev.gaps} contested={contested} />}
            {ev.positioning && (
              <PositioningSection positioning={ev.positioning} contested={contested} />
            )}
          </Disclosure>
        )}

        {(ev.distribution || ev.launch) && (
          <Disclosure
            title="Distribution and launch"
            open={!!open.launch}
            onToggle={() => toggle("launch")}
          >
            {ev.distribution && <DistributionSection distribution={ev.distribution} />}
            {ev.launch && <LaunchSection launch={ev.launch} />}
          </Disclosure>
        )}

        {props.agentOrder.length > 0 && (
          <Disclosure
            title="The room"
            meta={spread}
            open={!!open.room}
            onToggle={() => toggle("room")}
          >
            <div className="critiques">
              {props.agentOrder.map((name) => (
                <AgentCard
                  key={name}
                  name={name}
                  result={props.agentResults[name]}
                  loading={props.loading && !props.agentResults[name]}
                  collapsed={shut[name] ?? !agentMetaMap[name]?.isDevil}
                  onToggle={() =>
                    setShut((prev) => ({
                      ...prev,
                      [name]: !(prev[name] ?? !agentMetaMap[name]?.isDevil),
                    }))
                  }
                />
              ))}
            </div>
          </Disclosure>
        )}

        {rebuttals.length > 0 && (
          <Disclosure
            title="Cross-examination"
            meta={countLabel(rebuttals.length, "rebuttal")}
            open={!!open.clash}
            onToggle={() => toggle("clash")}
          >
            <div className="readout-grid">
              {rebuttals.map((c) => (
                <article key={c.agent} className="readout-card">
                  <h3 className="readout-label">
                    {agentMetaMap[c.agent]?.label ?? c.agent}
                  </h3>
                  <Prose text={c.output} />
                </article>
              ))}
            </div>
          </Disclosure>
        )}

        {props.sources.length > 0 && (
          <Disclosure
            title="Sources"
            meta={
              props.discardedSources
                ? `${countLabel(citedCount, "cited")}, ${props.discardedSources} dropped`
                : countLabel(citedCount, "cited")
            }
            open={!!open.sources}
            onToggle={() => toggle("sources")}
          >
            <Sources sources={props.sources} discarded={props.discardedSources} />
          </Disclosure>
        )}
      </div>

      <footer className="file-foot">
        <button type="button" className="act" onClick={props.onNew}>
          Run another briefing
        </button>
      </footer>
    </div>
  );
}
