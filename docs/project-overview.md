# Agent Orchestrator — Project Overview

## Purpose

Open-source system for orchestrating parallel AI coding agents. Agent-agnostic (Claude Code, Codex, Aider, OpenCode, GLM), runtime-agnostic (tmux, process), tracker-agnostic (GitHub, Linear, BMAD file-based). Manages session lifecycle, tracks PR/CI/review state, auto-handles routine issues (CI failures, review comments), pushes notifications to humans only when judgment is needed.

Core principle: **Push, not pull.** Spawn agents, walk away, get notified when your judgment is needed.

## Repository Structure

- **Type:** Monorepo (pnpm workspaces)
- **Primary Language:** TypeScript (ESM, strict mode)
- **Node Requirement:** ≥20.0.0
- **Package Manager:** pnpm 9.15.4
- **License:** MIT
- **Repository:** github.com/ComposioHQ/agent-orchestrator
- **Source Files:** 342 (.ts/.tsx), ~80,000 lines
- **Test Files:** 415, 3,288+ test cases

## Parts

| Part | Package | Type | Description |
|------|---------|------|-------------|
| Core | @composio/ao-core | Library | Types, config, session manager, event bus, state machine, health checks, error logging, learning store, assignment scoring, collaboration service, review findings, dependency resolver, circuit breaker, DLQ, burndown service |
| CLI | @composio/ao-cli | CLI Tool | The `ao` command — 67 commands for session management, sprint tracking, fleet monitoring, burndown charts, agent history, learning patterns, review stats, collaboration graph |
| Web | @composio/ao-web | Web App | Next.js 15 App Router dashboard — fleet monitoring, workflow dashboard, sprint burndown, agent session cards, terminal emulator, real-time SSE, learning insights panel |
| Plugin API | @composio/ao-plugin-api | Library | Public plugin type definitions — Plugin, PluginContext, Event, Story, Agent, Trigger interfaces. Zero runtime dependencies |
| Plugins | packages/plugins/* | Library | 20 swappable plugins across 8 slots |
| Integration Tests | @composio/ao-integration-tests | Tests | Real-binary integration tests requiring tmux, git, etc. |
| Global Wrapper | @composio/agent-orchestrator | CLI Wrapper | Global `ao` binary entry point delegating to @composio/ao-cli |

## Plugin Architecture (8 Slots)

| Slot | Plugins | Default | Purpose |
|------|---------|---------|---------|
| Runtime | tmux, process | tmux | Execution environment for agents (create/destroy sessions, send commands) |
| Agent | claude-code, codex, aider, opencode, glm | claude-code | AI coding tool adapters (spawn, send prompt, detect completion) |
| Workspace | worktree, clone | worktree | Code isolation strategy (git worktree or full clone) |
| Tracker | github, linear, bmad | github | Issue/story tracking integration (list, create, update, query stories) |
| SCM | github | github | Source control & PR lifecycle (create PR, check CI, merge) |
| Notifier | desktop, slack, webhook, composio | desktop | Push notification delivery (urgent, action, warning, info priorities) |
| Terminal | iterm2, web | iterm2 | Human interaction UI (open terminal to agent session) |
| Event Bus | redis | (in-memory) | Distributed event pub/sub for multi-process deployments |

All interfaces defined in `packages/core/src/types.ts`. Each plugin exports a `PluginModule` with `manifest` and `create()` function, validated at compile time via `satisfies PluginModule<T>`.

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | TypeScript (ESM) | 5.7+ | All packages, strict mode, verbatimModuleSyntax |
| Runtime | Node.js | 20+ | Server runtime |
| Package Manager | pnpm (workspaces) | 9.15.4 | Monorepo management |
| Web Framework | Next.js (App Router) | 15.1+ | Server/client components, API routes |
| CSS | Tailwind CSS | 4.0 | Utility-first styling |
| UI | React | 19.0 | Component-based UI |
| CLI Framework | Commander.js | 13.0 | Subcommand routing, options parsing |
| CLI UX | chalk + ora + cli-table3 + @inquirer/prompts | 5 / 8 / 0.6 / 5 | Colored output, spinners, tables, interactive prompts |
| Config | YAML + Zod | 2.7 / 3.24 | Config parsing + schema validation |
| File Watching | chokidar | 4.0 | Real-time YAML file change detection |
| File Locking | proper-lockfile | 4.1.2 | Concurrent metadata access safety |
| Terminal Emulation | xterm.js + node-pty | 5.3 / 1.1 | Web-based terminal in dashboard |
| Real-time | Server-Sent Events | Native | Dashboard live updates, auto-refresh |
| WebSocket | ws | 8.19 | Terminal I/O streaming |
| Date Handling | date-fns | 4.1 | Human-readable time formatting |
| Testing | Vitest | 2.1 (web) / 3.0 (cli, plugins) / 4.0 (core) | Unit, integration, performance tests |
| Component Testing | Testing Library | 16.1 | React component testing with jsdom |
| E2E Testing | Playwright | 1.49 | Browser automation, screenshots |
| Linting | ESLint (flat config) | — | TypeScript strict + security rules |
| Formatting | Prettier | — | Semicolons, double quotes, 2-space indent |
| CI/CD | GitHub Actions | — | 5 workflows: CI, integration, onboarding, release, security |

## Architecture Pattern

- **Plugin-based** with 8 swappable slots, compile-time type checking
- **Event-driven** with pub/sub, JSONL audit trail, circuit breakers, DLQ
- **Flat-file state** — Metadata as `key=value` files, YAML for sprint/story state
- **Write-through cache** with optimistic locking and conflict reconciliation
- **Three-tier error handling:** Retry → Circuit breaker → Dead letter queue
- **Graceful degradation** when services unavailable (LKG cache pattern in web)
- **AI Intelligence layer** — Session learning, smart assignment, failure pattern detection, agent collaboration protocols
- **Hash-based isolation** — Config path → SHA hash for multi-project data directories

## Development Maturity

The project has completed 3 full planning cycles:

| Cycle | Epics | Stories | Focus |
|-------|-------|---------|-------|
| Cycle 1 | 1–5 | 66 | Core orchestration, event bus, notifications, self-healing, CLI |
| Cycle 2 | 6–9 | 45 | Workflow dashboard, monitoring, conflict resolution, plugins |
| Cycle 3 | 10–15 | 25+ | Tech debt, session learning, smart assignment, code review, collaboration |

**Total:** 15 epics, 136+ stories completed, all retrospectives done.

## CI/CD Pipeline

5 GitHub Actions workflows:

| Workflow | Triggers | Jobs |
|----------|----------|------|
| `ci.yml` | Push to main, PRs | Lint, Typecheck (non-web → web), Test, Test-Web |
| `integration-tests.yml` | Manual dispatch | Real-binary integration tests with tmux |
| `onboarding-test.yml` | Manual dispatch | Setup validation for new contributors |
| `release.yml` | Manual/changeset | Build, version, publish to npm |
| `security.yml` | Push, PRs, scheduled | Gitleaks, dependency review, npm audit |

## Quick Start

```bash
# Clone and setup
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator && bash scripts/setup.sh

# One command to start
ao start https://github.com/your-org/your-repo

# Or from existing repo
cd ~/your-project && ao init --auto && ao start

# Spawn an agent
ao spawn my-project 123

# Check status
ao status
ao fleet
```

Dashboard opens at `http://localhost:5000`. CLI view via `ao status`.

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | All plugin interfaces (Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, EventBus) |
| `packages/core/src/config.ts` | Config loading, Zod validation, plugin resolution |
| `packages/core/src/session-manager.ts` | Session lifecycle (spawn, track, complete, kill) |
| `agent-orchestrator.yaml.example` | Configuration reference with all options |
| `CLAUDE.md` | Code conventions, architecture, development workflow |
