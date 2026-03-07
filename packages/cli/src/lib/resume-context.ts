/**
 * Resume Context Formatter
 *
 * Formats resume context for agents that are retrying failed stories.
 * Provides structured information about previous attempts and blockage reasons.
 */

import type { AgentAssignment } from "@composio/ao-core";
import { formatTimeAgo } from "./format.js";

interface StoryContext {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  status: string;
}

interface PreviousAttemptDetails {
  agentId: string;
  status: string;
  assignedAt: Date;
  completedAt?: Date;
  exitCode?: number;
  signal?: string;
  errorContext?: string;
  previousLogsPath?: string;
}

interface ResumeContextParams {
  story: StoryContext;
  previousAssignment: AgentAssignment;
  retryCount: number;
  userMessage?: string;
  previousLogsPath?: string;
  exitCode?: number;
  signal?: string;
}

/**
 * Format resume context for a retrying agent
 */
export function formatResumeContext(params: ResumeContextParams): string {
  const { story, previousAssignment, retryCount, userMessage, previousLogsPath } = params;

  const sections: string[] = [];

  // Header
  sections.push("=".repeat(60));
  sections.push("RESUME CONTEXT");
  sections.push("=".repeat(60));
  sections.push("");

  // Story section
  sections.push(...formatStorySection(story));

  // Previous attempt section
  sections.push("");
  sections.push(
    ...formatPreviousAttemptSection(previousAssignment, params.exitCode, params.signal),
  );

  // Blockage reason section
  sections.push("");
  sections.push(...formatBlockageReasonSection(previousAssignment));

  // Resume instructions
  sections.push("");
  sections.push(...formatResumeInstructions(retryCount, userMessage, previousLogsPath));

  // Footer
  sections.push("");
  sections.push("=".repeat(60));
  sections.push("END RESUME CONTEXT");
  sections.push("=".repeat(60));

  return sections.join("\n");
}

/**
 * Format story section of resume context
 */
function formatStorySection(story: StoryContext): string[] {
  const lines: string[] = [];

  lines.push("STORY TO COMPLETE:");
  lines.push(`  ID: ${story.id}`);
  lines.push(`  Title: ${story.title}`);
  lines.push(`  Status: ${story.status}`);
  lines.push("");
  lines.push("DESCRIPTION:");

  // Indent description lines
  const descLines = story.description.split("\n");
  for (const line of descLines) {
    lines.push(`  ${line}`);
  }

  lines.push("");
  lines.push("ACCEPTANCE CRITERIA:");

  // Split AC by numbered list items or dash items
  const acLines = story.acceptanceCriteria.split("\n");
  for (const line of acLines) {
    const trimmed = line.trim();
    if (trimmed) {
      lines.push(`  ${trimmed}`);
    }
  }

  return lines;
}

/**
 * Format previous attempt section of resume context
 */
function formatPreviousAttemptSection(
  assignment: AgentAssignment,
  exitCode?: number,
  signal?: string,
): string[] {
  const lines: string[] = [];

  lines.push("PREVIOUS ATTEMPT:");
  lines.push(`  Agent: ${assignment.agentId}`);
  lines.push(`  Status: ${assignment.status}`);
  lines.push(`  Assigned: ${formatTimeAgo(assignment.assignedAt)}`);

  // Add exit code if available (from failure event)
  if (exitCode !== undefined) {
    lines.push(`  Exit Code: ${exitCode}`);
  }

  // Add signal if available (from crash event)
  if (signal) {
    lines.push(`  Signal: ${signal}`);
  }

  return lines;
}

/**
 * Format blockage reason section of resume context
 */
function formatBlockageReasonSection(assignment: AgentAssignment): string[] {
  const lines: string[] = [];

  lines.push("BLOCKAGE REASON:");

  const reasons: Record<string, string> = {
    failed: "The agent exited with a non-zero exit code, indicating a failure.",
    crashed: "The agent crashed with a signal, indicating a runtime error.",
    timed_out: "The agent exceeded the maximum allowed runtime.",
    disconnected: "The agent session was disconnected or killed.",
  };

  const reason = reasons[assignment.status] || "Unknown reason";
  lines.push(`  ${reason}`);

  return lines;
}

/**
 * Format resume instructions for the agent
 */
function formatResumeInstructions(
  retryCount: number,
  userMessage?: string,
  previousLogsPath?: string,
): string[] {
  const lines: string[] = [];

  lines.push("RESUME INSTRUCTIONS:");
  lines.push(`  This is retry #${retryCount} for this story.`);
  lines.push("");
  lines.push("Your task is to:");
  lines.push("  1. Review the previous attempt details above");
  lines.push("  2. Understand why the previous agent failed");
  lines.push("  3. Continue the work from where it left off");
  lines.push("  4. Address the blockage that caused the failure");

  if (userMessage) {
    lines.push("");
    lines.push("ADDITIONAL CONTEXT FROM USER:");
    const msgLines = userMessage.split("\n");
    for (const line of msgLines) {
      lines.push(`  ${line}`);
    }
  }

  if (previousLogsPath) {
    lines.push("");
    lines.push("Previous session logs are available for reference:");
    lines.push(`  ${previousLogsPath}`);
    lines.push("");
    lines.push("You can inspect these logs to understand what happened in the previous session.");
  }

  lines.push("");
  lines.push("Focus on completing the story acceptance criteria.");

  return lines;
}

/**
 * Extract previous attempt details from agent assignment
 */
export function extractPreviousAttemptDetails(assignment: AgentAssignment, previousLogsPath?: string): PreviousAttemptDetails {
  return {
    agentId: assignment.agentId,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    errorContext: undefined, // Could be loaded from metadata if stored
    previousLogsPath,
  };
}

/**
 * Validate user message for length and content
 */
export function validateUserMessage(message: string | undefined): string | undefined {
  if (!message) {
    return undefined;
  }

  const trimmed = message.trim();
  const maxLength = 5000; // Max 5KB user message

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    // Truncate with ellipsis
    return trimmed.slice(0, maxLength - 3) + "...";
  }

  return trimmed;
}
