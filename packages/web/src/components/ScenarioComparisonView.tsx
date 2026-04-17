"use client";

/**
 * ScenarioComparisonView — side-by-side ranked comparison of 2-4 scenarios (Story 54.4).
 *
 * Fetches comparison data from GET /api/scenarios/compare?ids=... and renders
 * ranked metrics with best-value highlighting.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { SimulationResult } from "@composio/ao-core";
import { getBestMetricIndex } from "@/lib/scenario-comparison";
import { confidenceLabel } from "@/lib/scenario-helpers";

interface RankedScenarioWithMeta {
  name: string;
  storyCount: number;
  result: SimulationResult;
  rank: number;
  color: "green" | "amber" | "red";
  isRecommended: boolean;
  id: string;
  status?: string;
}

interface ComparisonData {
  scenarios: RankedScenarioWithMeta[];
  warnings: string[];
}

function colorToCss(color: "green" | "amber" | "red"): string {
  if (color === "green") return "bg-[var(--color-success)]";
  if (color === "amber") return "bg-[var(--color-warning)]";
  return "bg-[var(--color-error)]";
}

type MetricKey = "p50Days" | "p80Days" | "p95Days" | "onTimeProbability" | "confidence";

interface MetricRow {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
}

const METRICS: MetricRow[] = [
  { key: "p50Days", label: "p50 Days", format: (v) => v.toFixed(1) },
  { key: "p80Days", label: "p80 Days", format: (v) => v.toFixed(1) },
  { key: "p95Days", label: "p95 Days", format: (v) => v.toFixed(1) },
  { key: "onTimeProbability", label: "On-Time %", format: (v) => `${Math.round(v * 100)}%` },
  { key: "confidence", label: "Confidence", format: (v) => confidenceLabel(v) },
];

interface ScenarioComparisonViewProps {
  ids: string[];
}

export function ScenarioComparisonView({ ids }: ScenarioComparisonViewProps) {
  const idsKey = ids.join(",");
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/scenarios/compare?ids=${ids.map(encodeURIComponent).join(",")}`)
      .then(async (res) => {
        const json = (await res.json()) as ComparisonData | { error: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(("error" in json ? json.error : "Comparison failed") as string);
          return;
        }
        setData(json as ComparisonData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  // Pre-compute best index per metric from the raw Scenario-like data
  const bestIndex = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const coreScenarios = data.scenarios.map((s) => ({
      name: s.name,
      storyCount: s.storyCount,
      result: s.result,
    }));
    const result: Record<string, number> = {};
    for (const m of METRICS) {
      result[m.key] = getBestMetricIndex(coreScenarios, m.key);
    }
    return result;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-[var(--color-text-muted)]">Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/scenarios" className="text-sm text-[var(--color-accent)] hover:underline">
          &larr; Back to Scenarios
        </Link>
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    );
  }

  if (!data || data.scenarios.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/scenarios" className="text-sm text-[var(--color-accent)] hover:underline">
          &larr; Back to Scenarios
        </Link>
        <p className="text-sm text-[var(--color-text-muted)]">
          No valid scenarios to compare. Ensure at least 2 scenarios have simulation results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/scenarios" className="text-sm text-[var(--color-accent)] hover:underline">
        &larr; Back to Scenarios
      </Link>

      {data.warnings.length > 0 && (
        <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2">
          {data.warnings.map((w, i) => (
            <p key={i} className="text-sm text-[var(--color-warning)]">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--color-border)] px-3 py-2 text-left text-[var(--color-text-muted)]">
                Metric
              </th>
              {data.scenarios.map((s) => (
                <th
                  key={s.id}
                  className="border-b border-[var(--color-border)] px-3 py-2 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${colorToCss(s.color)}`}
                      />
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        <Link href={`/scenarios/${s.id}`} className="hover:underline">
                          {s.name}
                        </Link>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--color-text-muted)]">#{s.rank}</span>
                      {s.isRecommended && (
                        <span className="rounded-full bg-[var(--color-success)] px-2 py-0.5 text-xs font-medium text-white">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td className="border-b border-[var(--color-border)] px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                  {m.label}
                </td>
                {data.scenarios.map((s, i) => {
                  const val = s.result[m.key];
                  const isBest = bestIndex[m.key] === i;
                  return (
                    <td
                      key={s.id}
                      className={`border-b border-[var(--color-border)] px-3 py-2 text-center ${
                        isBest
                          ? "font-bold text-[var(--color-success)]"
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {m.format(val)}
                      {isBest ? " \u2713" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
