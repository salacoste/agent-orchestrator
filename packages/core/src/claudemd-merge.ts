/**
 * CLAUDE.md merge — combines project rules with provider enhancements.
 *
 * When an enhanced session is spawned, the worktree gets a copy of the
 * project's CLAUDE.md (via git worktree). This module merges provider-specific
 * agent instructions (delegation, catalog, conventions) into that CLAUDE.md,
 * preserving project content verbatim and appending provider additions under
 * a clearly marked section header.
 *
 * Convention: providers write `.{providerName}/provider-claude-md.md` with their additions.
 *
 * Epic 59, Story 59-4 (FR-S2-2).
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { ClaudeMdMergeResult } from "./types.js";

// ---------------------------------------------------------------------------
// Provider name validation
// ---------------------------------------------------------------------------

/** Valid provider name: alphanumeric, hyphens, underscores only. */
const PROVIDER_NAME_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate provider name to prevent path traversal and marker injection.
 * @throws {Error} if the name contains path separators or other unsafe characters.
 */
function validateProviderName(name: string): void {
  if (!PROVIDER_NAME_RE.test(name)) {
    throw new Error(
      `Invalid provider name "${name}": must contain only alphanumeric, hyphens, and underscores`,
    );
  }
}

// ---------------------------------------------------------------------------
// Provider section markers
// ---------------------------------------------------------------------------

/**
 * Build the HTML comment marker used to identify a provider's section start.
 * Example: `<!-- Provider: omc -->`
 */
function providerMarker(providerName: string): string {
  return `<!-- Provider: ${providerName} -->`;
}

/**
 * Build the HTML comment marker used to identify a provider's section end.
 * Example: `<!-- /Provider: omc -->`
 */
function providerCloseMarker(providerName: string): string {
  return `<!-- /Provider: ${providerName} -->`;
}

/**
 * Build the section header for a provider's additions.
 * Example: `## Provider Enhancements (omc)`
 */
function providerHeader(providerName: string): string {
  return `## Provider Enhancements (${providerName})`;
}

// ---------------------------------------------------------------------------
// mergeClaudeMd
// ---------------------------------------------------------------------------

/**
 * Merge project CLAUDE.md content with provider additions.
 *
 * The merged format is:
 * ```
 * <project content preserved verbatim>
 * ---
 * <!-- Provider: {providerName} -->
 * ## Provider Enhancements ({providerName})
 * <provider additions>
 * <!-- /Provider: {providerName} -->
 * ```
 *
 * If the existing content already contains a provider section (detected by
 * the `<!-- Provider: {name} -->` marker), the old section is stripped before
 * appending fresh content. This makes the merge idempotent.
 *
 * @param existingContent - The current CLAUDE.md content (project rules).
 * @param providerAdditions - Provider-specific content to append.
 * @param providerName - Name of the provider (e.g., "omc").
 * @returns The merged CLAUDE.md content.
 */
export function mergeClaudeMd(
  existingContent: string,
  providerAdditions: string,
  providerName: string,
): string {
  // If no provider additions, return original content unchanged
  if (!providerAdditions.trim()) {
    return existingContent;
  }

  const marker = providerMarker(providerName);
  const closeMarker = providerCloseMarker(providerName);
  const header = providerHeader(providerName);

  // Strip any existing provider section (idempotent re-merge)
  let baseContent = stripProviderSection(existingContent, providerName);

  // Trim trailing whitespace/newlines from base content
  baseContent = baseContent.trimEnd();

  // Build the provider section with closing marker for precise bounding
  const providerSection = [
    "---",
    marker,
    header,
    "",
    providerAdditions.trim(),
    closeMarker,
    "",
  ].join("\n");

  // If base content is empty, don't prefix with newline (avoids leading blank line)
  if (!baseContent) {
    return providerSection;
  }

  return baseContent + "\n" + providerSection;
}

/**
 * Strip an existing provider section from CLAUDE.md content.
 *
 * Uses the opening (`<!-- Provider: {name} -->`) and closing (`<!-- /Provider: {name} -->`)
 * markers to precisely bound the section. Falls back to stripping to EOF for
 * backward compatibility with sections merged before the closing marker was added.
 * Also removes the preceding `---` separator if present.
 */
