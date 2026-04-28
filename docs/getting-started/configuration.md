---
title: Configuration
nav_order: 3
parent: Getting Started
description: Complete YAML configuration reference for Agent Orchestrator — every validated field with types, defaults, and examples.
---

# Configuration Reference

Agent Orchestrator is configured via `agent-orchestrator.yaml`. The file is discovered automatically — you rarely need to specify its location.

{: .highlight }
> **Minimal config:** You only need a project repo and path. Everything else has sensible defaults. See [Quick Start](../quick-start/) to get going first.

---

## Config File Discovery

Agent Orchestrator searches for `agent-orchestrator.yaml` in this order:

1. `AO_CONFIG_PATH` environment variable (if set)
2. Current working directory, walking up to root (like `.git`)
3. `~/.agent-orchestrator.yaml`
4. `~/.agent-orchestrator.yml`
5. `~/.config/agent-orchestrator/config.yaml`

---

## Minimal Config

```yaml
projects:
  my-app:
    repo: owner/my-app
    path: ~/my-app
```

That's it. The orchestrator infers SCM from the repo URL, defaults the tracker to GitHub Issues, and generates a session prefix from the directory name.

To generate a config automatically:

```bash
ao init --auto
```

---

## Top-Level Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `5000` | Dashboard HTTP port |
| `terminalPort` | number | — | Terminal server WebSocket port (convention: `5080`) |
| `directTerminalPort` | number | — | Direct terminal connection port (convention: `5081`) |
| `readyThresholdMs` | number | `300000` | Milliseconds before an agent session is considered "ready" |
| `autopilot` | enum | `off` | Autopilot mode: `off`, `supervised`, or `autonomous` |
| `maxConcurrentAgents` | number | — | Maximum agents running simultaneously |

{: .highlight }
> **Note:** `dataDir` and `worktreeDir` are used by the CLI and runtime but are not validated by the Zod schema. Set them in your config to override the defaults (`~/.agent-orchestrator` and `~/.worktrees`).

### Default Plugins

```yaml
defaults:
  runtime: tmux           # tmux | process | docker | kubernetes | ssh | e2b
  agent: claude-code      # claude-code | glm | codex | aider | goose | custom
  workspace: worktree     # worktree | clone | copy
  notifiers: [composio, desktop]    # desktop | slack | discord | telegram | webhook | composio
```

### Health Monitoring

```yaml
health:
  checkIntervalMs: 30000          # Health check frequency (default: 30s)
  alertOnTransition: true         # Publish event on status change (default: true)
  thresholds:
    maxLatencyMs: 1000            # Global latency threshold (default: 1000ms)
    maxQueueDepth: 100            # Global queue depth threshold (default: 100)
    agentInactiveThresholdMs: 0   # Agent inactivity alert threshold
    syncLatencyWarningMs: 0       # Sync latency warning threshold
  perComponent:                   # Override thresholds per component
    event-bus:
      maxLatencyMs: 500
      maxQueueDepth: 200
    bmad-tracker:
      maxLatencyMs: 2000
```

### Workflow Configuration

```yaml
workflow:
  phases:
    - analysis
    - planning
    - solutioning
    - implementation
  transitions:
    - from: analysis
      to: planning
      description: "Begin planning with PRD and UX design"
      guards:
        - id: has-brief
          description: "Product brief exists"
          artifactType: "Product Brief"
    - from: planning
      to: solutioning
      description: "Design architecture and break into epics"
      guards:
        - id: has-prd
          description: "PRD exists"
          artifactType: "PRD"
```

### Notification Routing

```yaml
notificationRouting:
  urgent: [desktop, composio]   # agent stuck, needs input, errored
  action: [desktop, composio]   # PR ready to merge
  warning: [composio]           # auto-fix failed
  info: [composio]              # summary, all done
```

### Notification Digest

```yaml
notificationDigest:
  enabled: false            # Enable daily digest (default: false)
  schedule: "09:00"         # HH:MM format, 24-hour (default: "09:00")
  timezone: "UTC"           # IANA timezone (default: "UTC")
```

