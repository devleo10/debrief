"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  Globe,
  Code,
  Box,
  Users,
  TrendingUp,
  Scale,
  Zap,
} from "lucide-react";

/* ─── Types ─── */
type Stage =
  | "init"
  | "core-activate"
  | "wake"
  | "data-flow"
  | "converge"
  | "consensus"
  | "collapse"
  | "complete"
  | "idle";

interface Particle {
  x: number;
  y: number;
  progress: number;
  speed: number;
  size: number;
  color: string;
  agentIdx: number;
  dir: "in" | "out";
}

interface CardData {
  marketGrowth: number;
  tamValue: number;
  systemHealth: number;
  growthProj: number;
  productStage: number;
  evidence: number;
  confidence: number;
}

/* ─── Agent definitions ─── */
const AGENTS = [
  { id: "market", label: "MARKET RESEARCH", Icon: Globe, color: "#ff5a2b", top: "4%", left: "3%", side: "left" as const },
  { id: "engineer", label: "STAFF ENGINEER", Icon: Code, color: "#22d3ee", top: "35%", left: "0%", side: "left" as const },
  { id: "product", label: "PRODUCT LEAD", Icon: Box, color: "#60a5fa", top: "72%", left: "3%", side: "left" as const },
  { id: "vc", label: "VC PARTNER", Icon: Users, color: "#a78bfa", top: "4%", right: "3%", side: "right" as const },
  { id: "growth", label: "GROWTH ADVISOR", Icon: TrendingUp, color: "#34d399", top: "35%", right: "0%", side: "right" as const },
  { id: "judge", label: "JUDGE DEBATE", Icon: Scale, color: "#fbbf24", top: "72%", right: "3%", side: "right" as const },
];

const SPRING = { damping: 30, stiffness: 100, mass: 1 };
const FLOW_DURATION = 2800;

const INITIAL_CARD: CardData = {
  marketGrowth: 0,
  tamValue: 840,
  systemHealth: 0,
  growthProj: 0,
  productStage: 0,
  evidence: 0,
  confidence: 0,
};

const FINAL_CARD: CardData = {
  marketGrowth: 24.8,
  tamValue: 1200,
  systemHealth: 98,
  growthProj: 37,
  productStage: 3,
  evidence: 82,
  confidence: 92,
};

const PRODUCT_STAGES = ["Idea", "Scope", "Build", "Ship"];

