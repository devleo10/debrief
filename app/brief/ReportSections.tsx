"use client";

import {
  Search,
  DollarSign,
  TrendingUp,
  Target,
  Megaphone,
  Compass,
  Rocket,
  ChevronLeft,
  Globe,
  Users,
  MapPin,
  Code2,
  Star,
} from "lucide-react";
import type {
  Competitor,
  Positioning,
  LaunchStrategy,
  SourceLink,
  ResearchResult,
  GitHubLandscape,
} from "@/lib/research/types";
import { formatStarCount } from "@/lib/research/github";
import { isUsableSourceUrl } from "@/lib/safeUrl";
import {
  opportunityLabel,
  pitchSectionNote,
  pitchSectionTitle,
} from "@/lib/verdictFraming";
import type { ReactNode } from "react";

function ExternalHref({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!isUsableSourceUrl(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function BriefFrameSection({ brief }: { brief: NonNullable<ResearchResult["brief"]> }) {
  // The description repeats the title verbatim when the input was never expanded.
  const description =
    brief.description && brief.description.trim() !== brief.title.trim()
      ? brief.description
      : null;

  return (
    <section className="report-section" aria-label="How we read this idea">
      <h2><Search size={16} /> How we framed this idea</h2>
      <p>{brief.title}</p>
      {description ? <p>{description}</p> : null}
      {brief.job ? (
        <div className="competitor-detail"><strong>Job:</strong> {brief.job}</div>
      ) : null}
    </section>
  );
}

export function CompetitorsSection({ competitors }: { competitors: Competitor[] }) {
  return (
    <section className="report-section" aria-label="Competitors">
      <h2><Search size={16} /> Competitors ({competitors.length})</h2>
      <div className="competitor-grid">
        {competitors.map((c, i) => (
          <div key={c.url || c.name || i} className="competitor-card">
            <h3>{c.name}</h3>
            <ExternalHref href={c.url} className="competitor-url">{c.url}</ExternalHref>
            <p>{c.description}</p>
            {c.pricing && <div className="competitor-detail"><strong>Pricing:</strong> {c.pricing}</div>}
            {c.funding && <div className="competitor-detail"><strong>Funding:</strong> {c.funding}</div>}
            {c.employees && <div className="competitor-detail"><strong>Team:</strong> {c.employees}</div>}
            {c.strengths?.length > 0 && (
              <div className="strengths"><strong>Strengths:</strong><ul>{c.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul></div>
            )}
            {c.weaknesses?.length > 0 && (
              <div className="weaknesses"><strong>Weaknesses:</strong><ul>{c.weaknesses.map((w, j) => <li key={j}>{w}</li>)}</ul></div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GitHubSection({ github }: { github: GitHubLandscape }) {
  if (!github.repos?.length && !github.summary) return null;

  const signalLabel =
    github.signal === "crowded"
      ? "Crowded OSS space"
      : github.signal === "moderate"
        ? "Some OSS traction"
        : "Few OSS players";

  return (
    <section className="report-section" aria-label="GitHub landscape">
      <h2><Code2 size={16} /> GitHub ({github.repos.length} repos)</h2>
      <div className="github-summary">
        <span className={`github-signal ${github.signal}`}>{signalLabel}</span>
        <p>{github.summary}</p>
        {github.total_matches > 0 && (
          <p className="github-meta">
            ~{github.total_matches.toLocaleString()} repos match the search on GitHub
          </p>
        )}
        {github.note && <p className="github-note">{github.note}</p>}
      </div>
      {github.repos.length > 0 && (
        <div className="github-grid">
          {github.repos.map((r) => (
            <div key={r.full_name} className="github-card">
              <div className="github-card-head">
                <ExternalHref href={r.url} className="github-repo-name">
                  {r.full_name}
                </ExternalHref>
                <span className={`github-relevance ${r.relevance.toLowerCase()}`}>
                  {r.relevance}
                </span>
              </div>
              <p className="github-desc">{r.description}</p>
              <p className="github-overlap">{r.overlap}</p>
              <div className="github-stats">
                <span><Star size={12} /> {formatStarCount(r.stars)}</span>
                <span>{formatStarCount(r.forks)} forks</span>
                {r.language && <span>{r.language}</span>}
                <span className={`github-tier ${r.popularity_tier}`}>{r.popularity_tier}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PricingSection({ pricing }: { pricing: any }) {
  // A competitor whose tiers never got extracted renders as a bare heading.
  const priced = (pricing.competitors || []).filter(
    (p: any) => p?.name && p.tiers?.length > 0,
  );
  // "Price below median, or premium to signal quality" covers both directions.
  const recommendation = /\d/.test(String(pricing.recommended_positioning || ""))
    ? pricing.recommended_positioning
    : null;

  if (!priced.length && !recommendation) return null;

  return (
    <section className="report-section" aria-label="Pricing">
      <h2><DollarSign size={16} /> Pricing Landscape</h2>
      {priced.length > 0 && (
        <div className="pricing-grid">
          {priced.map((p: any, i: number) => (
            <div key={p.name || i} className="pricing-card">
              <h3>{p.name}</h3>
              {p.tiers.map((t: any, j: number) => (
                <div key={j} className="pricing-tier">
                  <span className="tier-name">{t.name}</span>
                  <span className="tier-price">{t.price === 0 ? "Free" : `$${t.price}/mo`}</span>
                  <span className="tier-features">{t.features}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {recommendation && (
        <div className="pricing-recommendation"><strong>Recommendation:</strong> {recommendation}</div>
      )}
    </section>
  );
}

function MarketSizeCard({ marketSize }: { marketSize: any }) {
  const rows = (["tam", "sam", "som"] as const)
    .map((key) => ({
      label: key.toUpperCase(),
      value: marketSize[key] as string,
      source: marketSize[`${key}_source`] as string | undefined,
    }))
    .filter((row) => row.value);

  return (
    <div className="market-size-card">
      <h3>Market Size</h3>
      {rows.length > 0 ? (
        rows.map((row) => (
          <div key={row.label} className="market-row">
            <span className="market-label">{row.label}</span>
            <span className="market-value">
              {row.value}
              {isUsableSourceUrl(row.source) ? (
                <ExternalHref href={row.source} className="market-source">
                  source
                </ExternalHref>
              ) : null}
            </span>
          </div>
        ))
      ) : (
        <p className="market-unsourced">
          No sourced market sizing found for this idea. Treat any TAM you have in
          mind as unverified.
        </p>
      )}
    </div>
  );
}

export function FundingSection({ funding }: { funding: any }) {
  return (
    <section className="report-section" aria-label="Market Data">
      <h2><TrendingUp size={16} /> Market & Funding</h2>
      {funding.market_size && <MarketSizeCard marketSize={funding.market_size} />}
      {funding.funding_landscape?.notable_rounds?.length > 0 && (
        <div className="funding-rounds">
          <h3>Notable Funding Rounds</h3>
          {funding.funding_landscape.notable_rounds.map((r: any, i: number) => (
            <div key={i} className="funding-round">
              <strong>{r.company}</strong> — {r.amount} ({r.round})
              {r.date && <span className="funding-date">{r.date}</span>}
            </div>
          ))}
        </div>
      )}
      {funding.funding_landscape?.hot_areas?.length > 0 && (
        <div className="hot-areas">
          <h3>Hot Areas</h3>
          <div className="tag-list">
            {funding.funding_landscape.hot_areas.map((area: string, i: number) => (
              <span key={i} className="tag">{area}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function GapsSection({
  gaps,
  contested = false,
}: {
  gaps: any;
  contested?: boolean;
}) {
  return (
    <section className="report-section" aria-label="Market Gaps">
      <h2><Target size={16} /> Market Gaps</h2>
      {gaps.pain_points?.length > 0 && (
        <div className="pain-points">
          <h3>User Pain Points</h3>
          {gaps.pain_points.map((p: any, i: number) => (
            <div key={i} className="pain-point">
              <p>{p.point}</p>
              {p.source ? (
                <ExternalHref className="frequency" href={p.source}>
                  source
                </ExternalHref>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {gaps.gaps?.length > 0 && (
        <div className="market-gaps">
          <h3>Underserved Areas</h3>
          {gaps.gaps.map((g: any, i: number) => (
            <div key={i} className="gap-item">
              <p>{g.gap}</p>
              <span
                className={`opp-size ${contested ? "contested" : g.opportunity_size?.toLowerCase()}`}
              >
                {opportunityLabel(g.opportunity_size, contested)}
              </span>
            </div>
          ))}
        </div>
      )}
      {gaps.unserved_segments?.length > 0 && (
        <div className="unserved-segments">
          <h3>Unserved Segments</h3>
          {gaps.unserved_segments.map((s: any, i: number) => (
            <div key={i} className="segment-item">
              <strong>{s.segment}</strong>
              <p>{s.why_underserved}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DistributionSection({ distribution }: { distribution: any }) {
  return (
    <section className="report-section" aria-label="Distribution">
      <h2><Megaphone size={16} /> Distribution</h2>
      {distribution.communities?.length > 0 && (
        <div className="communities">
          <h3><Users size={14} /> Communities</h3>
          <div className="community-grid">
            {distribution.communities.map((c: any, i: number) => (
              <div key={i} className="community-card">
                <strong>{c.name}</strong>
                <span className="community-size">{c.size}</span>
                {c.url && (
                  <ExternalHref href={c.url} className="community-link">
                    <Globe size={12} />
                  </ExternalHref>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {distribution.distribution_channels?.length > 0 && (
        <div className="channels">
          <h3><MapPin size={14} /> Channels</h3>
          {distribution.distribution_channels.map((ch: any, i: number) => (
            <div key={i} className="channel-item">
              <strong>{ch.channel}</strong>
              <p>{ch.effectiveness}</p>
            </div>
          ))}
        </div>
      )}
      {distribution.content_opportunities?.length > 0 && (
        <div className="content-opps">
          <h3>Content Opportunities</h3>
          <ul>{distribution.content_opportunities.map((opp: string, i: number) => <li key={i}>{opp}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function PositioningSection({
  positioning,
  contested = false,
}: {
  positioning: Positioning;
  contested?: boolean;
}) {
  const note = pitchSectionNote(contested);
  return (
    <section className="report-section" aria-label="Positioning">
      <h2><Compass size={16} /> {pitchSectionTitle(contested)}</h2>
      {note ? <p className="section-caveat">{note}</p> : null}
      <div className={`positioning-card${contested ? " is-contested" : ""}`}>
        <div className="positioning-row"><strong>One-liner:</strong> {positioning.one_liner}</div>
        <div className="positioning-row"><strong>Category:</strong> {positioning.category}</div>
        <div className="positioning-row"><strong>Target:</strong> {positioning.target_user}</div>
        <div className="positioning-row"><strong>Differentiation:</strong> {positioning.differentiation}</div>
        <div className="positioning-row"><strong>Why Now:</strong> {positioning.why_now}</div>
        <div className="positioning-row"><strong>Competitive Advantage:</strong> {positioning.competitive_advantage}</div>
      </div>
    </section>
  );
}

export function LaunchSection({ launch }: { launch: LaunchStrategy }) {
  return (
    <section className="report-section is-wide" aria-label="Launch Strategy">
      <h2><Rocket size={16} /> Launch Strategy</h2>
      <div className="launch-timeline">
        {([
          { key: "phase_1_pre_launch", label: "Pre-Launch", icon: <ChevronLeft size={16} /> },
          { key: "phase_2_launch", label: "Launch Week", icon: <Target size={16} /> },
          { key: "phase_3_post_launch", label: "Post-Launch", icon: <Rocket size={16} /> },
        ] as const).map(({ key, label, icon }) => {
          const phase = launch[key] as any;
          if (!phase?.actions?.length) return null;
          return (
            <div key={key} className="launch-phase">
              <h3>{icon} {label}</h3>
              <span className="timeline">{phase.timeline}</span>
              <ul>{phase.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
            </div>
          );
        })}
      </div>
      {launch.kpis?.length > 0 && (
        <div className="kpis">
          <h3>KPIs</h3>
          <ul>{launch.kpis.map((kpi: string, i: number) => <li key={i}>{kpi}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

