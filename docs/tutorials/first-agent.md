---
title: Your First Agent
nav_order: 1
parent: Tutorials
description: Step-by-step tutorial to get from zero to a completed AI agent session in under 5 minutes — install, configure, spawn, monitor, and watch it create a PR.
---

# Your First Agent

This tutorial walks you through your first autonomous agent session. You'll install the orchestrator, configure a project, spawn an agent, and watch it work — all in under 5 minutes.

{: .highlight }
> **Time:** ~5 minutes if prerequisites are installed. Each step shows the command and expected output.

---

## Prerequisites

Install these before starting:

| Tool | Version | Install | Verify |
|------|---------|---------|--------|
| **Node.js** | 20+ | `brew install node@20` (macOS) or `nvm install 20` (Linux) | `node --version` |
| **Git** | 2.25+ | `brew install git` (macOS) or `sudo apt install git` (Linux) | `git --version` |
| **tmux** | Any | `brew install tmux` (macOS) or `sudo apt install tmux` (Linux) | `tmux -V` |
| **Claude Code** | Latest | `npm install -g @anthropic-ai/claude-code` | `claude --version` |
| **GitHub CLI** | Latest | `brew install gh` (macOS) — [Linux instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) | `gh --version` |

{: .note }
> Claude Code is the default agent. You can use [other agents](../plugins/agents/) (Codex, Aider, GLM) by changing the config.

For detailed installation instructions, see [Installation](../getting-started/installation/).

---

## Step 1: Install the Orchestrator

Clone the repository and run the setup script:

```bash
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator
bash scripts/setup.sh
```

Expected output:

```text
✓ Node.js 20.x detected
✓ pnpm installed
✓ Dependencies installed
✓ Packages built
✓ CLI linked globally → ao
✓ Setup complete
```

Verify the CLI is available:

```bash
ao --version
```

```text
ao/0.1.0
```

---

## Step 2: Configure Your Project

### Option A: From a Repo URL (Fastest)

```bash
ao start https://github.com/your-org/your-repo
```

This single command clones the repo, detects your language and tools, generates config, and starts the dashboard:

```text
✓ Cloned to ~/your-repo
✓ Config generated: ./agent-orchestrator.yaml
✓ Dashboard: http://localhost:5000
```

{: .highlight }
> The dashboard opens in your browser automatically. If it doesn't, navigate to `http://localhost:5000`.

### Option B: From an Existing Project

If you already have a project on your machine:

```bash
cd ~/my-project

# Auto-generate config (detects git remote, branch, tools)
ao init --auto

# Start the dashboard
ao start
```

Expected output from `ao init --auto` (representative — actual detection messages may vary):

```text
✓ Detected: GitHub remote → org/my-project
✓ Detected: default branch → main
✓ Detected: language → TypeScript
✓ Detected: tmux available
✓ Detected: gh CLI available
✓ Config written to ./agent-orchestrator.yaml
```

### Review the Config

The generated `agent-orchestrator.yaml` looks like this:

```yaml
dataDir: ~/.agent-orchestrator
worktreeDir: ~/.worktrees
port: 5000

defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [desktop]

projects:
  my-project:
    name: My Project
    repo: org/my-project
    path: ~/my-project
    defaultBranch: main
```

{: .note }
> The defaults work for most projects. See [Configuration](../getting-started/configuration/) for all options.

---

## Step 3: Spawn Your First Agent

With the dashboard running, spawn an agent to work on an issue:

```bash
ao spawn my-project 123
```

Replace `my-project` with your project name from config and `123` with a GitHub issue number.

Expected output:

```text
  Session:  abc123def
  Worktree: ~/.worktrees/my-project-abc123def
  Branch:   feature/issue-123
  Attach:   tmux attach -t ao-abc123def

SESSION=abc123def
```

{: .highlight }
> Copy the `Attach` command — use it to watch the agent work in real time.

### What Just Happened

When you run `ao spawn`, the orchestrator does six things:

1. **Workspace** — creates an isolated git worktree with a feature branch
2. **Runtime** — starts a tmux session for the agent
3. **Agent** — launches Claude Code with the issue context as a system prompt
4. **Agent works** — reads code, writes tests, makes changes, creates a PR
5. **Reactions** — auto-handles CI failures and review comments
6. **Notifier** — pings you only when human judgment is needed

Each agent gets its own branch, its own PR, and its own isolated workspace. Multiple agents can work in parallel without conflicts.

---

## Step 4: Monitor Your Agent

### From the CLI

Check all active sessions:

```bash
ao status
```

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
abc123def     feature/issue-123   62-54       active   —      —     —     —    —         2m
```

| Column | Meaning |
|--------|---------|
| Session | Session ID (first 8 chars) |
| Branch | Git branch name |
| Story | Story or issue identifier |
| AgentSt | Agent status: active (green), idle (yellow), blocked (red), spawning (blue), completed (dim) |
| PR | Pull request number (once created) |
| CI | CI status: passing, failing, pending |
| Rev | Review status: approved, changes requested, pending |
| Thr | Thread count |
| Activity | Last activity description |
| Age | Time since spawn |

### Tail Agent Logs

```bash
ao logs abc123def
```

Representative output (format varies by agent and activity):

```text
[12:00:01] Session spawned for issue #123
[12:00:03] Agent started in tmux session ao-abc123def
[12:00:15] Agent reading repository structure...
[12:01:02] Agent modifying src/auth.ts
[12:01:30] Agent running tests...
```

### From the Dashboard

Open `http://localhost:5000` in your browser. The dashboard shows:

- **Real-time session status** — activity, PR state, CI results
- **Terminal viewer** — watch the agent's terminal live (via WebSocket)
- **Event timeline** — every action the agent takes

---

## Step 5: Watch It Complete

After spawning, the agent works autonomously through this lifecycle:

```text
spawning → working → pr_open → review_pending → approved → mergeable → merged
                        │                          │
                        ├── ci_failed ──→ working   │
                        │   (auto-fix)              │
                        │                           │
                        └── needs_input ────────────┘
                            (notify you)
```

### What Happens Automatically

| Event | Reaction | You Need to Act? |
|-------|----------|------------------|
| CI fails | Agent receives failure logs, pushes a fix | No |
| Reviewer requests changes | Agent receives comments, addresses each one | No |
| Agent is stuck (>10 min) | Notifier sends you a desktop alert | Yes — check `ao status` |
| Agent needs a decision | Notifier sends you a desktop alert | Yes — use `ao send` to respond |
| PR approved + CI green | Notifier sends "ready to merge" | Optional — merge manually or enable auto-merge |

{: .note }
> The orchestrator uses **reactions** to auto-handle routine events. You only get notified when human judgment is needed. See [Reactions Engine](../core-concepts/reactions-engine/) for how to customize this behavior.

### Check the Final Result

```bash
ao status
```

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
abc123def     feature/issue-123   62-54       idle     #42    pass  appr  —    merged    18m
```

When CI shows `pass` and Rev shows `appr`, the PR is ready to merge. The agent has:

- Created an isolated branch with its changes
- Written and passed tests
- Opened a pull request with a description
- Responded to any CI or review feedback

Merge the PR through GitHub, or enable the `approved-and-green` reaction for auto-merge.

---

## Troubleshooting

### `tmux: command not found`

tmux is not installed. The default runtime requires it.

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux

# Fedora
sudo dnf install tmux
```

### `EADDRINUSE: address already in use :::5000`

Another process is using port 5000.

```bash
# Find and kill the process
lsof -ti:5000 | xargs kill -9

# Or use a different port
PORT=5001 ao start
```

### Agent binary not found

The agent CLI (e.g., Claude Code) is not installed globally.

```bash
# Install Claude Code (default agent)
npm install -g @anthropic-ai/claude-code

# Or install a different agent
npm install -g @openai/codex       # Codex
pip install aider-chat              # Aider
```

### Session stuck at `spawning`

The agent process failed to start. Check the logs:

```bash
ao logs <session-id>
```

Common causes: missing API key (`ANTHROPIC_API_KEY`), agent binary not in `$PATH`, or tmux server not running.

### `No agent-orchestrator.yaml found`

The config file was not created. Run initialization first:

```bash
ao init --auto
```

### PR was not created

The agent may still be working, or it encountered a blocker:

```bash
ao status    # Check the session state
ao logs <session-id>  # See what the agent is doing
```

If the state shows `needs_input` or `stuck`, the agent is waiting for you.

---

## Next Steps

- **[Configuration](../getting-started/configuration/)** — customize plugins, reactions, notifications
- **[CLI Reference](../cli/)** — all commands across 13 categories
- **[Sessions](../core-concepts/sessions/)** — understand the full 18-state lifecycle
- **[Architecture Overview](../getting-started/architecture-overview/)** — how the 8 plugin slots work together
- **[GitHub CI/CD Flow Tutorial](github-ci-cd-flow/)** — set up auto-reactions for CI failures and reviews
- **[Multi-Agent Sprint Tutorial](multi-agent-sprint/)** — run 5+ agents in parallel

---

- **Parent** — [Tutorials](.)
- **Siblings** — [GitHub CI/CD Flow](github-ci-cd-flow/), [Multi-Agent Sprint](multi-agent-sprint/), [Portfolio Management](portfolio-management/), [Custom Workflow](custom-workflow/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/), [Configuration](../getting-started/configuration/)
- **Core Concepts** — [Sessions](../core-concepts/sessions/), [Reactions Engine](../core-concepts/reactions-engine/)
