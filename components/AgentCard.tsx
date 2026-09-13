import type { AgentResult } from "@/lib/types";
import { agentMetaMap } from "@/lib/agentMeta";
import { stripStructuredBlocks } from "@/lib/extractScores";
import { previewLine } from "@/lib/parseReadout";
import Prose from "@/components/Prose";
import { Bot } from "lucide-react";

export default function AgentCard({
  name,
  result,
  loading,
  collapsed,
  onToggle,
}: {
  name: string;
  result?: AgentResult;
  loading?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const meta = agentMetaMap[name] || { label: name, color: "#6b7280", icon: <Bot size={14} strokeWidth={2} />, isDevil: false };

  if (loading) {
    return (
      <div className="agent-card loading">
        <div className="agent-card-header">
          <div className="agent-avatar" style={{ color: meta.color }}>{meta.icon}</div>
          <span className="agent-name dim">{meta.label}</span>
          <span className="agent-status-thinking">
            deliberating<span className="thinking-dots"><i /><i /><i /></span>
          </span>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isDevil = meta.isDevil;
  const chips = Object.entries(result.scores).filter(([, v]) => v !== null);
  const overall = result.scores.overall;
  const prose = result.error ? result.output : stripStructuredBlocks(result.output);
  const teaser = !result.error ? previewLine(prose) : "";

  return (
    <div className={`agent-card${isDevil ? " devil" : ""}${result.error ? " errored" : ""}`}>
      <button type="button" className="agent-card-header" onClick={onToggle}>
        <div className="agent-avatar" style={{ color: meta.color }}>{meta.icon}</div>
        <span className="agent-name">{meta.label}</span>
        {result.error
          ? <span className="agent-score-badge failed">failed</span>
          : overall !== null && <span className="agent-score-badge" style={{ color: meta.color, borderColor: meta.color }}>{overall}/10</span>}
        <span className="agent-chevron">{collapsed ? "+" : "−"}</span>
        {collapsed && teaser ? <span className="agent-preview">{teaser}</span> : null}
      </button>

      {!collapsed && (
        <div className="agent-body">
          {chips.length > 1 && (
            <div className="agent-scores">
              {chips.map(([key, val]) => (
                <span key={key} className="agent-score-chip">
                  {key} <strong>{val}</strong>
                </span>
              ))}
            </div>
          )}
          <Prose className={`agent-output${isDevil ? " devil" : ""}`} text={prose} />
        </div>
      )}
    </div>
  );
}
