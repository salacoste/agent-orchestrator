---
title: Sessions
nav_order: 1
parent: Core Concepts
description: How agent sessions work — 18 lifecycle states, the spawn pipeline, state transitions, and completion flows.
---

# Sessions Lifecycle

A session is the core unit of work in Agent Orchestrator. When you run `ao spawn`, a session is created — an isolated workspace where an AI agent works autonomously on a story, creates a PR, and (usually) gets it merged without human intervention.

{: .highlight }
> **TL;DR:** `ao spawn` creates a session. The agent works on its own. You get notified only when your judgment is needed. Session state is tracked in flat files — no database.

---

## Session States

Each session moves through a state machine with **18 states**: 12 active and 6 terminal.

```text
spawning → working → pr_open → review_pending
              │         │            │
              │         │            ↓
              │         │        approved
              │         │            │
              │         ├── ci_failed (auto-fix)
              │         │
              ├── needs_input (notify)
              ├── stuck (notify)
              ├── blocked
              ├── paused
              │
              └→ mergeable → merged

  review_pending → changes_requested → working (fix)
```

### Active States

| State | Description |
|-------|-------------|
| `spawning` | Session starting up (brief, auto-transitions to `working`) |
| `working` | Agent is actively coding |
| `pr_open` | PR created and open for review |
| `ci_failed` | CI checks failing on the PR |
| `review_pending` | PR awaiting reviewer approval |
| `changes_requested` | Reviewer requested changes |
| `approved` | PR approved, waiting on CI to go green |
| `mergeable` | PR approved and CI passing — ready to merge |
| `needs_input` | Agent waiting for human decision |
| `stuck` | Agent inactive beyond threshold (default: 10 min) |
| `blocked` | Session blocked on a dependency |
| `paused` | Session paused by user |

### Terminal States

| State | Description | Restorable? |
|-------|-------------|-------------|
| `merged` | PR merged successfully | No |
| `done` | Session completed normally (agent finished, no PR needed) | Yes |
| `cleanup` | Housekeeping state for stale session removal | Yes |
| `errored` | Agent encountered an unrecoverable error | Yes |
| `killed` | Session killed externally or runtime died | Yes |
| `terminated` | Session terminated | Yes |

{: .highlight }
> **Non-restorable:** Only `merged` cannot be restored. All other terminal sessions can be restarted with `ao restore`. `done` is reached when an agent finishes without creating a PR. `cleanup` is set by the periodic cleanup job that removes stale sessions.

---

## State Transitions

The LifecycleManager polls every **30 seconds** and determines the current state using a 5-step priority check.

### How Status Is Determined

1. **Runtime alive?** — If the tmux session or process is dead → `killed`
2. **Agent activity?** — JSONL-based detection (preferred), fallback to terminal output parsing
   - `waiting_input` activity → `needs_input`
   - `exited` activity → `killed`
   - `active`, `ready`, `idle` → proceed to PR checks
3. **PR exists?** — Auto-detect PR by branch if not in metadata yet
4. **PR state?** — Checked in strict priority order:
   - Merged → `merged`
   - Closed → `killed`
   - CI failing → `ci_failed`
   - Changes requested → `changes_requested`
   - Approved + mergeable → `mergeable`
   - Approved but not mergeable → `approved`
   - Review pending → `review_pending`
   - Default → `pr_open`
5. **Fallback** — If status was `spawning`, `stuck`, or `needs_input` and no PR exists → `working`

### State-to-Event Mapping

When a session transitions, an event is published:

| New State | Event Type |
|-----------|-----------|
| `working` | `session.working` |
| `pr_open` | `pr.created` |
| `ci_failed` | `ci.failing` |
| `review_pending` | `review.pending` |
| `changes_requested` | `review.changes_requested` |
| `approved` | `review.approved` |
| `mergeable` | `merge.ready` |
| `merged` | `merge.completed` |
| `needs_input` | `session.needs_input` |
| `stuck` | `session.stuck` |
| `errored` | `session.errored` |
| `killed` | `session.killed` |

States `spawning`, `cleanup`, `done`, `terminated`, `blocked`, and `paused` do not emit events.

---

## Activity States

The agent plugin detects what the AI tool is doing in real time. This **ActivityState** (6 values) is separate from the session's **SessionStatus** (18 values) and feeds into the status determination.

| ActivityState | Meaning | Maps To |
|--------------|---------|---------|
| `active` | Agent is processing (thinking, writing code) | → PR checks or `working` |
| `ready` | Agent finished its turn, alive and waiting | → PR checks or `working` |
| `idle` | Agent has been inactive for a while | → PR checks or `working` |
| `waiting_input` | Agent asking a question or permission | → `needs_input` |
| `blocked` | Agent hit an error or is stuck | → PR checks or `working` _(agent-side, not dependency-blocked)_ |
| `exited` | Agent process no longer running | → `killed` |

{: .highlight }
> **Key distinction:** SessionStatus is what the *orchestrator* thinks. ActivityState is what the *agent plugin* detects. The orchestrator uses activity state as one input into its status determination.

---

## Spawn Pipeline

When you run `ao spawn`, the system creates a session through a multi-step pipeline:

