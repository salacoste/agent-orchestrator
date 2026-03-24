/**
 * Agent hot-swap tests (Story 47.5).
 */
import { describe, expect, it } from "vitest";
import { buildSwapPlan, buildHandoffPrompt, type SwapContext } from "../agent-hot-swap.js";

const CONTEXT: SwapContext = {
  previousSummary: "Implemented auth module with JWT tokens",
  filesModified: ["src/auth.ts", "src/middleware.ts"],
  domainTags: ["backend", "security"],
  branchName: "ao/story-auth",
  worktreePath: "/tmp/worktrees/story-auth",
};

describe("buildSwapPlan", () => {
  it("creates plan with all fields", () => {
    const plan = buildSwapPlan("session-1", "codex", "proj-1", "story-auth", CONTEXT);

    expect(plan.stopSessionId).toBe("session-1");
    expect(plan.newAgentType).toBe("codex");
    expect(plan.projectId).toBe("proj-1");
    expect(plan.storyId).toBe("story-auth");
    expect(plan.context).toBe(CONTEXT);
    expect(plan.reason).toBe("Manual agent swap");
    expect(plan.createdAt).toBeTruthy();
  });

  it("accepts custom reason", () => {
    const plan = buildSwapPlan("s-1", "aider", "p-1", "s-1", CONTEXT, "Agent stuck on tests");

    expect(plan.reason).toBe("Agent stuck on tests");
  });

  it("preserves branch and worktree in context", () => {
    const plan = buildSwapPlan("s-1", "codex", "p-1", "s-1", CONTEXT);

    expect(plan.context.branchName).toBe("ao/story-auth");
    expect(plan.context.worktreePath).toBe("/tmp/worktrees/story-auth");
  });

  it("preserves files modified for handoff", () => {
    const plan = buildSwapPlan("s-1", "codex", "p-1", "s-1", CONTEXT);

    expect(plan.context.filesModified).toEqual(["src/auth.ts", "src/middleware.ts"]);
  });
});

describe("buildHandoffPrompt", () => {
  it("includes previous summary", () => {
    const prompt = buildHandoffPrompt(CONTEXT);

    expect(prompt).toContain("Previous agent summary");
    expect(prompt).toContain("JWT tokens");
  });

  it("includes files modified", () => {
    const prompt = buildHandoffPrompt(CONTEXT);

    expect(prompt).toContain("src/auth.ts");
    expect(prompt).toContain("src/middleware.ts");
  });

  it("includes domain tags", () => {
    const prompt = buildHandoffPrompt(CONTEXT);

    expect(prompt).toContain("backend");
    expect(prompt).toContain("security");
  });

  it("includes branch and worktree", () => {
    const prompt = buildHandoffPrompt(CONTEXT);

    expect(prompt).toContain("ao/story-auth");
    expect(prompt).toContain("/tmp/worktrees/story-auth");
  });

  it("includes continuation instruction", () => {
    const prompt = buildHandoffPrompt(CONTEXT);

    expect(prompt).toContain("Continue from where");
  });

  it("handles null summary gracefully", () => {
    const ctx: SwapContext = { ...CONTEXT, previousSummary: null };
    const prompt = buildHandoffPrompt(ctx);

    expect(prompt).not.toContain("Previous agent summary");
    expect(prompt).toContain("Branch");
  });

  it("handles empty files gracefully", () => {
    const ctx: SwapContext = { ...CONTEXT, filesModified: [] };
    const prompt = buildHandoffPrompt(ctx);

    expect(prompt).not.toContain("Files already modified");
  });
});
