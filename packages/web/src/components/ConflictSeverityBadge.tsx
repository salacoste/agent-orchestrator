"use client";

import type { ResourceConflictSeverity } from "@composio/ao-core";

const severityStyles: Record<ResourceConflictSeverity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

interface ConflictSeverityBadgeProps {
  severity: ResourceConflictSeverity;
}

export function ConflictSeverityBadge({ severity }: ConflictSeverityBadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${severityStyles[severity]}`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
