---
title: Home
nav_order: 1
description: Open-source platform for orchestrating parallel AI coding agents — agent-agnostic, runtime-agnostic, tracker-agnostic.
---

# Agent Orchestrator

{: .fs-8 }

The Orchestration Layer for Parallel AI Agents
{: .fs-6 .fw-300 }

Spawn parallel AI coding agents, each in its own git worktree. Agents autonomously fix CI failures, address review comments, and open PRs — you supervise from one dashboard.

{: .fs-5 .fw-300 }

[Get started](getting-started/quick-start/){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 }
[View on GitHub](https://github.com/ComposioHQ/agent-orchestrator){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Quick Start

**From a repo URL (fastest):**

```bash
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator && bash scripts/setup.sh
ao start https://github.com/your-org/your-repo
```

Auto-detects language, package manager, SCM platform, and default branch. Generates config and starts the dashboard.

**From an existing local repo:**

```bash
cd ~/your-project && ao init --auto
ao start
```

Then spawn agents:

```bash
ao spawn my-project 123    # GitHub issue, Linear ticket, or ad-hoc task
```

Dashboard opens at `http://localhost:5000`. Run `ao status` for the CLI view.

For detailed instructions, see the [Installation Guide](getting-started/installation/) and [Quick Start Tutorial](getting-started/quick-start/).

---

## How It Works

```
ao spawn my-project 123
```

{: .text-left }

1. **Workspace** creates an isolated git worktree with a feature branch
2. **Runtime** starts a tmux session (or Docker container)
3. **Agent** launches Claude Code (or Codex, Aider, GLM, OpenCode) with issue context
4. Agent works autonomously — reads code, writes tests, creates PR
5. **Reactions** auto-handle CI failures and review comments
6. **Notifier** pings you only when human judgment is needed

Each agent gets its own branch, its own PR, and its own isolated workspace. Multiple agents work in parallel without conflicts.

---

## Plugin Architecture

Every core capability is a swappable plugin. Mix and match to fit your stack:

| Slot      | Purpose                          | Default Plugin |
| --------- | -------------------------------- | -------------- |
| Runtime   | Process execution environment    | tmux           |
| Agent     | AI coding agent interface        | claude-code    |
| Workspace | Isolated working copies          | worktree       |
| Tracker   | Issue and project tracking       | github         |
| SCM       | Source control management        | github         |
| Notifier  | Human notification channel       | desktop        |
| Terminal  | Terminal emulator integration    | iterm2         |
| EventBus  | Cross-process event distribution | (in-memory)    |

See [Plugins](plugins/) for all built-in plugins and how to write your own.

### Agent-Agnostic

Works with any AI coding agent. Currently supported:

- [Claude Code](plugins/agents/claude-code/) — Anthropic's CLI agent
- [Codex](plugins/agents/codex/) — OpenAI's coding agent
- [Aider](plugins/agents/aider/) — Open-source AI pair programmer
- [GLM](plugins/agents/glm/) — Zhipu AI's coding assistant
- [OpenCode](plugins/agents/opencode/) — Terminal-based AI assistant

Swap agents without changing your workflow. Configure in `agent-orchestrator.yaml`.

### Push, Not Pull

The core design philosophy. Spawn agents, walk away, get notified when your judgment is needed. The orchestrator auto-handles routine issues — CI failures, review comments — and only pushes notifications for decisions that require human input. No constant monitoring required.

### Real-Time Dashboard

Web dashboard with portfolio views, sprint boards, session details, scenario comparison, conflict resolution, and risk management — all updated in real-time via Server-Sent Events (SSE). Monitor your entire agent fleet from one page.

See [Web Dashboard](web-dashboard/) for the full feature tour.

---

## Explore

- [Getting Started](getting-started/) — Installation, quick start, configuration, architecture
- [CLI Reference](cli/) — 65+ commands across 13 categories
- [Plugin Directory](plugins/) — All built-in plugins
- [REST API](api/) — Dashboard API reference
- [Contributing](contributing/) — Development setup and plugin authoring
