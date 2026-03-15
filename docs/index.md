# Agent Orchestrator — Documentation Index

Master index for all project documentation. Start with the project overview, then drill into specific areas.

## Core Documentation

| Document | Description |
|----------|-------------|
| [project-overview.md](./project-overview.md) | Executive summary: purpose, parts, tech stack, architecture, test coverage |
| [architecture.md](./architecture.md) | System architecture: 6 layers, 8 plugin slots, state machine, event system, error handling |
| [integration-architecture.md](./integration-architecture.md) | How packages communicate: plugin loading, event flow, SSE, config propagation, error boundaries |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated directory tree of all source files with descriptions |
| [api-contracts.md](./api-contracts.md) | All 53 web API endpoints: methods, paths, request/response formats |
| [component-inventory.md](./component-inventory.md) | 130+ React components: categories, hooks, accessibility patterns, design system |

## Development

| Document | Description |
|----------|-------------|
| [development-guide.md](./development-guide.md) | Comprehensive dev guide: setup, build, test, code standards, plugin/CLI/web development |
| [TESTING-CONVENTIONS.md](./TESTING-CONVENTIONS.md) | Vitest patterns: mock factories, singleton reset, fake timers, assertion standards |
| [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md) | Plugin authoring: all 8 slot interfaces, PluginModule pattern, examples |

## Operations

| Document | Description |
|----------|-------------|
| [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) | External integrations: GitHub, Linear, Slack, webhooks |
| [SCALING-STRATEGIES.md](./SCALING-STRATEGIES.md) | Scaling to many concurrent agents |
| [SECURITY-AUDIT-SUMMARY.md](./SECURITY-AUDIT-SUMMARY.md) | Security practices, audit results, shell command safety |
| [file-locking.md](./file-locking.md) | Advisory file locking mechanism for concurrent access |

## Legacy (Superseded)

| Document | Superseded By |
|----------|---------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | [development-guide.md](./development-guide.md) |
| [SETUP-GUIDE.md](./SETUP-GUIDE.md) | [development-guide.md](./development-guide.md) |

## Project Artifacts

| Location | Description |
|----------|-------------|
| [../CLAUDE.md](../CLAUDE.md) | AI coding assistant rules and conventions |
| [../_bmad-output/](../_bmad-output/) | BMAD methodology artifacts (PRD, architecture, epics, stories, retrospectives) |
| [../agent-orchestrator.yaml.example](../agent-orchestrator.yaml.example) | Configuration template |

## Quick Reference

- **Types**: `packages/core/src/types.ts` — all plugin interfaces
- **Config**: `packages/core/src/config.ts` — YAML + Zod validation
- **Plugin example**: `packages/plugins/runtime-tmux/src/index.ts`
- **CLI entry**: `packages/cli/src/index.ts` — 58 commands
- **Web entry**: `packages/web/src/app/layout.tsx` — dashboard root
- **Tests**: 1400+ tests across all packages, all passing
