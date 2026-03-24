/**
 * Reasoning extractor — agent decision logic trail (Story 45.7).
 *
 * Pure function. Extracts decision points from session summary text,
 * learning metadata, and activity patterns.
 */

/** Decision category. */
export type DecisionCategory =
  | "library"
  | "architecture"
  | "testing"
  | "approach"
  | "trade-off"
  | "general";

/** A single reasoning decision. */
export interface ReasoningDecision {
  category: DecisionCategory;
  decision: string;
  rationale: string;
}

/** Reasoning trail output. */
export interface ReasoningTrail {
  agentId: string;
  hasData: boolean;
  decisions: ReasoningDecision[];
}

/** Input for reasoning extraction. */
export interface ReasoningInput {
  agentId: string;
  summary: string | null;
  domainTags: string[];
  errorCategories: string[];
  filesModified: string[];
  retryCount: number;
}

/** Keywords that signal decision-type sentences. */
const DECISION_KEYWORDS = [
  "chose",
  "decided",
  "selected",
  "picked",
  "opted",
  "went with",
  "switched to",
];

/** Keywords that signal rationale. */
const RATIONALE_KEYWORDS = ["because", "since", "due to", "in order to", "so that", "to avoid"];

/** Keywords that signal trade-offs. */
const TRADEOFF_KEYWORDS = ["instead of", "trade-off", "tradeoff", "rather than"];

/** Category inference from keywords. */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: DecisionCategory }> = [
  { pattern: /\b(library|package|dependency|import|npm|pnpm)\b/i, category: "library" },
  { pattern: /\b(architect|structure|pattern|module|layer|service)\b/i, category: "architecture" },
  { pattern: /\b(test|spec|coverage|assert|mock|vitest|jest)\b/i, category: "testing" },
  { pattern: /\b(instead of|trade-?off|rather than|compromise)\b/i, category: "trade-off" },
];

/**
 * Extract reasoning decisions from session data.
 * Pure function — no I/O, no side effects.
 */
export function extractReasoning(input: ReasoningInput): ReasoningTrail {
  const decisions: ReasoningDecision[] = [];

  // 1. Parse summary for decision sentences
  if (input.summary) {
    const sentences = input.summary
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const lower = sentence.toLowerCase();
      const isDecision = DECISION_KEYWORDS.some((kw) => lower.includes(kw));
      const isTradeoff = TRADEOFF_KEYWORDS.some((kw) => lower.includes(kw));

      if (isDecision || isTradeoff) {
        const category = inferCategory(sentence);
        const rationale = extractRationaleAt(sentence, sentences, i);
        decisions.push({
          category,
          decision: sentence,
          rationale: rationale ?? "Inferred from session context",
        });
      }
    }
  }

  // 2. Infer decisions from domain tags
  if (input.domainTags.length > 0) {
    decisions.push({
      category: "approach",
      decision: `Working in domains: ${input.domainTags.join(", ")}`,
      rationale: "Inferred from modified file types",
    });
  }

  // 3. Infer from retry patterns
  if (input.retryCount > 0) {
    decisions.push({
      category: "approach",
      decision: `Adjusted approach after ${input.retryCount} retry attempt${input.retryCount !== 1 ? "s" : ""}`,
      rationale:
        input.errorCategories.length > 0
          ? `Encountered: ${input.errorCategories.join(", ")}`
          : "Previous attempt did not succeed",
    });
  }

  // 4. Infer from file scope
  const testFiles = input.filesModified.filter(
    (f) => f.includes(".test.") || f.includes("__tests__"),
  );
  if (testFiles.length > 0 && input.filesModified.length > 0) {
    const testRatio = testFiles.length / input.filesModified.length;
    if (testRatio >= 0.4) {
      decisions.push({
        category: "testing",
        decision: `Test-focused approach (${testFiles.length}/${input.filesModified.length} files are tests)`,
        rationale: "High test-to-implementation ratio suggests test-driven development",
      });
    }
  }

  return {
    agentId: input.agentId,
    hasData: decisions.length > 0,
    decisions,
  };
}

/** Infer decision category from sentence content. */
function inferCategory(sentence: string): DecisionCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(sentence)) return category;
  }
  return "general";
}

/** Extract rationale from the sentence or neighboring sentences. */
function extractRationaleAt(
  sentence: string,
  allSentences: string[],
  index: number,
): string | null {
  const lower = sentence.toLowerCase();

  // Check if rationale is in the same sentence (after "because", "since", etc.)
  for (const kw of RATIONALE_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      return sentence.slice(idx).trim();
    }
  }

  // Check next sentence for rationale (use index to avoid indexOf duplicate issue)
  if (index < allSentences.length - 1) {
    const next = allSentences[index + 1];
    const nextLower = next.toLowerCase();
    if (RATIONALE_KEYWORDS.some((kw) => nextLower.startsWith(kw))) {
      return next;
    }
  }

  return null;
}
