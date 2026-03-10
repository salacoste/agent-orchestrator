/**
 * Agent Orchestrator — Core Type Definitions
 *
 * This file defines ALL interfaces and types that the system uses.
 * Every plugin, CLI command, and web API route builds against these.
 *
 * Architecture: 8 plugin slots + core services
 *   1. Runtime    — where sessions execute (tmux, docker, k8s, process)
 *   2. Agent      — AI coding tool (claude-code, codex, aider)
 *   3. Workspace  — code isolation (worktree, clone)
 *   4. Tracker    — issue tracking (github, linear, jira)
 *   5. SCM        — source platform + PR/CI/reviews (github, gitlab)
 *   6. Notifier   — push notifications (desktop, slack, webhook)
 *   7. Terminal   — human interaction UI (iterm2, web, none)
 *   8. Lifecycle Manager (core, not pluggable)
 */

// =============================================================================
// DEGRADED MODE (imported from degraded-mode.ts)
// =============================================================================

import type {
  DegradedModeState,
  MonitoredService,
  ServiceAvailability,
  DegradedModeStatus,
} from "./degraded-mode.js";

// Re-export degraded mode types for external use
export type { DegradedModeState, MonitoredService, ServiceAvailability, DegradedModeStatus };

// =============================================================================
// SESSION
// =============================================================================

/** Unique session identifier, e.g. "my-app-1", "backend-12" */
export type SessionId = string;

/** Session lifecycle states */
export type SessionStatus =
  | "spawning"
  | "working"
  | "pr_open"
  | "ci_failed"
  | "review_pending"
  | "changes_requested"
  | "approved"
  | "mergeable"
  | "merged"
  | "cleanup"
  | "needs_input"
  | "stuck"
  | "errored"
  | "killed"
  | "done"
  | "terminated"
  | "blocked"
  | "paused";

/** Activity state as detected by the agent plugin */
export type ActivityState =
  | "active" // agent is processing (thinking, writing code)
  | "ready" // agent finished its turn, alive and waiting for input
  | "idle" // agent has been inactive for a while (stale)
  | "waiting_input" // agent is asking a question / permission prompt
  | "blocked" // agent hit an error or is stuck
  | "exited"; // agent process is no longer running

/** Activity state constants */
export const ACTIVITY_STATE = {
  ACTIVE: "active" as const,
  READY: "ready" as const,
  IDLE: "idle" as const,
  WAITING_INPUT: "waiting_input" as const,
  BLOCKED: "blocked" as const,
  EXITED: "exited" as const,
} satisfies Record<string, ActivityState>;

/** Result of activity detection, carrying both the state and an optional timestamp. */
export interface ActivityDetection {
  state: ActivityState;
  /** When activity was last observed (e.g., agent log file mtime) */
  timestamp?: Date;
}

/** Default threshold (ms) before a "ready" session becomes "idle". */
export const DEFAULT_READY_THRESHOLD_MS = 300_000; // 5 minutes

/** Session status constants */
export const SESSION_STATUS = {
  SPAWNING: "spawning" as const,
  WORKING: "working" as const,
  PR_OPEN: "pr_open" as const,
  CI_FAILED: "ci_failed" as const,
  REVIEW_PENDING: "review_pending" as const,
  CHANGES_REQUESTED: "changes_requested" as const,
  APPROVED: "approved" as const,
  MERGEABLE: "mergeable" as const,
  MERGED: "merged" as const,
  CLEANUP: "cleanup" as const,
  NEEDS_INPUT: "needs_input" as const,
  STUCK: "stuck" as const,
  ERRORED: "errored" as const,
  KILLED: "killed" as const,
  DONE: "done" as const,
  TERMINATED: "terminated" as const,
  BLOCKED: "blocked" as const,
  PAUSED: "paused" as const,
} satisfies Record<string, SessionStatus>;

/** Statuses that indicate the session is in a terminal (dead) state. */
export const TERMINAL_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "killed",
  "terminated",
  "done",
  "cleanup",
  "errored",
  "merged",
]);

/** Activity states that indicate the session is no longer running. */
export const TERMINAL_ACTIVITIES: ReadonlySet<ActivityState> = new Set(["exited"]);

/** Statuses that must never be restored (e.g. already merged). */
export const NON_RESTORABLE_STATUSES: ReadonlySet<SessionStatus> = new Set(["merged"]);

/** Check if a session is in a terminal (dead) state. */
export function isTerminalSession(session: {
  status: SessionStatus;
  activity: ActivityState | null;
}): boolean {
  return (
    TERMINAL_STATUSES.has(session.status) ||
    (session.activity !== null && TERMINAL_ACTIVITIES.has(session.activity))
  );
}

/** Check if a session can be restored. */
export function isRestorable(session: {
  status: SessionStatus;
  activity: ActivityState | null;
}): boolean {
  return isTerminalSession(session) && !NON_RESTORABLE_STATUSES.has(session.status);
}

/** A running agent session */
export interface Session {
  /** Unique session ID, e.g. "my-app-3" */
  id: SessionId;

  /** Which project this session belongs to */
  projectId: string;

  /** Current lifecycle status */
  status: SessionStatus;

  /** Activity state from agent plugin (null = not yet determined) */
  activity: ActivityState | null;

  /** Git branch name */
  branch: string | null;

  /** Issue identifier (if working on an issue) */
  issueId: string | null;

  /** PR info (once PR is created) */
  pr: PRInfo | null;

  /** Workspace path on disk */
  workspacePath: string | null;

  /** Runtime handle for communicating with the session */
  runtimeHandle: RuntimeHandle | null;

  /** Agent session info (summary, cost, etc.) */
  agentInfo: AgentSessionInfo | null;

  /** When the session was created */
  createdAt: Date;

  /** Last activity timestamp */
  lastActivityAt: Date;

  /** When this session was last restored (undefined if never restored) */
  restoredAt?: Date;

  /** Metadata key-value pairs */
  metadata: Record<string, string>;
}

/** Config for creating a new session */
export interface SessionSpawnConfig {
  projectId: string;
  issueId?: string;
  branch?: string;
  prompt?: string;
  /** Override the agent plugin for this session (e.g. "codex", "claude-code") */
  agent?: string;
}

/** Config for creating an orchestrator session */
export interface OrchestratorSpawnConfig {
  projectId: string;
  systemPrompt?: string;
}

// =============================================================================
// RUNTIME — Plugin Slot 1
// =============================================================================

/**
 * Runtime determines WHERE and HOW agent sessions execute.
 * tmux, docker, kubernetes, child processes, SSH, cloud sandboxes, etc.
 */
export interface Runtime {
  readonly name: string;

  /** Create a new session environment and return a handle */
  create(config: RuntimeCreateConfig): Promise<RuntimeHandle>;

  /** Destroy a session environment */
  destroy(handle: RuntimeHandle): Promise<void>;

  /** Send a text message/prompt to the running agent */
  sendMessage(handle: RuntimeHandle, message: string): Promise<void>;

  /** Capture recent output from the session */
  getOutput(handle: RuntimeHandle, lines?: number): Promise<string>;

  /** Check if the session environment is still alive */
  isAlive(handle: RuntimeHandle): Promise<boolean>;

  /** Get resource metrics (uptime, memory, etc.) */
  getMetrics?(handle: RuntimeHandle): Promise<RuntimeMetrics>;

  /** Get info needed to attach a human to this session (for Terminal plugin) */
  getAttachInfo?(handle: RuntimeHandle): Promise<AttachInfo>;

  /**
   * Get the exit code of the session's main process.
   * Returns null if the session is still alive, undefined if unable to determine.
   */
  getExitCode?(handle: RuntimeHandle): Promise<number | null | undefined>;

  /**
   * Get the signal that terminated the session's main process (e.g., "SIGTERM", "SIGKILL").
   * Returns null if the session is still alive, undefined if no signal or unable to determine.
   */
  getSignal?(handle: RuntimeHandle): Promise<string | null | undefined>;
}

