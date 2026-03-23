/**
 * Post-mortem report generator — pure function (Story 45.3).
 *
 * Analyzes failed/blocked sessions and produces a structured report
 * with timeline, error breakdown, affected files, and recommendations.
 */

import type { SessionLearning } from "./types.js";
import { detectPatterns } from "./learning-patterns.js";

/** Timeline entry for a single failure event. */
export interface PostMortemTimelineEntry {
  timestamp: string;
  storyId: string;
  agentId: string;
  outcome: string;
  errorCategories: string[];
}

/** Error category breakdown. */
export interface ErrorBreakdown {
  category: string;
  count: number;
  affectedStories: string[];
}

/** Post-mortem report. */
export interface PostMortemReport {
  title: string;
  generatedAt: string;
  hasFailures: boolean;
  summary: {
    totalFailures: number;
    totalBlocked: number;
    totalAbandoned: number;
    uniqueStories: number;
    timeRange: { earliest: string; latest: string } | null;
  };
  timeline: PostMortemTimelineEntry[];
  errorBreakdown: ErrorBreakdown[];
  affectedFiles: string[];
  recommendations: string[];
  markdown: string;
}

/**
 * Generate a post-mortem report from session learning data.
 *
 * Pure function — no I/O, no side effects.
 * Input should be pre-filtered to failed/blocked/abandoned sessions.
 */
export function generatePostMortem(sessions: SessionLearning[]): PostMortemReport {
  const now = new Date().toISOString();

  // Filter to non-successful outcomes
  const failures = sessions.filter(
    (s) => s.outcome === "failed" || s.outcome === "blocked" || s.outcome === "abandoned",
  );

  if (failures.length === 0) {
    return {
      title: "Post-Mortem Report — No Failures",
      generatedAt: now,
      hasFailures: false,
      summary: {
        totalFailures: 0,
        totalBlocked: 0,
        totalAbandoned: 0,
        uniqueStories: 0,
        timeRange: null,
      },
      timeline: [],
      errorBreakdown: [],
      affectedFiles: [],
      recommendations: [],
      markdown: "# Post-Mortem Report\n\nNo failures to analyze.",
    };
  }

  // Summary counts
  const totalFailures = failures.filter((s) => s.outcome === "failed").length;
  const totalBlocked = failures.filter((s) => s.outcome === "blocked").length;
  const totalAbandoned = failures.filter((s) => s.outcome === "abandoned").length;
  const uniqueStories = new Set(failures.map((s) => s.storyId)).size;

  // Time range
  const timestamps = failures.map((s) => s.completedAt).sort();
  const timeRange = { earliest: timestamps[0], latest: timestamps[timestamps.length - 1] };

  // Timeline (sorted chronologically)
  const timeline: PostMortemTimelineEntry[] = [...failures]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((s) => ({
      timestamp: s.completedAt,
      storyId: s.storyId,
      agentId: s.agentId,
      outcome: s.outcome,
      errorCategories: s.errorCategories,
    }));

  // Error category breakdown
  const categoryMap = new Map<string, { count: number; stories: Set<string> }>();
  for (const s of failures) {
    for (const cat of s.errorCategories) {
      const existing = categoryMap.get(cat) ?? { count: 0, stories: new Set<string>() };
      existing.count++;
      existing.stories.add(s.storyId);
      categoryMap.set(cat, existing);
    }
  }
  const errorBreakdown: ErrorBreakdown[] = [...categoryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, data]) => ({
      category,
      count: data.count,
      affectedStories: [...data.stories],
    }));

  // Affected files (deduplicated)
  const fileSet = new Set<string>();
  for (const s of failures) {
    for (const f of s.filesModified) fileSet.add(f);
  }
  const affectedFiles = [...fileSet].sort();

  // Recommendations from pattern detection (pass failures, not all sessions)
  const patterns = detectPatterns(failures);
  const recommendations = patterns.map((p) => p.suggestedAction);

  // Fallback recommendations if no patterns detected
  if (recommendations.length === 0) {
    if (totalFailures > 0) recommendations.push("Review error logs for recurring failure causes.");
    if (totalBlocked > 0)
      recommendations.push("Investigate blocked stories for dependency issues.");
    if (affectedFiles.length > 5)
      recommendations.push("Multiple files affected — consider focused code review.");
  }

  // Build markdown
  const lines: string[] = [];
  lines.push("# Post-Mortem Report");
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- **Failures:** ${totalFailures}`);
  lines.push(`- **Blocked:** ${totalBlocked}`);
  lines.push(`- **Abandoned:** ${totalAbandoned}`);
  lines.push(`- **Unique Stories:** ${uniqueStories}`);
  lines.push(`- **Period:** ${timeRange.earliest} — ${timeRange.latest}`);
  lines.push("");

  // Timeline section
  lines.push("## Timeline");
  lines.push("");
  for (const entry of timeline) {
    const cats = entry.errorCategories.length > 0 ? ` [${entry.errorCategories.join(", ")}]` : "";
    lines.push(`- **${entry.timestamp}** — ${entry.storyId} (${entry.outcome})${cats}`);
  }
  lines.push("");

  if (errorBreakdown.length > 0) {
    lines.push("## Error Categories");
    lines.push("");
    for (const e of errorBreakdown) {
      lines.push(`- **${e.category}** (${e.count}x): ${e.affectedStories.join(", ")}`);
    }
    lines.push("");
  }

  // Affected files section
  if (affectedFiles.length > 0) {
    lines.push("## Affected Files");
    lines.push("");
    for (const f of affectedFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

  if (recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const r of recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  return {
    title: `Post-Mortem Report — ${failures.length} issues`,
    generatedAt: now,
    hasFailures: true,
    summary: { totalFailures, totalBlocked, totalAbandoned, uniqueStories, timeRange },
    timeline,
    errorBreakdown,
    affectedFiles,
    recommendations,
    markdown: lines.join("\n"),
  };
}
