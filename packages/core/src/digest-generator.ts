/**
 * Digest content generator — pure function (Story 44.7).
 *
 * Accepts sprint data and returns formatted digest content.
 * No side effects, no filesystem access, no service dependencies.
 */

/** Input data for digest generation. */
export interface DigestInput {
  /** Stories completed since last digest. */
  completedStories: string[];
  /** Currently active agent session IDs. */
  activeAgents: string[];
  /** Blocked story IDs. */
  blockers: string[];
  /** Total stories in sprint. */
  totalStories: number;
  /** Total done stories. */
  doneStories: number;
  /** Sprint health score (0-100, optional). */
  healthScore?: number;
  /** Stuck story alerts. */
  stuckStories?: string[];
  /** Time range start (ISO 8601). */
  since?: string;
}

/** A section in the digest output. */
export interface DigestSection {
  title: string;
  items: string[];
}

/** Digest content output. */
export interface DigestContent {
  /** Digest title. */
  title: string;
  /** Structured sections. */
  sections: DigestSection[];
  /** Pre-formatted markdown. */
  markdown: string;
  /** Generation metadata. */
  metadata: {
    generatedAt: string;
    since: string | null;
    storiesCompleted: number;
    activeAgents: number;
    blockerCount: number;
    progressPercent: number;
  };
}

/**
 * Generate digest content from sprint data.
 * Pure function — no side effects.
 */
export function generateDigest(input: DigestInput): DigestContent {
  const now = new Date().toISOString();
  const progressPercent =
    input.totalStories > 0 ? Math.round((input.doneStories / input.totalStories) * 100) : 0;

  const sections: DigestSection[] = [];

  // Progress summary
  sections.push({
    title: "Sprint Progress",
    items: [
      `${input.doneStories}/${input.totalStories} stories done (${progressPercent}%)`,
      ...(input.healthScore !== undefined ? [`Health score: ${input.healthScore}/100`] : []),
    ],
  });

  // Completed stories
  sections.push({
    title: "Completed Since Last Digest",
    items:
      input.completedStories.length > 0
        ? input.completedStories
        : ["No stories completed in this period."],
  });

  // Active agents
  sections.push({
    title: "Active Agents",
    items: input.activeAgents.length > 0 ? input.activeAgents : ["No agents currently active."],
  });

  // Blockers
  if (input.blockers.length > 0 || (input.stuckStories && input.stuckStories.length > 0)) {
    const blockerItems = [...input.blockers];
    if (input.stuckStories) {
      blockerItems.push(...input.stuckStories);
    }
    sections.push({
      title: "Blockers & Alerts",
      items: blockerItems,
    });
  }

  // Build markdown
  const lines: string[] = [];
  lines.push(`# Sprint Digest`);
  lines.push("");
  if (input.since) {
    lines.push(`_Period: ${input.since} — ${now}_`);
    lines.push("");
  }

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return {
    title: `Sprint Digest — ${progressPercent}% complete`,
    sections,
    markdown: lines.join("\n"),
    metadata: {
      generatedAt: now,
      since: input.since ?? null,
      storiesCompleted: input.completedStories.length,
      activeAgents: input.activeAgents.length,
      blockerCount: input.blockers.length,
      progressPercent,
    },
  };
}