export interface RuntimeCreateConfig {
  sessionId: SessionId;
  workspacePath: string;
  launchCommand: string;
  environment: Record<string, string>;
}

/** Opaque handle returned by runtime.create() */
export interface RuntimeHandle {
  /** Runtime-specific identifier (tmux session name, container ID, pod name, etc.) */
  id: string;
  /** Which runtime created this handle */
  runtimeName: string;
  /** Runtime-specific data */
  data: Record<string, unknown>;
}

export interface RuntimeMetrics {
  uptimeMs: number;
  memoryMb?: number;
  cpuPercent?: number;
}

export interface AttachInfo {
  /** How to connect: tmux attach, docker exec, SSH, web URL, etc. */
  type: "tmux" | "docker" | "ssh" | "web" | "process";
  /** For tmux: session name. For docker: container ID. For web: URL. */
  target: string;
  /** Optional: command to run to attach */
  command?: string;
}

// =============================================================================
// AGENT — Plugin Slot 2
// =============================================================================

/**
 * Agent adapter for a specific AI coding tool.
 * Knows how to launch, detect activity, and extract session info.
 */
export interface Agent {
  readonly name: string;

  /** Process name to look for (e.g. "claude", "codex", "aider") */
  readonly processName: string;

  /**
   * How the initial prompt should be delivered to the agent.
   * - "inline" (default): prompt is included in the launch command (e.g. -p flag)
   * - "post-launch": prompt is sent via runtime.sendMessage() after the agent starts,
   *   keeping the agent in interactive mode. Use this for agents where inlining
   *   the prompt causes one-shot/exit behavior (e.g. Claude Code's -p flag).
   */
  readonly promptDelivery?: "inline" | "post-launch";

  /** Get the shell command to launch this agent */
  getLaunchCommand(config: AgentLaunchConfig): string;

  /** Get environment variables for the agent process */
  getEnvironment(config: AgentLaunchConfig): Record<string, string>;

  /**
   * Detect what the agent is currently doing from terminal output.
   * @deprecated Use getActivityState() instead - this uses hacky terminal parsing.
   */
  detectActivity(terminalOutput: string): ActivityState;

  /**
   * Get current activity state using agent-native mechanism (JSONL, SQLite, etc.).
   * This is the preferred method for activity detection.
   * @param readyThresholdMs - ms before "ready" becomes "idle" (default: DEFAULT_READY_THRESHOLD_MS)
   */
  getActivityState(session: Session, readyThresholdMs?: number): Promise<ActivityDetection | null>;

  /** Check if agent process is running (given runtime handle) */
  isProcessRunning(handle: RuntimeHandle): Promise<boolean>;

  /** Extract information from agent's internal data (summary, cost, session ID) */
  getSessionInfo(session: Session): Promise<AgentSessionInfo | null>;

  /**
   * Optional: get a launch command that resumes a previous session.
   * Returns null if no previous session is found (caller falls back to getLaunchCommand).
   */
  getRestoreCommand?(session: Session, project: ProjectConfig): Promise<string | null>;

  /** Optional: run setup after agent is launched (e.g. configure MCP servers) */
  postLaunchSetup?(session: Session): Promise<void>;

  /**
   * Optional: Set up agent-specific hooks/config in the workspace for automatic metadata updates.
   * Called once per workspace during ao init/start and when creating new worktrees.
   *
   * Each agent plugin implements this for their own config format:
   * - Claude Code: writes .claude/settings.json with PostToolUse hook
   * - Codex: whatever config mechanism Codex uses
   * - Aider: .aider.conf.yml or similar
   * - OpenCode: its own config
   *
   * CRITICAL: The dashboard depends on metadata being auto-updated when agents
   * run git/gh commands. Without this, PRs created by agents never show up.
   */
  setupWorkspaceHooks?(workspacePath: string, config: WorkspaceHooksConfig): Promise<void>;
}

export interface AgentLaunchConfig {
  sessionId: SessionId;
  projectConfig: ProjectConfig;
  issueId?: string;
  prompt?: string;
  permissions?: "skip" | "default";
  model?: string;
  /**
   * System prompt to pass to the agent for orchestrator context.
   * - Claude Code: --append-system-prompt
   * - Codex: --system-prompt or AGENTS.md
   * - Aider: --system-prompt flag
   * - OpenCode: equivalent mechanism
   *
   * For short prompts only. For long prompts, use systemPromptFile instead
   * to avoid shell/tmux truncation issues.
   */
  systemPrompt?: string;
  /**
   * Path to a file containing the system prompt.
   * Preferred over systemPrompt for long prompts (e.g. orchestrator prompts)
   * because inlining 2000+ char prompts in shell commands causes truncation.
   *
   * When set, takes precedence over systemPrompt.
   * - Claude Code: --append-system-prompt "$(cat /path/to/file)"
   * - Codex/Aider: similar shell substitution
   */
  systemPromptFile?: string;
}

export interface WorkspaceHooksConfig {
  /** Data directory where session metadata files are stored */
  dataDir: string;
  /** Optional session ID (may not be known at ao init time) */
  sessionId?: string;
}

export interface AgentSessionInfo {
  /** Agent's auto-generated summary of what it's working on */
  summary: string | null;
  /** True when summary is a fallback (e.g. truncated first user message), not a real agent summary */
  summaryIsFallback?: boolean;
  /** Agent's internal session ID (for resume) */
  agentSessionId: string | null;
  /** Estimated cost so far */
  cost?: CostEstimate;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// =============================================================================
// WORKSPACE — Plugin Slot 3
// =============================================================================

/**
 * Workspace manages code isolation — how each session gets its own copy of the repo.
 */
export interface Workspace {
  readonly name: string;

  /** Create an isolated workspace for a session */
  create(config: WorkspaceCreateConfig): Promise<WorkspaceInfo>;

  /** Destroy a workspace */
  destroy(workspacePath: string): Promise<void>;

  /** List existing workspaces for a project */
  list(projectId: string): Promise<WorkspaceInfo[]>;

  /** Optional: run hooks after workspace creation (symlinks, installs, etc.) */
  postCreate?(info: WorkspaceInfo, project: ProjectConfig): Promise<void>;

  /** Optional: check if a workspace exists and is a valid git repo */
  exists?(workspacePath: string): Promise<boolean>;

  /** Optional: restore a workspace (e.g. recreate a worktree for an existing branch) */
  restore?(config: WorkspaceCreateConfig, workspacePath: string): Promise<WorkspaceInfo>;
}

export interface WorkspaceCreateConfig {
  projectId: string;
  project: ProjectConfig;
  sessionId: SessionId;
  branch: string;
}

export interface WorkspaceInfo {
  path: string;
  branch: string;
  sessionId: SessionId;
  projectId: string;
}

// =============================================================================
// TRACKER — Plugin Slot 4
// =============================================================================

/**
 * Issue/task tracker integration — GitHub Issues, Linear, Jira, etc.
 */
export interface Tracker {
  readonly name: string;

  /** Fetch issue details */
  getIssue(identifier: string, project: ProjectConfig): Promise<Issue>;

  /** Check if issue is completed/closed */
  isCompleted(identifier: string, project: ProjectConfig): Promise<boolean>;

  /** Generate a URL for the issue */
  issueUrl(identifier: string, project: ProjectConfig): string;

  /** Extract a human-readable label from an issue URL (e.g., "INT-1327", "#42") */
  issueLabel?(url: string, project: ProjectConfig): string;

  /** Generate a git branch name for the issue */
  branchName(identifier: string, project: ProjectConfig): string;

  /** Generate a prompt for the agent to work on this issue */
  generatePrompt(identifier: string, project: ProjectConfig): Promise<string>;

  /** Optional: list issues with filters */
  listIssues?(filters: IssueFilters, project: ProjectConfig): Promise<Issue[]>;

