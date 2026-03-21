/**
 * Prompt Builder — composes layered prompts for agent sessions.
 *
 * Three layers:
 *   1. BASE_AGENT_PROMPT — constant instructions about session lifecycle, git workflow, PR handling
 *   2. Config-derived context — project name, repo, default branch, tracker info, reaction rules
 *   3. User rules — inline agentRules and/or agentRulesFile content
 *
 * buildPrompt() returns null when there's nothing meaningful to compose
 * (no issue, no rules, no explicit prompt), preserving backward compatibility
 * for bare launches.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectConfig, SessionLearning } from "./types.js";

// =============================================================================
// LAYER 1: BASE AGENT PROMPT
// =============================================================================

export const BASE_AGENT_PROMPT = `You are an AI coding agent managed by the Agent Orchestrator (ao).

## Session Lifecycle
- You are running inside a managed session. Focus on the assigned task.
- When you finish your work, create a PR and push it. The orchestrator will handle CI monitoring and review routing.
- If CI fails, the orchestrator will send you the failures — fix them and push again.
- If reviewers request changes, the orchestrator will forward their comments — address each one, push fixes, and reply to the comments.

## Git Workflow
- Always create a feature branch from the default branch (never commit directly to it).
- Use conventional commit messages (feat:, fix:, chore:, etc.).
- Push your branch and create a PR when the implementation is ready.
- Keep PRs focused — one issue per PR.

## PR Best Practices
- Write a clear PR title and description explaining what changed and why.
- Link the issue in the PR description so it auto-closes when merged.
- If the repo has CI checks, make sure they pass before requesting review.
- Respond to every review comment, even if just to acknowledge it.`;

// =============================================================================
// TYPES
// =============================================================================

export interface PromptBuildConfig {
  /** The project config from the orchestrator config */
  project: ProjectConfig;

  /** The project ID (key in the projects map) */
  projectId: string;

  /** Issue identifier (e.g. "INT-1343", "#42") — triggers Layer 1+2 */
  issueId?: string;

  /** Pre-fetched issue context from tracker.generatePrompt() */
  issueContext?: string;

  /** Pre-formatted story context from sprint-status.yaml + story file */
  storyContext?: string;

  /** Explicit user prompt (appended last) */
  userPrompt?: string;

  /** Past session learnings to inject for AI intelligence (Story 12.1) */
  learnings?: SessionLearning[];
}

// =============================================================================
// LAYER 2: CONFIG-DERIVED CONTEXT
// =============================================================================

function buildConfigLayer(config: PromptBuildConfig): string {
  const { project, projectId, issueId, issueContext, storyContext } = config;
  const lines: string[] = [];

  lines.push("## Project Context");
  lines.push(`- Project: ${project.name ?? projectId}`);
  lines.push(`- Repository: ${project.repo}`);
  lines.push(`- Default branch: ${project.defaultBranch}`);

  if (project.tracker) {
    lines.push(`- Tracker: ${project.tracker.plugin}`);
  }

  if (issueId) {
    lines.push(`\n## Task`);
    lines.push(`Work on issue: ${issueId}`);
    lines.push(
      `Create a branch named so that it auto-links to the issue tracker (e.g. feat/${issueId}).`,
    );
  }

  if (issueContext) {
    lines.push(`\n## Issue Details`);
    lines.push(issueContext);
  }

  if (storyContext) {
    lines.push(`\n## Story Context`);
    lines.push(storyContext);
  }

  // Include reaction rules so the agent knows what to expect
  if (project.reactions) {
    const reactionHints: string[] = [];
    for (const [event, reaction] of Object.entries(project.reactions)) {
      if (reaction.auto && reaction.action === "send-to-agent") {
        reactionHints.push(`- ${event}: auto-handled (you'll receive instructions)`);
      }
    }
    if (reactionHints.length > 0) {
      lines.push(`\n## Automated Reactions`);
      lines.push("The orchestrator will automatically handle these events:");
      lines.push(...reactionHints);
    }
  }

  return lines.join("\n");
}

// =============================================================================
// LAYER 3: USER RULES
// =============================================================================

function readUserRules(project: ProjectConfig): string | null {
  const parts: string[] = [];

  if (project.agentRules) {
    parts.push(project.agentRules);
  }

  if (project.agentRulesFile) {
    const filePath = resolve(project.path, project.agentRulesFile);
    try {
      const content = readFileSync(filePath, "utf-8").trim();
      if (content) {
        parts.push(content);
      }
    } catch {
      // File not found or unreadable — skip silently (don't crash the spawn)
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Compose a layered prompt for an agent session.
 *
 * Returns null if there's nothing meaningful to compose (no issue, no rules,
 * no explicit user prompt). This preserves backward-compatible behavior where
 * bare launches (no issue) send no prompt.
 */
export function buildPrompt(config: PromptBuildConfig): string | null {
  const hasIssue = Boolean(config.issueId);
  const hasStory = Boolean(config.storyContext);
  const userRules = readUserRules(config.project);
  const hasRules = Boolean(userRules);
  const hasUserPrompt = Boolean(config.userPrompt);

  // Nothing to compose — return null for backward compatibility
  if (!hasIssue && !hasStory && !hasRules && !hasUserPrompt) {
    return null;
  }

  const sections: string[] = [];

  // Layer 1: Base prompt (always included when we have something to compose)
  sections.push(BASE_AGENT_PROMPT);

  // Layer 2: Config-derived context
  sections.push(buildConfigLayer(config));

  // Layer 3: User rules
  if (userRules) {
    sections.push(`## Project Rules\n${userRules}`);
  }

  // Layer 4: Past session learnings (Story 12.1)
  const learningsSection = buildLearningsLayer(config.learnings);
  if (learningsSection) {
    sections.push(learningsSection);
  }

  // Explicit user prompt (appended last, highest priority)
  if (config.userPrompt) {
    sections.push(`## Additional Instructions\n${config.userPrompt}`);
  }

  return sections.join("\n\n");
}

/**
 * Build learnings section from past session outcomes.
 * Returns null if no learnings provided or array is empty.
 * Expects pre-filtered learnings (typically failures from selectRelevantLearnings).
 */
export function buildLearningsLayer(learnings?: SessionLearning[]): string | null {
  if (!learnings || learnings.length === 0) {
    return null;
  }

  // Filter out completed outcomes — only failures/blocked are instructive
  const instructive = learnings.filter((l) => l.outcome !== "completed");
  if (instructive.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("## Lessons from Past Sessions");
  lines.push("");
  lines.push("In previous similar work, these issues were encountered:");
  lines.push("");

  for (let i = 0; i < instructive.length; i++) {
    const l = instructive[i];
    const errors = l.errorCategories.length > 0 ? l.errorCategories.join(", ") : "unknown";
    const domains = l.domainTags.length > 0 ? l.domainTags.join(", ") : "general";
    const durationMin = Math.round(l.durationMs / 60000);
    lines.push(`${i + 1}. **${l.storyId}** (${l.outcome}) — errors: ${errors}`);
    lines.push(`   Domains: ${domains} | Duration: ${durationMin}m`);
  }

  return lines.join("\n");
}
