"use client";

import { useState, useEffect, useCallback } from "react";
import type { ResourceConflictType, ResourceConflictPolicy } from "@composio/ao-core";

const RESOURCE_TYPES: ResourceConflictType[] = [
  "repository",
  "file-path",
  "agent",
  "external-service",
];

const RESOURCE_LABELS: Record<ResourceConflictType, string> = {
  repository: "Repository",
  "file-path": "File Path",
  agent: "Agent",
  "external-service": "External Service",
};

const MODE_LABELS: Record<string, string> = {
  "priority-based": "Priority Based",
  manual: "Manual",
  isolation: "Isolation",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  "priority-based": "Highest-priority project wins the resource",
  manual: "Alert only — no auto-resolution",
  isolation: "Each project gets its own isolated resource instance",
};

export function ConflictPolicyPanel() {
  const [policies, setPolicies] = useState<Record<string, ResourceConflictPolicy>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/conflicts/policies");
      if (!res.ok) throw new Error("Failed to fetch policies");
      const data = (await res.json()) as { policies: Record<string, ResourceConflictPolicy> };
      setPolicies(data.policies);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPolicies();
  }, [fetchPolicies]);

  const updatePolicy = useCallback(
    async (resourceType: ResourceConflictType, resolutionMode: string) => {
      setSavingType(resourceType);
      try {
        const res = await fetch(`/api/conflicts/policies/${encodeURIComponent(resourceType)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolutionMode }),
        });
        if (!res.ok) throw new Error("Failed to update policy");
        // Refresh policies after update
        await fetchPolicies();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update policy");
      } finally {
        setSavingType(null);
      }
    },
    [fetchPolicies],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading policies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Resolution Policies</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure how resource conflicts are resolved for each resource type. Hierarchy: project
          override &rarr; global default &rarr; manual.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {RESOURCE_TYPES.map((rt) => {
          const policy = policies[rt];
          if (!policy) return null;

          return (
            <div key={rt} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">{RESOURCE_LABELS[rt]}</h3>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {MODE_LABELS[policy.resolutionMode] ?? policy.resolutionMode}
                </span>
              </div>

              <p className="mb-3 text-xs text-gray-500">
                {MODE_DESCRIPTIONS[policy.resolutionMode] ?? ""}
              </p>

              <select
                value={policy.resolutionMode}
                onChange={(e) => void updatePolicy(rt, e.target.value)}
                disabled={savingType === rt}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="priority-based">Priority Based</option>
                <option value="manual">Manual</option>
                <option value="isolation">Isolation</option>
              </select>

              {savingType === rt && <p className="mt-2 text-xs text-gray-400">Saving...</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