  /** Optional: update issue state */
  updateIssue?(identifier: string, update: IssueUpdate, project: ProjectConfig): Promise<void>;

  /** Optional: create a new issue */
  createIssue?(input: CreateIssueInput, project: ProjectConfig): Promise<Issue>;

  /** Optional: validate issue before spawning (pre-flight check) */
  validateIssue?(identifier: string, project: ProjectConfig): Promise<IssueValidationResult>;

  /** Optional: find issue ID by branch name (reverse lookup) */
  findIssueByBranch?(branch: string, project: ProjectConfig): Promise<string | null>;

  /** Optional: handle PR merge for an issue (transition status, emit events) */
  onPRMerge?(issueId: string, prUrl: string | undefined, project: ProjectConfig): Promise<void>;

  /** Optional: handle session death — reset story status if appropriate */
  onSessionDeath?(issueId: string, project: ProjectConfig, sessionId?: string): Promise<void>;

  /** Optional: get health/sprint notifications as OrchestratorEvents */
  getNotifications?(project: ProjectConfig): Promise<OrchestratorEvent[]>;

  /** Optional: resolve a human-readable title for an epic identifier */
  getEpicTitle?(epicId: string, project: ProjectConfig): string;
}

export interface IssueValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  url: string;
  state: "open" | "in_progress" | "closed" | "cancelled";
  labels: string[];
  assignee?: string;
  priority?: number;
}

export interface IssueFilters {
  state?: "open" | "closed" | "all";
  labels?: string[];
  assignee?: string;
  limit?: number;
}

export interface IssueUpdate {
  state?: "open" | "in_progress" | "closed";
  labels?: string[];
  assignee?: string;
  comment?: string;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  labels?: string[];
  assignee?: string;
  priority?: number;
}

// =============================================================================
// SCM — Plugin Slot 5
// =============================================================================

/**
 * Source code management platform — PR lifecycle, CI checks, code reviews.
 * This is the richest plugin interface, covering the full PR pipeline.
 */
export interface SCM {
  readonly name: string;

  // --- PR Lifecycle ---

  /** Detect if a session has an open PR (by branch name) */
  detectPR(session: Session, project: ProjectConfig): Promise<PRInfo | null>;

  /** Get current PR state */
  getPRState(pr: PRInfo): Promise<PRState>;

  /** Get PR summary with stats (state, title, additions, deletions). Optional. */
  getPRSummary?(pr: PRInfo): Promise<{
    state: PRState;
    title: string;
    additions: number;
    deletions: number;
  }>;

  /** Merge a PR */
  mergePR(pr: PRInfo, method?: MergeMethod): Promise<void>;

  /** Close a PR without merging */
  closePR(pr: PRInfo): Promise<void>;

  // --- CI Tracking ---

  /** Get individual CI check statuses */
  getCIChecks(pr: PRInfo): Promise<CICheck[]>;

  /** Get overall CI summary */
  getCISummary(pr: PRInfo): Promise<CIStatus>;

  // --- Review Tracking ---

  /** Get all reviews on a PR */
  getReviews(pr: PRInfo): Promise<Review[]>;

  /** Get the overall review decision */
  getReviewDecision(pr: PRInfo): Promise<ReviewDecision>;

  /** Get pending (unresolved) review comments */
  getPendingComments(pr: PRInfo): Promise<ReviewComment[]>;

  /** Get automated review comments (bots, linters, security scanners) */
  getAutomatedComments(pr: PRInfo): Promise<AutomatedComment[]>;

  // --- Merge Readiness ---

  /** Check if PR is ready to merge */
  getMergeability(pr: PRInfo): Promise<MergeReadiness>;
}

// --- PR Types ---

export interface PRInfo {
  number: number;
  url: string;
  title: string;
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  isDraft: boolean;
}

export type PRState = "open" | "merged" | "closed";

/** PR state constants */
export const PR_STATE = {
  OPEN: "open" as const,
  MERGED: "merged" as const,
  CLOSED: "closed" as const,
} satisfies Record<string, PRState>;

export type MergeMethod = "merge" | "squash" | "rebase";

// --- CI Types ---

export interface CICheck {
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  url?: string;
  conclusion?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type CIStatus = "pending" | "passing" | "failing" | "none";

/** CI status constants */
export const CI_STATUS = {
  PENDING: "pending" as const,
  PASSING: "passing" as const,
  FAILING: "failing" as const,
  NONE: "none" as const,
} satisfies Record<string, CIStatus>;

// --- Review Types ---

export interface Review {
  author: string;
  state: "approved" | "changes_requested" | "commented" | "dismissed" | "pending";
  body?: string;
  submittedAt: Date;
}

export type ReviewDecision = "approved" | "changes_requested" | "pending" | "none";

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  path?: string;
  line?: number;
  isResolved: boolean;
  createdAt: Date;
  url: string;
}

export interface AutomatedComment {
  id: string;
  botName: string;
  body: string;
  path?: string;
  line?: number;
  severity: "error" | "warning" | "info";
  createdAt: Date;
  url: string;
}

// --- Merge Readiness ---

export interface MergeReadiness {
  mergeable: boolean;
  ciPassing: boolean;
  approved: boolean;
  noConflicts: boolean;
  blockers: string[];
}

// =============================================================================
// NOTIFIER — Plugin Slot 6 (PRIMARY INTERFACE)
// =============================================================================

/**
 * Notifier is the PRIMARY interface between the orchestrator and the human.
 * The human walks away after spawning agents. Notifications bring them back.
 *
 * Push, not pull. The human never polls.
 */
export interface Notifier {
  readonly name: string;

  /** Push a notification to the human */
  notify(event: OrchestratorEvent): Promise<void>;

  /** Push a notification with actionable buttons/links */
  notifyWithActions?(event: OrchestratorEvent, actions: NotifyAction[]): Promise<void>;

  /** Post a message to a channel (for team-visible notifiers like Slack) */
  post?(message: string, context?: NotifyContext): Promise<string | null>;
}

export interface NotifyAction {
  label: string;
  url?: string;
  callbackEndpoint?: string;
}

export interface NotifyContext {
  sessionId?: SessionId;
  projectId?: string;
  prUrl?: string;
  channel?: string;
}

// =============================================================================
// TERMINAL — Plugin Slot 7
// =============================================================================

/**
 * Terminal manages how humans view/interact with running sessions.
 * Opens IDE tabs, browser windows, or terminal sessions.
 */
export interface Terminal {
  readonly name: string;

  /** Open a session for human interaction */
  openSession(session: Session): Promise<void>;

  /** Open all sessions for a project */
  openAll(sessions: Session[]): Promise<void>;

  /** Check if a session is already open in a tab/window */
  isSessionOpen?(session: Session): Promise<boolean>;
}

// =============================================================================
// EVENTS
// =============================================================================

/** Priority levels for events — determines notification routing */
export type EventPriority = "urgent" | "action" | "warning" | "info";

/** All orchestrator event types */
export type EventType =
  // Session lifecycle
  | "session.spawned"
  | "session.working"
  | "session.exited"
  | "session.killed"
  | "session.stuck"
  | "session.needs_input"
  | "session.errored"
  // PR lifecycle
  | "pr.created"
  | "pr.updated"
  | "pr.merged"
  | "pr.closed"
  // CI
  | "ci.passing"
  | "ci.failing"
  | "ci.fix_sent"
  | "ci.fix_failed"
  // Reviews
  | "review.pending"
  | "review.approved"
  | "review.changes_requested"
  | "review.comments_sent"
  | "review.comments_unresolved"
  // Automated reviews
  | "automated_review.found"
  | "automated_review.fix_sent"
  // Merge
  | "merge.ready"
  | "merge.conflicts"
  | "merge.completed"
  // Reactions
  | "reaction.triggered"
  | "reaction.escalated"
  // Summary
  | "summary.all_complete"
  // Tracker
  | "tracker.story_done"
  | "tracker.sprint_complete"
  // Agent blocked/resumed
  | "agent.blocked"
  | "agent.resumed";

