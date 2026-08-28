import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gavel,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import AgentOrb from "@/components/AgentOrb";
import ScrollReveal from "@/components/ScrollReveal";
import LegalFooter from "@/components/LegalFooter";




export default function LandingPage() {
  return (
    <div className="landing">
      <ScrollReveal />
      <nav className="landing-nav">
        <Link href="/" className="landing-wordmark">
          DEBRIEF
        </Link>
        <div className="landing-nav-links">
          <a href="#dossier">Dossier</a>
          <a href="#verdict">Verdict</a>
          <Link href="/brief" className="landing-nav-cta">Run briefing</Link>
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow hero-in hero-d1">
              <Sparkles size={14} /> Research-first startup validation
            </div>
            <h1 className="landing-title hero-in hero-d2">
              A <span className="title-grad">market briefing</span> before you
              waste months building.
            </h1>
            <p className="landing-sub hero-in hero-d3">
              Debrief turns a messy idea into a researched dossier, a seven-agent critique,
              and a verdict you can act on: ship, pivot, or kill.
            </p>
            <div className="landing-actions hero-in hero-d4">
              <Link href="/brief" className="landing-primary">
                Start with one sentence <ArrowRight size={16} />
              </Link>
              <Link href="/brief?mode=detailed" className="landing-secondary">
                Use detailed brief
              </Link>
            </div>
            <div className="landing-proof hero-in hero-d5">
              <span><CheckCircle2 size={14} /> No account</span>
              <span><CheckCircle2 size={14} /> Web research</span>
              <span><CheckCircle2 size={14} /> Evidence + critique</span>
            </div>
            <div className="landing-stats hero-in hero-d6" aria-label="Product stats">
              <div><strong>7</strong><span>market scans</span></div>
              <div><strong>7</strong><span>expert critiques</span></div>
              <div><strong>~60s</strong><span>typical runtime</span></div>
            </div>
          </div>

          <AgentOrb />
        </section>

        <section className="landing-band">
          <div className="band-item" data-reveal="1">
            <div className="band-icon"><BarChart3 size={18} /></div>
            <strong>Market reality</strong>
            <span>Competitors, pricing, funding signals, and market gaps in one dossier.</span>
          </div>
          <div className="band-item" data-reveal="2">
            <div className="band-icon"><Users size={18} /></div>
            <strong>Multiple judges</strong>
            <span>VC, engineer, PM, UX, user, indie hacker, and devil&apos;s advocate.</span>
          </div>
          <div className="band-item" data-reveal="3">
            <div className="band-icon"><ShieldAlert size={18} /></div>
            <strong>Kill-shot clarity</strong>
            <span>The report names what breaks the idea and what insight is still worth keeping.</span>
          </div>
        </section>

        <section className="landing-signal-strip" aria-hidden="true">
          <div className="signal-track">
            {[...Array(2)].map((_, i) => (
              <span key={i}>
                <Zap size={12} /> Competitor scan · <Zap size={12} /> Pricing pull · <Zap size={12} /> Funding map · <Zap size={12} /> Gap analysis · <Zap size={12} /> VC critique · <Zap size={12} /> Devil&apos;s advocate ·
              </span>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="section-copy" data-reveal="1">
            <div className="landing-section-title">WHAT CHANGES</div>
            <h2>It does not validate your ego. It validates the workflow.</h2>
            <p>
              The output separates evidence from opinion: what the market already has, where users
              still complain, how hard it is to build, and whether distribution has a believable path.
            </p>
          </div>
          <div className="workflow-grid">
            <div className="workflow-card" data-reveal="1">
              <div className="workflow-step">01</div>
              <MessageSquareText size={18} />
              <span>Input</span>
              <strong>Messy founder idea</strong>
              <p>Voice or text is cleaned into a sharper research brief before agents judge it.</p>
            </div>
            <div className="workflow-card" data-reveal="2">
              <div className="workflow-step">02</div>
              <Search size={18} />
              <span>Act 1</span>
              <strong>Dossier</strong>
              <p>Relevant competitors, pricing, pain points, communities, and launch channels.</p>
            </div>
            <div className="workflow-card" data-reveal="3">
              <div className="workflow-step">03</div>
              <Gavel size={18} />
              <span>Act 2</span>
              <strong>Verdict</strong>
              <p>Scored critique and one concrete next move: build, reposition, or stop.</p>
            </div>
          </div>
        </section>

        <section className="landing-compare">
          <div>
            <div className="landing-section-title">WHY IT FEELS DIFFERENT</div>
            <h2>Less generic advice. More falsifiable claims.</h2>
          </div>
          <div className="compare-columns">
            <div className="compare-box muted" data-reveal="1">
              <span>Generic AI answer</span>
              <p>“Great idea. Talk to users, think about your moat, and refine go-to-market.”</p>
            </div>
            <div className="compare-box strong" data-reveal="2">
              <span>Debrief answer</span>
              <p>
                “Your buyer already has async standup bots. Pivot to incident-heavy support teams
                or kill the generic Slack-summary angle.”
              </p>
            </div>
          </div>
        </section>

        <section className="landing-cta-block" data-reveal="1">
          <div>
            <div className="landing-section-title">START WITH THE ROUGH VERSION</div>
            <h2>Drop the idea as-is. The first job is making it testable.</h2>
          </div>
          <Link href="/brief" className="landing-primary">
            Run your briefing <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <LegalFooter className="landing-footer" />
    </div>
  );
}
