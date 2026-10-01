import Link from "next/link";
import LegalFooter from "@/components/LegalFooter";
import HelmetHero from "@/components/HelmetHero";
import IdeaComposer from "@/components/IdeaComposer";
import AccountMenu from "@/components/AccountMenu";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Code2,
  FileText,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import "./demo.css";

const STEPS = [
  {
    n: "01",
    title: "Research",
    line: "Live market scan — competitors, pricing, GitHub overlap, and demand signals.",
  },
  {
    n: "02",
    title: "Challenge",
    line: "Seven specialists take the idea apart, in parallel.",
  },
  {
    n: "03",
    title: "Perspective",
    line: "They are not allowed to agree. Tension is the point.",
  },
  {
    n: "04",
    title: "Synthesize",
    line: "One judge. Ship, pivot, or kill — with a score.",
  },
];

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#examples", label: "Live example" },
  { href: "#panel", label: "The room" },
];

const SIDE = [
  { icon: FileText, label: "Idea", on: true },
  { icon: Users, label: "Panel" },
  { icon: Search, label: "Research" },
  { icon: BarChart3, label: "Analysis" },
  { icon: CheckCircle2, label: "Verdict" },
];

const AGENTS = [
  {
    icon: Briefcase,
    name: "VC Investor",
    line: "Reading the live research against a fundable market.",
  },
  {
    icon: Code2,
    name: "Senior Engineer",
    line: "Counting the APIs, data, and failure modes.",
  },
  {
    icon: ShieldAlert,
    name: "Devil's Advocate",
    line: "Looking for the reason not to build this.",
  },
];

const PROOF = {
  idea: "Multi-agent founder verdict — live research + ship/pivot/kill call",
  verdict: "PIVOT",
  score: "5/10",
  duration: "49s",
  sources: 75,
  competitors: 6,
  githubSignal: "Crowded",
  githubMatches: 510,
  competitorsList: [
    "Preuve AI",
    "Validator AI",
    "IdeaProof",
    "ValidatorAI",
    "ChatGPT",
    "Claude",
  ],
  gap: "Crowded space, weak differentiation — but forced verdict + live sources is a real wedge if narrowed.",
  quote:
    "The product is in a crowded space with niche market appeal and lacks strong differentiation — but the two-act format and live sources are a real wedge if narrowed.",
};

export default function LandingPage() {
  return (
    <div className="dx">
      <header className="app-nav">
        <Link href="/" className="wordmark">
          DEBRIEF
        </Link>
        <nav>
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="topnav-actions">
          <AccountMenu />
        </div>
      </header>

      <main>
        <section className="dx-hero">
          <div className="dx-copy">
            <p className="dx-kicker">Researched · adversarial · one verdict</p>
            <h1>
              Every reason
              <br />
              your idea <em>fails,</em>
              <br />
              before you build it.
            </h1>
            <p className="dx-sub">
              Paste your idea. Live research: competitors, pricing, GitHub
              overlap.
            </p>
            <p className="dx-sub dx-sub-beat">
              Then seven experts argue it out until one is forced to call it.
              Ship, pivot, or kill.
            </p>
            <IdeaComposer />
            <p className="dx-positioning">
              Live web research, not a generic AI take — ~60 seconds, sources
              cited.
            </p>
            <a href="#examples" className="dx-see-example">
              See what a real verdict looks like
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="dx-stage" aria-hidden>
            <p className="dx-hud">
              <i />
              On deck
            </p>
            <HelmetHero />
          </div>
        </section>

        <section className="dx-how" id="how">
          <p className="dx-kicker">The system</p>
          <h2>Four moves. Then a decision.</h2>
          <ol className="dx-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span>{s.n}</span>
                <strong>{s.title}</strong>
                <p>{s.line}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="dx-proof" id="examples">
          <div className="dx-proof-head">
            <p className="dx-kicker">Live example</p>
            <h2>Real verdict from a Debrief run.</h2>
            <p className="dx-proof-sub">
              This is what the product returned when validating itself — not
              mock copy.
            </p>
          </div>

          <div className="dx-proof-grid">
            <article className="dx-proof-card dx-proof-verdict">
              <span className="dx-proof-label">Verdict</span>
              <strong className={`verdict-${PROOF.verdict.toLowerCase().replace(" ", "-")}`}>
                {PROOF.verdict}
              </strong>
              <em>{PROOF.score} overall</em>
              <p>{PROOF.duration} · {PROOF.sources} sources cited</p>
            </article>

            <article className="dx-proof-card">
              <span className="dx-proof-label">Research</span>
              <ul>
                <li>
                  <strong>{PROOF.competitors}</strong> competitors found
                </li>
                <li>
                  GitHub signal: <strong>{PROOF.githubSignal.toLowerCase()}</strong>{" "}
                  ({PROOF.githubMatches} repos)
                </li>
                <li>Pricing tiers extracted for 4 products</li>
              </ul>
            </article>

            <article className="dx-proof-card">
              <span className="dx-proof-label">Competitors surfaced</span>
              <p className="dx-proof-tags">
                {PROOF.competitorsList.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </p>
            </article>

            <article className="dx-proof-card dx-proof-wide">
              <span className="dx-proof-label">Market gap identified</span>
              <p>{PROOF.gap}</p>
            </article>

            <article className="dx-proof-card dx-proof-wide">
              <span className="dx-proof-label">Synthesis pull-quote</span>
              <blockquote>&ldquo;{PROOF.quote}&rdquo;</blockquote>
            </article>
          </div>
        </section>

        <section className="dx-board" id="panel">
          <aside>
            {SIDE.map(({ icon: Icon, label, on }) => (
              <span key={label} className={on ? "on" : ""}>
                <Icon size={14} />
                {label}
              </span>
            ))}
          </aside>

          <div className="dx-board-main">
            <header>
              <h2>{PROOF.idea}</h2>
              <p>
                <i />
                Live verdict
              </p>
            </header>

            <ul className="dx-agents">
              {AGENTS.map((a) => (
                <li key={a.name}>
                  <a.icon size={16} />
                  <strong>{a.name}</strong>
                  <span>{a.line}</span>
                </li>
              ))}
              <li className="more">
                <b>···</b>
                <strong>+4 more agents</strong>
                <span>Indie, PM, UX, user</span>
              </li>
            </ul>

            <div className="dx-clock">{PROOF.duration}</div>

            <footer>
              <span>
                <i />
                Live reasoning
              </span>
              <span>{PROOF.sources} sources</span>
            </footer>
          </div>
        </section>

        <section className="dx-close">
          <h2>If it can survive this room, it can survive a customer.</h2>
          <Link href="/brief" className="dx-cta">
            Get your verdict
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <LegalFooter className="footer" />
    </div>
  );
}
