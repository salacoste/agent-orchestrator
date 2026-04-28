---
title: SDK & Integration
nav_order: 10
description: Complete reference for the @composio/ao-core TypeScript SDK — types, configuration, plugin interfaces, services, and usage examples.
---

# SDK & Integration

The `@composio/ao-core` package is the core TypeScript library for the Agent Orchestrator. It exports all types, configuration loaders, service factories, and utilities needed to build plugins, integrate with the orchestrator, or extend its behavior.

{: .highlight }
> All exports use **ESM modules** with `.js` extensions in imports (e.g. `import { loadConfig } from "@composio/ao-core"`). Requires Node 20+ and TypeScript 5+.

---

## Installation

```bash
npm install @composio/ao-core
# or
pnpm add @composio/ao-core
```

**Peer requirements:**

- Node.js 20+
- TypeScript 5+ (with `"strict": true`)
- ESM (`"type": "module"` in your `package.json`)

```json
{
  "type": "module",
  "dependencies": {
    "@composio/ao-core": "^0.1.0"
  }
}
```

---

## Quick Start

```typescript
import {
  loadConfig,
  createSessionManager,
  createPluginRegistry,
} from "@composio/ao-core";

// Load configuration from agent-orchestrator.yaml
const config = await loadConfig("./agent-orchestrator.yaml");

// Create a plugin registry and load plugins
const registry = createPluginRegistry();
// registry.register(pluginModule, pluginConfig);
// const runtime = registry.get<Runtime>("runtime", "tmux");

// Create a session manager
const sessionManager = createSessionManager({
  config,
  runtime,     // Runtime plugin instance
  agent,       // Agent plugin instance
  workspace,   // Workspace plugin instance
  // ... other dependencies
});
```

{: .note }
> `loadConfig` validates the YAML against a Zod schema and throws typed errors on invalid configuration. See [Configuration](../getting-started/configuration/) for the full config reference.

---

## Core Plugin Interfaces

The orchestrator defines 8 plugin slots. Every plugin implements an interface from `packages/core/src/types.ts`. See [Architecture Overview](../getting-started/architecture-overview/) for the system design and [Plugin Development](../contributing/plugin-development/) for authoring guides.

### Runtime (Slot 1)

Manages where and how agent sessions execute (tmux, docker, k8s, process).

```typescript
import type { Runtime, RuntimeHandle, RuntimeCreateConfig } from "@composio/ao-core";
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(config: RuntimeCreateConfig) => Promise<RuntimeHandle>` | Create session environment |
| `destroy` | `(handle: RuntimeHandle) => Promise<void>` | Destroy session environment |
| `sendMessage` | `(handle: RuntimeHandle, message: string) => Promise<void>` | Send prompt to agent |
| `getOutput` | `(handle: RuntimeHandle, lines?: number) => Promise<string>` | Capture recent output |
| `isAlive` | `(handle: RuntimeHandle) => Promise<boolean>` | Check if session is alive |
| `getMetrics?` | `(handle: RuntimeHandle) => Promise<RuntimeMetrics>` | Resource metrics (uptime, memory, CPU) |
| `getAttachInfo?` | `(handle: RuntimeHandle) => Promise<AttachInfo>` | Info for human to attach |
| `getExitCode?` | `(handle: RuntimeHandle) => Promise<number \| null \| undefined>` | Process exit code |

**Supporting types:**

```typescript
interface RuntimeCreateConfig {
  sessionId: SessionId;
  workspacePath: string;
  launchCommand: string;
  environment: Record<string, string>;
}

interface RuntimeHandle {
  id: string;              // tmux session name, container ID, etc.
  runtimeName: string;
  data: Record<string, unknown>;
}

interface RuntimeMetrics {
  uptimeMs: number;
  memoryMb?: number;
  cpuPercent?: number;
}
```

### Agent (Slot 2)

Adapts a specific AI coding tool (Claude Code, Codex, Aider, OpenCode).

```typescript
import type { Agent, AgentLaunchConfig, AgentSessionInfo } from "@composio/ao-core";
```

