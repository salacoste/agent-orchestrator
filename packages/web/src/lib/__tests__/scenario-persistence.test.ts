/**
 * scenario-persistence unit tests (Story 54.5, Task 1).
 *
 * Tests JSONL persistence, revision tracking, and sorting by updatedAt.
 * Uses temp directory via _resetForTesting() for isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTesting,
  addScenario,
  listScenarios,
  updateScenario,
} from "../scenario-persistence.js";
import type { WhatIfScenario } from "../types.js";

const baseScenario: WhatIfScenario = {
  id: "sc-1",
  name: "Test A",
  createdAt: new Date("2026-01-01").toISOString(),
  projectIds: ["alpha"],
  stories: [{ id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] }],
  parameters: undefined,
  result: undefined,
  status: "draft",
} as WhatIfScenario;

beforeEach(() => {
  _resetForTesting();
});

describe("scenario-persistence", () => {
  it("loadScenarios() reconstructs Map from JSONL events", async () => {
    await addScenario(baseScenario);
    const list = await listScenarios();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("sc-1");
    expect(list[0].name).toBe("Test A");
  });

  it("getScenario() returns scenario by ID", async () => {
    const { getScenario } = await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    const scenario = await getScenario("sc-1");
    expect(scenario).toBeDefined();
    expect(scenario!.name).toBe("Test A");
  });

  it("getScenario() returns undefined for unknown ID", async () => {
    const { getScenario } = await import("../scenario-persistence.js");
    const scenario = await getScenario("nonexistent");
    expect(scenario).toBeUndefined();
  });

  it("updateScenario() merges partial data", async () => {
    const { updateScenario } = await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    const updated = await updateScenario("sc-1", {
      parameters: { agentCount: 2, capacityLimit: 2, storyPriorities: [] },
    });
    expect(updated).toBeDefined();
    expect(updated!.parameters!.agentCount).toBe(2);
    expect(updated!.updatedAt).toBeDefined();
  });

  it("updateScenario() returns undefined if not found", async () => {
    const { updateScenario } = await import("../scenario-persistence.js");
    const result = await updateScenario("nonexistent", { name: "x" });
    expect(result).toBeUndefined();
  });

  it("deleteScenario() removes from store", async () => {
    const { deleteScenario } = await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    const deleted = await deleteScenario("sc-1");
    expect(deleted).toBe(true);
    const list = await listScenarios();
    expect(list).toHaveLength(0);
  });

  it("deleteScenario() returns false if not found", async () => {
    const { deleteScenario } = await import("../scenario-persistence.js");
    const deleted = await deleteScenario("nonexistent");
    expect(deleted).toBe(false);
  });

  it("clearScenarios() empties store", async () => {
    const { clearScenarios } = await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    await clearScenarios();
    const list = await listScenarios();
    expect(list).toHaveLength(0);
  });

  it("getRevisions() returns revision history", async () => {
    const { addScenario, updateScenario, getRevisions } =
      await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    await updateScenario("sc-1", {
      parameters: { agentCount: 2, capacityLimit: 2, storyPriorities: [] },
    });
    const revisions = await getRevisions("sc-1");
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    expect(revisions[0].action).toBe("created");
    expect(revisions[1].action).toBe("updated");
    expect(revisions[1].changes.length).toBeGreaterThanOrEqual(0);
    // Changes should include field, previous, current
    const paramChange = revisions[1].changes.find((c) => c.field === "parameters");
    expect(paramChange).toBeDefined();
  });

  it("getRevisions() returns empty array for unknown scenario", async () => {
    const { getRevisions } = await import("../scenario-persistence.js");
    const revisions = await getRevisions("nonexistent");
    expect(revisions).toEqual([]);
  });

  it("applied status creates 'applied' revision action", async () => {
    const { updateScenario, getRevisions } = await import("../scenario-persistence.js");
    await addScenario(baseScenario);
    // Simulate transition: draft → simulated
    await updateScenario("sc-1", {
      status: "simulated",
      result: {
        p50Days: 5,
        p80Days: 8,
        p95Days: 12,
        onTimeProbability: 0.7,
        confidence: 0.7,
        iterationsRun: 1000,
      },
    });
    // Apply: simulated → applied
    await updateScenario("sc-1", { status: "applied" });
    const revisions = await getRevisions("sc-1");
    const appliedRev = revisions.find((r) => r.action === "applied");
    expect(appliedRev).toBeDefined();
    expect(appliedRev!.changes.length).toBeGreaterThanOrEqual(1);
    const statusChange = appliedRev!.changes.find((c) => c.field === "status");
    expect(statusChange).toBeDefined();
    expect(statusChange!.previous).toBe("simulated");
    expect(statusChange!.current).toBe("applied");
  });

  it("listScenarios() sorts by updatedAt (newest first)", async () => {
    const { addScenario, listScenarios } = await import("../scenario-persistence.js");
    const scenario2: WhatIfScenario = {
      ...baseScenario,
      id: "sc-2",
      name: "Test B",
      createdAt: new Date("2026-01-02").toISOString(),
    };
    await addScenario(baseScenario);
    await addScenario(scenario2);
    // Update sc-1 to make it newer (no setTimeout — deterministic)
    await updateScenario("sc-1", {
      parameters: { agentCount: 3, capacityLimit: 3, storyPriorities: [] },
    });
    const list = await listScenarios();
    expect(list[0].id).toBe("sc-1");
    expect(list[1].id).toBe("sc-2");
  });
});
