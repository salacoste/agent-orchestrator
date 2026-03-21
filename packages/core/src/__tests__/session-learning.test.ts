/**
 * Session Learning Tests (Story 11.1)
 *
 * Tests for session outcome capture, domain tag inference, and file counting.
 */

import { describe, it, expect } from "vitest";
import { captureSessionLearning, inferDomainTags, countTestFiles } from "../session-learning.js";
import type { CompletionEvent, FailureEvent } from "../types.js";

describe("inferDomainTags", () => {
  it("tags .tsx files as frontend", () => {
    const tags = inferDomainTags(["src/components/Button.tsx", "src/App.tsx"]);
    expect(tags).toContain("frontend");
  });

  it("tags .test.ts files as testing", () => {
    const tags = inferDomainTags(["src/__tests__/utils.test.ts"]);
    expect(tags).toContain("testing");
  });

  it("tags route.ts files as api", () => {
    const tags = inferDomainTags(["src/app/api/health/route.ts"]);
    expect(tags).toContain("api");
  });

  it("tags /api/ path as api", () => {
    const tags = inferDomainTags(["packages/web/src/app/api/sessions/route.ts"]);
    expect(tags).toContain("api");
  });

  it("tags .css files as styling", () => {
    const tags = inferDomainTags(["src/styles/globals.css"]);
    expect(tags).toContain("styling");
  });

  it("defaults to backend for plain .ts files", () => {
    const tags = inferDomainTags(["src/services/auth-service.ts"]);
    expect(tags).toContain("backend");
    expect(tags).not.toContain("frontend");
  });

  it("returns multiple tags for mixed files", () => {
    const tags = inferDomainTags([
      "src/components/Fleet.tsx",
      "src/__tests__/Fleet.test.tsx",
      "src/app/api/health/route.ts",
    ]);
    expect(tags).toContain("frontend");
    expect(tags).toContain("testing");
    expect(tags).toContain("api");
  });

  it("returns empty array for no files", () => {
    expect(inferDomainTags([])).toEqual([]);
  });
});

describe("countTestFiles", () => {
  it("counts .test.ts files", () => {
    expect(countTestFiles(["a.test.ts", "b.test.tsx", "c.ts"])).toBe(2);
  });

  it("counts .spec.ts files", () => {
    expect(countTestFiles(["a.spec.ts", "b.ts"])).toBe(1);
  });

  it("returns 0 for no test files", () => {
    expect(countTestFiles(["a.ts", "b.tsx"])).toBe(0);
  });
});

describe("captureSessionLearning", () => {
  it("captures success outcome from CompletionEvent", async () => {
    const event: CompletionEvent = {
      agentId: "ao-agent-1",
      storyId: "1-1-test-story",
      exitCode: 0,
      duration: 120000,
      completedAt: new Date("2026-03-18T14:00:00Z"),
    };

    const learning = await captureSessionLearning(event, "my-project", 0);

    expect(learning.sessionId).toBe("ao-agent-1");
    expect(learning.agentId).toBe("ao-agent-1");
    expect(learning.storyId).toBe("1-1-test-story");
    expect(learning.projectId).toBe("my-project");
    expect(learning.outcome).toBe("completed");
    expect(learning.durationMs).toBe(120000);
    expect(learning.retryCount).toBe(0);
    expect(learning.completedAt).toBe("2026-03-18T14:00:00.000Z");
    expect(learning.capturedAt).toBeDefined();
  });

  it("captures failure outcome from CompletionEvent with non-zero exit", async () => {
    const event: CompletionEvent = {
      agentId: "ao-agent-2",
      storyId: "1-2-broken",
      exitCode: 1,
      duration: 60000,
      completedAt: new Date("2026-03-18T15:00:00Z"),
    };

    const learning = await captureSessionLearning(event, "my-project", 2);

    expect(learning.outcome).toBe("failed");
    expect(learning.retryCount).toBe(2);
    expect(learning.errorCategories).toContain("exit_code_1");
  });

  it("captures failure from FailureEvent", async () => {
    const event: FailureEvent = {
      agentId: "ao-agent-3",
      storyId: "1-3-crashed",
      reason: "crashed",
      failedAt: new Date("2026-03-18T16:00:00Z"),
      duration: 30000,
      errorContext: "SIGKILL",
    };

    const learning = await captureSessionLearning(event, "my-project", 1);

    expect(learning.outcome).toBe("failed");
    expect(learning.errorCategories).toContain("crashed");
    expect(learning.errorCategories).toContain("SIGKILL");
  });

  it("captures abandoned outcome from disconnected FailureEvent", async () => {
    const event: FailureEvent = {
      agentId: "ao-agent-4",
      storyId: "1-4-disconnected",
      reason: "disconnected",
      failedAt: new Date("2026-03-18T17:00:00Z"),
      duration: 5000,
    };

    const learning = await captureSessionLearning(event, "my-project", 0);

    expect(learning.outcome).toBe("abandoned");
    expect(learning.errorCategories).toContain("disconnected");
  });

  it("returns empty filesModified when no worktree path", async () => {
    const event: CompletionEvent = {
      agentId: "ao-1",
      storyId: "1-1",
      exitCode: 0,
      duration: 1000,
      completedAt: new Date(),
    };

    const learning = await captureSessionLearning(event, "proj", 0);

    expect(learning.filesModified).toEqual([]);
    expect(learning.domainTags).toEqual([]);
    expect(learning.testsAdded).toBe(0);
  });

  it("does not include file contents or secrets (NFR-AI-S1)", async () => {
    const event: CompletionEvent = {
      agentId: "ao-1",
      storyId: "1-1",
      exitCode: 0,
      duration: 1000,
      completedAt: new Date(),
    };

    const learning = await captureSessionLearning(event, "proj", 0);

    // Learning record should only have metadata, not content
    const json = JSON.stringify(learning);
    expect(json).not.toContain("password");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("api_key");
    // Should contain only expected fields
    expect(learning.sessionId).toBeDefined();
    expect(learning.outcome).toBeDefined();
    expect(learning.durationMs).toBeDefined();
  });
});
