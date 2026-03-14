/**
 * ARTIFACT_RULES — ordered constant mapping filenames to BMAD phases.
 *
 * Rules are evaluated sequentially; first match wins (WD-2).
 * To support new artifact types, add a row here — no logic changes needed.
 */

import type { ArtifactRule, Phase } from "./types.js";

export const ARTIFACT_RULES: readonly ArtifactRule[] = [
  // Analysis phase
  { pattern: "*brief*", phase: "analysis", type: "Product Brief" },
  { pattern: "*research*", phase: "analysis", type: "Research Report" },
  { pattern: "project-context*", phase: "analysis", type: "Project Context" },

  // Planning phase
  { pattern: "*prd*", phase: "planning", type: "PRD" },
  { pattern: "*ux-design*", phase: "planning", type: "UX Design" },
  { pattern: "*ux-spec*", phase: "planning", type: "UX Specification" },

  // Solutioning phase
  { pattern: "*architecture*", phase: "solutioning", type: "Architecture" },
  { pattern: "*epic*", phase: "solutioning", type: "Epics & Stories" },

  // Implementation phase
  { pattern: "*sprint*", phase: "implementation", type: "Sprint Plan" },
] as const;

/**
 * Match a glob-like pattern against a filename (case-insensitive).
 * Supports only `*` as wildcard (matches zero or more characters).
 */
function matchPattern(pattern: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  const parts = pattern.toLowerCase().split("*");

  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "") continue;
    const idx = lower.indexOf(part, pos);
    if (idx === -1) return false;
    // First segment must match at start if pattern doesn't start with *
    if (i === 0 && !pattern.startsWith("*") && idx !== 0) return false;
    pos = idx + part.length;
  }
  // Last segment must match at end if pattern doesn't end with *
  if (!pattern.endsWith("*") && parts[parts.length - 1] !== "") {
    const lastPart = parts[parts.length - 1];
    return lower.endsWith(lastPart);
  }
  return true;
}

/**
 * Classify a single artifact file by matching its filename against ARTIFACT_RULES.
 * First-match-wins semantics.
 *
 * @param filename  The file's basename (e.g. "prd-workflow-dashboard.md")
 * @param sourceDir "planning" or "implementation" — affects default classification
 * @returns `{ phase, type }` — phase is null for unrecognized planning artifacts
 */
export function classifyArtifact(
  filename: string,
  sourceDir: "planning" | "implementation",
): { phase: Phase | null; type: string } {
  for (const rule of ARTIFACT_RULES) {
    if (matchPattern(rule.pattern, filename)) {
      return { phase: rule.phase, type: rule.type };
    }
  }

  // Default classification for unmatched files
  if (sourceDir === "implementation") {
    return { phase: "implementation", type: "Story Spec" };
  }
  return { phase: null, type: "Uncategorized" };
}
