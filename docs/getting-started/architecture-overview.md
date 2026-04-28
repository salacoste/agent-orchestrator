---
title: Architecture Overview
nav_order: 4
parent: Getting Started
description: How Agent Orchestrator works — plugin architecture, data flow, design principles, and service layers.
---

# Architecture Overview

Agent Orchestrator is a stateless, plugin-based system for running parallel AI coding agents. This page explains how the pieces fit together: the 8 swappable plugin slots, the data flow from spawn to merge, and the design principles that shape every decision.

{: .highlight }
> **TL;DR:** Spawn agents, walk away, get notified when your judgment is needed. Everything is pluggable, stateless, and file-based.

---

## Plugin Architecture

The system is built around 8 plugin slots. Each slot defines a typed interface — swap any plugin without touching the core.

```text
     Core Orchestrator
           │
  ┌────────┼────────┐
  │        │        │
Runtime  Agent  Workspace
(tmux) (claude)(worktree)
  │        │        │
Tracker  SCM   Notifier
(github)(github)(desktop)
  │
Terminal EventBus
(iterm2)(memory)
```

| Slot | Interface | Default Plugin | Available Plugins |
|------|-----------|----------------|-------------------|
| Runtime | `Runtime` | tmux | tmux, process |
| Agent | `Agent` | claude-code | claude-code, codex, aider, opencode, glm |
| Workspace | `Workspace` | worktree | worktree, clone |
| Tracker | `Tracker` | github | github, linear, bmad |
| SCM | `SCM` | github | github |
| Notifier | `Notifier` | desktop | desktop, slack, composio, webhook, discord, telegram |
| Terminal | `Terminal` | iterm2 | iterm2, web |
| EventBus | `EventBus` | in-memory | redis |

All interfaces are defined in `packages/core/src/types.ts`. Every plugin exports a `PluginModule` with compile-time type checking:

```typescript
export default { manifest, create } satisfies PluginModule<Runtime>;
```

{: .highlight }
> EventBus is documented as the "8th slot" for conceptual simplicity. It loads separately through its own interface, not through the standard `PluginRegistry.get<T>(slot, name)` API.

Plugin source locations: `packages/plugins/{slot}-{name}/src/index.ts`

---

## Data Flow: Spawn to Merge

When you run `ao spawn`, ten things happen in sequence:

```text
 ao spawn
    │
    ├── 1. validate issue (Tracker)
    ├── 2. create worktree (Workspace)
    ├── 3. create tmux (Runtime)
    ├── 4. launch agent (Agent)
    ├── 5. write metadata
    │
    │   agent works autonomously:
    │   reads code, writes tests, commits, PR
    │
    ├── 6. poll every 30s (Lifecycle)
    ├── 7. fire reactions on events
    ├── 8. notify human if needed
    ├── 9. PR merged → update tracker
    └── 10. cleanup
```

1. **Validate** — CLI resolves project config, checks the issue exists via Tracker plugin
2. **Workspace** — Workspace plugin creates an isolated git worktree (or clone) with a feature branch
3. **Runtime** — Runtime plugin creates a tmux session (or child process)
4. **Agent** — Agent plugin launches the AI tool (Claude Code, Codex, etc.) with a composed prompt
5. **Metadata** — Flat key=value file written to `~/.agent-orchestrator/{hash}/sessions/{id}`
6. **Agent works** — Agent reads code, writes tests, commits, pushes, creates a PR
7. **Lifecycle polling** (every 30s) — LifecycleManager detects state transitions (working → pr_open → ci_failed → ...)
8. **Reactions fire** — CI failure → send fix instructions to agent. Review comments → forward to agent
9. **Notification** — If retries exhaust or human judgment needed, Notifier pings you
10. **Cleanup** — PR merged → update tracker → archive metadata → remove worktree

---

## Design Principles

### Stateless — No Database

Agent Orchestrator stores all state in flat files:

- **Session metadata** — key=value files in `~/.agent-orchestrator/{hash}/sessions/{id}`
- **Event log** — append-only JSONL with SHA-256 integrity hashes, auto-rotates at 10 MB
- **Config** — `agent-orchestrator.yaml` in the project root, validated with Zod at load time

No database, no migrations, no external state store. Everything is a file you can inspect, back up, or version-control.

