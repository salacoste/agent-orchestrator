# Agent Orchestrator — Architecture Documentation

## System Overview

Agent Orchestrator is a stateless system for orchestrating parallel AI coding agents. It is agent-agnostic (Claude Code, Codex, Aider, OpenCode, GLM), runtime-agnostic (tmux, child processes), tracker-agnostic (GitHub, Linear, BMAD), and manages the full session lifecycle from spawn through PR merge. The core design principle is **push, not pull**: spawn agents, walk away, get notified when human judgment is needed.

**Tech stack**: TypeScript (ESM), Node 20+, pnpm workspaces, Next.js 15 (App Router) + Tailwind, Commander.js CLI, YAML + Zod config, Server-Sent Events for real-time, flat metadata files + JSONL event log.

---

## Architectural Layers

### 1. Plugin Layer

Eight swappable plugin slots, each defined as a typed interface in `packages/core/src/types.ts`. Every plugin exports a `PluginModule` with compile-time type checking via `satisfies`:

```typescript
export default { manifest, create } satisfies PluginModule<Runtime>;
```

| Slot | Interface | Default Plugin | Available Plugins |
|------|-----------|----------------|-------------------|
| Runtime | `Runtime` | tmux | tmux, process |
| Agent | `Agent` | claude-code | claude-code, codex, aider, opencode, glm |
| Workspace | `Workspace` | worktree | worktree, clone |
| Tracker | `Tracker` | github | github, linear, bmad |
| SCM | `SCM` | github | github |
| Notifier | `Notifier` | desktop | desktop, slack, composio, webhook |
| Terminal | `Terminal` | iterm2 | iterm2, web |
| EventBus | `EventBus` | (in-memory) | redis |

Plugin source locations: `packages/plugins/{slot}-{name}/src/index.ts`

### 2. Service Layer

Core services built on top of plugins, located in `packages/core/src/`:

- **SessionManager** (`session-manager.ts`) — CRUD for agent sessions: spawn, spawnOrchestrator, restore, list, get, kill, cleanup, send. Orchestrates Runtime + Agent + Workspace plugins in sequence.
- **LifecycleManager** (`lifecycle-manager.ts`) — State machine + polling loop + reaction engine. Periodically polls all sessions, detects state transitions, triggers reactions, escalates to human notification.
- **StateManager** (`state-manager.ts`) — Write-through cache over `sprint-status.yaml`. Sub-millisecond cache reads, version stamping for optimistic locking, corruption detection with backup recovery.
- **EventPublisher** (`event-publisher.ts`) — Publishes story state change events with deduplication (5s window), in-memory queue with backup JSONL log, degraded mode support.
- **EventSubscription** (`event-subscription.ts`) — Pub/sub with subscriber pattern, FIFO delivery with optional ack and timeout.
- **ConflictResolver** (`conflict-resolver.ts`) — Version conflict detection via optimistic locking. Three resolution strategies: overwrite, retry, merge (field-level).
- **SyncService** (`sync-service.ts`) — Bidirectional BMAD tracker synchronization.
- **NotificationService** (`notification-service.ts`) — Notification queueing, routing by priority, deduplication, dead letter queue.
- **AuditTrail** (`audit-trail.ts`) — Append-only JSONL event log with SHA-256 integrity hashes, automatic rotation (10MB default), crash recovery, query and replay capabilities.
- **PluginRegistry** (`plugin-registry.ts`) — Plugin discovery, loading, hot-reload, shutdown lifecycle.
- **CircuitBreaker** (`circuit-breaker.ts`) — CLOSED/OPEN/HALF_OPEN states for cascading failure prevention.
- **RetryService** (`retry-service.ts`) — Exponential backoff with jitter for retryable operations.
- **DegradedMode** (`degraded-mode.ts`) — Graceful operation when services are unavailable (event queueing, state caching, health checks).
- **AgentRegistry** (`agent-registry.ts`) — Agent-to-story assignment tracking with zombie detection.
- **AgentCompletionDetector** (`agent-completion-detector.ts`) — Monitors agents for completion/failure events.
- **BlockedAgentDetector** (`blocked-agent-detector.ts`) — Detects agents stuck due to inactivity.
- **HealthCheck** (`health-check.ts`) — Service health monitoring with configurable rules.
- **WorkflowEngine** (`workflow-engine.ts`) — Workflow orchestration for multi-step operations.

### 3. Metadata Layer

Flat-file key=value session metadata stored at:
```
~/.agent-orchestrator/{configHash}-{projectId}/sessions/{sessionId}
```

Each session file contains fields like: `worktree`, `branch`, `status`, `tmuxName`, `issue`, `pr`, `summary`, `project`, `agent`, `createdAt`, `runtimeHandle`, `role`, `exitCode`, `signal`, `failureReason`.

