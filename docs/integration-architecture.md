# Integration Architecture

How the packages, plugins, events, and data flows connect in the Agent Orchestrator system.

---

## Inter-Package Dependencies

```
packages/core/          @composio/ao-core
  ├── Types, config, all service implementations
  ├── Zero runtime dependencies on cli/ or web/
  └── Every other package depends on this

packages/cli/           @composio/ao-cli
  ├── Depends on: @composio/ao-core, all @composio/ao-plugin-* packages
  ├── Commander.js command tree (66 commands)
  └── Statically imports plugin packages for bundling

packages/web/           @composio/ao-web
  ├── Depends on: @composio/ao-core, subset of @composio/ao-plugin-* packages
  ├── Next.js 15 App Router dashboard
  └── Statically imports plugins (webpack cannot resolve dynamic imports)

packages/plugins/       @composio/ao-plugin-*
  ├── Each depends on: @composio/ao-core (for type imports only)
  ├── Zero cross-plugin dependencies
  └── Each exports a PluginModule<T> with manifest + create()
```

**Dependency direction is strictly one-way**: plugins and consumers import from core; core never imports from cli, web, or plugins.

---

## Plugin System

### Plugin Slots

Eight pluggable plugin slots plus core lifecycle (not pluggable):

| Slot | Interface | Default | Implementations |
|------|-----------|---------|-----------------|
| Runtime | `Runtime` | tmux | tmux, process |
| Agent | `Agent` | claude-code | claude-code, codex, aider, opencode, glm |
| Workspace | `Workspace` | worktree | worktree, clone |
| Tracker | `Tracker` | github | github, linear, bmad |
| SCM | `SCM` | github | github |
| Notifier | `Notifier` | desktop | desktop, composio, slack, webhook |
| Terminal | `Terminal` | iterm2 | iterm2, web |
| EventBus | `EventBus` | (in-memory) | redis |
| Lifecycle | (core) | — | Not pluggable |

### Plugin Module Contract

Every plugin exports a `PluginModule<T>` with compile-time type checking via `satisfies`:

```typescript
// packages/plugins/runtime-tmux/src/index.ts
export const manifest = {
  name: "tmux",
  slot: "runtime" as const,
  description: "Runtime plugin: tmux sessions",
  version: "0.1.0",
};

export function create(): Runtime { /* ... */ }

export default { manifest, create } satisfies PluginModule<Runtime>;
```

### Plugin Discovery and Loading

There are two plugin loading paths depending on the consumer:

**CLI path** (`packages/cli/src/lib/create-session-manager.ts`):
1. `createPluginRegistry()` creates an empty registry.
2. `registry.loadFromConfig(config, importFn)` is called with the CLI's own `import()` function.
3. Internally, `loadFromConfig` calls `loadBuiltins()` which iterates a hardcoded `BUILTIN_PLUGINS` list in `packages/core/src/plugin-registry.ts`.
4. Each entry maps a `(slot, name)` pair to an npm package name (e.g., `runtime:tmux` -> `@composio/ao-plugin-runtime-tmux`).
5. Dynamic `import(pkg)` loads the module, then `registry.register(mod, pluginConfig)` stores it.
6. Failed imports are silently skipped (plugin not installed).

**Web path** (`packages/web/src/lib/services.ts`):
1. Plugins are statically imported as ES modules (webpack requires string literal imports).
2. Each plugin is registered manually: `registry.register(pluginRuntimeTmux)`.
3. Only the plugins the dashboard needs are imported (no notifier or terminal plugins).

**YAML manifest path** (`packages/core/src/plugin-loader.ts`):
1. Scans a directory for `plugin.yaml` files.
2. Validates required fields (name, version, description, apiVersion, main, permissions).
3. Checks API version compatibility (exact match).
4. Enforces permission boundaries via `checkPermission()` / `requirePermission()`.
5. Supports hot-reload via `reload()` (clear registry, rescan).

### Plugin Registry

`packages/core/src/plugin-registry.ts` maintains an in-memory `Map<"slot:name", { manifest, instance, module }>`. Key operations:

- `register(plugin, config?)` -- Instantiate via `plugin.create(config)`, store, call `init()` asynchronously.
- `get<T>(slot, name)` -- Look up by `"slot:name"` key, return typed instance or null.
- `loadBuiltins(config?, importFn?)` -- Dynamic-import all known built-in packages.
- `shutdown(slot, name)` / `shutdownAll()` -- Capture state, call shutdown hooks, remove from map.
- `reload(slot, name)` -- Capture state, shutdown, clear module cache, re-import, create new instance, restore state, call init.

### Plugin Lifecycle Hooks

```
register() -> create(config) -> init() -> [running] -> shutdown()
                                   |                       |
                                   +-- getState() ---------+-- captureState()
                                                           +-- restoreState()
```

- `init()`: Called asynchronously after registration (non-blocking).
- `shutdown()`: Called before unload; instance-level runs before module-level.
- `getState()` / `setState()`: Used during hot-swap to preserve plugin state across reloads.

---

## Event System

### EventBus Interface

The `EventBus` is the backbone for real-time event distribution. Defined in `packages/core/src/types.ts`:

```typescript
interface EventBus {
  publish(event: Omit<EventBusEvent, "eventId" | "timestamp">): Promise<void>;
  subscribe(callback: EventSubscriber): Promise<() => void>;
  isConnected(): boolean;
  isDegraded(): boolean;
  getQueueSize(): number;
  ping?(): Promise<number | undefined>;
  close(): Promise<void>;
}

interface EventBusConfig {
  host: string;           // Redis host
  port: number;           // Redis port
  db?: number;            // Redis database index
  password?: string;      // Redis password
  channel?: string;       // Pub/Sub channel name
  retryDelays?: number[]; // Exponential backoff
  queueMaxSize?: number;  // Disconnected-mode queue cap
  enableAOF?: boolean;    // Redis durability
}
```

Supports Redis-backed or in-memory implementations. When disconnected, events are queued internally up to `queueMaxSize` (default: 1000).

### EventPublisher

`packages/core/src/event-publisher.ts` wraps the EventBus with:

- **Deduplication**: Sliding window (default 5s) keyed on `eventType:storyId` prevents duplicate publishes.
- **Queue with backpressure**: When EventBus is unavailable, events queue in memory (oldest dropped when full).
- **JSONL backup log**: Queued events also append to a backup file with automatic rotation at 10MB.
- **Degraded mode integration**: Registers health checks and recovery callbacks; auto-flushes on reconnection with exponential backoff (up to 3 retries).
- **Typed publish methods**: `publishStoryCompleted()`, `publishStoryStarted()`, `publishStoryBlocked()`, `publishStoryAssigned()`, `publishStoryUnblocked()`, `publishAgentResumed()`.

### EventSubscription

`packages/core/src/event-subscription.ts` provides:

- Pattern-based event type matching.
- Acknowledgment with configurable timeout (default 30s).
- Retry with exponential backoff (default delays: 1s, 2s, 4s, 8s, 16s).
- Dead letter queue for events that exhaust retries.

### JSONL Audit Trail

`packages/core/src/audit-trail.ts` provides append-only logging:

1. Subscribes to all EventBus events automatically.
2. Each event gets a SHA-256 integrity hash.
3. Writes to `events.jsonl` (one JSON object per line).
4. **Rotation**: When file exceeds 10MB, archives older events to dated files, keeps 10,000 most recent active.
5. **Archive index**: Maintains `events.jsonl.archive.index` for cross-archive queries.
6. **Degraded mode**: Buffers events in memory (up to 1000) when file writes fail; retries periodically (30s).
7. **Replay**: `replay(handler)` reads the JSONL log, verifies hashes, and feeds events to a handler for state recovery.
8. **Query**: Filter by event type, time range, grep pattern; supports `includeArchived` for cross-file queries.
9. **Export**: JSON or JSONL format with optional hash validation.

### Event Bus Integration

`packages/core/src/event-bus-integration.ts` connects triggers and workflows to the event bus:

- Registers `TriggerDefinition` objects that evaluate conditions against incoming events.
- When triggers fire, associated workflows execute via the `WorkflowEngine`.
- Supports debouncing (default 100ms) and concurrent workflow limits (default 5).
- Trigger system event types: `story.started`, `story.completed`, `story.blocked`, `story.assigned`, `agent.resumed`, `state.changed`, `conflict.detected`, `conflict.resolved`, `plugin.loaded`, `plugin.unloaded`. Note: `story.unblocked` and `state.external_update` exist only on the EventBus (see Event Layer above), not in the trigger system.

---

## Data Flow: Session Lifecycle

### Spawn Flow (CLI)

```
ao spawn <project> [issue]
  |
  +-1- loadConfig()                          # YAML -> Zod validation -> OrchestratorConfig
  |      +- findConfigFile()                 # Search: AO_CONFIG_PATH > cwd upward > ~/.config
  |
  +-2- getSessionManager(config)             # create registry, load plugins, create manager
  |      +- createPluginRegistry()
  |      +- registry.loadFromConfig(config)  # dynamic import() of all built-in plugins
  |      +- createSessionManager({ config, registry })
  |
  +-3- sessionManager.spawn({ projectId, issueId })
         |
         +- resolvePlugins(project)          # Look up runtime, agent, workspace, tracker, scm
         |
         +- Validate issue (if issueId)
         |    +- tracker.getIssue()          # Fail fast on auth/network errors
         |    +- tracker.validateIssue()     # Pre-flight story validation
         |
         +- Reserve session ID atomically
         |    +- O_EXCL file creation prevents concurrent collisions
         |
         +- Determine branch name
         |    +- explicit > tracker.branchName() > feat/{slug} > session/{id}
         |
         +- workspace.create()               # Create git worktree/clone
         |    +- workspace.postCreate()      # Symlinks, pnpm install, etc.
         |
         +- Build prompt
         |    +- buildPrompt({ project, issueId, issueContext, userPrompt })
         |
         +- agent.getLaunchCommand()          # e.g. "claude --dangerously-skip-permissions ..."
         +- agent.getEnvironment()            # AO_SESSION, AO_DATA_DIR, etc.
         |
         +- runtime.create()                  # tmux new-session with launch command
         |    +- Returns RuntimeHandle { id, runtimeName, data }
         |
         +- writeMetadata()                   # Flat key=value file (atomic write)
         |
         +- agent.postLaunchSetup()           # Optional: configure MCP servers, hooks
         |
         +- Return Session object
```

**Cleanup on failure**: Each step cleans up resources from previous steps if it fails. Workspace is destroyed, metadata deleted, runtime killed -- all best-effort.

### Spawn Flow (Web Dashboard)

```
POST /api/spawn  { projectId, issueId }
  |
  +- Input validation (validateIdentifier)
  +- getServices()                           # Singleton: config + registry + sessionManager
  |    +- initServices()                     # Static plugin imports, cached in globalThis
  +- sessionManager.spawn(...)               # Same core flow as CLI
  +- Response: { session: DashboardSession }
```

### Session State Machine

18 possible states, managed by `lifecycle-manager.ts`:

```
spawning -> working -> pr_open -> ci_failed -> working (agent fixes CI)
                                            -> review_pending -> changes_requested -> working
                                                              -> approved -> mergeable -> merged
working -> needs_input -> working
working -> stuck -> killed
working -> errored -> killed
* -> paused -> (previous state)
* -> terminated
* -> blocked
```

Terminal states: `killed`, `terminated`, `done`, `cleanup`, `errored`, `merged`.

### Lifecycle Manager Polling Loop

```
lifecycleManager.start(intervalMs=30000)
  |
  +- setInterval(pollAll, 30s)
       |
       +- sessionManager.list()              # Read all metadata files, enrich with runtime state
       |
       +- For each active session:
            |
            +- determineStatus(session)
            |    +- runtime.isAlive(handle)           # Is tmux session running?
            |    +- agent.getActivityState(session)    # JSONL-based activity detection
            |    +- scm.detectPR(session)              # Auto-detect PR by branch name
            |    +- scm.getPRState(pr)                 # merged? closed?
            |    +- scm.getCISummary(pr)               # CI passing/failing?
            |    +- scm.getReviewDecision(pr)          # approved? changes requested?
            |
            +- If status changed:
            |    +- updateMetadata(sessionsDir, id, { status })
            |    +- Map status -> EventType -> ReactionKey
            |    +- Execute reaction (send-to-agent / notify / auto-merge)
            |    |    +- Retry tracking with escalation after N attempts or duration
            |    +- If no reaction handled it, notify human for significant transitions
            |
            +- Special transitions:
                 +- merged -> tracker.onPRMerge() + emit tracker.story_done
                 +- killed/errored -> tracker.onSessionDeath() (reset story status)
                 +- all sessions terminal -> emit summary.all_complete (once)
```

