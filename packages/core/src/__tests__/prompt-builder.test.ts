import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { buildPrompt, buildLearningsLayer, BASE_AGENT_PROMPT } from "../prompt-builder.js";
import { selectRelevantLearnings } from "../session-learning.js";
import type { ProjectConfig, SessionLearning } from "../types.js";

let tmpDir: string;
let project: ProjectConfig;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ao-prompt-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  project = {
    name: "Test App",
    repo: "org/test-app",
    path: tmpDir,
    defaultBranch: "main",
    sessionPrefix: "test",
  };
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("buildPrompt", () => {
  it("returns null when no issue, no rules, no user prompt", () => {
    const result = buildPrompt({ project, projectId: "test-app" });
    expect(result).toBeNull();
  });

  it("includes base prompt when issue is provided", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).not.toBeNull();
    expect(result).toContain(BASE_AGENT_PROMPT);
  });

  it("includes project context", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).toContain("Test App");
    expect(result).toContain("org/test-app");
    expect(result).toContain("main");
  });

  it("includes issue ID in task section", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).toContain("Work on issue: INT-1343");
    expect(result).toContain("feat/INT-1343");
  });

  it("includes issue context when provided", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
      issueContext: "## Linear Issue INT-1343\nTitle: Layered Prompt System\nPriority: High",
    });
    expect(result).toContain("## Issue Details");
    expect(result).toContain("Layered Prompt System");
    expect(result).toContain("Priority: High");
  });

  it("includes inline agentRules", () => {
    project.agentRules = "Always run pnpm test before pushing.";
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).toContain("## Project Rules");
    expect(result).toContain("Always run pnpm test before pushing.");
  });

  it("reads agentRulesFile content", () => {
    const rulesPath = join(tmpDir, "agent-rules.md");
    writeFileSync(rulesPath, "Use conventional commits.\nNo force pushes.");
    project.agentRulesFile = "agent-rules.md";

    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).toContain("Use conventional commits.");
    expect(result).toContain("No force pushes.");
  });

  it("includes both agentRules and agentRulesFile", () => {
    project.agentRules = "Inline rule.";
    const rulesPath = join(tmpDir, "rules.txt");
    writeFileSync(rulesPath, "File rule.");
    project.agentRulesFile = "rules.txt";

    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    expect(result).toContain("Inline rule.");
    expect(result).toContain("File rule.");
  });

  it("handles missing agentRulesFile gracefully", () => {
    project.agentRulesFile = "nonexistent-rules.md";

    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
    });
    // Should not throw, should still build prompt without rules
    expect(result).not.toBeNull();
    expect(result).not.toContain("## Project Rules");
  });

  it("appends userPrompt last", () => {
    project.agentRules = "Project rule.";
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-1343",
      userPrompt: "Focus on the API layer only.",
    });

    expect(result).not.toBeNull();
    const promptStr = result!;

    // User prompt should come after project rules
    const rulesIdx = promptStr.indexOf("Project rule.");
    const userIdx = promptStr.indexOf("Focus on the API layer only.");
    expect(rulesIdx).toBeLessThan(userIdx);
    expect(promptStr).toContain("## Additional Instructions");
  });

  it("builds prompt from rules alone (no issue)", () => {
    project.agentRules = "Always lint before committing.";
    const result = buildPrompt({
      project,
      projectId: "test-app",
    });
    expect(result).not.toBeNull();
    expect(result).toContain(BASE_AGENT_PROMPT);
    expect(result).toContain("Always lint before committing.");
  });

  it("builds prompt from userPrompt alone (no issue, no rules)", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      userPrompt: "Just explore the codebase.",
    });
    expect(result).not.toBeNull();
    expect(result).toContain("Just explore the codebase.");
  });

  it("includes tracker info in context", () => {
    project.tracker = { plugin: "linear" };
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-100",
    });
    expect(result).toContain("Tracker: linear");
  });

  it("uses project name in context", () => {
    const result = buildPrompt({
      project,
      projectId: "my-project",
      issueId: "INT-100",
    });
    expect(result).toContain("Project: Test App");
  });

  it("includes reaction hints for auto send-to-agent reactions", () => {
    project.reactions = {
      "ci-failed": { auto: true, action: "send-to-agent" },
      "approved-and-green": { auto: false, action: "notify" },
    };
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-100",
    });
    expect(result).toContain("ci-failed");
    expect(result).not.toContain("approved-and-green");
  });
});

