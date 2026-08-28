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
} from "lucide-react";
import type { Competitor, Positioning, LaunchStrategy, SourceLink, ResearchResult } from "@/lib/research/types";

export function BriefFrameSection({ brief }: { brief: NonNullable<ResearchResult["brief"]> }) {
  return (
    <section className="report-section" aria-label="How we read this idea">
      <h2><Search size={16} /> How we framed this idea</h2>
      <p>{brief.title}</p>
      {brief.family ? (
        <div className="competitor-detail"><strong>Family:</strong> {brief.family}</div>
      ) : null}
      {brief.job ? (
        <div className="competitor-detail"><strong>Job:</strong> {brief.job}</div>
      ) : null}
      {brief.description ? <p>{brief.description}</p> : null}
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
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="competitor-url">{c.url}</a>
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

export function PricingSection({ pricing }: { pricing: any }) {
  return (
    <section className="report-section" aria-label="Pricing">
      <h2><DollarSign size={16} /> Pricing Landscape</h2>
      {pricing.competitors?.length > 0 && (
        <div className="pricing-grid">
          {pricing.competitors.map((p: any, i: number) => (
            <div key={p.name || i} className="pricing-card">
              <h3>{p.name}</h3>
              {p.tiers?.map((t: any, j: number) => (
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
      {pricing.recommended_positioning && (
        <div className="pricing-recommendation"><strong>Recommendation:</strong> {pricing.recommended_positioning}</div>
      )}
    </section>
  );
}

export function FundingSection({ funding }: { funding: any }) {
  return (
    <section className="report-section" aria-label="Market Data">
      <h2><TrendingUp size={16} /> Market & Funding</h2>
      {funding.market_size && (
        <div className="market-size-card">
          <h3>Market Size</h3>
          {funding.market_size.tam && <div className="market-row"><span className="market-label">TAM</span><span className="market-value">{funding.market_size.tam}</span></div>}
          {funding.market_size.sam && <div className="market-row"><span className="market-label">SAM</span><span className="market-value">{funding.market_size.sam}</span></div>}
          {funding.market_size.som && <div className="market-row"><span className="market-label">SOM</span><span className="market-value">{funding.market_size.som}</span></div>}
        </div>
      )}
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

export function GapsSection({ gaps }: { gaps: any }) {
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
                <a className="frequency" href={p.source} target="_blank" rel="noopener noreferrer">
                  source
                </a>
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
              <span className={`opp-size ${g.opportunity_size?.toLowerCase()}`}>{g.opportunity_size} opportunity</span>
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
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="community-link">
                    <Globe size={12} />
                  </a>
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

export function PositioningSection({ positioning }: { positioning: Positioning }) {
  return (
    <section className="report-section" aria-label="Positioning">
      <h2><Compass size={16} /> Positioning</h2>
      <div className="positioning-card">
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
    <section className="report-section" aria-label="Launch Strategy">
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

export function SourcesSection({ sources }: { sources: SourceLink[] }) {
  if (!sources?.length) return null;
  return (
    <section className="report-section" aria-label="Live Sources">
      <h2><Globe size={16} /> Live Sources ({sources.length})</h2>
      <p className="sources-note">Every dossier claim traces back to pages found during this run. Check them yourself.</p>
      <ul className="source-list">
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="source-item">
            <span className="source-section">{s.section}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