The lifecycle manager also checks for sprint completion across all projects (all tracker issues closed/cancelled) and dispatches `tracker.sprint_complete` events on transition.

---

## Web API Layer

### Service Initialization

`packages/web/src/lib/services.ts` provides a lazily-initialized singleton cached in `globalThis` (survives Next.js HMR):

```typescript
getServices(): Promise<{ config, registry, sessionManager }>
```

The init function:
1. Calls `loadConfig()` to find and parse `agent-orchestrator.yaml`.
2. Creates a `PluginRegistry` and statically registers plugins.
3. Creates a `SessionManager` wired to the registry.
4. Caches in `globalThis._aoServices`.

If initialization fails, the cached promise is cleared so the next call retries.

### API Route Groups

**Session Management**:
- `GET /api/sessions` -- List all sessions
- `GET /api/sessions/[id]` -- Get session detail
- `POST /api/spawn` -- Spawn new session
- `POST /api/sessions/[id]/kill` -- Kill session
- `POST /api/sessions/[id]/send` -- Send message to agent
- `POST /api/sessions/[id]/message` -- Send message (alternate)
- `POST /api/sessions/[id]/restore` -- Restore dead session
- `GET /api/sessions/[id]/issue` -- Get linked issue

**Agent Monitoring**:
- `GET /api/agent/[id]` -- Agent session detail
- `GET /api/agent/[id]/activity` -- Activity state
- `GET /api/agent/[id]/logs` -- Session logs
- `POST /api/agent/[id]/resume` -- Resume agent

**PR Operations**:
- `POST /api/prs/[id]/merge` -- Merge PR

**Real-time Events**:
- `GET /api/events` -- SSE stream

**Audit Trail**:
- `GET /api/audit/events` -- Query audit events
- `GET /api/audit/events/export` -- Export events

**Dead Letter Queue**:
- `GET /api/dlq` -- List failed operations
- `POST /api/dlq/[errorId]/retry` -- Retry failed operation

**Conflict Management**:
- `GET /api/conflicts` -- List conflicts
- `GET /api/conflicts/[conflictId]` -- Conflict detail

**Sprint/Workflow** (30+ routes under `/api/sprint/[project]/`):
- metrics, velocity, throughput, CFD, aging, WIP, workload
- story CRUD, epic management, dependencies, forecasting
- sprint ceremonies (start/end), standup, retro, goals, notifications
- monte-carlo simulation, rework analysis, comparison

**Workflow Engine**:
- `GET /api/workflow/[project]` -- Workflow state
- `GET /api/workflow/health-metrics` -- Workflow health

All API routes follow the same pattern: call `getServices()`, interact with `sessionManager` or `registry`, return JSON via `NextResponse.json()`. Errors are caught and returned as `{ error: string }` with appropriate HTTP status codes (400, 404, 500).

---

## SSE Real-Time Updates

### Server Side (`GET /api/events`)

`packages/web/src/app/api/events/route.ts`:

1. Creates a `ReadableStream` with SSE format (`data: {...}\n\n`).
2. Sends initial snapshot of all sessions immediately.
3. Polls `sessionManager.list()` every **5 seconds**, sends `type: "snapshot"` events with session summaries (id, status, activity, attentionLevel, lastActivityAt).
4. Sends heartbeat comments (`: heartbeat\n\n`) every **15 seconds** to keep connection alive.
5. Subscribes to file-system workflow changes via `subscribeWorkflowChanges()` and pushes `type: "workflow-change"` events.
6. Cleans up intervals and subscriptions when stream is cancelled.

Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

