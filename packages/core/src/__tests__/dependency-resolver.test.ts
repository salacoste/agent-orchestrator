/**
 * Tests for Story 2-3: Dependency Resolution & Story Unblocking.
 *
 * Covers:
 * - 5.1 Linear dependency chain (A→B→C)
 * - 5.2 Diamond dependency (A→B, A→C, D depends on both B and C)
 * - 5.3 Circular dependency detection and error handling
 * - 5.4 Partial prerequisite (some deps done, some not)
 * - 5.5 Event subscription integration (story.completed → unblock)
 * - 5.6 Graceful degradation (missing files, bad YAML)
 * - 5.7 Audit trail entries for dependency events
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import { createDependencyResolver } from "../dependency-resolver.js";
import type { EventPublisher, EventBusEvent } from "../types.js";
import { findDependentStories, areDependenciesSatisfied } from "../completion-handlers.js";
import { resolveDependencies, type SprintStatusData } from "../assignment-service.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "dep-resolver-test-"));
}

function writeSprintStatus(dir: string, data: Record<string, unknown>): void {
  writeFileSync(join(dir, "sprint-status.yaml"), stringify(data), "utf-8");
}

function createMockEventPublisher(): EventPublisher {
  return {
    publishStoryCompleted: vi.fn().mockResolvedValue(undefined),
    publishStoryStarted: vi.fn().mockResolvedValue(undefined),
    publishStoryBlocked: vi.fn().mockResolvedValue(undefined),
    publishStoryAssigned: vi.fn().mockResolvedValue(undefined),
    publishAgentResumed: vi.fn().mockResolvedValue(undefined),
    publishStoryUnblocked: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    getDroppedEventsCount: vi.fn().mockReturnValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEvent(storyId: string): EventBusEvent {
  return {
    eventId: "test-event-1",
    eventType: "story.completed",
    timestamp: new Date().toISOString(),
    metadata: { storyId },
  };
}

describe("DependencyResolverService", () => {
  let projectPath: string;
  let auditDir: string;

  beforeEach(() => {
    projectPath = createTempDir();
    auditDir = join(projectPath, ".audit");
    mkdirSync(auditDir, { recursive: true });
  });

  // 5.1 Linear dependency chain
  describe("linear dependency chain (A→B→C)", () => {
    it("should unblock B when A completes and B depends only on A", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual(["story-B"]);
    });

    it("should NOT unblock C when A completes (C depends on B, B not done)", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      // Only B should be unblocked, not C
      expect(unblocked).not.toContain("story-C");
    });

    it("should unblock C when B completes (full chain A→B→C)", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "done",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-B"));
      expect(unblocked).toEqual(["story-C"]);
    });
  });

  // 5.2 Diamond dependency
  describe("diamond dependency (D depends on both B and C)", () => {
    it("should NOT unblock D when only B completes", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "done",
          "story-C": "in-progress",
          "story-D": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
          "story-C": ["story-A"],
          "story-D": ["story-B", "story-C"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-B"));
      expect(unblocked).not.toContain("story-D");
    });

    it("should unblock D when both B and C are done", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "done",
          "story-C": "done",
          "story-D": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
          "story-C": ["story-A"],
          "story-D": ["story-B", "story-C"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-C"));
      expect(unblocked).toContain("story-D");
    });
  });

  // 5.3 Circular dependency detection
  describe("circular dependency detection", () => {
    it("should detect simple cycle (A→B→A)", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "blocked",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-A": ["story-B"],
          "story-B": ["story-A"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const cycles = resolver.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
      // At least one cycle should contain both story-A and story-B
      const hasCycle = cycles.some(
        (cycle) => cycle.includes("story-A") && cycle.includes("story-B"),
      );
      expect(hasCycle).toBe(true);
    });

    it("should detect 3-node cycle (A→B→C→A)", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "blocked",
          "story-B": "blocked",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-A": ["story-C"],
          "story-B": ["story-A"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const cycles = resolver.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it("should NOT unblock stories involved in cycles", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A", "story-C"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      // story-B depends on A (done) and C (blocked), and B↔C form a cycle
      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      // story-B should NOT be unblocked because it's part of a cycle
      expect(unblocked).not.toContain("story-B");
      expect(unblocked).not.toContain("story-C");
    });

    it("should log audit event for circular dependency detection", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A", "story-C"],
          "story-C": ["story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      await resolver.onStoryCompleted(makeEvent("story-A"));

      const auditFile = join(auditDir, "agent-lifecycle.jsonl");
      expect(existsSync(auditFile)).toBe(true);
      const lines = readFileSync(auditFile, "utf-8").trim().split("\n");
      const events = lines.map((l) => JSON.parse(l));
      const cycleEvent = events.find(
        (e: Record<string, unknown>) => e.event_type === "circular_dependency_detected",
      );
      expect(cycleEvent).toBeDefined();
    });

    it("should return empty cycles for acyclic graphs", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const cycles = resolver.detectCycles();
      expect(cycles).toEqual([]);
    });
  });

  // 5.4 Partial prerequisite
  describe("partial prerequisite tracking", () => {
    it("should log partial prerequisite when some deps are done but not all", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "in-progress",
          "story-C": "blocked",
        },
        story_dependencies: {
          "story-C": ["story-A", "story-B"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual([]);

      // Check audit trail for partial dependency event
      const auditFile = join(auditDir, "agent-lifecycle.jsonl");
      const lines = readFileSync(auditFile, "utf-8").trim().split("\n");
      const events = lines.map((l) => JSON.parse(l));
      const partialEvent = events.find(
        (e: Record<string, unknown>) => e.event_type === "dependency_check_partial",
      );
      expect(partialEvent).toBeDefined();
      expect(partialEvent.story_id).toBe("story-C");
      expect(partialEvent.completed_dep).toBe("story-A");
      expect(partialEvent.outstanding_deps).toContain("story-B");
    });
  });

  // 5.5 Event subscription integration
  describe("event publishing integration", () => {
    it("should publish story.unblocked event when a story is unblocked", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
        },
      });

      const mockPublisher = createMockEventPublisher();
      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
        eventPublisher: mockPublisher,
      });

      await resolver.onStoryCompleted(makeEvent("story-A"));

      expect(mockPublisher.publishStoryUnblocked).toHaveBeenCalledWith({
        storyId: "story-B",
        unblockedBy: "story-A",
        previousStatus: "blocked",
        newStatus: "ready-for-dev",
      });
    });

    it("should not fail if event publishing throws", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
        },
      });

      const mockPublisher = createMockEventPublisher();
      vi.mocked(mockPublisher.publishStoryUnblocked).mockRejectedValue(new Error("publish failed"));

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
        eventPublisher: mockPublisher,
      });

      // Should not throw despite event publishing failure
      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual(["story-B"]);
    });

    it("should work without eventPublisher (optional)", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
        // No eventPublisher
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual(["story-B"]);
    });
  });

  // 5.6 Graceful degradation
  describe("graceful degradation", () => {
    it("should return empty array when sprint-status.yaml is missing", async () => {
      // Don't write any sprint-status.yaml
      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual([]);
    });

    it("should return empty array when event has no storyId", async () => {
      writeSprintStatus(projectPath, {
        development_status: { "story-A": "done" },
        story_dependencies: {},
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const event: EventBusEvent = {
        eventId: "test",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const unblocked = await resolver.onStoryCompleted(event);
      expect(unblocked).toEqual([]);
    });

    it("should return empty array when YAML is malformed", async () => {
      writeFileSync(join(projectPath, "sprint-status.yaml"), "{{bad yaml[", "utf-8");

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual([]);
    });

    it("should return empty cycles when sprint-status.yaml is missing", () => {
      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const cycles = resolver.detectCycles();
      expect(cycles).toEqual([]);
    });

    it("should return empty array when no story_dependencies key exists", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        // No story_dependencies or dependencies key
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      const unblocked = await resolver.onStoryCompleted(makeEvent("story-A"));
      expect(unblocked).toEqual([]);
    });
  });

  // 5.7 Audit trail entries
  describe("audit trail", () => {
    it("should log dependency_check_triggered on every call", async () => {
      writeSprintStatus(projectPath, {
        development_status: { "story-A": "done" },
        story_dependencies: {},
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      await resolver.onStoryCompleted(makeEvent("story-A"));

      const auditFile = join(auditDir, "agent-lifecycle.jsonl");
      const lines = readFileSync(auditFile, "utf-8").trim().split("\n");
      const events = lines.map((l) => JSON.parse(l));
      const triggerEvent = events.find(
        (e: Record<string, unknown>) => e.event_type === "dependency_check_triggered",
      );
      expect(triggerEvent).toBeDefined();
      expect(triggerEvent.story_id).toBe("story-A");
    });

    it("should log story_unblocked when a story gets unblocked", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "story-A": "done",
          "story-B": "blocked",
        },
        story_dependencies: {
          "story-B": ["story-A"],
        },
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir,
      });

      await resolver.onStoryCompleted(makeEvent("story-A"));

      const auditFile = join(auditDir, "agent-lifecycle.jsonl");
      const lines = readFileSync(auditFile, "utf-8").trim().split("\n");
      const events = lines.map((l) => JSON.parse(l));
      const unblockEvent = events.find(
        (e: Record<string, unknown>) => e.event_type === "story_unblocked",
      );
      expect(unblockEvent).toBeDefined();
      expect(unblockEvent.story_id).toBe("story-B");
      expect(unblockEvent.unblocked_by).toBe("story-A");
    });

    it("should create audit directory if it does not exist", async () => {
      const newAuditDir = join(projectPath, "new-audit-dir");
      writeSprintStatus(projectPath, {
        development_status: { "story-A": "done" },
        story_dependencies: {},
      });

      const resolver = createDependencyResolver({
        projectPath,
        auditDir: newAuditDir,
      });

      await resolver.onStoryCompleted(makeEvent("story-A"));

      expect(existsSync(join(newAuditDir, "agent-lifecycle.jsonl"))).toBe(true);
    });
  });
});

// Tests for exported helper functions used by dependency resolver
describe("findDependentStories", () => {
  it("should find stories that depend on the completed story", () => {
    const sprintStatus = {
      development_status: {
        "story-A": "done",
        "story-B": "blocked",
        "story-C": "blocked",
      },
      story_dependencies: {
        "story-B": ["story-A"],
        "story-C": ["story-A", "story-B"],
      },
    };

    const dependents = findDependentStories(sprintStatus, "story-A");
    expect(dependents).toContain("story-B");
    expect(dependents).toContain("story-C");
  });

  it("should return empty array when no stories depend on completed story", () => {
    const sprintStatus = {
      development_status: { "story-A": "done" },
      story_dependencies: {},
    };

    const dependents = findDependentStories(sprintStatus, "story-A");
    expect(dependents).toEqual([]);
  });

  it("should use legacy dependencies key as fallback", () => {
    const sprintStatus = {
      development_status: {
        "story-A": "done",
        "story-B": "blocked",
      },
      dependencies: {
        "story-B": ["story-A"],
      },
    };

    const dependents = findDependentStories(sprintStatus, "story-A");
    expect(dependents).toContain("story-B");
  });

  it("should prefer story_dependencies over dependencies", () => {
    const sprintStatus = {
      development_status: {
        "story-A": "done",
        "story-B": "blocked",
        "story-C": "blocked",
      },
      story_dependencies: {
        "story-B": ["story-A"],
      },
      dependencies: {
        "story-C": ["story-A"],
      },
    };

    // Should only find story-B (from story_dependencies), not story-C (from dependencies)
    const dependents = findDependentStories(sprintStatus, "story-A");
    expect(dependents).toContain("story-B");
    expect(dependents).not.toContain("story-C");
  });
});

describe("areDependenciesSatisfied", () => {
  it("should return true when all dependencies are done", () => {
    const sprintStatus = {
      development_status: {
        "story-A": "done",
        "story-B": "done",
        "story-C": "blocked",
      },
      story_dependencies: {
        "story-C": ["story-A", "story-B"],
      },
    };

    expect(areDependenciesSatisfied("story-C", sprintStatus)).toBe(true);
  });

  it("should return false when some dependencies are not done", () => {
    const sprintStatus = {
      development_status: {
        "story-A": "done",
        "story-B": "in-progress",
        "story-C": "blocked",
      },
      story_dependencies: {
        "story-C": ["story-A", "story-B"],
      },
    };

    expect(areDependenciesSatisfied("story-C", sprintStatus)).toBe(false);
  });

  it("should return true when story has no dependencies", () => {
    const sprintStatus = {
      development_status: { "story-A": "ready-for-dev" },
      story_dependencies: {},
    };

    expect(areDependenciesSatisfied("story-A", sprintStatus)).toBe(true);
  });
});

describe("resolveDependencies (assignment-service)", () => {
  it("should resolve dependencies using story_dependencies key", () => {
    const sprintData: SprintStatusData = {
      development_status: {
        "story-A": "done",
        "story-B": "blocked",
      },
      story_dependencies: {
        "story-B": ["story-A"],
      },
    };

    const result = resolveDependencies("story-B", sprintData);
    expect(result.resolved).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  it("should list unresolved dependencies", () => {
    const sprintData: SprintStatusData = {
      development_status: {
        "story-A": "done",
        "story-B": "in-progress",
        "story-C": "blocked",
      },
      story_dependencies: {
        "story-C": ["story-A", "story-B"],
      },
    };

    const result = resolveDependencies("story-C", sprintData);
    expect(result.resolved).toBe(false);
    expect(result.unresolved).toEqual(["story-B"]);
  });

  it("should fall back to dependencies key when story_dependencies is absent", () => {
    const sprintData: SprintStatusData = {
      development_status: {
        "story-A": "done",
        "story-B": "blocked",
      },
      dependencies: {
        "story-B": ["story-A"],
      },
    };

    const result = resolveDependencies("story-B", sprintData);
    expect(result.resolved).toBe(true);
  });
});
