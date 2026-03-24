/**
 * Agent hot-swap — replace running agent preserving context (Story 47.5).
 *
 * Pure data structures. Builds a declarative swap plan — execution
 * is handled by the orchestrator, not this module.
 */

/** Context gathered from the current agent for handoff. */
export interface SwapContext {
  previousSummary: string | null;
  filesModified: string[];
  domainTags: string[];
  branchName: string;
  worktreePath: string;
}

/** Declarative swap plan — what to do, not how to do it. */
export interface SwapPlan {
  stopSessionId: string;
  newAgentType: string;
  projectId: string;
  storyId: string;
  context: SwapContext;
  reason: string;
  createdAt: string;
}

/**
 * Build a swap plan for replacing a running agent.
 *
 * Pure function — no I/O, no execution. The orchestrator reads the plan
 * and performs the actual stop + spawn sequence.
 */
export function buildSwapPlan(
  sessionId: string,
  newAgentType: string,
  projectId: string,
  storyId: string,
  context: SwapContext,
  reason: string = "Manual agent swap",
): SwapPlan {
  return {
    stopSessionId: sessionId,
    newAgentType,
    projectId,
    storyId,
    context,
    reason,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a context prompt for the new agent from swap context.
 * Returns a human-readable handoff message.
 */
export function buildHandoffPrompt(context: SwapContext): string {
  const lines: string[] = [];
  lines.push("## Agent Handoff Context");
  lines.push("");

  if (context.previousSummary) {
    lines.push(`**Previous agent summary:** ${context.previousSummary}`);
    lines.push("");
  }

  if (context.filesModified.length > 0) {
    lines.push(`**Files already modified:** ${context.filesModified.join(", ")}`);
    lines.push("");
  }

  if (context.domainTags.length > 0) {
    lines.push(`**Domain:** ${context.domainTags.join(", ")}`);
    lines.push("");
  }

  lines.push(`**Branch:** ${context.branchName}`);
  lines.push(`**Worktree:** ${context.worktreePath}`);
  lines.push("");
  lines.push("Continue from where the previous agent left off.");

  return lines.join("\n");
}
