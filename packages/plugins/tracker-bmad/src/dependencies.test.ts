import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import {
  computeDependencyGraph,
  validateDependencies,
  getStoryDependencies,
} from "./dependencies.js";

const PROJECT: ProjectConfig = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/home/user/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
    outputDir: "custom-output",
  },
};

const STATUS_PATH = "/home/user/test-project/custom-output/sprint-status.yaml";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function setStatusYaml(yaml: string) {
  mockExistsSync.mockImplementation((p: string) => p === STATUS_PATH);
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH) return yaml;
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// computeDependencyGraph
// ---------------------------------------------------------------------------

describe("computeDependencyGraph", () => {
  it("returns empty graph when sprint status missing", () => {
    const result = computeDependencyGraph(PROJECT);
    expect(result.nodes).toEqual({});
    expect(result.circularWarnings).toEqual([]);
    expect(result.missingWarnings).toEqual([]);
  });

  it("builds nodes for stories without dependencies", () => {
    setStatusYaml(
      ["development_status:", "  s1:", "    status: in-progress", "  s2:", "    status: done"].join(
        "\n",
      ),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(Object.keys(result.nodes)).toEqual(["s1", "s2"]);
    expect(result.nodes["s1"]!.dependsOn).toEqual([]);
    expect(result.nodes["s1"]!.isBlocked).toBe(false);
  });

  it("marks story as blocked when dependency is not done", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(result.nodes["s1"]!.isBlocked).toBe(true);
    expect(result.nodes["s1"]!.blockedBy).toEqual(["s2"]);
    expect(result.nodes["s2"]!.blocks).toEqual(["s1"]);
  });

  it("marks story as NOT blocked when all dependencies are done", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: done",
      ].join("\n"),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(result.nodes["s1"]!.isBlocked).toBe(false);
    expect(result.nodes["s1"]!.blockedBy).toEqual([]);
  });

  it("handles multiple dependencies with partial completion", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "      - s3",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(result.nodes["s1"]!.isBlocked).toBe(true);
    expect(result.nodes["s1"]!.blockedBy).toEqual(["s3"]);
  });

  it("detects circular dependencies A→B→A", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: backlog",
        "    dependsOn:",
        "      - s1",
      ].join("\n"),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(result.circularWarnings.length).toBeGreaterThanOrEqual(1);
    const cycle = result.circularWarnings[0]!;
    expect(cycle).toContain("s1");
    expect(cycle).toContain("s2");
  });

  it("reports missing dependency references", () => {
    setStatusYaml(
      ["development_status:", "  s1:", "    status: backlog", "    dependsOn:", "      - s99"].join(
        "\n",
      ),
    );

    const result = computeDependencyGraph(PROJECT);

    expect(result.missingWarnings).toContain("s99");
  });

  it("handles non-array dependsOn gracefully", () => {
    setStatusYaml(
      ["development_status:", "  s1:", "    status: backlog", "    dependsOn: s2"].join("\n"),
    );

    const result = computeDependencyGraph(PROJECT);

    // Non-array dependsOn treated as no dependencies
    expect(result.nodes["s1"]!.dependsOn).toEqual([]);
    expect(result.nodes["s1"]!.isBlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDependencies
// ---------------------------------------------------------------------------

describe("validateDependencies", () => {
  it("returns not blocked when no dependsOn", () => {
    setStatusYaml(["development_status:", "  s1:", "    status: backlog"].join("\n"));

    const result = validateDependencies("s1", PROJECT);

    expect(result.blocked).toBe(false);
    expect(result.blockers).toEqual([]);
  });

  it("returns blocked with blocker details when dep not done", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
    );

    const result = validateDependencies("s1", PROJECT);

    expect(result.blocked).toBe(true);
    expect(result.blockers).toEqual([{ id: "s2", status: "in-progress" }]);
  });

  it("warns about missing dependency references", () => {
    setStatusYaml(
      ["development_status:", "  s1:", "    status: backlog", "    dependsOn:", "      - s99"].join(
        "\n",
      ),
    );

    const result = validateDependencies("s1", PROJECT);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("s99");
  });

  it("returns not blocked for unknown story", () => {
    setStatusYaml(["development_status:", "  s1:", "    status: backlog"].join("\n"));

    const result = validateDependencies("s999", PROJECT);

    expect(result.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getStoryDependencies
// ---------------------------------------------------------------------------

describe("getStoryDependencies", () => {
  it("returns node for existing story", () => {
    setStatusYaml(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: done",
      ].join("\n"),
    );

    const result = getStoryDependencies("s1", PROJECT);

    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("s1");
    expect(result!.dependsOn).toEqual(["s2"]);
  });

  it("returns null for non-existent story", () => {
    setStatusYaml(["development_status:", "  s1:", "    status: backlog"].join("\n"));

    const result = getStoryDependencies("s999", PROJECT);

    expect(result).toBeNull();
  });
});
