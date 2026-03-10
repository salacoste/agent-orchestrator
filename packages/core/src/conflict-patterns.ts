/**
 * Conflict Pattern Analysis Service
 *
 * Analyzes conflict history to identify patterns, systemic causes,
 * and generate prevention recommendations.
 *
 * Features:
 * - Track conflict frequency by story, agent, and time
 * - Identify systemic conflict causes (resource contention, timing issues, etc.)
 * - Generate prevention recommendations based on patterns
 * - Provide trend data for dashboard visualization
 */

import type { AuditTrail, ConflictHistoryEntry } from "./types.js";

/** Conflict pattern types */
export type ConflictPatternType =
  | "resource_contention" // Multiple agents trying to access same story
  | "timing_issue" // Conflicts occurring at specific times (e.g., sprint start)
  | "agent_pairing" // Specific agent pairs frequently conflicting
  | "story_hotspot" // Specific stories attracting multiple agents
  | "workload_imbalance" // Some agents overloaded while others idle
  | "priority_confusion" // Conflicting priority interpretations
  | "stale_assignment"; // Old assignments not cleaned up

/** Conflict frequency metrics */
export interface ConflictFrequency {
  /** Total conflicts in period */
  total: number;
  /** Conflicts by story ID */
  byStory: Map<string, number>;
  /** Conflicts by agent ID */
  byAgent: Map<string, number>;
  /** Conflicts by agent pair */
  byAgentPair: Map<string, number>;
  /** Conflicts by day of week (0-6) */
  byDayOfWeek: number[];
  /** Conflicts by hour of day (0-23) */
  byHourOfDay: number[];
}

/** Detected conflict pattern */
export interface ConflictPattern {
  /** Pattern type */
  type: ConflictPatternType;
  /** Pattern severity (0-1) */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Affected entities */
  affectedEntities: string[];
  /** Frequency of this pattern */
  frequency: number;
  /** When pattern was first detected */
  firstDetected: string;
  /** When pattern was last seen */
  lastSeen: string;
  /** Supporting evidence */
  evidence: PatternEvidence[];
}

/** Evidence supporting a pattern detection */
export interface PatternEvidence {
  /** Conflict entry reference */
  conflictId: string;
  /** Description of how this supports the pattern */
  reason: string;
  /** Timestamp of the evidence */
  timestamp: string;
}

/** Prevention recommendation */
export interface PreventionRecommendation {
  /** Recommendation ID */
  id: string;
  /** Pattern this addresses */
  patternType: ConflictPatternType;
  /** Priority (1-5, 1 being highest) */
  priority: number;
  /** Title of the recommendation */
  title: string;
  /** Detailed description */
  description: string;
  /** Suggested actions */
  actions: string[];
  /** Expected impact */
  expectedImpact: string;
  /** Implementation effort (low, medium, high) */
  effort: "low" | "medium" | "high";
}

/** Trend data point for visualization */
export interface TrendDataPoint {
  /** Timestamp */
  timestamp: string;
  /** Number of conflicts */
  conflicts: number;
  /** Number of resolutions */
  resolutions: number;
  /** Average resolution time in ms */
  avgResolutionTimeMs: number;
}

/** Conflict pattern analysis configuration */
export interface ConflictPatternConfig {
  /** Audit trail to query for conflict history */
  auditTrail: AuditTrail;
  /** Minimum occurrences to consider a pattern (default: 3) */
  minPatternOccurrences?: number;
  /** Days to look back for analysis (default: 30) */
  analysisWindowDays?: number;
  /** Enable trend tracking (default: true) */
  enableTrends?: boolean;
}

/** Conflict pattern analysis service interface */
export interface ConflictPatternAnalysis {
  /** Analyze conflict history and detect patterns */
  analyzePatterns(since?: Date, until?: Date): Promise<ConflictPattern[]>;

  /** Get conflict frequency metrics */
  getFrequencyMetrics(since?: Date, until?: Date): Promise<ConflictFrequency>;

  /** Generate prevention recommendations based on patterns */
  generateRecommendations(patterns: ConflictPattern[]): PreventionRecommendation[];

  /** Get trend data for dashboard visualization */
  getTrendData(days: number): Promise<TrendDataPoint[]>;

