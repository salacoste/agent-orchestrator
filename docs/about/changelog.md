---
title: Changelog
nav_order: 12
description: Release history for Agent Orchestrator — versions, packages, and changes.
---

# Changelog

All notable changes to the Agent Orchestrator are documented here. The project uses [changesets](https://github.com/changesets/changesets) to manage versions across the pnpm workspace.

---

## v0.1.0 — Initial Release

First public release of the Agent Orchestrator monorepo.

### Core Packages

| Package | Version |
|---------|---------|
| `@composio/ao-core` | 0.1.0 |
| `@composio/ao-cli` | 0.1.0 |
| `@composio/agent-orchestrator` | 0.1.0 |

### Runtime Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-runtime-tmux` | 0.1.0 |
| `@composio/ao-plugin-runtime-process` | 0.1.0 |

### Agent Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-agent-claude-code` | 0.1.0 |
| `@composio/ao-plugin-agent-codex` | 0.1.0 |
| `@composio/ao-plugin-agent-aider` | 0.1.0 |
| `@composio/ao-plugin-agent-opencode` | 0.1.0 |

### Workspace Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-workspace-worktree` | 0.1.0 |
| `@composio/ao-plugin-workspace-clone` | 0.1.0 |

### Tracker Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-tracker-github` | 0.1.0 |
| `@composio/ao-plugin-tracker-linear` | 0.1.0 |

### SCM Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-scm-github` | 0.1.0 |

### Notifier Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-notifier-desktop` | 0.1.0 |
| `@composio/ao-plugin-notifier-slack` | 0.1.0 |
| `@composio/ao-plugin-notifier-webhook` | 0.1.0 |
| `@composio/ao-plugin-notifier-composio` | 0.1.0 |

### Terminal Plugins

| Package | Version |
|---------|---------|
| `@composio/ao-plugin-terminal-iterm2` | 0.1.0 |
| `@composio/ao-plugin-terminal-web` | 0.1.0 |

---

## Release Process

The project uses [changesets](https://github.com/changesets/changesets) for versioning:

```bash
# Create a changeset describing your change
pnpm changeset

# Version packages (updates package.json + CHANGELOG.md)
pnpm version-packages

# Build and publish to npm
pnpm release
```

{: .note }
> Changelog entries are generated from changeset files. Run `pnpm changeset` before merging to document your changes in the next release.
