---
title: Session Commands
nav_order: 2
parent: CLI Reference
description: Session commands for Agent Orchestrator — ao spawn, batch-spawn, spawn-story, pause, resume, session, send, open, agent, assign, assign-next, and assign-suggest for agent session lifecycle management.
---

# Session Commands

The Session category includes 12 top-level commands for agent session lifecycle management — spawning, pausing, resuming, messaging, and assigning agents to stories. The `ao session` command is a parent with 4 subcommands for session housekeeping.

{: .highlight }
> **Quick start:** Run `ao spawn <project> --story <id>` to launch an agent for a specific story, then use `ao send <session>` to deliver follow-up messages. See [Getting Started](../../../getting-started/) for the full walkthrough.

---

## Command Summary

| Command | Description | `--json` |
|---------|-------------|----------|
| [`ao spawn <project> [issue]`](#ao-spawn) | Spawn a single agent session | No |
| [`ao batch-spawn <project> [issues...]`](#ao-batch-spawn) | Spawn sessions for multiple issues with duplicate detection | No |
| [`ao spawn-story`](#ao-spawn-story) | Spawn an AI agent for a story with full context from sprint-status.yaml | No |
| [`ao pause <agentId>`](#ao-pause) | Pause blocked detection for an agent (prevents automatic blocking) | No |
| [`ao resume <storyId>`](#ao-resume) | Resume a blocked story with a new agent | No |
| [`ao session`](#ao-session) | Session management (ls, kill, cleanup) | No |
| [`ao send <session> [message...]`](#ao-send) | Send a message to a session with busy detection and retry | No |
| [`ao open [target]`](#ao-open) | Open session(s) in terminal tabs | No |
| [`ao agent [action] [id]`](#ao-agent) | Query agent assignments and status | Yes (`--format json`) |
| [`ao assign <story-id> <agent-id>`](#ao-assign) | Manually assign a story to an agent | No |
| [`ao assign-next <agent-id>`](#ao-assign-next) | Auto-assign the highest-priority story to an agent | No |
| [`ao assign-suggest <story-id>`](#ao-assign-suggest) | Recommend optimal agent assignment for a story | Yes |

---

## ao spawn

Spawns a single agent session for a project. Two flows depending on whether `--story` is provided:

- **Plain flow**: `ao spawn <project> [issue]` — spawns a session for a tracker issue
- **Story-based flow**: `ao spawn <project> --story <id>` — spawns with full story context from sprint-status.yaml

### Flags

| Flag | Description |
|------|-------------|
| `--open` | Open session in terminal tab |
| `--agent <name>` | Override the agent plugin (e.g. glm, codex, claude-code) |
| `--story <id>` | Story ID from sprint-status.yaml (e.g. 1-2-user-auth) |
| `--force` | Skip dependency and conflict checks |

### Story-Based Flow

When `--story` is provided, the command:

1. Validates story ID exists in `sprint-status.yaml`
2. Loads the story file and parses it into context
3. Checks for unresolved dependencies (skipped with `--force`)
4. Runs conflict detection against the agent registry (skipped with `--force`)
5. Formats the story prompt and spawns the agent session
6. Registers the agent–story assignment with a context hash
7. Publishes lifecycle events (`storyAssigned`, `storyStarted`)
8. Prints session details (worktree, branch, attach command)

On dependency conflict, prompts:

```text
Story has unresolved dependencies. Continue anyway?
```

On agent conflict (story already has an active agent):

```text
Conflict: Story {id} already has an active agent
```

### Plain Flow

```bash
# Spawn for a tracker issue
ao spawn my-app INT-1234

# Spawn and open in terminal
ao spawn my-app INT-1234 --open

# Override agent type
ao spawn my-app INT-1234 --agent codex
```

Runs preflight checks, then spawns a session without story context.

### Output (Story-Based Flow)

```text
Spawning Agent for Story: 1-2-user-auth
  Session my-app-1-2-user-auth created
  Worktree:  /path/to/worktree
  Branch:    story/1-2-user-auth
  Attach:    tmux attach -t my-app-1-2-user-auth
```

### Output (Plain Flow)

```text
  Session my-app-INT-1234 created
  Worktree:  /path/to/worktree
  Branch:    INT-1234
  Attach:    tmux attach -t my-app-INT-1234
```

---

## ao batch-spawn

Spawns sessions for multiple issues with duplicate detection. Use `--ready` to auto-discover stories from the tracker.

### Flags

| Flag | Description |
|------|-------------|
| `--open` | Open sessions in terminal tabs |
| `--ready` | Auto-discover stories with 'ready-for-dev' status from tracker |

### Examples

```bash
# Spawn multiple issues
ao batch-spawn my-app INT-100 INT-101 INT-102

# Auto-discover ready stories
ao batch-spawn my-app --ready

# Combine explicit issues with auto-discovery
ao batch-spawn my-app INT-100 --ready
```

### Duplicate Detection

Two layers of deduplication:

1. **Existing sessions** — skips issues that already have a live session (not `killed`, `done`, or `exited`)
2. **Intra-batch** — skips duplicate issues within the same command invocation

Skipped issues print: `Skip {issue} — already has session: {sessionId}`

A **500ms delay** between spawns prevents resource contention.

### Output

```text
╔══════════════════════════════╗
║   BATCH SESSION SPAWNER      ║
╚══════════════════════════════╝
Summary:
  Created: 2 sessions
  Skipped: 1 (duplicate)
  Failed:  0
```

---

## ao spawn-story

Spawns an AI agent for a story with full context from `sprint-status.yaml`. This is the most feature-rich spawn command — it loads the story file, checks conflicts, and waits for agent readiness.

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--story <id>` | **Yes** | Story ID from sprint-status.yaml (e.g., 1-2-cli-spawn-agent) |
| `--session <name>` | No | Custom session name (default: ao-{story-id}) |
| `--agent <type>` | No | Override agent type (claude-code, codex, aider, glm) |
| `--project <id>` | No | Project ID from config (auto-detected if not specified) |
| `--open` | No | Open session in terminal tab after spawn |
| `--force` | No | Skip duplicate assignment check |

### Story Context Loading

```text
ao spawn-story --story 1-2-user-auth
  |
  +-- Load config, resolve project
  +-- Check tmux availability
  +-- Load sprint-status.yaml
  +-- Validate story ID in development_status
  +-- Conflict detection (--force skips)
  |     +-- ConflictDetectionService.canAssign()
  |     +-- If conflict: prompt [f]orce or [c]ancel
  +-- Read and parse story file
  |     +-- findStoryFile() -> parseStoryFile()
  |     +-- Enrich with deps + priorities
  +-- Spawn agent session
  +-- Register assignment in registry
  +-- Publish events (non-fatal)
  +-- Wait for agent readiness (10s timeout)
  +-- Print session details
```

### Agent Readiness Wait

After spawning, polls every 200ms for up to **10 seconds** to confirm the agent is ready. On timeout, prints a note but does not fail:

```text
Agent readiness check timed out (continuing anyway)
Note: Agent readiness check timed out after 10s
```

### Conflict Detection

When a conflict is detected (story already has an active agent):

```text
Conflict Prevention: Cannot spawn agent for {storyId}
Options:
  [f]orce  -- Spawn anyway (creates conflict)
  [c]ancel -- Abort spawn
```

With `--force`: prints `Skipping conflict check (--force specified)` and proceeds.

### Examples

```bash
# Spawn with story ID (auto-detect project)
ao spawn-story --story 1-2-user-auth

# Specify project and agent
ao spawn-story --story 1-2-user-auth --project my-app --agent codex

# Custom session name
ao spawn-story --story 1-2-user-auth --session custom-name

# Skip conflict check
ao spawn-story --story 1-2-user-auth --force
```

---

## ao pause

Pauses blocked detection for an agent, preventing it from being automatically marked as blocked while inactive. Use `--resume` to re-enable detection.

### Flags

| Flag | Description |
|------|-------------|
| `--resume` | Resume blocked detection for the agent |

### Examples

```bash
# Pause blocked detection
ao pause my-app-1-2-user-auth

# Resume blocked detection
ao pause my-app-1-2-user-auth --resume
```

### Behavior

**Pause** (default):
- Prints: `Pausing blocked detection for agent {agentId}`
- Shows agent ID, story ID, and status
- Prints: `The agent will not be marked as blocked while inactive.`
- Hint: `To resume: ao pause {agentId} --resume`

**Resume** (`--resume`):
- Prints: `Resuming blocked detection for agent {agentId}`
- Shows agent ID, story ID, and status
- Prints: `Blocked detection resumed`
- Note: `The agent will now be monitored for inactivity.`

---

## ao resume

Resumes a blocked story with a new agent. The story **must** have status `blocked` — only blocked stories can be resumed.

### Flags

| Flag | Description |
|------|-------------|
| `--message <msg>` | Additional context for the resumed agent |
| `--agent <name>` | Custom agent session name |

### Retry Tracking

Each resume increments a retry counter. The command:

1. Checks `storyStatus === "blocked"` — exits if not blocked
2. Retrieves the previous agent assignment
3. Increments retry count: `Retry #{n} for story {storyId}`
4. Displays previous attempt history if available
5. Formats a resume context (story, previous assignment, user message, exit code)
6. Spawns a new agent session with the resume context
7. Writes an audit event to JSONL (`story_resumed`)
8. Clears the blocking reason and sets status to `in-progress`

### User Message Validation

The `--message` text is passed to the new agent as context. It is truncated to **200 characters** in the audit log.

### Examples

```bash
# Resume a blocked story
ao resume 1-2-user-auth

# Resume with additional context
ao resume 1-2-user-auth --message "Focus on the API endpoint first"

# Resume with custom agent name
ao resume 1-2-user-auth --agent retry-agent
```

### Output

```text
Resuming Story: 1-2-user-auth
  Cleared: dependency blocked -> now in-progress
  Retry #2 for story 1-2-user-auth
Resumed 1-2-user-auth with agent my-app-1-2-user-auth
  Attach: tmux attach -t my-app-1-2-user-auth
Next steps:
  Check agent status: ao status --agent {id}
  View agent logs: ao logs {id}
  Monitor progress: ao status 1-2-user-auth
```

---

## ao session

Parent command for session management with 4 subcommands:

| Subcommand | Description | Flags |
|-----------|-------------|-------|
| `session ls` | List all sessions | `-p, --project <id>` |
| `session kill <session>` | Kill a session and remove its worktree | *(none)* |
| `session cleanup` | Kill sessions where PR is merged or issue is closed | `-p, --project <id>`, `--dry-run` |
| `session restore <session>` | Restore a terminated/crashed session in-place | *(none)* |

### ao session ls

```bash
# List all sessions
ao session ls

# Filter by project
ao session ls -p my-app
```

Displays sessions grouped by project. Each session shows:

- Session ID (green)
- Activity age (dim)
- Git branch (cyan, if present)
- Status (dim, if present)
- PR URL (blue, if PR exists)

Projects with no active sessions show `(no active sessions)`.

### ao session kill

```bash
ao session kill my-app-1-2-user-auth
```

Kills the tmux session and removes the worktree. On success: `Session {name} killed.`

### ao session cleanup

```bash
# Show what would be cleaned
ao session cleanup --dry-run

# Clean up for a specific project
ao session cleanup -p my-app

# Actually clean up
ao session cleanup
```

**Dry run** shows sessions that *would* be killed (yellow) without actually killing them:

```text
Checking for completed sessions...
  Would kill my-app-completed-feature
Dry run complete. 1 session would be cleaned.
```

**Real run** kills sessions whose PR is merged or issue is closed:

```text
Checking for completed sessions...
  Cleaned: my-app-completed-feature
Cleanup complete. 1 sessions cleaned.
```

### ao session restore

```bash
ao session restore my-app-crashed-session
```

Restores a terminated or crashed session in-place. On success:

```text
Session my-app-crashed-session restored.
  Worktree: /path/to/worktree
  Branch:   feature/my-branch
  Attach:   tmux attach -t my-app-crashed-session
```

Error conditions:
- `Cannot restore: {reason}` — session is not in a restorable state
- `Workspace missing: {message}` — worktree directory no longer exists

---

## ao send

Sends a message to a session with busy detection. Waits for the agent to become idle before delivering the message, then verifies it was received.

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--file <path>` | `-f` | | Send contents of a file instead |
| `--no-wait` | | | Don't wait for session to become idle before sending |
| `--timeout <seconds>` | | `600` | Max seconds to wait for idle |

### Examples

```bash
# Send a message
ao send my-app-1-2-user-auth "Fix the failing test"

# Send from a file
ao send my-app-1-2-user-auth -f instructions.md

# Send without waiting
ao send my-app-1-2-user-auth "Quick note" --no-wait

# Custom timeout
ao send my-app-1-2-user-auth "Fix tests" --timeout 300
```

### Busy Detection

Unless `--no-wait`, the command polls the tmux pane every **5 seconds** checking for agent activity:

```text
Waiting for my-app-1-2-user-auth to become idle...
```

If the timeout is exceeded: `Timeout waiting for idle. Sending anyway.`

### Tmux Delivery Mechanism

Messages are delivered via tmux `send-keys`:

- **Short messages** (no newlines, <= 200 chars): sent directly via `tmux send-keys -l`
- **Long messages or file content**: written to a temp file, loaded into the tmux buffer via `load-buffer`, then pasted via `paste-buffer`
- After delivery, presses `Enter` to submit

### Verification

After sending, the command makes **3 attempts** (2s apart) to confirm the message was received by checking for agent activity. Outcomes:

- `Message sent and processing` — agent is actively working on the message
- `Message queued (session finishing previous task)` — message is in the agent's queue
- `Message sent — could not confirm it was received` — all 3 attempts failed (yellow warning)

---

## ao open

Opens session(s) in terminal tabs (iTerm2). Supports opening a single session, all sessions for a project, or all sessions across all projects.

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--new-window` | `-w` | Open in a new terminal window |

### Target Resolution

| Target | Behavior |
|--------|----------|
| *(none)* or `"all"` | Open all sessions across all projects |
| `<project-id>` | Open all sessions for that project |
| `<session-name>` | Open a single session by name |

### Examples

```bash
# Open all sessions
ao open

# Open all sessions for a project
ao open my-app

# Open a specific session
ao open my-app-1-2-user-auth

# Open in a new window
ao open my-app -w
```

### Output

```text
Opening 3 sessions...
  Opened: my-app-1-2-user-auth
  Opened: my-app-3-4-api
  Opened: my-app-5-6-tests
```

If the terminal open fails (iTerm2 not available), falls back to a tmux hint:

```text
  my-app-1-2-user-auth — attach with: tmux attach -t my-app-1-2-user-auth
```

On unknown target: `Unknown target: {target}`

---

## ao agent

Queries agent assignments and status. Supports three actions: `status` (default), `story`, and `registry`.

### Flags

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: table (default) or json |
| `--reload` | Reload registry from disk |

### Actions

| Action | Arguments | Description |
|--------|-----------|-------------|
| `status` *(default)* | `[id]` | Show agent status or list all agents |
| `story` | `<story-id>` | Show which agent is assigned to a story |
| `registry` | *(none)* | Show registry summary |

### Status Emojis

| Status | Emoji |
|--------|-------|
| `spawning` | :yellow_circle: |
| `active` | :green_circle: |
| `idle` | :orange_circle: |
| `completed` | :white_check_mark: |
| `blocked` | :red_circle: |
| `disconnected` | :black_circle: |

### Examples

```bash
# List all agents
ao agent

# Show specific agent status
ao agent status my-app-1-2-user-auth

# Show agent for a story
ao agent story 1-2-user-auth

# Show registry info
ao agent registry

# JSON output
ao agent --format json

# Reload registry from disk
ao agent --reload
```

### Output — List All Agents

```text
Agent Registry
  🟢 my-app-1-2-user-auth       active       1-2-user-auth                   2h ago
  🟠 my-app-3-4-api              idle         3-4-api-endpoint                5h ago
  ⚫ my-app-old-feature          disconnected old-feature                     2d ago
  Total: 3 agents
  ⚠️  1 disconnected agent(s) - run 'ao cleanup' to remove
```

{: .highlight }
> **Note:** The zombie warning references `ao cleanup`, but the correct command is [`ao session cleanup`](#ao-session-cleanup).

### Output — Registry Info

```text
Agent Registry Info
  Total agents:   3
  Active:         1
  Idle:           1
  Completed:      0
  Blocked:        0
  Disconnected:   1
```

---

## ao assign

Manually assigns a story to an agent. Validates dependencies, delivers story context to the agent session, and logs an audit event.

### Flags

| Flag | Description |
|------|-------------|
| `--force` | Skip confirmation prompts |
| `--unassign` | Remove current story assignment from agent |

### Examples

```bash
# Assign a story to an agent
ao assign 1-2-user-auth my-app-1-2-user-auth

# Force assign (skip prompts)
ao assign 1-2-user-auth my-app-1-2-user-auth --force

# Unassign a story from an agent
ao assign --unassign my-app-1-2-user-auth
```

### Dependency Validation

Before assigning, checks each dependency in `sprint-status.yaml`:

- Dependency not found: `Dependency '{depId}' not found in sprint status`
- Dependency not complete: `Dependency '{depId}' is not complete (status: {status})`

If warnings exist, prompts: `Proceed anyway?` (skipped with `--force`)

### Audit Logging

Two audit event types are logged to JSONL:

- **`assign`**: on successful assignment (includes agent ID, story ID, previous story, forced flag)
- **`unassign`**: on successful unassignment (includes agent ID, story ID, forced flag)

### Output

```text
Assigning Story to Agent: my-app-1-2-user-auth
Assigned 1-2-user-auth to agent my-app-1-2-user-auth in 245ms
  Agent session: my-app-1-2-user-auth
  Attach: tmux attach -t my-app-1-2-user-auth
```

---

## ao assign-next

Auto-assigns the highest-priority story to an agent. Builds a priority queue from the sprint backlog, checks pool eligibility, and assigns the top candidate.

### Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Show priority queue without assigning |
| `--force` | Skip confirmation prompts |

### Examples

```bash
# Auto-assign best story
ao assign-next my-app-1-2-user-auth

# See what would be assigned (dry run)
ao assign-next my-app-1-2-user-auth --dry-run

# Force assign without prompts
ao assign-next my-app-1-2-user-auth --force
```

### Priority Queue

The queue is built from `sprint-status.yaml` — stories with status `ready-for-dev` or `backlog` that are not already assigned. Displayed as a table:

```text
Assignment Queue (Dry Run)
Story ID                                  Priority   Epic
1-2-user-auth                             8          epic-auth
3-4-api-endpoint                          5          epic-api
5-6-testing                               2          epic-quality
3 assignable stories found.
```

Positive priorities are colored green; others are dim.

### Pool Eligibility

If the agent belongs to a different project (pool agent), checks shared pool configuration:

```text
Pool agent from my-other-project eligible for project my-app
```

If ineligible: `Agent '{id}' is not eligible for project '{project}'`

### Output

```text
Auto-Assign: 1-2-user-auth
  Story:     Add user authentication
  Story ID:  1-2-user-auth
  Epic:      epic-auth
  Priority:  8
  Agent:     my-app-1-2-user-auth
Assigned 1-2-user-auth to agent my-app-1-2-user-auth in 180ms
```

---

## ao assign-suggest

Recommends the optimal agent for a story using affinity scoring based on agent learning history and domain tags.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--domains <tags>` | Comma-separated domain tags (e.g., frontend,testing) |

### Examples

```bash
# Get suggestions for a story
ao assign-suggest 1-2-user-auth

# Filter by domain expertise
ao assign-suggest 1-2-user-auth --domains frontend,testing

# JSON output for scripting
ao assign-suggest 1-2-user-auth --json
```

### Affinity Scoring

Each agent is scored based on:
- **Learning history** — past success rates with similar stories
- **Domain tags** — match between `--domains` and agent expertise
- **Success rate** — percentage of completed assignments

### Output

```text
Assignment Suggestions for 1-2-user-auth
Agent                        Score    Success     Recommendation
-----------------------------------------------------------------
my-app-agent-1               0.87     87%         ★ Recommended
my-app-agent-2               0.72     72%         —
my-app-agent-3               0.45     45%         —
```

The top-scored agent is marked `★ Recommended` (green); others show `—` (dim).

With `--json`:

```json
{
  "storyId": "1-2-user-auth",
  "candidates": [
    { "agentId": "my-app-agent-1", "score": 0.87, "successRate": 0.87 }
  ]
}
```

---

## Cross-Cutting Patterns

All Session commands share these conventions:

| Pattern | Detail |
|---------|--------|
| Config required | `loadConfig()` — error: `"No agent-orchestrator.yaml found. Run 'ao init' first."` (most commands) or `"No config found. Run 'ao init' first."` (`assign-suggest`) |
| Session manager | `getSessionManager(config)` from `../lib/create-session-manager.js` |
| Agent registry | `getAgentRegistry(config)` from `@composio/ao-core` |
| Preflight checks | `checkTmux()`, `checkGhAuth()` from `../lib/preflight.js` |
| Context hash | `computeStoryContextHash()` for agent–story assignment tracking |
| Event publishing | Non-fatal — wrapped in try/catch, never blocks execution |
| Audit logging | `logAuditEvent()` writes JSONL events to the audit directory |

---

## Next Steps

- [Setup Commands](../setup-commands/) — Project init, start, stop, plugins
- [Sprint Commands](../sprint-commands/) — Sprint planning and execution
- [Story Commands](../story-commands/) — Story and epic management
- [Monitoring Commands](../monitoring/) — Status, health, and metrics
- [Review & PR Commands](../review-pr/) — Code reviews and PR workflow
- [Intelligence Commands](../intelligence/) — Analytics and forecasting
- [Infrastructure Commands](../infrastructure/) — Providers, events, triggers
- [CLI Reference](./) — Command categories and common flags
- [Getting Started](../../../getting-started/) — Installation and first project
- [Configuration](../../../getting-started/configuration/) — Full config reference
