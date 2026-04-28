---
title: GitHub CI/CD Flow
nav_order: 2
parent: Tutorials
description: Step-by-step tutorial for configuring auto-reactions for CI failures, review comments, and merge conflicts — automate the entire review-and-merge loop.
---

# GitHub CI/CD Flow

This tutorial shows you how to configure the orchestrator to automatically handle CI failures, address review comments, resolve merge conflicts, and notify you only when human judgment is needed. By the end, your agents will manage the full PR lifecycle autonomously.

{: .highlight }
> **Prerequisites:** Complete [Your First Agent](first-agent/) first, or have the orchestrator running with at least one project configured. You need `ao` CLI, a GitHub repository with CI enabled, and at least one notifier set up.

---

## Overview

The orchestrator's **reactions engine** watches every agent session and automatically responds to CI/CD events:

1. **Lifecycle Manager** polls GitHub every 30 seconds for PR state changes
2. **State transitions** emit events (e.g., `ci.failing`, `review.changes_requested`)
3. **Reactions** match events to configured actions (auto-fix, notify, or auto-merge)
4. **You get notified** only when escalation thresholds are exceeded

The result: agents fix CI failures, address review comments, and resolve merge conflicts without your intervention.

```
working → pr_open → review_pending → approved → mergeable → merged
              │              │
              │              └── changes_requested ──→ working (auto-address, 30 min timeout)
              │
              └── ci_failed ──→ working (auto-fix, up to 2 retries)
```

{: .note }
> The orchestrator checks PR state in strict priority order: merged → closed → CI failing → changes requested → approved + mergeable → approved → review pending → PR open. See [Sessions](../core-concepts/sessions/) for the full 18-state lifecycle.

---

## Step 1: Configure Default Reactions

The orchestrator ships with 11 built-in reactions. Add them to your `agent-orchestrator.yaml`:

```yaml
reactions:
  # Auto-fix reactions (agent handles automatically)
  ci-failed:
    auto: true
    action: send-to-agent
    message: "CI is failing on your PR. Run gh pr checks for details."
    retries: 2
    escalateAfter: 2

  changes-requested:
    auto: true
    action: send-to-agent
    message: "There are review comments on your PR. Address each one."
    escalateAfter: "30m"

  bugbot-comments:
    auto: true
    action: send-to-agent
    message: "Automated review found issues. Address the comments."
    escalateAfter: "30m"

  merge-conflicts:
    auto: true
    action: send-to-agent
    message: "Your branch has merge conflicts. Rebase and resolve."
    escalateAfter: "15m"

  # Notify reactions (you decide what to do)
  approved-and-green:
    auto: false
    action: notify
    priority: action

  agent-stuck:
    auto: true
    action: notify
    priority: urgent
    threshold: "10m"

  agent-needs-input:
    auto: true
    action: notify
    priority: urgent

  agent-exited:
    auto: true
    action: notify
    priority: urgent

  all-complete:
    auto: true
    action: notify
    priority: info
    includeSummary: true

  tracker-story-done:
    auto: true
    action: notify
    priority: info
    includeSummary: true

  tracker-sprint-complete:
    auto: true
    action: notify
    priority: action
```

### How Reactions Work

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | `true` = execute automatically, `false` = notify only |
| `action` | string | `send-to-agent` (agent fixes), `notify` (human decides), `auto-merge` |
| `message` | string | Text sent to the agent session |
| `retries` | number | Max auto-fix attempts before escalating |
| `escalateAfter` | number/string | Escalation threshold (attempts or duration like `"30m"`) |
| `threshold` | string | Duration before triggering (e.g., `"10m"` for stuck detection) |
| `priority` | string | Notification priority: `urgent`, `action`, `warning`, `info` |
| `includeSummary` | boolean | Include session summary in notification |

### 4 Auto-Fix Reactions

| Reaction | Trigger | What Happens | Escalation |
|----------|---------|--------------|------------|
| `ci-failed` | CI checks fail | Agent receives CI error details, pushes a fix | After 2 failed attempts |
| `changes-requested` | Reviewer requests changes | Agent receives review comments, addresses each one | After 30 minutes |
| `bugbot-comments` | Automated review bot comments | Agent receives bot feedback, fixes issues | After 30 minutes |
| `merge-conflicts` | Branch has merge conflicts | Agent rebases and resolves conflicts | After 15 minutes |

### 7 Notify Reactions

