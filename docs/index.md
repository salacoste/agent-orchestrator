# Agent Orchestrator — Documentation Index

Master index for all project documentation. Updated 2026-03-20 (full rescan, exhaustive).

## Project Overview

- **Type:** Monorepo (pnpm workspaces) with 6 packages + 20 plugins
- **Primary Language:** TypeScript (ESM, strict mode)
- **Architecture:** Plugin-based with 8 swappable slots + AI intelligence layer
- **Tech Stack:** Node 20+ / Next.js 15 / React 19 / Commander.js 13 / Tailwind 4.0
- **Source:** 342 files, ~80,000 LOC | **Tests:** 415 files, 3,288+ cases

## Core Documentation

| Document | Description |
|----------|-------------|
| [project-overview.md](./project-overview.md) | Executive summary: purpose, 7 parts, 20 plugins, tech stack, architecture, test coverage, development maturity (3 cycles, 15 epics, 136+ stories) |
| [architecture.md](./architecture.md) | System architecture: 7 layers, 8 plugin slots, 18-state session lifecycle, event system, error handling stack, security model |
| [integration-architecture.md](./integration-architecture.md) | Inter-package communication: plugin loading, event flow, SSE real-time, config propagation, error boundaries, AI intelligence integration (learning, assignment, review, collaboration) |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated directory tree of all source files with descriptions |
| [api-contracts.md](./api-contracts.md) | 55 Web API routes: sessions, agents, events, audit, DLQ, conflicts, 31 sprint analytics routes, workflow, learning, health |
| [component-inventory.md](./component-inventory.md) | 54 React components, 4 hooks, 11 lib utilities, 7 workflow engine modules: pages, sessions, fleet, sprint charts, workflow dashboard, terminal, AI insights |

## Development

| Document | Description |
|----------|-------------|
| [development-guide.md](./development-guide.md) | Setup, build, test, code standards, TypeScript conventions, plugin pattern, shell security, naming conventions, CI/CD |
| [TESTING-CONVENTIONS.md](./TESTING-CONVENTIONS.md) | Vitest patterns: mock factories, singleton reset, fake timers, assertion standards |
| [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md) | Plugin authoring: all 8 slot interfaces, PluginModule pattern, examples |

## Operations

| Document | Description |
|----------|-------------|
| [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) | External integrations: GitHub, Linear, Slack, webhooks |
| [SCALING-STRATEGIES.md](./SCALING-STRATEGIES.md) | Scaling to many concurrent agents |
| [SECURITY-AUDIT-SUMMARY.md](./SECURITY-AUDIT-SUMMARY.md) | Security practices, audit results, shell command safety |
| [file-locking.md](./file-locking.md) | Advisory file locking mechanism for concurrent access |

## Product Documentation

| Document | Description |
|----------|-------------|
| [product_docs/bmad-cli-commands.md](./product_docs/bmad-cli-commands.md) | BMAD CLI commands reference |
| [product_docs/bmad-tracker-plugin.md](./product_docs/bmad-tracker-plugin.md) | BMAD tracker plugin documentation |
| [product_docs/bmad-web-dashboard.md](./product_docs/bmad-web-dashboard.md) | BMAD web dashboard documentation |

## Design

| Document | Description |
|----------|-------------|
| [design/design-brief.md](./design/design-brief.md) | UI/UX design brief |
| [design/session-detail-design-brief.md](./design/session-detail-design-brief.md) | Session detail page design |
| [design/orchestrator-terminal-design-brief.md](./design/orchestrator-terminal-design-brief.md) | Terminal integration design |

## Legacy (Superseded)

| Document | Superseded By |
|----------|---------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | [development-guide.md](./development-guide.md) |
| [SETUP-GUIDE.md](./SETUP-GUIDE.md) | [development-guide.md](./development-guide.md) |

## Project Artifacts

| Location | Description |
|----------|-------------|
| [../CLAUDE.md](../CLAUDE.md) | AI coding assistant rules and conventions |
| [../_bmad-output/planning-artifacts/](../_bmad-output/planning-artifacts/) | PRD, architecture, epics, UX design |
| [../_bmad-output/implementation-artifacts/](../_bmad-output/implementation-artifacts/) | Sprint status, story specs, retrospectives |
| [../agent-orchestrator.yaml.example](../agent-orchestrator.yaml.example) | Configuration template with all options |

## Quick Reference

- **All interfaces:** `packages/core/src/types.ts` — Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, EventBus
- **Config loading:** `packages/core/src/config.ts` — YAML + Zod validation
- **Session lifecycle:** `packages/core/src/session-manager.ts` + `lifecycle-manager.ts`
- **Plugin example:** `packages/plugins/runtime-tmux/src/index.ts`
- **CLI entry:** `packages/cli/src/index.ts` — 67 registered commands
- **Web entry:** `packages/web/src/app/layout.tsx` — dashboard root
- **AI intelligence:** `packages/core/src/learning-store.ts`, `assignment-scorer.ts`, `collaboration-service.ts`
- **Plugin API:** `packages/plugin-api/src/index.ts` — Plugin, PluginContext, Event, Story, Trigger (note: `Agent` here is a story-level concept, distinct from the `Agent` plugin interface in `core/types.ts`)

## Getting Started

```bash
# Clone and setup (installs deps, builds all packages, configures)
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator && bash scripts/setup.sh

# Or manual setup:
# pnpm install && pnpm build
# cp agent-orchestrator.yaml.example agent-orchestrator.yaml

# Start with a repo URL (auto-detects everything)
ao start https://github.com/your-org/your-repo

# Or configure manually, then start dashboard
pnpm dev  # Opens at http://localhost:5000

# Spawn an agent
ao spawn my-project 123
```