/** An event emitted by the orchestrator */
export interface OrchestratorEvent {
  id: string;
  type: EventType;
  priority: EventPriority;
  sessionId: SessionId;
  projectId: string;
  timestamp: Date;
  message: string;
  data: Record<string, unknown>;
}

// =============================================================================
// REACTIONS
// =============================================================================

/** A configured automatic reaction to an event */
export interface ReactionConfig {
  /** Whether this reaction is enabled */
  auto: boolean;

  /** What to do: send message to agent, notify human, auto-merge */
  action: "send-to-agent" | "notify" | "auto-merge";

  /** Message to send (for send-to-agent) */
  message?: string;

  /** Priority for notifications */
  priority?: EventPriority;

  /** How many times to retry send-to-agent before escalating */
  retries?: number;

  /** Escalate to human notification after this many failures or this duration */
  escalateAfter?: number | string;

  /** Threshold duration for time-based triggers (e.g. "10m" for stuck detection) */
  threshold?: string;

  /** Whether to include a summary in the notification */
  includeSummary?: boolean;
}

export interface ReactionResult {
  reactionType: string;
  success: boolean;
  action: string;
  message?: string;
  escalated: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Top-level orchestrator configuration (from agent-orchestrator.yaml) */
export interface OrchestratorConfig {
  /**
   * Path to the config file (set automatically during load).
   * Used for hash-based directory structure.
   * All paths are auto-derived from this location.
   */
  configPath: string;

  /** Web dashboard port (defaults to 3000) */
  port?: number;

  /** Terminal WebSocket server port (defaults to 3001) */
  terminalPort?: number;

  /** Direct terminal WebSocket server port (defaults to 3003) */
  directTerminalPort?: number;

  /** Milliseconds before a "ready" session becomes "idle" (default: 300000 = 5 min) */
  readyThresholdMs: number;

  /** Default plugin selections */
  defaults: DefaultPlugins;

  /** Project configurations */
  projects: Record<string, ProjectConfig>;

  /** Notification channel configs */
  notifiers: Record<string, NotifierConfig>;

  /** Notification routing by priority */
  notificationRouting: Record<EventPriority, string[]>;

  /** Default reaction configs */
  reactions: Record<string, ReactionConfig>;
}

export interface DefaultPlugins {
  runtime: string;
  agent: string;
  workspace: string;
  notifiers: string[];
}

export interface ProjectConfig {
  /** Display name */
  name: string;

  /** GitHub repo in "owner/repo" format */
  repo: string;

  /** Local path to the repo */
  path: string;

  /** Default branch (main, master, next, develop, etc.) */
  defaultBranch: string;

  /** Session name prefix (e.g. "app" → "app-1", "app-2") */
  sessionPrefix: string;

  /** Override default runtime */
  runtime?: string;

  /** Override default agent */
  agent?: string;

  /** Override default workspace */
  workspace?: string;

  /** Issue tracker configuration */
  tracker?: TrackerConfig;

  /** SCM configuration (usually inferred from repo) */
  scm?: SCMConfig;

  /** Files/dirs to symlink into workspaces */
  symlinks?: string[];

  /** Commands to run after workspace creation */
  postCreate?: string[];

  /** Agent-specific configuration */
  agentConfig?: AgentSpecificConfig;

  /** Per-project reaction overrides */
  reactions?: Record<string, Partial<ReactionConfig>>;

  /** Inline rules/instructions passed to every agent prompt */
  agentRules?: string;

  /** Path to a file containing agent rules (relative to project path) */
  agentRulesFile?: string;

  /** Rules for the orchestrator agent (stored, reserved for future use) */
  orchestratorRules?: string;
}

export interface TrackerConfig {
  plugin: string;
  /** Plugin-specific config (e.g. teamId for Linear) */
  [key: string]: unknown;
}

export interface SCMConfig {
  plugin: string;
  [key: string]: unknown;
}

export interface NotifierConfig {
  plugin: string;
  [key: string]: unknown;
}

export interface AgentSpecificConfig {
  permissions?: "skip" | "default";
  model?: string;
  [key: string]: unknown;
}

// =============================================================================
// PLUGIN SYSTEM
// =============================================================================

/** Plugin slot types */
export type PluginSlot =
  | "runtime"
  | "agent"
  | "workspace"
  | "tracker"
  | "scm"
  | "notifier"
  | "terminal";

/** Plugin manifest — what every plugin exports */
export interface PluginManifest {
  /** Plugin name (e.g. "tmux", "claude-code", "github") */
  name: string;

  /** Which slot this plugin fills */
  slot: PluginSlot;

  /** Human-readable description */
  description: string;

  /** Version */
  version: string;
}

/** What a plugin module must export */
export interface PluginModule<T = unknown> {
  manifest: PluginManifest;
  create(config?: Record<string, unknown>): T;
}

// =============================================================================
// SESSION METADATA (flat file format)
// =============================================================================

/**
 * Session metadata stored as flat key=value files.
 * Matches the existing bash script format for backwards compatibility.
 *
 * Note: In the new architecture, session files are named with user-facing names
 * (e.g., "int-1") and contain a tmuxName field for the globally unique tmux name
 * (e.g., "a3b4c5d6e7f8-int-1").
 */
export interface SessionMetadata {
  worktree: string;
  branch: string;
  status: string;
  tmuxName?: string; // Globally unique tmux session name (includes hash)
  issue?: string;
  pr?: string;
  summary?: string;
  project?: string;
  agent?: string; // Agent plugin name (e.g. "codex", "claude-code") — persisted for lifecycle
  createdAt?: string;
  runtimeHandle?: string;
  restoredAt?: string;
  role?: string; // "orchestrator" for orchestrator sessions
  dashboardPort?: number;
  terminalWsPort?: number;
  directTerminalWsPort?: number;
  // Agent failure/crash details for resume functionality
  exitCode?: number; // Exit code when agent failed
  signal?: string; // Signal that terminated the agent (e.g., "SIGSEGV", "SIGTERM")
  failureReason?: string; // "failed", "crashed", "timed_out", "disconnected"
  previousLogsPath?: string; // Path to previous session logs for inspection
}

// =============================================================================
// SERVICE INTERFACES (core, not pluggable)
// =============================================================================

/** Session manager — CRUD for sessions */
export interface SessionManager {
  spawn(config: SessionSpawnConfig): Promise<Session>;
  spawnOrchestrator(config: OrchestratorSpawnConfig): Promise<Session>;
  restore(sessionId: SessionId): Promise<Session>;
  list(projectId?: string): Promise<Session[]>;
  get(sessionId: SessionId): Promise<Session | null>;
  kill(sessionId: SessionId): Promise<void>;
  cleanup(projectId?: string, options?: { dryRun?: boolean }): Promise<CleanupResult>;
  send(sessionId: SessionId, message: string): Promise<void>;
}

export interface CleanupResult {
  killed: string[];
  skipped: string[];
  errors: Array<{ sessionId: string; error: string }>;
}

/** Lifecycle manager — state machine + reaction engine */
export interface LifecycleManager {
  /** Start the lifecycle polling loop */
  start(intervalMs?: number): void;

  /** Stop the lifecycle polling loop */
  stop(): void;

  /** Get current state for all sessions */
  getStates(): Map<SessionId, SessionStatus>;

  /** Force-check a specific session now */
  check(sessionId: SessionId): Promise<void>;

  /** Get degraded mode status (if available) */
  getDegradedModeStatus?(): DegradedModeStatus;
}

/** Plugin registry — discovery + loading */
export interface PluginRegistry {
  /** Register a plugin, optionally with config to pass to create() */
  register(plugin: PluginModule, config?: Record<string, unknown>): void;

