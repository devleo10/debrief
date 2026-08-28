"use client";

import Link from "next/link";

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={className}>
      Debrief — not financial, legal, or investment advice.{" "}
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
      {SUPPORT ? (
        <>
          {" · "}
          <a href={`mailto:${SUPPORT}`}>Support</a>
        </>
      ) : null}
    </footer>
  );
}
