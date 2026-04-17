/**
 * Scenario store — thin re-export wrapper delegating to file-based persistence (Story 54.5).
 *
 * Maintains the same 6-function API established in Story 54.1,
 * plus getRevisions for revision history (Story 54.5 Task 2).
 * All functions are async and delegate to scenario-persistence.ts.
 */

import type { WhatIfScenario } from "./types";
import {
  listScenarios as persistList,
  getScenario as persistGet,
  addScenario as persistAdd,
  updateScenario as persistUpdate,
  deleteScenario as persistDelete,
  clearScenarios as persistClear,
  getRevisions as persistGetRevisions,
} from "./scenario-persistence";

export type { ScenarioRevision } from "./scenario-persistence";

/** List all stored scenarios, sorted by last modified (newest first). */
export async function listScenarios(): Promise<WhatIfScenario[]> {
  return persistList();
}

/** Get a single scenario by ID. Returns undefined if not found. */
export async function getScenario(id: string): Promise<WhatIfScenario | undefined> {
  return persistGet(id);
}

/** Add a scenario to the store and persist to disk. */
export async function addScenario(scenario: WhatIfScenario): Promise<void> {
  return persistAdd(scenario);
}

/**
 * Update a scenario by merging partial data.
 * Returns the updated scenario, or undefined if not found.
 */
export async function updateScenario(
  id: string,
  partial: Partial<WhatIfScenario>,
): Promise<WhatIfScenario | undefined> {
  return persistUpdate(id, partial);
}

/** Delete a scenario by ID. Returns true if found and deleted. */
export async function deleteScenario(id: string): Promise<boolean> {
  return persistDelete(id);
}

/** Clear all scenarios (testing utility). */
export async function clearScenarios(): Promise<void> {
  return persistClear();
}

/** Get revision history for a scenario. */
export async function getRevisions(scenarioId: string) {
  return persistGetRevisions(scenarioId);
}