The hash-based directory structure isolates multiple projects sharing the same machine. An `.origin` file in each project directory maps back to the config file.

### 4. Event Layer

Two event systems serve different purposes:

**OrchestratorEvents** (lifecycle-manager): Session lifecycle events with priority-based notification routing. Event types span session.*, pr.*, ci.*, review.*, merge.*, reaction.*, summary.*, tracker.*, agent.* categories. Priority levels: urgent, action, warning, info.

**EventBus** (event-publisher + event-bus-redis): Pub/sub for story state changes across processes. Supports in-memory and Redis backends. Events: story.completed, story.started, story.blocked, story.assigned, agent.resumed, state.external_update.

### 5. Reaction Layer

Configurable automatic responses to lifecycle events:

| Reaction Key | Trigger | Default Action |
|-------------|---------|----------------|
| ci-failed | CI checks fail | send-to-agent (fix instructions) |
| changes-requested | Review requests changes | send-to-agent |
| bugbot-comments | Automated review comments | send-to-agent |
| merge-conflicts | Merge conflicts detected | send-to-agent |
| approved-and-green | PR approved + CI green | notify (or auto-merge) |
| agent-stuck | Agent inactive too long | notify |
| agent-needs-input | Agent asking a question | notify |
| agent-exited | Agent process died | notify |
| all-complete | All sessions finished | notify |
| tracker-story-done | Story completed via PR merge | notify |
| tracker-sprint-complete | All sprint issues closed | notify |

Each reaction supports: retry counts, escalation thresholds (count or duration), per-project overrides.

### 6. Degradation Layer

Graceful operation when services are unavailable:

- **Event queueing**: Events buffered in memory + JSONL backup when EventBus is down, auto-flushed on recovery with exponential backoff retry.
- **State caching**: StateManager serves from cache when YAML writes fail.
- **Circuit breaker**: CLOSED -> OPEN -> HALF_OPEN pattern prevents cascading failures.
- **Health monitoring**: Periodic health checks for event-bus and tracker services.
- **Audit trail buffering**: Events buffered in memory when filesystem is read-only, auto-flushed on recovery.

---

## Plugin Slot Interfaces

### Runtime (7 required + 3 optional methods)

Where and how agent sessions execute.

| Method | Required | Description |
|--------|----------|-------------|
| `create(config)` | Yes | Create session environment, return opaque handle |
| `destroy(handle)` | Yes | Tear down session environment |
| `sendMessage(handle, message)` | Yes | Send text to running agent |
| `getOutput(handle, lines?)` | Yes | Capture recent terminal output |
| `isAlive(handle)` | Yes | Check if session is still running |
| `getMetrics(handle)` | No | Resource metrics (uptime, memory, CPU) |
| `getAttachInfo(handle)` | No | Info for human attachment (tmux session name, URL) |
| `getExitCode(handle)` | No | Exit code of main process |
| `getSignal(handle)` | No | Signal that terminated process |

### Agent (9 required + 3 optional methods)

Adapter for a specific AI coding tool.

| Method | Required | Description |
|--------|----------|-------------|
| `getLaunchCommand(config)` | Yes | Shell command to start the agent |
| `getEnvironment(config)` | Yes | Environment variables for agent process |
| `detectActivity(output)` | Yes | Detect activity from terminal output (deprecated) |
| `getActivityState(session, threshold?)` | Yes | Activity state via native mechanism (JSONL, SQLite) |
| `isProcessRunning(handle)` | Yes | Check if agent process is alive |
| `getSessionInfo(session)` | Yes | Extract summary, cost, session ID |
| `getRestoreCommand(session, project)` | No | Command to resume a previous session |
| `postLaunchSetup(session)` | No | Setup after agent launch (MCP servers, etc.) |
| `setupWorkspaceHooks(path, config)` | No | Install auto-metadata hooks in workspace |

Properties: `name`, `processName`, `promptDelivery` ("inline" or "post-launch").

### Workspace (3 required + 3 optional methods)

Code isolation for each session.

| Method | Required | Description |
|--------|----------|-------------|
| `create(config)` | Yes | Create isolated workspace (worktree/clone) |
| `destroy(path)` | Yes | Remove workspace |
| `list(projectId)` | Yes | List existing workspaces |
| `postCreate(info, project)` | No | Post-creation hooks (symlinks, installs) |
| `exists(path)` | No | Check if workspace exists and is valid |
| `restore(config, path)` | No | Recreate workspace for existing branch |

### Tracker (6 required + 9 optional methods)

Issue/task tracker integration.

