# Agent Orchestrator — Integration Architecture

How the six packages communicate, share data, and handle failures.

## Inter-Package Dependencies

```
                    ┌──────────────┐
                    │  plugin-api  │  (type-only, zero runtime deps)
                    └──────┬───────┘
                           │ re-exports types
                    ┌──────┴───────┐
              ┌─────┤     core     ├─────┐
              │     └──────┬───────┘     │
              │            │             │
        ┌─────┴────┐ ┌────┴─────┐ ┌─────┴──────────┐
        │   cli    │ │   web    │ │    plugins/*    │
        └──────────┘ └──────────┘ └────────────────┘
                                        │
                                  ┌─────┴──────────┐
                                  │ integration-   │
                                  │ tests          │
                                  └────────────────┘
```

- **core** depends on: `yaml`, `zod` (config), `ioredis` (optional, event bus)
- **cli** depends on: `core` (all services), `commander`, `chalk`, `ora`
- **web** depends on: `core` (types, config, services), `next`, `react`, `tailwindcss`
- **plugins** depend on: `core` (types only via `@composio/ao-core`)
- **plugin-api** depends on: `core` (re-exports plugin types, zero runtime code)
- **integration-tests** depends on: `core`, `cli`, all plugins

## Plugin Loading

### Discovery Flow

```
agent-orchestrator.yaml
        │
        ▼
config.ts (Zod validation)
        │
        ▼
plugin-loader.ts
  ├── Read plugin name from config (e.g., "tmux")
  ├── Resolve to package: @composio/ao-runtime-tmux
  ├── Dynamic import(): load PluginModule
  ├── Validate manifest (slot, version)
  ├── Call create() to instantiate plugin
  └── Register in plugin-registry.ts
        │
        ▼
service-registry.ts (DI container)
  └── Services access plugins by slot name
```

### PluginModule Contract

Every plugin exports:
```typescript
export default {
  manifest: { name, slot, description, version },
  create(): PluginInterface  // returns Runtime | Agent | Workspace | etc.
} satisfies PluginModule<T>;
```

### Plugin Isolation

- Each plugin runs in its own error boundary (`plugin-sandbox.ts`)
- Plugin errors are caught and logged, never crash the orchestrator
- Circuit breaker wraps external calls (API, shell commands)
- Health checks monitor plugin responsiveness

## Event System

### Architecture

```
Producer (any service)
    │
    ▼
event-publisher.ts
    │
    ├──[Redis available]──► event-bus-redis plugin
    │                           │
    │                           ▼
    │                       Redis pub/sub channels
    │                           │
    │                           ▼
    │                       event-subscription.ts (subscribers)
    │
    └──[Redis down]──► degraded-mode.ts
                           │
                           ▼
                       In-memory buffer (queue events)
                           │
                           ▼
                       Replay when Redis recovers
```

### Event Types

- `session.*` — spawning, working, pr_open, ci_failed, completed, killed, etc.
- `workflow-change` — BMAD artifact file changes
- `conflict.*` — detected, resolved, escalated
- `heartbeat` — keep-alive for SSE connections

### Audit Trail

Every event is also written to a JSONL audit log:
```
{data_dir}/events.jsonl
```
Each entry includes timestamp, event type, payload, and SHA-256 hash of the previous entry (tamper detection chain).

### Retry & Dead Letter Queue

```
Event processing fails
    │
    ▼
retry-service.ts (exponential backoff)
  [1s, 2s, 4s, 8s, 16s, 32s, 60s max]
    │
    ├──[Success]──► Continue
    │
    └──[Max retries]──► dead-letter-queue.ts
                            │
                            ▼
                        DLQ storage (JSONL)
                            │
                            ▼
                        dlq-replay-handlers.ts
                        (manual or scheduled replay)
```

## Session Lifecycle Data Flow

### Spawn Flow

```
CLI: ao spawn my-project
    │
    ▼
cli/commands/spawn.ts
    │ calls
    ▼
core/session-manager.ts :: createSession()
    │
    ├── 1. Load config (config.ts)
    ├── 2. Create workspace (Workspace plugin: worktree/clone)
    ├── 3. Create runtime session (Runtime plugin: tmux/process)
    ├── 4. Launch agent (Agent plugin: claude-code/codex/aider)
    ├── 5. Write metadata (metadata.ts → flat key=value file)
    ├── 6. Publish event: session.spawning
    ├── 7. Start monitoring (blocked-agent-detector, completion-detector)
    └── 8. Update state: spawning → working
```

### State Machine

18 states managed by `state-manager.ts`:

```
spawning → working → pr_open → ci_failed → working (fix)
                                         → review_pending → changes_requested → working (fix)
                                                          → approved → mergeable → merged → cleanup → done
working → needs_input → working
working → stuck → killed
working → errored → killed
* → paused → (previous state)
* → terminated
* → blocked
```

### Monitoring Flow

```
agent-completion-detector.ts
    │ polls agent activity
    ▼
Agent plugin :: detectActivity()
    │ returns ActivityDetection { state, timestamp }
    ▼
state-manager.ts :: transition()
    │ validates transition, updates state
    ▼
event-publisher.ts :: publish(session.state_change)
    │
    ├──► notification-service.ts (if human attention needed)
    └──► audit-trail.ts (always logged)
```