| Property/Method | Description |
|-----------------|-------------|
| `name` | Adapter name (e.g. `"claude-code"`) |
| `processName` | Process name to detect (e.g. `"claude"`) |
| `promptDelivery?` | `"inline"` or `"post-launch"` |
| `getLaunchCommand(config)` | Shell command to launch the agent |
| `getEnvironment(config)` | Environment variables for the process |
| `getActivityState(session, readyThresholdMs?)` | Native activity detection |
| `isProcessRunning(handle)` | Check if agent process is alive |
| `getSessionInfo(session)` | Extract summary, cost, session ID |
| `getRestoreCommand?(session, project)` | Command to resume a previous session |
| `postLaunchSetup?(session)` | Setup after agent starts |
| `setupWorkspaceHooks?(workspacePath, config)` | Auto metadata updates via git/gh hooks |

### Workspace (Slot 3)

Manages code isolation — how each session gets its own copy of the repo (worktree, clone).

```typescript
import type { Workspace, WorkspaceInfo, WorkspaceCreateConfig } from "@composio/ao-core";
```

| Method | Description |
|--------|-------------|
| `create(config)` | Create isolated workspace |
| `destroy(workspacePath)` | Destroy workspace |
| `list(projectId)` | List existing workspaces |
| `postCreate?(info, project)` | Post-creation hooks (symlinks, installs) |
| `exists?(workspacePath)` | Check workspace validity |
| `restore?(config, workspacePath)` | Restore workspace for existing branch |

### Tracker (Slot 4)

Issue/task tracker integration (GitHub Issues, Linear, Jira, bmad).

```typescript
import type { Tracker, Issue, IssueFilters } from "@composio/ao-core";
```

| Method | Description |
|--------|-------------|
| `getIssue(identifier, project)` | Fetch issue details |
| `isCompleted(identifier, project)` | Check if issue is done |
| `issueUrl(identifier, project)` | Generate issue URL |
| `issueLabel?(url, project)` | Extract readable label (e.g. `"#42"`) |
| `branchName(identifier, project)` | Generate branch name |
| `generatePrompt(identifier, project)` | Generate agent prompt from issue |
| `listIssues?(filters, project)` | List issues with filters |
| `updateIssue?(identifier, update, project)` | Update issue state |
| `createIssue?(input, project)` | Create new issue |
| `validateIssue?(identifier, project)` | Pre-flight validation |
| `onPRMerge?(issueId, prUrl, project)` | Handle PR merge for issue |
| `onSessionDeath?(issueId, project, sessionId?)` | Reset status on session death |

### SCM (Slot 5)

Source code management platform — PR lifecycle, CI checks, code reviews.

```typescript
import type { SCM, PRInfo, PRState, CICheck, Review, MergeReadiness } from "@composio/ao-core";
```

| Method | Description |
|--------|-------------|
| `detectPR(session, project)` | Detect open PR by branch |
| `getPRState(pr)` | Current PR state (`open`, `merged`, `closed`) |
| `getPRSummary?(pr)` | PR stats (additions, deletions) |
| `mergePR(pr, method?)` | Merge a PR |
| `closePR(pr)` | Close without merging |
| `getCIChecks(pr)` | Individual CI check statuses |
| `getCISummary(pr)` | Overall CI status |
| `getReviews(pr)` | All reviews on a PR |
| `getReviewDecision(pr)` | Overall review decision |
| `getPendingComments(pr)` | Unresolved review comments |
| `getAutomatedComments(pr)` | Bot/linter/security comments |
| `getMergeability(pr)` | Check merge readiness |

### Notifier (Slot 6)

Push notifications to humans (desktop, Slack, Discord, webhook).

```typescript
import type { Notifier, OrchestratorEvent, NotifyAction } from "@composio/ao-core";
```

| Method | Description |
|--------|-------------|
| `notify(event)` | Push a notification |
| `notifyWithActions?(event, actions)` | Notification with action buttons |
| `post?(message, context?)` | Post to a channel (Slack, Discord) |

