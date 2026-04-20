# Epic 62: GitHub Pages Documentation

## Overview

Complete GitHub Pages documentation site for the agent-orchestrator project. Jekyll-based site with Just the Docs theme, covering installation, architecture, plugins, CLI, web dashboard, API, tutorials, and contribution guides.

**Goal**: Ship a searchable, navigable documentation site that covers every feature, plugin, command, and API endpoint.

**Source**: Documentation backlog tasks (task-66 through task-129)

---

## Epic 62: GitHub Pages Documentation

### Phase 1 — Infrastructure & Getting Started (P0)

#### Story 62.1: Jekyll + GitHub Pages Infrastructure Setup
- Set up _config.yml with Just the Docs theme
- Create GitHub Actions workflow for gh-pages deployment
- Create all documentation directories (15 subdirectories)
- Configure search (lunr.js), navigation, and layout templates
- **AC**: Site builds and deploys to gh-pages, search works, all directories created

#### Story 62.2: Landing Page
- Hero section with tagline and value proposition
- Feature highlights (8 plugin slots, agent-agnostic, push-not-pull)
- Quick install one-liner
- CTA buttons to quick-start and GitHub repo
- **AC**: Landing renders, mobile responsive, clear value proposition above fold

#### Story 62.3: Installation Guide
- Prerequisites (Node 20+, pnpm, git)
- 3 install methods (npm global, pnpm, from source)
- Verification (ao --version, ao doctor)
- Troubleshooting common failures
- **AC**: All 3 methods with copy-paste commands, prerequisites section, verification step

#### Story 62.4: Quick Start Tutorial
- 5-minute hands-on: init config, spawn session, view status
- End-to-end first experience
- Expected output for each step
- **AC**: Complete in <5 min, every command copy-pasteable, links to next resources

#### Story 62.5: Configuration Reference
- Full YAML config reference (all sections)
- Every field with type, default, description
- Complete example config inline
- Per-plugin config sections
- **AC**: Every config field documented, Zod schema descriptions match, validation errors explained

#### Story 62.6: Architecture Overview
- 8 plugin slots diagram
- Data flow (config → session → agent → event → notification)
- Stateless design, flat metadata, event log
- Push-not-pull philosophy
- **AC**: Plugin diagram, data flow diagram, merges ARCHITECTURE.md and docs/architecture.md

### Phase 2 — Core Concepts (P1)

#### Story 62.7: Sessions Lifecycle
- 17 session states with transitions
- 20-step spawn pipeline
- Session CRUD, completion/failure handlers
- **AC**: State transition table, spawn pipeline explained, completion flows documented

#### Story 62.8: Stories & Sprints
- Story model, sprint lifecycle (plan→start→execute→complete)
- Backlog management, epic hierarchy
- Assignment flow from backlog to agent
- **AC**: Story fields documented, sprint lifecycle explained, assignment flow described

#### Story 62.9: Autopilot Modes
- off/supervised/autonomous modes
- Approval flows, safeguards, mode switching
- **AC**: 3 modes documented, comparison table, mode switching mechanics

#### Story 62.10: Reactions Engine
- 6 default auto-reactions (CI fix, review address, merge conflict, etc.)
- Trigger conditions and action flows
- Custom reaction configuration
- **AC**: All 6 reactions documented, CI fix and review flows shown, custom config example

#### Story 62.11: Memory & Learning
- 3-tier memory architecture (cross-session, session-persistent, ephemeral)
- Pipeline A (Structured Learnings) and Pipeline B (Cross-Session Knowledge)
- Compaction survival, JSONL dedup, 10MB rotation
- **AC**: Architecture diagram, both pipelines documented, dedup/rotation explained

#### Story 62.12: Verification Gate
- Verification gate service, auto-retry, persistent execution
- 3-layer fallback (verify→retry→persist)
- **AC**: 3-layer fallback diagram, all config options documented

#### Story 62.13: Model Routing
- Complexity tiers (LOW→haiku, MEDIUM→sonnet, HIGH→opus)
- Keyword-based classification, auto-escalation after 2 failures
- **AC**: Tiers documented, classification rules listed, override config shown

#### Story 62.14: Agent Assignment
- Scoring formula (successRate*0.4 + domainMatch*0.3 + speedFactor*0.2 - retryPenalty*0.1)
- Shared agent pool, weighted allocation, cross-project assignment
- **AC**: Formula documented, allocation factors explained, utilization tracking described

### Phase 3 — Plugin Reference (P2)

#### Story 62.15: Plugins Index
- Plugin system overview (PluginModule pattern, 8 slots)
- Discovery/loading, satisfies pattern, config inheritance
- **AC**: All 8 slots listed, PluginModule pattern shown, plugin selection guide

