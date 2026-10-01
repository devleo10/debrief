"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { readAnonCredits } from "@/lib/auth/store";
import { useAuth } from "@/lib/auth/AuthProvider";

const EXAMPLES = [
  "A cross-border payments API for African SaaS selling to US customers",
  "An AI calendar that reads freelance emails and blocks the real deadlines",
  "Contract review for small law firms that flags risk and drafts the reply",
  "A carbon-offset audit API billed like Stripe, per verification",
  "A marketplace where clinics rent idle MRI time by the hour",
];

export default function IdeaComposer() {
  const router = useRouter();
  const { user, startingCredits, usingSupabase } = useAuth();
  const [value, setValue] = useState("");
  const [anonCredits, setAnonCredits] = useState(0);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (usingSupabase) return;
    setAnonCredits(readAnonCredits());
  }, [user, usingSupabase]);

  useEffect(() => {
    if (value || focused) return;

    const full = EXAMPLES[index];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let timer = 0;

    if (reduce) {
      setTyped(full);
      timer = window.setTimeout(() => {
        if (!cancelled) setIndex((i) => (i + 1) % EXAMPLES.length);
      }, 4200);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    let count = 0;
    let phase: "type" | "hold" | "erase" = "type";
    setTyped("");

    const step = () => {
      if (cancelled) return;
      if (phase === "type") {
        count += 1;
        setTyped(full.slice(0, count));
        if (count >= full.length) {
          phase = "hold";
          timer = window.setTimeout(step, 1500);
        } else {
          const pause = count % 9 === 0 ? 70 : 0;
          timer = window.setTimeout(step, 28 + pause);
        }
        return;
      }
      if (phase === "hold") {
        phase = "erase";
        timer = window.setTimeout(step, 16);
        return;
      }
      count -= 1;
      setTyped(full.slice(0, Math.max(0, count)));
      if (count <= 0) {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        return;
      }
      timer = window.setTimeout(step, 14);
    };

    timer = window.setTimeout(step, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, focused, index]);

  const go = () => {
    const idea = value.trim();
    if (!idea) return;
    router.push(
      `/brief?idea=${encodeURIComponent(idea)}&autostart=1`,
    );
  };

  const showGhost = !value;

  const creditLine = user
    ? `${user.credits} verdict${user.credits === 1 ? "" : "s"} left`
    : usingSupabase
      ? `${startingCredits} free verdicts after you sign in`
      : anonCredits > 0
        ? "First verdict free · no email"
        : `${startingCredits} free on this device`;

  return (
    <div className="composer-rim">
      <div className="composer-rim-fill" aria-hidden>
        <span className="composer-rim-blob composer-rim-blob-a" />
        <span className="composer-rim-blob composer-rim-blob-b" />
        <svg className="composer-rim-noise">
          <filter id="composer-rim-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#composer-rim-noise)" />
        </svg>
      </div>
      <div className="composer">
        <div className="composer-field-wrap">
          {showGhost && (
            <span className="composer-ghost" aria-hidden>
              {typed}
              <span className="composer-caret" />
            </span>
          )}
          <textarea
            className="composer-field"
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go();
              }
            }}
            aria-label="Describe your startup idea"
          />
        </div>
        <div className="composer-bar">
          <p>{creditLine}</p>
          <button
            type="button"
            className="composer-send"
            onClick={go}
            disabled={!value.trim()}
            aria-label="Run Debrief"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
