/**
 * Shared filter parsing utilities for conflict history API routes.
 * Eliminates duplication between /api/conflicts/history and /api/conflicts/history/export.
 */

import type {
  ConflictHistoryFilter,
  ResourceConflictType,
  ConflictResolutionOutcome,
} from "@composio/ao-core";

/**
 * Parse conflict history filter parameters from URL search params.
 * Returns a typed ConflictHistoryFilter object.
 */
export function parseHistoryFilter(searchParams: URLSearchParams): ConflictHistoryFilter {
  const filter: ConflictHistoryFilter = {};

  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) filter.dateFrom = dateFrom;

  const dateTo = searchParams.get("dateTo");
  if (dateTo) filter.dateTo = dateTo;

  const resourceType = searchParams.get("resourceType");
  if (resourceType) filter.resourceType = resourceType as ResourceConflictType;

  const projectId = searchParams.get("projectId");
  if (projectId) filter.projectId = projectId;

  const outcome = searchParams.get("outcome");
  if (outcome) filter.resolutionOutcome = outcome as ConflictResolutionOutcome;

  return filter;
}
