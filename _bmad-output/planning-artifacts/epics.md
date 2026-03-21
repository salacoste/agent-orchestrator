---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
workflowStatus: complete
completedAt: '2026-03-15'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-workflow-dashboard.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Agent Orchestrator — Unified Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for agent-orchestrator, decomposing the requirements from **all** planning documents — two PRDs, Architecture, and UX Design — into 9 implementable epics across 3 phases.

**Input Documents:**
- `prd.md` — Main PRD (50 FRs, 47 NFRs)
- `prd-workflow-dashboard.md` — Workflow Dashboard PRD (31 FRs, 27 NFRs)
- `architecture.md` — Architecture decisions (AR1-AR7, WD-1 through WD-8)
- `ux-design-specification.md` — UX design (UX1-UX3)

**Totals:** 81 FRs + 74 NFRs + 20 Additional Requirements = 175 requirements

## Foundation (Previously Delivered)

Epics 1-10 and 2.1 from the original planning cycle have been delivered (66 stories, all complete). The current codebase includes:
- 58 CLI commands, 130+ web components, 20 plugins, 1400+ tests
- Full plugin architecture with 8 slots (Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, Lifecycle)
- Session lifecycle management (`session-manager.ts`), agent registry (`agent-registry.ts`), completion detection (`agent-completion-detector.ts`)
- Event publishing (`event-publisher.ts`), subscription (`event-subscription.ts`), bus integration (`event-bus-integration.ts`)
- Conflict resolution (`conflict-resolver.ts`, `conflict-detection.ts`, `conflict-resolution.ts`)
- Sprint Board dashboard with SSE real-time updates
- Audit trail (`audit-trail.ts`), sync service (`sync-service.ts`), file watcher (`file-watcher.ts`)
- BMAD tracker plugin (`tracker-bmad`), Redis event bus plugin (`event-bus-redis`)

**The epics below represent the NEXT phase of development, building on this foundation. All stories are integration/enhancement work — extending existing modules, not greenfield creation.**

## Standard Acceptance Criteria (Apply to ALL Stories)

Every story in this document implicitly includes these cross-cutting criteria:

- All existing tests continue to pass (1400+ test suite)
- New code follows TypeScript conventions from CLAUDE.md (ESM, `.js` extensions, `node:` prefix, strict mode, `type` imports)
- Shell commands use `execFile`, never `exec` (NFR-S7)
- External commands include 30s timeout (NFR-S9)
- No user input interpolated into shell commands (NFR-S8)
- CLI output follows UX1 visual patterns (htop tables, color-coded status, one-second comprehension)
- Code extends existing modules rather than creating parallel implementations
- API keys never appear in logs or error messages (NFR-S2)

## Testing Strategy

| Epic | Test Focus | Approach |
|------|-----------|----------|
| 1 (Agent Orchestration) | Unit: YAML parsing, assignment logic | Extend existing test files, real sprint-status.yaml fixture |
| 2 (State Sync) | Integration: event flow, sync timing | Use real sprint-status.yaml, verify 5s latency |
| 3 (Notifications) | Unit: dedup logic, routing | Mock notifier plugins |
| 4 (Self-Healing) | Unit: circuit breaker, retry. Integration: recovery flow | Fault injection tests |
| 5 (CLI Fleet) | Snapshot: CLI output format | Match UX1 patterns |
| 6 (Workflow Dashboard) | Unit: 81 permutations, 30 file scenarios. Component: mock data | Front-load computation tests |
| 7 (Dashboard Monitoring) | Component: render with mock data. E2E: SSE updates | Playwright for E2E |
| 8 (Conflict Resolution) | Unit: detection logic. Integration: multi-agent scenario | Simulate concurrent agents |
| 9 (Plugin Extensibility) | Unit: loader, validator. Integration: custom plugin loading | Test plugin fixture |

## Requirements Inventory

### Functional Requirements

**Sprint Planning & Agent Orchestration (FR1-FR8):**
FR1: Product Managers can create sprint plans that automatically spawn agents with story context
FR2: The system can assign stories to agents based on availability and priority
FR3: Product Managers can trigger agent spawning via CLI command with project and sprint parameters
FR4: The system can pass story context (title, description, acceptance criteria) to spawned agents
FR5: Developers can view which agent is working on which story through the dashboard
FR6: The system can detect when an agent has completed a story assignment
FR7: Developers can manually assign stories to specific agents when needed
FR8: The system can resume agent execution after human intervention for blocked stories

**State Synchronization (FR9-FR16):**
FR9: The system can automatically update sprint-status.yaml when agents complete story work
FR10: The system can propagate state changes from Agent Orchestrator to BMAD tracker within 5 seconds
FR11: The system can propagate state changes from BMAD tracker to Agent Orchestrator within 5 seconds
FR12: The system can detect when sprint burndown needs recalculation based on story completions
FR13: The system can unblock dependent stories when their prerequisite stories are completed
FR14: The system can maintain an audit trail of all state transitions in JSONL event log
FR15: Developers can view current sprint status without manual refresh
FR16: The system can reconcile conflicting state updates without data loss

**Event Bus & Notifications (FR17-FR24):**
FR17: The system can publish events when stories are created, started, completed, or blocked
FR18: The system can subscribe to specific event types for targeted processing
FR19: Developers can receive notifications when agent work requires human judgment
FR20: Developers can configure notification preferences (desktop, slack, webhook)
FR21: The system can detect event bus backlog and trigger alerts
FR22: (Duplicate of FR20 — tracked once under FR20)
FR23: The system can deduplicate duplicate events to prevent redundant processing
FR24: The system can persist events to durable storage for recovery

**Dashboard & Monitoring (FR25-FR32):**
FR25: Product Managers can view live sprint burndown charts updated in real-time
FR26: Tech Leads can view a fleet monitoring matrix showing all active agents
FR27: Developers can view agent session cards with status indicators (coding, blocked, idle)
FR28: The system can display agent activity history with timestamps
FR29: DevOps Engineers can view workflow health metrics (event bus status, sync latency, agent count)
FR30: Developers can drill into agent sessions to view detailed logs and error messages
FR31: The system can display conflict detection alerts when multiple agents target the same story
FR32: Tech Leads can view event audit trails for troubleshooting

**Error Handling & Recovery (FR33-FR40):**
FR33: The system can detect when an agent is blocked (no activity for specified threshold)
FR34: The system can gracefully degrade when event bus or tracker services are unavailable
FR35: Developers can review and resolve blocked agent issues through a terminal interface
FR36: The system can recover event bus backlog after service restart
FR37: The system can log all errors with sufficient context for troubleshooting
FR38: The system can retry failed operations with exponential backoff
FR39: DevOps Engineers can configure health check thresholds and alert rules
FR40: The system can detect data corruption in metadata files and recover from backups

**Conflict Resolution & Coordination (FR41-FR44) — Phase 2:**
FR41: The system can detect when multiple agents are assigned to the same story
FR42: The system can resolve conflicts by reassigning lower-priority agents to available stories
FR43: The system can prevent new agent assignments when conflicts are detected
FR44: Tech Leads can view conflict resolution history and decisions

**Plugin & Workflow Extensibility (FR45-FR50) — Phase 3:**
FR45: Developers can install custom workflow plugins to extend orchestration behavior
FR46: Developers can define custom trigger conditions based on story tags, labels, or attributes
FR47: The system can load and validate plugins at startup
FR48: Plugin developers can define custom event handlers for workflow automation
FR49: The system can provide plugin API documentation and type definitions
FR50: Developers can contribute plugins to a community plugin registry

**Workflow Dashboard — Lifecycle Visibility (WD-FR1-FR4):**
WD-FR1: User can view the current BMAD methodology phase state for a project (Analysis, Planning, Solutioning, Implementation) with each phase showing one of three states: not-started, done, or active
WD-FR2: System can compute phase states from BMAD artifacts on disk using presence-based detection with downstream inference
WD-FR3: User can identify the active phase at a glance through distinct visual indicators for each state that do not rely on color alone
WD-FR4: User can view phase progression as an ordered sequence showing the relationship between phases

**Workflow Dashboard — AI-Guided Recommendations (WD-FR5-FR8):**
WD-FR5: System can generate deterministic recommendations based on artifact state and phase progression, using a rule-based engine with zero LLM dependency
WD-FR6: User can view a contextual recommendation consisting of a state observation and an implication, presented in context voice (factual, no imperative verbs)
WD-FR7: System can produce Tier 1 recommendations (missing phase artifacts) and Tier 2 recommendations (incomplete phases) with structured output
WD-FR8: System can return null recommendation when no actionable observation applies

**Workflow Dashboard — Artifact Management (WD-FR9-FR12):**
WD-FR9: User can view an inventory of all generated BMAD documents with filename, associated phase, document type, file path, and modification timestamp
WD-FR10: System can scan _bmad-output/ directory to discover artifacts and classify them by phase using filename pattern matching
WD-FR11: System can handle unrecognized artifacts by placing them in an uncategorized bucket
WD-FR12: User can view the most recent BMAD workflow activity showing filename, phase, and relative timestamp

**Workflow Dashboard — Agent Discovery (WD-FR13-FR15):**
WD-FR13: User can view a list of available BMAD agents with display name, title, icon, and role description
WD-FR14: System can read agent information from the BMAD agent manifest file
WD-FR15: System can display an appropriate empty state when the agent manifest file is not found

