# Agent Orchestrator — Project Overview

## Purpose
Open-source system for orchestrating parallel AI coding agents. Agent-agnostic (Claude Code, Codex, Aider, OpenCode, GLM), runtime-agnostic (tmux, process), tracker-agnostic (GitHub, Linear, BMAD). Manages session lifecycle, tracks PR/CI/review state, auto-handles routine issues, pushes notifications to humans only when needed.

Core principle: **Push, not pull.** Spawn agents, walk away, get notified when your judgment is needed.

## Repository Structure
- Monorepo (pnpm workspaces) with 6 major parts and 20 plugins
- TypeScript ESM, Node 20+, strict mode

## Parts
| Part | Package | Type | Description |
|------|---------|------|-------------|
| Core | @composio/ao-core | Library | Types, config, session manager, event bus, state machine, conflict resolver, audit trail (52 source files, 70+ public APIs) |
| CLI | @composio/ao-cli | CLI Tool | The `ao` command — 58 commands for session management, sprint tracking, metrics, notifications (Commander.js, chalk, ora) |
| Web | @composio/ao-web | Web App | Next.js 15 dashboard — fleet monitoring, sprint board, workflow dashboard, terminal, real-time SSE (130+ components, 53 API routes) |
| Plugin API | @composio/ao-plugin-api | Library | Plugin type definitions — zero runtime dependencies |
| Plugins | packages/plugins/* | Library | 20 swappable plugins across 8 slots |
| Integration Tests | @composio/ao-integration-tests | Tests | Real-binary integration tests (21 test files) |

## Plugin Architecture (8 Slots)
| Slot | Plugins | Purpose |
|------|---------|---------|
| Runtime | tmux, process | Execution environment for agents |
| Agent | claude-code, codex, aider, opencode, glm | AI coding tool adapters |
| Workspace | worktree, clone | Code isolation strategy |
| Tracker | github, linear, bmad | Issue tracking integration |
| SCM | github | Source control & PR lifecycle |
| Notifier | desktop, slack, webhook, composio | Push notification delivery |
| Terminal | iterm2, web | Human interaction UI |
| Event Bus | redis | Distributed event pub/sub |

## Technology Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript (ESM) | 5.7+ |
| Runtime | Node.js | 20+ |
| Package Manager | pnpm (workspaces) | 9.15 |
| Web Framework | Next.js (App Router) | 15.1 |
| UI | React + Tailwind CSS | 19 / 4.0 |
| CLI Framework | Commander.js | 13 |
| Config | YAML + Zod validation | — |
| Real-time | Server-Sent Events | — |
| Terminal | xterm.js + node-pty | 5.3 / 1.1 |
| Testing | vitest + Playwright | 4.0 / 1.49 |
| CI/CD | GitHub Actions | — |
| Linting | ESLint + Prettier | 10 / 3.8 |

## Architecture Pattern
- Plugin-based with 8 swappable slots
- Event-driven with pub/sub, audit trail, retry, DLQ
- Flat-file metadata (key=value) + YAML state storage
- Write-through cache with optimistic locking
- Three-tier error handling: retry → circuit breaker → dead letter queue
- Graceful degradation when services unavailable

## Test Coverage
- 1400+ tests across all packages
- Core: 53 test files (unit, integration, performance)
- CLI: 15+ test files
- Web: 34 test files
- Plugins: 20/20 have tests (100%)
- Integration: 21 real-binary test files
- CI: GitHub Actions with gitleaks, dependency review, npm audit

## Key Design Decisions
1. Stateless orchestrator — no database, flat metadata files + event log
2. Plugins implement interfaces — pure implementation of interface from types.ts
3. Push notifications — Notifier is primary human interface, not dashboard
4. Two-tier event handling — auto-handle routine issues, notify human when judgment needed
5. Security first — execFile not exec, validate all external input
6. Hash-based directory structure — config path → SHA hash for multi-project isolation
