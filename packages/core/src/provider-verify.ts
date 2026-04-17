/**
 * Provider installation verification — post-install artifact checks.
 *
 * After a SessionEnhancementProvider.install() succeeds, this module
 * verifies that the expected filesystem artifacts actually exist.
 * Verification is non-blocking: failures are returned as structured
 * results, never thrown.
 *
 * Epic 59, Story 59-3 (FR-S2-1).
 */

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { InstallationResult } from "./types.js";

/**
 * Verify that a provider was correctly installed in a workspace.
 *
 * Dispatches to provider-specific verification based on the provider name.
 * For the "raw" provider, verification is skipped entirely (no filesystem
 * artifacts). For unknown providers, falls back to a basic `.omc/` check.
 * All exceptions are caught and returned as `{ verified: false }`.
 */
export async function verifyInstallation(
  worktreePath: string,
  providerName: string,
): Promise<InstallationResult> {
  try {
    // Raw provider has no filesystem artifacts — skip verification
    if (providerName === "raw") {
      return { verified: true, missing: [] };
    }

    if (providerName === "omc") {
      return verifyOmcInstallation(worktreePath);
    }

    // Unknown provider — basic check for .omc/ directory
    return verifyBasicInstallation(worktreePath);
  } catch {
    // Verification itself failed (permissions, I/O) — return structured failure
    return { verified: false, missing: [] };
  }
}

/**
 * Verify OMC provider artifacts after install().
 *
 * Checks that the following exist:
 * - `.omc/` directory
 * - `.omc/state/` directory
 * - `.omc/project-memory.json` file (valid JSON)
 *
 * All exceptions are caught and returned as `{ verified: false }`.
 */
export async function verifyOmcInstallation(worktreePath: string): Promise<InstallationResult> {
  try {
    const missing: string[] = [];

    const omcDir = join(worktreePath, ".omc");
    const stateDir = join(omcDir, "state");
    const memoryFile = join(omcDir, "project-memory.json");

    if (!existsSync(omcDir)) {
      missing.push(".omc/");
    }

    // Use statSync to ensure state/ is a directory, not a file
    if (!existsSync(stateDir) || !statSync(stateDir).isDirectory()) {
      missing.push(".omc/state/");
    }

    if (!existsSync(memoryFile)) {
      missing.push(".omc/project-memory.json");
    } else {
      // Validate JSON content — inner try/catch so parse errors add to missing
      // rather than triggering the outer catch (which is for I/O/permission errors)
      try {
        const content = await readFile(memoryFile, "utf-8");
        JSON.parse(content);
      } catch {
        missing.push(".omc/project-memory.json (invalid JSON)");
      }
    }

    return { verified: missing.length === 0, missing };
  } catch {
    // Verification itself failed (permissions, I/O) — return structured failure
    return { verified: false, missing: [] };
  }
}

/**
 * Verify that `.omc/notepad.md` exists after configure().
 *
 * This is a separate check from verifyOmcInstallation because configure()
 * runs after install() and creates different artifacts.
 * All exceptions are caught and returned as `{ verified: false }`.
 */
export async function verifyOmcConfigure(worktreePath: string): Promise<InstallationResult> {
  try {
    const notepadPath = join(worktreePath, ".omc", "notepad.md");

    if (!existsSync(notepadPath)) {
      return { verified: false, missing: [".omc/notepad.md"] };
    }

    return { verified: true, missing: [] };
  } catch {
    // Verification itself failed — return structured failure
    return { verified: false, missing: [] };
  }
}

/**
 * Basic verification for unknown providers.
 *
 * Checks only that the `.omc/` directory exists.
 * All exceptions are caught and returned as `{ verified: false }`.
 */
export async function verifyBasicInstallation(worktreePath: string): Promise<InstallationResult> {
  try {
    const omcDir = join(worktreePath, ".omc");

    if (!existsSync(omcDir)) {
      return { verified: false, missing: [".omc/"] };
    }

    return { verified: true, missing: [] };
  } catch {
    // Verification itself failed — return structured failure
    return { verified: false, missing: [] };
  }
}
