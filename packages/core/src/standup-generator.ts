/**
 * Standup summary generator — meeting prep (Story 45.5).
 *
 * Pure function. Produces Slack/Teams-friendly markdown summary
 * from sprint data for daily standup meetings.
 */

/** Input data for standup generation. */
export interface StandupInput {
  /** Stories completed in the time window. */
  completedStories: string[];
  /** Stories currently in progress. */
  inProgressStories: string[];
  /** Blocked story IDs. */
  blockers: string[];
  /** Currently active agent IDs. */
  activeAgents: string[];
  /** Time window in hours (default: 24). */
  timeWindowHours: number;
}

/** A section in the standup output. */
export interface StandupSection {
  title: string;
  items: string[];
}

/** Standup summary output. */
export interface StandupSummary {
  title: string;
  generatedAt: string;
  hasActivity: boolean;
  sections: StandupSection[];
  markdown: string;
}

/**
 * Generate a standup summary from sprint data.
 * Pure function — no I/O, no side effects.
 */
export function generateStandup(input: StandupInput): StandupSummary {
  const now = new Date();
  const generatedAt = now.toISOString();
  // Local date for display (not UTC)
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;

  const hasActivity =
    input.completedStories.length > 0 ||
    input.inProgressStories.length > 0 ||
    input.blockers.length > 0 ||
    input.activeAgents.length > 0;

  if (!hasActivity) {
    return {
      title: `Daily Standup — ${dateStr}`,
      generatedAt,
      hasActivity: false,
      sections: [],
      markdown: `**Daily Standup — ${dateStr}**\n\nNo activity to report.`,
    };
  }

  const sections: StandupSection[] = [];

  // Completed
  sections.push({
    title: "Completed",
    items: input.completedStories.length > 0 ? input.completedStories : ["None"],
  });

  // In Progress
  sections.push({
    title: "In Progress",
    items: input.inProgressStories.length > 0 ? input.inProgressStories : ["None"],
  });

  // Blockers
  sections.push({
    title: "Blockers",
    items: input.blockers.length > 0 ? input.blockers : ["None"],
  });

  // Build Slack/Teams-friendly markdown
  const lines: string[] = [];
  const windowLabel = input.timeWindowHours === 24 ? "" : ` (last ${input.timeWindowHours}h)`;
  lines.push(`**Daily Standup — ${dateStr}${windowLabel}**`);
  lines.push("");

  for (const section of sections) {
    lines.push(`**${section.title}:**`);
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push(`**Active Agents:** ${input.activeAgents.length}`);

  return {
    title: `Daily Standup — ${dateStr}`,
    generatedAt,
    hasActivity: true,
    sections,
    markdown: lines.join("\n"),
  };
}