**Workflow Dashboard — Real-Time Updates (WD-FR16-FR18):**
WD-FR16: System can detect file changes in BMAD-related directories and notify the dashboard within 500ms end-to-end
WD-FR17: User can see the dashboard update automatically when BMAD files are created, modified, or deleted
WD-FR18: System can debounce rapid file changes to prevent UI flicker during active file editing

**Workflow Dashboard — Navigation & Page Structure (WD-FR19-FR23):**
WD-FR19: User can navigate to the Workflow tab from the existing dashboard navigation bar
WD-FR20: User can select a project to view its BMAD workflow state
WD-FR21: User can view all workflow panels simultaneously without scrolling at 1280x800 viewport
WD-FR22: User can see an informative empty state when viewing a project with no BMAD configuration
WD-FR23: System can detect whether a project has BMAD configuration and render the appropriate view

**Workflow Dashboard — Error Resilience (WD-FR24-FR27):**
WD-FR24: System can maintain a last-known-good state for each data source
WD-FR25: System can detect and handle malformed files without producing user-visible errors
WD-FR26: System can handle inaccessible files by retaining previous state silently
WD-FR27: System can operate with partial BMAD configurations — each panel independently renders what's available

**Workflow Dashboard — Data Integrity Constraints (WD-FR28-FR31):**
WD-FR28: System shall NOT write to any file in _bmad/ or _bmad-output/ directories (read-only lens)
WD-FR29: System shall NOT import from or share state with the tracker-bmad plugin or Sprint Board components
WD-FR30: System shall NOT require changes to agent-orchestrator.yaml configuration
WD-FR31: System shall return a consistent API response shape regardless of BMAD state

**Total FRs: 81** (50 main + 31 WD)

### Non-Functional Requirements

**Performance (NFR-P1-P9):**
NFR-P1: State changes propagate between BMAD and Agent Orchestrator within 5 seconds (p95)
NFR-P2: Sprint burndown charts update within 2 seconds of story completion events
NFR-P3: Dashboard pages load within 2 seconds on standard WiFi connection
NFR-P4: Agent spawn time from CLI command to agent-ready state is ≤10 seconds
NFR-P5: Agent status changes reflect in dashboard within 3 seconds
NFR-P6: Event bus processes 100+ events/second without backlog accumulation
NFR-P7: Event latency from publish to subscriber delivery is ≤500ms (p95)
NFR-P8: CLI commands return within 500ms for non-spawning operations
NFR-P9: CLI help text displays within 200ms

**Security (NFR-S1-S11) — Cross-Cutting:**
NFR-S1: API keys stored in configuration files are readable only by file owner (permissions 600)
NFR-S2: API keys never appear in logs or error messages
NFR-S3: Sensitive configuration values are encrypted at rest when supported by plugin
NFR-S4: Dashboard requires authentication for access (when hosted)
NFR-S5: CLI operations respect file system permissions for project configuration
NFR-S6: Plugin execution sandboxed from core process when technically feasible
NFR-S7: All external command execution uses execFile (not exec) to prevent shell injection
NFR-S8: User-provided input is never interpolated into shell commands or scripts
NFR-S9: External commands include timeout limits (30s default) to prevent hanging
NFR-S10: Sprint data, story content, and agent logs contain no PII by design
NFR-S11: Event logs are retained locally and not transmitted externally without user consent

**Scalability (NFR-SC1-SC8):**
NFR-SC1: System supports 10+ concurrent agents without performance degradation >10%
NFR-SC2: Event bus scales linearly with agent count
NFR-SC3: System supports 100+ stories per sprint without dashboard performance degradation
NFR-SC4: System supports 10+ concurrent projects on single instance
NFR-SC5: Event bus handles burst events (1000 events in 10 seconds) without data loss
NFR-SC6: Event backlog drains within 30 seconds after service restart
NFR-SC7: Architecture supports horizontal scaling for event bus consumers (Phase 3)
NFR-SC8: Plugin system supports unlimited custom workflow plugins without core changes

**Integration (NFR-I1-I9):**
NFR-I1: Plugins load and validate within 2 seconds at startup
NFR-I2: Plugin failures do not crash core process (isolation boundaries)
NFR-I3: Plugin API provides TypeScript type definitions for compile-time validation
NFR-I4: BMAD plugin compatible with sprint-status.yaml format version 1.0+
NFR-I5: BMAD plugin handles malformed YAML gracefully (error + recovery, not crash)
NFR-I6: System works with GitHub, GitLab, and Bitbucket via unified SCM plugin interface
NFR-I7: Git operations respect user-configured credentials and SSH keys
NFR-I8: System supports tmux, process, and Docker runtimes via unified Runtime plugin interface
NFR-I9: Runtime failures trigger graceful degradation, not system crash

**Reliability (NFR-R1-R10):**
NFR-R1: Workflow orchestration service maintains 99.5% uptime
NFR-R2: CLI functions remain available when web dashboard is unavailable
NFR-R3: System gracefully degrades when BMAD tracker is unavailable
NFR-R4: System gracefully degrades when event bus is unavailable
NFR-R5: System never loses state updates (audit trail guarantees eventual consistency)
NFR-R6: Zero data loss in event bus (durable persistence before acknowledgment)
NFR-R7: Conflicting state updates resolve with user notification (no silent overwrites)
NFR-R8: JSONL event log is append-only and immutable
NFR-R9: Event bus automatically recovers backlog after service restart
NFR-R10: System detects and recovers from corrupted metadata files using backup/restore

**Workflow Dashboard — Performance (WD-NFR-P1-P7):**
WD-NFR-P1: API response time <100ms for GET /api/workflow/[project] (expected <20ms)
WD-NFR-P2: Page initial render <500ms from navigation to fully rendered Workflow tab
WD-NFR-P3: SSE end-to-end latency <500ms from file change on disk to UI update in browser
WD-NFR-P4: SSE dispatch latency <50ms from debounce timer firing to SSE event sent
WD-NFR-P5: Bundle size <50KB total for all new Workflow components
WD-NFR-P6: Zero new dependencies — 0 new entries in package.json
WD-NFR-P7: Sprint Board performance — zero degradation in existing response times

**Workflow Dashboard — Reliability (WD-NFR-R1-R5):**
WD-NFR-R1: Error resilience — zero user-visible errors across 6 file states x 5 panels = 30 scenarios
WD-NFR-R2: API stability — API always returns HTTP 200 with well-formed JSON for any BMAD state
WD-NFR-R3: File change debounce — 200ms debounce on file system events
WD-NFR-R4: Graceful degradation — each panel renders independently
WD-NFR-R5: SSE reconnection — client automatically reconnects on connection drop

**Workflow Dashboard — Accessibility (WD-NFR-A1-A6):**
WD-NFR-A1: WCAG 2.1 AA compliance for all new Workflow components
WD-NFR-A2: Semantic markup — all panels use semantic HTML elements, no div-soup
WD-NFR-A3: Color independence — all status indicators use labels + icons + color, never color alone
WD-NFR-A4: Keyboard navigation — all interactive elements reachable via keyboard
WD-NFR-A5: Screen reader support — ARIA labels on all status indicators
WD-NFR-A6: Focus visibility — visible focus indicators on all interactive elements

**Workflow Dashboard — Maintainability (WD-NFR-M1-M4):**
WD-NFR-M1: Component isolation — each panel renderable and testable independently with mock data
WD-NFR-M2: Artifact mapping updatability — mapping defined as single constant
WD-NFR-M3: API contract stability — WorkflowResponse interface documented, changes are breaking
WD-NFR-M4: Code isolation — zero imports from tracker-bmad, zero shared state

**Workflow Dashboard — Testability (WD-NFR-T1-T5):**
WD-NFR-T1: Recommendation engine coverage >80% for recommendation-engine.ts
WD-NFR-T2: Phase computation coverage — all 81 phase-state permutations covered
WD-NFR-T3: Component test coverage >70% for all Workflow components
WD-NFR-T4: Integration test fixture — use actual _bmad/ directory as real-world fixture
WD-NFR-T5: File state test matrix — explicit test cases for all 6 file states

**Total NFRs: 74** (47 main + 27 WD)

### Additional Requirements

**From Architecture — Core System (AR1-AR7):**

AR1: Event Bus Implementation — Redis Pub/Sub for cross-process event distribution, durability via AOF
AR2: State Manager — Write-through cache, YAML authoritative storage, optimistic locking, fs.watch for external changes
AR3: Agent Coordinator — Priority queue (Redis sorted set), agent registry (Redis hash), pre-assignment conflict check, dependency resolution
AR4: Notification Service — Central queue with deduplication, sliding window, plugin-based delivery (Desktop, Slack, Webhook)
AR5: Error Handler — Core handler + service-specific extensions, exponential backoff (1s-16s), circuit breaker (5 failures → open 30s), dead letter queue
AR6: CLI Commands (Phase 1) — ao plan, spawn, assign, status, fleet, queue, health, logs, resume, conflicts, dlq
AR7: Dashboard Components (Phase 2) — Fleet matrix, session cards, burndown charts, story queue, notification center, conflict alerts, audit trail

**From Architecture — Workflow Dashboard (WD-1 through WD-8 + Gaps):**