  /** Get a plugin by slot and name */
  get<T>(slot: PluginSlot, name: string): T | null;

  /** List plugins for a slot */
  list(slot: PluginSlot): PluginManifest[];

  /** Load built-in plugins, optionally with orchestrator config for plugin settings */
  loadBuiltins(
    config?: OrchestratorConfig,
    importFn?: (pkg: string) => Promise<unknown>,
  ): Promise<void>;

  /** Load plugins from config (npm packages, local paths) */
  loadFromConfig(
    config: OrchestratorConfig,
    importFn?: (pkg: string) => Promise<unknown>,
  ): Promise<void>;
}

// =============================================================================
// ERROR DETECTION HELPERS
// =============================================================================

/**
 * Detect if an error indicates that an issue was not found in the tracker.
 * Used by spawn validation to distinguish "not found" from other errors (auth, network, etc).
 *
 * Uses specific patterns to avoid matching infrastructure errors like "API key not found",
 * "Team not found", "Configuration not found", etc.
 */
export function isIssueNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = (err as Error).message?.toLowerCase() || "";

  // Match issue-specific not-found patterns
  return (
    (message.includes("issue") &&
      (message.includes("not found") || message.includes("does not exist"))) ||
    message.includes("no issue found") ||
    message.includes("could not find issue") ||
    // GitHub: "no issue found" or "could not resolve to an Issue"
    message.includes("could not resolve to an issue") ||
    // Linear: "Issue <id> not found" or "No issue with identifier"
    message.includes("no issue with identifier") ||
    // GitHub: "invalid issue format" (ad-hoc free-text strings)
    message.includes("invalid issue format")
  );
}

/** Thrown when a session cannot be restored (e.g. merged, still working). */
export class SessionNotRestorableError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly reason: string,
  ) {
    super(`Session ${sessionId} cannot be restored: ${reason}`);
    this.name = "SessionNotRestorableError";
  }
}

/** Thrown when a workspace is missing and cannot be recreated. */
export class WorkspaceMissingError extends Error {
  constructor(
    public readonly path: string,
    public readonly detail?: string,
  ) {
    super(`Workspace missing at ${path}${detail ? `: ${detail}` : ""}`);
    this.name = "WorkspaceMissingError";
  }
}

// =============================================================================
// AGENT REGISTRY — Story assignment tracking
// =============================================================================

/**
 * Agent lifecycle and assignment status.
 * Tracks which agents are working on which stories.
 */
export type AgentStatus =
  | "spawning" // Session starting up
  | "active" // Agent is working
  | "idle" // No activity for threshold period
  | "completed" // Story done
  | "blocked" // Error requiring human intervention
  | "disconnected"; // Session/killed

/** Agent status constants */
export const AGENT_STATUS = {
  SPAWNING: "spawning" as const,
  ACTIVE: "active" as const,
  IDLE: "idle" as const,
  COMPLETED: "completed" as const,
  BLOCKED: "blocked" as const,
  DISCONNECTED: "disconnected" as const,
} satisfies Record<string, AgentStatus>;

/**
 * Agent assignment record - tracks which agent is working on which story.
 * Stored in session metadata for persistence across restarts.
 */
export interface AgentAssignment {
  /** Agent ID (typically the session ID) */
  agentId: string;
  /** Story ID from sprint-status.yaml (e.g., "1-2-cli-spawn-agent") */
  storyId: string;
  /** When the agent was assigned to this story */
  assignedAt: Date;
  /** Current agent status */
  status: AgentStatus;
  /** SHA-256 hash of story context (for conflict detection) */
  contextHash: string;
}

/**
 * Agent registry - manages agent-to-story assignments.
 * Provides fast lookups with in-memory caching and persistent storage.
 */
export interface AgentRegistry {
  /**
   * Register an agent assignment.
   * Creates or updates the assignment record in memory and storage.
   */
  register(assignment: AgentAssignment): void;

  /**
   * Query by agent ID.
   * Returns the assignment if the agent exists, null otherwise.
   */
  getByAgent(agentId: string): AgentAssignment | null;

  /**
   * Query by story ID.
   * Returns the most recent assignment for this story.
   */
  getByStory(storyId: string): AgentAssignment | null;

  /**
   * Find active assignment for a story.
   * Used for duplicate assignment detection.
   */
  findActiveByStory(storyId: string): AgentAssignment | null;

  /**
   * List all assignments.
   */
  list(): AgentAssignment[];

  /**
   * Remove an assignment (when agent completes or errors).
   */
  remove(agentId: string): void;

  /**
   * Get zombie/disconnected agents.
   * Returns agents with status=disconnected for cleanup.
   */
  getZombies(): AgentAssignment[];

  /**
   * Reload from persistent storage.
   * Refreshes in-memory cache from disk metadata.
   */
  reload(): Promise<void>;

  /**
   * Get retry count for a story.
   * Returns the number of times the story has been resumed.
   */
  getRetryCount(storyId: string): number;

  /**
   * Increment retry count and track history.
   * Called when resuming a story with a new agent.
   */
  incrementRetry(storyId: string, newAgentId: string): void;

  /**
   * Get retry history for a story.
   */
  getRetryHistory(
    storyId: string,
  ): { attempts: number; lastRetryAt: Date; previousAgents: string[] } | null;
}

/**
 * Agent completion detector interfaces
 */

export interface AgentCompletionDetector {
  /** Start monitoring agent for completion */
  monitor(agentId: string): Promise<void>;

  /** Stop monitoring agent */
  unmonitor(agentId: string): Promise<void>;

  /** Get detection status for agent */
  getStatus(agentId: string): DetectionStatus | null;

  /** Set completion handler callback */
  onCompletion(handler: CompletionHandler): void;

  /** Set failure handler callback */
  onFailure(handler: FailureHandler): void;
}

export interface DetectionStatus {
  agentId: string;
  isMonitoring: boolean;
  startTime: Date;
  lastCheck: Date;
  status: "monitoring" | "completed" | "failed" | "crashed" | "timed_out" | "disconnected";
}

export type CompletionHandler = (event: CompletionEvent) => void | Promise<void>;
export type FailureHandler = (event: FailureEvent) => void | Promise<void>;

export interface CompletionEvent {
  agentId: string;
  storyId: string;
  exitCode: number;
  duration: number; // milliseconds
  completedAt: Date;
}

export interface FailureEvent {
  agentId: string;
  storyId: string;
  exitCode?: number;
  signal?: string;
  reason: "failed" | "crashed" | "timed_out" | "disconnected";
  failedAt: Date;
  duration: number; // milliseconds
  errorContext?: string;
}

/**
 * Blocked agent detector interfaces
 */

export interface BlockedAgentDetector {
  /** Track activity for an agent */
  trackActivity(agentId: string): Promise<void>;

  /** Check if any agents should be marked as blocked */
  checkBlocked(): Promise<void>;

  /** Manually mark agent as paused (suppresses blocked detection) */
  pause(agentId: string): void;

  /** Resume a paused agent */
  resume(agentId: string): void;

  /** Get agent status (blocked, paused, or active) */
  getAgentStatus(agentId: string): BlockedAgentStatus | null;

  /** Start automatic blocked detection (periodic check) */
  startDetection(): void;

  /** Stop automatic blocked detection */
  stopDetection(): Promise<void>;

  /** Close detector and release resources */
  close(): Promise<void>;
}

export interface BlockedAgentDetectorConfig {
  /** How often to check for blocked agents (default: 60s) */
  checkInterval?: number;
  /** Default inactivity timeout before blocking (default: 10m, min: 1m, max: 60m) */
  defaultTimeout?: number;
  /** Agent-type specific timeouts (in milliseconds) */
  agentTypeTimeouts?: Partial<Record<"claude-code" | "codex" | "aider", number>>;
}

export interface BlockedAgentStatus {
  agentId: string;
  lastActivity: Date;
  isBlocked: boolean;
  isPaused: boolean;
  blockedAt?: Date;
  inactiveDuration?: number;
}