| Method | Required | Description |
|--------|----------|-------------|
| `getIssue(id, project)` | Yes | Fetch issue details |
| `isCompleted(id, project)` | Yes | Check if issue is closed |
| `issueUrl(id, project)` | Yes | Generate issue URL |
| `branchName(id, project)` | Yes | Generate git branch name |
| `generatePrompt(id, project)` | Yes | Generate agent prompt for issue |
| `issueLabel(url, project)` | No | Human-readable label from URL |
| `listIssues(filters, project)` | No | List issues with filters |
| `updateIssue(id, update, project)` | No | Update issue state |
| `createIssue(input, project)` | No | Create new issue |
| `validateIssue(id, project)` | No | Pre-spawn validation |
| `findIssueByBranch(branch, project)` | No | Reverse lookup: branch -> issue |
| `onPRMerge(id, prUrl, project)` | No | Handle PR merge (transition + events) |
| `onSessionDeath(id, project)` | No | Reset story on session death |
| `getNotifications(project)` | No | Health/sprint notifications |
| `getEpicTitle(epicId, project)` | No | Resolve epic title |

### SCM (11 required + 1 optional method)

Source code management platform — full PR pipeline.

| Method | Required | Description |
|--------|----------|-------------|
| `detectPR(session, project)` | Yes | Detect PR by branch name |
| `getPRState(pr)` | Yes | Get PR state (open/merged/closed) |
| `mergePR(pr, method?)` | Yes | Merge PR (merge/squash/rebase) |
| `closePR(pr)` | Yes | Close PR without merging |
| `getCIChecks(pr)` | Yes | Individual CI check statuses |
| `getCISummary(pr)` | Yes | Overall CI status |
| `getReviews(pr)` | Yes | All reviews on PR |
| `getReviewDecision(pr)` | Yes | Overall review decision |
| `getPendingComments(pr)` | Yes | Unresolved review comments |
| `getAutomatedComments(pr)` | Yes | Bot/linter comments |
| `getMergeability(pr)` | Yes | Merge readiness check |
| `getPRSummary(pr)` | No | PR stats (additions, deletions) |

### Notifier (1 required + 2 optional methods)

Primary interface between orchestrator and human.

| Method | Required | Description |
|--------|----------|-------------|
| `notify(event)` | Yes | Push notification to human |
| `notifyWithActions(event, actions)` | No | Notification with actionable buttons/links |
| `post(message, context?)` | No | Post to channel (Slack) |

### Terminal (2 required + 1 optional method)

Human interaction with running sessions.

| Method | Required | Description |
|--------|----------|-------------|
| `openSession(session)` | Yes | Open session for human interaction |
| `openAll(sessions)` | Yes | Open all sessions for a project |
| `isSessionOpen(session)` | No | Check if already open |

### EventBus (6 required + 1 optional method)

Pub/sub messaging across processes.

| Method | Required | Description |
|--------|----------|-------------|
| `publish(event)` | Yes | Publish event to bus |
| `subscribe(callback)` | Yes | Subscribe to all events |
| `isConnected()` | Yes | Check backend connection |
| `isDegraded()` | Yes | Check degraded mode |
| `getQueueSize()` | Yes | Queued event count |
| `close()` | Yes | Close connection |
| `ping()` | No | Measure round-trip latency |

---

## Session Lifecycle State Machine

18 possible states, tracked in metadata and updated by the LifecycleManager polling loop:

```
spawning -> working -> pr_open -> review_pending -> approved -> mergeable -> merged
                  |         |           |                            |
                  |         +-> ci_failed (reaction: send fix to agent)
                  |         |
                  |         +-> changes_requested (reaction: send to agent)
                  |
                  +-> needs_input (reaction: notify human)
                  +-> stuck (reaction: notify human)
                  +-> errored
                  +-> killed
                  +-> blocked
                  +-> paused
```

Terminal states: `killed`, `terminated`, `done`, `cleanup`, `errored`, `merged`.

Non-restorable states: `merged`.

The LifecycleManager determines status by polling in this order:
1. Check runtime liveness (is tmux/process alive?)
2. Check agent activity via JSONL-based detection, fall back to terminal output parsing
3. Auto-detect PR by branch if metadata.pr is missing
4. Check PR state, CI status, review decision, merge readiness
5. Default to "working" if agent is active

---

## Configuration Architecture

YAML format validated with Zod at load time. Located at `agent-orchestrator.yaml` in the project root.

```yaml
# Minimal config that works:
projects:
  my-app:
    repo: org/repo
    path: ~/my-app

# Everything else has sensible defaults:
# defaults.runtime: tmux
# defaults.agent: claude-code
# defaults.workspace: worktree
# defaults.notifiers: [composio, desktop]
```

Key configuration sections:
- **defaults**: Default plugin selections (runtime, agent, workspace, notifiers)
- **projects**: Per-project config (repo, path, branch, tracker, scm, symlinks, postCreate, agentConfig, reactions, agentRules)
- **notifiers**: Notification channel configs
- **notificationRouting**: Priority-based routing (urgent/action/warning/info -> notifier names)
- **reactions**: Default reaction configs per event type
- **readyThresholdMs**: Idle detection threshold (default: 300,000ms = 5 min)