  /** Get most problematic stories */
  getHotspotStories(
    limit?: number,
  ): Promise<Array<{ storyId: string; conflictCount: number; pattern: string }>>;

  /** Get agents with most conflicts */
  getConflictingAgents(
    limit?: number,
  ): Promise<Array<{ agentId: string; conflictCount: number; winRate: number }>>;
}

/**
 * Create conflict pattern analysis service
 */
export function createConflictPatternAnalysis(
  config: ConflictPatternConfig,
): ConflictPatternAnalysis {
  const minOccurrences = config.minPatternOccurrences ?? 3;
  const analysisWindowDays = config.analysisWindowDays ?? 30;
  const enableTrends = config.enableTrends ?? true;

  /**
   * Analyze conflict history and detect patterns
   */
  async function analyzePatterns(since?: Date, until?: Date): Promise<ConflictPattern[]> {
    const patterns: ConflictPattern[] = [];
    const startDate = since ?? new Date(Date.now() - analysisWindowDays * 24 * 60 * 60 * 1000);
    const endDate = until ?? new Date();

    // Query conflict history
    const conflicts = config.auditTrail.queryConflicts({
      since: startDate,
      until: endDate,
      includeArchived: true,
    });

    if (conflicts.length < minOccurrences) {
      return patterns; // Not enough data to detect patterns
    }

    // Detect each pattern type
    const resourceContention = detectResourceContention(conflicts);
    if (resourceContention) patterns.push(resourceContention);

    const timingIssue = detectTimingIssue(conflicts);
    if (timingIssue) patterns.push(timingIssue);

    const agentPairing = detectAgentPairing(conflicts, minOccurrences);
    patterns.push(...agentPairing);

    const storyHotspot = detectStoryHotspot(conflicts, minOccurrences);
    patterns.push(...storyHotspot);

    const workloadImbalance = detectWorkloadImbalance(conflicts);
    if (workloadImbalance) patterns.push(workloadImbalance);

    const priorityConfusion = detectPriorityConfusion(conflicts);
    if (priorityConfusion) patterns.push(priorityConfusion);

    const staleAssignment = detectStaleAssignment(conflicts);
    if (staleAssignment) patterns.push(staleAssignment);

    // Sort by severity
    patterns.sort((a, b) => b.severity - a.severity);

    return patterns;
  }

  /**
   * Detect resource contention pattern
   */
  function detectResourceContention(conflicts: ConflictHistoryEntry[]): ConflictPattern | null {
    // Check if multiple agents frequently conflict on same story
    const storyConflicts = new Map<string, Set<string>>();

    for (const conflict of conflicts) {
      const storyId = conflict.storyId;
      if (!storyId) continue;

      const agents = storyConflicts.get(storyId) ?? new Set<string>();
      for (const agent of conflict.conflictingAgents) {
        agents.add(agent);
      }
      storyConflicts.set(storyId, agents);
    }

    // Find stories with 3+ conflicting agents
    const highContentionStories: string[] = [];
    for (const [storyId, agents] of storyConflicts.entries()) {
      if (agents.size >= 3) {
        highContentionStories.push(storyId);
      }
    }

    if (highContentionStories.length === 0) {
      return null;
    }

    return {
      type: "resource_contention",
      severity: Math.min(highContentionStories.length / 5, 1),
      description: `${highContentionStories.length} stories with 3+ conflicting agents detected`,
      affectedEntities: highContentionStories,
      frequency: highContentionStories.length,
      firstDetected: conflicts[0]?.event.timestamp ?? new Date().toISOString(),
      lastSeen: conflicts[conflicts.length - 1]?.event.timestamp ?? new Date().toISOString(),
      evidence: highContentionStories.slice(0, 3).map((storyId) => ({
        conflictId: `resource-contention-${storyId}`,
        reason: `Story ${storyId} has multiple conflicting agents`,
        timestamp: new Date().toISOString(),
      })),
    };
  }

  /**
   * Detect timing issue pattern
   */
  function detectTimingIssue(conflicts: ConflictHistoryEntry[]): ConflictPattern | null {
    // Check for conflicts clustered at specific times
    const hourlyDistribution = new Array(24).fill(0);

    for (const conflict of conflicts) {
      const hour = new Date(conflict.event.timestamp).getHours();
      hourlyDistribution[hour]++;
    }

    // Find peak hours
    const avgConflicts = conflicts.length / 24;
    const peakHours: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyDistribution[hour] > avgConflicts * 2) {
        peakHours.push(hour);
      }
    }

    if (peakHours.length === 0) {
      return null;
    }

    return {
      type: "timing_issue",
      severity: Math.min(peakHours.length / 6, 1),
      description: `Conflicts clustered at hours: ${peakHours.map((h) => `${h}:00`).join(", ")}`,
      affectedEntities: peakHours.map((h) => `hour-${h}`),
      frequency: peakHours.reduce((sum, h) => sum + hourlyDistribution[h], 0),
      firstDetected: conflicts[0]?.event.timestamp ?? new Date().toISOString(),
      lastSeen: conflicts[conflicts.length - 1]?.event.timestamp ?? new Date().toISOString(),
      evidence: peakHours.slice(0, 3).map((hour) => ({
        conflictId: `timing-issue-${hour}`,
        reason: `Hour ${hour}:00 has ${hourlyDistribution[hour]} conflicts (avg: ${avgConflicts.toFixed(1)})`,
        timestamp: new Date().toISOString(),
      })),
    };
  }

  /**
   * Detect agent pairing patterns
   */
  function detectAgentPairing(
    conflicts: ConflictHistoryEntry[],
    minOccurrences: number,
  ): ConflictPattern[] {
    const pairCounts = new Map<string, { count: number; conflicts: ConflictHistoryEntry[] }>();

    for (const conflict of conflicts) {
      const agents = [...conflict.conflictingAgents].sort();
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const pairKey = `${agents[i]}|${agents[j]}`;
          const entry = pairCounts.get(pairKey) ?? { count: 0, conflicts: [] };
          entry.count++;
          entry.conflicts.push(conflict);
          pairCounts.set(pairKey, entry);
        }
      }
    }

    const patterns: ConflictPattern[] = [];
    for (const [pairKey, entry] of pairCounts.entries()) {
      if (entry.count >= minOccurrences) {
        const [agent1, agent2] = pairKey.split("|");
        patterns.push({
          type: "agent_pairing",
          severity: Math.min(entry.count / 10, 1),
          description: `Agents ${agent1} and ${agent2} conflicted ${entry.count} times`,
          affectedEntities: [agent1, agent2],
          frequency: entry.count,
          firstDetected: entry.conflicts[0]?.event.timestamp ?? new Date().toISOString(),
          lastSeen:
            entry.conflicts[entry.conflicts.length - 1]?.event.timestamp ??
            new Date().toISOString(),
          evidence: entry.conflicts.slice(0, 3).map((c) => ({
            conflictId: c.conflictId,
            reason: `Conflict on story ${c.storyId}`,
            timestamp: c.event.timestamp,
          })),
        });
      }
    }

    return patterns.sort((a, b) => b.severity - a.severity).slice(0, 5);
  }

  /**
   * Detect story hotspot patterns
   */
  function detectStoryHotspot(
    conflicts: ConflictHistoryEntry[],
    minOccurrences: number,
  ): ConflictPattern[] {
    const storyCounts = new Map<string, { count: number; conflicts: ConflictHistoryEntry[] }>();

    for (const conflict of conflicts) {
      const storyId = conflict.storyId;
      if (!storyId) continue;

      const entry = storyCounts.get(storyId) ?? { count: 0, conflicts: [] };
      entry.count++;
      entry.conflicts.push(conflict);
      storyCounts.set(storyId, entry);
    }

    const patterns: ConflictPattern[] = [];
    for (const [storyId, entry] of storyCounts.entries()) {
      if (entry.count >= minOccurrences) {
        patterns.push({
          type: "story_hotspot",
          severity: Math.min(entry.count / 5, 1),
          description: `Story ${storyId} had ${entry.count} conflicts`,
          affectedEntities: [storyId],
          frequency: entry.count,
          firstDetected: entry.conflicts[0]?.event.timestamp ?? new Date().toISOString(),
          lastSeen:
            entry.conflicts[entry.conflicts.length - 1]?.event.timestamp ??
            new Date().toISOString(),
          evidence: entry.conflicts.slice(0, 3).map((c) => ({
            conflictId: c.conflictId,
            reason: `Conflict with agents: ${c.conflictingAgents.join(", ")}`,
            timestamp: c.event.timestamp,
          })),
        });
      }
    }

    return patterns.sort((a, b) => b.severity - a.severity).slice(0, 5);
  }

  /**
   * Detect workload imbalance pattern
   */
  function detectWorkloadImbalance(conflicts: ConflictHistoryEntry[]): ConflictPattern | null {
    const agentCounts = new Map<string, number>();

    for (const conflict of conflicts) {
      for (const agent of conflict.conflictingAgents) {
        agentCounts.set(agent, (agentCounts.get(agent) ?? 0) + 1);
      }
    }

    if (agentCounts.size < 3) {
      return null;
    }

    const counts = Array.from(agentCounts.values()).sort((a, b) => b - a);
    const topCount = counts[0];
    const avgCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;

    // Check if top agent has 3x more conflicts than average
    if (topCount < avgCount * 3) {
      return null;
    }

    const topAgents = Array.from(agentCounts.entries())
      .filter(([, count]) => count === topCount)
      .map(([agent]) => agent);

    return {
      type: "workload_imbalance",
      severity: Math.min(topCount / (avgCount * 5), 1),
      description: `Agent(s) ${topAgents.join(", ")} have ${topCount} conflicts vs average ${avgCount.toFixed(1)}`,
      affectedEntities: topAgents,
      frequency: topCount,
      firstDetected: conflicts[0]?.event.timestamp ?? new Date().toISOString(),
      lastSeen: conflicts[conflicts.length - 1]?.event.timestamp ?? new Date().toISOString(),
      evidence: topAgents.map((agent) => ({
        conflictId: `workload-imbalance-${agent}`,
        reason: `Agent has ${topCount} conflicts (avg: ${avgCount.toFixed(1)})`,
        timestamp: new Date().toISOString(),
      })),
    };
  }

  /**
   * Detect priority confusion pattern
   */
  function detectPriorityConfusion(conflicts: ConflictHistoryEntry[]): ConflictPattern | null {
    // Check for conflicts where resolution strategy was priority-based
    // but there was disagreement
    const priorityConflicts = conflicts.filter(
      (c) =>
        c.resolution?.strategy === "priority" ||
        c.event.metadata?.resolutionStrategy === "priority",
    );

    if (priorityConflicts.length < minOccurrences) {
      return null;
    }

    return {
      type: "priority_confusion",
      severity: Math.min(priorityConflicts.length / 10, 1),
      description: `${priorityConflicts.length} conflicts resolved by priority (indicates unclear priorities)`,
      affectedEntities: Array.from(new Set(priorityConflicts.flatMap((c) => c.conflictingAgents))),
      frequency: priorityConflicts.length,
      firstDetected: priorityConflicts[0]?.event.timestamp ?? new Date().toISOString(),
      lastSeen:
        priorityConflicts[priorityConflicts.length - 1]?.event.timestamp ??
        new Date().toISOString(),
      evidence: priorityConflicts.slice(0, 3).map((c) => ({
        conflictId: c.conflictId,
        reason: `Priority-based resolution on story ${c.storyId}`,
        timestamp: c.event.timestamp,
      })),
    };
  }

  /**
   * Detect stale assignment pattern
   */
  function detectStaleAssignment(conflicts: ConflictHistoryEntry[]): ConflictPattern | null {
    // Check for conflicts involving long-running assignments
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const staleConflicts = conflicts.filter((c) => {
      const eventTime = new Date(c.event.timestamp).getTime();
      const resolutionTime = c.resolution?.timestamp
        ? new Date(c.resolution.timestamp).getTime()
        : eventTime;
      return resolutionTime - eventTime > staleThreshold;
    });

    if (staleConflicts.length < minOccurrences) {
      return null;
    }

    return {
      type: "stale_assignment",
      severity: Math.min(staleConflicts.length / 5, 1),
      description: `${staleConflicts.length} conflicts with assignments > 24 hours old`,
      affectedEntities: Array.from(new Set(staleConflicts.flatMap((c) => c.conflictingAgents))),
      frequency: staleConflicts.length,
      firstDetected: staleConflicts[0]?.event.timestamp ?? new Date().toISOString(),
      lastSeen:
        staleConflicts[staleConflicts.length - 1]?.event.timestamp ?? new Date().toISOString(),
      evidence: staleConflicts.slice(0, 3).map((c) => ({
        conflictId: c.conflictId,
        reason: `Long-running conflict on story ${c.storyId}`,
        timestamp: c.event.timestamp,
      })),
    };
  }

  /**
   * Get conflict frequency metrics
   */
  async function getFrequencyMetrics(since?: Date, until?: Date): Promise<ConflictFrequency> {
    const startDate = since ?? new Date(Date.now() - analysisWindowDays * 24 * 60 * 60 * 1000);
    const endDate = until ?? new Date();

    const conflicts = config.auditTrail.queryConflicts({
      since: startDate,
      until: endDate,
      includeArchived: true,
    });

    const byStory = new Map<string, number>();
    const byAgent = new Map<string, number>();
    const byAgentPair = new Map<string, number>();
    const byDayOfWeek = new Array(7).fill(0);
    const byHourOfDay = new Array(24).fill(0);

    for (const conflict of conflicts) {
      // By story
      if (conflict.storyId) {
        byStory.set(conflict.storyId, (byStory.get(conflict.storyId) ?? 0) + 1);
      }

      // By agent
      for (const agent of conflict.conflictingAgents) {
        byAgent.set(agent, (byAgent.get(agent) ?? 0) + 1);
      }

      // By agent pair
      const agents = [...conflict.conflictingAgents].sort();
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const pairKey = `${agents[i]}|${agents[j]}`;
          byAgentPair.set(pairKey, (byAgentPair.get(pairKey) ?? 0) + 1);
        }
      }

      // By time
      const date = new Date(conflict.event.timestamp);
      byDayOfWeek[date.getDay()]++;
      byHourOfDay[date.getHours()]++;
    }

    return {
      total: conflicts.length,
      byStory,
      byAgent,
      byAgentPair,
      byDayOfWeek,
      byHourOfDay,
    };
  }

  /**
   * Generate prevention recommendations based on patterns
   */
  function generateRecommendations(patterns: ConflictPattern[]): PreventionRecommendation[] {
    const recommendations: PreventionRecommendation[] = [];

    for (const pattern of patterns) {
      const recs = getRecommendationsForPattern(pattern);
      recommendations.push(...recs);
    }

    // Sort by priority and effort
    recommendations.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const effortOrder = { low: 0, medium: 1, high: 2 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });

    return recommendations;
  }

  /**
   * Get recommendations for a specific pattern
   */
  function getRecommendationsForPattern(pattern: ConflictPattern): PreventionRecommendation[] {
    const recommendations: PreventionRecommendation[] = [];

    switch (pattern.type) {
      case "resource_contention":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 1,
          title: "Implement Story Locking",
          description:
            "Add exclusive locks on stories when agents start work to prevent concurrent access",
          actions: [
            "Implement story lock acquisition in spawn command",
            "Add lock timeout configuration",
            "Create lock release on completion/failure",
          ],
          expectedImpact: "Reduce resource contention conflicts by 80-90%",
          effort: "medium",
        });
        recommendations.push({
          id: `rec-${pattern.type}-2`,
          patternType: pattern.type,
          priority: 2,
          title: "Improve Visibility",
          description: "Show real-time story assignments to prevent duplicate work",
          actions: [
            "Add 'ao fleet' command to show all active assignments",
            "Display warning when starting on already-assigned story",
          ],
          expectedImpact: "Reduce accidental conflicts by 50%",
          effort: "low",
        });
        break;

      case "timing_issue":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 2,
          title: "Stagger Agent Starts",
          description: "Add random delay to agent startup to avoid clustering",
          actions: [
            "Add startupDelayMs configuration option",
            "Implement random jitter within delay window",
          ],
          expectedImpact: "Distribute conflicts more evenly across time",
          effort: "low",
        });
        break;

      case "agent_pairing":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 3,
          title: "Review Agent Specializations",
          description:
            "Consider if frequently conflicting agents should have different specialization areas",
          actions: [
            `Review work patterns for: ${pattern.affectedEntities.join(", ")}`,
            "Consider adding skill-based story routing",
            "Implement agent workload balancing",
          ],
          expectedImpact: "Reduce pairing conflicts by 60-70%",
          effort: "medium",
        });
        break;

      case "story_hotspot":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 1,
          title: "Break Down Large Stories",
          description:
            "Stories with many conflicts may be too large or ambiguous - consider decomposition",
          actions: [
            `Review and decompose stories: ${pattern.affectedEntities.join(", ")}`,
            "Add clearer acceptance criteria",
            "Consider story dependencies",
          ],
          expectedImpact: "Reduce hotspot conflicts by 50-60%",
          effort: "medium",
        });
        break;

      case "workload_imbalance":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 2,
          title: "Implement Load Balancing",
          description: "Distribute work more evenly across available agents",
          actions: [
            "Add agent workload tracking",
            "Implement least-busy routing for new stories",
            "Add max concurrent stories per agent limit",
          ],
          expectedImpact: "Balance workload and reduce overload conflicts",
          effort: "medium",
        });
        break;

      case "priority_confusion":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 1,
          title: "Clarify Priority System",
          description: "Ensure priority levels are clearly defined and understood",
          actions: [
            "Document priority level meanings",
            "Add priority validation on story creation",
            "Implement priority-based story routing",
          ],
          expectedImpact: "Reduce priority-based conflicts by 70%",
          effort: "low",
        });
        break;

      case "stale_assignment":
        recommendations.push({
          id: `rec-${pattern.type}-1`,
          patternType: pattern.type,
          priority: 2,
          title: "Implement Assignment Timeout",
          description: "Automatically release stale assignments after timeout period",
          actions: [
            "Add assignment timeout configuration",
            "Implement background cleanup job",
            "Send notifications before timeout",
          ],
          expectedImpact: "Reduce stale assignment conflicts by 80%",
          effort: "medium",
        });
        break;
    }

    return recommendations;
  }

  /**
   * Get trend data for dashboard visualization
   */
  async function getTrendData(days: number): Promise<TrendDataPoint[]> {
    if (!enableTrends) {
      return [];
    }

    const trendData: TrendDataPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayConflicts = config.auditTrail.queryConflicts({
        since: dayStart,
        until: dayEnd,
        includeArchived: true,
      });

      const resolutions = dayConflicts.filter((c) => c.resolution);
      const avgResolutionTimeMs =
        resolutions.length > 0
          ? resolutions.reduce((sum, c) => {
              const detected = new Date(c.event.timestamp).getTime();
              const resolved = new Date(c.resolution!.timestamp).getTime();
              return sum + (resolved - detected);
            }, 0) / resolutions.length
          : 0;

      trendData.push({
        timestamp: dayStart.toISOString(),
        conflicts: dayConflicts.length,
        resolutions: resolutions.length,
        avgResolutionTimeMs,
      });
    }

    return trendData;
  }

  /**
   * Get most problematic stories
   */
  async function getHotspotStories(
    limit: number = 10,
  ): Promise<Array<{ storyId: string; conflictCount: number; pattern: string }>> {
    const metrics = await getFrequencyMetrics();
    const sortedStories = Array.from(metrics.byStory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sortedStories.map(([storyId, conflictCount]) => ({
      storyId,
      conflictCount,
      pattern: conflictCount >= 5 ? "hotspot" : conflictCount >= 3 ? "elevated" : "normal",
    }));
  }

  /**
   * Get agents with most conflicts
   */
  async function getConflictingAgents(
    limit: number = 10,
  ): Promise<Array<{ agentId: string; conflictCount: number; winRate: number }>> {
    const metrics = await getFrequencyMetrics();
    const conflicts = config.auditTrail.queryConflicts({
      since: new Date(Date.now() - analysisWindowDays * 24 * 60 * 60 * 1000),
      includeArchived: true,
    });

    // Count wins per agent
    const wins = new Map<string, number>();
    for (const conflict of conflicts) {
      if (conflict.resolution?.winner) {
        wins.set(conflict.resolution.winner, (wins.get(conflict.resolution.winner) ?? 0) + 1);
      }
    }

    const sortedAgents = Array.from(metrics.byAgent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sortedAgents.map(([agentId, conflictCount]) => ({
      agentId,
      conflictCount,
      winRate: conflictCount > 0 ? (wins.get(agentId) ?? 0) / conflictCount : 0,
    }));
  }

  return {
    analyzePatterns,
    getFrequencyMetrics,
    generateRecommendations,
    getTrendData,
    getHotspotStories,
    getConflictingAgents,
  };
}
