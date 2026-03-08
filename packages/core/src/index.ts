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

// Conflict Resolver — detect and resolve version conflicts
export { createConflictResolver } from "./conflict-resolver.js";
export { ConflictError } from "./types.js";
export type {
  ConflictResolver,
  Conflict,
  FieldConflict,
  Resolution,
  ResolveResult,
  MergeSelections,
} from "./types.js";

// Sync Service — bidirectional state synchronization with BMAD tracker
export { createSyncService } from "./sync-service.js";
export type {
  SyncService,
  SyncServiceConfig,
  SyncDirection,
  SyncResult,
  SyncAllResult,
  SyncStatus,
  BMADTracker,
  ConflictInfo,
} from "./types.js";

// Notification Service — queue, deduplicate, and route notifications
export { createNotificationService } from "./notification-service.js";
export type { NotificationServiceConfig } from "./notification-service.js";
export type {
  NotificationService,
  Notification,
  NotificationResult,
  NotificationStatus,
  DeadLetterNotification,
  NotificationPlugin,
  NotificationPriority,
  NotificationPreferences,
} from "./types.js";

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

// Blocked Agent Detection — monitor and detect agent inactivity
export { createBlockedAgentDetector } from "./blocked-agent-detector.js";
export type { BlockedAgentDetectorDeps } from "./blocked-agent-detector.js";
export type {
  BlockedAgentDetector,
  BlockedAgentDetectorConfig,
  BlockedAgentStatus,
} from "./types.js";

// Error Logger — structured error logging with secret redaction
export { createErrorLogger } from "./error-logger.js";
export type { ErrorLoggerDeps } from "./error-logger.js";
export type {
  ErrorLogger,
  ErrorLoggerConfig,
  ErrorLog,
  ErrorLogEntry,
  ErrorLogOptions,
  ErrorFilter,
  ErrorRateSummary,
} from "./error-logger.js";

// Retry Service — retry with exponential backoff
export { createRetryService } from "./retry-service.js";
export type { RetryServiceDeps } from "./retry-service.js";
export type {
  RetryService,
  RetryServiceConfig,
  RetryOptions,
  RetryHistoryEntry,
  RetryError,
} from "./retry-service.js";

// Circuit Breaker — prevent cascading failures
export { createCircuitBreaker } from "./circuit-breaker.js";
export type { CircuitBreakerDeps } from "./circuit-breaker.js";
export type {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from "./circuit-breaker.js";

// Degraded Mode — graceful service degradation
export { createDegradedModeService } from "./degraded-mode.js";
export type {
  DegradedModeService,
  DegradedModeConfig,
  DegradedModeState,
  DegradedModeStatus,
  ServiceAvailability,
  ServiceHealthCheck,
  QueuedOperation,
  RecoveryCallback,
} from "./degraded-mode.js";

// Service Registry — global service instance access
export {
  registerDegradedModeService,
  registerEventPublisher,
  getDegradedModeService,
  getEventPublisher,
  clearServiceRegistry,
} from "./service-registry.js";

// Dead Letter Queue — persistent storage for failed operations
export { createDeadLetterQueue } from "./dead-letter-queue.js";
export type {
  DeadLetterQueueService,
  DLQConfig,
  DLQEntry,
  DLQStats,
  ReplayResult,
  AlertCallback,
} from "./dead-letter-queue.js";

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