Per-project overrides for plugins and reactions are merged with global defaults. Paths support `~` expansion.

---

## Error Handling Stack

1. **Plugin errors**: Isolated try/catch, logged, non-fatal where possible
2. **Retryable errors**: Exponential backoff with jitter via RetryService
3. **Cascading failures**: Circuit breaker (CLOSED/OPEN/HALF_OPEN states)
4. **Permanent failures**: Dead letter queue with replay capability
5. **Service unavailability**: Degraded mode (queue events, use cache, periodic health checks)
6. **Metadata corruption**: Backup recovery or rebuild from default template
7. **JSON parse safety**: All `JSON.parse` calls wrapped in try/catch
8. **External data validation**: Types validated from API/CLI/file inputs via Zod

---

## Web Dashboard Architecture

Next.js 15 App Router with React 19, located in `packages/web/`.

**API routes** (`packages/web/src/app/api/`):
- `/api/sessions` — Session CRUD
- `/api/spawn` — Session spawning
- `/api/prs` — PR enrichment
- `/api/events` — SSE event stream
- `/api/audit` — Audit trail queries
- `/api/conflicts` — Conflict management
- `/api/dlq` — Dead letter queue
- `/api/sprint` — Sprint status
- `/api/workflow` — Workflow dashboard
- `/api/agent` — Agent management

**Real-time updates**: SSE + polling hybrid. PR enrichment pipeline with TTL cache (5 min).

**Error resilience** (three-layer): File I/O try/catch -> API last-known-good cache -> Client state retention.

**Terminal integration**: ttyd iframe + direct PTY WebSocket for attaching to agent sessions.

---

## Security Model

- **Shell injection prevention**: `execFile`/`spawn` only, never `exec`. Arguments passed as arrays, never string interpolation.
- **Path traversal prevention**: Session ID validation via regex, absolute paths only.
- **Input sanitization**: Control character stripping in shell messages. AppleScript escaping for desktop notifications.
- **Secret scanning**: Gitleaks pre-commit hook. GitHub Actions security scanning (gitleaks, dependency review, npm audit).
- **Metadata safety**: All `JSON.parse` wrapped in try/catch. Corrupted metadata does not crash the system.
- **Plugin isolation**: Plugin sandbox with lifecycle hooks, graceful shutdown.

---

## Data Flow: Spawn to Merge

1. **`ao spawn --issue 42`**: CLI resolves project config, validates issue exists via Tracker plugin.
2. **Workspace creation**: Workspace plugin creates git worktree/clone with the issue's branch.
3. **Runtime creation**: Runtime plugin creates tmux session (or child process), launches agent with composed prompt.
4. **Metadata written**: Flat key=value file created in `~/.agent-orchestrator/{hash}/sessions/{id}`.
5. **Agent works**: Agent codes, commits, pushes, creates PR. Workspace hooks auto-update metadata.
6. **Lifecycle polling** (every 30s): LifecycleManager detects state transitions (working -> pr_open -> ci_failed -> etc.).
7. **Reactions fire**: CI failure -> send fix instructions to agent. Review comments -> send to agent.
8. **Escalation**: If reaction retries exhaust, escalate to human via Notifier.
9. **PR merged**: LifecycleManager detects merge, updates tracker, emits events, archives metadata.
10. **Cleanup**: `ao cleanup` removes sessions with merged PRs or closed issues.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | All interfaces — read this first |
| `packages/core/src/session-manager.ts` | Session CRUD orchestration |
| `packages/core/src/lifecycle-manager.ts` | State machine + polling + reactions |
| `packages/core/src/state-manager.ts` | Write-through YAML cache |
| `packages/core/src/event-publisher.ts` | Event publishing with dedup + degraded mode |
| `packages/core/src/audit-trail.ts` | Append-only JSONL with SHA-256 integrity |
| `packages/core/src/conflict-resolver.ts` | Optimistic locking conflict resolution |
| `packages/core/src/circuit-breaker.ts` | Cascading failure prevention |
| `packages/core/src/retry-service.ts` | Exponential backoff with jitter |
| `packages/core/src/degraded-mode.ts` | Graceful service unavailability |
| `packages/core/src/config.ts` | YAML + Zod config loading |
| `packages/core/src/metadata.ts` | Flat-file metadata read/write |
| `packages/core/src/paths.ts` | Path generation and hash-based directories |
| `packages/core/src/plugin-registry.ts` | Plugin discovery and hot-reload |
| `packages/core/src/prompt-builder.ts` | Agent prompt composition |
| `agent-orchestrator.yaml.example` | Config format reference |