### Client Side

**`useSSEConnection` hook** (`packages/web/src/hooks/useSSEConnection.ts`):
- Opens `EventSource` to `/api/events`.
- Dispatches typed event handlers: `onStoryStarted`, `onStoryCompleted`, `onStoryBlocked`, `onAgentStatusChanged`.
- Reconnects on error with exponential backoff (1s, 2s, 4s, 8s cap).
- Calls `onReconnected` callback after reconnection for cache invalidation.
- Returns `{ connected, reconnecting }` state.

**`useWorkflowSSE` hook** (`packages/web/src/hooks/useWorkflowSSE.ts`):
- Specialized SSE hook for the workflow page.
- Triggers data refetch when `workflow-change` events arrive.

**Current limitation**: The SSE implementation is polling-based. The server polls `sessionManager.list()` every 5s and pushes snapshots. There is no direct push from the core EventBus to the SSE stream. The lifecycle manager's state transitions update metadata files on disk, and the SSE poller reads them on the next cycle.

---

## Configuration Flow

### Loading Pipeline

```
YAML file
  |
  +- findConfigFile()
  |    Search order (checks both .yaml and .yml at each step):
  |    1. AO_CONFIG_PATH environment variable
  |    2. Walk up directory tree from CWD (like git)
  |    3. Explicit startDir parameter
  |    4. ~/.agent-orchestrator.yaml / ~/.agent-orchestrator.yml
  |    5. ~/.config/agent-orchestrator/config.yaml
  |
  +- readFileSync() + parseYaml()
  |
  +- OrchestratorConfigSchema.parse()        # Zod validation with defaults
  |    +- port: 5000
  |    +- readyThresholdMs: 300000 (5 min)
  |    +- defaults.runtime: "tmux"
  |    +- defaults.agent: "claude-code"
  |    +- defaults.workspace: "worktree"
  |    +- defaults.notifiers: ["composio", "desktop"]
  |
  +- expandPaths()                           # ~ -> homedir
  +- applyProjectDefaults()                  # Infer name, sessionPrefix, scm, tracker
  +- applyDefaultReactions()                 # 11 default reactions merged under user overrides
  +- validateProjectUniqueness()             # No duplicate basenames or session prefix collisions
```

### Config Propagation

```
OrchestratorConfig
  |
  +-> PluginRegistry.loadFromConfig(config)
  |     Plugins receive config at create() time
  |
  +-> SessionManager({ config, registry })
  |     Uses config.projects for project lookup
  |     Uses config.defaults for fallback plugin names
  |     Uses config.configPath for hash-based directory structure
  |
  +-> LifecycleManager({ config, registry, sessionManager })
  |     Uses config.reactions for auto-handling
  |     Uses config.notificationRouting for priority-based notifier selection
  |     Uses config.readyThresholdMs for idle detection
  |
  +-> Web services.ts getServices()
        Loads config once, creates registry + sessionManager singleton
```

### Reactions Config

Reactions define automated responses to lifecycle events. 11 defaults are provided:

| Reaction Key | Default Action | Escalation |
|---|---|---|
| `ci-failed` | send-to-agent: "fix CI" | After 2 retries |
| `changes-requested` | send-to-agent: "address comments" | After 30m |
| `bugbot-comments` | send-to-agent: "fix bot issues" | After 30m |
| `merge-conflicts` | send-to-agent: "rebase" | After 15m |
| `approved-and-green` | notify (action priority) | -- |
| `agent-stuck` | notify (urgent) | Threshold: 10m |
| `agent-needs-input` | notify (urgent) | -- |
| `agent-exited` | notify (urgent) | -- |
| `all-complete` | notify (info, with summary) | -- |
| `tracker-story-done` | notify (info, with summary) | -- |
| `tracker-sprint-complete` | notify (action) | -- |

Per-project overrides merge over global defaults. The `auto: false` setting skips automated agent actions but still allows notifications.

---

## Metadata and Storage

### Flat-File Metadata

Session state is stored as `key=value` flat files at:
```
~/.agent-orchestrator/{configHash}-{projectBasename}/sessions/{sessionId}
```