// =============================================================================
// EVENT BUS — Plugin Slot 9 (planned)
// =============================================================================

/**
 * Event bus for pub/sub messaging across processes.
 * Enables real-time state synchronization between orchestrator instances.
 */
export interface EventBus {
  /** Event bus plugin name */
  readonly name: string;

  /** Publish an event to the bus */
  publish(event: Omit<EventBusEvent, "eventId" | "timestamp">): Promise<void>;

  /** Subscribe to all events */
  subscribe(callback: EventSubscriber): Promise<() => void>;

  /** Check if connected to backend */
  isConnected(): boolean;

  /** Check if operating in degraded mode */
  isDegraded(): boolean;

  /** Get number of queued events */
  getQueueSize(): number;

  /** Close event bus connection */
  close(): Promise<void>;
}

export interface EventBusEvent {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** Event type identifier */
  eventType: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event metadata payload */
  metadata: Record<string, unknown>;
}

export type EventSubscriber = (event: EventBusEvent) => void;

/** Event handler function with optional acknowledgment callback */
export type EventHandler = (
  event: EventBusEvent,
  ack?: () => Promise<void>,
) => void | Promise<void>;

/** Event bus callback function (internal) */
export type EventBusCallback = (event: EventBusEvent) => void | Promise<void>;

export interface EventBusConfig {
  /** Redis connection host */
  host: string;
  /** Redis connection port */
  port: number;
  /** Redis database number */
  db?: number;
  /** Redis password */
  password?: string;
  /** Pub/Sub channel name */
  channel?: string;
  /** Retry delays in milliseconds (exponential backoff) */
  retryDelays?: number[];
  /** Maximum queue size for disconnected mode */
  queueMaxSize?: number;
  /** Enable AOF persistence for durability */
  enableAOF?: boolean;
}

/**
 * Event publisher for broadcasting story state changes.
 * Ensures all subscribers are notified of agent activities.
 */
export interface EventPublisher {
  /** Publish story completed event */
  publishStoryCompleted(params: StoryCompletedEvent): Promise<void>;

  /** Publish story started event */
  publishStoryStarted(params: StoryStartedEvent): Promise<void>;

  /** Publish story blocked event */
  publishStoryBlocked(params: StoryBlockedEvent): Promise<void>;

  /** Publish story assigned event */
  publishStoryAssigned(params: StoryAssignedEvent): Promise<void>;

  /** Publish agent resumed event */
  publishAgentResumed(params: AgentResumedEvent): Promise<void>;

  /** Flush queued events */
  flush(timeoutMs?: number): Promise<void>;

  /** Get queue size */
  getQueueSize(): number;

  /** Get number of events dropped due to full queue */
  getDroppedEventsCount(): number;

  /** Close publisher and cleanup resources */
  close(): Promise<void>;
}

export interface StoryCompletedEvent {
  storyId: string;
  previousStatus: string;
  newStatus: string;
  agentId: string;
  duration: number; // milliseconds
  filesModified?: string[];
  testsPassed?: number;
  testsFailed?: number;
}

export interface StoryStartedEvent {
  storyId: string;
  agentId: string;
  contextHash: string;
}

export interface StoryBlockedEvent {
  storyId: string;
  agentId?: string;
  reason: string;
  exitCode?: number;
  signal?: string;
  errorContext?: string;
}

export interface StoryAssignedEvent {
  storyId: string;
  agentId: string;
  previousAgentId?: string;
  reason: "manual" | "auto";
}

export interface AgentResumedEvent {
  storyId: string;
  previousAgentId: string;
  newAgentId: string;
  retryCount: number;
  userMessage?: string;
}

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

/** Notification priority levels */
export type NotificationPriority = "critical" | "warning" | "info";

/** Notification sent to plugins */
export interface Notification {
  /** Unique event identifier from source event */
  eventId: string;
  /** Event type from source event */
  eventType: string;
  /** Notification priority */
  priority: NotificationPriority;
  /** Human-readable title */
  title: string;
  /** Detailed message */
  message: string;
  /** Optional action URL */
  actionUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Result of sending a notification */
export interface NotificationResult {
  /** Whether all plugin deliveries succeeded */
  success: boolean;
  /** Plugins that successfully delivered */
  deliveredPlugins: string[];
  /** Plugins that failed to deliver */
  failedPlugins: Array<{ plugin: string; error: string }>;
  /** Whether this was a duplicate (deduped) */
  duplicate?: boolean;
}

/** Notification service status */
export interface NotificationStatus {
  /** Current queue depth */
  queueDepth: number;
  /** Number of duplicates deduplicated */
  dedupCount: number;
  /** Dead letter queue size */
  dlqSize: number;
  /** Last processed notification timestamp */
  lastProcessedTime?: string;
}

/** Dead letter notification (failed delivery) */
export interface DeadLetterNotification {
  /** Notification that failed */
  notification: Notification;
  /** Target plugin that failed */
  targetPlugin: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Error that caused failure */
  error: string;
  /** Last attempt timestamp */
  lastAttempt: string;
}

/** Notification plugin interface */
export interface NotificationPlugin {
  /** Plugin name (e.g., "desktop", "slack", "webhook") */
  name: string;

  /** Send notification to plugin */
  send(notification: Notification): Promise<void>;

  /** Check if plugin is available */
  isAvailable(): Promise<boolean>;
}

/** Notification service interface */
export interface NotificationService {
  /** Send notification immediately */
  send(notification: Notification): Promise<NotificationResult>;

  /** Get notification queue status */
  getStatus(): NotificationStatus;

  /** Get dead letter queue */
  getDLQ(): DeadLetterNotification[];

  /** Retry failed notification from DLQ */
  retryDLQ(notificationId: string): Promise<void>;

  /** Close service */
  close(): Promise<void>;
}

/** Notification service configuration */
export interface NotificationServiceConfig {
  /** Event bus for subscribing to events */
  eventBus: EventBus;
  /** Notification plugins to use */
  plugins: NotificationPlugin[];
  /** Dead letter queue file path (optional) */
  dlqPath?: string;
  /** Queue depth threshold for backlog alert */
  backlogThreshold?: number;
  /** Deduplication window in milliseconds */
  dedupWindowMs?: number;
  /** Notification preferences per event type pattern */
  preferences?: NotificationPreferences;
}

/** Notification preferences for routing by event type */
export interface NotificationPreferences {
  /** Map of event type pattern to plugin names
   *
   * Pattern format: "eventType" or "eventType:subType"
   * Examples:
   *   - "blocked" → matches any event type containing "blocked"
   *   - "agent.blocked" → matches exact event type
   *   - "conflict" → matches any event type containing "conflict"
   *
   * Value: comma-separated list of plugin names to route to
   *   - "desktop,slack" → route to desktop and slack plugins only
   *   - "all" → route to all available plugins (default)
   */
  [eventTypePattern: string]: string | undefined;
}

// =============================================================================
// AUDIT TRAIL
// =============================================================================

/** Audit event logged to JSONL file */
export interface AuditEvent {
  eventId: string; // UUID
  eventType: string;
  timestamp: string; // ISO 8601
  metadata: Record<string, unknown>;
  hash: string; // SHA-256
}

/** Query parameters for audit trail */
export interface QueryParams {
  eventType?: string | string[];
  since?: Date | string;
  until?: Date | string;
  last?: number;
  first?: number;
  grep?: string;
  includeArchived?: boolean;
}

/** Export parameters for audit trail */
export interface ExportParams {
  format?: "jsonl" | "json";
  includeArchived?: boolean;
  validateHashes?: boolean;
}

/** Handler for replaying audit events */
export type ReplayHandler = (event: AuditEvent) => void | Promise<void>;

/** Audit trail statistics */
export interface AuditTrailStats {
  totalEvents: number;
  activeEvents: number;
  archivedEvents: number;
  fileSize: number;
  oldestEvent?: string;
  newestEvent?: string;
}

/** Audit trail service interface */
export interface AuditTrail {
  // Log an event to the audit trail
  log(event: AuditEvent): Promise<void>;