```text
ao spawn
  │
  ├─ 1. resolve project config
  ├─ 2. validate plugins (runtime, agent)
  ├─ 3. fetch issue from tracker
  ├─ 4. reserve session ID (atomic)
  ├─ 5. determine branch name
  ├─ 6. create workspace (worktree/clone)
  ├─ 7. run post-create hooks
  ├─ 8. install session enhancement provider
  ├─ 9. generate prompt from issue context
  ├─ 10. inject past learnings + memory
  ├─ 11. compose final prompt
  ├─ 12. configure provider with story context
  ├─ 13. initialize hook registry
  ├─ 14. resolve agent + model tier
  ├─ 15. create runtime (tmux/process)
  ├─ 16. write session metadata
  └─ 17. post-launch agent setup
```

### Key Pipeline Steps

**Step 3 — Issue validation:** The tracker plugin fetches the issue (GitHub Issue, Linear ticket, or BMad story). If the issue doesn't exist, the spawn fails immediately.

**Step 4 — Session ID reservation:** Uses atomic file locking to reserve a unique session ID (e.g., `my-app-3`). Retries up to 10 times on collision.

**Step 6 — Workspace creation:** The workspace plugin creates an isolated git worktree (or clone) with a feature branch. Files listed in `symlinks` config are symlinked in (e.g., `.env`, `.claude`).

**Step 8 — Session enhancement:** If a provider is configured (e.g., OMC — oh-my-claudecode), it's installed into the workspace. This enables compaction survival, model routing, and agent personality matching.

**Step 10 — Learning injection:** Past session outcomes from the LearningStore are injected into the agent prompt, helping the agent avoid repeating mistakes.

**Step 16 — Metadata:** A flat key=value file is written to `~/.agent-orchestrator/{hash}/sessions/{id}` with fields like `worktree`, `branch`, `status`, `issue`, `project`, and `createdAt`.

---

## Completion Flows

### Happy Path

```text
working → pr_open → review_pending
    → approved → mergeable → merged
```

1. Agent creates a PR
2. CI runs and passes
3. Reviewer approves
4. PR merges
5. Tracker issue is updated to closed
6. Session metadata archived

### CI Failure Auto-Retry

```text
pr_open → ci_failed → working → pr_open (retry)
```

The `ci-failed` reaction fires automatically: the orchestrator sends the CI error output to the agent, which attempts to fix it. Default: up to 2 retries before escalating to a human.

### Review Changes

```text
review_pending → changes_requested → working → pr_open
```

When a reviewer requests changes, the `changes-requested` reaction forwards the review comments to the agent, which addresses them and pushes new commits.

### Human Intervention

```text
working → needs_input (agent asks a question)
working → stuck (agent inactive beyond threshold)
```

Both states trigger a notification to the configured channels (desktop, Slack, etc.). The agent waits until you respond — via `ao attach` to send a message, or `ao kill` to end the session.

### Failure

```text
working → errored (unrecoverable error)
working → killed (runtime died or user killed it)
```

On `killed`, `errored`, or `stuck`, the tracker issue is reset so the story can be re-assigned to a new agent later.

### All Sessions Complete

When every active session reaches a terminal state, the `all-complete` event fires once. If a tracker is configured and all issues are closed, `sprint-complete` fires as well.

---

## Polling and Reactions

The LifecycleManager polls every 30 seconds. On each poll:

1. Checks runtime liveness for every active session
2. Detects agent activity via the agent plugin
3. Queries PR state, CI status, and review decisions via SCM
4. Determines the new status and compares to previous
5. If status changed: publishes an event, checks reaction config

Reactions are configured in `agent-orchestrator.yaml`. Each reaction maps an event to an action:

| Reaction | Trigger | Auto | Action |
|----------|---------|------|--------|
| `ci-failed` | CI fails | yes | Send errors to agent for fix |
| `changes-requested` | Review changes | yes | Forward comments to agent |
| `merge-conflicts` | Merge conflict | yes | Agent rebases and resolves |
| `approved-and-green` | Approved + CI green | no | Notify human to merge |
| `agent-stuck` | Inactive threshold | yes | Notify human |
| `agent-needs-input` | Agent asks question | yes | Notify human |

_Six user-facing reactions shown. Five additional internal reactions (`bugbot-comments`, `agent-exited`, `all-complete`, `tracker-story-done`, `tracker-sprint-complete`) are documented on the Configuration page._

{: .highlight }
> See the [Configuration](../../getting-started/configuration/#reactions) page for the full reactions reference and override examples.

---

## Session Metadata

Every session stores its state in a flat key=value file — no database required.

**Location:** `~/.agent-orchestrator/{hash}/sessions/{id}`

**Key fields:**

| Field | Description |
|-------|-------------|
| `worktree` | Path to the workspace directory |
| `branch` | Git branch name |
| `status` | Current SessionStatus |
| `tmuxName` | Tmux session name (if using tmux runtime) |
| `issue` | Tracker issue ID or URL |
| `pr` | PR URL (once created) |
| `summary` | Agent-generated session summary |
| `project` | Project name from config |
| `agent` | Agent plugin name |
| `createdAt` | ISO timestamp of session creation |
| `role` | Agent role (coder, reviewer, etc.) |
| `exitCode` | Process exit code (if terminated) |

**Inspect a session:**

```bash
# List all active sessions
ao list

# View session details
ao logs my-app-3

# Attach to an active session
ao attach my-app-3
```

---

## Next Steps

- **[Architecture Overview](../../getting-started/architecture-overview/)** — how the 8 plugin slots work together
- **[Quick Start](../../getting-started/quick-start/)** — 5-minute hands-on tutorial
- **[Autopilot](../autopilot/)** — autonomous and supervised agent modes
- **[Reactions](../reactions/)** — complete reaction engine reference
