/**
 * Compound learning system (Stories 30.1-30.4).
 *
 * Cross-sprint pattern detection, failure analysis, recommendation improvement.
 */

/** A detected pattern across sprints. */
export interface SprintPattern {
  id: string;
  description: string;
  frequency: number;
  impact: "high" | "medium" | "low";
  firstSeen: string;
}

/** Failure category from analysis. */
export interface FailureCategory {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
  guidance: string;
}

/**
 * Detect patterns across sprint learning data (Story 30.1).
 */
export function detectCrossSprintPatterns(errorCategories: string[]): SprintPattern[] {
  const counts = new Map<string, number>();
  for (const cat of errorCategories) {
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([category, count]) => ({
      id: `pattern-${category.replace(/\s+/g, "-").toLowerCase()}`,
      description: `"${category}" occurred ${count} times across sprints`,
      frequency: count,
      impact: (count >= 10 ? "high" : count >= 5 ? "medium" : "low") as "high" | "medium" | "low",
      firstSeen: new Date().toISOString(),
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Analyze failures by category (Story 30.2).
 */
export function analyzeFailures(
  errors: Array<{ category: string; file?: string }>,
): FailureCategory[] {
  const counts = new Map<string, { count: number; files: Set<string> }>();
  for (const err of errors) {
    const existing = counts.get(err.category) ?? { count: 0, files: new Set<string>() };
    existing.count++;
    if (err.file) existing.files.add(err.file);
    counts.set(err.category, existing);
  }

  const total = errors.length || 1;
  return [...counts.entries()]
    .map(([category, data]) => ({
      category,
      count: data.count,
      percentage: Math.round((data.count / total) * 100),
      examples: [...data.files].slice(0, 3),
      guidance: `When working on files related to "${category}", pay extra attention to this pattern.`,
    }))
    .sort((a, b) => b.count - a.count);
}