Example file contents:
```
project=my-app
worktree=/Users/dev/.agent-orchestrator/a3b4c5d6-my-app/worktrees/app-3
branch=feat/INT-1234
status=working
tmuxName=a3b4c5d6-app-3
agent=claude-code
issue=INT-1234
pr=https://github.com/org/repo/pull/42
createdAt=2026-03-15T10:00:00.000Z
runtimeHandle={"id":"a3b4c5d6-app-3","runtimeName":"tmux","data":{}}
```

Key properties:
- **Atomic writes**: Write to temp file then `rename()` (POSIX atomic).
- **Atomic ID reservation**: `O_EXCL` file creation prevents concurrent collisions.
- **Path traversal prevention**: Session IDs validated against `/^[a-zA-Z0-9_-]+$/`.
- **Archive on delete**: Metadata moved to `sessions/archive/{sessionId}_{timestamp}`.
- **Bash-compatible**: Same key=value format used by legacy shell scripts.

### Hash-Based Directory Structure

The config file path is hashed (first 12 chars of SHA-256) to create globally unique directory names. This prevents collisions when multiple config files manage projects with the same basename:

```
~/.agent-orchestrator/
  {hash}-{projectId}/
    sessions/           # Active session metadata files
      archive/          # Archived (killed/cleaned) metadata
    worktrees/          # Git worktrees for isolated workspaces
    .origin             # Stores original config path for validation
```

---

## Error Boundaries

### Plugin Isolation

- **Load-time**: Failed plugin imports are silently skipped (`catch {}` in `loadBuiltins`). The system runs with whatever plugins are available.
- **Registration**: `init()` lifecycle errors are caught and logged, never thrown. Registration completes regardless.
- **Runtime**: Plugin method calls in session manager are individually try/caught. A failing tracker does not prevent session spawn; a failing notifier does not block lifecycle transitions.

### Session Manager Error Handling

Each spawn step has rollback logic:
1. Workspace creation fails -> delete reserved session ID.
2. Runtime creation fails -> destroy workspace + delete session ID.
3. Post-launch setup fails -> destroy runtime + destroy workspace + delete session ID.
4. Prompt delivery failure (post-launch agents) -> **not** rolled back (session is running; user can retry with `ao send`).

### Lifecycle Manager Error Handling

- **Re-entrancy guard**: `polling` flag prevents overlapping poll cycles.
- **Per-session isolation**: `Promise.allSettled()` ensures one session's error does not block others.
- **State preservation**: On probe failure, sessions in `stuck` or `needs_input` state keep their status rather than being coerced to `working`.
- **Reaction escalation**: Failed `send-to-agent` reactions track attempt counts; after exceeding `retries` or `escalateAfter` duration, they escalate to human notification.
- **Notifier failures**: Caught and ignored (nothing more to do).
- **Stale entry cleanup**: Tracked session IDs and reaction trackers are pruned when sessions disappear from the list.
- **Enrichment timeout**: Per-session runtime state enrichment is capped at 2s to prevent slow subprocess calls from blocking the entire list.

### Web API Error Handling

- `getServices()` caches a Promise; if init fails, the cached promise is cleared so the next request retries.
- All API routes wrap operations in try/catch and return `{ error: message }` with 500 status.
- SSE stream: `enqueue()` failures (stream closed) trigger interval cleanup.
- Transient service errors during SSE polling are skipped (retry on next 5s interval).

### EventPublisher Error Handling

- **Publish failure**: Events are queued in memory with JSONL backup.
- **Queue overflow**: Oldest events dropped with counter tracking.
- **Backup log rotation**: Automatic at 10MB; rotation failures logged but not fatal.
- **Flush timeout**: 30-second timeout prevents indefinite blocking.
- **Recovery**: Exponential backoff retries (0s, 1s, 4s, 9s — formula: `attempt² * 1000ms`, max 3 retries) on EventBus reconnection.

### Audit Trail Error Handling

- **Write failures**: Enters degraded mode, buffers events in memory (up to 1000).
- **Recovery**: Periodic retry (30s) of test writes; on success, flushes buffer and clears recovery timer.
- **Corrupted data**: SHA-256 hash verification during replay; mismatched events are skipped with logged error.
- **Parse errors**: Malformed JSONL lines are skipped during query and replay.

