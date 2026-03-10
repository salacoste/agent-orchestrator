# Integration Guide

How to connect Agent Orchestrator with GitHub, Linear, Slack, webhooks, and other services.

---

## Integration Architecture

Agent Orchestrator integrates with external services through three plugin slots:

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                        │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │ Tracker   │    │   SCM    │    │     Notifiers        │  │
│  │           │    │          │    │                      │  │
│  │ - GitHub  │    │ - GitHub │    │ - Desktop            │  │
│  │ - Linear  │    │   (PRs,  │    │ - Slack              │  │
│  │ - BMad    │    │    CI,   │    │ - Webhook            │  │
│  │ - Jira*   │    │    revs) │    │ - Composio           │  │
│  └────┬─────┘    └────┬─────┘    └────┬─────────────────┘  │
│       │               │               │                     │
└───────┼───────────────┼───────────────┼─────────────────────┘
        │               │               │
        ▼               ▼               ▼
   Issue Trackers    Source Code     Communication
   (where tasks      (where code    (where humans
    are defined)      lives)         get notified)
```

---

## GitHub Integration

GitHub is the default and most complete integration, serving as both **Tracker** (Issues) and **SCM** (PRs/CI/Reviews).

### Setup

```bash
gh auth login          # Authenticate GitHub CLI
gh auth status         # Verify authentication
```

### Configuration

```yaml
projects:
  my-app:
    repo: your-org/your-repo     # Required: owner/repo format
    path: ~/your-repo
    defaultBranch: main
    # tracker and scm default to github — no explicit config needed
```

### What It Does

#### As Tracker (GitHub Issues)

| Operation | How | CLI Tool |
|-----------|-----|----------|
| Fetch issue | `gh issue view #42 --json ...` | gh CLI |
| List issues | `gh issue list --json ...` | gh CLI |
| Create issue | `gh issue create --title ... --body ...` | gh CLI |
| Close on merge | `gh issue close #42` | gh CLI |
| Update labels | `gh issue edit #42 --add-label ...` | gh CLI |

**Branch naming**: `feat/issue-42` (auto-generated from issue number)

**Prompt generation**: The agent receives:
```
## Issue Title
URL: https://github.com/org/repo/issues/42
Labels: bug, priority-high

Issue description text here...
```

#### As SCM (Pull Requests, CI, Reviews)

| Operation | How | Used For |
|-----------|-----|----------|
| Detect PR | `gh pr list --head {branch}` | Link session to PR |
| PR state | `gh pr view --json state` | Track lifecycle |
| CI checks | `gh pr checks --json name,state` | Detect failures |
| Reviews | `gh pr view --json reviews` | Detect approvals |
| Merge PR | `gh pr merge --squash --delete-branch` | Auto-merge |
| Close PR | `gh pr close` | Cleanup |

**CI status mapping:**

| GitHub Status | Orchestrator Status |
|---------------|-------------------|
| PENDING, QUEUED | `pending` |
| IN_PROGRESS | `running` |
| SUCCESS | `passed` |
| FAILURE, TIMED_OUT, CANCELLED | `failed` |
| SKIPPED, NEUTRAL | `skipped` |

**Review decision mapping:**

| GitHub Review | Orchestrator Decision |
|---------------|---------------------|
| APPROVED | `approved` |
| CHANGES_REQUESTED | `changes_requested` |
| COMMENTED | `commented` |
| PENDING | `pending` |

### Reactions (Auto-Handling)

```yaml
reactions:
  # Auto-send CI failure logs to agent for self-fix
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
    escalateAfter: 2             # Notify human after 2 failures

  # Auto-send review comments to agent
  changes-requested:
    auto: true
    action: send-to-agent
    escalateAfter: 30m

  # Auto-merge when approved and CI passes
  approved-and-green:
    auto: true                   # Set false for manual merge
    action: auto-merge
    priority: action

  # Notify when agent is stuck
  agent-stuck:
    threshold: 10m
    action: notify
    priority: urgent
```

**Reaction flow:**