WD-1: Phase computation uses downstream inference algorithm with latest-active-phase selection
WD-2: ARTIFACT_RULES constant with first-match-wins semantics
WD-3: 7-rule recommendation engine chain: R1 (no artifacts), R2 (no brief), R3 (no PRD), R4 (no architecture), R5 (no epics), R6 (implementation active), R7 (all complete → null)
WD-4: API always returns HTTP 200 with frozen WorkflowResponse interface after PR 1
WD-5: File watcher singleton (prefer node:fs.watch over chokidar) with 200ms debounce
WD-6: 5 independent panel components with props-only data flow, CSS Grid layout at 1280x800
WD-7: Three-layer LKG state pattern: file reading → API cache → client state retention
WD-8: File scanning covers planning-artifacts/, research/, implementation-artifacts/, agent-manifest.csv
WD-G1: Prefer node:fs.watch() with manual debounce over chokidar to avoid dependency risk
WD-G2: Agent manifest CSV parsing needs quoted-field handling (~20 lines, no external library)

**From UX Design (UX1-UX3) — Cross-Cutting:**

UX1: CLI Visual Patterns — htop-style tables for ao fleet, color-coded status (🟢🟡🔴), ASCII burndown, inline notification banners, one-second comprehension goal
UX2: Dashboard Visual Patterns — Progressive disclosure, mission control density, real-time SSE, keyboard shortcuts
UX3: Design Tokens — Green (#22c55e) success/working, Yellow (#eab308) warning/idle, Red (#ef4444) error/blocked, Gray (#6b7280) offline, shared between CLI and dashboard

### Cross-Cutting Concerns (Apply to ALL Epics)

**Security Standards (NFR-S1-S11):** Every story that touches shell commands, configuration, logging, or external input must include these as acceptance criteria. Not epic-specific — architectural constraints.

**UX Standards (UX1, UX3):** CLI visual patterns and design tokens apply across all CLI and dashboard stories. Consistent visual language, not per-epic deliverables.

**Plugin Isolation (NFR-I2):** Plugin failures never crash core process. Acceptance criterion on every story that interacts with plugins.

### FR Coverage Map

| FR Range | Epic | Domain |
|----------|------|--------|
| FR1-FR8 | Epic 1 | Core Agent Orchestration |
| FR9-FR18, FR23-FR24 | Epic 2 | Real-Time Sprint State Sync |
| FR19-FR22 | Epic 3 | Push Notifications & Alerting |
| FR25-FR32 | Epic 5 (CLI) + Epic 7 (Dashboard) | Fleet Monitoring & Analytics |
| FR33-FR40 | Epic 4 | Self-Healing Operations |
| FR41-FR44 | Epic 8 | Multi-Agent Conflict Resolution |
| FR45-FR50 | Epic 9 | Plugin & Workflow Extensibility |
| WD-FR1-FR31 | Epic 6 | BMAD Workflow Dashboard |

**Note:** FR22 is a duplicate of FR20 — tracked once under FR20 in Epic 3.
**Note:** FR25-FR32 are shared between Epic 5 (CLI interface) and Epic 7 (Dashboard interface).

**Coverage: 81/81 unique FRs mapped (100%)**

## Epic List

| Epic | Title | Phase | FR Count | Key NFRs |
|------|-------|-------|----------|----------|
| **1** | Core Agent Orchestration | Phase 1 | 8 | NFR-P4, P8, P9, SC1 |
| **2** | Real-Time Sprint State Sync (Event Bus + Bidirectional YAML Sync) | Phase 1 | 12 | NFR-P1, P6, P7, R5-R10, SC2, SC5-SC6 |
| **3** | Push Notifications & Alerting | Phase 1 | 4 | NFR-I1-I2 |
| **4** | Self-Healing Operations (Error Recovery + Circuit Breaker + DLQ) | Phase 1 | 8 | NFR-R1-R4, SC1 |
| **5** | CLI Sprint Management & Fleet Monitoring | Phase 1 | 8* | NFR-P8, P9, R2 |
| **6** | BMAD Workflow Dashboard | Phase 2 (parallelizable) | 31 | All WD-NFRs (27) |
| **7** | Dashboard Monitoring & Visualization | Phase 2 | 8* | NFR-P2, P3, P5, S4, SC3-SC4 |
| **8** | Multi-Agent Conflict Resolution | Phase 2 | 4 | NFR-R7 |
| **9** | Plugin & Workflow Extensibility | Phase 3 | 6 | NFR-I1, I3, SC7-SC8 |

*Epic 5 and Epic 7 share FR25-FR32 — CLI interface first, Dashboard interface second.

### Dependency Flow

```
Epic 1 (Agent Orchestration) ──┐
                               ├──► Epic 5 (CLI Fleet Monitoring)
Epic 2 (State Sync + Events) ──┤
                               ├──► Epic 7 (Dashboard Monitoring)
Epic 3 (Notifications) ────────┤
                               ├──► Epic 8 (Conflict Resolution)
Epic 4 (Self-Healing) ─────────┘

Epic 6 (Workflow Dashboard) ── standalone (read-only, zero deps on Epics 1-5)

Epic 9 (Plugin Extensibility) ── builds on Epics 1-4
```

**Parallelization opportunity:** Epic 6 (BMAD Workflow Dashboard) has zero coupling to Epics 1-5. It uses existing SSE infrastructure with one additive event type. Can be developed in parallel with Phase 1 work.

---

## Epic 1: Core Agent Orchestration

**Epic Goal:** Developers and Product Managers can spawn AI agents with full story context, assign stories by priority and availability, track agent-story assignments, and resume blocked stories — all through CLI commands.

**FRs Covered:** FR1-FR8, FR33 (blocked detection — lifecycle concern)
**Additional:** AR3 (Agent Coordinator), AR6 (core CLI commands)
**NFRs:** NFR-P4, NFR-P8, NFR-P9, NFR-SC1
**UX:** UX1 (CLI visual patterns)
**Phase:** 1 (MVP — CLI-first)

---

### Story 1.1: Sprint Plan CLI & Data Model Foundation

As a Product Manager,
I want to generate a sprint execution plan from sprint-status.yaml showing stories by status, priority, and dependencies,
So that I can see what's ready to work on and in what order.

**Key ACs:**
- `ao plan` parses sprint-status.yaml, displays summary line + actionable stories (progressive disclosure)
- `ao plan --full` shows complete dependency graph with all stories
- Circular dependency detection with warning message
- Missing YAML file → error message + exit code 1
- Completes within 500ms (NFR-P8)
- Establishes sprint data model types used by subsequent stories

**Requirements:** FR1, AR6
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/plan.ts`, `core/src/config.ts`
**Creates:** Sprint data model types if not in existing `core/src/types.ts`
**Tests:** Extend `cli/src/commands/__tests__/plan.test.ts`, use real sprint-status.yaml fixture

---

### Story 1.2: Story-Aware Agent Spawning

As a Product Manager,
I want to spawn an agent with story context from sprint-status.yaml via `ao spawn --story`,
So that agents begin work with full acceptance criteria without manual setup.

**Key ACs:**
- `ao spawn --story STORY-001` reads story from YAML, passes context (title, description, ACs) via prompt builder
- Optional `--agent <id>` flag to select specific agent instance
- Unresolved dependencies → warning + confirmation prompt
- Spawn completes within 10s (NFR-P4), uses existing Runtime plugin
- Agent-story assignment tracked in metadata files (in-memory + flat file, no Redis)
- Works with `runtime-process` plugin in tests (no tmux dependency in CI)

**Requirements:** FR1, FR3, FR4, AR6
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/spawn.ts`, `core/src/session-manager.ts`, `core/src/prompt-builder.ts`
**Tests:** Extend existing spawn tests, use `runtime-process` for CI

---

### Story 1.3: Agent-Story Status Tracking & Completion Detection

As a Developer,
I want to see which agent is working on which story and get automatic status updates when agents complete or get blocked,
So that I have real-time visibility into agent progress without manual checking.

**Key ACs:**
- `ao status` shows agent-story mapping table (agent ID, story ID, status, runtime duration)
- `ao status STORY-001` shows detailed story status with assigned agent info
- Agent completion detected via process exit code (0 = done, non-zero = failed)
- Blocked detection via configurable inactivity threshold (default 30min, configurable for tests)
- Status updates written to metadata files for persistence
- Integrates with existing `agent-completion-detector.ts` and `blocked-agent-detector.ts`

**Requirements:** FR5, FR6, FR33
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/status.ts`, `core/src/agent-registry.ts`, `core/src/agent-completion-detector.ts`, `core/src/blocked-agent-detector.ts`
**Tests:** Extend existing detector tests, add story-tracking scenarios

---

### Story 1.4: Resume Blocked Stories

As a Developer,
I want to resume a blocked story after resolving the blocking issue,
So that work continues without re-spawning from scratch.

**Key ACs:**
- `ao resume STORY-005` clears blocked status, re-adds to in-memory queue with priority boost (+10)
- Non-blocked story → error message + exit code 1
- Resume count incremented, previous agent context preserved
- Confirmation displayed with story title and blocking reason that was cleared
- Completes within 500ms (NFR-P8)

**Requirements:** FR8, AR6
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Extends:** `cli/src/commands/resume.ts`, `core/src/session-manager.ts`
**Tests:** Extend existing resume tests

---

### Story 1.5: Multi-Agent Assignment (Manual + Priority-Based)

As a Developer,
I want to manually assign stories to specific agents and have the system auto-assign by priority when agents are idle,
So that work distribution is efficient with manual override capability.

**Key ACs:**
- `ao assign STORY-003 claude-2` assigns story to specific agent with confirmation
- Already-assigned story → warning with current assignee + confirmation to reassign
- Auto-assignment: idle agents claim highest-priority story with no unresolved dependencies
- Equal priority → FIFO ordering
- All stories with unresolved deps → agent remains idle (no assignment)
- Uses in-memory priority queue (Redis sorted set deferred to Epic 2)

**Requirements:** FR2, FR7, AR3
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/assign.ts`, `core/src/agent-registry.ts`
**Creates:** Priority queue logic (in-memory, upgradeable to Redis in Epic 2)
**Tests:** 5 scenarios: single assignment, priority ordering, FIFO tiebreak, dependency skip, all-blocked

---

**Epic 1 Summary:** 5 stories, ~3.5 days human / ~3.5 hours agent. Complete single-agent lifecycle (plan → spawn → track → resume) by Story 1.4. Multi-agent features in Story 1.5. All stories extend existing modules. In-memory state throughout (Redis deferred to Epic 2).

---

## Epic 2: Real-Time Sprint State Sync (Event Bus + Bidirectional YAML Sync)

**Epic Goal:** Users get real-time bidirectional state synchronization between BMAD tracker (sprint-status.yaml) and Agent Orchestrator, with event-driven pub/sub, JSONL audit trail, event deduplication, and durable persistence — enabling automatic sprint state propagation within 5 seconds.

**FRs Covered:** FR9-FR18, FR23-FR24
**Additional:** AR1 (Redis Pub/Sub), AR2 (State Manager with write-through cache)
**NFRs:** NFR-P1, NFR-P6, NFR-P7, NFR-R5-R10, NFR-SC2, NFR-SC5-SC6, NFR-I4-I5
**Phase:** 1

---

### Story 2.1: BMAD Tracker Bidirectional Sync Bridge

As a Developer,
I want sprint-status.yaml to automatically update when agents complete stories, and Agent Orchestrator to detect when I manually edit the YAML,
So that state stays consistent between BMAD and Agent Orchestrator within 5 seconds.

**Key ACs:**
- Agent story completion → sprint-status.yaml updated with new status within 5s (NFR-P1)
- External YAML edits detected via file watcher, cache updated within 5s
- Optimistic locking with version stamps prevents concurrent update conflicts
- Write-through cache: every cache write triggers immediate YAML update
- Graceful fallback to direct YAML reads if cache unavailable (NFR-R3)

**Requirements:** FR9, FR10, FR11, FR16, AR2
**Complexity:** High (~1.5 days human / ~1 hour agent)
**Extends:** `core/src/sync-service.ts`, `core/src/file-watcher.ts`, `plugins/tracker-bmad/src/index.ts`
**Tests:** Integration tests with real sprint-status.yaml, verify sync timing

---

### Story 2.2: Story Lifecycle Event Types & Publishing

As a Developer,
I want the system to publish events when stories are created, started, completed, or blocked,
So that other services can subscribe and react to state changes in real-time.

**Key ACs:**
- Story lifecycle events: `story.created`, `story.started`, `story.completed`, `story.blocked`, `story.resumed`
- Events published via existing `event-publisher.ts` with type, timestamp, storyId, agentId, metadata
- Event deduplication prevents redundant processing (NFR-P6, FR23)
- Events persisted to JSONL audit trail before publish acknowledgment (FR24, NFR-R6)
- Processes 100+ events/second without backlog (NFR-P6)
- Event latency ≤500ms publish to subscriber (NFR-P7)

**Requirements:** FR17, FR18, FR23, FR24, AR1
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/event-publisher.ts`, `core/src/event-subscription.ts`, `core/src/audit-trail.ts`
**Tests:** Extend event publisher tests, add story event type coverage, burst test (1000 events in 10s per NFR-SC5)

---

### Story 2.3: Dependency Resolution & Story Unblocking

As a Developer,
I want dependent stories to automatically become available when their prerequisites complete,
So that agents can pick up newly unblocked work without manual intervention.

**Key ACs:**
- Story completion event triggers dependency graph check
- All prerequisites complete → dependent story added to assignment queue
- Partial prerequisites → story remains blocked with clear status
- Subscribe to `story.completed` events from Story 2.2
- Handles diamond dependencies (A→C, B→C, both A and B must complete)

**Requirements:** FR13
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/session-manager.ts` (dependency logic), `core/src/event-subscription.ts`
**Tests:** Dependency scenarios: linear chain, diamond, circular (error case)

---

### Story 2.4: Sprint Burndown Recalculation

As a Product Manager,
I want the sprint burndown to automatically recalculate when stories complete,
So that I always see accurate progress without manual updates.

**Key ACs:**
- Story completion events trigger burndown data update
- Burndown data: remaining story points by day, ideal burndown line, actual burndown line
- Data recalculated within 2s of story completion (NFR-P2)
- Subscribes to story lifecycle events from Story 2.2
- Burndown data available for both CLI (Epic 5) and Dashboard (Epic 7)

**Requirements:** FR12, FR15
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Extends:** `core/src/state-manager.ts`
**Creates:** Burndown calculation utility if not existing
**Tests:** Unit tests for burndown calculation with known story data

---

### Story 2.5: State Conflict Reconciliation

As a Developer,
I want conflicting state updates to be detected and resolved with notification,
So that no silent data overwrites occur when multiple sources update simultaneously.

**Key ACs:**
- Version mismatch throws `ConflictError` with both versions logged to JSONL
- Auto-retry with latest version up to 3 times before escalating
- Unresolved conflicts → human notification via configured notifier (NFR-R7)
- Conflict history queryable for troubleshooting
- Append-only JSONL log maintained (NFR-R8)

**Requirements:** FR14, FR16, AR2
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/conflict-resolver.ts`, `core/src/conflict-detection.ts`, `core/src/audit-trail.ts`
**Tests:** Simulate concurrent updates, verify conflict detection and resolution

---

**Epic 2 Summary:** 5 stories, ~5 days human / ~4 hours agent. Builds the real-time backbone that Epics 3-5, 7-8 depend on. All stories extend existing event/sync infrastructure. Redis integration via existing `event-bus-redis` plugin.

---

## Epic 3: Push Notifications & Alerting

**Epic Goal:** Developers receive push notifications when agent work requires human judgment, can configure notification channels (desktop, Slack, webhook), and get automated alerts for system health issues — ensuring the "push, not pull" principle.

**FRs Covered:** FR19-FR22 (FR22 duplicate of FR20, tracked once)
**Additional:** AR4 (Notification Service with deduplication + routing)
**NFRs:** NFR-I1-I2
**Phase:** 1
**Depends on:** Epic 2 (event bus for notification triggers)

---

### Story 3.1: Notification Routing & Channel Configuration

As a Developer,
I want to configure which notification channels I receive alerts on (desktop, Slack, webhook),
So that I get notified through my preferred communication tools.

**Key ACs:**
- Notification preferences configurable in `agent-orchestrator.yaml` under `notifications:` section
- Per-type routing rules: critical → all channels, high → primary channel, medium → digest, low → log only
- Channel enablement: desktop (true/false), slack (webhook URL), webhook (endpoint + headers)
- Validates configuration at startup, warns on invalid channel config
- Plugin-based delivery via existing Notifier slot (desktop, slack, webhook plugins)

**Requirements:** FR20, FR22, AR4
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/notification-service.ts`, `core/src/config.ts`
**Tests:** Unit tests for routing logic, config validation

---

### Story 3.2: Event-Driven Notification Triggers

As a Developer,
I want to receive push notifications when agents get blocked, conflicts are detected, or the event bus backlog grows,
So that I'm alerted when my judgment is needed without constantly monitoring.

**Key ACs:**
- Subscribes to event bus: `agent.blocked` → critical push, `conflict.detected` → high push, `agent.offline` → high push, `eventbus.backlog` → critical push, `queue.depth.exceeded` → medium digest
- Notification includes actionable context: agent ID, story ID, reason, suggested CLI commands
- Story completion events → log only (low priority)
- Delivery latency <1s from event to notification

**Requirements:** FR19, FR21, AR4
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/notification-service.ts`, `core/src/event-subscription.ts`
**Tests:** Mock notifier plugins, verify trigger-to-delivery flow

---

### Story 3.3: Notification Deduplication & Digest Mode

As a Developer,
I want duplicate notifications suppressed and non-urgent alerts batched into digests,
So that I'm not overwhelmed by repeated alerts for the same issue.

**Key ACs:**
- Sliding window deduplication: same type + entity within configurable window (5-30 min) → suppressed
- Digest mode for medium-priority: batch notifications every 30 min
- Dedup check <5ms (Redis or in-memory cache)
- Notification history queryable via `ao notifications history`
- History retained for 7 days, max 1000 entries

**Requirements:** FR23 (applied to notifications), AR4
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Extends:** `core/src/notification-service.ts`
**Tests:** Unit tests for dedup window, digest batching

---

**Epic 3 Summary:** 3 stories, ~2.5 days human / ~2 hours agent. Builds the push notification layer on top of Epic 2's event bus. Uses existing notifier plugins (desktop, slack, webhook).

---

## Epic 4: Self-Healing Operations (Error Recovery + Circuit Breaker + DLQ)

**Epic Goal:** Users get automatic error recovery with exponential backoff, graceful degradation when services are unavailable, configurable health monitoring, and a dead letter queue for failed operations — ensuring the system self-heals without constant human intervention.

**FRs Covered:** FR33-FR40
**Additional:** AR5 (Error Handler with circuit breaker + DLQ)
**NFRs:** NFR-R1-R4, NFR-SC1, NFR-I2, NFR-I9
**Phase:** 1
**Depends on:** Epic 2 (event bus for error event publishing)

---

### Story 4.1: Error Classification & Structured Logging

As a DevOps Engineer,
I want all errors classified by severity and logged with sufficient context for troubleshooting,
So that I can quickly diagnose issues without searching through unstructured logs.

**Key ACs:**
- Error classification: `fatal` (system crash), `critical` (service down), `warning` (degraded), `info` (recoverable)
- Structured error context: error code, component, operation, timestamp, stack trace, correlation ID
- Blocked agent detection: configurable inactivity threshold (default 30min), publishes `agent.blocked` event
- Corrupted metadata file detection with backup/restore recovery (NFR-R10)
- Errors logged to JSONL event log (append-only, NFR-R8)
- API keys and sensitive data scrubbed from all error output (NFR-S2)

**Requirements:** FR33, FR37, FR40
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/error-logger.ts`, `core/src/metadata.ts`, `core/src/blocked-agent-detector.ts`
**Tests:** Unit tests for classification logic, scrubbing, metadata corruption scenarios

---

### Story 4.2: Circuit Breaker & Exponential Backoff

As a Developer,
I want external service calls to automatically retry with exponential backoff and trip a circuit breaker after repeated failures,
So that transient failures self-heal and cascading failures are prevented.

**Key ACs:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s max (AR5)
- Circuit breaker states: closed → open (after 5 failures) → half-open (after 30s) → closed (on success)
- Open circuit → fast-fail with cached/default response, no external call attempted
- Circuit state transitions published as events for monitoring
- Applies to: event bus, tracker sync, SCM API calls, notification delivery
- Plugin failures caught and isolated — never crash core process (NFR-I2)

**Requirements:** FR34, FR38, AR5
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/circuit-breaker.ts`, `core/src/retry-service.ts`, `core/src/degraded-mode.ts`
**Tests:** Fault injection tests: simulate 5 failures → verify open state, verify half-open recovery

---

### Story 4.3: Dead Letter Queue & Event Replay

As a DevOps Engineer,
I want failed events stored in a dead letter queue with replay capability,
So that no events are permanently lost and I can reprocess them after fixing the underlying issue.

**Key ACs:**
- Failed events (after all retries exhausted) stored in DLQ with original payload + error context + failure count
- `ao dlq` shows DLQ contents: event type, failure time, error message, retry count
- `ao dlq replay [event-id]` replays single event, `ao dlq replay --all` replays all
- DLQ events auto-replayed on service restart (NFR-R9, NFR-SC6) — backlog drains within 30s
- DLQ size limit: 10,000 events, oldest evicted when full
- Event bus backlog threshold configurable, triggers `eventbus.backlog` alert (FR21)

**Requirements:** FR36, FR24, AR5
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/dead-letter-queue.ts`, `core/src/dlq-replay-handlers.ts`, `cli/src/commands/dlq.ts`
**Tests:** Integration tests: event failure → DLQ → replay → success path

---

### Story 4.4: Health Monitoring & Configurable Thresholds

As a DevOps Engineer,
I want to configure health check thresholds and view system health status,
So that I can proactively monitor system health and get alerts before issues escalate.

**Key ACs:**
- `ao health` shows system health dashboard: event bus status, sync latency, agent count, circuit breaker states, DLQ depth
- Configurable thresholds in `agent-orchestrator.yaml`: agent_inactive_threshold, event_bus_backlog_max, sync_latency_warning
- Health status: 🟢 healthy, 🟡 degraded, 🔴 critical — following UX1 patterns
- Threshold breach → notification via Epic 3 notification routing
- Graceful degradation status shown when services unavailable (NFR-R3, NFR-R4)
- Health data exposed via `GET /api/health` for dashboard consumption (Epic 7)

**Requirements:** FR29, FR34, FR35, FR39, AR5
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/health-check.ts`, `core/src/health-check-rules.ts`, `cli/src/commands/health.ts`
**Tests:** Unit tests for threshold logic, degraded state detection

---

**Epic 4 Summary:** 4 stories, ~4 days human / ~3 hours agent. Builds the resilience layer: classify errors → circuit breaker → DLQ → health monitoring. Each layer adds a recovery mechanism on top of the previous.

---

## Epic 5: CLI Sprint Management & Fleet Monitoring

**Epic Goal:** Developers can monitor agent fleet status, view sprint burndown, access agent logs, check system health, and review audit trails — all through rich CLI commands with htop-style table formatting, color-coded status indicators, and ASCII charts.

**FRs Covered:** FR25-FR28, FR29-FR30, FR32 (CLI interface)
**Additional:** AR6 (CLI commands: fleet, status, health, logs, burndown, conflicts)
**NFRs:** NFR-P8, NFR-P9, NFR-R2
**UX:** UX1 (CLI visual patterns), UX3 (design tokens)
**Phase:** 1
**Depends on:** Epic 1 (agent data), Epic 2 (state data)

---

### Story 5.1: ao fleet — Multi-Agent Fleet Matrix

As a Tech Lead,
I want to view a fleet monitoring matrix showing all active agents with status indicators,
So that I can see the entire agent team at a glance.

**Key ACs:**
- `ao fleet` displays htop-style table: Agent ID, Story, Status (🟢 coding / 🟡 idle / 🔴 blocked), Runtime Duration, Last Activity
- `ao fleet --watch` auto-refreshes every 5s (terminal clear + redraw)
- Sort by status (blocked first), then duration descending
- Empty fleet → "No active agents. Use `ao spawn` to start one."
- Completes within 500ms (NFR-P8), works when dashboard unavailable (NFR-R2)
- Column widths adapt to terminal width, truncate long story titles with `…`

**Requirements:** FR26, FR27, AR6
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/fleet.ts`, `cli/src/lib/format.ts`
**Tests:** Snapshot tests for table output format, verify UX1 color patterns

---

### Story 5.2: ao burndown & ao sprint-summary — Sprint Analytics CLI

As a Product Manager,
I want to view sprint burndown charts and sprint summary in the terminal,
So that I can track sprint progress without opening the dashboard.

**Key ACs:**
- `ao burndown` renders ASCII burndown chart: x-axis (days), y-axis (story points), ideal line (dashed), actual line (solid)
- Chart shows remaining points, completed today, sprint velocity
- `ao sprint-summary` shows: total stories, by-status breakdown, completion %, days remaining, projected completion date
- Data sourced from Epic 2 burndown calculation
- Completes within 500ms (NFR-P8)
- Chart scales to terminal width (min 60 cols)

**Requirements:** FR25, FR29, AR6
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/sprint-summary.ts`, `cli/src/lib/format.ts`
**Creates:** ASCII chart rendering utility if not existing
**Tests:** Snapshot tests for chart output with known data points

---

### Story 5.3: ao logs — Agent Log Viewer

As a Developer,
I want to view detailed agent logs and drill into specific agent sessions,
So that I can troubleshoot agent issues without SSH-ing into tmux sessions.

**Key ACs:**
- `ao logs <agent-id>` shows last 50 lines of agent output (tail mode)
- `ao logs <agent-id> --follow` streams live output (like `tail -f`)
- `ao logs <agent-id> --since 30m` filters by time window
- `ao logs` (no agent) shows interleaved log from all agents with agent ID prefix
- Handles agent not found → error message + list of active agents
- Respects log capture from existing `core/src/log-capture.ts`

**Requirements:** FR28, FR30, AR6
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `cli/src/commands/` (new or extend existing log command), `core/src/log-capture.ts`
**Tests:** Unit tests for time filtering, agent ID validation

---

### Story 5.4: ao events — Event Audit Trail CLI

As a Tech Lead,
I want to view the event audit trail from the CLI,
So that I can troubleshoot event flow and state transitions without the dashboard.

**Key ACs:**
- `ao events` shows last 20 events: timestamp, type, entity, status
- `ao events --type story.completed` filters by event type
- `ao events --since 1h` filters by time window
- `ao events --json` outputs raw JSONL for piping to `jq`
- Reads from JSONL audit trail (NFR-R8 append-only format)
- Completes within 500ms (NFR-P8)

**Requirements:** FR32, AR6
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Extends:** `cli/src/commands/events.ts`, `core/src/audit-trail.ts`
**Tests:** Unit tests for filtering, format output

---

### Story 5.5: Deferred Tech Debt from Epics 1-4

As a Developer,
I want deferred items from Epics 1-4 resolved before moving to Phase 2,
so that the core platform is fully complete with no lingering gaps.

**Key ACs:**
- HealthCheckRulesEngine wired into HealthCheckService — weighted scoring, per-component thresholds, custom rules (deferred from Story 4.4 Task 3)
- CLI `ao health` consumes `health:` YAML config section and displays DLQ depth row (deferred from Story 4.4 Task 6)
- `metadata.corrupted` event published when metadata backup/restore triggers (deferred from Story 4.1 — circular dependency with EventBus)
- `registerClassificationRule()` public API for external error classification rules (deferred from Story 4.1)

**Requirements:** FR37, FR39, AR5
**Complexity:** Medium
**Extends:** `core/src/health-check.ts`, `core/src/health-check-rules.ts`, `core/src/error-logger.ts`, `core/src/metadata.ts`, `cli/src/commands/health.ts`
**Tests:** Unit tests for rules engine integration, CLI health config, metadata events, classification API

---

**Epic 5 Summary:** 5 stories. CLI-first monitoring: fleet matrix → burndown → logs → events → tech debt cleanup. Each command follows UX1 htop patterns. CLI works independently of dashboard (NFR-R2).

---

## Epic 6: BMAD Workflow Dashboard

**Epic Goal:** Users can view BMAD methodology lifecycle progress through a glanceable Workflow tab with phase progress bar, deterministic AI-guided recommendations, artifact inventory, agent discovery panel, and last activity indicator — all as a read-only lens over existing file-based state with zero new dependencies, real-time SSE updates, and three-layer LKG error resilience.

**FRs Covered:** WD-FR1-FR31
**Additional:** WD-1 through WD-8, WD-G1, WD-G2
**NFRs:** WD-NFR-P1-P7, WD-NFR-R1-R5, WD-NFR-A1-A6, WD-NFR-M1-M4, WD-NFR-T1-T5
**Phase:** 2 (parallelizable with Phase 1 — zero coupling to Epics 1-5)
**PR Decomposition:** PR1 (API + compute + tests), PR2 (page + shell + phase bar), PR3 (AI Guide + agents), PR4 (inventory + activity), PR5 (SSE watcher)
**Testing:** Front-load computation engine + 81-permutation tests before UI components

**Note:** Stories 6.1-6.13 are imported from the dedicated Workflow Dashboard epic breakdown (`epics-workflow-dashboard.md`), renumbered and audited against the existing codebase. Several components already exist (WorkflowDashboard.tsx, WorkflowPhaseBar.tsx, etc.) — individual story specs will detail the delta.

---

### Story 6.1: Artifact Scanner & Phase Computation Engine

As a developer,
I want a library that scans `_bmad-output/` for artifacts, classifies them by phase using ARTIFACT_RULES, and computes phase states via downstream inference,
So that the API has a reliable computation layer to determine BMAD phase progression.

**Key ACs:**
- Scans `_bmad-output/planning-artifacts/`, `research/`, `implementation-artifacts/` for known patterns
- Classifies artifacts by phase (analysis, planning, solutioning, implementation) with filename, phase, path, type, mtime
- Unrecognized files placed in "uncategorized" bucket (WD-FR11)
- Downstream inference: later-phase artifacts → earlier phases inferred "done" (WD-1)
- ARTIFACT_RULES as ordered constant with first-match-wins semantics (WD-2)
- Implementation phase can never be inferred "done" — always "active" if artifacts present

**Requirements:** WD-FR1, WD-FR2, WD-FR4, WD-FR10, WD-FR28, WD-FR29, WD-FR30
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/lib/workflow/artifact-scanner.ts`, `web/src/lib/workflow/phase-calculator.ts`
**Tests:** Unit tests with 81 phase-state permutations (WD-NFR-T2), real `_bmad/` fixture (WD-NFR-T4)

---

### Story 6.2: Workflow API Route

As a dashboard user,
I want a `GET /api/workflow/[project]` endpoint that returns the complete workflow state,
So that the frontend can render all workflow panels from a single API call.

**Key ACs:**
- Returns HTTP 200 with `WorkflowResponse` JSON: `phases`, `recommendation`, `artifacts`, `agents`, `lastActivity`
- No `_bmad/` directory → `hasBmad: false`, all data fields null
- Malformed artifacts → graceful degradation, valid fields populated, problematic fields null/LKG
- Response time <100ms (WD-NFR-P1), expected <20ms
- WorkflowResponse interface frozen after PR1 — contract stability (WD-4, WD-NFR-M3)
- Never returns error HTTP status for expected BMAD states (WD-FR31)

**Requirements:** WD-FR23, WD-FR31, WD-FR28
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/app/api/workflow/[project]/route.ts`
**Tests:** API tests for all BMAD states (present, absent, malformed, partial)

---

### Story 6.3: Phase Computation Unit Tests

As a developer,
I want comprehensive unit tests covering the phase computation engine and artifact scanner,
So that all 81 phase-state permutations and edge cases are verified before building the UI.

**Key ACs:**
- All 81 permutations of 4 phases × 3 states covered with explicit test cases (WD-NFR-T2)
- Real `_bmad/` directory as test fixture (WD-NFR-T4)
- Edge cases: unknown files, no extension, dotfiles → "uncategorized"
- 6 file states tested: normal, empty, truncated YAML, invalid frontmatter, permission denied, mid-write (WD-NFR-T5)
- Recommendation engine coverage >80% (WD-NFR-T1)

**Requirements:** WD-FR2, WD-FR10, WD-FR11
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/__tests__/workflow/` test files
**Tests:** This IS the test story — 81 permutations + 6 file states + scanner edge cases

---

### Story 6.4: Workflow Page Shell & Navigation

As a dashboard user,
I want a Workflow tab in the navigation bar that opens a page with project selection and a CSS Grid layout,
So that I can navigate to the workflow view and select a project to inspect.

**Key ACs:**
- "Workflow" tab appears in existing nav bar (WD-FR19)
- Project selector displays all configured projects (WD-FR20)
- Single project → auto-selected, multiple → selector dropdown
- No `_bmad/` → informative empty state explaining BMAD and how to start (WD-FR22)
- CSS Grid layout with slots for 5 panels, all visible at 1280×800 without scrolling (WD-FR21, WD-6)
- Initial render <500ms (WD-NFR-P2), bundle <50KB total (WD-NFR-P5)

**Requirements:** WD-FR19, WD-FR20, WD-FR21, WD-FR22, WD-FR23
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/app/workflow/page.tsx`, `web/src/components/Navigation.tsx`
**Tests:** Component tests for empty state, project selection, layout at 1280×800

---

### Story 6.5: Phase Bar Component

As a dashboard user,
I want a visual phase progression bar showing the four BMAD phases with distinct state indicators,
So that I can identify the active phase at a glance.

**Key ACs:**
- Four phases in order: Analysis → Planning → Solutioning → Implementation
- State indicators: ○ not-started, ● done, ★ active — not color-alone (WD-NFR-A3)
- Semantic HTML with ARIA labels (e.g., "Analysis phase: completed") (WD-NFR-A5)
- Keyboard navigable with visible focus rings (WD-NFR-A4, A6)
- Null phase data → graceful loading/empty state
- Renderable independently with mock data (WD-NFR-M1)

**Requirements:** WD-FR1, WD-FR3, WD-FR4
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Creates/Extends:** `web/src/components/WorkflowPhaseBar.tsx`
**Tests:** Component tests with all state combinations, accessibility audit

---

### Story 6.6: Recommendation Engine

As a developer,
I want a deterministic rule-based recommendation engine that evaluates artifact state and returns contextual guidance,
So that the AI Guide panel can display next-step recommendations with zero LLM dependency.

**Key ACs:**
- 7-rule ordered chain: R1 (no artifacts), R2 (no brief), R3 (no PRD), R4 (no architecture), R5 (no epics), R6 (implementation active), R7 (all complete → null) (WD-3)
- First-match-wins: only first matching rule fires
- Output shape: `{ tier: 1|2, observation: string, implication: string, phase: Phase }` or `null`
- Context voice: factual statements, no imperative verbs (WD-FR6)
- Tier 1: missing artifacts, Tier 2: incomplete phases (WD-FR7)

**Requirements:** WD-FR5, WD-FR7, WD-FR8
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/lib/workflow/recommendation-engine.ts`
**Tests:** All 7 rules tested individually + ordering verification, coverage >80% (WD-NFR-T1)

---

### Story 6.7: Recommendation Engine Tests

As a developer,
I want thorough unit tests for the recommendation engine covering all 7 rules and edge cases,
So that recommendation logic is verified before wiring to the UI.

**Key ACs:**
- Each rule (R1-R7) has dedicated test verifying trigger condition, output tier, observation, implication, phase
- R7 returns `null`, not empty object or undefined
- Multi-match scenarios verify first-match-wins ordering
- Context voice validation: no imperative verbs in output text
- Coverage >80% for recommendation-engine.ts (WD-NFR-T1)

**Requirements:** WD-FR5, WD-FR7, WD-FR8
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Creates/Extends:** `web/src/__tests__/workflow/recommendation-engine.test.ts`
**Tests:** This IS the test story — 7 rules + ordering + voice validation

---

### Story 6.8: AI Guide Panel Component

As a dashboard user,
I want an AI Guide panel that displays the current recommendation with observation and implication,
So that I can understand what to do next in my BMAD workflow.

**Key ACs:**
- Non-null recommendation → displays observation + implication, visually distinguished, tier indicated
- Null recommendation → "All phases complete" or contextual empty state
- Semantic HTML (`<section>`, `<p>`), ARIA labels, keyboard-navigable (WD-NFR-A1-A6)
- Loading/unavailable data → skeleton or retained previous recommendation (LKG)
- Renderable independently with mock data (WD-NFR-M1)

**Requirements:** WD-FR6
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Creates/Extends:** `web/src/components/WorkflowAIGuide.tsx`
**Tests:** Component tests with recommendation states, accessibility audit

---

### Story 6.9: Agent Manifest Parser & Agents Panel

As a dashboard user,
I want to see a list of available BMAD agents with display name, title, icon, and role description,
So that I understand who the BMAD agent team is.

**Key ACs:**
- Parses `_bmad/_config/agent-manifest.csv` including quoted fields with commas (~20 lines, no library) (WD-G2)
- Displays each agent as card/row with name, title, icon, description
- Missing manifest → empty state "No agent manifest found" (WD-FR15)
- Malformed rows skipped, renders what's available, no user-visible errors
- Semantic list markup, ARIA labels, keyboard-navigable (WD-NFR-A1-A6)

**Requirements:** WD-FR13, WD-FR14, WD-FR15
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/components/WorkflowAgentsPanel.tsx`
**Tests:** CSV parsing tests (quoted fields, malformed rows), component tests

---

### Story 6.10: Artifact Inventory Panel

As a dashboard user,
I want to view an inventory of all generated BMAD documents with filename, phase, type, path, and modification timestamp,
So that I have a complete picture of what artifacts exist.

**Key ACs:**
- Displays each artifact: filename, phase, document type, file path, modification timestamp
- Unrecognized files shown in "Uncategorized" section, visually distinguished (WD-FR11)
- No artifacts → empty state "No artifacts generated yet"
- Semantic table/list markup with proper headers (WD-NFR-A1-A6)
- Null/loading data → skeleton or graceful empty state (WD-NFR-M1)

**Requirements:** WD-FR9, WD-FR11
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Creates/Extends:** `web/src/components/WorkflowArtifactInventory.tsx`
**Tests:** Component tests with artifact data, empty state, uncategorized items

---

### Story 6.11: Last Activity Indicator

As a dashboard user,
I want to see the most recent BMAD workflow activity showing filename, phase, and relative timestamp,
So that I can quickly understand when and where the last change occurred.

**Key ACs:**
- Displays most recently modified artifact: filename, phase, relative timestamp (e.g., "2 minutes ago")
- `<time>` element with absolute `datetime` attribute for accessibility
- No artifacts → empty state "No activity yet"
- Relative time updated on re-render (not live-ticking)
- Null data → retains previous state or loading indicator (LKG)

**Requirements:** WD-FR12
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Creates/Extends:** `web/src/components/WorkflowLastActivity.tsx`
**Tests:** Component tests with timestamp formatting, empty state

---

### Story 6.12: File Watcher with Debounced SSE Notifications

As a dashboard user,
I want the system to detect BMAD file changes and push SSE notifications,
So that the dashboard updates automatically without manual refresh.

**Key ACs:**
- Watches `_bmad-output/planning-artifacts/`, `research/`, `implementation-artifacts/`, `_bmad/_config/agent-manifest.csv` (WD-8)
- Uses `node:fs.watch()` with manual 200ms debounce — no chokidar (WD-G1, WD-NFR-P6)
- `workflow-change` SSE event dispatched within 500ms end-to-end (WD-NFR-P3)
- Notification-only events (no payload) — client re-fetches API
- Fan-out to all connected SSE clients
- Client auto-reconnects on SSE drop (WD-NFR-R5)
- Watcher errors degrade gracefully, no server crash

**Requirements:** WD-FR16, WD-FR17, WD-FR18
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/lib/workflow/file-watcher.ts`, existing SSE infrastructure
**Tests:** Debounce tests (10 rapid events → 1 notification), reconnection tests

---

### Story 6.13: LKG State Pattern & Error Resilience

As a dashboard user,
I want each panel to retain its last-known-good state when data is temporarily unavailable,
So that I never see error messages or broken UI during transient file system issues.

**Key ACs:**
- Three-layer LKG: file reading → API cache → client state retention (WD-7)
- File read failure (permission denied, mid-write) → API returns cached value, no error in response
- One panel's data source fails → only that panel uses LKG, others render fresh data (WD-NFR-R4)
- 6 file states × 5 panels = 30 scenarios → zero user-visible errors (WD-NFR-R1)
- API always returns HTTP 200 with well-formed JSON (WD-NFR-R2)
- Comprehensive tests for all 30 error resilience scenarios (WD-NFR-T5)

**Requirements:** WD-FR24, WD-FR25, WD-FR26, WD-FR27
**Complexity:** Medium (~1 day human / ~45 min agent)
**Creates/Extends:** `web/src/lib/workflow/lkg-cache.ts`, API route error handling
**Tests:** 30-scenario matrix (6 file states × 5 data sources), LKG cache sequential test (valid → invalid → valid)

---

**Epic 6 Summary:** 13 stories, ~10 days human / ~8 hours agent. Standalone feature (zero coupling to Epics 1-5). PR decomposition: PR1 (6.1-6.3: compute + tests), PR2 (6.4-6.5: page + phase bar), PR3 (6.6-6.9: AI Guide + agents), PR4 (6.10-6.11: inventory + activity), PR5 (6.12-6.13: SSE + resilience). Front-loads computation engine and tests before UI. Several components already exist — story specs will detail the delta.

---

## Epic 7: Dashboard Monitoring & Visualization

**Epic Goal:** Users can monitor agent fleet, view live burndown charts, inspect agent sessions with drill-down logs, see conflict alerts, and browse event audit trails through a rich web dashboard with progressive disclosure, real-time SSE updates, and keyboard shortcuts.

**FRs Covered:** FR25-FR32 (dashboard interface), FR28 (activity history — dashboard only), FR31 (conflict alerts — dashboard only)
**Additional:** AR7 (Dashboard components)
**NFRs:** NFR-P2, NFR-P3, NFR-P5, NFR-S4, NFR-SC3-SC4
**UX:** UX2 (dashboard visual patterns), UX3 (design tokens)
**Phase:** 2
**Depends on:** Epic 2 (event bus for real-time updates), Epic 5 (CLI-validated data patterns)

---

### Story 7.1: Fleet Monitoring Matrix Component

As a Tech Lead,
I want a web dashboard fleet matrix showing all active agents with real-time status updates,
So that I can monitor the entire agent team from the browser.

**Key ACs:**
- Fleet matrix table: Agent ID, Story ID, Status (🟢🟡🔴 with labels), Runtime Duration, Last Activity
- Real-time updates via SSE — status changes reflect within 3s (NFR-P5)
- Click agent row → drills down to agent detail (Story 7.2)
- Supports 10+ concurrent agents without performance degradation (NFR-SC1)
- Progressive disclosure: summary row per agent, expand for details
- Keyboard shortcuts: `j`/`k` navigate rows, `Enter` opens detail (UX2)

**Requirements:** FR26, FR27, AR7
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `web/src/components/Dashboard.tsx`, `web/src/app/fleet/page.tsx`
**Tests:** Component tests with mock agent data, SSE update simulation

---

### Story 7.2: Agent Session Cards with Drill-Down

As a Developer,
I want to click on an agent and see its session details with activity history and live logs,
So that I can troubleshoot agent issues directly from the dashboard.

**Key ACs:**
- Session detail view: agent config, assigned story, status timeline, runtime stats
- Activity history tab: timestamped list of agent actions (FR28)
- Live log tab: streaming agent output via SSE (mirrors `ao logs --follow` from Epic 5)
- Error messages displayed with context — no raw stack traces for non-technical users
- Back button returns to fleet matrix with scroll position preserved
- Supports 100+ stories per sprint without degradation (NFR-SC3)

**Requirements:** FR27, FR28, FR30, AR7
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `web/src/components/SessionDetail.tsx`, `web/src/components/AgentSessionCard.tsx`
**Tests:** Component tests with session data, log streaming mock

---

### Story 7.3: Sprint Burndown Chart & Analytics Dashboard

As a Product Manager,
I want live burndown charts and sprint analytics in the web dashboard,
So that I can present sprint progress to stakeholders with visual charts.

**Key ACs:**
- Burndown chart: ideal line (dashed), actual line (solid), x-axis days, y-axis story points
- Updates within 2s of story completion (NFR-P2) via SSE
- Sprint summary panel: total stories, by-status, completion %, velocity, projected end date
- Chart renders with existing Recharts/chart library (no new dependencies if possible)
- Dashboard page loads within 2s (NFR-P3)
- Supports concurrent projects — project selector at top (NFR-SC4)

**Requirements:** FR25, FR29, AR7
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `web/src/components/BurndownChart.tsx`, `web/src/components/VelocityChart.tsx`
**Tests:** Component tests with known burndown data, chart rendering verification

---

### Story 7.4: Event Audit Trail & Conflict Alerts

As a Tech Lead,
I want to browse event audit trails and see conflict detection alerts in the dashboard,
So that I can troubleshoot event flow and multi-agent coordination issues visually.

**Key ACs:**
- Audit trail viewer: filterable by event type, time range, entity (FR32)
- Conflict alerts panel: active conflicts highlighted with affected agents + stories (FR31)
- Conflict alert → click to view resolution options (links to `ao resolve-conflicts` instructions)
- Event timeline: chronological view with type icons and expandable payload
- Dashboard requires authentication when hosted (NFR-S4)
- Pagination for large event volumes (100+ events per page)

**Requirements:** FR31, FR32, AR7
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `web/src/app/events/page.tsx`, `web/src/app/conflicts/page.tsx`
**Tests:** Component tests with event data, conflict alert rendering

---

**Epic 7 Summary:** 4 stories, ~4 days human / ~3 hours agent. Dashboard counterpart to Epic 5's CLI commands. Same data sources, visual presentation via web UI. All components use SSE for real-time updates. Follows UX2 dashboard patterns with progressive disclosure.

---

## Epic 8: Multi-Agent Conflict Resolution

**Epic Goal:** Users can trust the system to automatically detect when multiple agents target the same story, resolve conflicts by reassigning lower-priority agents, prevent new conflicting assignments, and view conflict resolution history — enabling safe multi-agent coordination at scale.

**FRs Covered:** FR41-FR44
**NFRs:** NFR-R7
**Phase:** 2
**Depends on:** Epic 1 (agent assignments), Epic 2 (event bus for conflict events)

---

### Story 8.1: Conflict Detection Engine

As a Developer,
I want the system to automatically detect when multiple agents are assigned to the same story,
So that conflicting work is caught before agents waste effort on duplicate tasks.

**Key ACs:**
- Pre-assignment check: before `ao assign` or auto-assign, verify no other agent is active on the story
- Conflict detected → `conflict.detected` event published with both agent IDs, story ID, timestamps
- Real-time detection: agent assignment changes checked against live agent-story registry
- Conflict check completes in <50ms (inline with assignment flow)
- Extends existing `core/src/conflict-detection.ts` with story-level conflict detection
- Prevents new assignments when active conflict exists (FR43)

**Requirements:** FR41, FR43
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/conflict-detection.ts`, `core/src/conflict-resolver.ts`, `core/src/agent-registry.ts`
**Tests:** Unit tests: same-story detection, pre-assignment prevention, concurrent assignment race condition

---

### Story 8.2: Automated Conflict Resolution & Reassignment

As a Tech Lead,
I want conflicts automatically resolved by reassigning lower-priority agents to available stories,
So that agent resources are maximized without manual intervention.

**Key ACs:**
- Resolution strategy: agent with lower priority score gets reassigned to next available story
- Equal priority → most recently assigned agent gets reassigned (LIFO)
- No available stories → lower-priority agent paused with `agent.idle` status
- Resolution decision published as `conflict.resolved` event with decision rationale
- Human notified via Epic 3 notification routing (NFR-R7 — no silent overwrites)
- `ao resolve-conflicts` CLI for manual resolution override

**Requirements:** FR42, FR43
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/conflict-resolution.ts`, `core/src/conflict-resolver.ts`, `cli/src/commands/resolve-conflicts.ts`
**Tests:** Resolution scenarios: priority-based, LIFO tiebreak, no-available-stories, manual override

---

### Story 8.3: Conflict History & Analytics

As a Tech Lead,
I want to view conflict resolution history and conflict pattern analytics,
So that I can identify recurring conflicts and optimize agent assignment strategies.

**Key ACs:**
- `ao conflicts history` shows past conflicts: timestamp, agents involved, story, resolution, outcome
- `ao conflicts stats` shows conflict frequency, most-conflicted stories, resolution success rate
- Conflict data stored in JSONL audit trail (reuses existing infrastructure)
- Dashboard conflict alerts panel (Epic 7.4) links to full history
- History retained for 30 days, max 5000 entries

**Requirements:** FR44
**Complexity:** Low (~0.5 day human / ~30 min agent)
**Extends:** `core/src/conflict-metrics.ts`, `core/src/conflict-patterns.ts`, `cli/src/commands/conflicts.ts`
**Tests:** Unit tests for metrics aggregation, history querying

---

**Epic 8 Summary:** 3 stories, ~2.5 days human / ~2 hours agent. Detection → resolution → analytics pipeline. Extends existing conflict resolution modules. Integrates with Epic 2 events and Epic 3 notifications.

---

## Epic 9: Plugin & Workflow Extensibility

**Epic Goal:** Developers can install custom workflow plugins, define trigger conditions based on story attributes, access TypeScript plugin API with compile-time type checking, create custom event handlers, and contribute to a community plugin registry — enabling the ecosystem to extend orchestration behavior beyond built-in capabilities.

**FRs Covered:** FR45-FR50
**NFRs:** NFR-I1, NFR-I3, NFR-SC7-SC8
**Phase:** 3
**Depends on:** Epics 1-4 (core platform must be stable)

---

### Story 9.1: Plugin Installation & Discovery CLI

As a Developer,
I want to install, list, and remove custom workflow plugins via CLI,
So that I can extend orchestration behavior without modifying core code.

**Key ACs:**
- `ao plugins install <name>` installs from npm or local path, validates PluginModule interface
- `ao plugins list` shows installed plugins: name, slot, version, status (enabled/disabled)
- `ao plugins remove <name>` removes plugin with confirmation
- Plugin validation at startup: load, validate interface compliance, log failures (FR47, NFR-I1)
- Invalid plugins logged and skipped — never crash core process (NFR-I2)
- Startup validation completes within 2s for all plugins (NFR-I1)

**Requirements:** FR45, FR47
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/plugin-installer.ts`, `core/src/plugin-loader.ts`, `cli/src/commands/plugins.ts`
**Tests:** Install/remove flow, validation with invalid plugin, startup timing

---

### Story 9.2: Custom Trigger Conditions & Event Handlers

As a Developer,
I want to define custom trigger conditions and event handlers,
So that I can automate workflows based on story attributes, tags, or custom events.

**Key ACs:**
- Trigger conditions support AND/OR/NOT composition (extends `trigger-condition-evaluator.ts`)
- Conditions can match on: story tags, labels, priority, status, custom metadata fields
- Custom event handlers registered via plugin API, receive typed event payloads
- `ao triggers list` shows active triggers with conditions and target handlers
- `ao triggers add --condition "tag:urgent AND priority:high" --handler my-plugin:handle-urgent`
- Event handlers execute in plugin sandbox — failures isolated (NFR-I2)

**Requirements:** FR46, FR48
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/trigger-condition-evaluator.ts`, `core/src/workflow-engine.ts`, `cli/src/commands/triggers.ts`
**Tests:** Condition evaluation (AND/OR/NOT), handler registration, sandbox isolation

---

### Story 9.3: Plugin TypeScript API & Documentation

As a Plugin Developer,
I want comprehensive TypeScript type definitions and API documentation for the plugin system,
So that I can build plugins with compile-time type checking and IDE autocomplete.

**Key ACs:**
- `@composio/ao-plugin-api` package provides all plugin interfaces with JSDoc comments
- TypeScript `satisfies PluginModule<T>` pattern documented with examples for each slot (FR49)
- Plugin starter template: `ao plugins create <name> --slot <slot>` scaffolds project with tsconfig, test file, example implementation
- API documentation generated from TypeScript types (no separate doc maintenance)
- Type definitions cover: PluginModule, PluginManifest, all 8 slot interfaces, event types, config schema

**Requirements:** FR49, NFR-I3
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `packages/plugin-api/src/types.ts`, `packages/plugin-api/src/index.ts`
**Creates:** Plugin starter template scaffold
**Tests:** Type compilation tests (verify plugin examples compile), template scaffold test

---

### Story 9.4: Community Plugin Registry Foundation

As a Developer,
I want to discover and share plugins through a community registry,
So that the ecosystem can grow beyond built-in plugins.

**Key ACs:**
- `ao plugins search <query>` searches npm for packages matching `ao-plugin-*` naming convention
- Search results show: name, description, version, slot, downloads, compatibility
- Plugin compatibility matrix: validates plugin against current ao-core version (semver) (NFR-SC8)
- `ao plugins publish` validates and publishes to npm with correct metadata
- Registry foundation: npm-based discovery (no custom server required initially)
- Unlimited custom plugins without core changes (NFR-SC8)

**Requirements:** FR50, NFR-SC7, NFR-SC8
**Complexity:** Medium (~1 day human / ~45 min agent)
**Extends:** `core/src/plugin-npm-registry.ts`, `core/src/plugin-marketplace.ts`, `core/src/plugin-version-compatibility.ts`
**Tests:** npm search mock, version compatibility matrix tests

---

**Epic 9 Summary:** 4 stories, ~4 days human / ~3 hours agent. Platform extensibility: install → triggers → API → registry. Builds on existing plugin infrastructure. Phase 3 — requires stable core from Epics 1-4.

---

## Grand Summary

| Epic | Stories | Est. Human Days | Est. Agent Hours | Phase |
|------|---------|-----------------|------------------|-------|
| 1: Core Agent Orchestration | 5 | 3.5 | 3.5 | 1 |
| 2: Real-Time Sprint State Sync | 5 | 5 | 4 | 1 |
| 3: Push Notifications & Alerting | 3 | 2.5 | 2 | 1 |
| 4: Self-Healing Operations | 4 | 4 | 3 | 1 |
| 5: CLI Sprint Management | 4 | 3.5 | 2.5 | 1 |
| 6: BMAD Workflow Dashboard | 13 | 10 | 8 | 2* |
| 7: Dashboard Monitoring | 4 | 4 | 3 | 2 |
| 8: Multi-Agent Conflict Resolution | 3 | 2.5 | 2 | 2 |
| 9: Plugin & Workflow Extensibility | 4 | 4 | 3 | 3 |
| **Total** | **45** | **39** | **31** | — |

*Epic 6 is parallelizable with Phase 1 (zero coupling to Epics 1-5).

**Coverage:** 81/81 FRs mapped (100%), 74 NFRs addressed via cross-cutting ACs + epic-specific criteria, 20 ARs integrated into relevant stories.
