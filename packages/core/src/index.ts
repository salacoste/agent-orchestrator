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

// Plugin loader — discovers, validates, and manages plugins from YAML manifests
export { createPluginLoader, PermissionError } from "./plugin-loader.js";
export type {
  PluginPermission,
  PluginManifestWithMeta,
  PluginLoadResult,
  PluginLoaderOptions,
  PluginLoader,
} from "./plugin-loader.js";

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
  StoryUnblockedEvent,
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
export type {
  StateManager,
  StoryState,
  SetResult,
  BatchResult,
  SprintPlanView,
  SprintSummary,
  ActionableStory,
} from "./types.js";

// File Watcher — watch files for external changes and trigger cache invalidation
export { createFileWatcher } from "./file-watcher.js";
export type { FileWatcher, FileWatcherConfig } from "./types.js";

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

// Sync Bridge — orchestration wiring StateManager + FileWatcher + SyncService
export { createSyncBridge } from "./sync-bridge.js";
export type { SyncBridge, SyncBridgeConfig, SyncBridgeStatus } from "./sync-bridge.js";

// Notification Service — queue, deduplicate, and route notifications
export { createNotificationService } from "./notification-service.js";
export type { NotificationServiceConfig } from "./notification-service.js";

// Digest Generator — pure function for sprint digest content (Story 44.7)
export { generateDigest } from "./digest-generator.js";
export type { DigestInput, DigestContent, DigestSection } from "./digest-generator.js";

// Post-Mortem Generator — pure function for failure analysis (Story 45.3)
export { generatePostMortem } from "./postmortem-generator.js";
export type { PostMortemReport } from "./postmortem-generator.js";

// ROI Calculator — agent value proof (Story 45.4)
export { calculateROI, DEFAULT_ROI_CONFIG } from "./roi-calculator.js";
export type { ROIReport, ROIConfig } from "./roi-calculator.js";
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

// Notification Adapter — shared utilities for NotificationPlugin adapters
export {
  mapNotificationPriority,
  notificationToOrchestratorEvent,
} from "./notification-adapter.js";

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
  SessionLearning,
  ReviewFinding,
} from "./types.js";

// Blocked Agent Detection — monitor and detect agent inactivity
export { createBlockedAgentDetector } from "./blocked-agent-detector.js";
export type { BlockedAgentDetectorDeps } from "./blocked-agent-detector.js";
export type {
  BlockedAgentDetector,
  BlockedAgentDetectorConfig,
  BlockedAgentStatus,
} from "./types.js";

