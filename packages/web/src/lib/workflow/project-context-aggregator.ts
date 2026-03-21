/**
 * Project context aggregator (Story 23.1).
 *
 * Aggregates artifact graph, sprint status, and agent states into
 * a coherent context document for the conversational interface.
 * Pure module — works with provided data.
 */

import type { ClassifiedArtifact, PhaseEntry } from "./types";

/** Aggregated project context for the chat interface. */
export interface ProjectContext {
  /** Current workflow phase summary. */
  phaseSummary: string;
  /** Artifact inventory summary. */
  artifactSummary: string;
  /** Sprint progress summary. */
  sprintSummary: string;
  /** Active agent summary. */
  agentSummary: string;
  /** Recent events summary. */
  recentEvents: string;
  /** Full context as a single string (for LLM prompt injection). */
  fullContext: string;
  /** Estimated token count. */
  estimatedTokens: number;
}

/** Proactive insight generated from project context. */
export interface ProjectInsight {
  /** Unique insight ID. */
  id: string;
  /** Human-readable insight text. */
  text: string;
  /** Severity: info, warning, or action needed. */
  severity: "info" | "warning" | "action";
  /** Dashboard view to link to when clicked. */
  linkTo?: string;
}

/**
 * Aggregate project data into a context document.
 */
export function aggregateProjectContext(
  phases: PhaseEntry[],
  artifacts: ClassifiedArtifact[],
  storiesDone: number,
  storiesTotal: number,
  activeAgents: number,
): ProjectContext {
  const activePhase = phases.find((p) => p.state === "active");
  const phaseSummary = activePhase
    ? `Current phase: ${activePhase.label} (active). ${phases.filter((p) => p.state === "done").length} phases complete.`
    : phases.every((p) => p.state === "done")
      ? "All phases complete."
      : "No active phase.";

  const artifactSummary = `${artifacts.length} artifacts across ${new Set(artifacts.map((a) => a.phase).filter(Boolean)).size} phases.`;

  const completionPct = storiesTotal > 0 ? Math.round((storiesDone / storiesTotal) * 100) : 0;
  const sprintSummary = `${storiesDone}/${storiesTotal} stories complete (${completionPct}%).`;

  const agentSummary = `${activeAgents} active agent${activeAgents !== 1 ? "s" : ""}.`;

  const recentEvents = ""; // Populated from event log in full implementation

  const fullContext = [
    "## Project Status",
    phaseSummary,
    "",
    "## Artifacts",
    artifactSummary,
    "",
    "## Sprint Progress",
    sprintSummary,
    "",
    "## Agents",
    agentSummary,
  ].join("\n");

  // Rough token estimate: ~4 chars per token
  const estimatedTokens = Math.ceil(fullContext.length / 4);

  return {
    phaseSummary,
    artifactSummary,
    sprintSummary,
    agentSummary,
    recentEvents,
    fullContext,
    estimatedTokens,
  };
}

/**
 * Generate proactive insights from project context.
 */
export function generateInsights(
  storiesDone: number,
  storiesTotal: number,
  blockedCount: number,
  activeAgents: number,
): ProjectInsight[] {
  const insights: ProjectInsight[] = [];

  if (blockedCount > 0) {
    insights.push({
      id: "blocked-stories",
      text: `${blockedCount} ${blockedCount === 1 ? "story is" : "stories are"} blocked and need attention`,
      severity: "action",
      linkTo: "/fleet",
    });
  }

  const completionPct = storiesTotal > 0 ? Math.round((storiesDone / storiesTotal) * 100) : 0;
  if (completionPct < 50 && storiesTotal > 5) {
    insights.push({
      id: "behind-schedule",
      text: `Sprint is ${completionPct}% complete — consider descoping if behind`,
      severity: "warning",
      linkTo: "/workflow",
    });
  }

  if (activeAgents === 0 && storiesDone < storiesTotal) {
    insights.push({
      id: "no-agents",
      text: "No active agents — spawn agents to continue sprint execution",
      severity: "action",
      linkTo: "/fleet",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      text: "Sprint is progressing well. No issues detected.",
      severity: "info",
    });
  }

  return insights;
}
