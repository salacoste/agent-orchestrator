---
title: Quick Start
nav_order: 2
parent: Getting Started
description: Get from zero to a running AI agent in 5 minutes — init, spawn, and monitor your first autonomous coding session.
---

# Quick Start

Get from zero to a running AI agent in five minutes. No manual config needed.

{: .highlight }
> **Prerequisites:** [Install Agent Orchestrator](../installation/) first (Node.js 20+, Git 2.25+). You'll also need an AI agent installed — [Claude Code](https://docs.anthropic.com/en/docs/claude-code) is the default.

---

## Option A: From a Repo URL (Fastest)

The `ao start` command clones a repo, auto-generates config, and launches the dashboard:

```bash
ao start https://github.com/your-org/your-repo
```

What happens automatically:
1. **Clones** the repository (or reuses an existing clone)
2. **Detects** language, package manager, SCM platform, and default branch
3. **Generates** `agent-orchestrator.yaml` with smart defaults
4. **Starts** the dashboard and orchestrator

Expected output:

```
✓ Cloned to ~/your-repo
✓ Config generated: ./agent-orchestrator.yaml
✓ Dashboard: http://localhost:5000
```

{: .highlight }
> Dashboard opens in your browser automatically. If it doesn't, navigate to `http://localhost:5000`.

---

## Option B: From an Existing Local Repo

If you already have a project on your machine:

```bash
# Navigate to your project
cd ~/your-project

# Auto-detect everything and generate config
ao init --auto

# Start the dashboard
ao start
```

`ao init --auto` detects your git remote, default branch, language, and available tools (tmux, gh CLI). It writes `agent-orchestrator.yaml` — review it if you want, or just start.

---

## Spawn Your First Agent

With the dashboard running, spawn an agent to work on a task:

```bash
ao spawn my-project 123
```

Replace `my-project` with your project name from config and `123` with a GitHub issue number, Linear ticket ID, or any task identifier.

Expected output:

```
  Session:  abc123def
  Worktree: ~/.worktrees/your-project-abc123def
  Branch:   feature/issue-123
  Attach:   tmux attach -t ao-abc123def

SESSION=abc123def
```

The last line (`SESSION=...`) is for scripting — you can use it in shell scripts to reference the session.
1. Creates an isolated git worktree with a new branch
2. Starts a tmux session
3. Launches Claude Code (or your configured agent) with the issue context
4. Works autonomously — reads code, writes tests, creates a PR

---

## Check on Your Agents

From the CLI:

```bash
ao status
```

This shows a table of all active sessions:

```
Session       Branch              Agent  PR   CI    Review  Age
abc123def     feature/issue-123   ●      —    —     —       2m
```

From the browser: the dashboard at `http://localhost:5000` shows real-time updates including PR status, CI results, and agent activity.

## What Just Happened?

When you run `ao spawn`, six things happen in sequence:

1. **Workspace** creates an isolated git worktree with a feature branch
2. **Runtime** starts a tmux session (or Docker container)
3. **Agent** launches Claude Code with issue context
4. **Agent works** autonomously — reads code, writes tests, creates a PR
5. **Reactions** auto-handle CI failures and review comments
6. **Notifier** pings you only when human judgment is needed

Each agent gets its own branch, its own PR, and its own isolated workspace. Multiple agents work in parallel without conflicts.

For the full architecture, see [Architecture Overview](../architecture-overview/).

---

## Next Steps

- **[Configuration Reference](../configuration/)** — customize plugins, reactions, notifications
- **[Architecture Overview](../architecture-overview/)** — how the 8 plugin slots work together
- **[Sessions](../../core-concepts/sessions/)** — understand the session lifecycle
- **[CLI Reference](../../cli/)** — all 65+ commands across 13 categories