### Terminal (Slot 7)

Manages how humans view and interact with running sessions (iTerm2, web).

```typescript
import type { Terminal, Session } from "@composio/ao-core";
```

| Method | Description |
|--------|-------------|
| `openSession(session)` | Open session for interaction |
| `openAll(sessions)` | Open all sessions for a project |
| `isSessionOpen?(session)` | Check if session is already open |

### Provider (Slot 8)

Session enhancement — hooks, prompt layers, model routing (raw, omc, custom).

```typescript
import type { SessionEnhancementConfig, ProviderHealthConfig } from "@composio/ao-core";
```

---

## Configuration Types

### OrchestratorConfig

Top-level configuration loaded from `agent-orchestrator.yaml`.

```typescript
import type { OrchestratorConfig } from "@composio/ao-core";
```

| Field | Type | Description |
|-------|------|-------------|
| `configPath` | `string` | Config file path (auto-set) |
| `port?` | `number` | Web dashboard port (default: `5000`) |
| `terminalPort?` | `number` | Terminal WS port (default: `3001`) |
| `directTerminalPort?` | `number` | Direct terminal WS port (default: `3003`) |
| `readyThresholdMs` | `number` | Ready-to-idle threshold in ms (default: `300000`) |
| `projectsDir?` | `string` | Base directory for project paths |
| `defaults` | `DefaultPlugins` | Default plugin selections |
| `projects` | `Record<string, ProjectConfig>` | Project configurations |
| `notifiers` | `Record<string, NotifierConfig>` | Notification channel configs |
| `notificationRouting` | `Record<EventPriority, string[]>` | Priority-to-channel routing |
| `reactions` | `Record<string, ReactionConfig>` | Default reaction configs |
| `health?` | `HealthYamlConfig` | Health monitoring |
| `maxConcurrentAgents?` | `number` | Max concurrent agents |
| `autopilot?` | `"off" \| "supervised" \| "autonomous"` | Autopilot mode |
| `sessionEnhancement?` | `SessionEnhancementConfig` | Provider config |

### ProjectConfig

Per-project configuration within the `projects` map.

```typescript
import type { ProjectConfig } from "@composio/ao-core";
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name |
| `repo` | `string` | GitHub repo in `owner/repo` format |
| `path` | `string` | Local path to the repo |
| `defaultBranch` | `string` | Default git branch |
| `sessionPrefix` | `string` | Session name prefix (e.g. `"app"` → `"app-1"`) |
| `agent?` | `string` | Override default agent plugin |
| `tracker?` | `TrackerConfig` | Issue tracker config |
| `scm?` | `SCMConfig` | SCM config |
| `sharedPool?` | `SharedPoolConfig` | Shared agent pool |
| `verification?` | `VerificationConfig` | Verification gate |
| `learning?` | `object` | AI learning config |
| `agentRules?` | `string` | Inline agent rules |
| `agentRulesFile?` | `string` | Agent rules file path |
| `reactions?` | `Record<string, Partial<ReactionConfig>>` | Per-project reaction overrides |
| `sessionEnhancement?` | `SessionEnhancementConfig` | Per-project provider override |
| `isolation?` | `"shared" \| "isolated" \| "quarantined"` | Agent isolation level |

### SharedPoolConfig

Cross-project agent sharing.

```typescript
import type { SharedPoolConfig } from "@composio/ao-core";
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Enable shared pool mode |
| `eligibleProjects` | `string[]` | Target project IDs or `["*"]` |
| `maxConcurrent?` | `number` | Max concurrent cross-project assignments |
| `reservedAgents?` | `string[]` | Agents not shared with other projects |
| `priority?` | `number` | Project priority (higher = preferred) |
| `allocationWeights?` | `AllocationWeights` | Custom scoring weights |

### VerificationConfig

Verification gate for quality checks before story completion.

