/**
 * Session Learning — Captures structured session outcomes for AI intelligence
 *
 * When agents complete stories, this module produces a SessionLearning record
 * containing outcome, duration, files modified, domain tags, and error categories.
 * These records feed into prompt injection, scoring, and collaboration features.
 *
 * Security: No file contents or secrets — only metadata (NFR-AI-S1).
 * Performance: <50ms overhead on completion flow (NFR-AI-P1).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SessionLearning, CompletionEvent, FailureEvent } from "./types.js";

const execFileAsync = promisify(execFile);

/** Git diff timeout in ms */
const GIT_TIMEOUT_MS = 5_000;

/**
 * Infer domain tags from modified file paths.
 * Maps file extensions and path patterns to domain categories.
 */
export function inferDomainTags(files: string[]): string[] {
  const tags = new Set<string>();

  for (const f of files) {
    if (/\.(tsx|jsx)$/.test(f) || f.includes("/components/")) tags.add("frontend");
    if (/\.test\.|\.spec\./.test(f)) tags.add("testing");
    if (/route\.(ts|tsx)$/.test(f) || f.includes("/api/")) tags.add("api");
    if (/\.(css|scss|less)$/.test(f)) tags.add("styling");
  }

  // If .ts files exist but no specific domain matched, tag as backend
  if (tags.size === 0 && files.some((f) => /\.(ts|js)$/.test(f))) {
    tags.add("backend");
  }

  return [...tags];
}

/**
 * Count test files in a list of modified files.
 */
export function countTestFiles(files: string[]): number {
  return files.filter((f) => /\.test\.|\.spec\./.test(f)).length;
}

/**
 * Get modified files from git diff in a worktree directory.
 * Returns empty array on any failure (git not available, not a repo, timeout).
 */
export async function getModifiedFiles(worktreePath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--name-only", "HEAD~1"], {
      cwd: worktreePath,
      timeout: GIT_TIMEOUT_MS,
    });
    return stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    // Git not available, not a repo, or timeout — return empty
    return [];
  }
}

/**
 * Capture a SessionLearning record from a completion event.
 *
 * @param event - CompletionEvent or FailureEvent
 * @param projectId - Project identifier
 * @param retryCount - Number of retry attempts from registry
 * @param worktreePath - Optional workspace path for git diff
 * @returns SessionLearning record ready for storage
 */
export async function captureSessionLearning(
  event: CompletionEvent | FailureEvent,
  projectId: string,
  retryCount: number,
  worktreePath?: string,
): Promise<SessionLearning> {
  // Determine outcome
  let outcome: SessionLearning["outcome"];
  const errorCategories: string[] = [];

  if ("exitCode" in event && "completedAt" in event) {
    // CompletionEvent
    outcome = event.exitCode === 0 ? "completed" : "failed";
    if (event.exitCode !== 0) {
      errorCategories.push(`exit_code_${event.exitCode}`);
    }
  } else if ("reason" in event) {
    // FailureEvent
    const failureEvent = event as FailureEvent;
    outcome = failureEvent.reason === "disconnected" ? "abandoned" : "failed";
    errorCategories.push(failureEvent.reason);
    if (failureEvent.errorContext) {
      errorCategories.push(failureEvent.errorContext);
    }
  } else {
    outcome = "failed";
  }

  // Get modified files from git (if workspace available)
  const filesModified = worktreePath ? await getModifiedFiles(worktreePath) : [];

  // Infer domain tags and count tests
  const domainTags = inferDomainTags(filesModified);
  const testsAdded = countTestFiles(filesModified);

  // Get completion timestamp
  const completedAt =
    "completedAt" in event
      ? (event as CompletionEvent).completedAt.toISOString()
      : "failedAt" in event
        ? (event as FailureEvent).failedAt.toISOString()
        : new Date().toISOString();

  return {
    sessionId: event.agentId,
    agentId: event.agentId,
    storyId: event.storyId,
    projectId,
    outcome,
    durationMs: event.duration,
    retryCount,
    filesModified,
    testsAdded,
    errorCategories,
    domainTags,
    completedAt,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Select relevant learnings for prompt injection.
 *
 * Filters: failed outcomes only → matching domain tags → sorted newest first → limited.
 * Returns safe subset of fields (no file contents — NFR-AI-S1).
 *
 * @param allLearnings - All available learning records (from store.query or store.list)
 * @param storyDomainTags - Domain tags of the story being spawned
 * @param limit - Max learnings to return (default: 3)
 */
export function selectRelevantLearnings(
  allLearnings: SessionLearning[],
  storyDomainTags: string[],
  limit = 3,
): SessionLearning[] {
  // Filter to failures only (most instructive)
  let results = allLearnings.filter((l) => l.outcome === "failed");

  // Prefer domain matches (but include non-matching if not enough)
  if (storyDomainTags.length > 0) {
    const domainMatches = results.filter((l) =>
      l.domainTags.some((tag) => storyDomainTags.includes(tag)),
    );
    const nonMatches = results.filter(
      (l) => !l.domainTags.some((tag) => storyDomainTags.includes(tag)),
    );
    results = [...domainMatches, ...nonMatches];
  }

  // Sort newest first (already sorted if from query, but ensure)
  results.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return results.slice(0, limit);
}
