---
title: Autopilot
nav_order: 3
parent: Core Concepts
description: How autopilot modes work — off, supervised, and autonomous story advancement, execution modes, and safety safeguards.
---

# Autopilot

Autopilot automatically advances stories through the development pipeline without manual intervention. When an agent finishes a story, the autopilot engine finds the next backlog story and enqueues a new spawn — either immediately (autonomous) or after your approval (supervised).

{: .highlight }
> **TL;DR:** Three modes: `off` (default, manual), `supervised` (approve before spawn), `autonomous` (spawn automatically). All spawns go through the WIP-limited queue. Safeguards prevent infinite loops and off-hours spawning.

---

## Autopilot Modes

Three modes control how aggressively stories are auto-advanced:

```text
Story done → Autopilot checks mode
              │
              ├─ off: do nothing
              │
              ├─ supervised: notify → wait
              │     ├─ Approved → enqueue
              │     └─ Timeout (5m) → enqueue
              │
              └─ autonomous: enqueue now
                    └─ Notify after the fact
```

| Mode | Behavior | Approval | Notification |
|------|----------|----------|-------------|
| `off` | No auto-spawning (default) | N/A | None |
| `supervised` | Sends approval request before spawning | Required (or 5-min timeout) | Before spawn |
| `autonomous` | Spawns immediately, notifies after | Not required | After spawn |

{: .highlight }
> **Supervised timeout:** If you don't respond within 5 minutes (configurable), the spawn is **queued** — not auto-approved. This is an intentional design choice to prevent unintended spawning while you're away.

### Mode Switching

You can switch modes at runtime without restarting the orchestrator:

- `setMode(mode)` — Changes the active mode and clears the paused state
- `approveSpawn(storyId)` — Early approval for supervised mode (cancels the timeout)
- Paused state — Autopilot pauses when no backlog stories remain; clears on mode change

### Story Discovery

When a story completes, autopilot reads `sprint-status.yaml` and finds the first entry that:

1. Has status `backlog`
2. Matches the pattern `\d+[a-z]?-\d+-` (story keys, not epics or retros)
3. Is in the configured project

If no matching story is found, autopilot **pauses** and sends a "no next story" notification.

---

## Mode Comparison

| Aspect | Off | Supervised | Autonomous |
|--------|-----|-----------|-----------|
| **Auto-spawn** | No | After approval/timeout | Immediately |
| **Human in loop** | Fully manual | Approval gate | Post-facto only |
| **Use case** | Full control, debugging | Production with oversight | CI/CD, overnight runs |
| **Default timeout** | N/A | 5 minutes | N/A |
| **Risk level** | None | Low | Medium |

---

## Action Log

The autopilot engine keeps a rolling log of the last **20 actions**. Each action records:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO timestamp of the action |
| `action` | One of 6 action types (see below) |
| `storyId` | Target story identifier |
| `detail` | Human-readable description |

**Action types:** `spawn-enqueued`, `spawn-failed`, `notification-sent`, `no-next-story`, `mode-changed`, `timeout-queued`

---

## Execution Modes

{: .highlight }
> **Key distinction:** AutopilotMode (off/supervised/autonomous) controls **when** stories are spawned. ExecutionMode (standard/persistent/lightweight) controls **how** each session runs. They are independent settings.

Each story type gets a default execution mode that affects session timeout and retry behavior:

| Execution Mode | Timeout Multiplier | Retry Behavior | Default For |
|---------------|-------------------|----------------|-------------|
| `standard` | 1.0x | Normal | implementation, bugfix |
| `persistent` | 3.0x | Auto-re-queue on failure | (manual override) |
| `lightweight` | 0.5x | No retry | exploration, review |

Timeouts are clamped between 1 minute and 60 minutes regardless of mode.

### Persistent Execution

Persistent sessions automatically re-queue after verification failure instead of blocking:

```text
Verification fails → Check execution mode
              │
              ├─ standard → story blocked
              │
              └─ persistent → re-queue (up to 5x)
                    └─ 5 failures → blocked
```

**Persistent config defaults:**

| Setting | Default | Description |
|---------|---------|-------------|
| `persistentMaxRetries` | 5 | Maximum re-queue attempts |
| `persistentMaxExtensions` | 3 | Maximum timeout extensions |

---

## Safeguards

Autopilot includes several safety mechanisms to prevent runaway spawning:

### Spawn Queue

All autopilot spawns go through the **SpawnQueue** — never directly through `sessionManager.spawn()`. The queue enforces:

- **WIP limits** — `maxConcurrentAgents` prevents overloading
- **Priority scheduling** — Higher-priority stories spawn first
- **FIFO ordering** — Same-priority stories spawn in file order

### Loop Detector

The loop detector tracks restart cycles per story. If an agent is restarted more than the configured threshold (default: 3 times), the story is flagged as looping and autopilot stops retrying it.

### Business Hours

When configured, autopilot checks `isWithinBusinessHours()` before spawning. Supports timezone-aware start/end times and overnight windows (e.g., 22:00–06:00). Spawns outside business hours are deferred.

### Approval Gates

The `approvalRequired` config can gate specific actions:

| Action | Description |
|--------|-------------|
| `spawn` | Require approval for any new spawn |
| `kill` | Require approval before killing a session |
| `autopilot-advance` | Require approval specifically for autopilot spawns |

### No-Story Handling

When no backlog story exists, autopilot pauses and sends a notification. It does not search for stories in other statuses. Manually switch out of paused state with `setMode()`.

---

## Configuration

Autopilot is configured in `agent-orchestrator.yaml`:

```yaml
# Autopilot mode (default: off)
autopilot: supervised

# Supervised mode timeout in ms (default: 300000 = 5 min)
supervisedTimeoutMs: 300000

# Maximum concurrent agent sessions
maxConcurrentAgents: 3

# Require approval for specific actions
approvalRequired:
  - autopilot-advance
  - kill

# Persistent execution settings
persistent:
  persistentMaxRetries: 5
  persistentMaxExtensions: 3
```

All settings can be changed at runtime without restarting the orchestrator. See the [Configuration](../../getting-started/configuration/) page for the full config reference.

---

## Next Steps

- **[Sessions](../sessions/)** — the 18-state session lifecycle and spawn pipeline
- **[Stories & Sprints](../stories-sprints/)** — story model, assignment flow, completion handling
- **[Reactions](../reactions/)** — event-driven reaction engine reference
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
