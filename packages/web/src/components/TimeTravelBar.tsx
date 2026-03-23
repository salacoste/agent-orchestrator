"use client";

import type { HistoricalState } from "@/lib/workflow/time-travel";

interface TimeTravelBarProps {
  /** Selected timestamp (ISO 8601) or null for live mode. */
  timestamp: string | null;
  /** Called when user selects a timestamp. */
  onTimestampChange: (timestamp: string | null) => void;
  /** Reconstructed historical state (null while loading or in live mode). */
  state: HistoricalState | null;
  /** True when no events exist for the selected time. */
  noData: boolean;
}

/**
 * Time Travel bar — date picker + state banner (Story 45.2).
 *
 * Shows amber banner when viewing historical state.
 * Provides datetime-local picker and "Return to Present" button.
 */
export function TimeTravelBar({ timestamp, onTimestampChange, state, noData }: TimeTravelBarProps) {
  return (
    <div data-testid="time-travel-bar">
      {/* Picker row — always visible */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <label
          className="text-[10px] text-[var(--color-text-muted)] font-medium"
          htmlFor="tt-picker"
        >
          Time Travel
        </label>
        <input
          id="tt-picker"
          type="datetime-local"
          value={timestamp ? toLocalDatetimeValue(timestamp) : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              onTimestampChange(new Date(val).toISOString());
            } else {
              onTimestampChange(null);
            }
          }}
          className="text-[11px] bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-[4px] px-2 py-1 text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          data-testid="time-travel-picker"
        />
        {timestamp && (
          <button
            type="button"
            onClick={() => onTimestampChange(null)}
            className="text-[10px] text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
            data-testid="time-travel-return"
          >
            Return to Present
          </button>
        )}
      </div>

      {/* Banner — only when time traveling */}
      {timestamp && (
        <div
          className="px-4 py-2 bg-[var(--color-status-attention)]/10 border-b border-[var(--color-status-attention)]/30 text-[11px]"
          data-testid="time-travel-banner"
        >
          {noData ? (
            <span className="text-[var(--color-text-muted)]" data-testid="time-travel-no-data">
              No data available for this period.
            </span>
          ) : state ? (
            <span className="text-[var(--color-text-primary)]">
              Viewing state at:{" "}
              <span className="font-medium">
                {new Date(timestamp).toLocaleString("en-US", { hour12: false })}
              </span>
              {" — "}
              {Object.keys(state.activeStories).length} stories, {state.activeAgents.length} agents,{" "}
              {state.blockers.length} blockers
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">Reconstructing state...</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:MM). */
function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}
