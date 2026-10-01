import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Outfit,
  JetBrains_Mono,
  Fraunces,
  Instrument_Serif,
} from "next/font/google";
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

/* Used in exactly one place: the verdict and its score on the report. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-ruling",
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Debrief — researched founder briefing with one verdict",
  description:
    "Live competitor research, pricing, and GitHub overlap — then seven experts tear your idea apart until one verdict: ship, pivot, or kill. Sources included.",
  openGraph: {
    title: "Debrief — researched founder briefing with one verdict",
    description:
      "Researched dossier plus a forced ship, pivot, or kill call. Not financial advice.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Debrief — researched founder briefing with one verdict",
    description:
      "Researched dossier plus a forced ship, pivot, or kill call. Not financial advice.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${instrumentSerif.variable}`}
    >
      <body className={plusJakartaSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

