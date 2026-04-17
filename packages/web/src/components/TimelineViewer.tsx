"use client";

import { useState } from "react";
import type { ReplayEventType } from "@composio/ao-core";
import { useTimelineSSE } from "@/hooks/useTimelineSSE";
import { ActivityDot } from "./ActivityDot";

/**
 * Visual timeline showing sub-agent activity per session.
 * Renders color-coded entries with agent filter.
 *
 * Epic 60, Story 60-4 (FR-D2-2).
 */

interface TimelineViewerProps {
  sessionId: string;
}

// ── Event type categories for color coding ──────────────────────

const AGENT_EVENTS: ReplayEventType[] = ["agent_start", "agent_stop"];
const TOOL_EVENTS: ReplayEventType[] = ["tool_start", "tool_end"];
const FILE_EVENTS: ReplayEventType[] = ["file_touch"];

type EventCategory = "agent" | "tool" | "file" | "system";

function getCategory(event: ReplayEventType): EventCategory {
  if (AGENT_EVENTS.includes(event)) return "agent";
  if (TOOL_EVENTS.includes(event)) return "tool";
  if (FILE_EVENTS.includes(event)) return "file";
  return "system";
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  agent: "var(--color-accent)",
  tool: "var(--color-status-ready)",
  file: "var(--color-status-attention)",
  system: "var(--color-text-muted)",
};

const CATEGORY_BG: Record<EventCategory, string> = {
  agent: "rgba(88,166,255,0.08)",
  tool: "rgba(63,185,80,0.08)",
  file: "rgba(210,153,34,0.08)",
  system: "rgba(72,79,88,0.08)",
};

// ── Formatting helpers ──────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ───────────────────────────────────────────────────

export function TimelineViewer({ sessionId }: TimelineViewerProps) {
  const { timeline, connected } = useTimelineSSE(sessionId);
  const [agentFilter, setAgentFilter] = useState("");

  const trimmedFilter = agentFilter.trim();
  const filtered = trimmedFilter
    ? timeline.filter((e) => e.agent.toLowerCase().includes(trimmedFilter.toLowerCase()))
    : timeline;

  const header = (
    <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
      Agent Timeline
      <ActivityDot activity={connected ? "active" : "idle"} dotOnly size={6} />
    </h2>
  );

  if (timeline.length === 0) {
    return (
      <div className="detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6">
        {header}
        <p className="text-[12px] text-[var(--color-text-secondary)]">No timeline data yet.</p>
      </div>
    );
  }

  return (
    <div className="detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6">
      {header}

      {/* Agent filter */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by agent name..."
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-[4px] border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-strong)]"
        />
        {trimmedFilter && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {filtered.length} of {timeline.length}
          </span>
        )}
      </div>

      {/* Timeline entries */}
      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {filtered.map((entry, i) => {
          const category = getCategory(entry.event);
          const color = CATEGORY_COLORS[category];
          const bg = CATEGORY_BG[category];

          return (
            <div
              key={`${entry.timestamp}-${entry.agent}-${i}`}
              className="flex items-start gap-2 rounded-[4px] px-2 py-1.5"
              style={{ background: bg }}
            >
              {/* Timestamp */}
              <span
                className="font-[var(--font-mono)] text-[10px] shrink-0 pt-0.5"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {formatTimestamp(entry.timestamp)}
              </span>

              {/* Color indicator dot */}
              <span
                className="shrink-0 rounded-full mt-1"
                style={{
                  width: 5,
                  height: 5,
                  background: color,
                }}
              />

              {/* Agent name with badge */}
              <span
                className="text-[10px] font-semibold shrink-0 rounded-[3px] px-1.5 py-0.5"
                style={{
                  color,
                  background: `color-mix(in srgb, ${color} 12%, transparent)`,
                }}
              >
                {entry.agent}
              </span>

              {/* Agent type badge */}
              {entry.agentType && (
                <span
                  className="text-[9px] shrink-0 rounded-[3px] px-1 py-0.5"
                  style={{
                    color: "var(--color-text-tertiary)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {entry.agentType}
                </span>
              )}

              {/* Action text */}
              <span className="text-[11px] text-[var(--color-text-secondary)] flex-1 min-w-0">
                {entry.action}
              </span>

              {/* File path */}
              {entry.file && (
                <span
                  className="font-[var(--font-mono)] text-[10px] shrink-0 truncate max-w-[200px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                  title={entry.file}
                >
                  {entry.file}
                </span>
              )}

              {/* Duration badge */}
              {entry.duration !== null && entry.duration !== undefined && (
                <span
                  className="font-[var(--font-mono)] text-[10px] shrink-0 rounded-[3px] px-1.5 py-0.5"
                  style={{
                    color: "var(--color-text-muted)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {formatDuration(entry.duration)}
                </span>
              )}

              {/* Success/failure indicator */}
              {entry.success !== null && entry.success !== undefined && (
                <span
                  className="text-[10px] shrink-0"
                  style={{
                    color: entry.success
                      ? "var(--color-status-ready)"
                      : "var(--color-status-error)",
                  }}
                >
                  {entry.success ? "✓" : "✗"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