```
CI fails → Lifecycle detects status change
        → Checks reaction config: ci-failed.auto = true
        → SCM plugin fetches CI logs
        → Runtime sends logs to agent: "CI is failing. Fix: {error}"
        → Agent reads, fixes, pushes
        → Next poll: CI re-runs → passes or fails again
        → After 2 failures: escalates to human via Notifier
```

---

## Linear Integration

Linear is supported as a **Tracker** plugin, using its GraphQL API.

### Setup

**Option A: Direct API (recommended)**

1. Get API key: https://linear.app/settings/api
2. Set environment variable:
   ```bash
   export LINEAR_API_KEY="lin_api_your_key_here"
   ```

**Option B: Via Composio SDK**

1. Get Composio API key: https://app.composio.dev
2. Set environment variable:
   ```bash
   export COMPOSIO_API_KEY="your_composio_key"
   ```

The plugin auto-detects which transport to use based on available environment variables.

### Configuration

```yaml
projects:
  my-app:
    repo: your-org/your-repo
    path: ~/your-repo
    tracker:
      plugin: linear
      teamId: "YOUR_TEAM_ID"     # From Linear settings
```

### What It Does

| Operation | GraphQL Query | Description |
|-----------|---------------|-------------|
| Fetch issue | `issue(id: $id)` | Get ticket by identifier (e.g., "INT-42") |
| List issues | `issues(filter: {...})` | Filter by state, labels, assignee, team |
| Update issue | `issueUpdate(id: $id, input: {...})` | Change state, labels, assignee |
| Create issue | `issueCreate(input: {...})` | Create new ticket |
| Close on merge | State → "Done" | Auto-transition when PR merges |

**State mapping:**

| Linear State | Orchestrator State |
|-------------|-------------------|
| `started` | `in_progress` |
| `completed` | `closed` |
| `canceled` | `cancelled` |
| Other | `open` |

**Branch naming**: `feat/INT-42` (uses Linear identifier)

**Priority levels:**

| Linear Priority | Value | Label |
|----------------|-------|-------|
| 0 | None | — |
| 1 | Urgent | Urgent |
| 2 | High | High |
| 3 | Normal | Normal |
| 4 | Low | Low |

**Prompt generation**: The agent receives:
```
## Ticket Title
Ticket: INT-42
URL: https://linear.app/your-workspace/issue/INT-42
Labels: frontend, bug
Priority: High

Ticket description text here...
```

### Timeout & Error Handling

- All API calls have a 30-second timeout
- On failure: error is thrown, lifecycle manager handles retry/escalation
- Composio transport uses `LINEAR_RUN_QUERY_OR_MUTATION` tool (lazy-loaded)

---

## BMad Tracker (File-Based)

For projects using BMAD methodology — tasks stored as YAML/Markdown files.

### Configuration

```yaml
projects:
  my-app:
    repo: your-org/your-repo
    path: ~/your-repo
    tracker:
      plugin: bmad
      outputDir: _bmad-output
      storyDir: implementation-artifacts
      branchPrefix: feat
      includeArchContext: true
      includePrdContext: false
```

### What It Does

- Reads stories from `_bmad-output/implementation-artifacts/`
- Parses YAML frontmatter for status, priority, dependencies
- Generates prompts with architecture context and story requirements
- Tracks sprint progress, velocity, cycle time
- Provides notifications for blocked stories, aging items, sprint health

---

## Slack Integration

Slack is supported as a **Notifier** plugin using incoming webhooks.

### Setup

1. Create a Slack app: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Create a webhook for your channel
4. Set environment variable:
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../xxx"
   ```

### Configuration

```yaml
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}

notificationRouting:
  urgent: [desktop, slack]       # Agent stuck, errors, needs input
  action: [desktop, slack]       # PR ready for merge, review needed
  warning: [slack]               # Auto-fix failed, retries exhausted
  info: [slack]                  # Summaries, sprint complete
```

### Message Format

Slack notifications use **Block Kit** for rich formatting:

```
🚨 [my-app/fe-1] CI is failing on PR #42

CI checks failed after auto-fix attempt (retry 2/2).
Human review needed.

