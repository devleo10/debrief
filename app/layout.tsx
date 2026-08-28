import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Debrief — AI startup validation in 60 seconds",
  description:
    "One prompt. Full startup briefing — competitors, pricing, funding, gaps, positioning, launch plan — plus a ship/pivot/kill verdict from seven skeptical experts.",
  openGraph: {
    title: "Debrief — AI startup validation in 60 seconds",
    description:
      "Live-web dossier plus a ship, pivot, or kill verdict. Not financial advice.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Debrief — AI startup validation in 60 seconds",
    description:
      "Live-web dossier plus a ship, pivot, or kill verdict. Not financial advice.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

