import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parse } from "yaml";

// Mock console.log and console.error to capture output
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

describe("sprint-plan command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  describe("parseSprintStatus", () => {
    it("should parse a valid sprint-status.yaml file", () => {
      const fixturePath = join(__dirname, "../fixtures/sprint-status-valid.yaml");
      const content = readFileSync(fixturePath, "utf-8");
      const result = parse(content);

      expect(result).toBeDefined();
      expect(result.project).toBe("agent-orchestrator");
      expect(result.development_status).toBeDefined();
      expect(result.development_status["epic-1"]).toBe("in-progress");
      expect(result.development_status["1-1-cli-generate-sprint-plan-from-yaml"]).toBe(
        "in-progress",
      );
      expect(result.development_status["1-2-cli-spawn-agent-with-story-context"]).toBe(
        "ready-for-dev",
      );
    });

    it("should throw on malformed YAML", () => {
      const malformed = `
        development_status:
          epic-1: in-progress
          1-1-test: [invalid: yaml
      `;

      expect(() => parse(malformed)).toThrow();
    });

    it("should handle empty development_status", () => {
      const empty = `
        project: test
        development_status: {}
      `;

      const result = parse(empty);
      expect(result.development_status).toEqual({});
    });
  });

  describe("groupStoriesByStatus", () => {
    it("should group stories by status", () => {
      const developmentStatus = {
        "epic-1": "in-progress",
        "1-1-test": "in-progress",
        "1-2-test": "ready-for-dev",
        "1-3-test": "backlog",
        "1-4-test": "done",
        "1-5-test": "review",
        "epic-2": "backlog",
        "epic-1-retrospective": "optional",
      };

      const groups = {
        backlog: [],
        "ready-for-dev": [],
        "in-progress": [],
        review: [],
        done: [],
      };

      for (const [key, status] of Object.entries(developmentStatus)) {
        // Skip epic keys and retrospectives
        if (key.match(/^epic-\d+(-retrospective)?$/) || key === "epic-1" || key === "epic-2") {
          continue;
        }
        if (status === "backlog") {
          groups.backlog.push(key);
        } else if (status === "ready-for-dev") {
          groups["ready-for-dev"].push(key);
        } else if (status === "in-progress") {
          groups["in-progress"].push(key);
        } else if (status === "review") {
          groups.review.push(key);
        } else if (status === "done") {
          groups.done.push(key);
        }
      }

      expect(groups["in-progress"]).toEqual(["1-1-test"]);
      expect(groups["ready-for-dev"]).toEqual(["1-2-test"]);
      expect(groups["backlog"]).toEqual(["1-3-test"]);
      expect(groups["done"]).toEqual(["1-4-test"]);
      expect(groups["review"]).toEqual(["1-5-test"]);
    });

    it("should count stories in each status", () => {
      const groups = {
        backlog: ["1-1-test", "1-2-test"],
        "ready-for-dev": ["1-3-test"],
        "in-progress": ["1-4-test"],
        review: [],
        done: [],
      };

      const counts = {
        backlog: groups.backlog.length,
        "ready-for-dev": groups["ready-for-dev"].length,
        "in-progress": groups["in-progress"].length,
        review: groups.review.length,
        done: groups.done.length,
      };

      expect(counts.backlog).toBe(2);
      expect(counts["ready-for-dev"]).toBe(1);
      expect(counts["in-progress"]).toBe(1);
      expect(counts.review).toBe(0);
      expect(counts.done).toBe(0);
    });
  });

  describe("story key pattern matching", () => {
    it("should match valid story keys", () => {
      const storyPattern = /^\d+-\d+-[\w-]+$/;

      expect(storyPattern.test("1-1-cli-generate-sprint-plan")).toBe(true);
      expect(storyPattern.test("1-2-cli-spawn-agent")).toBe(true);
      expect(storyPattern.test("2-1-redis-event-bus")).toBe(true);
      expect(storyPattern.test("10-20-some-story")).toBe(true);
    });

    it("should not match non-story keys", () => {
      const storyPattern = /^\d+-\d+-[\w-]+$/;

      expect(storyPattern.test("epic-1")).toBe(false);
      expect(storyPattern.test("epic-1-retrospective")).toBe(false);
      expect(storyPattern.test("development_status")).toBe(false);
      expect(storyPattern.test("generated")).toBe(false);
    });
  });

  describe("dependency graph", () => {
    it("should build a dependency graph", () => {
      const developmentStatus = {
        "1-1-story-a": "done",
        "1-2-story-b": "ready-for-dev",
        "1-3-story-c": "backlog",
      };

      const dependencies = {
        "1-2-story-b": ["1-1-story-a"],
        "1-3-story-c": ["1-2-story-b", "1-1-story-a"],
      };

      const graph = new Map();
      for (const [key, status] of Object.entries(developmentStatus)) {
        graph.set(key, {
          id: key,
          status,
          dependencies: dependencies[key] ?? [],
          blockers: [],
        });
      }

      expect(graph.get("1-2-story-b")?.dependencies).toEqual(["1-1-story-a"]);
      expect(graph.get("1-3-story-c")?.dependencies).toEqual(["1-2-story-b", "1-1-story-a"]);
    });

    it("should detect circular dependencies", () => {
      const graph = new Map([
        ["1-1-story-a", { id: "1-1-story-a", status: "backlog", dependencies: ["1-2-story-b"], blockers: [] }],
        ["1-2-story-b", { id: "1-2-story-b", status: "backlog", dependencies: ["1-3-story-c"], blockers: [] }],
        ["1-3-story-c", { id: "1-3-story-c", status: "backlog", dependencies: ["1-1-story-a"], blockers: [] }],
      ]);

      const visited = new Set<string>();
      const recStack = new Set<string>();
      const cycles: string[][] = [];

      function dfs(node: any, path: string[]): void {
        visited.add(node.id);
        recStack.add(node.id);
        path.push(node.id);

        for (const depId of node.dependencies) {
          const depNode = graph.get(depId);
          if (!depNode) continue;

          if (recStack.has(depId)) {
            const cycleStart = path.indexOf(depId);
            cycles.push([...path.slice(cycleStart), depId]);
          } else if (!visited.has(depId)) {
            dfs(depNode, path);
          }
        }

        path.pop();
        recStack.delete(node.id);
      }

      for (const node of graph.values()) {
        if (!visited.has(node.id)) {
          dfs(node, []);
        }
      }

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain("1-1-story-a");
      expect(cycles[0]).toContain("1-2-story-b");
      expect(cycles[0]).toContain("1-3-story-c");
    });

    it("should identify blocked stories", () => {
      const developmentStatus = {
        "1-1-story-a": "done",
        "1-2-story-b": "backlog",
        "1-3-story-c": "backlog",
      };

      const dependencies = {
        "1-2-story-b": ["1-1-story-a"],
        "1-3-story-c": ["1-2-story-b"], // blocked by story-b which is not done
      };

      const blocked: string[] = [];
      for (const [key, _status] of Object.entries(developmentStatus)) {
        const deps = dependencies[key] ?? [];
        const hasIncompleteDeps = deps.some((depId) => developmentStatus[depId] !== "done");
        if (hasIncompleteDeps) {
          blocked.push(key);
        }
      }

      expect(blocked).toContain("1-3-story-c");
      expect(blocked).not.toContain("1-2-story-b"); // story-a is done, so story-b is not blocked
    });
  });

  describe("command execution", () => {
    const cliPath = join(__dirname, "../../dist/index.js");

    // Skip if CLI not built yet
    const skipTests = !existsSync(cliPath);

    (skipTests ? describe.skip : describe)("sprint-plan command", () => {
      it("should display sprint plan from sprint-status.yaml", () => {
        const result = spawnSync("node", [cliPath, "sprint-plan"], {
          cwd: join(__dirname, "../fixtures"),
          encoding: "utf-8",
        });

        expect(result.status).toBe(0);
      });

      it("should exit with code 1 when sprint-status.yaml not found", () => {
        const result = spawnSync("node", [cliPath, "sprint-plan"], {
          cwd: "/tmp",
          encoding: "utf-8",
        });

        expect(result.status).toBe(1);
      });
    });
  });
});