PR: https://github.com/org/repo/pull/42
Project: my-app | Priority: urgent | 2026-03-10T14:30:00Z
```

**Priority emoji mapping:**

| Priority | Emoji | When Used |
|----------|-------|-----------|
| `urgent` | :rotating_light: | Agent stuck, needs input, errored |
| `action` | :point_right: | PR ready to merge, review needed |
| `warning` | :warning: | Auto-fix failed, retries exhausted |
| `info` | :information_source: | Summary, sprint complete, all done |

**Included in messages:**

- Event type and session ID
- Human-readable message
- PR URL (if available)
- CI status (if relevant)
- Project name, priority, timestamp

---

## Webhook Integration (Generic)

For custom integrations — send events to any HTTP endpoint.

### Configuration

```yaml
notifiers:
  my-webhook:
    plugin: webhook
    url: https://your-service.com/api/ao-events
    headers:
      Authorization: "Bearer ${WEBHOOK_TOKEN}"
      X-Custom-Header: "agent-orchestrator"
```

### Payload Format

```json
{
  "type": "notification",
  "event": {
    "type": "ci.failing",
    "priority": "action",
    "sessionId": "fe-1",
    "projectId": "frontend",
    "message": "CI is failing on PR #42",
    "timestamp": "2026-03-10T14:30:00.000Z",
    "data": {
      "prUrl": "https://github.com/org/repo/pull/42",
      "ciStatus": "failure",
      "checkName": "test"
    }
  }
}
```

### Retry Logic

- **Retryable**: 429 (Too Many Requests) and 5xx errors
- **Non-retryable**: 4xx errors (except 429) — immediate failure
- **Backoff**: Exponential (`delay * 2^attempt`)
- **Returns**: `null` (webhooks don't return message IDs)

### Use Cases

- **PagerDuty**: Route urgent events to on-call
- **Discord**: Post to Discord webhook (use Discord notifier or generic webhook)
- **Custom dashboard**: Feed events to your own monitoring system
- **Zapier/n8n**: Trigger automation workflows
- **Datadog/Grafana**: Send events for monitoring and alerting

---

## Composio Integration

Multi-channel notifications through the Composio platform.

### Setup

1. Get API key: https://app.composio.dev
2. Set environment variable:
   ```bash
   export COMPOSIO_API_KEY="your_key"
   ```

### Configuration

```yaml
notifiers:
  composio:
    plugin: composio
```

### What It Does

- Routes notifications through Composio's multi-channel infrastructure
- Supports Slack, email, SMS, and other channels via Composio actions
- Uses `COMPOSIO_SEND_NOTIFICATION` action
- Graceful degradation if API key not set

---

## Desktop Notifications

Native OS notifications (macOS and Linux).

### Configuration

```yaml
defaults:
  notifiers: [desktop]           # Enabled by default
```

### How It Works

| OS | Method | Command |
|----|--------|---------|
| macOS | AppleScript | `osascript -e 'display notification ...'` |
| Linux | notify-send | `notify-send [--urgency=critical] ...` |

**Features:**

- Sound on urgent notifications (macOS: default sound; Linux: critical urgency)
- Coalescing: Multiple identical notifications merged with counter "(N)"
- Focus mode: Suppressed during DND (if configured)

---

## Notification Routing

Route events to different channels based on priority:

```yaml
notificationRouting:
  urgent: [desktop, slack, composio]  # All channels for critical events
  action: [desktop, slack]            # Action needed — desktop + team channel
  warning: [slack]                    # Awareness — team channel only
  info: [slack]                       # FYI — team channel only
```

### Event Types by Priority

| Priority | Events | Default Action |
|----------|--------|----------------|
| **urgent** | agent-stuck, agent-needs-input, agent-errored | Immediate human attention |
| **action** | approved-and-green, PR ready, review needed | Human action required |
| **warning** | auto-fix failed, retries exhausted, merge conflict | Awareness + potential action |
| **info** | session spawned, all complete, sprint summary | Informational |

---

## Integration Combinations

### Solo Developer

```yaml
defaults:
  notifiers: [desktop]
