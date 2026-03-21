/**
 * Collaboration Service Tests (Epic 15)
 */

import { describe, it, expect } from "vitest";
import {
  getReadyStories,
  buildHandoffContext,
  detectFileConflicts,
  buildCollabGraph,
  type StoryDependency,
} from "../collaboration-service.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "ao-1",
    agentId: "ao-1",
    storyId: "s1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: ["src/index.ts"],
    testsAdded: 0,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("getReadyStories", () => {
  it("returns stories with all deps completed", () => {
    const deps: StoryDependency[] = [
      { storyId: "A", dependsOn: [], status: "completed" },
      { storyId: "B", dependsOn: ["A"], status: "waiting" },
      { storyId: "C", dependsOn: ["A", "B"], status: "waiting" },
    ];
    const completed = new Set(["A"]);

    const ready = getReadyStories(deps, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].storyId).toBe("B");
  });

  it("handles diamond dependencies", () => {
    const deps: StoryDependency[] = [{ storyId: "C", dependsOn: ["A", "B"], status: "waiting" }];
    const completed = new Set(["A", "B"]);

    const ready = getReadyStories(deps, completed);
    expect(ready).toHaveLength(1);
    expect(ready[0].storyId).toBe("C");
  });

  it("returns empty when all waiting", () => {
    const deps: StoryDependency[] = [{ storyId: "B", dependsOn: ["A"], status: "waiting" }];
    const completed = new Set<string>();

    expect(getReadyStories(deps, completed)).toEqual([]);
  });

  it("returns stories with no deps as ready", () => {
    const deps: StoryDependency[] = [{ storyId: "A", dependsOn: [], status: "waiting" }];

    const ready = getReadyStories(deps, new Set());
    expect(ready).toHaveLength(1);
    expect(ready[0].storyId).toBe("A");
  });
});

describe("buildHandoffContext", () => {
  it("builds context string from learning", () => {
    const learning = makeLearning({
      agentId: "ao-agent-1",
      storyId: "1-1-auth",
      filesModified: ["src/auth.ts", "src/middleware.ts"],
      domainTags: ["backend", "api"],
    });

    const context = buildHandoffContext(learning);
    expect(context).toContain("ao-agent-1");
    expect(context).toContain("1-1-auth");
    expect(context).toContain("src/auth.ts");
    expect(context).toContain("backend, api");
  });

  it("handles empty files", () => {
    const learning = makeLearning({ filesModified: [] });
    const context = buildHandoffContext(learning);
    expect(context).toContain("no files tracked");
  });
});

describe("detectFileConflicts", () => {
  it("detects overlapping files between agents", () => {
    const active = new Map<string, SessionLearning>([
      [
        "ao-1",
        makeLearning({
          agentId: "ao-1",
          storyId: "s1",
          filesModified: ["src/types.ts", "src/index.ts"],
        }),
      ],
      [
        "ao-2",
        makeLearning({
          agentId: "ao-2",
          storyId: "s2",
          filesModified: ["src/types.ts", "src/other.ts"],
        }),
      ],
    ]);

    const conflicts = detectFileConflicts(active);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe("src/types.ts");
    expect(conflicts[0].agentA).toBe("ao-1");
    expect(conflicts[0].agentB).toBe("ao-2");
  });

  it("returns empty when no overlapping files", () => {
    const active = new Map<string, SessionLearning>([
      ["ao-1", makeLearning({ filesModified: ["src/a.ts"] })],
      ["ao-2", makeLearning({ filesModified: ["src/b.ts"] })],
    ]);

    expect(detectFileConflicts(active)).toEqual([]);
  });

  it("handles single agent (no conflicts possible)", () => {
    const active = new Map<string, SessionLearning>([
      ["ao-1", makeLearning({ filesModified: ["src/a.ts"] })],
    ]);

    expect(detectFileConflicts(active)).toEqual([]);
  });
});

describe("buildCollabGraph", () => {
  it("builds graph with correct statuses", () => {
    const deps: StoryDependency[] = [
      { storyId: "A", dependsOn: [], status: "completed", assignedAgent: "ao-1" },
      { storyId: "B", dependsOn: ["A"], status: "waiting", assignedAgent: "ao-2" },
      { storyId: "C", dependsOn: ["A", "B"], status: "waiting" },
    ];
    const completed = new Set(["A"]);

    const graph = buildCollabGraph(deps, completed);
    expect(graph).toHaveLength(3);
    expect(graph[0].status).toBe("completed");
    expect(graph[1].status).toBe("active"); // B: deps met, has agent
    expect(graph[2].status).toBe("waiting"); // C: B not done yet
    expect(graph[2].waitingOn).toContain("B");
  });
});
