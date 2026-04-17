"use client";

import type { ResourceConflict } from "@composio/ao-core";

interface ConflictSummaryCardsProps {
  conflicts: ResourceConflict[];
}

export function ConflictSummaryCards({ conflicts }: ConflictSummaryCardsProps) {
  const totalConflicts = conflicts.length;
  const bySeverity = countBy(conflicts, (c) => c.severity);
  const byResourceType = countBy(conflicts, (c) => c.resourceType);

  const criticalCount = bySeverity.get("critical") ?? 0;
  const highCount = bySeverity.get("high") ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SummaryCard label="Total Conflicts" value={totalConflicts} valueClass="text-gray-900" />
      <SummaryCard
        label="Critical / High"
        value={criticalCount + highCount}
        valueClass={criticalCount + highCount > 0 ? "text-red-600" : "text-green-600"}
      />
      <BreakdownCard title="By Severity" items={bySeverity} />
      <BreakdownCard title="By Resource Type" items={byResourceType} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function BreakdownCard({ title, items }: { title: string; items: Map<string, number> }) {
  const entries = Array.from(items.entries());
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="text-sm text-gray-500 mb-2">{title}</div>
      {entries.length === 0 ? (
        <div className="text-sm text-gray-400">No conflicts</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, count]) => (
            <span key={key} className="inline-flex items-center gap-1 text-sm">
              <span className="font-medium text-gray-700">{formatLabel(key)}</span>
              <span className="text-gray-400">({count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Capitalize first letter and replace hyphens with spaces. */
function formatLabel(key: string): string {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function countBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
