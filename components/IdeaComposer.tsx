"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { useAuth, writePendingIdea } from "@/lib/auth/AuthProvider";

const EXAMPLES = [
  "A cross-border payments API for African SaaS selling to US customers",
  "An AI calendar that reads freelance emails and blocks the real deadlines",
  "Contract review for small law firms that flags risk and drafts the reply",
  "A carbon-offset audit API billed like Stripe, per verification",
  "A marketplace where clinics rent idle MRI time by the hour",
];

export default function IdeaComposer() {
  const router = useRouter();
  const { user, openAuth, startingCredits } = useAuth();
  const [value, setValue] = useState("");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value || focused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, 280);
    }, 3800);

    return () => window.clearInterval(id);
  }, [value, focused]);

  const go = () => {
    const idea = value.trim();
    if (!idea) return;
    if (!user) {
      writePendingIdea(idea);
      openAuth();
      return;
    }
    router.push(`/brief?idea=${encodeURIComponent(idea)}`);
  };

  const showGhost = !value;

  return (
    <div className="composer">
      <div className="composer-field-wrap">
        {showGhost && (
          <span className={`composer-ghost${visible ? " is-on" : ""}`} aria-hidden>
            {EXAMPLES[index]}
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
        <p>
          {user
            ? `${user.credits} briefing${user.credits === 1 ? "" : "s"} left`
            : `${startingCredits} free briefings on this device`}
        </p>
        <button
          type="button"
          className="composer-send"
          onClick={go}
          disabled={!value.trim()}
          aria-label="Run briefing"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
