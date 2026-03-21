/**
 * Workflow Dashboard types — frozen API contract (WD-4).
 *
 * These types define the WorkflowResponse interface returned by
 * GET /api/workflow/[project]. Changes to WorkflowResponse are
 * breaking changes after PR 1 merges.
 *
 * Canonical artifact types (Phase, PhaseState, ArtifactRule, ScannedFile,
 * ClassifiedArtifact) are ALSO defined in @composio/ao-core for use by
 * CLI, plugins, and core services. The definitions here are kept in sync
 * and duplicated to avoid pulling core's full module graph (which includes
 * node:fs) into the Next.js client bundle.
 */

// ---------------------------------------------------------------------------
// Phase & artifact types (duplicated from @composio/ao-core — keep in sync)
// ---------------------------------------------------------------------------

export const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;

export type Phase = (typeof PHASES)[number];

export type PhaseState = "not-started" | "done" | "active";

export const PHASE_LABELS: Record<Phase, string> = {
  analysis: "Analysis",
  planning: "Planning",
  solutioning: "Solutioning",
  implementation: "Implementation",
};

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

// ---------------------------------------------------------------------------
// Web-specific types (not in core)
// ---------------------------------------------------------------------------

export interface PhaseEntry {
  id: Phase;
  label: string;
  state: PhaseState;
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
  /** Human-readable explanation of why this is recommended (Story 17.3). */
  reasoning?: string;
  /** Guard conditions checked, with pass/fail for each (Story 17.3). */
  blockers?: Array<{ guardId: string; description: string; satisfied: boolean }>;
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
    phase: Phase;
    modifiedAt: string;
  } | null;
  /** Per-transition readiness data from state machine (Story 17.4, optional). */
  readiness?: Array<{
    from: string;
    to: string;
    score: number;
    satisfied: Array<{ guardId: string; description: string }>;
    unsatisfied: Array<{ guardId: string; description: string }>;
  }>;
}

// ---------------------------------------------------------------------------
// Workflow State Machine (Story 16.2)
// ---------------------------------------------------------------------------

/** Context provided to guard condition functions for evaluation. */
export interface GuardContext {
  /** Which phases have at least one artifact present. */
  phasePresence: Record<Phase, boolean>;
  /** All classified artifacts in the project. */
  artifacts: ClassifiedArtifact[];
}

/** Result of evaluating a single guard condition. */
export interface GuardResult {
  /** Unique guard identifier (e.g., "has-brief"). */
  guardId: string;
  /** Human-readable description of the prerequisite. */
  description: string;
  /** Whether the guard condition is satisfied. */
  satisfied: boolean;
}

/** A prerequisite condition for a workflow transition. */
export interface TransitionGuard {
  /** Unique guard identifier. */
  id: string;
  /** Human-readable description (e.g., "Product brief exists"). */
  description: string;
  /** Pure evaluation function — no side effects. */
  evaluate: (context: GuardContext) => boolean;
}

/** A directed edge in the workflow state machine. */
export interface WorkflowTransition {
  /** Source phase. */
  from: Phase;
  /** Target phase. */
  to: Phase;
  /** Human-readable description of the transition. */
  description: string;
  /** Guard conditions that must ALL be satisfied for transition. */
  guards: TransitionGuard[];
}

/** Readiness assessment for a specific transition. */
export interface TransitionReadiness {
  /** The transition being assessed. */
  transition: WorkflowTransition;
  /** Overall readiness score (0–100). */
  score: number;
  /** Guards that are satisfied. */
  satisfied: GuardResult[];
  /** Guards that are NOT yet satisfied. */
  unsatisfied: GuardResult[];
}

/** Workflow state machine — pure model with no side effects. */
export interface WorkflowStateMachine {
  /** All phases in this workflow. */
  phases: readonly Phase[];
  /** All defined transitions between phases. */
  transitions: readonly WorkflowTransition[];
  /** Get transitions from a phase where ALL guards pass. */
  getAvailableTransitions: (currentPhase: Phase, context: GuardContext) => WorkflowTransition[];
  /** Get readiness info for all transitions from a phase. */
  getTransitionReadiness: (currentPhase: Phase, context: GuardContext) => TransitionReadiness[];
}

// ---------------------------------------------------------------------------
// Artifact Dependency Graph (Story 16.4)
// ---------------------------------------------------------------------------

/** An artifact node in the dependency graph — extends ClassifiedArtifact with relationships. */
export interface ArtifactNode extends ClassifiedArtifact {
  /** Paths of artifacts this node depends on (from inputDocuments frontmatter). */
  dependsOn: string[];
  /** Paths of artifacts that reference this node. */
  referencedBy: string[];
}

/** A directed edge in the artifact dependency graph. */
export interface ArtifactEdge {
  /** Path of the artifact that depends on another. */
  from: string;
  /** Path of the depended-upon artifact. */
  to: string;
}

/** The complete artifact dependency graph for a project. */
export interface ArtifactDependencyGraph {
  /** All artifact nodes, keyed by relative path. */
  nodes: Map<string, ArtifactNode>;
  /** All dependency edges (from depends on to). */
  edges: ArtifactEdge[];
}

/** Service for building and maintaining the artifact dependency graph. */
export interface ArtifactGraphService {
  /** Build the full graph from scratch (initial load). */
  build(): Promise<ArtifactDependencyGraph>;
  /** Get the current graph (build lazily if needed). */
  getGraph(): Promise<ArtifactDependencyGraph>;
  /** Produce a GuardContext for the state machine from the current graph. */
  getGuardContext(): Promise<GuardContext>;
  /** Dispose watchers and free resources. */
  dispose(): void;
}