### Users and Approvals

```yaml
users:
  - id: alice
    name: "Alice Smith"
    role: admin             # admin | lead | dev | viewer
    email: alice@example.com

approvalRequired:
  - spawn                   # Require approval to spawn agents
  - kill                    # Require approval to kill agents
  - autopilot-advance       # Require approval for autopilot actions
```

---

## Project Configuration

Each project under `projects:` configures a repository that agents can work on.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | GitHub `owner/repo` slug |
| `path` | string | Local path to the repository (supports `~`) |

### All Project Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | config key | Display name (auto-derived from config key if omitted) |
| `repo` | string | **required** | GitHub `owner/repo` slug |
| `path` | string | **required** | Local path (absolute or relative to `projectsDir`, supports `~`) |
| `defaultBranch` | string | `main` | Default git branch |
| `sessionPrefix` | string | auto | Unique prefix for tmux sessions (auto-derived from path basename) |
| `runtime` | string | global default | Override runtime plugin for this project |
| `agent` | string | global default | Override agent plugin for this project |
| `workspace` | string | global default | Override workspace plugin for this project |
| `tracker` | object | `{plugin: github}` | Issue tracker configuration |
| `scm` | object | `{plugin: github}` | Source control management (auto-inferred from repo) |
| `symlinks` | string[] | `[]` | Files to symlink into workspaces (e.g., `[".env", ".claude"]`) |
| `postCreate` | string[] | `[]` | Commands to run after workspace creation (e.g., `["pnpm install"]`) |
| `agentConfig` | object | `{}` | Agent-specific configuration |
| `agentRules` | string | — | Inline rules included in every agent prompt |
| `agentRulesFile` | string | — | Path to a rules file (relative to project path) |
| `orchestratorRules` | string | — | Rules for the orchestrator agent (reserved) |
| `isolation` | enum | `shared` | Agent isolation level: `shared`, `isolated`, or `quarantined` |
| `reactions` | object | global defaults | Per-project reaction overrides |
| `sharedPool` | object | — | Shared agent pool configuration |
| `conflictResolution` | object | — | Conflict resolution policies |
| `sessionEnhancement` | object | — | Session enhancement provider config |
| `verification` | object | — | Verification gate configuration |

### Auto-Derived Fields

Several fields are inferred automatically if you omit them:

- **`name`** — derived from the config key (e.g., `my-app` in `projects: my-app:`)
- **`sessionPrefix`** — derived from the path basename (e.g., `~/my-app` → `my-app`)
- **`scm`** — inferred as `{plugin: github}` if the repo contains a `/`
- **`tracker`** — defaults to `{plugin: github}`

### Tracker Configuration

**GitHub Issues (default):**

```yaml
tracker:
  plugin: github
```

**Linear:**

```yaml
tracker:
  plugin: linear
  teamId: "your-team-id"
```

**BMad file-based tracker:**

```yaml
tracker:
  plugin: bmad
  outputDir: _bmad-output
  storyDir: implementation-artifacts
  branchPrefix: feat
  includeArchContext: true
  includePrdContext: false
```

### Agent Configuration

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app

    # Agent-specific config
    agentConfig:
      permissions: skip      # skip | default
      model: opus            # Model override

    # Inline rules for every agent prompt
    agentRules: |
      Always run tests before pushing.
      Use conventional commits (feat:, fix:, chore:).

    # Or load rules from a file
    agentRulesFile: .agent-rules.md
