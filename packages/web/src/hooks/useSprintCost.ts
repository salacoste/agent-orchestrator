"use client";

import { useEffect, useState, useRef } from "react";
import type { SprintCostSummary, SprintClock } from "@/lib/workflow/cost-tracker";

/** Poll interval for sprint cost data (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

/**
 * Hook that fetches sprint cost and clock data (Story 40.2).
 *
 * Polls GET /api/sprint/cost every 30 seconds for updated token usage.
 */
export function useSprintCost(): {
  cost: SprintCostSummary | null;
  clock: SprintClock | null;
} {
  const [cost, setCost] = useState<SprintCostSummary | null>(null);
  const [clock, setClock] = useState<SprintClock | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchCost() {
      try {
        const res = await fetch("/api/sprint/cost");
        if (!res.ok) return;
        const data = (await res.json()) as {
          cost: SprintCostSummary | null;
          clock: SprintClock | null;
        };
        setCost(data.cost);
        setClock(data.clock);
      } catch {
        // Fetch failure — retain previous data
      }
    }

    // Initial fetch
    void fetchCost();

    // Poll every 30s
    intervalRef.current = setInterval(() => {
      void fetchCost();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { cost, clock };
}
