/**
 * Conflict resolution wizard — AI merge suggestion (Story 47.4).
 *
 * Analyzes 3-way diffs between base, agent A, and agent B versions.
 * AI merge suggestion is a stub — returns null without API key.
 */

/** Conflict analysis result. */
export interface ConflictAnalysis {
  hasConflict: boolean;
  baseLines: number;
  linesChangedA: number;
  linesChangedB: number;
  overlapping: boolean;
  summary: string;
}

/** Resolution option type. */
export type ResolutionOption = "accept-ai" | "choose-a" | "choose-b" | "custom";

/** AI merge suggestion (when available). */
export interface MergeSuggestion {
  merged: string;
  explanation: string;
  confidence: number;
}

/**
 * Analyze a 3-way conflict between base, version A, and version B.
 * Pure function — line-by-line comparison, no external dependencies.
 */
export function analyzeConflict(
  base: string,
  versionA: string,
  versionB: string,
): ConflictAnalysis {
  // Normalize CRLF to LF to prevent false conflicts from line ending differences
  const normBase = base.replace(/\r\n/g, "\n");
  const normA = versionA.replace(/\r\n/g, "\n");
  const normB = versionB.replace(/\r\n/g, "\n");

  const baseLines = normBase.split("\n");
  const aLines = normA.split("\n");
  const bLines = normB.split("\n");

  let changedA = 0;
  let changedB = 0;
  let overlapping = false;

  const maxLen = Math.max(baseLines.length, aLines.length, bLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = baseLines[i] ?? "";
    const aLine = aLines[i] ?? "";
    const bLine = bLines[i] ?? "";

    const aChanged = aLine !== baseLine;
    const bChanged = bLine !== baseLine;

    if (aChanged) changedA++;
    if (bChanged) changedB++;
    if (aChanged && bChanged) overlapping = true;
  }

  const hasConflict = overlapping;

  let summary: string;
  if (!hasConflict && changedA === 0 && changedB === 0) {
    summary = "No changes detected — all versions are identical.";
  } else if (!hasConflict) {
    summary = `No conflict — changes are in different regions. A: ${changedA} lines, B: ${changedB} lines.`;
  } else {
    summary = `Conflict detected — both agents modified overlapping lines. A: ${changedA} lines, B: ${changedB} lines.`;
  }

  return {
    hasConflict,
    baseLines: baseLines.length,
    linesChangedA: changedA,
    linesChangedB: changedB,
    overlapping,
    summary,
  };
}

/**
 * Suggest an AI-assisted merge resolution.
 *
 * Returns null when no API key is provided (graceful degradation).
 * AI integration is a stub — real implementation in future story.
 */
export function suggestMerge(_analysis: ConflictAnalysis, apiKey?: string): MergeSuggestion | null {
  if (!apiKey || !apiKey.trim()) return null;

  // Stub: real AI call would go here.
  // For now, return a placeholder indicating AI is available but not implemented.
  return {
    merged: "",
    explanation: "AI merge suggestion requires Anthropic API integration (future story).",
    confidence: 0,
  };
}

/** Available resolution options based on analysis. */
export function getResolutionOptions(
  analysis: ConflictAnalysis,
  hasSuggestion: boolean,
): ResolutionOption[] {
  const options: ResolutionOption[] = ["choose-a", "choose-b", "custom"];
  if (hasSuggestion && analysis.hasConflict) {
    options.unshift("accept-ai");
  }
  return options;
}
