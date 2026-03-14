/**
 * Workflow Dashboard types — frozen API contract (WD-4).
 *
 * These types define the WorkflowResponse interface returned by
 * GET /api/workflow/[project]. Changes to WorkflowResponse are
 * breaking changes after PR 1 merges.
 */

export const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;

export type Phase = (typeof PHASES)[number];

export type PhaseState = "not-started" | "done" | "active";

export interface PhaseEntry {
  id: Phase;
  label: string;
  state: PhaseState;
}

export interface ArtifactRule {
  /** Glob-like pattern matched against filename (case-insensitive). */
  pattern: string;
  phase: Phase;
  /** Human-readable type for UI display. */
  type: string;
}

export interface ScannedFile {
  filename: string;
  /** Relative path from project root. */
  path: string;
  /** ISO 8601 timestamp. */
  modifiedAt: string;
}

export interface ClassifiedArtifact extends ScannedFile {
  phase: Phase | null;
  type: string;
}

export interface AgentInfo {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  role: string;
}

export interface Recommendation {
  tier: 1 | 2;
  observation: string;
  implication: string;
  phase: Phase;
}

export interface WorkflowResponse {
  projectId: string;
  projectName: string;
  hasBmad: boolean;
  phases: PhaseEntry[];
  agents: AgentInfo[] | null;
  recommendation: Recommendation | null;
  artifacts: ClassifiedArtifact[];
  lastActivity: {
    filename: string;
    phase: string;
    modifiedAt: string;
  } | null;
}

export const PHASE_LABELS: Record<Phase, string> = {
  analysis: "Analysis",
  planning: "Planning",
  solutioning: "Solutioning",
  implementation: "Implementation",
};
