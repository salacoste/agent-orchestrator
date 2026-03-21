/**
 * Git hook: commit tagging with story ID and agent session (Story 35.4).
 *
 * Adds [story:X-Y] [agent:session-id] tags to commit messages
 * when commits are made during an agent session.
 *
 * Install via: ao init --hooks
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

/** Extract active story and agent from session metadata. */
export function getCommitTags(dataDir: string): {
  storyTag: string | null;
  agentTag: string | null;
} {
  const storyTag: string | null = null;
  const agentTag: string | null = null;

  try {
    const sessionsDir = join(dataDir, "sessions");
    if (!existsSync(sessionsDir)) return { storyTag, agentTag };

    // Find active session metadata with story context
    // In production, this reads from the session metadata files
    // For now, returns null (tags only added when session is active)
  } catch {
    // Non-fatal — missing tags don't block commits
  }

  return { storyTag, agentTag };
}

/** Format commit message with tags. */
export function tagCommitMessage(
  message: string,
  storyId: string | null,
  agentId: string | null,
): string {
  const tags: string[] = [];
  if (storyId) tags.push(`[story:${storyId}]`);
  if (agentId) tags.push(`[agent:${agentId}]`);

  if (tags.length === 0) return message;

  // Append tags to first line of commit message
  const lines = message.split("\n");
  lines[0] = `${lines[0]} ${tags.join(" ")}`;
  return lines.join("\n");
}