describe("buildPrompt with storyContext", () => {
  it("returns non-null when storyContext is provided (no issue, no rules)", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      storyContext: "# Story: User Auth\n**Story ID:** 1-1-user-auth",
    });
    expect(result).not.toBeNull();
    expect(result).toContain(BASE_AGENT_PROMPT);
  });

  it("includes story context in Layer 2 output", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      storyContext:
        "# Story: User Auth\n**Story ID:** 1-1-user-auth\n## Acceptance Criteria\n1. Must work",
    });
    expect(result).toContain("## Story Context");
    expect(result).toContain("# Story: User Auth");
    expect(result).toContain("1-1-user-auth");
    expect(result).toContain("## Acceptance Criteria");
  });

  it("includes both issue and story context when both provided", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-100",
      issueContext: "Linear issue details here",
      storyContext: "# Story: Build Feature\n**Story ID:** 2-1-build-feature",
    });
    expect(result).toContain("## Issue Details");
    expect(result).toContain("Linear issue details here");
    expect(result).toContain("## Story Context");
    expect(result).toContain("# Story: Build Feature");
  });

  it("places story context after issue details in Layer 2", () => {
    const result = buildPrompt({
      project,
      projectId: "test-app",
      issueId: "INT-100",
      issueContext: "Issue content",
      storyContext: "Story content",
    });
    const issueIdx = result!.indexOf("Issue content");
    const storyIdx = result!.indexOf("Story content");
    expect(issueIdx).toBeLessThan(storyIdx);
  });
});

describe("BASE_AGENT_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof BASE_AGENT_PROMPT).toBe("string");
    expect(BASE_AGENT_PROMPT.length).toBeGreaterThan(100);
  });

  it("covers key topics", () => {
    expect(BASE_AGENT_PROMPT).toContain("Session Lifecycle");
    expect(BASE_AGENT_PROMPT).toContain("Git Workflow");
    expect(BASE_AGENT_PROMPT).toContain("PR Best Practices");
  });
});

describe("buildLearningsLayer (Story 12.1)", () => {
  function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
    return {
      sessionId: "ao-1",
      agentId: "ao-1",
      storyId: "1-1-test",
      projectId: "proj",
      outcome: "failed",
      durationMs: 120000,
      retryCount: 0,
      filesModified: [],
      testsAdded: 0,
      errorCategories: ["ECONNREFUSED"],
      domainTags: ["backend"],
      completedAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("returns null for empty learnings", () => {
    expect(buildLearningsLayer([])).toBeNull();
    expect(buildLearningsLayer(undefined)).toBeNull();
  });

  it("formats learnings as numbered markdown list", () => {
    const learnings = [
      makeLearning({ storyId: "1-1-auth", errorCategories: ["timeout"] }),
      makeLearning({ storyId: "1-2-sync", errorCategories: ["parse error"] }),
    ];

    const result = buildLearningsLayer(learnings);

    expect(result).toContain("Lessons from Past Sessions");
    expect(result).toContain("1. **1-1-auth**");
    expect(result).toContain("2. **1-2-sync**");
    expect(result).toContain("timeout");
    expect(result).toContain("parse error");
  });

  it("includes domain tags and duration", () => {
    const result = buildLearningsLayer([
      makeLearning({ domainTags: ["frontend", "testing"], durationMs: 300000 }),
    ]);

    expect(result).toContain("frontend, testing");
    expect(result).toContain("5m");
  });

  it("integrates into buildPrompt when learnings provided", () => {
    const prompt = buildPrompt({
      project,
      projectId: "test",
      issueId: "TEST-1",
      issueContext: "test context",
      learnings: [makeLearning()],
    });

    expect(prompt).toContain("Lessons from Past Sessions");
    expect(prompt).toContain("1-1-test");
  });

  it("does not affect buildPrompt when no learnings", () => {
    const prompt = buildPrompt({
      project,
      projectId: "test",
      issueId: "TEST-1",
      issueContext: "test context",
    });

    expect(prompt).not.toContain("Lessons from Past Sessions");
  });
});

describe("selectRelevantLearnings (Story 12.1)", () => {
  function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
    return {
      sessionId: "ao-1",
      agentId: "ao-1",
      storyId: "1-1-test",
      projectId: "proj",
      outcome: "failed",
      durationMs: 60000,
      retryCount: 0,
      filesModified: [],
      testsAdded: 0,
      errorCategories: ["error"],
      domainTags: ["backend"],
      completedAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("filters to failed outcomes only", () => {
    const all = [
      makeLearning({ outcome: "completed", storyId: "s1" }),
      makeLearning({ outcome: "failed", storyId: "s2" }),
      makeLearning({ outcome: "completed", storyId: "s3" }),
    ];

    const result = selectRelevantLearnings(all, []);
    expect(result).toHaveLength(1);
    expect(result[0].storyId).toBe("s2");
  });

  it("prefers domain matches", () => {
    const all = [
      makeLearning({ domainTags: ["api"], storyId: "api-story" }),
      makeLearning({ domainTags: ["frontend"], storyId: "fe-story" }),
      makeLearning({ domainTags: ["backend"], storyId: "be-story" }),
    ];

    const result = selectRelevantLearnings(all, ["frontend"], 2);
    expect(result[0].storyId).toBe("fe-story");
  });

  it("limits to specified count", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeLearning({
        storyId: `s-${i}`,
        capturedAt: new Date(Date.now() + i * 1000).toISOString(),
      }),
    );

    const result = selectRelevantLearnings(all, [], 3);
    expect(result).toHaveLength(3);
  });

  it("returns empty for no failures", () => {
    const all = [makeLearning({ outcome: "completed" }), makeLearning({ outcome: "completed" })];

    expect(selectRelevantLearnings(all, [])).toEqual([]);
  });
});