```typescript
import type { VerificationConfig, VerificationCheck } from "@composio/ao-core";
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Enable verification gate |
| `checks` | `VerificationCheck[]` | Checks to run |
| `onFailure?` | `"block" \| "review"` | Failure behavior (default: `"review"`) |
| `retry?` | `VerificationRetryConfig` | Auto-retry config |
| `persistent?` | `PersistentConfig` | Persistent execution config |

### ReactionConfig

Automatic reactions to orchestrator events.

```typescript
import type { ReactionConfig } from "@composio/ao-core";
```

| Field | Type | Description |
|-------|------|-------------|
| `auto` | `boolean` | Execute automatically or notify only |
| `action` | `"send-to-agent" \| "notify" \| "auto-merge"` | What the reaction does |
| `message?` | `string` | Text sent to agent (for `send-to-agent`) |
| `priority?` | `EventPriority` | Notification priority |
| `retries?` | `number` | Max non-escalating attempts |
| `escalateAfter?` | `number \| string` | Escalation threshold |
| `threshold?` | `string` | Duration before triggering (e.g. `"10m"`) |
| `includeSummary?` | `boolean` | Include session summary |

---

## Session & Event Types

### Session

A running agent session with lifecycle state and metadata.

```typescript
import type { Session, SessionId, SessionStatus, ActivityState } from "@composio/ao-core";
```

**SessionStatus** lifecycle states:

```text
spawning → working → pr_open → ci_failed → review_pending → changes_requested
        → approved → mergeable → merged → cleanup → done
        → stuck / errored / needs_input / blocked / paused / killed / terminated
```

**ActivityState** values: `active`, `ready`, `idle`, `waiting_input`, `blocked`, `exited`

### SessionSpawnConfig

Configuration for spawning a new session.

```typescript
import type { SessionSpawnConfig } from "@composio/ao-core";

const spawnConfig: SessionSpawnConfig = {
  projectId: "frontend",
  issueId: "42-5-login-page",
  branch: "story/42-5-login",
  prompt: "Implement the login page...",
  agent: "claude-code",
  storyContext: "...",    // Pre-formatted from sprint-status + story file
  priority: 5,            // Higher = spawn first
  modelTier: "high",      // "low" | "medium" | "high"
};
```

### EventType

All orchestrator event types emitted during the session lifecycle.

```typescript
import type { EventType, EventPriority, OrchestratorEvent } from "@composio/ao-core";
```

| Category | Events |
|----------|--------|
| Session | `session.spawned`, `session.working`, `session.exited`, `session.killed`, `session.stuck`, `session.needs_input`, `session.errored` |
| PR | `pr.created`, `pr.updated`, `pr.merged`, `pr.closed` |
| CI | `ci.passing`, `ci.failing`, `ci.fix_sent`, `ci.fix_failed` |
| Review | `review.pending`, `review.approved`, `review.changes_requested`, `review.comments_sent`, `review.comments_unresolved` |
| Automated Review | `automated_review.found`, `automated_review.fix_sent` |
| Merge | `merge.ready`, `merge.conflicts`, `merge.completed` |
| Reaction | `reaction.triggered`, `reaction.escalated` |
| Summary | `summary.all_complete` |
| Tracker | `tracker.story_done`, `tracker.sprint_complete` |
| Agent | `agent.blocked`, `agent.resumed`, `agent.capacity_reached`, `agent.capacity_warning` |
| Verification | `verification.passed`, `verification.failed` |

**EventPriority** values: `urgent`, `action`, `warning`, `info`

---

## Services

### Configuration

```typescript
import {
  loadConfig,
  loadConfigWithPath,
  validateConfig,
  getDefaultConfig,
  findConfig,
  findConfigFile,
  resolveAgentConfig,
} from "@composio/ao-core";

// Load and validate config
const config = await loadConfig("./agent-orchestrator.yaml");

// Load with path info
const { config: cfg, path } = await loadConfigWithPath("./agent-orchestrator.yaml");

// Validate without loading
const isValid = validateConfig(rawConfig);

// Find config in directory tree
const configPath = await findConfig(process.cwd());
```

### Plugin Registry

```typescript
import { createPluginRegistry } from "@composio/ao-core";

