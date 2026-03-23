"use client";

import { useState, useEffect } from "react";
import type { HealthColor } from "@/lib/workflow/cost-tracker";

/** Map progress percentage to color — more lenient than health score thresholds. */
function getProgressColor(percent: number): HealthColor {
  if (percent >= 50) return "green";
  if (percent >= 20) return "amber";
  return "red";
}
import { useServiceWorker } from "@/hooks/useServiceWorker";

interface DigestMetadata {
  progressPercent: number;
  activeAgents: number;
  blockerCount: number;
}

/**
 * Compact mobile status bar (Story 44.8).
 *
 * Shows health score, active agents, and blocker count.
 * Visible only on small screens (hidden on md+ via parent).
 */
export function MobileStatusBar() {
  useServiceWorker(); // Register SW on mobile (Story 44.8)
  const [data, setData] = useState<DigestMetadata | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/sprint/digest", { signal: controller.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { metadata?: DigestMetadata };
        if (json.metadata) {
          setData(json.metadata);
        }
      } catch {
        // Offline or fetch error — show cached state or empty
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  const color = data ? getProgressColor(data.progressPercent) : "amber";
  const colorClass =
    color === "green"
      ? "bg-[var(--color-status-success)]"
      : color === "red"
        ? "bg-[var(--color-status-error)]"
        : "bg-[var(--color-status-attention)]";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
      data-testid="mobile-status-bar"
    >
      {/* Health badge */}
      <div className="flex items-center gap-1.5" data-testid="mobile-health">
        <span className={`w-2 h-2 rounded-full ${colorClass}`} aria-hidden="true" />
        <span className="text-[11px] text-[var(--color-text-primary)] font-medium">
          {data ? `${data.progressPercent}%` : "—"}
        </span>
      </div>

      {/* Active agents */}
      <span className="text-[11px] text-[var(--color-text-secondary)]" data-testid="mobile-agents">
        {data ? `${data.activeAgents} agent${data.activeAgents !== 1 ? "s" : ""}` : "—"}
      </span>

      {/* Blockers */}
      {data && data.blockerCount > 0 && (
        <span
          className="text-[11px] text-[var(--color-status-error)] font-medium"
          data-testid="mobile-blockers"
        >
          {data.blockerCount} blocker{data.blockerCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