projects:
  my-app:
    repo: me/my-app
    path: ~/my-app
reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
  approved-and-green:
    auto: true
    action: auto-merge
```

**Flow**: GitHub Issues → Claude Code → auto-fix CI → auto-merge → desktop notification

### Small Team with Linear

```yaml
defaults:
  notifiers: [desktop, slack]
projects:
  frontend:
    repo: org/frontend
    path: ~/frontend
    tracker:
      plugin: linear
      teamId: "TEAM_123"
  backend:
    repo: org/backend
    path: ~/backend
    tracker:
      plugin: linear
      teamId: "TEAM_456"
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
notificationRouting:
  urgent: [desktop, slack]
  action: [slack]
  warning: [slack]
  info: [slack]
```

**Flow**: Linear tickets → Claude Code → GitHub PR → Slack notifications → team reviews

### Enterprise with Custom Webhook

```yaml
defaults:
  notifiers: [slack, webhook]
projects:
  platform:
    repo: corp/platform
    path: ~/platform
    tracker:
      plugin: linear
      teamId: "PLATFORM"
    reactions:
      approved-and-green:
        auto: false              # Manual merge for production
        action: notify
        priority: action
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
  pagerduty:
    plugin: webhook
    url: https://events.pagerduty.com/v2/enqueue
    headers:
      Content-Type: application/json
notificationRouting:
  urgent: [slack, pagerduty]
  action: [slack]
  warning: [slack]
  info: [slack]
```

**Flow**: Linear → Claude Code → GitHub PR → Slack for team + PagerDuty for critical

---

## Adding New Integrations

### New Tracker (e.g., Jira)

1. Create `packages/plugins/tracker-jira/`
2. Implement the `Tracker` interface (see [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md))
3. Key methods: `getIssue()`, `branchName()`, `generatePrompt()`
4. Configure:
   ```yaml
   tracker:
     plugin: jira
     baseUrl: https://your-org.atlassian.net
     email: you@company.com
   ```

### New Notifier (e.g., Discord, Telegram, Email)

1. Create `packages/plugins/notifier-{name}/`
2. Implement the `Notifier` interface — just one method: `notify(event)`
3. Configure:
   ```yaml
   notifiers:
     discord:
       plugin: discord
       webhook: ${DISCORD_WEBHOOK_URL}
   ```

### New SCM (e.g., GitLab, Bitbucket)

1. Create `packages/plugins/scm-{name}/`
2. Implement the `SCM` interface — PR detection, CI checks, reviews, merge
3. Most complex integration (15+ methods)
4. Configure:
   ```yaml
   scm:
     plugin: gitlab
   ```

---

## Environment Variables Reference

| Variable | Used By | Required |
|----------|---------|----------|
| `GITHUB_TOKEN` | GitHub tracker/SCM | No (use `gh auth` instead) |
| `LINEAR_API_KEY` | Linear tracker | Yes, for Linear |
| `COMPOSIO_API_KEY` | Composio notifier/transport | Yes, for Composio |
| `SLACK_WEBHOOK_URL` | Slack notifier | Yes, for Slack |
| `DISCORD_WEBHOOK_URL` | Discord notifier | Yes, for Discord |
| `WEBHOOK_TOKEN` | Generic webhook auth | Optional |

---

## Troubleshooting Integrations

| Problem | Solution |
|---------|----------|
| `gh: not authenticated` | Run `gh auth login` |
| Linear API timeout | Check `LINEAR_API_KEY`, verify network access |
| Slack message not arriving | Test webhook: `curl -X POST -d '{"text":"test"}' $SLACK_WEBHOOK_URL` |
| Webhook 401/403 | Check auth headers in config |
| Composio not sending | Verify `COMPOSIO_API_KEY` and connected channels |
| PR not detected | Check branch name matches `feat/issue-{N}` pattern |
| CI status "unknown" | Verify GitHub Actions or CI provider is configured on repo |
| Review not detected | Ensure reviewer has submitted review (not just commented) |