const registry = createPluginRegistry();
```

### Plugin Loader

```typescript
import {
  createPluginLoader,
  PermissionError,
} from "@composio/ao-core";
import type {
  PluginLoader,
  PluginLoadResult,
  PluginManifestWithMeta,
} from "@composio/ao-core";

const loader = createPluginLoader({ config });
const results = await loader.loadAll();
```

### Session Manager

```typescript
import { createSessionManager, resolveModelTiers } from "@composio/ao-core";
import type { SessionManagerDeps } from "@composio/ao-core";

const deps: SessionManagerDeps = {
  config,
  runtime,     // Runtime plugin
  agent,       // Agent plugin
  workspace,   // Workspace plugin
  tracker,     // Tracker plugin
  scm,         // SCM plugin
  // ... other deps
};
const sessionManager = createSessionManager(deps);
```

### Lifecycle Manager

State machine and reaction engine for session lifecycle.

```typescript
import { createLifecycleManager } from "@composio/ao-core";
import type { LifecycleManagerDeps } from "@composio/ao-core";

const lifecycle = createLifecycleManager(deps);
```

### Health Check Service

```typescript
import { createHealthCheckService } from "@composio/ao-core";
import type {
  HealthCheckService,
  HealthCheckConfig,
  HealthCheckResult,
  ComponentHealth,
  HealthStatus,
} from "@composio/ao-core";
```

**HealthStatus** values: `healthy`, `degraded`, `unhealthy`

### Spawn Queue

WIP-limited agent spawning.

```typescript
import { createSpawnQueue } from "@composio/ao-core";
import type { SpawnQueue, SpawnQueueConfig } from "@composio/ao-core";

const queue = createSpawnQueue({ maxConcurrent: 5 });
```

### Autopilot

Supervised workflow advancement.

```typescript
import { createAutopilot } from "@composio/ao-core";
import type {
  Autopilot,
  AutopilotConfig,
  AutopilotMode,
} from "@composio/ao-core";

const autopilot = createAutopilot({
  mode: "supervised",    // "off" | "supervised" | "autonomous"
});
```

---

## Intelligence Services

### Model Routing

Maps story complexity to model tier for cost-optimized agent assignment.

```typescript
import {
  createModelRoutingService,
  modelRoutingService,
  classifyStoryComplexity,
} from "@composio/ao-core";
import type { ModelRoutingService, ModelTier, ResolveTierOptions } from "@composio/ao-core";

// Classify a story
const complexity = classifyStoryComplexity("Fix login button CSS alignment");
// → "low" → routes to haiku

// Resolve tier with config
const tier = modelRoutingService.resolveTier({
  storyDescription: "Implement OAuth2 authentication flow",
  modelTiers: { low: "haiku", medium: "sonnet", high: "opus" },
});
// → "high" → routes to opus
```

**ModelTier** values: `"low"`, `"medium"`, `"high"`

### Assignment Service

Priority-based story selection for multi-agent orchestration.

```typescript
import {
  selectNextStory,
  getAssignableStories,
  resolveDependencies,
} from "@composio/ao-core";
import type { StoryCandidate, DependencyResult } from "@composio/ao-core";
```

### Shared Pool Allocation

```typescript
import {
  allocateAgents,
  computeAllocationScore,
  DEFAULT_MAX_CONCURRENT,
} from "@composio/ao-core";
import type {
  AllocationRequest,
  AllocationDecision,
  AllocationFactors,
} from "@composio/ao-core";
```

### Agent Utilization

```typescript
import {
  computeAgentUtilization,
  computeProjectUtilization,
  computePoolUtilizationOverview,
} from "@composio/ao-core";
import type {
  AgentUtilization,
  ProjectAgentUtilization,
  PoolUtilizationOverview,
} from "@composio/ao-core";
```

### Capacity Check

```typescript
import {
  checkCapacity,
  isAtCapacity,
  guardAssignment,
  CapacityExceededError,
} from "@composio/ao-core";
import type { CapacityResult, GuardResult } from "@composio/ao-core";
```

### Cross-Project Dependencies

```typescript
import {
  addCrossProjectDependency,
  removeCrossProjectDependency,
  buildCrossProjectGraph,
  detectCircularDependency,
  CircularDependencyError,
  getBlockingAlerts,
} from "@composio/ao-core";
import type {
  CrossProjectDependency,
  CrossProjectGraph,
  DependencyBlockingAlert,
} from "@composio/ao-core";
```

---

## Resilience Services

### Retry Service

```typescript
import { createRetryService } from "@composio/ao-core";
import type {
  RetryService,
  RetryServiceConfig,
  RetryOptions,
} from "@composio/ao-core";

