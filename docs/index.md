---
title: Home
nav_order: 1
description: Open-source platform for orchestrating parallel AI coding agents — agent-agnostic, runtime-agnostic, tracker-agnostic.
---

# Agent Orchestrator

Open-source platform for orchestrating parallel AI coding agents. Agent-agnostic, runtime-agnostic, tracker-agnostic.

{: .fs-6 .fw-300 }

[Get started](getting-started/){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/ComposioHQ/agent-orchestrator){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Why Agent Orchestrator?

Managing multiple AI coding agents across projects is complex. Agent Orchestrator handles the orchestration so you can focus on what matters.

### Push, Not Pull

Spawn agents, walk away, get notified when your judgment is needed. The orchestrator auto-handles routine issues — CI failures, review comments — and only pushes notifications for decisions that require human input.

### Agent-Agnostic

Works with Claude Code, Codex, Aider, GLM, OpenCode, and more. Swap agents without changing your workflow.

### Plugin Architecture

Every core capability is a swappable plugin:

| Slot      | Purpose                          | Default     |
| --------- | -------------------------------- | ----------- |
| Runtime   | Process execution environment    | tmux        |
| Agent     | AI coding agent interface        | claude-code |
| Workspace | Isolated working copies          | worktree    |
| Tracker   | Issue/project tracking           | github      |
| SCM       | Source control management        | github      |
| Notifier  | Human notification channel       | desktop     |
| Terminal  | Terminal emulator integration    | iterm2      |

### Real-Time Dashboard

Web dashboard with portfolio views, sprint boards, session details, scenario comparison, conflict resolution, and risk management — all updated in real-time via Server-Sent Events.

---

## Quick Links

- [Installation](getting-started/installation/)
- [Quick Start Guide](getting-started/quick-start/)
- [Architecture Overview](getting-started/architecture-overview/)
- [CLI Reference](cli/)
- [Plugin Directory](plugins/)
- [REST API](api/)
- [Contributing](contributing/)