#### Story 62.16: Runtime Plugins (tmux, process)
- tmux (session management, pane control) and process (child process)
- Config, prerequisites, comparison table
- **AC**: Both plugins documented, comparison table, config options

#### Story 62.17: Agent Plugins (claude-code, codex, aider, glm, opencode)
- 5 agent plugins with config, prompt format, capabilities
- Agent comparison table
- **AC**: All 5 agents documented, comparison table, model support listed

#### Story 62.18: Workspace Plugins (worktree, clone)
- worktree (git worktree isolation) and clone (full repo clone)
- **AC**: Both documented, comparison table for workspace selection

#### Story 62.19: Tracker Plugins (github, linear, bmad)
- 3 trackers with auth setup, config, feature comparison
- **AC**: All 3 documented, auth setup for each, feature comparison

#### Story 62.20: SCM Plugin (github)
- Auth (PAT, GitHub App), branch/PR operations, merge strategies
- **AC**: Auth setup documented, all operations described

#### Story 62.21: Notifier Plugins (desktop, slack, discord, telegram, webhook, composio)
- 6 notifiers with setup, auth, config, message format
- **AC**: All 6 documented, setup with auth for each

#### Story 62.22: Terminal/Provider/EventBus Plugins (iterm2, web, omc, raw, redis)
- 5 remaining plugins with setup and config
- **AC**: All 5 documented, use cases described

### Phase 4 — CLI Reference (P3)

#### Story 62.23: CLI Index
- Overview of ao binary, 65+ commands across 13 categories
- Global flags, output formats, shell completion
- **AC**: All categories listed with links, global flags documented

#### Story 62.24: CLI Setup Commands
- ao init, ao doctor, ao config (interactive and non-interactive)
- **AC**: All commands with flags documented

#### Story 62.25: CLI Session Commands
- ao spawn, ao list, ao attach, ao kill, ao logs
- **AC**: All commands with flags and options documented

#### Story 62.26: CLI Sprint Commands
- ao sprint plan/start/status/complete/simulate
- **AC**: All sprint subcommands documented

#### Story 62.27: CLI Story Commands
- ao story create/list/assign/complete
- **AC**: All story subcommands documented

#### Story 62.28: CLI Monitoring Commands
- ao status, ao fleet, ao events, ao timeline
- **AC**: All monitoring commands with output formats documented

#### Story 62.29: CLI Review & PR Commands
- ao review, ao merge, ao pr create/list/check
- **AC**: All review/PR commands documented with auto-reaction integration

#### Story 62.30: CLI Intelligence Commands
- ao memory, ao learning, ao model, ao assign
- **AC**: All intelligence commands documented

#### Story 62.31: CLI Infrastructure Commands
- ao plugin install/list/remove, ao conflict, ao pool
- **AC**: All infrastructure commands documented

### Phase 5 — Web Dashboard (P4)

#### Story 62.32: Web Dashboard Index
- Overview: 16 pages, navigation, 11 SSE hooks
- Layout structure and API route connections
- **AC**: All pages listed, SSE hooks documented, navigation described

#### Story 62.33: Portfolio View
- Project grid, cards (status/metrics/health), filtering, aggregated metrics
- **AC**: All portfolio features documented with screenshots/descriptions

#### Story 62.34: Sprint Board
- Story columns, assignment interface, sprint metrics, drill-down
- **AC**: Board layout documented, assignment flow described

#### Story 62.35: Session Detail
- Timeline visualization, log streaming, output/artifacts, agent controls
- **AC**: All session detail features documented

#### Story 62.36: Scenario Comparison
- Monte Carlo interface, what-if parameters, forecast visualization
- **AC**: All scenario features documented

#### Story 62.37: Conflict Resolution
- Conflict visualization, policy config, resolution workflows
- **AC**: All conflict features documented

#### Story 62.38: Risk Management
- Risk score, utilization metrics, optimization recommendations, alerts
- **AC**: All risk features documented

#### Story 62.39: Workflow/Events/Fleet Pages
- Workflow builder, event stream (SSE), fleet management
- **AC**: All three page types documented

### Phase 6 — API Reference (P5)

#### Story 62.40: API Index
- REST API overview, base URL, auth, response formats, error codes
- **AC**: Common patterns documented, error format standardized

#### Story 62.41: Sessions API
- Session CRUD, state transitions, log streaming, output retrieval
- **AC**: All endpoints with request/response schemas documented

#### Story 62.42: Sprints & Stories API
- Sprint/story CRUD, assignment, status updates
- **AC**: All endpoints with request/response schemas documented