### Degraded Mode Service

`packages/core/src/degraded-mode.ts` provides system-wide health monitoring:
- Registers health check functions for monitored services (event-bus, bmad-tracker).
- Periodic health checks (default 5s).
- Queues operations when services are unavailable.
- Fires recovery callbacks when services come back online.
- Tracks service availability state transitions.

### Retry and Circuit Breaker

- **RetryService** (`packages/core/src/retry-service.ts`): Wraps operations with exponential backoff retry logic.
- **CircuitBreaker** (`packages/core/src/circuit-breaker.ts`): Prevents cascading failures by tracking failure rates and switching between closed/open/half-open states.
- **Dead Letter Queue** (`packages/core/src/dead-letter-queue.ts`): Persistent JSONL storage for operations that exhaust retries. Supports manual and automated replay via `dlq-replay-handlers.ts` with service-specific replay logic (bmad sync, event publish, state write).

---

## AI Intelligence Integration (Cycle 3)

### Learning Pipeline Flow

```
SessionManager.spawn() completes (or agent exits)
  |
  +-> SessionLearning.captureOutcome()
  |     Captures: success/failure/blocked, duration, key decisions, domain, complexity
  |
  +-> LearningStore.append()
  |     Appends structured outcome to per-project JSONL: {dataDir}/{project}/learnings.jsonl
  |     90-day retention by default (configurable via learning.retentionDays)
  |
  +-> LearningPatterns.analyze()
        Scans recent outcomes for: repeated errors, common blockers, domain-specific patterns
        Generates preventive guidance for future prompts
```

### Smart Assignment Integration

```
ao assign-suggest <story-id>
  |
  +-> AssignmentScorer.scoreAll(story, candidateAgents)
  |     For each agent:
  |       +-> LearningStore.query({ agentId }) -> past performance data
  |       +-> Score: successRate * 0.4 + domainMatch * 0.3 + speedFactor * 0.2 - retryPenalty * 0.1 (see scoreAffinity() in assignment-scorer.ts)
  |
  +-> AssignmentService.recommend(scores)
        Returns ranked candidates with scores and reasoning

ao spawn --auto-assign smart
  |
  +-> AssignmentService.autoAssign(story)
        Picks highest-scoring agent automatically
```

### Review Intelligence Integration

```
Code review workflow (BMAD)
  |
  +-> ReviewFindingsStore.capture(findings)
  |     Stores: category, severity, file, line, description, resolution, agentId, storyId
  |     File: {dataDir}/{project}/review-findings.jsonl
  |
  +-> PromptBuilder.injectReviewHistory(story)
        Queries past findings for same domain/codebase area
        Injects as "Past review findings to avoid: ..." in agent prompt
```

### Collaboration Protocol

```
CollaborationService
  |
  +-> DependencyResolver.buildGraph(stories)
  |     Analyzes story dependencies from sprint plan
  |     Returns topological ordering for execution
  |
  +-> CollaborationService.shareContext(fromAgent, toAgent)
  |     Shares relevant context from completed prerequisite story
  |     Includes: key decisions, files modified, patterns used
  |
  +-> CollaborationService.handoff(fromStory, toStory)
  |     Notifies next agent that prerequisite is complete
  |     Includes: completion summary, branch state, test results
  |
  +-> File-level conflict prevention
        Tracks which files each agent is modifying across worktrees
        Warns on concurrent modification attempts
```

### New API Routes (Cycle 3)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/learning` | GET | Query learning knowledge base |
| `/api/health` | GET | System health status |

### New CLI Commands (Cycle 3)

| Command | Purpose |
|---------|---------|
| `ao agent-history <agent-id>` | View agent learning history |
| `ao learning-patterns` | Show failure patterns and preventive guidance |
| `ao assign-suggest <story-id>` | Show scored agent candidates |
| `ao assign-next` | Auto-assign next ready story |
| `ao review-stats` | Review analytics: common issues, resolution rates |
| `ao collab-graph` | Agent dependency and handoff visualization |
| `ao health` | System health with DLQ depth |
