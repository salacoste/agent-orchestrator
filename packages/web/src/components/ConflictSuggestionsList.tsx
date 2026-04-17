"use client";

import { useEffect, useState } from "react";
import type {
  ResourceConflictResolutionStrategy,
  ResourceConflictSuggestion,
} from "@composio/ao-core";

interface ConflictSuggestionsListProps {
  conflictId: string;
}

const STRATEGY_TITLES: Record<ResourceConflictResolutionStrategy, string> = {
  "sequential-scheduling": "Sequential Scheduling",
  "resource-isolation": "Resource Isolation",
  "agent-reassignment": "Agent Reassignment",
  "increase-capacity": "Increase Capacity",
  "stagger-schedules": "Stagger Schedules",
};

export function ConflictSuggestionsList({ conflictId }: ConflictSuggestionsListProps) {
  const [suggestions, setSuggestions] = useState<ResourceConflictSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/conflicts/${encodeURIComponent(conflictId)}/suggestions`);
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = await res.json();
        if (!cancelled) {
          setSuggestions(body.suggestions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load suggestions");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [conflictId]);

  if (loading) {
    return (
      <div className="py-3 text-sm text-gray-400" aria-label="Loading suggestions">
        Loading suggestions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 text-sm text-red-600" role="alert">
        {error}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="py-3 text-sm text-gray-500 italic">
        No automatic suggestions available for this conflict severity.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={`rounded border p-3 ${
            suggestion.recommended ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-gray-900">
              {STRATEGY_TITLES[suggestion.strategy]}
            </h4>
            {suggestion.recommended && (
              <span
                className="text-xs font-medium text-blue-700 bg-blue-100 rounded px-2 py-0.5"
                aria-label="Recommended strategy"
              >
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
          <p className="text-xs text-gray-500 mb-2">{suggestion.impactEstimate}</p>
          {suggestion.actions.length > 0 && (
            <div className="space-y-1">
              {suggestion.actions.map((action, i) => (
                <div key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                  <span className="inline-block mt-0.5 h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
                  <span>
                    <span className="font-medium text-gray-600">{action.type}:</span>{" "}
                    {action.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
