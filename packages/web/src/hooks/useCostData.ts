"use client";

import { useEffect, useState, useRef } from "react";

/** Poll interval for cost data (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

type ModelTier = "low" | "medium" | "high";

interface CostSummary {
  dimension: "summary";
  totalTokens: number;
  totalCost: number;
  byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
}

/**
 * Runtime validation for CostSummary response shape.
 * Returns the validated data or null if malformed.
 */
function validateCostSummary(raw: unknown): CostSummary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.dimension !== "summary") return null;
  if (typeof obj.totalTokens !== "number") return null;
  if (typeof obj.totalCost !== "number") return null;
  if (typeof obj.byTier !== "object" || obj.byTier === null) return null;
  const tiers = ["low", "medium", "high"] as const;
  const byTier = obj.byTier as Record<string, unknown>;
  for (const tier of tiers) {
    const entry = byTier[tier];
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    if (
      typeof e.tokens !== "number" ||
      typeof e.cost !== "number" ||
      typeof e.sessions !== "number"
    ) {
      return null;
    }
  }
  return obj as unknown as CostSummary;
}

/**
 * Hook that fetches model cost breakdown summary (Story 60.6).
 *
 * Polls GET /api/costs/breakdown?dimension=summary every 30 seconds.
 */
export function useCostData(): {
  summary: CostSummary | null;
  loading: boolean;
  error: string | null;
} {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchSummary() {
      if (!mountedRef.current) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/costs/breakdown?dimension=summary", {
          signal: controller.signal,
        });
        if (!mountedRef.current) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as unknown;
        if (!mountedRef.current) return;
        const data = validateCostSummary(raw);
        if (data) {
          setSummary(data);
          setError(null);
        } else {
          setError("Invalid cost data received");
        }
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Retain previous data on failure — don't null out summary
        setError("Failed to fetch cost data");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    void fetchSummary();

    intervalRef.current = setInterval(() => {
      void fetchSummary();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { summary, loading, error };
}

export type { CostSummary, ModelTier };
