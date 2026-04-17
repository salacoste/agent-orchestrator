/**
 * Project Memory — typed reader/writer for `.omc/project-memory.json`.
 *
 * Follows the same best-effort pattern as `session-state.ts` and `notepad.ts`:
 * missing files and parse errors produce empty defaults, never throw outward.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectMemory, ProjectMemoryEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns an immutable empty `ProjectMemory`. */
export function emptyProjectMemory(): ProjectMemory {
  return Object.freeze({ entries: [] });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read `.omc/project-memory.json` from the session workspace.
 *
 * Handles both:
 * - **New format**: `{ entries: [...] }`
 * - **Legacy format**: `{ ... }` — any JSON object — wrapped into entries
 *   with `type: "learning"`.
 *
 * Returns `emptyProjectMemory()` on file-not-found or parse error.
 */
export async function readProjectMemory(worktreePath: string): Promise<ProjectMemory> {
  const memoryPath = join(worktreePath, ".omc", "project-memory.json");
  try {
    const raw = await readFile(memoryPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "entries" in parsed &&
      Array.isArray((parsed as ProjectMemory).entries)
    ) {
      return parsed as ProjectMemory;
    }

    // Legacy format — wrap top-level keys as learning entries
    if (typeof parsed === "object" && parsed !== null) {
      const entries: ProjectMemoryEntry[] = [];
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") {
          entries.push({
            id: randomUUID(),
            type: "learning",
            content: `${key}: ${value}`,
          });
        }
      }
      return { entries };
    }

    return emptyProjectMemory();
  } catch {
    return emptyProjectMemory();
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Write `.omc/project-memory.json` using atomic write (temp file + rename).
 *
 * Validates each entry has required `type` and `content` fields before writing.
 * Creates `.omc/` directory if it doesn't exist.
 *
 * @throws {Error} if any entry is missing `type` or `content`.
 */
export async function writeProjectMemory(
  worktreePath: string,
  memory: ProjectMemory,
): Promise<void> {
  for (const entry of memory.entries) {
    if (!entry.type || !entry.content) {
      throw new Error("Invalid entry: each entry must have 'type' and 'content' fields");
    }
  }

  const omcDir = join(worktreePath, ".omc");
  const memoryPath = join(omcDir, "project-memory.json");
  await mkdir(omcDir, { recursive: true });

  const tmpPath = `${memoryPath}.${process.pid}.${randomUUID()}`;
  await writeFile(tmpPath, JSON.stringify(memory, null, 2));
  await rename(tmpPath, memoryPath);
}
