/**
 * LKG (Last-Known-Good) cache for workflow data (WD-7 Layer 2).
 *
 * Stores per-project, per-field cached values so that individual
 * data source failures don't cascade to other panels.
 * Cache is a fallback — every request reads fresh data first.
 */

import type { WorkflowResponse } from "./types";

/** Cache fields matching independently-failing WorkflowResponse data sources. */
export type CacheField = "phases" | "agents" | "recommendation" | "artifacts" | "lastActivity";

class WorkflowLkgCache {
  private cache = new Map<string, Map<CacheField, unknown>>();

  /** Get cached value for a specific field. Returns null on cache miss. */
  get<T>(projectId: string, field: CacheField): T | null {
    return (this.cache.get(projectId)?.get(field) as T) ?? null;
  }

  /** Set cached value for a specific field. */
  set(projectId: string, field: CacheField, value: unknown): void {
    if (!this.cache.has(projectId)) {
      this.cache.set(projectId, new Map());
    }
    this.cache.get(projectId)!.set(field, value);
  }

  /** Update all fields from a successful WorkflowResponse. */
  setAll(projectId: string, response: WorkflowResponse): void {
    const fields = new Map<CacheField, unknown>();
    fields.set("phases", response.phases);
    fields.set("agents", response.agents);
    fields.set("recommendation", response.recommendation);
    fields.set("artifacts", response.artifacts);
    fields.set("lastActivity", response.lastActivity);
    this.cache.set(projectId, fields);
  }

  /** Build a full WorkflowResponse from cached fields. Returns null if no cache for project. */
  getFullResponse(projectId: string, projectName: string): WorkflowResponse | null {
    const fields = this.cache.get(projectId);
    if (!fields) return null;
    return {
      projectId,
      projectName,
      hasBmad: true,
      phases: (fields.get("phases") as WorkflowResponse["phases"]) ?? [],
      agents: (fields.get("agents") as WorkflowResponse["agents"]) ?? null,
      recommendation: (fields.get("recommendation") as WorkflowResponse["recommendation"]) ?? null,
      artifacts: (fields.get("artifacts") as WorkflowResponse["artifacts"]) ?? [],
      lastActivity: (fields.get("lastActivity") as WorkflowResponse["lastActivity"]) ?? null,
    };
  }

  /** @internal Test-only: reset all cached state. */
  _resetForTesting(): void {
    this.cache.clear();
  }
}

/** Module-level singleton (WD-7 Layer 2). */
export const lkgCache = new WorkflowLkgCache();
