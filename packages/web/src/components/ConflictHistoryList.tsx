"use client";

import type { ConflictHistoryEntry } from "@composio/ao-core";

interface ConflictHistoryListProps {
  entries: ConflictHistoryEntry[];
}

export function ConflictHistoryList({ entries }: ConflictHistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">No conflict history entries found.</div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <HistoryEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function HistoryEntryCard({ entry }: { entry: ConflictHistoryEntry }) {
  const date = new Date(entry.resolvedAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-gray-900">{entry.conflict.resourceIdentifier}</div>
          <div className="text-sm text-gray-500 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="capitalize">{entry.conflict.resourceType}</span>
              <span className="text-gray-300 mx-1">|</span>
              {entry.conflict.competingProjects.join(", ")}
            </span>
          </div>
        </div>
        <OutcomeBadge outcome={entry.resolutionOutcome} />
      </div>

      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
        <span>
          Strategy: <span className="text-gray-700">{formatLabel(entry.resolutionStrategy)}</span>
        </span>
        <span>
          Resolved by: <span className="text-gray-700">{entry.resolvedBy}</span>
        </span>
        <span>{formattedDate}</span>
      </div>

      {entry.notes && (
        <div className="mt-2 text-sm text-gray-500 italic">&ldquo;{entry.notes}&rdquo;</div>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, string> = {
    resolved: "bg-green-100 text-green-800",
    "auto-resolved": "bg-blue-100 text-blue-800",
    dismissed: "bg-gray-100 text-gray-700",
    escalated: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[outcome] ?? "bg-gray-100 text-gray-700"}`}
    >
      {formatLabel(outcome)}
    </span>
  );
}

function formatLabel(key: string): string {
  return key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
