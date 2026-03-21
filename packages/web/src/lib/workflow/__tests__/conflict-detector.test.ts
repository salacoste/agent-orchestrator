/**
 * File conflict detector tests (Story 20.1).
 */
import { describe, expect, it } from "vitest";

import { detectFileConflicts, groupConflictsByFile } from "../conflict-detector";

describe("detectFileConflicts", () => {
  it("returns empty array when no conflicts", () => {
    const changes = [
      { agentId: "agent-1", modifiedFiles: ["src/a.ts"] },
      { agentId: "agent-2", modifiedFiles: ["src/b.ts"] },
    ];
    expect(detectFileConflicts(changes)).toHaveLength(0);
  });

  it("detects conflict when two agents modify the same file", () => {
    const changes = [
      { agentId: "agent-1", modifiedFiles: ["src/types.ts"] },
      { agentId: "agent-2", modifiedFiles: ["src/types.ts"] },
    ];
    const conflicts = detectFileConflicts(changes);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe("src/types.ts");
    expect(conflicts[0].agentA).toBe("agent-1");
    expect(conflicts[0].agentB).toBe("agent-2");
  });

  it("detects multiple conflicts across different files", () => {
    const changes = [
      { agentId: "agent-1", modifiedFiles: ["src/a.ts", "src/b.ts"] },
      { agentId: "agent-2", modifiedFiles: ["src/b.ts", "src/c.ts"] },
      { agentId: "agent-3", modifiedFiles: ["src/a.ts"] },
    ];
    const conflicts = detectFileConflicts(changes);
    expect(conflicts).toHaveLength(2); // a.ts (1 vs 3), b.ts (1 vs 2)
  });

  it("returns empty for single agent", () => {
    const changes = [{ agentId: "agent-1", modifiedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"] }];
    expect(detectFileConflicts(changes)).toHaveLength(0);
  });

  it("returns empty for no agents", () => {
    expect(detectFileConflicts([])).toHaveLength(0);
  });

  it("handles agents with no modified files", () => {
    const changes = [
      { agentId: "agent-1", modifiedFiles: [] },
      { agentId: "agent-2", modifiedFiles: [] },
    ];
    expect(detectFileConflicts(changes)).toHaveLength(0);
  });
});

describe("groupConflictsByFile", () => {
  it("groups conflicts by file path", () => {
    const conflicts = [
      { filePath: "src/a.ts", agentA: "agent-1", agentB: "agent-2" },
      { filePath: "src/a.ts", agentA: "agent-1", agentB: "agent-3" },
      { filePath: "src/b.ts", agentA: "agent-2", agentB: "agent-3" },
    ];
    const grouped = groupConflictsByFile(conflicts);
    expect(grouped.get("src/a.ts")).toHaveLength(2);
    expect(grouped.get("src/b.ts")).toHaveLength(1);
  });

  it("returns empty map for no conflicts", () => {
    expect(groupConflictsByFile([]).size).toBe(0);
  });
});