## Web API Layer

### Request Flow

```
Browser (React app)
    │ fetch() or SSE
    ▼
Next.js App Router (packages/web/src/app/api/)
    │
    ├── Route handler reads config
    ├── Instantiates core services
    ├── Calls service methods
    ├── Returns JSON response
    │
    ▼
Core services (session-manager, plugin-registry, etc.)
    │
    ▼
Plugins + filesystem + Redis
```

### Key API Patterns

1. **Session APIs** (`/api/sessions/*`): CRUD operations on sessions via session-manager
2. **SSE Stream** (`/api/events`): Long-lived connection pushing real-time updates
3. **Sprint APIs** (`/api/sprint/[project]/*`): 30+ analytics routes reading YAML state
4. **Workflow API** (`/api/workflow/[project]`): Scans filesystem for BMAD artifacts
5. **Action APIs** (`/api/sessions/[id]/kill`, `/send`, `/restore`): Mutating operations

### Error Handling in API Routes

All API routes return `{ error: string }` with appropriate HTTP status codes:
- 400: Invalid request (bad project ID, missing params)
- 404: Resource not found (session, agent)
- 500: Internal error (plugin failure, filesystem error)

## SSE Real-Time Updates

### Server Side

```typescript
// packages/web/src/app/api/events/route.ts
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to event bus
      // On event: controller.enqueue(SSE-formatted data)
      // Heartbeat every 30s
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

### Client Side

```typescript
// packages/web/src/lib/useSSEConnection.ts
// Custom hook with:
// - Auto-reconnect with exponential backoff
// - Connection status tracking (connected/connecting/disconnected)
// - Event type filtering
// - Cleanup on unmount
```

### Event Types on SSE Stream

| Event | Payload | Triggers |
|-------|---------|----------|
| `session` | `DashboardSession` | State change, new session |
| `workflow-change` | `{ projectId }` | BMAD artifact file change |
| `heartbeat` | `{ timestamp }` | Every 30s keep-alive |

## Configuration Flow

```
agent-orchestrator.yaml (user-authored)
    │
    ▼
config.ts :: loadConfig()
    │ 1. Find YAML file (cwd, parent dirs, ~/.config/)
    │ 2. Parse YAML
    │ 3. Validate with Zod schemas
    │ 4. Expand ~ paths to absolute
    │ 5. Apply defaults
    │
    ▼
OrchestratorConfig object
    │
    ├──► Plugin loading (which plugins for each slot)
    ├──► Session manager (project configs, reaction rules)
    ├──► Notification service (notifier config)
    ├──► CLI commands (project resolution)
    └──► Web API routes (config access)
```

### Config Schema (Zod)

```yaml
runtime: { plugin: "tmux" }
agent: { plugin: "claude-code" }
workspace: { plugin: "worktree" }
tracker: { plugin: "github" }
scm: { plugin: "github", token: "...", owner: "...", repo: "..." }
notifier: { plugin: "desktop" }
terminal: { plugin: "iterm2" }

projects:
  my-app:
    repo: org/repo
    path: ~/my-app
    reactions:
      ci_failed: { auto: true, action: "send-to-agent" }
      review_comments: { auto: true, action: "send-to-agent" }
```

## Error Boundaries

### Layer 1: Plugin Errors

```
Plugin method throws
    │
    ▼
plugin-sandbox.ts catches
    │ logs structured error
    ▼
Circuit breaker evaluates
    │
    ├──[Open]──► Fail fast, return error
    ├──[Half-open]──► Allow one attempt
    └──[Closed]──► Normal operation
```

### Layer 2: Service Errors

```
Service method fails
    │
    ▼
error-logger.ts (structured logging with context)
    │
    ▼
Caller decides: retry, degrade, or propagate
```

### Layer 3: API Route Errors (Web)

```
API route handler
    │
    ▼
try/catch wraps service calls
    │
    ├──[Known error]──► { error: message }, appropriate status
    └──[Unknown error]──► { error: "Internal server error" }, 500
```

### Layer 4: Workflow Dashboard (WD-7 Three-Layer Resilience)

```
File system read attempt
    │
    ├──[Success]──► Fresh data + update LKG cache
    │
    └──[Failure]──► lkg-cache.ts (in-memory last-known-good)
                        │
                        ├──[Cache hit]──► Serve cached data
                        └──[Cache miss]──► Return defaults
                                             │
                                             ▼
                                         Client retains previous state
                                         (no error shown to user)
```

## External Service Integration

| Service | Plugin | Protocol | Auth |
|---------|--------|----------|------|
| GitHub API | scm-github, tracker-github | REST (Octokit) | Personal access token |
| Linear API | tracker-linear | GraphQL | API key |
| Redis | event-bus-redis | Redis protocol | Connection string |
| Slack | notifier-slack | Webhook | Webhook URL |
| macOS Notifications | notifier-desktop | node-notifier | None |
| tmux | runtime-tmux | execFile CLI | None (local) |
| iTerm2 | terminal-iterm2 | AppleScript | None (local) |

All external calls use `execFile` (never `exec`) with timeouts. API calls use circuit breakers. Network-dependent services have degraded mode fallbacks.
