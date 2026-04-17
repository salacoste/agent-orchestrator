/**
 * Notepad module — create, read, and update .omc/notepad.md files.
 *
 * The notepad provides compaction survival for agent sessions. It has three
 * sections: Priority (permanent story context), Working Memory (transient
 * sprint context), and Manual (free-form developer notes).
 *
 * Epic 59, Story 59-1 (FR-S1-1, FR-S1-4).
 */

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { StoryContext, SprintContext, NotepadContent, NotepadSection } from "./types.js";

// ---------------------------------------------------------------------------
// Section markers
// ---------------------------------------------------------------------------

const SECTION_HEADERS: Record<NotepadSection, string> = {
  priority: "## Priority",
  working: "## Working Memory",
  manual: "## Manual",
} as const;

const SECTION_ORDER: NotepadSection[] = ["priority", "working", "manual"];

/** Escape regex metacharacters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// createNotepad
// ---------------------------------------------------------------------------

/**
 * Create (or overwrite) `.omc/notepad.md` in the worktree, populated with
 * story context in the Priority section and sprint context in Working Memory.
 *
 * @returns The file path of the created notepad.
 */
export async function createNotepad(
  worktreePath: string,
  context: StoryContext,
  sprintContext?: SprintContext,
): Promise<string> {
  const omcDir = join(worktreePath, ".omc");
  await mkdir(omcDir, { recursive: true });

  const priorityLines = buildPrioritySection(context);
  const workingLines = buildWorkingSection(sprintContext);

  const content = [
    SECTION_HEADERS.priority,
    "",
    ...priorityLines,
    "",
    SECTION_HEADERS.working,
    "",
    ...workingLines,
    "",
    SECTION_HEADERS.manual,
    "",
  ].join("\n");

  const notepadPath = join(omcDir, "notepad.md");
  // Atomic write: temp file then rename
  const tmpPath = notepadPath + ".tmp";
  await writeFile(tmpPath, content, "utf-8");
  try {
    await rename(tmpPath, notepadPath);
  } catch (err) {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // Best effort
    }
    throw err;
  }
  return notepadPath;
}

// ---------------------------------------------------------------------------
// readNotepad
// ---------------------------------------------------------------------------

/**
 * Parse `.omc/notepad.md` and return the three sections as structured data.
 * Returns all-empty strings if the file does not exist.
 */
export async function readNotepad(worktreePath: string): Promise<NotepadContent> {
  const notepadPath = join(worktreePath, ".omc", "notepad.md");
  let raw: string;
  try {
    raw = await readFile(notepadPath, "utf-8");
  } catch {
    return { priority: "", working: "", manual: "" };
  }
  return parseSections(raw);
}

// ---------------------------------------------------------------------------
// writeNotepadSection
// ---------------------------------------------------------------------------

/**
 * Replace only the specified section's content while preserving the other
 * two sections. Uses a temp-file-then-rename pattern for atomic writes.
 */
export async function writeNotepadSection(
  worktreePath: string,
  section: NotepadSection,
  content: string,
): Promise<void> {
  const notepadPath = join(worktreePath, ".omc", "notepad.md");

  // Read existing notepad or use empty template
  let current: NotepadContent;
  try {
    const raw = await readFile(notepadPath, "utf-8");
    current = parseSections(raw);
  } catch {
    current = { priority: "", working: "", manual: "" };
  }

  // Update the target section
  current[section] = content;

  // Reconstruct the full notepad
  const full = reconstructNotepad(current);

  // Ensure .omc/ directory exists
  await mkdir(join(worktreePath, ".omc"), { recursive: true });

  // Atomic write: temp file then rename (clean up .tmp on rename failure)
  const tmpPath = notepadPath + ".tmp";
  await writeFile(tmpPath, full, "utf-8");
  try {
    await rename(tmpPath, notepadPath);
  } catch (err) {
    // Clean up orphaned temp file before re-throwing
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // Best effort — temp file may already be gone
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPrioritySection(context: StoryContext): string[] {
  const lines: string[] = [];
  if (context.storyId) {
    lines.push(`Story: ${context.storyId}`);
  }
  if (context.storyTitle) {
    lines.push(`Title: ${context.storyTitle}`);
  }
  if (context.acceptanceCriteria && context.acceptanceCriteria.length > 0) {
    lines.push("Acceptance Criteria:");
    for (const ac of context.acceptanceCriteria) {
      lines.push(`- ${ac}`);
    }
  }
  if (context.relevantFiles && context.relevantFiles.length > 0) {
    lines.push("Relevant Files:");
    for (const f of context.relevantFiles) {
      lines.push(`- ${f}`);
    }
  }
  if (context.dependencies && context.dependencies.length > 0) {
    lines.push("Dependencies:");
    for (const d of context.dependencies) {
      lines.push(`- ${d}`);
    }
  }
  return lines;
}

function buildWorkingSection(sprintContext?: SprintContext): string[] {
  const lines: string[] = [];
  if (sprintContext?.sprintName) {
    lines.push(`Sprint: ${sprintContext.sprintName}`);
  }
  if (sprintContext?.epicId) {
    lines.push(`Epic: ${sprintContext.epicId}`);
  }
  if (sprintContext?.relatedCompletedStories && sprintContext.relatedCompletedStories.length > 0) {
    lines.push("Related Completed Stories:");
    for (const s of sprintContext.relatedCompletedStories) {
      lines.push(`- ${s}`);
    }
  }
  return lines;
}

/**
 * Parse the three sections from a notepad markdown string.
 * Uses line-anchored matching to avoid false positives from content
 * that happens to contain section header strings.
 */
function parseSections(raw: string): NotepadContent {
  const result: NotepadContent = { priority: "", working: "", manual: "" };

  // Find the start index of each section header (line-anchored to avoid mid-content matches)
  const indices: Map<NotepadSection, number> = new Map();
  for (const section of SECTION_ORDER) {
    const header = SECTION_HEADERS[section];
    // Match header at start of a line (preceded by \n or start of string)
    const pattern = new RegExp(`(?:^|\\n)(${escapeRegex(header)})`, "g");
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      const headerStart = match.index + (match[0].length - match[1].length);
      indices.set(section, headerStart + header.length);
      break; // Use first match only
    }
  }

  // Extract content between consecutive section headers
  for (let i = 0; i < SECTION_ORDER.length; i++) {
    const section = SECTION_ORDER[i];
    const start = indices.get(section);
    if (start === undefined) continue;

    // Find end — either the next section header (line-anchored) or end of file
    let end = raw.length;
    for (let j = i + 1; j < SECTION_ORDER.length; j++) {
      const nextHeader = SECTION_HEADERS[SECTION_ORDER[j]];
      const nextPattern = new RegExp(`\\n${escapeRegex(nextHeader)}`, "g");
      nextPattern.lastIndex = start;
      const nextMatch = nextPattern.exec(raw);
      if (nextMatch) {
        end = nextMatch.index;
        break;
      }
    }

    const sectionContent = raw.slice(start, end).trim();
    result[section] = sectionContent;
  }

  return result;
}

/**
 * Reconstruct the full notepad markdown from structured content.
 */
function reconstructNotepad(content: NotepadContent): string {
  const parts: string[] = [];
  for (const section of SECTION_ORDER) {
    parts.push(SECTION_HEADERS[section]);
    parts.push("");
    const text = content[section].trim();
    if (text) {
      parts.push(text);
    }
    parts.push("");
  }
  return parts.join("\n");
}
