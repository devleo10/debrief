import Link from "next/link";
import Logo from "@/components/Logo";
import LegalFooter from "@/components/LegalFooter";
import HelmetHero from "@/components/HelmetHero";
import IdeaComposer from "@/components/IdeaComposer";
import AccountMenu from "@/components/AccountMenu";
import BelowHero from "@/components/BelowHero";
import { ArrowRight } from "lucide-react";
import "./demo.css";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#examples", label: "Live example" },
  { href: "#panel", label: "The room" },
];

export default function LandingPage() {
  return (
    <div className="dx">
      <header className="app-nav">
        <Link href="/" className="wordmark">
          <Logo />
        </Link>
        <nav>
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <Link href="/buy">Briefings</Link>
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

        <BelowHero />
      </main>

      <LegalFooter className="footer" />
    </div>
  );
}
