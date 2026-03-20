# Setting Up Agent Orchestrator for Real Projects

A practical guide to configuring Agent Orchestrator for your repositories, teams, and workflows.

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 20+ | `node --version` |
| Git | 2.25+ | `git --version` |
| tmux | any | `tmux -V` |
| GitHub CLI | 2.0+ | `gh --version` |
| pnpm | 9.15+ | `pnpm --version` |

**Install missing prerequisites:**

```bash
# macOS
brew install tmux gh pnpm node

# Linux (Ubuntu/Debian)
sudo apt install tmux
# gh: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
# pnpm: corepack enable && corepack prepare pnpm@latest --activate
```

**Authenticate GitHub CLI:**

```bash
gh auth login
# Select: GitHub.com → HTTPS → Authenticate with browser
gh auth status  # Verify
```

---

## Installation

```bash
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator
pnpm install
pnpm build
npm link -g packages/cli
ao --version  # Verify CLI is available
```

---

## Quick Start (Fastest Path)

### Option A: One-Command Setup

```bash
ao start https://github.com/your-org/your-repo
```

Auto-detects language, package manager, SCM platform, and default branch. Generates config and starts the orchestrator immediately.

### Option B: Interactive Setup

```bash
cd ~/your-project
ao init          # Interactive prompts
ao start         # Start orchestrator
```

### Option C: Auto-Detection

```bash
cd ~/your-project
ao init --auto   # Detects everything automatically
ao start
```

The `ao init --auto` command:

1. Detects language/frameworks (TypeScript, React, Python, Go, etc.)
2. Generates contextual agent rules based on project type
3. Derives session prefix from directory name
4. Detects git remote and default branch
5. Checks for tmux, `gh` CLI, API keys

---

## Configuration Deep Dive

Configuration lives in `agent-orchestrator.yaml`. The orchestrator searches for it:

1. `AO_CONFIG_PATH` environment variable (if set)
2. Current directory, then parent directories (like `.git`)
3. `~/.agent-orchestrator.yaml` or `~/.config/agent-orchestrator/config.yaml`

### Minimal Config (Single Project)

```yaml
projects:
  my-app:
    repo: your-org/your-repo
    path: ~/your-project
    defaultBranch: main
```

That's it. Everything else uses sensible defaults:

- **Runtime**: tmux
- **Agent**: claude-code
- **Workspace**: worktree (git worktrees)
- **Tracker**: GitHub Issues
- **Notifier**: desktop notifications

### Full Production Config

```yaml
# Server settings
port: 5000
terminalPort: 5080
directTerminalPort: 5081
readyThresholdMs: 300000       # 5 min before "ready" becomes "idle"

# Default plugins (apply to all projects)
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [desktop, slack]

# Projects
projects:
  frontend:
    name: Frontend App
    repo: your-org/frontend
    path: ~/frontend
    defaultBranch: main
    sessionPrefix: fe          # Short prefix for session names (fe-1, fe-2)

    # Override defaults per project
    agent: claude-code
    workspace: worktree

    # Tracker (defaults to GitHub Issues if omitted)
    tracker:
      plugin: github

    # Files symlinked into each workspace
    symlinks:
      - .env
      - .env.test
      - .claude

    # Commands run after workspace creation
    postCreate:
      - pnpm install
      - pnpm build

    # Agent behavior
    agentConfig:
      permissions: skip        # --dangerously-skip-permissions
      model: opus              # Claude model

    # Custom rules injected into agent prompt
    agentRules: |
      Always run tests before pushing.
      Use conventional commits (feat:, fix:, chore:).
      Never commit .env files.

    # Or load rules from a file
    agentRulesFile: .agent-rules.md

    # Per-project reaction overrides
    reactions:
      ci-failed:
        auto: true
        action: send-to-agent
        retries: 3
      approved-and-green:
        auto: true
        action: auto-merge

  backend:
    name: Backend API
    repo: your-org/backend
    path: ~/backend
    defaultBranch: main
    sessionPrefix: api

    tracker:
      plugin: linear
      teamId: "YOUR_TEAM_ID"

    agentRules: |
      All endpoints require auth middleware.
      Write integration tests for new endpoints.
      Follow REST naming conventions.

# Notifier configuration
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}    # Env var expansion supported

# Route notifications by priority
notificationRouting:
  urgent: [desktop, slack]     # Agent stuck, errors
  action: [desktop, slack]     # PR ready for review
  warning: [slack]             # Auto-fix failed
  info: [slack]                # Summaries, completions

# Global reaction defaults
reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
    escalateAfter: 2           # Notify human after 2 failures

  changes-requested:
    auto: true
    action: send-to-agent
    escalateAfter: 30m         # Duration strings: 10m, 1h, 30m

  approved-and-green:
    auto: false                # Set true for auto-merge
    action: notify
    priority: action

  agent-stuck:
    threshold: 10m             # Notify if idle > 10 minutes
    action: notify
    priority: urgent
```

---

## Configuration Options Reference

### Project Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repo` | `string` | required | GitHub `owner/repo` format |
| `path` | `string` | required | Local repo path (`~` expanded) |
| `defaultBranch` | `string` | `main` | Base branch for new worktrees |
| `sessionPrefix` | `string` | auto | 3-4 char prefix for session names |
| `name` | `string` | project key | Display name |
| `runtime` | `string` | `tmux` | Runtime plugin name |
| `agent` | `string` | `claude-code` | Agent plugin name |
| `workspace` | `string` | `worktree` | Workspace plugin name |
| `tracker.plugin` | `string` | `github` | Tracker plugin name |
| `scm.plugin` | `string` | `github` | SCM plugin name |
| `symlinks` | `string[]` | `[]` | Files to symlink into workspaces |
| `postCreate` | `string[]` | `[]` | Commands after workspace creation |
| `agentConfig.permissions` | `string` | — | `skip` for auto-approve |
| `agentConfig.model` | `string` | — | AI model override |
| `agentRules` | `string` | — | Inline agent instructions |
| `agentRulesFile` | `string` | — | External rules file path |

