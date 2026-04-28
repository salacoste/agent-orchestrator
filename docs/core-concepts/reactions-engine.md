---
title: Reactions Engine
nav_order: 4
parent: Core Concepts
description: How the reactions engine works — default auto-reactions, trigger conditions, action flows, escalation, and custom configuration.
---

# Reactions Engine

The reactions engine is an event-driven system that automatically responds to state changes in your agent sessions. When a CI build fails, a reviewer requests changes, or an agent gets stuck, the engine triggers a configured reaction — sending instructions to the agent, notifying you, or escalating if the issue persists.

{: .highlight }
> **TL;DR:** 11 default reactions cover CI failures, review comments, merge conflicts, stuck agents, and sprint completion. 3 action types (`send-to-agent`, `notify`, `auto-merge`). Configurable per-project with escalation after retries or timeouts.

---

## How Reactions Work

The lifecycle manager polls every 30 seconds and evaluates each active session for state changes. When a transition is detected, it maps the new state to an event type, looks up the matching reaction, and executes it.

```text
Poll (30s) → Detect state change
  │
  ├─ Map status → EventType
  │     └─ e.g. ci_failing → ci.failing
  │
  ├─ Look up reaction key
  │     └─ e.g. ci.failing → ci-failed
  │
  ├─ Resolve config (global + project)
  │
  └─ Execute reaction
        ├─ send-to-agent → message to agent
        ├─ notify → alert human
        └─ Escalate if retries exceeded
```

### Trigger Mapping

Each session status maps to an event type, which maps to a reaction key:

| Event Type | Reaction Key | Auto |
|------------|-------------|------|
| `ci.failing` | `ci-failed` | yes |
| `review.changes_requested` | `changes-requested` | yes |
| `automated_review.found` | `bugbot-comments` | yes |
| `merge.conflicts` | `merge-conflicts` | yes |
| `merge.ready` | `approved-and-green` | no |
| `session.stuck` | `agent-stuck` | yes |
| `session.needs_input` | `agent-needs-input` | yes |
| `session.killed` | `agent-exited` | yes |
| `summary.all_complete` | `all-complete` | yes |
| `tracker.story_done` | `tracker-story-done` | yes |
| `tracker.sprint_complete` | `tracker-sprint-complete` | yes |

{: .highlight }
> **`auto: false`** reactions like `approved-and-green` require explicit approval. They still fire but won't take automated action — they notify instead.

---

## Default Reactions

The engine ships with **11 preconfigured reactions** grouped by action type:

### send-to-agent Reactions (4)

These reactions send a message directly to the agent session, giving it instructions to fix the problem:

| Reaction Key | Trigger | Retries | Escalate After |
|-------------|---------|---------|---------------|
| `ci-failed` | CI build fails | 2 | 2 attempts |
| `changes-requested` | Reviewer requests changes | — | 30 min |
| `bugbot-comments` | Automated review comments | — | 30 min |
| `merge-conflicts` | Branch has merge conflicts | — | 15 min |

### notify Reactions (7)

These reactions send a notification to configured channels (desktop, Slack, Telegram, etc.):

| Reaction Key | Trigger | Priority | Notes |
|-------------|---------|----------|-------|
| `approved-and-green` | PR approved + CI green | `action` | `auto: false` |
| `agent-stuck` | Agent inactive for threshold | `urgent` | Threshold: 10 min |
| `agent-needs-input` | Agent requests human input | `urgent` | — |
| `agent-exited` | Agent session terminated | `urgent` | — |
| `all-complete` | All sessions finished | `info` | Includes summary |
| `tracker-story-done` | Tracker issue closed | `info` | Includes summary |
| `tracker-sprint-complete` | All tracker issues closed | `action` | — |

### Action Types

Each reaction uses one of **3 action types**:

| Action | Description |
|--------|-------------|
| `send-to-agent` | Sends `message` text to the agent session |
| `notify` | Sends a notification to humans via configured notifiers |
| `auto-merge` | Triggers auto-merge via SCM plugin |

{: .highlight }
> **`auto-merge`** is available for custom reactions but has no default shipping reaction. The current implementation delegates to the SCM plugin.

---

## Reaction Configuration

