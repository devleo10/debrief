import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: "0 20px", lineHeight: 1.55 }}>
      <p>
        <Link href="/">Debrief</Link>
      </p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
