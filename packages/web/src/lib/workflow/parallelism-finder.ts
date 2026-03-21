/**
 * Parallelism opportunity finder (Story 20.3).
 *
 * Analyzes story dependencies to identify stories that can run
 * in parallel (no mutual dependencies). Pure module — testable.
 */

/** A story with its dependency information. */
export interface StoryDependency {
  id: string;
  title: string;
  status: string;
  dependencies: string[];
}

/** A parallelism opportunity — a group of independent stories. */
export interface ParallelGroup {
  /** Stories that can run simultaneously. */
  stories: StoryDependency[];
  /** Estimated time savings vs sequential execution. */
  savingsDescription: string;
}

/**
 * Find groups of stories that can run in parallel.
 *
 * Stories with no mutual dependencies (neither depends on the other)
 * can be spawned simultaneously with separate agents.
 *
 * @param stories - All stories with dependency information
 * @returns Parallelism opportunities (groups of independent stories)
 */
export function findParallelOpportunities(stories: StoryDependency[]): ParallelGroup[] {
  // Filter to actionable stories (backlog or ready)
  const actionable = stories.filter((s) => s.status === "backlog" || s.status === "ready-for-dev");

  if (actionable.length < 2) return [];

  // Build dependency sets
  const depSets = new Map<string, Set<string>>();
  for (const story of actionable) {
    depSets.set(story.id, new Set(story.dependencies));
  }

  // Find stories with no dependencies on each other
  const independent: StoryDependency[] = [];
  for (const story of actionable) {
    const deps = depSets.get(story.id);
    if (!deps || deps.size === 0) {
      // Check that no other independent story depends on this one
      const isDepOfOther = actionable.some(
        (other) => other.id !== story.id && depSets.get(other.id)?.has(story.id),
      );
      if (!isDepOfOther) {
        independent.push(story);
      }
    }
  }

  if (independent.length < 2) return [];

  return [
    {
      stories: independent,
      savingsDescription: `${independent.length} stories can run in parallel — spawn ${independent.length} agents simultaneously`,
    },
  ];
}