Each reaction is defined by a `ReactionConfig` with **8 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | `true` = execute automatically, `false` = notify only |
| `action` | `"send-to-agent" \| "notify" \| "auto-merge"` | What the reaction does when triggered |
| `message` | string? | Text sent to the agent (for `send-to-agent` actions) |
| `priority` | `EventPriority?` | Notification priority: `urgent`, `action`, `warning`, `info` |
| `retries` | number? | Max non-escalating attempts (default: unlimited) |
| `escalateAfter` | number or string? | Escalation threshold (attempts or duration) |
| `threshold` | string? | Duration before triggering (e.g., `"10m"`) |
| `includeSummary` | boolean? | Include session summary in notification |

### Reaction Result

Each execution returns a `ReactionResult` with **5 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `reactionType` | string | The reaction key that was executed |
| `success` | boolean | Whether the action completed without error |
| `action` | string | The action type that was performed |
| `message` | string? | Human-readable result message |
| `escalated` | boolean | Whether the reaction was escalated |

---

## CI Fix Flow

When CI fails on a PR, the `ci-failed` reaction sends instructions to the agent, tracks retries, and escalates if the agent can't fix it:

```text
CI fails → ci.failing event detected
  │
  ├─ 1. Match reaction: ci-failed
  │     (auto: true, retries: 2, escalateAfter: 2)
  │
  ├─ 2. Send message to agent
  │     "CI is failing on your PR. Run gh pr checks..."
  │
  ├─ 3. Agent attempts fix
  │     ├─ Fix works → CI passes → done
  │     └─ Fix fails → retry on next poll
  │
  └─ 4. After 2 failed attempts
        └─ Escalate → notify human (priority: urgent)
```

The `retries: 2` config means the agent gets up to 2 attempts. The `escalateAfter: 2` means escalation triggers when attempts exceed 2. The tracker is reset when the session status changes (e.g., CI goes back to passing).

---

## Review Address Flow

When a reviewer requests changes, the `changes-requested` reaction notifies the agent with the review comments:

```text
Changes requested → review.changes_requested event
  │
  ├─ 1. Match reaction: changes-requested
  │     (auto: true, escalateAfter: "30m")
  │
  ├─ 2. Send message to agent
  │     "There are review comments on your PR..."
  │
  ├─ 3. Agent addresses feedback
  │     └─ Pushes fixes → reviewer re-reviews
  │
  └─ 4. If unresolved after 30 minutes
        └─ Escalate → notify human (priority: urgent)
```

The `escalateAfter: "30m"` uses a duration string parsed by the `parseDuration` helper (supports `s`, `m`, `h` units). If the agent hasn't resolved the review comments within 30 minutes, the reaction escalates to the human.

---

## Escalation

Reactions track execution state per session using a `ReactionTracker` (attempts count + first-trigger timestamp). Escalation triggers when:

| Trigger | Config Field | Example |
|---------|-------------|---------|
| **Attempt-based** | `retries` | `retries: 2` → escalate after 2 failed attempts |
| **Duration-based** | `escalateAfter` (string) | `"30m"` → escalate after 30 minutes |
| **Count-based** | `escalateAfter` (number) | `2` → escalate when attempts exceed 2 |

On escalation, the engine emits a `reaction.escalated` event and notifies the human at the configured priority (defaults to `urgent`).

### Tracker Lifecycle

- **Created** when a reaction first fires for a session
- **Incremented** on each poll cycle where the trigger condition persists
- **Cleared** when the session's status changes (e.g., CI goes from failing to passing)
- **Pruned** when the session no longer exists in the active session list

---

## Custom Configuration

Reactions are configured in `agent-orchestrator.yaml` at two levels:

### Global Configuration

```yaml
reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    message: "CI is failing on your PR. Run gh pr checks for details."
    retries: 2
    escalateAfter: 2

  agent-stuck:
    auto: true
    action: notify
    priority: urgent
    threshold: "10m"
```

### Per-Project Overrides

Override specific fields for individual projects using partial config:

```yaml
projects:
  my-app:
    repo: org/repo
    reactions:
      ci-failed:
        auto: false           # Disable auto-fix for this project
      agent-stuck:
        threshold: "20m"      # Longer stuck threshold
      changes-requested:
        escalateAfter: "1h"   # More time for reviews
```

Per-project overrides use **shallow merge**: `{ ...globalReaction, ...projectReaction }`. You only need to specify the fields you want to change.

---

## Next Steps

- **[Sessions](../sessions/)** — the 18-state session lifecycle and spawn pipeline
- **[Stories & Sprints](../stories-sprints/)** — story model, assignment flow, completion handling
- **[Autopilot](../autopilot/)** — autonomous and supervised agent modes
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
