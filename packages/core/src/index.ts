/**
 * @composio/ao-core
 *
 * Core library for the Agent Orchestrator.
 * Exports all types, config loader, and service implementations.
 */

// Types — everything plugins and consumers need
export * from "./types.js";

// Config — YAML loader + validation
export {
  loadConfig,
  loadConfigWithPath,
  validateConfig,
  getDefaultConfig,
  findConfig,
  findConfigFile,
  resolveAgentConfig,
} from "./config.js";

// Plugin registry
export { createPluginRegistry } from "./plugin-registry.js";

// Metadata — flat-file session metadata read/write
export {
  readMetadata,
  readMetadataRaw,
  writeMetadata,
  updateMetadata,
  deleteMetadata,
  listMetadata,
} from "./metadata.js";

// tmux — command wrappers
export {
  isTmuxAvailable,
  listSessions as listTmuxSessions,
  hasSession as hasTmuxSession,
  newSession as newTmuxSession,
  sendKeys as tmuxSendKeys,
  capturePane as tmuxCapturePane,
  killSession as killTmuxSession,
  getPaneTTY as getTmuxPaneTTY,
} from "./tmux.js";

// Session manager — session CRUD
export { createSessionManager } from "./session-manager.js";
export type { SessionManagerDeps } from "./session-manager.js";

// Lifecycle manager — state machine + reaction engine
export { createLifecycleManager } from "./lifecycle-manager.js";
export type { LifecycleManagerDeps } from "./lifecycle-manager.js";

// Agent Registry — story assignment tracking
export { getAgentRegistry, computeStoryContextHash } from "./agent-registry.js";
export type { AgentAssignment, AgentRegistry, AgentStatus } from "./types.js";

// Event Publisher — broadcast story state changes
export { createEventPublisher } from "./event-publisher.js";
export type { EventPublisherConfig } from "./event-publisher.js";
export type {
  EventPublisher,
  StoryCompletedEvent,
  StoryStartedEvent,
  StoryBlockedEvent,
  StoryAssignedEvent,
  AgentResumedEvent,
} from "./types.js";

// Event Subscription — subscribe to events with pattern matching and retry
export { createEventSubscription } from "./event-subscription.js";
export type { EventSubscriptionConfig } from "./event-subscription.js";
export type { EventHandler, EventBusCallback } from "./types.js";
export type {
  DeadLetterEvent,
  SubscriptionStats,
  SubscriptionHandle,
  AckCallback,
  AckContext,
  SubscriptionParams,
} from "./event-subscription.js";

// Audit Trail — append-only JSONL logging for all events
export { createAuditTrail } from "./audit-trail.js";
export type { AuditTrailConfig } from "./audit-trail.js";
export type {
  AuditTrail,
  AuditEvent,
  QueryParams,
  ExportParams,
  ReplayHandler,
  AuditTrailStats,
} from "./types.js";

// State Manager — write-through cache for sprint status
export { createStateManager } from "./state-manager.js";
export type { StateManager, StoryState, SetResult, BatchResult } from "./types.js";

// Agent Completion Detection — monitor and detect agent completion
export { createAgentCompletionDetector } from "./agent-completion-detector.js";
export type { AgentCompletionDetectorDeps } from "./agent-completion-detector.js";
export type {
  AgentCompletionDetector,
  DetectionStatus,
  CompletionEvent,
  FailureEvent,
  CompletionHandler,
  FailureHandler,
} from "./types.js";

// Completion Handlers — handle agent completion and failure events
export {
  createCompletionHandler,
  createFailureHandler,
  logAuditEvent,
  updateSprintStatus,
  formatFailureReason,
} from "./completion-handlers.js";

// Log Capture — capture and store agent session logs
export {
  captureTmuxSessionLogs,
  readLastLogLines,
  storeLogPathInMetadata,
  getLogFilePath,
  hasLogFile,
  deleteLogFile,
} from "./log-capture.js";

// Prompt builder — layered prompt composition
export { buildPrompt, BASE_AGENT_PROMPT } from "./prompt-builder.js";
export type { PromptBuildConfig } from "./prompt-builder.js";

// Orchestrator prompt — generates orchestrator context for `ao start`
export { generateOrchestratorPrompt } from "./orchestrator-prompt.js";
export type { OrchestratorPromptConfig } from "./orchestrator-prompt.js";

// Shared utilities
export { shellEscape, escapeAppleScript, validateUrl, readLastJsonlEntry } from "./utils.js";

// Path utilities — hash-based directory structure
export {
  generateConfigHash,
  generateProjectId,
  generateInstanceId,
  generateSessionPrefix,
  getProjectBaseDir,
  getSessionsDir,
  getWorktreesDir,
  getArchiveDir,
  getOriginFilePath,
  generateSessionName,
  generateTmuxName,
  parseTmuxName,
  expandHome,
  validateAndStoreOrigin,
} from "./paths.js";

// Config generator — auto-generate config from repo URL
export {
  isRepoUrl,
  parseRepoUrl,
  detectScmPlatform,
  detectDefaultBranchFromDir,
  detectProjectInfo,
  generateConfigFromUrl,
  configToYaml,
  isRepoAlreadyCloned,
  resolveCloneTarget,
  sanitizeProjectId,
} from "./config-generator.js";
export type {
  ParsedRepoUrl,
  ScmPlatform,
  DetectedProjectInfo,
  GenerateConfigOptions,
} from "./config-generator.js";