const retry = createRetryService(deps);
const result = await retry.execute(() => fetch(url), {
  maxAttempts: 3,
  backoffMs: 1000,
});
```

### Circuit Breaker

```typescript
import { createCircuitBreaker } from "@composio/ao-core";
import type {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from "@composio/ao-core";

const breaker = createCircuitBreaker(deps, {
  failureThreshold: 3,
  openDurationMs: 60000,
});
```

### Circuit Breaker Manager

Named breaker instances per service.

```typescript
import { createCircuitBreakerManager } from "@composio/ao-core";
import type {
  CircuitBreakerManager,
  BreakerStateSnapshot,
} from "@composio/ao-core";
```

### Degraded Mode Service

```typescript
import { createDegradedModeService } from "@composio/ao-core";
import type {
  DegradedModeService,
  DegradedModeState,
  ServiceAvailability,
} from "@composio/ao-core";

const degraded = createDegradedModeService(deps);
```

### Resilient Event Bus

```typescript
import { createResilientEventBus } from "@composio/ao-core";
import type { ResilientEventBus } from "@composio/ao-core";
```

### Dead Letter Queue

```typescript
import {
  createDeadLetterQueue,
  runDLQAutoReplay,
} from "@composio/ao-core";
import type {
  DeadLetterQueueService,
  DLQEntry,
  DLQStats,
} from "@composio/ao-core";

const dlq = createDeadLetterQueue({ dataDir: "./data" });
await runDLQAutoReplay(dlq, handlers);
```

---

## Learning & Memory

### Session Learning

Capture structured session outcomes for AI intelligence.

```typescript
import {
  captureSessionLearning,
  selectRelevantLearnings,
} from "@composio/ao-core";
```

### Learning Store

Persistent JSONL storage for session learnings.

```typescript
import { createLearningStore } from "@composio/ao-core";
import type { LearningStore, LearningQuery } from "@composio/ao-core";

const store = createLearningStore({ learningsPath: "./data/learnings.jsonl" });
const learnings = store.query({ domain: "authentication", limit: 5 });
```

### Prompt Builder

5-layer prompt composition system.

```typescript
import { buildPrompt, BASE_AGENT_PROMPT, buildLearningsLayer } from "@composio/ao-core";
import type { PromptBuildConfig } from "@composio/ao-core";

const prompt = buildPrompt({
  projectConfig,
  storyContext: "...",
  agentRules: "...",
  learnings: [...],
  memory: [...],
});
```

| Layer | Heading | Config Gate |
|-------|---------|-------------|
| 1. Base | (inline) | Always |
| 2. Config | `## Project Context`, `## Task` | Always |
| 3. Rules | `## Project Rules` | `agentRules` or `agentRulesFile` |
| 4. Learnings | `## Lessons from Past Sessions` | `learning.injectInPrompts` |
| 5. Memory | `## Cross-Session Knowledge` | `learning.crossSessionMemory` |

### Notepad (Compaction Survival)

```typescript
import {
  createNotepad,
  readNotepad,
  writeNotepadSection,
} from "@composio/ao-core";
import type { NotepadSection, NotepadContent } from "@composio/ao-core";
```

### Hooks

Compaction survival lifecycle with pre/post-compact phases.

```typescript
import {
  createHookRegistry,
  registerDefaultHooks,
  HOOK_PROFILES,
  detectStoryType,
} from "@composio/ao-core";
import type {
  HookPhase,
  PreCompactHook,
  PostCompactHook,
  HookRegistry,
  StoryType,
} from "@composio/ao-core";

const hooks = createHookRegistry();
registerDefaultHooks(hooks);

// Detect story type from keywords
const type = detectStoryType("Fix login button CSS bug");
// → "bugfix"
```

---

## Utility Functions

### Config Generator

Auto-generate configuration from a repository URL.

```typescript
import {
  isRepoUrl,
  parseRepoUrl,
  generateConfigFromUrl,
  configToYaml,
} from "@composio/ao-core";
import type { ParsedRepoUrl, GenerateConfigOptions } from "@composio/ao-core";

if (isRepoUrl("https://github.com/org/repo")) {
  const parsed = parseRepoUrl("https://github.com/org/repo");
  // → { owner: "org", repo: "repo", platform: "github" }

  const config = await generateConfigFromUrl("https://github.com/org/repo", {
    agent: "claude-code",
  });
  const yaml = configToYaml(config);
}
```

### Paths

Hash-based directory structure utilities.

```typescript
import {
  generateConfigHash,
  generateSessionPrefix,
  getProjectBaseDir,
  getSessionsDir,
  expandHome,
} from "@composio/ao-core";
```

### Metadata

Flat-file session metadata read/write.

```typescript
import {
  readMetadata,
  writeMetadata,
  updateMetadata,
  deleteMetadata,
  listMetadata,
} from "@composio/ao-core";

// Read session metadata
const meta = await readMetadata(sessionId, dataDir);

// Update specific fields
await updateMetadata(sessionId, dataDir, { status: "working" });
```

### Shell Utilities

```typescript
import { shellEscape, escapeAppleScript, validateUrl } from "@composio/ao-core";

// Safe shell argument escaping
const safe = shellEscape('file name with spaces; rm -rf /');
// → properly escaped string

// AppleScript string escaping
const appleSafe = escapeAppleScript('string with "quotes"');

// URL validation
const isValid = validateUrl("https://github.com/org/repo");
```

### tmux Helpers

```typescript
import {
  isTmuxAvailable,
  listTmuxSessions,
  hasTmuxSession,
  newTmuxSession,
  tmuxSendKeys,
  tmuxCapturePane,
  killTmuxSession,
} from "@composio/ao-core";

if (await isTmuxAvailable()) {
  const sessions = await listTmuxSessions();
}
```

---

## Additional Exports

### State Management

```typescript
import { createStateManager } from "@composio/ao-core";
import type { StateManager, StoryState, SprintPlanView } from "@composio/ao-core";
```

### Audit Trail

```typescript
import { createAuditTrail } from "@composio/ao-core";
import type { AuditTrail, AuditEvent, AuditTrailStats } from "@composio/ao-core";
```

### Event Subscription

```typescript
import { createEventSubscription } from "@composio/ao-core";
import type { SubscriptionHandle, SubscriptionParams } from "@composio/ao-core";
```

### Sprint Simulation & Forecasting

```typescript
import {
  simulateSprint,
  computeForecast,
  detectDeadlinePressure,
  computeSprintDiff,
} from "@composio/ao-core";
```

### Analytics

```typescript
import {
  calculateROI,
  generateStandup,
  calculateConfidence,
  extractReasoning,
  generatePostMortem,
  generateDigest,
} from "@composio/ao-core";
```

### Security & Identity

```typescript
import {
  resolveUser,
  hasPermission,
  createApprovalService,
  checkAccess,
  createResourcePool,
} from "@composio/ao-core";
```

---

## Related Documentation

- **[Architecture Overview](../getting-started/architecture-overview/)** — 8 plugin slots and system design
- **[Configuration](../getting-started/configuration/)** — full YAML config reference
- **[Plugin Development](../contributing/plugin-development/)** — complete plugin authoring guide
- **[API Reference](../api/)** — REST API endpoints
- **[Quick Start](../getting-started/quick-start/)** — get started with the orchestrator