| Reaction | Trigger | Priority |
|----------|---------|----------|
| `approved-and-green` | PR approved + CI passing | `action` (default: `auto: false`) |
| `agent-stuck` | Agent inactive > threshold | `urgent` |
| `agent-needs-input` | Agent asks a question | `urgent` |
| `agent-exited` | Agent process terminated | `urgent` |
| `all-complete` | All sessions finished | `info` |
| `tracker-story-done` | Tracker issue closed after merge | `info` |
| `tracker-sprint-complete` | All tracker issues closed | `action` |

{: .highlight }
> The `approved-and-green` reaction defaults to `auto: false` — it notifies you to merge manually. See [Step 6](#step-6-merge-and-complete) to enable auto-merge.

---

## Step 2: Set Up Notifications

Notifications are routed by priority level to your configured notifiers.

### Configure Notification Routing

```yaml
notificationRouting:
  urgent: [desktop]          # Agent stuck, needs input, exited
  action: [desktop]          # PR ready to merge
  warning: [desktop]         # Auto-fix failed
  info: [desktop]            # Summary, all done
```

### Add a Slack Notifier

```yaml
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"
```

Set the environment variable:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### Add a Telegram Notifier

```yaml
notifiers:
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}
    defaultChatId: ${TELEGRAM_CHAT_ID}
    mode: polling
    preferences:
      severityFilter: critical-and-warning
      quietHours:
        enabled: true
        start: "22:00"
        end: "07:00"
        timezone: "America/New_York"
```

Set the environment variables:

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### Update Notification Routing

```yaml
notificationRouting:
  urgent: [desktop, slack]
  action: [desktop, slack]
  warning: [slack]
  info: [slack]
```

{: .note }
> See [Configuration](../getting-started/configuration/) for all notifier options. Environment variables use `${VAR_NAME}` syntax in the config file — the raw YAML never contains actual secrets.

---

## Step 3: Spawn and Watch CI

### Spawn an Agent

```bash
ao spawn my-project 123
```

Expected output:

```text
  Session:  abc123def
  Worktree: ~/.worktrees/my-project-abc123def
  Branch:   feature/issue-123
  Attach:   tmux attach -t ao-abc123def

SESSION=abc123def
```

The agent reads the code, makes changes, and opens a PR.

### Monitor CI Status

```bash
ao status
```

Expected output (representative — actual values vary):

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        active   —      —     —     —    —         2m
```

Watch for the PR to appear and CI to start running. The key columns:

| Column | CI/CD Meaning |
|--------|---------------|
| PR | Pull request number (appears after agent creates PR) |
| CI | CI status: `pass`, `fail`, `pending`, or `—` |
| Rev | Review decision: `appr`, `req_changes`, `pend`, or `—` |
| AgentSt | Agent status: active, idle, blocked, spawning |

### Stream Agent Logs

```bash
ao logs abc123def --follow
```

Representative output (format varies by agent and activity):

```text
[12:00:15] Agent reading repository structure...
[12:01:02] Agent modifying src/auth.ts
[12:01:30] Agent running tests...
[12:02:45] Agent creating pull request #42
[12:03:01] Agent pushed to feature/issue-123
```

### Watch for CI Events

```bash
ao events query --type ci.failing
```

Representative output (format varies):

```text
[12:05:30] ci.failing — Session abc123def: CI checks failing on PR #42
```

{: .note }
> The Lifecycle Manager polls GitHub every 30 seconds. CI state changes appear within 30 seconds of GitHub updating the check status.

---

## Step 4: CI Failure Auto-Fix

When CI fails on an agent's PR, the `ci-failed` reaction fires automatically:

```
CI fails → ci.failing event detected
  1. Reaction matches: ci-failed (auto: true)
  2. Session transitions: pr_open → ci_failed
  3. Message sent to agent: "CI is failing on your PR..."
  4. Agent reads CI logs, pushes a fix
  5. Session transitions: ci_failed → working → pr_open
  6. CI runs again on the new commit
     ├── Fix works → CI passes → done
     └── Fix fails → retry (up to 2 attempts)
  7. After 2 failed attempts → Escalate → notify human (urgent)
```

### What You See

While the auto-fix is running:

```bash
ao status
```

```text
Session       Branch              Story       AgentSt  PR     CI      Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        active   #42    fail    —     —    fixing    8m
```

After the fix succeeds:

```text
Session       Branch              Story       AgentSt  PR     CI      Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        idle     #42    pass    pend  —    waiting   12m
```

### If the Agent Can't Fix It

After 2 failed CI fix attempts, the orchestrator escalates:

```text
Session       Branch              Story       AgentSt  PR     CI      Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        idle     #42    fail    —     —    stuck     18m
```

You get an `urgent` notification. To manually help:

```bash
# Check what went wrong
ao logs abc123def --since 30m

# Send the agent specific instructions (use session ID or full agent name)
ao send abc123def "The test fails because the mock isn't configured. Fix the beforeEach setup."
```

{: .warning }
> If you set `retries: 0`, the reaction will escalate immediately without attempting an auto-fix. Use this for projects where CI errors require human review.

---

## Step 5: Review Auto-Address

When a reviewer requests changes on the PR, the `changes-requested` reaction fires:

```
Changes requested → review.changes_requested event
  1. Reaction matches: changes-requested (auto: true)
  2. Session transitions: review_pending → changes_requested
  3. Message sent to agent: "There are review comments on your PR..."
  4. Agent reads each comment, addresses feedback, pushes fixes
  5. Session transitions: changes_requested → working → pr_open
  6. Reviewer re-reviews
     ├── Reviewer approves → proceed to merge
     └── Reviewer requests more changes → repeat
  7. If unresolved after 30 minutes → Escalate → notify human
```

### What You See

```bash
ao status
```

```text
Session       Branch              Story       AgentSt  PR     CI    Rev          Thr  Activity  Age
abc123def     feature/issue-123   55-1        active   #42    pass  req_changes  —    fixing    22m
```

After the agent addresses feedback:

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        idle     #42    pass  appr  —    waiting   28m
```

### Merge Conflicts

If the branch falls behind main and gets conflicts, the `merge-conflicts` reaction fires:

```
Merge conflict detected → merge.conflicts event
  1. Reaction matches: merge-conflicts (auto: true)
  2. Agent rebases on main and resolves conflicts
  3. If unresolved after 15 minutes → Escalate → notify human
```

{: .note }
> The `bugbot-comments` reaction handles automated review tools (like GitHub's built-in code scanning). It works the same way as `changes-requested` but with a separate escalation timer.

---

## Step 6: Merge and Complete

### Default: Manual Merge

By default, `approved-and-green` is configured as `auto: false`:

```yaml
reactions:
  approved-and-green:
    auto: false
    action: notify
    priority: action
```

When the PR is approved and CI is green, you get a notification. Merge manually through GitHub or the CLI.

### Enable Auto-Merge

To fully automate merging:

```yaml
reactions:
  approved-and-green:
    auto: true
    action: auto-merge
```

{: .warning }
> Auto-merge requires the SCM plugin to support merge operations. The default GitHub SCM plugin can merge via `gh pr merge`. Ensure `GITHUB_TOKEN` has write access to the repository.

### Completion Events

After the PR is merged:

```text
Session transitions: mergeable → merged
Events emitted:
  1. merge.completed — PR merged successfully
  2. tracker.story_done — tracker issue closed (if tracker configured)
  3. summary.all_complete — all sessions finished (fires when every session reaches a terminal state)
```

### Final Status

```bash
ao status
```

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
abc123def     feature/issue-123   55-1        idle     #42    pass  appr  —    merged    35m
```

---

## Step 7: Per-Project Overrides

### Override Reactions Per Project

Reaction settings can be overridden per project using shallow merge — only the fields you specify change, everything else inherits from global defaults:

```yaml
projects:
  critical-service:
    repo: org/critical-service
    path: ~/critical-service
    reactions:
      ci-failed:
        auto: false           # Disable auto-fix — human reviews all CI failures
      agent-stuck:
        threshold: "20m"      # Longer stuck threshold
      changes-requested:
        escalateAfter: "1h"   # More time for complex reviews

  prototype-app:
    repo: org/prototype-app
    path: ~/prototype-app
    reactions:
      approved-and-green:
        auto: true            # Auto-merge for non-critical projects
        action: auto-merge
```

### Add Verification Gates

Verification gates run checks before the agent marks its work complete:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: true
        - type: typecheck
          command: "pnpm typecheck"
          required: true
      onFailure: review         # review | block
      retry:
        enabled: true
        maxAttempts: 2
        backoffMs: 5000
```

When `onFailure: review`, the agent sees verification results and can fix issues. When `onFailure: block`, the session pauses for human intervention.

### Per-Project Notification Routing

```yaml
projects:
  my-app:
    repo: org/my-app
    notifiers: [slack, desktop]

notificationRouting:
  urgent: [desktop, slack]
  action: [desktop, slack]
  warning: [slack]
  info: [slack]
```

---

## Step 8: Monitor with Events

### Query the Event Audit Trail

```bash
# Show last 20 events
ao events query
```

Representative output (format varies):

```text
[12:03:01] pr.created        — Session abc123def: PR #42 opened
[12:05:30] ci.failing        — Session abc123def: CI checks failing
[12:07:15] session.working   — Session abc123def: Agent fixing CI issue
[12:10:02] pr.created        — Session abc123def: New commit pushed
[12:12:30] review.pending    — Session abc123def: Awaiting reviewer
[12:15:00] review.changes_requested — Session abc123def: Changes requested
[12:15:01] session.working   — Session abc123def: Agent addressing review
[12:22:00] review.approved   — Session abc123def: PR approved
[12:22:01] merge.ready       — Session abc123def: Approved and CI green
[12:23:00] merge.completed   — Session abc123def: PR merged
```

### Filter by Event Type

```bash
# CI-related events only
ao events query --type ci.failing

# Review events
ao events query --type review.changes_requested

# Events from the last hour
ao events query --since 1h
```

### Check Event Queue Health

```bash
ao events status
```

This shows the event bus status, queue depth, and degraded mode state. If the event bus is degraded, events are queued in-memory and drained when the connection recovers:

```bash
ao events drain --force
```

### Watch the Fleet

```bash
# Fleet status with auto-refresh
ao fleet --watch
```

---

## Troubleshooting

### Agent stuck in ci_failed loop

The agent tried to fix CI 2+ times but keeps failing.

```bash
# Check what the agent tried
ao logs abc123def --since 30m

# Send specific instructions (use session ID or full agent name)
ao send abc123def "The test fails because the database migration is missing. Add the migration file."
```

If the fix is beyond the agent's capability, close the session and address it manually.

### Reaction not firing

The reaction config key must match the event type exactly.

```bash
# Check event audit trail for the event
ao events query --since 1h

# Verify your reaction key matches the event
# Event: ci.failing → Reaction key: ci-failed
# Event: review.changes_requested → Reaction key: changes-requested
```

Also check that `auto: true` is set and the reaction is under the `reactions:` key in your config.

### Notifications not delivered

The notifier webhook URL may be invalid or the environment variable may not be set.

```bash
# Verify the env var is set
echo $SLACK_WEBHOOK_URL

# Check event bus health
ao events status
```

Test by sending a manual notification via `ao send` to a session.

### Event bus degraded

The in-memory event bus is queuing events because it can't publish. Common in multi-instance setups without Redis.

```bash
# Check status
ao events status

# Force drain queued events
ao events drain --force
```

For multi-instance deployments, configure the Redis event bus plugin:

```yaml
defaults:
  eventBus: redis
```

### Merge conflicts unresolved

The agent attempted to rebase but couldn't resolve all conflicts within 15 minutes.

```bash
# Check what conflicts remain
ao logs abc123def --since 15m

# Resolve manually and push
cd ~/.worktrees/my-project-abc123def
git rebase main
# ... resolve conflicts ...
git add . && git rebase --continue
git push --force-with-lease
```

---

## Next Steps

- **[Reactions Engine](../core-concepts/reactions-engine/)** — all 11 reactions, trigger mapping, custom reactions
- **[Configuration](../getting-started/configuration/)** — full config reference including reactions and verification gates
- **[Sessions](../core-concepts/sessions/)** — 18-state lifecycle, 5-step status determination
- **[CLI Reference](../cli/)** — all monitoring and session commands
- **[Multi-Agent Sprint Tutorial](multi-agent-sprint/)** — run 5+ agents in parallel with CI/CD coordination
- **[Your First Agent](first-agent/)** — prerequisite tutorial for initial setup

---

- **Parent** — [Tutorials](.)
- **Siblings** — [Your First Agent](first-agent/), [Multi-Agent Sprint](multi-agent-sprint/), [Portfolio Management](portfolio-management/), [Custom Workflow](custom-workflow/)
- **Core Concepts** — [Reactions Engine](../core-concepts/reactions-engine/), [Sessions](../core-concepts/sessions/)
- **Getting Started** — [Configuration](../getting-started/configuration/), [Quick Start](../getting-started/quick-start/)
- **Reference** — [CLI Reference](../cli/), [Plugins](../plugins/)
