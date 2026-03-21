/**
 * Story Context — helpers for reading sprint-status.yaml and story files.
 *
 * Extracted from spawn-story.ts for reuse in both `ao spawn --story`
 * and `ao spawn-story` commands.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parse } from "yaml";
import type { StateManager } from "@composio/ao-core";

// =============================================================================
// SYNC BRIDGE CACHE — module-level ref for SyncBridge StateManager
// =============================================================================

let cachedStateManager: StateManager | undefined;

/**
 * Register a StateManager from a SyncBridge for use by CLI fallback paths.
 * Called by wire-detection.ts when a SyncBridge is created for a story session.
 */
export function registerStateManager(sm: StateManager): void {
  cachedStateManager = sm;
}

/**
 * Clear the cached StateManager (called on SyncBridge teardown).
 */
export function clearStateManager(): void {
  cachedStateManager = undefined;
}

/**
 * Get a StateManager if one is available, otherwise signal fallback.
 *
 * CLI commands use direct YAML reads as the fallback path.
 * Full CLI → StateManager migration is deferred — StateManager is currently
 * wired only for completion/failure event handling via SyncBridge.
 */
export function getStateManagerOrFallback(): {
  stateManager?: StateManager;
  fallback: boolean;
} {
  if (cachedStateManager) {
    return { stateManager: cachedStateManager, fallback: false };
  }
  return { fallback: true };
}

// =============================================================================
// TYPES
// =============================================================================

export interface SprintStatus {
  project: string;
  project_key?: string;
  tracking_system?: string;
  story_location?: string;
  development_status: Record<string, string>;
  dependencies?: Record<string, string[]>;
  priorities?: Record<string, number>;
}

export interface StoryContext {
  id: string;
  title: string;
  status: string;
  description: string;
  acceptanceCriteria: string;
  dependencies?: string[];
  priority?: number;
  epic?: string;
}

// =============================================================================
// SPRINT STATUS
// =============================================================================

/**
 * Read and parse sprint-status.yaml from a directory.
 * Returns null if file doesn't exist or is unparseable.
 */
export function readSprintStatus(dir: string): SprintStatus | null {
  const sprintStatusFile = join(dir, "sprint-status.yaml");

  if (!existsSync(sprintStatusFile)) {
    return null;
  }

  try {
    const content = readFileSync(sprintStatusFile, "utf-8");
    const parsed = parse(content) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (!record["development_status"] || typeof record["development_status"] !== "object") {
      return null;
    }

    return parsed as SprintStatus;
  } catch {
    return null;
  }
}

// =============================================================================
// STORY FILE OPERATIONS
// =============================================================================

/**
 * Extract epic ID from story ID (e.g., "1-2-cli-spawn-agent" -> "epic-1")
 */
export function extractEpicId(storyId: string): string | null {
  const match = storyId.match(/^(\d+)-/);
  return match ? `epic-${match[1]}` : null;
}

/**
 * Find the story file by ID, searching for direct match and story- prefix.
 */
export function findStoryFile(storyId: string, storyLocation: string): string | null {
  // Try direct match first
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    return directPath;
  }

  // Try with story- prefix (e.g., story-1-2-cli-spawn-agent.md)
  const withPrefix = join(storyLocation, `story-${storyId}.md`);
  if (existsSync(withPrefix)) {
    return withPrefix;
  }

  return null;
}

/**
 * Parse story file to extract context (title, description, acceptance criteria).
 */
export function parseStoryFile(filePath: string, storyId: string): StoryContext | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let title = "";
    let status = "";
    let currentSection = "";
    const descriptionLines: string[] = [];
    const acLines: string[] = [];

    for (const line of lines) {
      // Extract status
      const statusMatch = line.match(/^Status:\s*(.+)$/);
      if (statusMatch) {
        status = statusMatch[1].trim();
        continue;
      }

      // Extract title from h1
      const titleMatch = line.match(/^# (.+)$/);
      if (titleMatch && !title) {
        title = titleMatch[1].replace(/^Story\s+/, "").trim();
        continue;
      }

      // Track sections
      if (line.startsWith("## ")) {
        currentSection = line.replace("## ", "").toLowerCase().trim();
        continue;
      }

      // Extract description
      if (currentSection === "story" && line.trim() && !line.startsWith("#")) {
        descriptionLines.push(line);
      }

      // Extract acceptance criteria
      if (currentSection === "acceptance criteria" && line.trim()) {
        acLines.push(line);
      }
    }

    const description = descriptionLines.join("\n").trim();
    const acceptanceCriteria = acLines.join("\n").trim();

    if (!title || !description) {
      return null;
    }

    return {
      id: storyId,
      title,
      status,
      description,
      acceptanceCriteria,
      epic: extractEpicId(storyId) ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Format story context as a prompt for the agent.
 */
export function formatStoryPrompt(story: StoryContext): string {
  const parts: string[] = [];

  parts.push(`# Story: ${story.title}`);
  parts.push(`**Story ID:** ${story.id}`);
  if (story.epic) {
    parts.push(`**Epic:** ${story.epic}`);
  }
  parts.push(`**Status:** ${story.status}`);
  parts.push("");

  parts.push("## Description");
  parts.push(story.description);
  parts.push("");

  if (story.acceptanceCriteria) {
    parts.push("## Acceptance Criteria");
    parts.push(story.acceptanceCriteria);
    parts.push("");
  }

  if (story.dependencies && story.dependencies.length > 0) {
    parts.push("## Dependencies");
    parts.push(`This story depends on: ${story.dependencies.join(", ")}`);
    parts.push("");
  }

  // Commander's Intent — goal-based briefing (Story 18.1)
  if (story.title) {
    const goalPhrase = story.title
      .replace(/^[\d.]+[-:]\s*/, "")
      .replace(/^Story\s+/i, "")
      .trim();
    parts.push("## Commander's Intent");
    parts.push("");
    parts.push(
      `The intent of this story is to ${goalPhrase.charAt(0).toLowerCase()}${goalPhrase.slice(1)}. ` +
        "If you encounter obstacles with the planned approach, any solution that achieves this goal " +
        "while satisfying the acceptance criteria above is acceptable.",
    );
    parts.push("");
  }

  parts.push("---");
  parts.push("");
  parts.push("Please implement this story following the acceptance criteria.");
  parts.push(
    "Read the full story file from the implementation-artifacts directory for complete context.",
  );

  return parts.join("\n");
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format duration since a timestamp (e.g., "2m ago", "3h ago").
 */
export function formatDuration(since: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - since.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log an event to a JSONL audit trail file.
 * Used by assign, assign-next, and other commands that record assignment events.
 * Non-fatal: logging failure should not block the calling operation.
 */
export function logAuditEvent(auditDir: string, event: Record<string, unknown>): void {
  try {
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }

    const auditFile = join(auditDir, "assignments.jsonl");
    appendFileSync(auditFile, JSON.stringify(event) + "\n");
  } catch {
    // Non-fatal: logging failure should not block the calling operation
  }
}

// =============================================================================
// USER INTERACTION
// =============================================================================

/**
 * Prompt user for confirmation (y/N). Returns true if user confirms.
 */
export function promptConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N]: `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