  // Query events with filters
  query(params: QueryParams): AuditEvent[];

  // Export events to file
  export(path: string, params?: ExportParams): Promise<void>;

  // Replay events for state recovery
  replay(handler: ReplayHandler): Promise<void>;

  // Get trail statistics
  getStats(): AuditTrailStats;

  // Close and flush
  close(): Promise<void>;

  // Wait for initialization to complete
  ready(): Promise<void>;
}

// =============================================================================
// STATE MANAGER
// =============================================================================

/** Story status values from sprint-status.yaml */
export type StoryStatus =
  | "backlog"
  | "ready-for-dev"
  | "in-progress"
  | "review"
  | "done"
  | "blocked";

/** Story state tracked by StateManager */
export interface StoryState {
  id: string;
  status: StoryStatus;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  assignedAgent?: string;
  version: string;
  updatedAt: string;
}

/** Result of a set/update operation */
export interface SetResult {
  success: boolean;
  version: string;
  conflict?: boolean;
  error?: string;
}

/** Result of a batch operation */
export interface BatchResult {
  succeeded: string[];
  failed: Array<{ storyId: string; error: string }>;
}

/** Result of metadata verification */
export interface VerifyResult {
  valid: boolean;
  error?: string;
  recovered?: boolean;
}

/** State manager configuration */
export interface StateManagerConfig {
  yamlPath: string; // Path to sprint-status.yaml
  eventBus?: EventBus; // Optional: for publishing events
  createBackup?: boolean; // Create backup before writes (default: false)
  backupPath?: string; // Custom backup path (default: yamlPath + .backup)
  lockRetries?: number; // File lock retry attempts (default: 10)
  lockStaleMs?: number; // Stale lock age in ms (default: 10000)
}

/** State manager service interface */
export interface StateManager {
  // Initialize state manager (load YAML)
  initialize(): Promise<void>;

  // Get story state (from cache, ≤1ms)
  get(storyId: string): StoryState | null;

  // Get all stories (from cache)
  getAll(): Map<string, StoryState>;

  // Set story state (write-through)
  set(storyId: string, state: StoryState, expectedVersion?: string): Promise<SetResult>;

  // Update story state (partial update)
  update(
    storyId: string,
    updates: Partial<StoryState>,
    expectedVersion?: string,
  ): Promise<SetResult>;

  // Batch update multiple stories
  batchSet(updates: Map<string, StoryState>): Promise<BatchResult>;

  // Invalidate and reload cache
  invalidate(): Promise<void>;

  // Get current version
  getVersion(storyId: string): string | null;

  // Close state manager
  close(): Promise<void>;

  // Verify metadata integrity
  verify(): Promise<VerifyResult>;
}

// =============================================================================
// CONFLICT RESOLVER
// =============================================================================

/** Conflict resolution strategies */
export type Resolution = "overwrite" | "retry" | "merge";

/** Field-level conflict information */
export interface FieldConflict {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
}

/** Conflict details with current and proposed states */
export interface Conflict {
  storyId: string;
  expectedVersion: string;
  actualVersion: string;
  conflicts: FieldConflict[];
  current: StoryState;
  proposed: StoryState;
}

/** Result of a conflict resolution operation */
export interface ResolveResult {
  success: boolean;
  newVersion?: string;
  error?: string;
}

/** Field selections for merge resolution */
export interface MergeSelections {
  [field: string]: "current" | "proposed";
}

/** Conflict resolver service interface */
export interface ConflictResolver {
  /**
   * Detect and report conflicts
   * @param storyId - Story identifier
   * @param expectedVersion - Version expected by the caller
   * @param updates - Proposed updates
   * @returns Conflict details if version mismatch, null otherwise
   */
  detect(storyId: string, expectedVersion: string, updates: Partial<StoryState>): Conflict | null;

  /**
   * Resolve a conflict using the specified strategy
   * @param conflict - Conflict details
   * @param resolution - Resolution strategy to apply
   * @returns Resolution result with new version or error
   */
  resolve(conflict: Conflict, resolution: Resolution): Promise<ResolveResult>;

  /**
   * Merge two states according to field selections
   * @param current - Current story state
   * @param proposed - Proposed story state
   * @param selections - Field-level selections (current or proposed)
   * @returns Merged story state
   */
  merge(current: StoryState, proposed: StoryState, selections: MergeSelections): StoryState;
}

/** Error thrown when a version conflict is detected */
export class ConflictError extends Error {
  constructor(
    public conflict: Conflict,
    message?: string,
  ) {
    super(
      message ||
        `Conflict: ${conflict.storyId} has version ${conflict.actualVersion}, expected ${conflict.expectedVersion}`,
    );
    this.name = "ConflictError";
  }
}

// =============================================================================
// FILE WATCHER
// =============================================================================

/** File watch event types */
export type FileWatchEventType = "modify" | "delete" | "rename";

/** File watch event with change details */
export interface FileWatchEvent {
  type: FileWatchEventType;
  path: string;
  timestamp: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changedStories?: string[];
}

/** File watcher configuration */
export interface FileWatcherConfig {
  stateManager: StateManager;
  eventBus?: EventBus;
  enabled?: boolean; // Default: true - set to false to disable file watching (AC 7)
  debounceMs?: number; // Default: 500ms
  retryInterval?: number; // Default: 5000ms
  backupDir?: string; // Default: .backups/
  maxBackups?: number; // Default: 10
  debounceOverflowThreshold?: number; // Default: 10
  interactive?: boolean; // Default: false
}

/** File watcher service interface */
export interface FileWatcher {
  /**
   * Start watching a file for changes
   * @param path - Absolute path to the file to watch
   * @throws Error if file doesn't exist or cannot be watched
   */
  watch(path: string): Promise<void>;

  /**
   * Stop watching a file
   * @param path - Path to the file to stop watching
   */
  unwatch(path: string): Promise<void>;

  /**
   * Stop watching all files and clean up resources
   */
  close(): Promise<void>;

  /**
   * Check if a file is currently being watched
   * @param path - Path to check
   * @returns true if the file is being watched, false otherwise
   */
  isWatching(path: string): boolean;
}

// =============================================================================
// SYNC SERVICE
// =============================================================================

/** Sync direction options */
export type SyncDirection = "to-bmad" | "from-bmad" | "bidirectional";

/** Result of a single sync operation */
export interface SyncResult {
  storyId: string;
  success: boolean;
  error?: string;
  conflict?: ConflictInfo;
}

/** Result of syncing all stories */
export interface SyncAllResult {
  succeeded: string[];
  failed: Array<{ storyId: string; error: string }>;
  conflicts: Array<{ storyId: string; info: ConflictInfo }>;
  duration: number; // milliseconds
}

/** Current sync service status */
export interface SyncStatus {
  lastSyncTime: string | null;
  queueSize: number;
  failedCount: number;
  bmadConnected: boolean;
  degradedMode: boolean;
}

/** Conflict information for sync operations */
export interface ConflictInfo {
  type: string;
  localTimestamp: string;
  bmadTimestamp: string;
  winner?: "local" | "bmad";
  resolvedState?: StoryState;
}

/** BMAD Tracker plugin interface */
export interface BMADTracker {
  name: string;

  /**
   * Get story state from BMAD
   * @param storyId - Story identifier
   * @returns Story state or null if not found
   */
  getStory(storyId: string): Promise<StoryState | null>;

  /**
   * Update story state in BMAD
   * @param storyId - Story identifier
   * @param state - Story state to update
   */
  updateStory(storyId: string, state: StoryState): Promise<void>;

  /**
   * List all stories in BMAD
   * @returns Map of story IDs to story states
   */
  listStories(): Promise<Map<string, StoryState>>;