/* ─── Component ─── */
export default function AgentOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stage, setStage] = useState<Stage>("init");
  const [wakeIndex, setWakeIndex] = useState(-1);
  const [cardData, setCardData] = useState<CardData>(INITIAL_CARD);
  const [statusText, setStatusText] = useState("INITIALIZING AI SYSTEM");
  const [statusSub, setStatusSub] = useState("");

  const stageRef = useRef<Stage>("init");
  const wakeRef = useRef(-1);
  const cardDataRef = useRef<CardData>(INITIAL_CARD);
  const flowStartRef = useRef(0);
  const idleCounter = useRef(0);
  const pulseRef = useRef({ time: 0, active: false });

  const prefersReduced = useReducedMotion();

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { wakeRef.current = wakeIndex; }, [wakeIndex]);
  useEffect(() => { cardDataRef.current = cardData; }, [cardData]);

  /* ─── Parallax ─── */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const px = useSpring(mouseX, SPRING);
  const py = useSpring(mouseY, SPRING);
  const m = prefersReduced ? 0 : 1;

  const coreX = useTransform(px, (v) => v * 15 * m);
  const coreY = useTransform(py, (v) => v * 15 * m);
  const cubeRX = useTransform(py, (v) => v * -18 * m);
  const cubeRY = useTransform(px, (v) => v * 18 * m);
  const leftX = useTransform(px, (v) => v * 8 * m);
  const leftY = useTransform(py, (v) => v * 8 * m);
  const rightX = useTransform(px, (v) => v * 12 * m);
  const rightY = useTransform(py, (v) => v * 12 * m);

  useEffect(() => {
    if (prefersReduced) return;
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - r.left) / r.width - 0.5);
      mouseY.set((e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY, prefersReduced]);

  /* ─── Timeline ─── */
  useEffect(() => {
    if (prefersReduced) {
      setStage("idle");
      setWakeIndex(5);
      setCardData(FINAL_CARD);
      cardDataRef.current = FINAL_CARD;
      setStatusText("8 AGENTS ACTIVE");
      setStatusSub("Researching · Validating · Synthesizing");
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      setStage("init");
      setWakeIndex(-1);
      setCardData(INITIAL_CARD);
      cardDataRef.current = INITIAL_CARD;
      setStatusText("INITIALIZING AI SYSTEM");
      setStatusSub("");

      timers.push(setTimeout(() => {
        setStage("core-activate");
        setStatusText("INITIALIZING...");

        timers.push(setTimeout(() => {
          setStage("wake");
          let idx = 0;
          const wakeNext = () => {
            if (idx >= 6) {
              setStatusText("8 AGENTS ACTIVE");
              setStatusSub("Researching · Validating · Synthesizing");
              timers.push(setTimeout(() => {
                setStage("data-flow");
                flowStartRef.current = Date.now();
                setStatusText("EXCHANGING DATA");

                timers.push(setTimeout(() => {
                  setStage("converge");
                  setStatusText("SYNCING AGENTS...");

                  timers.push(setTimeout(() => {
                    setStage("consensus");
                    setStatusText("CONSENSUS REACHED");
                    setStatusSub("");
                    pulseRef.current = { time: Date.now(), active: true };

                    timers.push(setTimeout(() => {
                      setStage("collapse");
                      setStatusText("COMPILING RESULTS...");

                      timers.push(setTimeout(() => {
                        setStage("complete");
                        setStatusText("RESEARCH COMPLETE");

                        timers.push(setTimeout(() => {
                          setStage("idle");
                          setStatusText("8 AGENTS ACTIVE");
                          setStatusSub("Researching · Validating · Synthesizing");
                        }, 2200));
                      }, 1200));
                    }, 800));
                  }, 1600));
                }, FLOW_DURATION));
              }, 1000));
              return;
            }
            setWakeIndex(idx);
            setStatusText(`AGENT ${idx + 1}/6 ACTIVE`);
            idx++;
            timers.push(setTimeout(wakeNext, 650));
          };
          wakeNext();
        }, 700));
      }, 1200));
    };

    run();
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  /* ─── Card data animation ─── */
  useEffect(() => {
    if (stage !== "data-flow") return;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - t0) / FLOW_DURATION, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const d: CardData = {
        marketGrowth: Math.round(FINAL_CARD.marketGrowth * e * 10) / 10,
        tamValue: Math.round(INITIAL_CARD.tamValue + (FINAL_CARD.tamValue - INITIAL_CARD.tamValue) * e),
        systemHealth: Math.round(FINAL_CARD.systemHealth * e),
        growthProj: Math.round(FINAL_CARD.growthProj * e),
        productStage: e < 0.25 ? 0 : e < 0.5 ? 1 : e < 0.75 ? 2 : 3,
        evidence: Math.round(FINAL_CARD.evidence * e),
        confidence: Math.round(e * 100),
      };
      setCardData(d);
      cardDataRef.current = d;
      if (p >= 1) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, [stage]);

  /* ─── Canvas ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const coords = () => {
      const w = canvas.width;
      const h = canvas.height;
      return AGENTS.map((a) => {
        const top = parseFloat(a.top) / 100;
        const cx = 80, cy = 45;
        const x = a.side === "left"
          ? (parseFloat(a.left || "0") / 100) * w + cx
          : w - (parseFloat(a.right || "0") / 100) * w - cx;
        return { x, y: top * h + cy, color: a.color };
      });
    };

    const center = () => ({ x: canvas.width * 0.5, y: canvas.height * 0.42 });

    const bezier = (
      sx: number, sy: number,
      ex: number, ey: number,
      t: number,
    ) => {
      const cp1x = sx + (ex - sx) * 0.4;
      const cp2x = sx + (ex - sx) * 0.6;
      const mt = 1 - t;
      return {
        x: mt ** 3 * sx + 3 * mt ** 2 * t * cp1x + 3 * mt * t ** 2 * cp2x + t ** 3 * ex,
        y: mt ** 3 * sy + 3 * mt ** 2 * t * sy + 3 * mt * t ** 2 * ey + t ** 3 * ey,
      };
    };

    const tick = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const c = center();
      const cs = coords();
      const s = stageRef.current;
      const wk = wakeRef.current;
      const cd = cardDataRef.current;

      const isAwake = (i: number) => {
        if (s === "init" || s === "core-activate") return false;
        if (s === "wake") return i <= wk;
        return true;
      };

      const streamOpacity = (i: number) => {
        if (s === "init" || s === "core-activate") return 0.02;
        if (s === "wake") return i <= wk ? 0.3 : 0.02;
        if (s === "data-flow") return 0.35;
        if (s === "converge") return 0.55;
        if (s === "consensus") return 0.25;
        if (s === "collapse") return 0.12;
        if (s === "complete") return 0.06;
        return 0.08;
      };

      const glowIntensity = (i: number) => {
        if (s === "converge") return 0.25;
        if (s === "data-flow") return 0.15;
        if (s === "wake" && i <= wk) return 0.1;
        return 0;
      };

      /* ─── Draw streams ─── */
      cs.forEach((a, i) => {
        const op = streamOpacity(i);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const cp1x = a.x + (c.x - a.x) * 0.4;
        const cp2x = a.x + (c.x - a.x) * 0.6;
        ctx.bezierCurveTo(cp1x, a.y, cp2x, c.y, c.x, c.y);
        ctx.strokeStyle = isAwake(i)
          ? `${a.color}${Math.floor(op * 255).toString(16).padStart(2, "0")}`
          : `rgba(255,255,255,${op})`;
        ctx.lineWidth = isAwake(i) ? 1.3 : 0.5;
        ctx.stroke();

        const gi = glowIntensity(i);
        if (gi > 0) {
          ctx.strokeStyle = `${a.color}${Math.floor(gi * 255).toString(16).padStart(2, "0")}`;
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      });

      /* ─── Spawn particles ─── */
      if (s === "wake" && wk >= 0) {
        if (Math.random() < 0.12) {
          const idx = wk;
          particles.push({
            x: cs[idx].x, y: cs[idx].y,
            progress: 0, speed: 0.01 + Math.random() * 0.012,
            size: Math.random() * 2.5 + 1.5,
            color: cs[idx].color, agentIdx: idx, dir: "in",
          });
        }
      }

      if (s === "data-flow" || s === "converge") {
        const elapsed = Date.now() - flowStartRef.current;
        const fp = Math.min(elapsed / FLOW_DURATION, 1);
        const rate = s === "converge" ? 0.4 : 0.2;

        if (Math.random() < rate) {
          if (fp < 0.33) {
            const idx = Math.floor(Math.random() * 6);
            particles.push({
              x: cs[idx].x, y: cs[idx].y,
              progress: 0, speed: 0.01 + Math.random() * 0.015,
              size: Math.random() * 2.5 + 1.5,
              color: cs[idx].color, agentIdx: idx, dir: "in",
            });
          } else if (fp < 0.66) {
            const idx = Math.floor(Math.random() * 6);
            particles.push({
              x: c.x, y: c.y,
              progress: 0, speed: 0.01 + Math.random() * 0.015,
              size: Math.random() * 2 + 1,
              color: cs[idx].color, agentIdx: idx, dir: "out",
            });
          } else {
            if (Math.random() < 0.5) {
              const idx = Math.floor(Math.random() * 6);
              particles.push({
                x: cs[idx].x, y: cs[idx].y,
                progress: 0, speed: 0.012 + Math.random() * 0.015,
                size: Math.random() * 2.5 + 1.5,
                color: cs[idx].color, agentIdx: idx, dir: "in",
              });
            } else {
              const idx = Math.floor(Math.random() * 6);
              particles.push({
                x: c.x, y: c.y,
                progress: 0, speed: 0.012 + Math.random() * 0.015,
                size: Math.random() * 2 + 1,
                color: cs[idx].color, agentIdx: idx, dir: "out",
              });
            }
          }
        }
      }

      if (s === "collapse") {
        if (Math.random() < 0.35) {
          const idx = Math.floor(Math.random() * 6);
          particles.push({
            x: cs[idx].x, y: cs[idx].y,
            progress: 0, speed: 0.018 + Math.random() * 0.02,
            size: Math.random() * 2 + 1,
            color: cs[idx].color, agentIdx: idx, dir: "in",
          });
        }
      }

      if (s === "idle") {
        idleCounter.current++;
        if (idleCounter.current % 100 === 0) {
          const idx = Math.floor(Math.random() * 6);
          particles.push({
            x: cs[idx].x, y: cs[idx].y,
            progress: 0, speed: 0.006 + Math.random() * 0.008,
            size: Math.random() * 2 + 1,
            color: cs[idx].color, agentIdx: idx, dir: "in",
          });
        }
        if (idleCounter.current % 200 === 0) {
          pulseRef.current = { time: Date.now(), active: true };
        }
      }

      /* ─── Update & draw particles ─── */
      particles = particles.filter((p) => {
        const sp = s === "collapse" ? p.speed * 1.6 : p.speed;
        p.progress += sp;
        if (p.progress >= 1) return false;

        const a = cs[p.agentIdx] || cs[0];
        const sx = p.dir === "in" ? a.x : c.x;
        const sy = p.dir === "in" ? a.y : c.y;
        const ex = p.dir === "in" ? c.x : a.x;
        const ey = p.dir === "in" ? c.y : a.y;

        const pos = bezier(sx, sy, ex, ey, p.progress);
        const tp = Math.max(0, p.progress - sp * 4);
        const prev = bezier(sx, sy, ex, ey, tp);

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = p.color;
        ctx.shadowBlur = 14;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });

      /* ─── Data ripple during flow ─── */
      if (s === "data-flow" || s === "converge") {
        const elapsed = Date.now() - flowStartRef.current;
        const rp = (elapsed % 1500) / 1500;
        const rr = rp * w * 0.28;
        const ro = (1 - rp) * 0.12;
        ctx.strokeStyle = `rgba(255, 90, 43, ${ro})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* ─── Core pulse ─── */
      if (pulseRef.current.active) {
        const elapsed = Date.now() - pulseRef.current.time;
        const pp = elapsed / 1000;
        if (pp >= 1) {
          pulseRef.current.active = false;
        } else {
          const pr = pp * 70;
          const po = (1 - pp) * 0.22;
          ctx.strokeStyle = `rgba(255, 90, 43, ${po})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, pr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      /* ─── Floor ellipse ─── */
      if (s !== "init" && s !== "core-activate") {
        ctx.strokeStyle = "rgba(255, 90, 43, 0.04)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + h * 0.2, w * 0.2, h * 0.04, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReduced]);

  /* ─── Derived visuals ─── */
  const awake = (i: number) => {
    if (stage === "init" || stage === "core-activate") return false;
    if (stage === "wake") return i <= wakeIndex;
    return true;
  };

  const cardOpacity = (i: number) => {
    if (!awake(i)) return 0.15;
    if (stage === "collapse") return 0.5;
    if (stage === "complete") return 0.3;
    if (stage === "idle") return 0.7;
    return 1;
  };

  const isProcessing =
    stage === "data-flow" || stage === "converge" || stage === "consensus";

  const coreScale =
    stage === "init" ? 0.7 :
    stage === "core-activate" ? 0.85 :
    stage === "collapse" ? 1.35 :
    stage === "complete" ? 1.25 : 1;

  const coreGlow =
    stage === "init" ? "rgba(255,90,43,0.2)" :
    stage === "core-activate" ? "rgba(255,90,43,0.4)" :
    stage === "consensus" ? "rgba(251,191,36,0.95)" :
    stage === "collapse" || stage === "complete" ? "rgba(251,191,36,0.7)" :
    "rgba(255,90,43,0.55)";

  const coreGlowScale =
    stage === "consensus" ? 1.5 :
    stage === "collapse" ? 1.4 :
    stage === "wake" ? 1.1 : 1;

  return (
    <div
      ref={containerRef}
      className="aorb-root"
      style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 620 }}
    >
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, rgba(255,90,43,0.06) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none", zIndex: 10 }}
      />

      {/* Pedestal HUD */}
      <div
        style={{
          position: "absolute", left: "50%", top: "62%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none", zIndex: 1,
        }}
      >
        <svg viewBox="-160 -55 320 115" width="320" height="115" style={{ display: "block" }}>
          <defs>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,90,43,0.18)" />
              <stop offset="100%" stopColor="rgba(255,90,43,0)" />
            </linearGradient>
          </defs>

          {/* Outer ring */}
          <ellipse cx="0" cy="0" rx="150" ry="42" fill="none" stroke="rgba(255,90,43,0.08)" strokeWidth="0.8" />

          {/* Middle dashed ring — animated dash */}
          <ellipse cx="0" cy="0" rx="118" ry="33" fill="none" stroke="rgba(34,211,238,0.07)" strokeWidth="0.6" strokeDasharray="4 3">
            <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="3s" repeatCount="indefinite" />
          </ellipse>

          {/* Inner ring — breathing */}
          <ellipse cx="0" cy="0" rx="85" ry="24" fill="none" stroke="rgba(255,90,43,0.14)" strokeWidth="1">
            <animate attributeName="rx" values="85;88;85" dur="4s" repeatCount="indefinite" />
            <animate attributeName="ry" values="24;26;24" dur="4s" repeatCount="indefinite" />
          </ellipse>

          {/* Radar sweep */}
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="5s" repeatCount="indefinite" />
            <path d="M0,0 L150,0 A150,42 0 0,0 106,-30 Z" fill="url(#sweep)" opacity="0.6" />
            <line x1="0" y1="0" x2="148" y2="0" stroke="rgba(255,90,43,0.22)" strokeWidth="0.6" />
          </g>

          {/* Tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rx = 150, ry = 42;
            const inner = 0.91;
            return (
              <line
                key={i}
                x1={cos * rx * inner}
                y1={sin * ry * inner}
                x2={cos * rx}
                y2={sin * ry}
                stroke="rgba(255,90,43,0.12)"
                strokeWidth={i % 3 === 0 ? 1.2 : 0.5}
              />
            );
          })}

          {/* Center dot */}
          <circle cx="0" cy="0" r="2" fill="rgba(255,90,43,0.35)">
            <animate attributeName="r" values="2;3;2" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Light beam */}
        <div
          style={{
            width: 70, height: 180,
            background: "linear-gradient(to top, rgba(255,90,43,0.1), rgba(255,90,43,0.02), transparent)",
            position: "absolute", top: -160, left: 125, filter: "blur(10px)",
            borderRadius: "50%", pointerEvents: "none",
            animation: "pulse-slow 4s ease-in-out infinite",
          }}
        />
      </div>

      {/* Core cube */}
      <motion.div
        style={{
          x: coreX, y: coreY, rotateX: cubeRX, rotateY: cubeRY,
          position: "absolute", left: "50%", top: "42%",
          marginLeft: -44, marginTop: -44,
          zIndex: 20, pointerEvents: "none", perspective: 600,
        }}
      >
        <div style={{ position: "relative", width: 88, height: 88, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {stage === "consensus" && (
            <motion.div
              initial={{ scale: 0.1, opacity: 0.9 }}
              animate={{ scale: 10, opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute", width: 80, height: 80, borderRadius: "50%",
                background: "white", mixBlendMode: "screen", boxShadow: "0 0 80px #fff",
                zIndex: 30, pointerEvents: "none",
              }}
            />
          )}

          <div
            style={{
              position: "absolute", width: 48, height: 48, borderRadius: "50%",
              filter: "blur(16px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
              background: coreGlow,
              transform: `scale(${coreGlowScale})`,
              boxShadow: stage === "consensus" ? "0 0 50px #f59e0b" : "none",
            }}
          />

          <div style={{ width: 56, height: 56, position: "relative", perspective: 800, transform: `scale(${coreScale})`, transition: "transform 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ width: 56, height: 56, position: "relative", transformStyle: "preserve-3d", animation: "spin 7s linear infinite" }}>
              {[
                { t: "rotateY(0deg) translateZ(28px)", c: "rgba(255,90,43,0.4)", bg: "rgba(255,90,43,0.05)" },
                { t: "rotateY(90deg) translateZ(28px)", c: "rgba(255,90,43,0.4)", bg: "rgba(255,90,43,0.05)" },
                { t: "rotateY(180deg) translateZ(28px)", c: "rgba(255,90,43,0.4)", bg: "rgba(255,90,43,0.05)" },
                { t: "rotateY(270deg) translateZ(28px)", c: "rgba(255,90,43,0.4)", bg: "rgba(255,90,43,0.05)" },
                { t: "rotateX(90deg) translateZ(28px)", c: "rgba(34,211,238,0.3)", bg: "rgba(34,211,238,0.05)" },
                { t: "rotateX(-90deg) translateZ(28px)", c: "rgba(34,211,238,0.3)", bg: "rgba(34,211,238,0.05)" },
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute", inset: 0, border: `2px solid ${f.c}`,
                    borderRadius: 8, background: f.bg, transform: f.t,
                    backfaceVisibility: "visible", display: "flex",
                    alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", border: "1px solid rgba(255,90,43,0.08)", animation: "spin 3s linear infinite", transform: "rotate(12deg)" }} />
          <div style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", border: "1px solid rgba(168,85,250,0.08)", animation: "spin 5s linear reverse infinite", transform: "rotate(-45deg)" }} />

          {/* Status badge */}
          <div
            style={{
              position: "absolute", top: -48, left: "50%", transform: "translateX(-50%)",
              background: "rgba(9,9,11,0.92)", border: "1px solid rgba(255,255,255,0.08)",
              padding: "5px 12px", borderRadius: 20, textAlign: "center",
              fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#e4e4e7" }}>
                {statusText}
              </span>
            </div>
            {statusSub && (
              <div style={{ fontSize: 7, color: "var(--text-3)", marginTop: 2, letterSpacing: "0.04em" }}>
                {statusSub}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Agent cards */}
      {AGENTS.map((agent, i) => {
        const isUp = awake(i);
        const cx = agent.side === "left" ? leftX : rightX;
        const cy = agent.side === "left" ? leftY : rightY;

        return (
          <motion.div
            key={agent.id}
            style={{
              position: "absolute", top: agent.top, width: 170, zIndex: 30,
              x: cx, y: cy,
              opacity: cardOpacity(i),
              ...(agent.side === "left" ? { left: agent.left } : { right: agent.right }),
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: isUp ? i * 0.06 : 0 }}
              className={`aorb-float-${i}`}
            >
              <div
                className={`aorb-panel${isProcessing && isUp ? " aorb-panel--active" : ""}`}
                style={{ ["--cc" as string]: agent.color }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <agent.Icon size={12} color={isUp ? agent.color : "#555"} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: isUp ? "#e4e4e7" : "#888" }}>
                      {agent.label}
                    </span>
                  </div>
                  {isUp && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, fontWeight: 700, color: agent.color, letterSpacing: "0.05em" }}>LIVE</span>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: agent.color, animation: "pulse 2s ease-in-out infinite" }} />
                    </div>
                  )}
                </div>

                {/* Micro UI */}
                <div style={{ minHeight: 44 }}>
                  {renderMicroUI(agent.id, isUp, isProcessing, cardData)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Micro UI per agent ─── */
function renderMicroUI(
  id: string,
  isUp: boolean,
  processing: boolean,
  cd: CardData,
) {
  const dim = !isUp;

  switch (id) {
    case "market":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "4px 5px", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 22, marginBottom: 4 }}>
            {[40, 65, 50, 90, 55, 75, 85].map((v, idx) => (
              <motion.div
                key={idx}
                animate={{ height: dim ? "15%" : processing ? [`${v * 0.4}%`, `${v}%`, `${v * 0.6}%`] : `${v * 0.7}%` }}
                transition={{ repeat: Infinity, duration: 1.8 + idx * 0.15, ease: "easeInOut" }}
                style={{ flex: 1, background: `rgba(255,90,43,${dim ? 0.1 : 0.35})`, borderRadius: 1 }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#ff5a2b" }}>
              +{cd.marketGrowth}%
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>
              MARKET GROWTH
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)" }}>Last 30 days</span>
        </div>
      );

    case "engineer":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "4px 6px", height: "100%", fontFamily: "var(--font-mono)", fontSize: 7, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: dim ? "#555" : "rgba(34,211,238,0.8)" }}>
            <span style={{ color: "#34d399" }}>✔</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>GET /api/v1/schema_check</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: dim ? "#555" : "rgba(34,211,238,0.8)" }}>
            <span style={{ color: "#34d399" }}>✔</span>
            <span>PostGIS extension active</span>
          </div>
          <div style={{ marginTop: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>SYSTEM HEALTH</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#22d3ee" }}>{cd.systemHealth}%</span>
            </div>
            <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <motion.div animate={{ width: `${cd.systemHealth}%` }} style={{ height: "100%", background: "#22d3ee", borderRadius: 2 }} />
            </div>
          </div>
        </div>
      );

    case "vc":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "5px 6px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.06em" }}>TAM ESTIMATE</span>
          <motion.span
            animate={{ color: processing ? ["#c084fc", "#e879f9", "#c084fc"] : "#c084fc" }}
            transition={{ repeat: Infinity, duration: 3 }}
            style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, display: "block", lineHeight: 1.2 }}
          >
            ${cd.tamValue >= 1000 ? `${(cd.tamValue / 1000).toFixed(1)}B` : `${cd.tamValue}M`}
          </motion.span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>VIABLE SCALE MOAT</span>
        </div>
      );

    case "growth":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "4px 5px", height: "100%" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>GROWTH PROJECTION</span>
          <div style={{ height: 22, position: "relative", margin: "3px 0" }}>
            <svg style={{ width: "100%", height: "100%", position: "absolute", left: 0, bottom: 0 }} viewBox="0 0 100 28">
              <motion.path
                animate={{ d: processing ? "M0,28 Q25,18 50,12 T100,2" : "M0,28 Q25,24 50,22 T100,20" }}
                fill="none" stroke="#34d399" strokeWidth="2" strokeOpacity="0.5"
              />
              <path d="M0,28 Q25,18 50,12 T100,2 L100,28 Z" fill="#34d399" opacity="0.06" />
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#34d399" }}>
              +{cd.growthProj}%
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)" }}>projected growth</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)" }}>Next 6 months</span>
        </div>
      );

    case "product":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "5px 6px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 2, alignItems: "center", marginBottom: 5 }}>
            {PRODUCT_STAGES.map((label, idx) => (
              <React.Fragment key={idx}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <motion.div
                    animate={{
                      backgroundColor: idx <= cd.productStage
                        ? "rgba(96,165,250,0.85)"
                        : "rgba(255,255,255,0.08)",
                    }}
                    style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid rgba(96,165,250,0.3)" }}
                  />
                  <span style={{ fontSize: 5, fontFamily: "var(--font-mono)", color: idx <= cd.productStage ? "#60a5fa" : "#555" }}>{label}</span>
                </div>
                {idx < 3 && <div style={{ flex: 1, height: 1, background: idx < cd.productStage ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.06)", minWidth: 6 }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>CURRENT STAGE</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.12)", padding: "1px 5px", borderRadius: 3 }}>
              {PRODUCT_STAGES[cd.productStage]}
            </span>
          </div>
        </div>
      );

    case "judge":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "5px 6px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>EVIDENCE STRENGTH</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#fbbf24" }}>{cd.evidence}%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <motion.div animate={{ width: `${cd.evidence}%` }} style={{ height: "100%", background: "#fbbf24", borderRadius: 2, boxShadow: "0 0 6px #fbbf24" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--text-3)", letterSpacing: "0.04em" }}>CONFIDENCE LEVEL</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: cd.confidence > 70 ? "#34d399" : "#fbbf24" }}>
              {cd.confidence > 80 ? "High" : cd.confidence > 50 ? "Medium" : "Low"}
            </span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