#### Story 62.43: Agents API
- Agent listing, capacity check, utilization tracking, pool management
- **AC**: All agent endpoints documented

#### Story 62.44: Events API
- SSE event stream, all 33 event types with schemas, reconnection
- **AC**: All event types listed with schemas, connection lifecycle documented

#### Story 62.45: Portfolio & Dependencies API
- Portfolio aggregation, cross-project dependency routes, graph, blocking status
- **AC**: All portfolio/dependency endpoints documented

#### Story 62.46: Scenarios API
- Run simulation, Monte Carlo forecast, scenario comparison, snapshots
- **AC**: All scenario endpoints documented

#### Story 62.47: Conflicts & Risk API
- Conflict policies, risk scores, utilization, optimization, alert config
- **AC**: All conflict/risk endpoints documented

### Phase 7 — Advanced Topics (P6)

#### Story 62.48: Cross-Project Management
- Shared agent pool, cross-project dependencies, circular detection, auto-unblocking
- **AC**: All cross-project features documented with config examples

#### Story 62.49: Monte Carlo Simulation
- Probabilistic forecasting, simulation parameters, result interpretation
- **AC**: Simulator explained, parameters documented, interpretation guide

#### Story 62.50: Custom Plugin Development
- PluginModule interface, directory structure, registration, testing
- **AC**: Complete plugin authoring guide with code examples

#### Story 62.51: Hooks & Extensions
- preCompact/postCompact hooks, compaction survival, custom hook registration
- **AC**: Hook system documented, survival mechanism explained

#### Story 62.52: Prompt Layers
- 5-layer composition (base→config→rules→learnings→memory)
- Custom layer injection, template format
- **AC**: All 5 layers explained, injection mechanism documented

#### Story 62.53: Production Deployment
- Deployment checklist, monitoring, scaling, security hardening
- **AC**: Complete production guide with checklist

### Phase 8 — Tutorials (P6)

#### Story 62.54: Tutorial — First Agent
- Step-by-step: init→config→spawn→monitor→complete
- **AC**: Every command copy-pasteable, expected output shown, <5 min

#### Story 62.55: Tutorial — GitHub CI/CD Flow
- Auto-reactions for CI failures, review comments, merge conflicts
- **AC**: Full CI/CD flow documented, notification setup included

#### Story 62.56: Tutorial — Multi-Agent Sprint
- 5+ agents in parallel, pool config, assignment, monitoring, retrospective
- **AC**: Complete sprint cycle documented

#### Story 62.57: Tutorial — Portfolio Management
- 3+ projects, cross-project deps, shared pool, portfolio dashboard
- **AC**: Multi-project setup documented end-to-end

#### Story 62.58: Tutorial — Custom Workflow
- Custom reaction pipeline: triggers, actions, testing, deployment
- **AC**: Complete custom reaction created step-by-step

### Phase 9 — SDK, Contributing & About (P6)

#### Story 62.59: SDK Reference
- Full SDK API, installation, all exports, TypeScript types, usage examples
- **AC**: All SDK functions/classes documented with examples

#### Story 62.60: Contributing Guide
- Code of conduct, PR process, issue templates, development setup
- **AC**: Contributing workflow fully documented

#### Story 62.61: Development Setup
- Environment setup, build/test/lint, branch conventions, commit format
- **AC**: All dev commands documented, conventions clear

#### Story 62.62: Plugin Development Guide
- Full PluginModule<T> implementation, testing, publication to npm
- **AC**: Complete plugin authoring deep-dive

#### Story 62.63: Testing Conventions
- Unit/integration/e2e patterns, mock patterns, test utilities, coverage
- **AC**: All test conventions documented with examples

#### Story 62.64: About Pages (Changelog, License)
- Changelog from git tags, MIT license, security policy summary
- **AC**: All about pages complete

---

## Summary

| Phase | Stories | Priority |
|-------|---------|----------|
| Phase 1 — Infrastructure & Getting Started | 6 | P0 (HIGH) |
| Phase 2 — Core Concepts | 8 | P1 (HIGH) |
| Phase 3 — Plugin Reference | 8 | P2 (MEDIUM) |
| Phase 4 — CLI Reference | 9 | P3 (MEDIUM) |
| Phase 5 — Web Dashboard | 8 | P4 (LOW) |
| Phase 6 — API Reference | 8 | P5 (LOW) |
| Phase 7 — Advanced Topics | 6 | P6 (LOW) |
| Phase 8 — Tutorials | 5 | P6 (LOW) |
| Phase 9 — SDK, Contributing & About | 6 | P6 (LOW) |
| **Total** | **64** | |

**Dependencies**: Story 62.1 (infrastructure) blocks all others. Within each phase, stories are parallelizable.
