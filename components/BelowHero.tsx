"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight } from "lucide-react";

type Phase = "idle" | "research" | "challenge" | "disagree" | "verdict";

const STEPS: { n: string; title: string; phase: Phase }[] = [
  { n: "01", title: "Research", phase: "research" },
  { n: "02", title: "Challenge", phase: "challenge" },
  { n: "03", title: "Disagree", phase: "disagree" },
  { n: "04", title: "Verdict", phase: "verdict" },
];

const ORDER: Phase[] = ["idle", "research", "challenge", "disagree", "verdict"];

const STATUS: Record<Phase, string> = {
  idle: "Waiting for the room.",
  research: "Reading the market.",
  challenge: "Seven seats, no allies.",
  disagree: "Nobody is allowed to agree.",
  verdict: "The synthesizer had to pick a side.",
};

const SEATS = [
  { role: "VC Investor", short: "VC" },
  { role: "Customer", short: "Buyer" },
  { role: "Senior Engineer", short: "Eng" },
  { role: "Competitor", short: "Rival" },
  { role: "Devil's Advocate", short: "Devil" },
  { role: "Growth Marketer", short: "Growth" },
  { role: "Synthesizer", short: "Judge" },
];

const LINES: { text: string; interrupts?: boolean }[] = [
  {
    text: "Per audit is a feature price. Nobody builds a fund return on four dollar checks.",
  },
  {
    text: "I would not pay for that. Our auditor already signs off on our offsets once a year.",
    interrupts: true,
  },
  {
    text: "Verra and Gold Standard have no clean API. Half of this product is scraping PDFs.",
  },
  {
    text: "We already rate these credits inside the subscription. You are pricing against free.",
  },
  {
    text: "Sylvera and BeZero own the trust. A registry changes its format and every audit you sold is wrong.",
    interrupts: true,
  },
  {
    text: "Your buyer is a sustainability lead at a 2,000 person company. They buy at conferences, not from a docs page.",
  },
  {
    text: "No buyer, no channel, and an incumbent who gives it away. Kill it before you write the scraper.",
  },
];

const CHAR_MS = 16;
const GAP_MS = 2400;
const CUT_MS = 1000;
const RESEARCH_MS = 1700;
const SEATS_MS = 1000;
const SOURCES = 75;

const blankText = () => LINES.map(() => "");
const fullText = () => LINES.map((line) => line.text);

function Helmet() {
  return (
    <svg viewBox="0 0 48 40" className="dx-helmet-icon" aria-hidden>
      <path
        className="dx-helmet-shell"
        d="M7 37V22C7 11.5 14.6 4 24 4s17 7.5 17 18v15"
      />
      <path className="dx-helmet-jaw" d="M7 30h9l4 7M41 30h-9l-4 7" />
      <rect className="dx-helmet-slit" x="11" y="18.5" width="26" height="4" rx="2" />
    </svg>
  );
}