### Plugin Alternatives

| Slot | Available Plugins |
|------|-------------------|
| Runtime | `tmux`, `process` |
| Agent | `claude-code`, `codex`, `aider`, `opencode`, `glm` |
| Workspace | `worktree`, `clone` |
| Tracker | `github`, `linear`, `bmad` |
| SCM | `github` |
| Notifier | `desktop`, `slack`, `webhook`, `composio` |
| Terminal | `iterm2`, `web` |

### Reaction Events

| Event | Trigger | Recommended Action |
|-------|---------|-------------------|
| `ci-failed` | CI checks fail | `send-to-agent` with retries |
| `changes-requested` | Reviewer requests changes | `send-to-agent` |
| `approved-and-green` | PR approved + CI passing | `auto-merge` or `notify` |
| `agent-stuck` | Agent idle > threshold | `notify` (urgent) |
| `agent-needs-input` | Agent waiting for input | `notify` (urgent) |
| `agent-exited` | Agent process died | `notify` |
| `merge-conflicts` | Merge conflict detected | `send-to-agent` |
| `all-complete` | All sessions done | `notify` (info) |

---

## Symlinks and Post-Create Hooks

### How Symlinks Work

When a workspace is created, the orchestrator symlinks specified files from your main repo into the isolated workspace:

```yaml
symlinks:
  - .env              # Environment variables
  - .env.test         # Test environment
  - .claude           # Claude Code settings
  - node_modules      # Avoid re-installing (optional, saves disk)
```

**Safety rules:**

- Absolute paths and `..` are rejected (prevents directory traversal)
- Only relative paths within the project root are allowed
- Parent directories are created automatically if needed

### Post-Create Commands

Run setup commands after workspace creation:

```yaml
postCreate:
  - pnpm install
  - pnpm run build:schema
  - cp .env.example .env.local
```

Commands run sequentially with `sh -c` in the workspace directory. If any command fails, the workspace is destroyed (automatic rollback).

---

## Data Directory Structure

The orchestrator stores session data in a hash-based directory structure:

```
~/.agent-orchestrator/
  {hash}-{projectId}/           # Hash of config path for uniqueness
    sessions/
      fe-1                      # Flat key=value session metadata
      fe-2
      api-1
      archive/                  # Archived (killed/merged) sessions
    events.jsonl                # Append-only event log
    dlq.jsonl                   # Dead letter queue (failed operations)

~/.worktrees/                   # Default worktree base directory
  frontend/
    fe-1/                       # Isolated git worktree
    fe-2/
  backend/
    api-1/
```

Session metadata files use flat key=value format:

```
project=frontend
worktree=/Users/you/.worktrees/frontend/fe-1
branch=feat/issue-42
status=working
issue=42
pr=https://github.com/your-org/frontend/pull/99
agent=claude-code
createdAt=2026-03-10T14:30:00Z
```

---

## Common Workflows

### Spawn Agent on a GitHub Issue

```bash
ao spawn frontend 42
# Creates worktree, launches Claude Code on issue #42
# Agent reads issue, writes code, creates PR autonomously
```

### Spawn Multiple Agents

```bash
ao spawn frontend 42 &
ao spawn frontend 43 &
ao spawn backend 15 &
# Three agents working in parallel, each in isolated worktrees
```

### Batch Spawn for Sprint

```bash
ao batch-spawn frontend --ready
# Discovers all "ready for dev" stories and spawns agents
```

### Monitor Progress

```bash
ao status              # Overview of all sessions
ao fleet               # Monitoring table
ao dashboard           # Open web UI in browser
```

### Interact with Running Agent

```bash
ao send fe-1 "Please also add unit tests for the new component"
ao open fe-1           # Attach to tmux session (iTerm2 tab)
```

### Kill and Cleanup

```bash
ao session kill fe-1   # Kill specific session
ao stop                # Stop all sessions
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AO_CONFIG_PATH` | Override config file path |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications |
| `LINEAR_API_KEY` | Linear API key (for Linear tracker) |
| `COMPOSIO_API_KEY` | Composio API key (for Composio notifier/transport) |
| `GITHUB_TOKEN` | GitHub token (usually handled by `gh auth`) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `No agent-orchestrator.yaml found` | Run `ao init` or set `AO_CONFIG_PATH` |
| `tmux: command not found` | `brew install tmux` |
| `gh: not authenticated` | `gh auth login` |
| Port already in use | Change `port:` in config or `lsof -ti:5000 \| xargs kill` |
| Workspace creation failed | Check disk space and `~/.worktrees` permissions |
| Agent stuck | `ao send <session> "status"` or `ao session kill <session>` |
| YAML parse error | Validate with `yamllint` — use 2-space indentation |
| Session not found | `ao session ls` to list active sessions |
| Worktree conflicts | `git worktree list` to check existing worktrees |

---

## Next Steps

- [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md) — write custom plugins
- [Scaling Strategies](./SCALING-STRATEGIES.md) — handle many concurrent agents
- [Integration Guide](./INTEGRATION-GUIDE.md) — connect Linear, Slack, webhooks
