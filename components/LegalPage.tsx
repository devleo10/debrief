import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import LegalFooter from "@/components/LegalFooter";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-shell">
      <header className="app-nav">
        <Link href="/" className="wordmark">
          DEBRIEF
        </Link>
        <span className="brief-nav-slot" aria-hidden />
        <Link href="/brief" className="nav-btn nav-btn-accent">
          Run a briefing
          <ArrowRight size={13} />
        </Link>
      </header>
      <main className="legal-page">
        <h1>{title}</h1>
        {children}
      </main>
      <LegalFooter className="footer" />
    </div>
  );
}