function stripProviderSection(content: string, providerName: string): string {
  const marker = providerMarker(providerName);
  const closeMarker = providerCloseMarker(providerName);
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    return content;
  }

  // Find the start of the line containing the opening marker
  let lineStart = content.lastIndexOf("\n", markerIndex);
  if (lineStart === -1) {
    lineStart = 0;
  } else {
    lineStart++; // Skip the newline character
  }

  // Check for a preceding `---` separator line
  let cutPoint = lineStart;
  const before = content.slice(0, lineStart).trimEnd();
  if (before.endsWith("---")) {
    // Include the newline before the separator
    cutPoint = before.lastIndexOf("\n") + 1;
  }

  // Find the closing marker to determine section end precisely
  const afterOpenMarker = markerIndex + marker.length;
  const closeIndex = content.indexOf(closeMarker, afterOpenMarker);

  if (closeIndex !== -1) {
    // Closing marker found — strip from cutPoint to just after the close marker
    const afterClose = closeIndex + closeMarker.length;
    // Skip trailing newlines after close marker
    let sectionEnd = afterClose;
    while (sectionEnd < content.length && content[sectionEnd] === "\n") {
      sectionEnd++;
    }
    return content.slice(0, cutPoint) + content.slice(sectionEnd);
  }

  // No closing marker found (legacy format) — fall back to stripping to EOF
  return content.slice(0, cutPoint);
}

// ---------------------------------------------------------------------------
// readClaudeMd
// ---------------------------------------------------------------------------

/**
 * Read a CLAUDE.md file from the given path.
 *
 * @returns The file content, or null if the file does not exist.
 */
export function readClaudeMd(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// writeClaudeMd
// ---------------------------------------------------------------------------

/**
 * Write CLAUDE.md content to a file using atomic write (temp file + rename).
 *
 * Uses a unique temp file name (PID + UUID) to prevent race conditions
 * from concurrent writes on the same worktree.
 */
export async function writeClaudeMd(filePath: string, content: string): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmpPath, content, "utf-8");
  try {
    await rename(tmpPath, filePath);
  } catch (err) {
    // Clean up orphaned temp file before re-throwing
    try {
      await unlink(tmpPath);
    } catch {
      // Best effort
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// performMerge
// ---------------------------------------------------------------------------

/**
 * Orchestrate the full CLAUDE.md merge in a worktree.
 *
 * 1. Check if `.{providerName}/provider-claude-md.md` exists in the worktree (skip if not)
 * 2. Read the worktree's CLAUDE.md (empty string if not present)
 * 3. Read provider additions
 * 4. Merge and write atomically
 * 5. Post-merge verification: confirm file exists and contains the provider marker
 *
 * @returns A result indicating whether the merge was performed.
 */
export async function performMerge(
  worktreePath: string,
  providerName: string,
): Promise<ClaudeMdMergeResult> {
  validateProviderName(providerName);
  const providerAdditionsPath = join(worktreePath, `.${providerName}`, "provider-claude-md.md");
  const claudeMdPath = join(worktreePath, "CLAUDE.md");

  // Step 1: Check if provider additions file exists
  if (!existsSync(providerAdditionsPath)) {
    return { merged: false, path: claudeMdPath };
  }

  // Step 2: Read existing CLAUDE.md (may not exist in worktree)
  const existingContent = readClaudeMd(claudeMdPath) ?? "";

  // Step 3: Read provider additions
  const providerAdditions = readFileSync(providerAdditionsPath, "utf-8");

  // Step 4: Merge
  const merged = mergeClaudeMd(existingContent, providerAdditions, providerName);

  // If merge didn't change anything (no additions), skip write
  if (merged === existingContent) {
    return { merged: false, path: claudeMdPath };
  }

  // Step 5: Atomic write
  await writeClaudeMd(claudeMdPath, merged);

  // Step 6: Post-merge verification (AC8)
  try {
    if (!existsSync(claudeMdPath)) {
      return { merged: false, path: claudeMdPath };
    }
    const writtenContent = readFileSync(claudeMdPath, "utf-8");
    if (!writtenContent.includes(providerMarker(providerName))) {
      return { merged: false, path: claudeMdPath };
    }
  } catch {
    // Verification I/O failure — file was written but can't be read back
    return { merged: false, path: claudeMdPath };
  }

  return { merged: true, path: claudeMdPath };
}