  /**
   * Check if tracker is available
   * @returns true if available, false otherwise
   */
  isAvailable(): Promise<boolean>;
}

/** Sync service configuration */
export interface SyncServiceConfig {
  eventBus: EventBus;
  stateManager: StateManager;
  bmadTracker: BMADTracker;
  pollInterval?: number; // Default: 10000ms (10 seconds)
  retryDelays?: number[]; // Default: [1000, 2000, 4000, 8000, 16000]
  maxRetries?: number; // Default: 5
}

/** Sync service interface */
export interface SyncService {
  /**
   * Sync story state to BMAD
   * @param storyId - Story identifier
   * @param state - Story state to sync
   * @returns Sync result with success status
   */
  syncToBMAD(storyId: string, state: StoryState): Promise<SyncResult>;

  /**
   * Sync story state from BMAD
   * @param storyId - Story identifier
   * @returns Sync result with success status
   */
  syncFromBMAD(storyId: string): Promise<SyncResult>;

  /**
   * Sync all stories bidirectional
   * @param direction - Sync direction (default: bidirectional)
   * @returns Sync all result with succeeded, failed, and conflicts
   */
  syncAll(direction?: SyncDirection): Promise<SyncAllResult>;

  /**
   * Get current sync status
   * @returns Current sync status
   */
  getStatus(): SyncStatus;

  /**
   * Retry failed syncs
   */
  retryFailed(): Promise<void>;

  /**
   * Close sync service and cleanup resources
   */
  close(): Promise<void>;
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Health status for individual components
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Individual component health check result
 */
export interface ComponentHealth {
  component: string;
  status: HealthStatus;
  latencyMs?: number;
  message: string;
  details?: string[];
  timestamp: Date;
}

/**
 * Overall system health check result
 */
export interface HealthCheckResult {
  overall: HealthStatus;
  components: ComponentHealth[];
  timestamp: Date;
  exitCode: number;
}

/**
 * Health check thresholds for configurable limits
 */
export interface HealthCheckThresholds {
  maxLatencyMs?: number;
  maxQueueDepth?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  eventBus?: EventBus;
  stateManager?: StateManager;
  bmadTracker?: BMADTracker;
  agentRegistry?: AgentRegistry;
  thresholds?: HealthCheckThresholds;
  checkIntervalMs?: number;
}

/**
 * Health check service interface
 */
export interface HealthCheckService {
  /**
   * Run all health checks
   * @returns Health check result for all components
   */
  check(): Promise<HealthCheckResult>;

  /**
   * Run health check for a specific component
   * @param component - Component name to check
   * @returns Component health result
   */
  checkComponent(component: string): Promise<ComponentHealth>;

  /**
   * Get current health status
   * @returns Current health check result
   */
  getStatus(): HealthCheckResult;

  /**
   * Start periodic health checks
   */
  start(): Promise<void>;

  /**
   * Stop health checks and cleanup
   */
  stop(): Promise<void>;

  /**
   * Close health check service
   */
  close(): Promise<void>;
}

// =============================================================================
// AGENT CONFLICT DETECTION
// =============================================================================

/**
 * Agent conflict type classification
 */
export type AgentConflictType = "duplicate-assignment" | "concurrent-spawn" | "context-mismatch";

/**
 * Agent conflict severity based on impact
 */
export type AgentConflictSeverity = "critical" | "high" | "medium" | "low";

/**
 * Agent conflict event published when agent conflicts are detected
 */
export interface AgentConflictEvent {
  conflictId: string;
  storyId: string;
  existingAgent: string;
  conflictingAgent: string;
  type: AgentConflictType;
  detectedAt: Date;
  priorityScores: PriorityScores;
  resolution?: AgentConflictResolution;
}

/**
 * Priority scores for agent conflict resolution
 */
export interface PriorityScores {
  [agentId: string]: number;
}

/**
 * Agent conflict resolution information
 */
export interface AgentConflictResolution {
  resolution: "keep-existing" | "replace-with-new" | "manual";
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * Agent conflict with calculated severity and recommendations
 */
export interface AgentConflict {
  conflictId: string;
  storyId: string;
  existingAgent: string;
  conflictingAgent: string;
  type: AgentConflictType;
  detectedAt: Date;
  severity: AgentConflictSeverity;
  priorityScores: PriorityScores;
  resolution?: AgentConflictResolution;
  recommendations: string[];
}

/**
 * Agent conflict detection service interface
 */
export interface ConflictDetectionService {
  /**
   * Check if a story can be assigned to an agent without conflict
   * @param storyId - Story to check
   * @param agentId - Agent requesting assignment
   @returns true if no conflict, false otherwise
   */
  canAssign(storyId: string, agentId: string): boolean;

  /**
   * Detect conflicts for a potential story assignment
   * @param storyId - Story to check
   * @param agentId - Agent requesting assignment
   @returns Agent conflict event if conflict detected, null otherwise
   */
  detectConflict(storyId: string, agentId: string): AgentConflictEvent | null;

  /**
   * Record a conflict event
   * @param conflict - Conflict event to record
   */
  recordConflict(conflict: AgentConflictEvent): void;

  /**
   * Get all active conflicts
   @returns Array of active conflicts
   */
  getConflicts(): AgentConflict[];

  /**
   * Get conflicts for a specific story
   * @param storyId - Story to check
   @returns Conflicts for the story
   */
  getConflictsByStory(storyId: string): AgentConflict[];

  /**
   * Resolve a conflict
   * @param conflictId - Conflict ID to resolve
   @param resolution - Resolution action
   */
  resolveConflict(conflictId: string, resolution: AgentConflictResolution["resolution"]): void;

  /**
   * Calculate priority score for conflict resolution
   * @param conflict - Conflict to score
   @returns Priority scores for each agent
   */
  calculatePriorityScores(conflict: AgentConflictEvent): PriorityScores;

  /**
   * Attempt auto-resolution if enabled
   * @param conflict - Conflict to auto-resolve
   @returns true if auto-resolved, false otherwise
   */
  attemptAutoResolution(conflict: AgentConflictEvent): boolean;
}

/**
 * Conflict detection configuration
 */
export interface ConflictDetectionConfig {
  enabled: boolean;
  autoResolve?: {
    enabled: boolean;
    threshold?: number; // Priority difference threshold for auto-resolution
  };
}

// =============================================================================
// CONFLICT RESOLUTION
// =============================================================================

/**
 * Tie-breaking strategies for equal priority conflicts
 */
export type TieBreaker = "recent" | "progress";

/**
 * Resolution strategy configuration
 */
export interface ResolutionStrategy {
  autoResolve: boolean;
  tieBreaker: TieBreaker;
  notifyOnResolution?: boolean;
}

/**
 * Resolution result from conflict resolution
 */
export interface ResolutionResult {
  conflictId: string;
  action: "keep_existing" | "keep_new" | "terminate_both" | "manual";
  keptAgent: string | null;
  terminatedAgent: string | null;
  reason: string;
  resolvedAt: Date;
}

/**
 * Conflict resolution service configuration
 */
export interface ConflictResolutionConfig extends ResolutionStrategy {
  eventPublisher?: {
    publish(event: unknown): Promise<void>;
  };
}

/**
 * Conflict resolution service interface
 * Resolves agent assignment conflicts using priority-based rules
 */
export interface ConflictResolutionService {
  /**
   * Resolve a conflict using configured strategy
   * @param conflict - Conflict to resolve
   * @returns Resolution result with action taken
   */
  resolve(conflict: AgentConflict): Promise<ResolutionResult>;

  /**
   * Check if auto-resolution is enabled
   * @returns true if auto-resolve is enabled
   */
  canAutoResolve(): boolean;

  /**
   * Get the current resolution strategy
   * @returns Resolution strategy configuration
   */
  getResolutionStrategy(): ResolutionStrategy;
}