export default function BelowHero() {
  const reduce = useReducedMotion();
  const roomRef = useRef<HTMLElement>(null);
  const inView = useInView(roomRef, { once: true, amount: 0.35 });
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("verdict");
  const [sources, setSources] = useState(SOURCES);
  const [seatsOn, setSeatsOn] = useState(SEATS.length);
  const [spoken, setSpoken] = useState<number[]>([]);
  const [typed, setTyped] = useState(fullText);
  const [active, setActive] = useState(-1);
  const [pick, setPick] = useState<number | null>(null);
  const [debateMs, setDebateMs] = useState(0);

  const started = inView || run > 0;

  useEffect(() => {
    setPick(null);

    if (reduce) {
      setPhase("verdict");
      setSources(SOURCES);
      setSeatsOn(SEATS.length);
      setSpoken(LINES.map((_, i) => i));
      setTyped(fullText());
      setActive(-1);
      return;
    }

    setPhase("idle");
    setSources(0);
    setSeatsOn(0);
    setSpoken([]);
    setTyped(blankText());
    setActive(-1);
    if (!started) return;

    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };

    at(0, () => {
      setPhase("research");
      const t0 = performance.now();
      const count = () => {
        if (cancelled) return;
        const p = Math.min(1, (performance.now() - t0) / RESEARCH_MS);
        setSources(Math.round(SOURCES * p));
        if (p < 1) raf = requestAnimationFrame(count);
      };
      raf = requestAnimationFrame(count);
    });

    at(RESEARCH_MS, () => setPhase("challenge"));
    SEATS.forEach((_, i) => {
      at(RESEARCH_MS + 120 + i * 110, () => setSeatsOn(i + 1));
    });

    const debate0 = RESEARCH_MS + SEATS_MS;
    const starts: number[] = [];
    let clock = debate0;
    LINES.forEach((_, i) => {
      starts.push(clock);
      const next = LINES[i + 1];
      if (next) clock += next.interrupts ? CUT_MS : GAP_MS;
    });
    const last = LINES.length - 1;
    const end = starts[last] + LINES[last].text.length * CHAR_MS + 900;
    setDebateMs(end - debate0);

    at(debate0, () => setPhase("disagree"));

    LINES.forEach((line, i) => {
      at(starts[i], () => {
        setSpoken((prev) => [...prev, i]);
        setActive(i);
        let n = 0;
        const tick = () => {
          if (cancelled) return;
          n += 1;
          const slice = line.text.slice(0, n);
          setTyped((prev) => {
            const next = [...prev];
            next[i] = slice;
            return next;
          });
          if (n < line.text.length) {
            timers.push(window.setTimeout(tick, CHAR_MS));
          }
        };
        tick();
      });
    });

    at(end, () => {
      setActive(-1);
      setPhase("verdict");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [reduce, started, run]);

  const stage = ORDER.indexOf(phase);
  const progress =
    phase === "idle"
      ? 0
      : phase === "research"
        ? 0.25
        : phase === "challenge"
          ? 0.5
          : phase === "disagree"
            ? 0.75
            : 1;
  const progressMs =
    phase === "research"
      ? RESEARCH_MS
      : phase === "challenge"
        ? SEATS_MS
        : phase === "disagree"
          ? debateMs
          : 300;

  const done = phase === "verdict";
  const visible =
    pick !== null ? [pick] : spoken.slice(-2);
  const speaking = pick ?? active;

  return (
    <div className="dx-after">
      <section className="dx-room" id="panel" ref={roomRef} aria-label="The room">
        <header className="dx-room-top">
          <div>
            <p className="dx-eyebrow">On the table</p>
            <h2>An API that audits carbon offset claims, billed per audit.</h2>
          </div>
          <button
            type="button"
            className="dx-replay dx-sweep"
            onClick={() => setRun((v) => v + 1)}
          >
            Replay the room
          </button>
        </header>

        <div className="dx-tl" id="how" aria-label="How a run goes">
          <ol>
            {STEPS.map((step) => {
              const idx = ORDER.indexOf(step.phase);
              const state =
                idx === stage ? "is-now" : idx < stage ? "is-past" : "";
              return (
                <li key={step.n} className={state}>
                  <span>{step.n}</span>
                  {step.title}
                </li>
              );
            })}
          </ol>
          <div className="dx-tl-track" aria-hidden>
            <motion.span
              className="dx-tl-fill"
              initial={false}
              animate={{ scaleX: progress }}
              transition={{
                duration: reduce ? 0 : progressMs / 1000,
                ease: phase === "disagree" ? "linear" : "easeInOut",
              }}
            />
          </div>
          <p className="dx-tl-status" aria-live="polite">
            {STATUS[phase]}
            {phase !== "idle" ? <b> {sources} sources read.</b> : null}
          </p>
        </div>

        <ol className="dx-cast">
          {SEATS.map((seat, i) => {
            const cls = [
              "dx-seat",
              seatsOn > i ? "is-on" : "",
              speaking === i ? "is-speaking" : "",
              spoken.includes(i) ? "has-spoken" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={seat.role}>
                <button
                  type="button"
                  className={cls}
                  disabled={!done}
                  aria-pressed={pick === i}
                  aria-label={`${seat.role}${done ? ". Hear this line again" : ""}`}
                  onClick={() => setPick((p) => (p === i ? null : i))}
                >
                  <Helmet />
                  <span className="dx-seat-name">{seat.role}</span>
                  <span className="dx-seat-short">{seat.short}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <motion.div
          className="dx-floor"
          animate={done && !reduce ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.34, delay: 0.12, ease: "easeOut" }}
        >
          {reduce ? (
            <ol className="dx-transcript">
              {LINES.map((line, i) => (
                <li key={SEATS[i].role}>
                  <p className="dx-say-who">
                    {SEATS[i].role}
                    {line.interrupts ? <em>interrupts</em> : null}
                  </p>
                  <p className="dx-say-line">{line.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="dx-subs">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((i) => {
                  const now = i === speaking;
                  const line = LINES[i];
                  const text = pick !== null ? line.text : typed[i];
                  return (
                    <motion.div
                      key={`${run}-${i}-${pick ?? "live"}`}
                      layout
                      className={`dx-say${now ? " is-now" : ""}`}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: now ? 1 : 0.6, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.34, ease: "easeOut" }}
                    >
                      <p className="dx-say-who">
                        {SEATS[i].role}
                        {line.interrupts ? <em>interrupts</em> : null}
                      </p>
                      <p className="dx-say-line">
                        {text}
                        {text.length < line.text.length ? (
                          <span className="dx-caret" aria-hidden />
                        ) : null}
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {phase === "idle" ? (
                <p className="dx-floor-hint">The room opens when you get here.</p>
              ) : null}
            </div>
          )}

          <AnimatePresence>
            {done ? (
              <motion.p
                key={`stamp-${run}`}
                className="dx-stamp"
                initial={reduce ? false : { scale: 1.4, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: -6, opacity: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 16, mass: 0.7 }
                }
              >
                Kill
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {done && !reduce ? (
          <p className="dx-floor-note">Tap a helmet to hear that line again.</p>
        ) : null}
      </section>

      <section className="dx-ruling" id="examples" aria-label="Live example">
        <div className="dx-rule" aria-hidden />
        <header>
          <p className="dx-eyebrow">Live example</p>
          <p>
            We ran Debrief on its own pitch. 49 seconds, 75 sources, and it did
            not go easy on us.
          </p>
        </header>

        <div className="dx-ruling-head">
          <strong className="dx-ruling-word">Pivot</strong>
          <div className="dx-ruling-score">
            <p>
              <b>5</b>/10
            </p>
            <div className="dx-ticks" aria-label="Score 5 out of 10">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < 5 ? "on" : undefined} />
              ))}
            </div>
          </div>
        </div>

        <blockquote>
          Crowded space, niche appeal, weak differentiation. The forced verdict
          and the live sources are a real wedge, if you narrow it.
        </blockquote>

        <dl className="dx-ledger">
          <div>
            <dt>Competitors found</dt>
            <dd>
              <b>6</b>
              Preuve AI, Validator AI, IdeaProof, ValidatorAI, ChatGPT, Claude.
            </dd>
          </div>
          <div>
            <dt>GitHub overlap</dt>
            <dd>
              <b>510</b>
              Matching repos. The category is crowded.
            </dd>
          </div>
          <div>
            <dt>What to do next</dt>
            <dd>
              Pick one buyer who needs a call made fast, and sell them the
              verdict, not the chat.
            </dd>
          </div>
        </dl>
      </section>

      <section className="dx-close">
        <div className="dx-rule" aria-hidden />
        <h2>If it can survive this room, it can survive a customer.</h2>
        <Link href="/brief" className="dx-cta dx-sweep">
          Get your verdict
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