// Error Logger — structured error logging with secret redaction and classification
export {
  createErrorLogger,
  ERROR_CODES,
  registerClassificationRule,
  clearClassificationRules,
} from "./error-logger.js";
export type { ErrorClassificationRule } from "./error-logger.js";
export type { ErrorLoggerDeps } from "./error-logger.js";
export type {
  ErrorLogger,
  ErrorLoggerConfig,
  ErrorLog,
  ErrorLogEntry,
  ErrorLogOptions,
  ErrorFilter,
  ErrorRateSummary,
  ErrorSeverity,
  ErrorCode,
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

// Resilient Event Bus — circuit breaker + retry wrapper for EventBus
export { createResilientEventBus } from "./resilient-event-bus.js";
export type { ResilientEventBusDeps, ResilientEventBus } from "./resilient-event-bus.js";

// Resilient Service Wrapper — generic circuit breaker + retry for any async operation
export { withResilience, clearRetryServiceCache } from "./resilient-service-wrapper.js";
export type { ResilienceDeps } from "./resilient-service-wrapper.js";

// Circuit Breaker Manager — named breaker instances per service
export { createCircuitBreakerManager, SILENT_LOGGER } from "./circuit-breaker-manager.js";
export type {
  CircuitBreakerManager,
  CircuitBreakerManagerConfig,
  BreakerStateSnapshot,
} from "./circuit-breaker-manager.js";

// Service Registry — global service instance access
export {
  registerDegradedModeService,
  registerEventPublisher,
  registerBMADTracker,
  registerCircuitBreakerManager,
  getDegradedModeService,
  getEventPublisher,
  getBMADTracker,
  getCircuitBreakerManager,
  registerLearningStore,
  getLearningStore,
  registerSpawnQueue,
  getSpawnQueue,
  clearServiceRegistry,
} from "./service-registry.js";

// Spawn Queue — WIP-limited agent spawning (Story 43.3)
export { createSpawnQueue } from "./spawn-queue.js";
export type { SpawnQueue, SpawnQueueState, SpawnQueueConfig } from "./spawn-queue.js";

// Sprint Forecaster — predictive completion (Story 43.2)
export { computeForecast } from "./sprint-forecaster.js";
export type { SprintForecast, BacklogStory, ConfidenceLevel } from "./sprint-forecaster.js";

// Deadline Pressure — pragmatic trade-offs (Story 43.8)
export { detectDeadlinePressure } from "./deadline-pressure.js";
export type { DeadlinePressure, PressureLevel, PressureThresholds } from "./deadline-pressure.js";

// Business Hours — time-sensitive spawning gate (Story 43.7)
export { isWithinBusinessHours } from "./business-hours.js";
export type { BusinessHoursConfig } from "./business-hours.js";

// Scope Creep Detector — token/file budget monitoring (Story 43.6)
export { computeHistoricalAverages, checkScopeCreep } from "./scope-creep-detector.js";
export type {
  HistoricalAverages,
  ScopeCreepWarning,
  SessionUsage,
} from "./scope-creep-detector.js";

// Loop Detector — agent restart cycle breaker (Story 43.5)
export { createLoopDetector } from "./loop-detector.js";
export type { LoopDetector, LoopStatus } from "./loop-detector.js";

// Autopilot — supervised workflow advancement (Story 43.1)
export { createAutopilot } from "./autopilot.js";
export type {
  Autopilot,
  AutopilotConfig,
  AutopilotState,
  AutopilotAction,
  AutopilotMode,
} from "./autopilot.js";

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

// DLQ Enqueue Bridge — wires RetryService onNonRetryable to DLQ
export { createDLQEnqueueCallback } from "./dlq-enqueue-bridge.js";

// DLQ Auto-Replay — replays pending DLQ entries on startup
export { runDLQAutoReplay } from "./dlq-auto-replay.js";
export type { DLQAutoReplayResult } from "./dlq-auto-replay.js";

// EventBus Backlog Monitor — queue depth alerting
export { createEventBusBacklogMonitor } from "./eventbus-backlog-monitor.js";
export type { BacklogMonitorConfig, EventBusBacklogMonitor } from "./eventbus-backlog-monitor.js";

// DLQ Replay Handlers — service-specific replay logic for failed operations
export {
  registerReplayHandler,
  getReplayHandler,
  getRegisteredOperationTypes,
  clearReplayHandlers,
  replayEntry,
  replayEntries,
  bmadSyncHandler,
  eventPublishHandler,
  stateWriteHandler,
  NO_HANDLER_ERROR_PREFIX,
} from "./dlq-replay-handlers.js";
export type { DLQReplayHandlerFn, ReplayContext, DLQReplayResult } from "./dlq-replay-handlers.js";

// Session Learning — capture structured session outcomes for AI intelligence
export {
  captureSessionLearning,
  inferDomainTags,
  countTestFiles,
  getModifiedFiles,
  selectRelevantLearnings,
} from "./session-learning.js";

export { buildLearningsLayer } from "./prompt-builder.js";

// Learning Patterns — detect recurring failure patterns
export { detectPatterns } from "./learning-patterns.js";
export type { FailurePattern } from "./learning-patterns.js";

// Assignment Scorer — agent-story affinity scoring
export {
  scoreAffinity,
  registerAssignmentScorer,
  clearAssignmentScorers,
} from "./assignment-scorer.js";
export type { AffinityScore, AssignmentScorerFn } from "./assignment-scorer.js";

// Collaboration Service — multi-agent coordination
export {
  getReadyStories,
  buildHandoffContext,
  detectFileConflicts,
  buildCollabGraph,
} from "./collaboration-service.js";
export type {
  StoryDependency,
  HandoffRecord,
  FileConflict,
  CollabGraphEntry,
} from "./collaboration-service.js";

// Review Findings Store — JSONL storage for code review findings
export { createReviewFindingsStore } from "./review-findings-store.js";
export type { ReviewFindingsStore, ReviewFindingsStoreConfig } from "./review-findings-store.js";

// Learning Store — persistent JSONL storage for session learnings
export { createLearningStore } from "./learning-store.js";
export type { LearningStore, LearningStoreConfig, LearningQuery } from "./learning-store.js";

// Completion Handlers — handle agent completion and failure events
export {
  createCompletionHandler,
  createFailureHandler,
  logAuditEvent,
  updateSprintStatus,
  formatFailureReason,
  findDependentStories,
  areDependenciesSatisfied,
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

// Health Check — system component health monitoring
export { createHealthCheckService } from "./health-check.js";
export type {
  HealthCheckService,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckThresholds,
  ComponentHealth,
  HealthStatus,
} from "./health-check.js";

// Dependency Resolver — event-driven story unblocking on completion
export { createDependencyResolver } from "./dependency-resolver.js";
export type { DependencyResolverConfig, DependencyResolverService } from "./dependency-resolver.js";

// State Conflict Reconciler — orchestrates conflict detection, retry, and escalation
export { createStateConflictReconciler } from "./state-conflict-reconciler.js";
export type {
  StateConflictReconcilerConfig,
  ReconcileResult,
  StateConflictReconciler,
} from "./state-conflict-reconciler.js";

// Burndown Service — event-driven sprint burndown recalculation
export { createBurndownService } from "./burndown-service.js";
export type {
  BurndownServiceConfig,
  BurndownData,
  BurndownResult,
  BurndownService,
} from "./burndown-service.js";

// Assignment Service — priority-based story selection for multi-agent orchestration
export {
  selectNextStory,
  getAssignableStories,
  resolveDependencies,
} from "./assignment-service.js";
export type { StoryCandidate, DependencyResult, SprintStatusData } from "./assignment-service.js";

// Conflict Detection — detect and manage agent assignment conflicts
export { createConflictDetectionService } from "./conflict-detection.js";
export type {
  ConflictDetectionService,
  AgentConflictEvent,
  AgentConflict,
  AgentConflictType,
  AgentConflictSeverity,
  AgentConflictResolution,
  PriorityScores,
} from "./types.js";

// Conflict Resolution — resolve agent assignment conflicts
export { createConflictResolutionService } from "./conflict-resolution.js";
export type {
  ConflictResolutionService,
  ConflictResolutionConfig,
  ResolutionResult,
  ResolutionStrategy,
  TieBreaker,
} from "./types.js";

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

// Trigger Condition Evaluator — evaluate plugin triggers
export { createTriggerConditionEvaluator } from "./trigger-condition-evaluator.js";
export type {
  TriggerDefinition,
  TriggerEvaluator,
  TriggerResult,
  TriggerStats,
  TriggerCondition,
  SimpleCondition,
  StoryCondition,
  StringOperator,
  NumberOperator,
  TagOperator,
  EventCondition,
  TimeCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  ActionHandler,
  StoryAttributes,
  EventAttributes,
} from "./trigger-condition-evaluator.js";

// Workflow Engine — execute workflows defined in plugins
export { createWorkflowEngine } from "./workflow-engine.js";
export type {
  ActionHandler as WorkflowActionHandler,
  WorkflowContext,
  WorkflowStep,
  ConditionalExpression,
  TriggerDefinition as WorkflowTriggerDefinition,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowHistoryEntry,
  WorkflowExecutionResult,
  WorkflowEngine,
} from "./workflow-engine.js";

// Plugin Installer — install, update, uninstall plugins
export { createPluginInstaller, CURRENT_API_VERSION } from "./plugin-installer.js";
export type {
  PluginStatus,
  InstalledPlugin,
  PluginInstallResult,
  PluginSearchResult,
  PluginInstaller,
} from "./plugin-installer.js";

// NPM Plugin Registry — discover and publish plugins
export { createNpmPluginRegistry } from "./plugin-npm-registry.js";
export type {
  NpmPluginMetadata,
  NpmPluginDetails,
  NpmPublishResult,
  NpmValidationResult,
  NpmPluginRegistry,
} from "./plugin-npm-registry.js";

// Interface Validation — validate interface methods and create feature flags
export {
  validateInterfaceMethod,
  validateMethodSignature,
  createFeatureFlagCheck,
  generateFeatureFlagDocumentation,
  hasInterfaceMethod,
} from "./interface-validation.js";
export type {
  InterfaceValidationResult,
  MethodSignature,
  SignatureValidationResult,
  FeatureFlagConfig,
  FeatureFlagCheck,
} from "./interface-validation.js";

// Plugin Sandbox — isolated plugin execution
export { createPluginSandbox, createSandboxManager } from "./plugin-sandbox.js";
export type {
  SandboxConfig,
  SandboxResult,
  PluginSandbox,
  SandboxManager,
} from "./plugin-sandbox.js";

// Event Bus Integration — connects triggers and workflows to events
export {
  createEventBusIntegration,
  storyAttributesFromEvent,
  EventFactory,
} from "./event-bus-integration.js";
export type {
  IntegrationEventType,
  IntegrationEvent,
  EventBusIntegrationConfig,
  IntegrationStats,
  EventBusIntegration,
} from "./event-bus-integration.js";

// Health Check Rules Engine — custom health check rules with weights
export { createHealthCheckRulesEngine, CommonHealthRules } from "./health-check-rules.js";
export type {
  ComponentThresholds,
  ComponentWeight,
  CustomHealthCheckFn,
  CustomHealthCheckRule,
  HealthCheckRulesConfig,
  WeightedHealthResult,
  HealthCheckRulesEngine,
} from "./health-check-rules.js";

// Conflict Pattern Analysis — analyze conflict history and generate recommendations
export { createConflictPatternAnalysis } from "./conflict-patterns.js";
export type {
  ConflictPatternType,
  ConflictFrequency,
  ConflictPattern,
  PatternEvidence,
  PreventionRecommendation,
  TrendDataPoint,
  ConflictPatternConfig,
  ConflictPatternAnalysis,
} from "./conflict-patterns.js";

// Conflict Notification Integration — push notifications for conflict events
export { createConflictNotificationIntegration } from "./conflict-notification.js";
export type {
  ConflictNotificationConfig,
  ConflictNotificationStats,
  ConflictNotificationIntegration,
} from "./conflict-notification.js";

// Conflict Metrics — track prevention, auto-resolution, manual resolution
export { createConflictMetricsService } from "./conflict-metrics.js";
export type {
  ConflictResolutionType,
  ConflictMetricsSummary,
  ConflictMetricEvent,
  ConflictMetricsConfig,
  ConflictMetricsService,
} from "./conflict-metrics.js";

// Plugin Version Compatibility — version matrix and compatibility checking
export {
  createVersionCompatibilityMatrix,
  compareVersions,
  isValidSemver,
} from "./plugin-version-compatibility.js";
export type {
  CompatibilityStatus,
  CompatibilityResult,
  CompatibilityRange,
  PluginCompatibilityEntry,
  VersionCompatibilityConfig,
  VersionCompatibilityMatrix,
} from "./plugin-version-compatibility.js";

// Plugin Marketplace — search, browse, and install plugins from registry
export { createPluginMarketplace } from "./plugin-marketplace.js";
export type {
  PluginCategory,
  PluginRating,
  PluginReview,
  MarketplacePlugin,
  MarketplaceSearchOptions,
  MarketplaceSearchResult,
  PluginMarketplaceConfig,
  PluginMarketplace,
} from "./plugin-marketplace.js";
