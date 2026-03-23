/**
 * Cost & efficiency tracking (Stories 21.1, 21.2, 21.3).
 *
 * Tracks token consumption per agent/story/sprint and computes
 * efficiency scores. Pure module — works with provided data.
 */

/** Token usage record for a session. */
export interface TokenUsage {
  agentId: string;
  storyId?: string;
  tokensUsed: number;
  durationMs: number;
  timestamp: string;
}

/** Agent efficiency score. */
export interface EfficiencyScore {
  agentId: string;
  tokensPerStoryPoint: number;
  totalTokens: number;
  storiesCompleted: number;
  totalStoryPoints: number;
}

/** Sprint cost summary. */
export interface SprintCostSummary {
  totalTokens: number;
  totalAgents: number;
  burnRate: number; // tokens per minute
  projectedCost: number; // estimated remaining tokens
  runawayAgents: string[]; // agents consuming >3x average
}

/** Sprint clock data. */
export interface SprintClock {
  /** Time remaining in sprint (ms). */
  timeRemainingMs: number;
  /** Estimated work remaining (ms). */
  workRemainingMs: number;
  /** Gap: positive = behind, negative = ahead. */
  gapMs: number;
  /** Status indicator. */
  status: "on-track" | "tight" | "behind";
  /** Human-readable description. */
  description: string;
}

/**
 * Compute sprint cost summary from token usage records.
 */
export function computeSprintCost(usages: TokenUsage[]): SprintCostSummary {
  if (usages.length === 0) {
    return {
      totalTokens: 0,
      totalAgents: 0,
      burnRate: 0,
      projectedCost: 0,
      runawayAgents: [],
    };
  }

  const totalTokens = usages.reduce((sum, u) => sum + u.tokensUsed, 0);
  const totalDurationMs = usages.reduce((sum, u) => sum + u.durationMs, 0);
  const agents = new Set(usages.map((u) => u.agentId));
  const burnRate = totalDurationMs > 0 ? (totalTokens / totalDurationMs) * 60000 : 0;

  // Detect runaway agents (>3x average)
  const avgPerAgent = totalTokens / agents.size;
  const agentTotals = new Map<string, number>();
  for (const u of usages) {
    agentTotals.set(u.agentId, (agentTotals.get(u.agentId) ?? 0) + u.tokensUsed);
  }
  const runawayAgents = [...agentTotals.entries()]
    .filter(([, tokens]) => tokens > avgPerAgent * 3)
    .map(([id]) => id);

  return {
    totalTokens,
    totalAgents: agents.size,
    burnRate: Math.round(burnRate),
    projectedCost: 0, // Requires sprint duration info
    runawayAgents,
  };
}

/**
 * Compute efficiency scores for agents.
 */
export function computeEfficiencyScores(
  usages: TokenUsage[],
  storyPoints: Record<string, number>,
): EfficiencyScore[] {
  const agentData = new Map<string, { tokens: number; stories: Set<string>; points: number }>();

  for (const u of usages) {
    const existing = agentData.get(u.agentId) ?? {
      tokens: 0,
      stories: new Set<string>(),
      points: 0,
    };
    existing.tokens += u.tokensUsed;
    if (u.storyId) {
      existing.stories.add(u.storyId);
      existing.points += storyPoints[u.storyId] ?? 0;
    }
    agentData.set(u.agentId, existing);
  }

  return [...agentData.entries()].map(([agentId, data]) => ({
    agentId,
    tokensPerStoryPoint: data.points > 0 ? Math.round(data.tokens / data.points) : 0,
    totalTokens: data.tokens,
    storiesCompleted: data.stories.size,
    totalStoryPoints: data.points,
  }));
}

/**
 * Compute sprint clock — time remaining vs work remaining.
 */
export function computeSprintClock(
  sprintEndDate: Date,
  storiesDone: number,
  storiesTotal: number,
  avgStoryDurationMs: number,
): SprintClock {
  const now = new Date();
  const timeRemainingMs = Math.max(0, sprintEndDate.getTime() - now.getTime());
  const storiesRemaining = storiesTotal - storiesDone;
  const workRemainingMs = storiesRemaining * avgStoryDurationMs;
  const gapMs = workRemainingMs - timeRemainingMs;

  let status: SprintClock["status"];
  if (gapMs <= 0) {
    status = "on-track";
  } else if (gapMs < timeRemainingMs * 0.2) {
    status = "tight";
  } else {
    status = "behind";
  }

  const timeHours = Math.round(timeRemainingMs / 3600000);
  const workHours = Math.round(workRemainingMs / 3600000);
  const gapHours = Math.round(Math.abs(gapMs) / 3600000);

  const description =
    gapMs > 0
      ? `Sprint ends in ${timeHours}h. Remaining work: ${workHours}h. BEHIND by ${gapHours}h`
      : `Sprint ends in ${timeHours}h. Remaining work: ${workHours}h. On track`;

  return { timeRemainingMs, workRemainingMs, gapMs, status, description };
}

// ---------------------------------------------------------------------------
// Sprint Health Score (Story 44.4)
// ---------------------------------------------------------------------------

/** Health score color. */
export type HealthColor = "green" | "amber" | "red";

/** Sprint health score with component breakdown. */
export interface SprintHealth {
  /** Overall score 0-100. */
  score: number;
  /** Color indicator. */
  color: HealthColor;
  /** Component scores (0-1 normalized). */
  components: {
    completion: number;
    blockers: number;
    failures: number;
    cost: number;
  };
}

/**
 * Compute sprint health score — weighted normalized composite (Story 44.4).
 *
 * Weights (party mode decision): completion 0.4, blockers 0.2, failures 0.2, cost 0.2.
 */
export function computeSprintHealth(
  storiesDone: number,
  storiesTotal: number,
  blockerCount: number,
  failureRate: number,
  costBurnRate: number,
  expectedBurnRate: number,
): SprintHealth {
  const total = Math.max(storiesTotal, 1);

  // Normalize each component to 0-1 (higher = healthier)
  const completion = storiesDone / total;
  const blockers = 1 - Math.min(1, blockerCount / total);
  const failures = 1 - Math.min(1, failureRate);
  const cost = expectedBurnRate > 0 ? 1 - Math.min(1, costBurnRate / expectedBurnRate) : 1;

  // Weighted sum
  const score = Math.round((completion * 0.4 + blockers * 0.2 + failures * 0.2 + cost * 0.2) * 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    color: getHealthColor(score),
    components: { completion, blockers, failures, cost },
  };
}

/** Map score to color: green >70, amber 40-70, red <40. */
export function getHealthColor(score: number): HealthColor {
  if (score > 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}