```

---

## Reactions

Reactions are automatic responses to events during an agent session. The orchestrator watches for triggers and either handles them automatically or notifies you.

### How Reactions Work

1. **Trigger** — an event occurs (CI fails, review comment, merge conflict, etc.)
2. **Auto/Manual** — if `auto: true`, the orchestrator acts immediately; if `false`, it notifies you
3. **Action** — `send-to-agent` (forward to the agent), `notify` (alert the human), or `auto-merge`

### Default Reactions

| Reaction | Auto | Action | Description |
|----------|------|--------|-------------|
| `ci-failed` | true | send-to-agent | Agent retries CI fixes (up to 2 times, then escalates) |
| `changes-requested` | true | send-to-agent | Agent addresses review comments |
| `bugbot-comments` | true | send-to-agent | Agent fixes automated bot review comments |
| `merge-conflicts` | true | send-to-agent | Agent rebases and resolves conflicts |
| `approved-and-green` | false | notify | PR is approved and CI passes — notify human to merge |
| `agent-stuck` | true | notify | Agent inactive beyond threshold (default: 10 minutes) |
| `agent-needs-input` | true | notify | Agent requires human decision |
| `agent-exited` | true | notify | Agent process terminated unexpectedly |
| `all-complete` | true | notify | All tasks in the session finished |
| `tracker-story-done` | true | notify | Story marked complete after PR merge |
| `tracker-sprint-complete` | true | notify | All sprint stories finished |

### Overriding Reactions

```yaml
# Global reaction overrides
reactions:
  approved-and-green:
    auto: true              # Enable auto-merge globally
    action: auto-merge

# Per-project overrides
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app
    reactions:
      ci-failed:
        retries: 3          # More retries for this project
        escalateAfter: 3
```

### Reaction Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | Enable automatic handling (default: `true`) |
| `action` | enum | Response action: `send-to-agent`, `notify`, or `auto-merge` |
| `message` | string | Custom message sent with the action |
| `priority` | enum | Notification priority: `urgent`, `action`, `warning`, or `info` |
| `retries` | number | Maximum automatic retry attempts |
| `escalateAfter` | number or string | Escalate after N retries or time string (e.g., `"30m"`) |
| `threshold` | string | Time threshold for stuck detection (e.g., `"10m"`) |
| `includeSummary` | boolean | Include summary in notification |

---

## Notifiers

Configure notification channels under the top-level `notifiers` key:

```yaml
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"

  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}
    defaultChatId: ${TELEGRAM_CHAT_ID}
    allowedChatIds: [123456789]
    mode: polling                     # polling | webhook
    preferences:
      severityFilter: critical-and-warning
      quietHours:
        enabled: true
        start: "22:00"
        end: "07:00"
        timezone: "America/New_York"
```

---

## Advanced Configuration

### Session Enhancement

Configure how agent sessions are enhanced with providers, model routing, and hooks:

```yaml
sessionEnhancement:
  provider: raw                       # raw | omc (default: raw)
  modelTiers:
    low: haiku                        # Simple tasks
    medium: sonnet                    # Standard tasks
    high: opus                        # Complex tasks
  health:
    healthCheckIntervalMs: 30000      # Provider health check interval (default: 30s)
    failureThreshold: 3               # Failures before circuit opens (default: 3)
    openDurationMs: 60000             # Circuit breaker open duration (default: 60s)
  hookProfile:
    phases: [preCompact, postCompact] # Hook phases to enable
    enabledHooks: []                  # Specific hooks to enable
  agentMappings:
    claude-code:
      agents: [sonnet]
      executionMode: standard         # standard | persistent | lightweight
```

### Verification Gate

Configure pre-completion verification for agent sessions:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app
    verification:
      enabled: true
      checks:
        - type: test                  # test | lint | typecheck | custom
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: false
        - type: typecheck
          command: "pnpm typecheck"
          required: true
      onFailure: review               # review | block
      retry:
        enabled: true
        maxAttempts: 2                # 1-5 (default: 2)
        backoffMs: 5000               # Backoff between retries (default: 5s)
      persistent:
        persistentMaxRetries: 5       # 1-20 (default: 5)
        persistentMaxExtensions: 3    # 1-10 (default: 3)
```

### Shared Agent Pool

Share agents across multiple projects with allocation controls:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app
    sharedPool:
      enabled: true
      eligibleProjects: [my-app, api-service]
      maxConcurrent: 5
      reservedAgents: [agent-1, agent-2]
      priority: 1
      allocationWeights:
        urgency: 0.4                  # 0.0-1.0
        priority: 0.3                 # 0.0-1.0
        affinity: 0.2                 # 0.0-1.0
        workload: 0.1                 # 0.0-1.0
