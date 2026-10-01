export type Competitor = {
  name: string;
  url: string;
  description: string;
  founded?: string;
  funding?: string;
  employees?: string;
  pricing?: string;
  traction?: string;
  positioning?: string;
  strengths: string[];
  weaknesses: string[];
  source_urls: string[];
};

export type PricingTier = {
  name: string;
  price: number | string;
  features: string;
};

export type CompetitorPricing = {
  name: string;
  tiers: PricingTier[];
};

export type FundingRound = {
  company: string;
  amount: string;
  round: string;
  date: string;
  investors?: string[];
};

export type MarketSize = {
  tam: string;
  sam: string;
  som: string;
  sources: string[];
  /** Per-figure attribution. A figure without one is dropped, not shown bare. */
  tam_source?: string;
  sam_source?: string;
  som_source?: string;
};

export type PainPoint = {
  point: string;
  frequency: string;
  source: string;
};

export type MarketGap = {
  gap: string;
  evidence: string;
  opportunity_size: "High" | "Medium" | "Low";
};

export type UnservedSegment = {
  segment: string;
  why_underserved: string;
};

export type Community = {
  name: string;
  size: string;
  relevance: "High" | "Medium" | "Very High";
  url?: string;
};

export type DistributionChannel = {
  channel: string;
  effectiveness: string;
  competitor_example?: string;
};

export type ContentOpportunity = string;

export type Positioning = {
  one_liner: string;
  category: string;
  differentiation: string;
  target_user: string;
  why_now: string;
  competitive_advantage: string;
};

export type LaunchPhase = {
  timeline: string;
  actions: string[];
};

export type LaunchStrategy = {
  phase_1_pre_launch: LaunchPhase;
  phase_2_launch: LaunchPhase;
  phase_3_post_launch: LaunchPhase;
  kpis: string[];
};

/** A verifiable link from live search, attached to the section that used it. */
export type SourceLink = {
  section: string;
  title: string;
  url: string;
  /** True once a dossier field actually references this page. */
  cited?: boolean;
};

export type GitHubRepoHit = {
  name: string;
  full_name: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  last_pushed: string;
  popularity_tier: "viral" | "established" | "niche" | "inactive";
  relevance: "High" | "Medium" | "Low";
  overlap: string;
};

export type GitHubLandscape = {
  queries: string[];
  total_matches: number;
  signal: "crowded" | "moderate" | "open";
  summary: string;
  repos: GitHubRepoHit[];
  unavailable?: boolean;
  note?: string;
};

export type ResearchResult = {
  brief?: {
    title: string;
    description: string;
    job?: string;
    buyer?: string;
    family?: string;
    inferred?: boolean;
  };
  sources: SourceLink[];
  /** Results dropped as off-topic before reaching any agent. */
  discardedSources?: number;
  competitors: Competitor[];
  pricing: {
    range: { low: number; high: number; currency: string; period: string };
    common_models: string[];
    free_tier: boolean;
    competitors: CompetitorPricing[];
    recommended_positioning: string;
  };
  funding: {
    market_size: MarketSize;
    funding_landscape: {
      total_raised: string;
      average_round: string;
      hot_areas: string[];
      notable_rounds: FundingRound[];
    };
  };
  gaps: {
    pain_points: PainPoint[];
    gaps: MarketGap[];
    unserved_segments: UnservedSegment[];
  };
  distribution: {
    communities: Community[];
    distribution_channels: DistributionChannel[];
    content_opportunities: ContentOpportunity[];
  };
  positioning: Positioning;
  launch: LaunchStrategy;
  github: GitHubLandscape | null;
};

export type ResearchInput = {
  title: string;
  description: string;
  context?: string;
  job?: string;
  buyer?: string;
  family?: "idea_validation" | "project_management" | "other";
  /** Canonical domain terms used to build search queries. Never the raw phrasing. */
  search_terms?: string[];
  /** Tokens that are UI analogies rather than market entities ("tinder", "swipe"). */
  metaphor_terms?: string[];
  /** True when we expanded a terse input into a fuller brief than the user typed. */
  inferred?: boolean;
};

export type ResearchEvent =
  | { type: "brief"; data: NonNullable<ResearchResult["brief"]> }
  | { type: "status"; agent: string; status: string }
  | { type: "competitor"; data: Competitor }
  | { type: "pricing"; data: ResearchResult["pricing"] | null }
  | { type: "funding"; data: ResearchResult["funding"] | null }
  | { type: "gaps"; data: ResearchResult["gaps"] | null }
  | { type: "distribution"; data: ResearchResult["distribution"] | null }
  | { type: "positioning"; data: Positioning }
  | { type: "launch"; data: LaunchStrategy }
  | { type: "github"; data: GitHubLandscape }
  | { type: "done"; report_id: string; processing_time: string; cached?: boolean }
  | { type: "error"; message: string };
