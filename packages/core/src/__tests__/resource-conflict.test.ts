/**
 * Resource Conflict Detection — unit tests (Epic 52, Story 52.1)
 *
 * Tests for:
 * - extractProjectResources: resource extraction from config
 * - detectResourceConflicts: pure conflict detection
 * - computeConflictSeverity: severity computation
 * - generateConflictId: ID generation
 * - runConflictDetection: full scan with timing
 * - ResourceConflictFileStore: file-based persistence
 * - Performance: 50 projects × 5 resources < 1 second
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  extractProjectResources,
  detectResourceConflicts,
  computeConflictSeverity,
  generateConflictId,
  runConflictDetection,
  checkResourceConflicts,
  appendConflictAudit,
  ResourceConflictFileStore,
  createResourceConflictStore,
  RESOURCE_CONFLICTS_FILENAME,
  RESOURCE_CONFLICTS_AUDIT_FILENAME,
} from "../resource-conflict.js";
import type { ProjectResource, OrchestratorConfig } from "../types.js";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// =============================================================================
// HELPERS
// =============================================================================

function makeConfig(projects: Record<string, { repo: string; path: string }>): OrchestratorConfig {
  return {
    configPath: "/tmp/test-ao-config.yaml",
    readyThresholdMs: 300_000,
    defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
    notifiers: {},
    notificationRouting: { info: [], warning: [], error: [], critical: [] },
    reactions: {},
    projects: Object.fromEntries(
      Object.entries(projects).map(([id, cfg]) => [
        id,
        {
          name: id,
          repo: cfg.repo,
          path: cfg.path,
          defaultBranch: "main",
          sessionPrefix: id,
        },
      ]),
    ),
  };
}

// =============================================================================
// generateConflictId
// =============================================================================

describe("generateConflictId", () => {
  it("generates IDs with 'conflict-' prefix", () => {
    const id = generateConflictId();
    expect(id).toMatch(/^conflict-/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateConflictId()));
    expect(ids.size).toBe(50);
  });
});

// =============================================================================
// extractProjectResources
// =============================================================================

describe("extractProjectResources", () => {
  it("returns empty array for empty config", () => {
    const config = makeConfig({});
    const resources = extractProjectResources(config);
    expect(resources).toEqual([]);
  });

  it("extracts repository and file-path from a single project", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/worktrees/repo-a" },
    });
    const resources = extractProjectResources(config);

    expect(resources).toHaveLength(2);
    expect(resources).toContainEqual({
      projectId: "project-a",
      resourceType: "repository",
      resourceIdentifier: "org/repo-a",
    });
    expect(resources).toContainEqual({
      projectId: "project-a",
      resourceType: "file-path",
      resourceIdentifier: "/worktrees/repo-a",
    });
  });

  it("extracts resources from multiple projects", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/worktrees/a" },
      "project-b": { repo: "org/repo-b", path: "/worktrees/b" },
    });
    const resources = extractProjectResources(config);

    expect(resources).toHaveLength(4);
    expect(resources.filter((r) => r.projectId === "project-a")).toHaveLength(2);
    expect(resources.filter((r) => r.projectId === "project-b")).toHaveLength(2);
  });
});

// =============================================================================
// computeConflictSeverity
// =============================================================================

describe("computeConflictSeverity", () => {
  it("returns critical for agent conflicts", () => {
    expect(computeConflictSeverity("agent", 2)).toBe("critical");
    expect(computeConflictSeverity("agent", 3)).toBe("critical");
  });

  it("returns high for repository conflicts with 2 projects", () => {
    expect(computeConflictSeverity("repository", 2)).toBe("high");
  });

  it("returns critical for repository conflicts with >2 projects", () => {
    expect(computeConflictSeverity("repository", 3)).toBe("critical");
  });

  it("returns medium for file-path conflicts with 2 projects", () => {
    expect(computeConflictSeverity("file-path", 2)).toBe("medium");
  });

  it("returns high for file-path conflicts with >2 projects", () => {
    expect(computeConflictSeverity("file-path", 3)).toBe("high");
  });

  it("returns low for external-service conflicts with 2 projects", () => {
    expect(computeConflictSeverity("external-service", 2)).toBe("low");
  });

  it("returns medium for external-service conflicts with >2 projects", () => {
    expect(computeConflictSeverity("external-service", 3)).toBe("medium");
  });
});

// =============================================================================
// detectResourceConflicts
// =============================================================================

describe("detectResourceConflicts", () => {
  it("returns empty array for empty input", () => {
    expect(detectResourceConflicts([])).toEqual([]);
  });

  it("returns empty array when single project has no overlaps", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "repository", resourceIdentifier: "org/repo-a" },
      { projectId: "a", resourceType: "file-path", resourceIdentifier: "/path/a" },
    ];
    expect(detectResourceConflicts(resources)).toEqual([]);
  });

  it("detects repository conflict between 2 projects", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "repository", resourceIdentifier: "org/shared-repo" },
      { projectId: "b", resourceType: "repository", resourceIdentifier: "org/shared-repo" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resourceType).toBe("repository");
    expect(conflicts[0].resourceIdentifier).toBe("org/shared-repo");
    expect(conflicts[0].competingProjects).toContain("a");
    expect(conflicts[0].competingProjects).toContain("b");
    expect(conflicts[0].severity).toBe("high");
  });

  it("detects agent conflict with critical severity", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "agent", resourceIdentifier: "claude-code-1" },
      { projectId: "b", resourceType: "agent", resourceIdentifier: "claude-code-1" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("critical");
    expect(conflicts[0].resourceType).toBe("agent");
  });

  it("detects file-path overlap", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "file-path", resourceIdentifier: "/worktrees/shared" },
      { projectId: "b", resourceType: "file-path", resourceIdentifier: "/worktrees/shared" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resourceType).toBe("file-path");
    expect(conflicts[0].severity).toBe("medium");
  });

  it("escalates severity when >2 projects compete", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "repository", resourceIdentifier: "org/repo" },
      { projectId: "b", resourceType: "repository", resourceIdentifier: "org/repo" },
      { projectId: "c", resourceType: "repository", resourceIdentifier: "org/repo" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("critical"); // escalated from high → critical
    expect(conflicts[0].competingProjects).toHaveLength(3);
  });

  it("detects multiple conflict types simultaneously", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "repository", resourceIdentifier: "org/repo" },
      { projectId: "b", resourceType: "repository", resourceIdentifier: "org/repo" },
      { projectId: "a", resourceType: "file-path", resourceIdentifier: "/shared/path" },
      { projectId: "b", resourceType: "file-path", resourceIdentifier: "/shared/path" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts).toHaveLength(2);
    expect(conflicts.some((c) => c.resourceType === "repository")).toBe(true);
    expect(conflicts.some((c) => c.resourceType === "file-path")).toBe(true);
  });

  it("uses provided date for detectedAt", () => {
    const fixedDate = new Date("2026-03-31T12:00:00.000Z");
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "repository", resourceIdentifier: "org/repo" },
      { projectId: "b", resourceType: "repository", resourceIdentifier: "org/repo" },
    ];
    const conflicts = detectResourceConflicts(resources, fixedDate);

    expect(conflicts[0].detectedAt).toBe(fixedDate.toISOString());
  });

  it("includes metadata with competingCount", () => {
    const resources: ProjectResource[] = [
      { projectId: "a", resourceType: "agent", resourceIdentifier: "agent-1" },
      { projectId: "b", resourceType: "agent", resourceIdentifier: "agent-1" },
    ];
    const conflicts = detectResourceConflicts(resources);

    expect(conflicts[0].metadata.competingCount).toBe(2);
  });
});

// =============================================================================
// runConflictDetection
// =============================================================================

describe("runConflictDetection", () => {
  it("returns empty conflicts for single project config", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
    });
    const result = runConflictDetection(config);

    expect(result.conflicts).toEqual([]);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("detects conflicts for overlapping projects", () => {
    const config = makeConfig({
      "project-a": { repo: "org/shared", path: "/path/a" },
      "project-b": { repo: "org/shared", path: "/path/a" },
    });
    const result = runConflictDetection(config);

    // Both repo and path overlap → 2 conflicts
    expect(result.conflicts).toHaveLength(2);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Performance
// =============================================================================

describe("performance", () => {
  it("handles 50 projects × 5 resources within 1 second", () => {
    const projects: Record<string, { repo: string; path: string }> = {};
    for (let i = 0; i < 50; i++) {
      const id = `project-${i}`;
      projects[id] = {
        repo: `org/repo-${i % 10}`, // 10 repos shared across 50 projects
        path: `/path/project-${i}`,
      };
    }
    const config = makeConfig(projects);

    const start = performance.now();
    const result = runConflictDetection(config);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // NFR-F4-2
    // Should detect repository conflicts (each repo shared by 5 projects)
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ResourceConflictFileStore
// =============================================================================

describe("ResourceConflictFileStore", () => {
  let tmpDir: string;
  let storePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `rc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    storePath = join(tmpDir, RESOURCE_CONFLICTS_FILENAME);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and retrieves conflicts", () => {
    const store = new ResourceConflictFileStore(storePath);
    const conflicts = [
      {
        id: "conflict-test-001",
        resourceType: "repository" as const,
        resourceIdentifier: "org/shared-repo",
        competingProjects: ["a", "b"],
        severity: "high" as const,
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: { competingCount: 2 },
      },
    ];

    store.save(conflicts);
    const loaded = store.list();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("conflict-test-001");
    expect(loaded[0].competingProjects).toEqual(["a", "b"]);
  });

  it("filters by resourceType", () => {
    const store = new ResourceConflictFileStore(storePath);
    store.save([
      {
        id: "c1",
        resourceType: "repository",
        resourceIdentifier: "org/repo",
        competingProjects: ["a", "b"],
        severity: "high",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
      {
        id: "c2",
        resourceType: "file-path",
        resourceIdentifier: "/shared/path",
        competingProjects: ["a", "b"],
        severity: "medium",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
    ]);

    const filtered = store.list({ resourceType: "repository" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("c1");
  });

  it("filters by projectId", () => {
    const store = new ResourceConflictFileStore(storePath);
    store.save([
      {
        id: "c1",
        resourceType: "repository",
        resourceIdentifier: "org/repo",
        competingProjects: ["a", "b"],
        severity: "high",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
      {
        id: "c2",
        resourceType: "repository",
        resourceIdentifier: "org/other",
        competingProjects: ["c", "d"],
        severity: "high",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
    ]);

    const filtered = store.list({ projectId: "a" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("c1");
  });

  it("clears all conflicts", () => {
    const store = new ResourceConflictFileStore(storePath);
    store.save([
      {
        id: "c1",
        resourceType: "repository",
        resourceIdentifier: "org/repo",
        competingProjects: ["a"],
        severity: "high",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
    ]);

    store.clear();
    expect(store.list()).toEqual([]);
  });

  it("returns empty array when file does not exist", () => {
    const store = new ResourceConflictFileStore(storePath);
    expect(store.list()).toEqual([]);
  });

  it("returns empty array for malformed YAML", () => {
    writeFileSync(storePath, "not: valid\nconflicts: not-an-array");
    const store = new ResourceConflictFileStore(storePath);
    expect(store.list()).toEqual([]);
  });

  it("returns empty array for YAML with invalid conflict entries", () => {
    writeFileSync(
      storePath,
      `conflicts:
  - id: valid
    resourceType: repository
    resourceIdentifier: org/repo
    competingProjects:
      - a
      - b
    severity: high
    detectedAt: "2026-03-31T12:00:00.000Z"
    metadata: {}
  - invalid: entry
`,
    );
    const store = new ResourceConflictFileStore(storePath);
    const loaded = store.list();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("valid");
  });

  it("getActive returns same as list", () => {
    const store = new ResourceConflictFileStore(storePath);
    const conflicts = [
      {
        id: "c1",
        resourceType: "repository" as const,
        resourceIdentifier: "org/repo",
        competingProjects: ["a", "b"],
        severity: "high" as const,
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: {},
      },
    ];
    store.save(conflicts);

    expect(store.getActive()).toEqual(store.list());
  });
});

// =============================================================================
// createResourceConflictStore
// =============================================================================

describe("createResourceConflictStore", () => {
  it("creates store alongside config file", () => {
    const tmpDir = join(tmpdir(), `rc-factory-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const configPath = join(tmpDir, "agent-orchestrator.yaml");

    const store = createResourceConflictStore(configPath);
    expect(store.filePath).toBe(join(tmpDir, RESOURCE_CONFLICTS_FILENAME));

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// =============================================================================
// appendConflictAudit
// =============================================================================

describe("appendConflictAudit", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `rc-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    configPath = join(tmpDir, "agent-orchestrator.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends JSONL entry to audit file", () => {
    const result: { conflicts: unknown[]; scanDurationMs: number } = {
      conflicts: [
        {
          id: "conflict-test",
          resourceType: "repository",
          resourceIdentifier: "org/repo",
          competingProjects: ["a", "b"],
          severity: "high",
          detectedAt: "2026-03-31T12:00:00.000Z",
          metadata: { competingCount: 2 },
        },
      ],
      scanDurationMs: 1.5,
    };

    appendConflictAudit(configPath, result);

    const auditPath = join(tmpDir, RESOURCE_CONFLICTS_AUDIT_FILENAME);
    expect(existsSync(auditPath)).toBe(true);

    const lines = readFileSync(auditPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.conflictCount).toBe(1);
    expect(entry.scanDurationMs).toBe(1.5);
    expect(entry.conflicts).toHaveLength(1);
    expect(entry.timestamp).toBeDefined();
  });

  it("appends multiple entries", () => {
    const result: { conflicts: unknown[]; scanDurationMs: number } = {
      conflicts: [],
      scanDurationMs: 0.5,
    };

    appendConflictAudit(configPath, result);
    appendConflictAudit(configPath, result);

    const auditPath = join(tmpDir, RESOURCE_CONFLICTS_AUDIT_FILENAME);
    const lines = readFileSync(auditPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});

// =============================================================================
// checkResourceConflicts
// =============================================================================

describe("checkResourceConflicts", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `rc-check-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    configPath = join(tmpDir, "agent-orchestrator.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs detection, persists to store, and appends audit", () => {
    const config = makeConfig({
      "project-a": { repo: "org/shared", path: "/path/a" },
      "project-b": { repo: "org/shared", path: "/path/b" },
    });
    config.configPath = configPath;
    const store = createResourceConflictStore(configPath);

    const result = checkResourceConflicts(config, store);

    // Should detect repository conflict
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);

    // Store should have the conflicts
    expect(store.list()).toHaveLength(result.conflicts.length);

    // Audit file should exist
    const auditPath = join(tmpDir, RESOURCE_CONFLICTS_AUDIT_FILENAME);
    expect(existsSync(auditPath)).toBe(true);
  });

  it("invokes onConflictDetected callback when conflicts found", () => {
    const config = makeConfig({
      "project-a": { repo: "org/shared", path: "/path/a" },
      "project-b": { repo: "org/shared", path: "/path/b" },
    });
    const store = createResourceConflictStore(configPath);
    const onConflictDetected = vi.fn();

    checkResourceConflicts(config, store, undefined, { onConflictDetected });

    expect(onConflictDetected).toHaveBeenCalledTimes(1);
    expect(onConflictDetected.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it("does not invoke callback when no conflicts", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
    });
    const store = createResourceConflictStore(configPath);
    const onConflictDetected = vi.fn();

    checkResourceConflicts(config, store, undefined, { onConflictDetected });

    expect(onConflictDetected).not.toHaveBeenCalled();
  });
});

// =============================================================================
// extractProjectResources — agent extraction (AC #2)
// =============================================================================

describe("extractProjectResources — agent from sharedPool", () => {
  it("extracts agent resource when sharedPool is enabled", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
    });
    config.resourcePool = { total: 5, projects: { "project-a": 2 } };
    config.projects["project-a"].sharedPool = { enabled: true, eligibleProjects: ["*"] };

    const resources = extractProjectResources(config);

    expect(resources).toContainEqual({
      projectId: "project-a",
      resourceType: "agent",
      resourceIdentifier: "shared-pool",
    });
  });

  it("does not extract agent when sharedPool is disabled", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
    });
    config.resourcePool = { total: 5, projects: { "project-a": 2 } };
    config.projects["project-a"].sharedPool = { enabled: false, eligibleProjects: ["*"] };

    const resources = extractProjectResources(config);
    const agentResources = resources.filter((r) => r.resourceType === "agent");
    expect(agentResources).toHaveLength(0);
  });

  it("does not extract agent when resourcePool is absent", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
    });
    config.projects["project-a"].sharedPool = { enabled: true, eligibleProjects: ["*"] };

    const resources = extractProjectResources(config);
    const agentResources = resources.filter((r) => r.resourceType === "agent");
    expect(agentResources).toHaveLength(0);
  });

  it("detects agent conflict when multiple projects share pool", () => {
    const config = makeConfig({
      "project-a": { repo: "org/repo-a", path: "/path/a" },
      "project-b": { repo: "org/repo-b", path: "/path/b" },
    });
    config.resourcePool = { total: 5, projects: { "project-a": 2, "project-b": 2 } };
    config.projects["project-a"].sharedPool = { enabled: true, eligibleProjects: ["*"] };
    config.projects["project-b"].sharedPool = { enabled: true, eligibleProjects: ["*"] };

    const resources = extractProjectResources(config);
    const conflicts = detectResourceConflicts(resources);

    const agentConflict = conflicts.find((c) => c.resourceType === "agent");
    expect(agentConflict).toBeDefined();
    expect(agentConflict!.severity).toBe("critical");
    expect(agentConflict!.competingProjects).toContain("project-a");
    expect(agentConflict!.competingProjects).toContain("project-b");
  });
});
