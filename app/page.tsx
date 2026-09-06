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
    line: "Live market scan — competitors, pricing, and demand signals.",
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
  { href: "#how", label: "The method" },
  { href: "#panel", label: "The room" },
  { href: "#examples", label: "The wreck" },
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
    line: "Reading the dossier against a fundable market..",
  },
  {
    icon: Code2,
    name: "Senior Engineer",
    line: "Counting the APIs, data, and failure modes..",
  },
  {
    icon: ShieldAlert,
    name: "Devil's Advocate",
    line: "Looking for the reason not to build this..",
  },
];

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
            <p className="dx-kicker">Seven AI agents · one verdict</p>
            <h1>
              Every reason
              <br />
              your idea <em>fails,</em>
              <br />
              out loud.
            </h1>
            <p className="dx-sub">
              Paste a startup idea. Seven agents research the live market and
              take turns tearing it apart. A synthesizer is forced to pick a
              side.
            </p>
            <IdeaComposer />
            <p className="dx-note">
              Type the idea. Continue with email on this device. Two free
              briefings.
            </p>
            <p className="dx-after">
              Nothing charges. Credits stay in this browser.
            </p>
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

        <section className="dx-board" id="panel">
          <aside>
            {SIDE.map(({ icon: Icon, label, on }) => (
              <span key={label} className={on ? "on" : ""}>
                <Icon size={14} />
                {label}
              </span>
            ))}
          </aside>

          <div className="dx-board-main" id="examples">
            <header>
              <h2>Stripe-style API for carbon-offset audits</h2>
              <p>
                <i />
                Live briefing
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

            <div className="dx-clock">2:34</div>

            <footer>
              <span>
                <i />
                Live reasoning
              </span>
              <span>Show all</span>
            </footer>
          </div>
        </section>

        <section className="dx-close">
          <h2>If it can survive this room, it can survive a customer.</h2>
          <Link href="/brief" className="dx-cta">
            Run a briefing
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <LegalFooter className="footer" />
    </div>
  );
}
