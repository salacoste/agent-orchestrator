"use client";

import type { ConflictPatternSummary as PatternSummary } from "@composio/ao-core";

interface ConflictPatternSummaryProps {
  patterns: PatternSummary | null;
}

export function ConflictPatternSummary({ patterns }: ConflictPatternSummaryProps) {
  if (!patterns) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <PatternCard label="Total Resolved" value={patterns.totalResolved} />
      <PatternCard
        label="Avg Resolution Time"
        value={formatDuration(patterns.avgResolutionTimeMs)}
      />
      <PatternCard
        label="Most Conflicted Resource"
        value={patterns.mostConflictedResource ?? "N/A"}
      />
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="text-sm text-gray-500 mb-2">Recurring Conflicts</div>
        {patterns.recurringConflicts.length === 0 ? (
          <div className="text-sm text-gray-400">None</div>
        ) : (
          <ul className="space-y-1">
            {patterns.recurringConflicts.map((rc) => (
              <li key={rc.resourceIdentifier} className="text-sm">
                <span className="font-medium text-gray-700">{rc.resourceIdentifier}</span>
                <span className="text-gray-400 ml-1">({rc.count}x)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PatternCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "N/A";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