```

### Conflict Resolution

Configure how resource conflicts between projects are resolved:

```yaml
conflictResolution:
  default: priority-based             # priority-based | manual | isolation

# Per-project override
projects:
  my-app:
    repo: org/my-app
    path: ~/my-app
    conflictResolution:
      default: priority-based
      policies:
        repository:
          resolutionMode: priority-based
          priorityOrder: [my-app, api-service]
        file-path:
          resolutionMode: isolation
          isolationConfig:
            strategy: branch-isolation
```

---

## Validation Errors

The config is validated with Zod at load time. Common errors:

### Duplicate Project IDs

Two projects with the same directory basename:

```yaml
projects:
  app1:
    repo: org/app
    path: ~/projects/app    # basename: "app"
  app2:
    repo: org/app
    path: ~/other/app       # basename: "app" — DUPLICATE
```

**Fix:** Add explicit `sessionPrefix` to one project:

```yaml
projects:
  app1:
    repo: org/app
    path: ~/projects/app
    sessionPrefix: app-prod
  app2:
    repo: org/app
    path: ~/other/app
    sessionPrefix: app-staging
```

### Missing Required Fields

```yaml
projects:
  my-app:
    name: My App
    # ERROR: missing required fields "repo" and "path"
```

**Fix:** Add `repo` and `path`:

```yaml
projects:
  my-app:
    name: My App
    repo: org/my-app
    path: ~/my-app
```

### Invalid Enum Values

```text
Error: Invalid enum value "docker" for field "defaults.runtime"
Valid values: tmux, process
```

**Fix:** Use a valid value for the installed plugins.

### Reading Zod Errors

Zod validation errors include the path to the invalid field:

```text
→ projects > my-app > verification > checks > 0 > type
  Expected "test" | "lint" | "typecheck" | "custom", received "build"
```

---

## Complete Example

```yaml
# agent-orchestrator.yaml — Full annotated example

# ── Global Settings ──
port: 5000
dataDir: ~/.agent-orchestrator
worktreeDir: ~/.worktrees

# ── Default Plugins ──
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [composio, desktop]

# ── Autopilot ──
autopilot: off              # off | supervised | autonomous

# ── Projects ──
projects:
  my-app:
    name: My Application
    repo: my-org/my-app
    path: ~/my-app
    defaultBranch: main

    # Files to symlink into worktrees
    symlinks: [.env, .claude]

    # Commands after workspace creation
    postCreate:
      - "pnpm install"

    # Agent configuration
    agentConfig:
      permissions: skip
      model: opus

    # Inline agent rules
    agentRules: |
      Always run tests before pushing.
      Use conventional commits (feat:, fix:, chore:).

    # Tracker (defaults to GitHub)
    tracker:
      plugin: github

    # Verification gate
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: true
      onFailure: review

    # Per-project reaction overrides
    reactions:
      approved-and-green:
        auto: true
        action: auto-merge

  api-service:
    repo: my-org/api-service
    path: ~/api-service
    runtime: process
    tracker:
      plugin: linear
      teamId: "eng-team"

# ── Notification Channels ──
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"

# ── Notification Routing ──
notificationRouting:
  urgent: [desktop, slack]
  action: [desktop, slack]
  warning: [slack]
  info: [slack]

# ── Global Reactions ──
reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
    escalateAfter: 2

  changes-requested:
    auto: true
    action: send-to-agent
    escalateAfter: "30m"

# ── Notification Digest ──
notificationDigest:
  enabled: true
  schedule: "09:00"
  timezone: "America/New_York"
```

---

## Next Steps

- **[Architecture Overview](../architecture-overview/)** — how the 8 plugin slots work together
- **[Quick Start](../quick-start/)** — 5-minute hands-on tutorial
- **[Plugins](../../plugins/)** — available runtime, agent, and notifier plugins
- **[Sessions](../../core-concepts/sessions/)** — understand the session lifecycle
