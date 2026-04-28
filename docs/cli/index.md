---
title: CLI Reference
nav_order: 5
has_children: true
description: Command-line reference for the ao binary — 68 top-level commands across 8 categories for managing AI coding agents, sprints, stories, monitoring, reviews, intelligence, and infrastructure.
---

# CLI Reference

The **`ao`** command-line tool is the primary interface for Agent Orchestrator. It provides 68 top-level commands across 8 categories for managing parallel AI coding agents — from project setup and session management to sprint planning, monitoring, and intelligent analysis.

{: .highlight }
> **Quick start:** Install globally with `pnpm add -g @composio/ao-cli`, then run `ao init` to configure your project. See [Getting Started](../../getting-started/) for the full walkthrough.

---

## The `ao` Binary

| Field | Value |
|-------|-------|
| **Binary** | `ao` |
| **Package** | `@composio/ao-cli` |
| **Version** | `0.1.0` |
| **Framework** | Commander.js v13 |
| **Module** | ESM (`"type": "module"`) |
| **Node** | `>=20.0.0` |

```bash
# Show version
ao --version

# Show help with all commands
ao --help

# Help for a specific command
ao status --help
```

---

## Command Registration

Every command follows a consistent registration pattern. Each command file in `src/commands/` exports a `registerXxx(program: Command)` function. The entry point (`src/index.ts`) imports and calls each function:

```text
src/commands/<name>.ts
  +-- export function registerXxx(program: Command): void

src/index.ts
  +-- import { registerXxx } from "./commands/<name>.js"
  +-- registerXxx(program)
  +-- program.parse()
```

There are no global options on the `program` instance — only `.name("ao")`, `.description(...)`, and `.version("0.1.0")`. All flags are defined per-command.

---

## Command Categories

The 68 top-level commands are organized into 8 categories. Some commands (e.g., `plugin`, `events`) expose subcommands for additional operations.

| Category | Commands | Description |
|----------|----------|-------------|
| [Setup](./setup-commands/) | 6 | Project initialization, configuration, and plugin management (`plugins` to list, `plugin` to manage) |
| [Session](./session-commands/) | 12 | Agent session lifecycle — spawn, pause, resume, assign |
| [Sprint](./sprint-commands/) | 7 | Sprint planning, execution, velocity, and completion (flat top-level commands: `sprint-start`, not `sprint start`) |
| [Story](./story-commands/) | 6 | Story management — create, move, points, epics |
| [Monitoring](./monitoring/) | 8 | Real-time status, health, metrics, events (with subcommands), and burndown charts |
| [Review & PR](./review-pr/) | 8 | Code review, PR management, conflict resolution |
| [Intelligence](./intelligence/) | 14 | Analytics, forecasting, retrospectives, learning patterns |
| [Infrastructure](./infrastructure/) | 7 | Providers, events, error handling, triggers, workflows |

---

## Common Flags

Several flags appear across multiple commands. They are not global — each command defines its own flags — but the patterns are consistent:

| Flag | Purpose | Used by |
|------|---------|---------|
| `--json` | Machine-readable JSON output | status, health, events, metrics, fleet, and others |
| `--watch` | Continuous monitoring with alerts | health |
| `--interval <ms>` | Polling interval for watch mode | health (default: 30000ms) |
| `-p, --project <id>` | Scope to a specific project | Most project-scoped commands |
| `--force` | Skip safety prompts and checks | spawn, init, resolve-conflicts |
| `--open` | Open terminal tab after spawn | spawn, batch-spawn |
| `--auto` | Non-interactive with sensible defaults | init |

When `--json` is passed, commands output `JSON.stringify(data, null, 2)` instead of formatted terminal output. This is useful for scripting and piped output.

---

## Output Formats

The CLI uses several formatting utilities from `src/lib/format.ts` for terminal display:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `banner` | `(title: string) => string` | Double-line box heading (bold cyan title) for top-level sections |
| `header` | `(title: string) => string` | Single-line box heading (bold title) for sub-sections |
| `padCol` | `(str: string, width: number) => string` | ANSI-aware column padding (strips escape codes to measure visible width) |

**Status colors** follow a consistent palette:

| Color | Meaning |
|-------|---------|
| Green | `working`, `active`, `completed`, `done`, `approved`, `merged`, `passing` |
| Yellow | `idle`, `ready-for-dev`, `pending` (CI/review) |
| Blue | `in-progress`, `pr_open`, `review_pending` |
| Red | `blocked`, `ci_failed`, `errored`, `stuck`, `failing` |
| Cyan | `spawning` |
| Magenta | `review`, `changes_requested`, `needs_input` |
| Gray | `disconnected`, `killed`, `backlog`, `none` |

Long-running operations display an `ora` spinner with progress messages that resolve to success or failure indicators.

---

## Shell Completion

Shell completion is not yet available. The `ao` binary does not include a built-in completion command for bash, zsh, or fish. This may be added in a future release.

---

## Next Steps

- [Setup Commands](./setup-commands/) — Initialize projects, configure plugins
- [Session Commands](./session-commands/) — Manage agent sessions
- [Sprint Commands](./sprint-commands/) — Sprint planning and execution
- [Story Commands](./story-commands/) — Story and epic management
- [Monitoring Commands](./monitoring/) — Status, health, and metrics
- [Review & PR Commands](./review-pr/) — Code reviews and PR workflow
- [Intelligence Commands](./intelligence/) — Analytics and forecasting
- [Infrastructure Commands](./infrastructure/) — Providers, events, triggers
- [Getting Started](../../getting-started/) — Installation and first project
- [Configuration](../../getting-started/configuration/) — Full config reference
