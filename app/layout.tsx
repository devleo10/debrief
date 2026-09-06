import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono, Fraunces } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500", "600"],
  display: "swap",
  adjustFontFallback: false,
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  adjustFontFallback: false,
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
    <html lang="en" className={`${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
      <body className={plusJakartaSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