### Push, Not Pull

Agents work autonomously. You don't monitor them — they notify you:

- **Reactions** auto-handle routine issues (CI failures, review comments, merge conflicts)
- **Notifier** is the primary human interface — you get pinged only when judgment is needed
- **Dashboard** is for exploration, not monitoring

The goal: spawn agents, walk away, respond to notifications.

### Convention Over Configuration

Only two fields are required in config:

```yaml
projects:
  my-app:
    repo: owner/my-app
    path: ~/my-app
```

Everything else is auto-derived:
- **Project name** from config key
- **Session prefix** from path basename
- **SCM** from repo URL format
- **Tracker** defaults to GitHub

### Hash-Based Isolation

Multiple config files on the same machine never collide. Each config location gets a unique SHA-256 hash prefix:

```text
~/.agent-orchestrator/
  a3b4c5d6e7f8-my-app/
  f1e2d3c4b5a6-my-app/
```

---

## Service Architecture

Core services in `packages/core/src/` build on the plugin layer:

| Service | File | Purpose |
|---------|------|---------|
| SessionManager | `session-manager.ts` | CRUD for agent sessions; orchestrates Runtime + Agent + Workspace |
| LifecycleManager | `lifecycle-manager.ts` | State machine + polling loop + reaction engine |
| StateManager | `state-manager.ts` | Write-through cache over YAML with optimistic locking |
| EventPublisher | `event-publisher.ts` | Pub/sub with deduplication and degraded mode |
| AuditTrail | `audit-trail.ts` | Append-only JSONL with SHA-256 integrity and rotation |
| PluginRegistry | `plugin-registry.ts` | Plugin discovery, loading, and shutdown lifecycle |
| PromptBuilder | `prompt-builder.ts` | Composes agent prompts with story context and past learnings |
| ConflictResolver | `conflict-resolver.ts` | Optimistic locking conflict detection with 3 resolution strategies |
| CircuitBreaker | `circuit-breaker.ts` | CLOSED → OPEN → HALF_OPEN cascade prevention |
| RetryService | `retry-service.ts` | Exponential backoff with jitter for retryable operations |

### AI Intelligence Layer

Services providing learning and smart assignment:

- **LearningStore** — JSONL knowledge base for session outcomes (90-day retention)
- **AssignmentScorer** — Scores agent-story affinity from past performance
- **SessionLearning** — Captures structured outcomes when agents complete stories
- **CollaborationService** — Cross-agent context sharing and handoff protocol

---

## Session Lifecycle

Each agent session moves through a state machine with 18 possible states:

```text
spawning → working → pr_open → review_pending
                │         │            │
                │         │            ↓
                │         │        approved
                │         │            │
                │         ├── ci_failed (auto-fix)
                │         ├── changes_requested
                │         │
                ├── needs_input (notify)
                ├── stuck (notify)
                │
                └→ mergeable → merged
```

Terminal states: `merged`, `done`, `killed`, `errored`, `cleanup`

The LifecycleManager polls every 30 seconds, checking runtime liveness, agent activity, PR state, CI status, and review decisions. Reactions fire automatically on state transitions.

For the full lifecycle details, see [Sessions](../../core-concepts/sessions/).

---

## Error Resilience

Five layers of error handling prevent failures from cascading:

1. **Plugin isolation** — Errors in plugins are caught and logged; they don't crash the core
2. **Retry with backoff** — Transient failures retry with exponential backoff and jitter
3. **Circuit breaker** — Repeated failures open the circuit, preventing cascading load
4. **Degraded mode** — Events buffer in memory + JSONL backup when services are down; auto-flush on recovery
5. **Dead letter queue** — Permanently failed events go to a DLQ with replay capability

```text
Plugin Error → catch & log
  └─ Retryable? → RetryService
       └─ Repeated? → CircuitBreaker
            └─ Service down? → DegradedMode
                 └─ Permanent? → DLQ (replay)
```

---

## Next Steps

- **[Configuration](../configuration/)** — customize plugins, reactions, notifications
- **[Quick Start](../quick-start/)** — 5-minute hands-on tutorial
- **[Plugins](../../plugins/)** — available runtime, agent, and notifier plugins
- **[Sessions](../../core-concepts/sessions/)** — detailed session lifecycle documentation
