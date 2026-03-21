---
stepsCompleted: [1, 2, 3, 4]
workflow_completed: true
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-cycle-3-ai-intelligence.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-20-001.md
---

# agent-orchestrator - Epic Breakdown (Cycles 3-4)

## Overview

This document provides the complete epic and story breakdown for agent-orchestrator Cycles 3-4, decomposing the Cycle 3 PRD (AI Intelligence + Tech Debt) and Cycle 4 brainstorming vision (BMAD Workflow Orchestration Web UI) into implementable stories.

**Scope:** Cycles 1-2 are fully delivered (111 stories, ~2,760 tests, 0 failures). This document covers only NEW work.

## Requirements Inventory

### Functional Requirements

**Cycle 3 — AI Agent Intelligence (from prd-cycle-3-ai-intelligence.md):**

FR-AI-1: System can capture structured session outcomes (success, failure, blocked, duration, key decisions) when agents complete stories
FR-AI-2: System can store session learnings in a persistent knowledge base per project (JSONL format)
FR-AI-3: System can inject relevant past learnings into agent prompts when spawning for similar stories
FR-AI-4: System can identify patterns in agent failures and surface them as preventive guidance
FR-AI-5: Developers can view agent learning history via `ao agent-history <agent-id>` CLI command
FR-AI-6: System can correlate session outcomes with story characteristics for assignment optimization
FR-AI-7: System can score agent-story affinity based on past performance on similar stories
FR-AI-8: System can factor agent success rate, average completion time, and retry count into assignment decisions
FR-AI-9: System can recommend optimal agent assignment via `ao assign-suggest <story-id>`
FR-AI-10: System can auto-assign stories to best-fit agents when `auto-assign: smart` is configured
FR-AI-11: Assignment algorithm is pluggable — custom scoring functions via plugin API
FR-AI-12: System can capture code review findings in structured format linked to story and agent
FR-AI-13: System can inject past review findings into agent prompts to prevent repeat issues
FR-AI-14: System can track review finding categories and measure resolution rate per agent
FR-AI-15: Developers can view review analytics via `ao review-stats`
FR-AI-16: System can auto-generate pre-review checklist based on past findings
FR-AI-17: System can detect story dependency chains and schedule dependent stories sequentially
FR-AI-18: System can share context between agents working on related stories
FR-AI-19: System can implement handoff protocol when one agent completes a prerequisite story
FR-AI-20: System can detect and prevent concurrent modifications to the same files by multiple agents
FR-AI-21: Developers can view collaboration graph via `ao collab-graph`

**Cycle 3 — Tech Debt Resolution:**

FR-TD-1: CLI `ao health` consumes `health:` YAML config section and displays DLQ depth row
FR-TD-2: CLI integration tests using `runCliWithTsx` helper for `ao fleet`, `ao burndown`, `ao logs`, `ao events`
FR-TD-3: Next.js API route testing infrastructure for health, workflow, and session endpoints
FR-TD-4: Performance NFR validation — automated benchmarks for stated performance targets
FR-TD-5: Infrastructure documentation — port migration and zombie prevention documented

**Cycle 4 — BMAD Workflow Orchestration (from brainstorming session):**

FR-WF-1: System can model BMAD workflow as a state machine with configurable phases and transitions (brainstorm #19)
FR-WF-2: System can define workflow phases in YAML configuration (brainstorm #36)
FR-WF-3: System can scan `_bmad-output/` directory and build artifact dependency graph from frontmatter (brainstorm #35)
FR-WF-4: System can represent artifacts as first-class typed entities with status, dependencies, and provenance (brainstorm #33)
FR-WF-5: System can emit workflow-specific events (phase.entered, phase.completed, artifact.created, recommendation.generated) via existing SSE (brainstorm #34)
FR-WF-6: Dashboard can display "You Are Here" visual pipeline showing current BMAD phase position (brainstorm #1)
FR-WF-7: Dashboard can display "Next Step" one-click launcher with recommended workflow action (brainstorm #2)
FR-WF-8: System can compute deterministic recommendations from state machine graph traversal (brainstorm #44 Layer 1)
FR-WF-9: System can compute readiness scores per phase transition based on artifact completeness (brainstorm #45)
FR-WF-10: System can display recommendation reasoning transparently (brainstorm #46)
FR-WF-11: Dashboard can display War Room agent grid with stories as rows and status as columns (brainstorm #4)
FR-WF-12: Agent prompts include Commander's Intent — goal-based briefing alongside prescriptive spec (brainstorm #215)
FR-WF-13: Agents emit narrative status updates instead of enum-only states (brainstorm #225)
FR-WF-14: Agents can raise formal help requests with structured choices for human decision (brainstorm #227)
FR-WF-15: Dashboard can display real-time token consumption per agent/story/sprint (brainstorm #14)
FR-WF-16: System can compute agent efficiency scores (tokens per story point) (brainstorm #15)
FR-WF-17: System can detect blocked agents via configurable inactivity thresholds (brainstorm #37)
FR-WF-18: System can detect cascade failures and auto-pause remaining agents (brainstorm #38)
FR-WF-19: Dashboard can display 3-way merge conflict resolution wizard for agent file conflicts (brainstorm #39)
FR-WF-20: System can auto-checkpoint agent WIP every N minutes for rollback capability (brainstorm #41)
FR-WF-21: System can detect and suggest safe parallelism opportunities in story dependency graph (brainstorm #49)
FR-WF-22: System can detect workflow anti-patterns and surface coaching nudges (brainstorm #48)
FR-WF-23: Dashboard provides breadcrumb navigation showing BMAD phase path (brainstorm #77)
FR-WF-24: Dashboard provides keyboard-first navigation with full shortcut system (brainstorm #103)
FR-WF-25: Dashboard provides hover preview tooltips for story/agent references (brainstorm #181)
FR-WF-26: Dashboard provides notification priority tiers — red/amber/green with different channels (brainstorm #78)
FR-WF-27: Dashboard provides sprint clock countdown showing time-vs-work gap (brainstorm #231)
FR-WF-28: System provides zero-config default that works for 80% of cases (brainstorm #211)
FR-WF-29: System provides "Conversation with Your Project" chat interface using artifact graph + event log as context (brainstorm #51)
FR-WF-30: System can track accept/dismiss on recommendations to improve suggestion quality over time (brainstorm #50)

### NonFunctional Requirements

**Cycle 3 — AI Performance:**

NFR-AI-P1: Session learning capture adds <50ms to agent completion flow
NFR-AI-P2: Smart assignment scoring completes in <200ms for up to 50 story candidates
NFR-AI-P3: Learning knowledge base query returns results in <100ms for prompt injection

**Cycle 3 — AI Scalability:**

NFR-AI-SC1: Learning knowledge base supports 10,000+ session records per project
NFR-AI-SC2: Collaboration protocol handles 10+ concurrent agents with dependency tracking
NFR-AI-SC3: File-level conflict detection works across all git worktrees concurrently

**Cycle 3 — AI Data & Storage:**

NFR-AI-D1: Session learnings stored as JSONL (append-only, consistent with audit trail pattern)
NFR-AI-D2: Learning data retained for 90 days by default, configurable
NFR-AI-D3: No external ML service dependency — all intelligence runs locally

**Cycle 3 — AI Security:**

NFR-AI-S1: Session learnings never contain file contents or secrets — only metadata
NFR-AI-S2: Agent collaboration context sharing respects project boundaries

**Cycle 4 — Workflow Orchestration Performance:**

NFR-WF-P1: Artifact scanner builds dependency graph in <500ms for projects with <100 artifacts
NFR-WF-P2: State machine recommendation computation completes in <50ms
NFR-WF-P3: Workflow event propagation to dashboard via SSE in <2 seconds
NFR-WF-P4: "You Are Here" and "Next Step" components render in <500ms

**Cycle 4 — Workflow Orchestration Architecture:**

NFR-WF-A1: Workflow engine is plugin-based — BMAD is default but swappable
NFR-WF-A2: Intelligence/recommendation engine is plugin-based — deterministic default, ML optional
NFR-WF-A3: All new features opt-in via config — zero impact when not configured
NFR-WF-A4: No new external dependencies in core/CLI packages
NFR-WF-A5: Artifact scanner uses filesystem watching, not polling

### Additional Requirements

**From Architecture:**
- Brownfield extension — build on existing 8-slot plugin architecture
- Redis Pub/Sub event bus for cross-process distribution
- State Manager with write-through caching + optimistic locking
- Hybrid Coordinator + Priority Queue for multi-agent coordination
- CLI-first development priority, dashboard extends
- Factory function + impl class pattern for all new services
- JSONL for persistent storage
- Export from `@composio/ao-core` index.ts

**From UX Design:**
- Terminal-native visualizations (chalk, cli-table3, ora)
- shadcn/ui + Tailwind for dashboard components
- Progressive disclosure: fleet overview → agent → story → logs
- "Fire and forget" core interaction loop
- Push-not-pull notification model
- One-second clarity design principle
- Color-coded status indicators (green/yellow/red)

**Architecture Constraints (Cycle 3):**
- AC-AI-1: Extension of existing patterns (factory + impl, JSONL, plugin API)
- AC-AI-2: No new external dependencies in core/CLI
- AC-AI-3: Backward compatibility — all new features opt-in
- AC-AI-4: Pluggable intelligence — assignment scoring via plugin API

**From Brainstorming Session (design principles):**
- State machine as recommendation engine — deterministic, testable, zero-AI Layer 1
- Artifact dependency graph as core data model — everything computed from this
- Push not pull taken to extreme — optimize for human disengagement
- Intelligence as plugin slot — swappable brain
- Agent communication protocol — agents explain themselves
- Compound learning as competitive moat

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR-TD-1 | Epic 5 | Health CLI config consumption |
| FR-TD-2 | Epic 5 | CLI integration tests |
| FR-TD-3 | Epic 5 | API route test infrastructure |
| FR-TD-4 | Epic 5 | Performance benchmarks |
| FR-TD-5 | Epic 5 | Infrastructure documentation |
| FR-AI-1 | Epic 1 | Session outcome capture |
| FR-AI-2 | Epic 1 | Persistent knowledge base (JSONL) |
| FR-AI-3 | Epic 1 | Learning injection into prompts |
| FR-AI-4 | Epic 1 | Failure pattern detection |
| FR-AI-5 | Epic 1 | `ao agent-history` CLI |
| FR-AI-6 | Epic 1 | Outcome-story correlation |
| FR-AI-7 | Epic 2 | Agent-story affinity scoring |
| FR-AI-8 | Epic 2 | Success rate/completion time factoring |
| FR-AI-9 | Epic 2 | `ao assign-suggest` command |
| FR-AI-10 | Epic 2 | `auto-assign: smart` mode |
| FR-AI-11 | Epic 2 | Pluggable scoring via plugin API |
| FR-AI-12 | Epic 3 | Review findings capture |
| FR-AI-13 | Epic 3 | Review findings in prompts |
| FR-AI-14 | Epic 3 | Review category tracking |
| FR-AI-15 | Epic 3 | `ao review-stats` command |
| FR-AI-16 | Epic 3 | Auto-generated pre-review checklist |
| FR-AI-17 | Epic 4 | Dependency chain scheduling |
| FR-AI-18 | Epic 4 | Cross-agent context sharing |
| FR-AI-19 | Epic 4 | Agent handoff protocol |
| FR-AI-20 | Epic 4 | File-level conflict prevention |
| FR-AI-21 | Epic 4 | `ao collab-graph` command |
| FR-WF-1 | Epic 6a | BMAD state machine model |
| FR-WF-2 | Epic 6a | YAML workflow config |
| FR-WF-3 | Epic 6a | Artifact scanner service |
| FR-WF-4 | Epic 6a | Artifact typed entities |
| FR-WF-5 | Epic 6a | Workflow events via SSE |
| FR-WF-28 | Epic 6a | Zero-config default |
| FR-WF-6 | Epic 6b | "You Are Here" pipeline |
| FR-WF-7 | Epic 6b | "Next Step" launcher |
| FR-WF-8 | Epic 6b | Deterministic recommendations |
| FR-WF-9 | Epic 6b | Readiness scoring |
| FR-WF-10 | Epic 6b | Recommendation transparency |
| FR-WF-12 | Epic 7 | Commander's Intent prompts |
| FR-WF-13 | Epic 7 | Agent status narratives |
| FR-WF-14 | Epic 7 | Agent help request protocol |
| FR-WF-22 | Epic 7 | Anti-pattern detector |
| FR-WF-30 | Epic 7 | Recommendation feedback loop |
| FR-WF-17 | Epic 8a | Dead agent detection |
| FR-WF-18 | Epic 8a | Cascade failure circuit breaker |
| FR-WF-19 | Epic 8b | Conflict resolution wizard |
| FR-WF-20 | Epic 8b | Auto-checkpoint & rollback |
| FR-WF-21 | Epic 8b | Parallelism opportunity finder |
| FR-WF-15 | Epic 9 | Token consumption tracking |
| FR-WF-16 | Epic 9 | Efficiency scoring |
| FR-WF-27 | Epic 9 | Sprint clock countdown |
| FR-WF-11 | Epic 10 | War Room agent grid |
| FR-WF-23 | Epic 10 | Breadcrumb navigation |
| FR-WF-24 | Epic 10 | Keyboard shortcuts |
| FR-WF-25 | Epic 10 | Hover preview tooltips |
| FR-WF-26 | Epic 10 | Notification priority tiers |
| FR-WF-29 | Epic 12 | Project conversation chat |

**All 56 FRs mapped. Zero gaps.**

## Epic List

### Cycle 3: AI Intelligence & Tech Debt

**Recommended sequence: Epic 5 first (test infrastructure), then Epics 1→2→3→4 (AI features build on learning store)**

### Epic 5: Tech Debt Resolution & Quality Infrastructure
Users can trust the platform's reliability through comprehensive testing, validated performance benchmarks, and complete health monitoring.
**FRs covered:** FR-TD-1, FR-TD-2, FR-TD-3, FR-TD-4, FR-TD-5
**Note:** Ship FIRST in Cycle 3 — stabilize test infrastructure before adding AI features.

### Epic 1: Agent Learning & Memory
Users can benefit from agents that learn from past sessions, avoid repeating mistakes, and improve over time through accumulated project knowledge.
**FRs covered:** FR-AI-1, FR-AI-2, FR-AI-3, FR-AI-4, FR-AI-5, FR-AI-6

### Epic 2: Smart Story Assignment
Users can have stories automatically routed to the best-fit agent based on performance history, domain expertise, and success rates.
**FRs covered:** FR-AI-7, FR-AI-8, FR-AI-9, FR-AI-10, FR-AI-11

### Epic 3: Automated Code Review Integration
Users can have review findings automatically feed back into agent prompts, preventing repeat issues and tracking resolution rates.
**FRs covered:** FR-AI-12, FR-AI-13, FR-AI-14, FR-AI-15, FR-AI-16

### Epic 4: Agent Collaboration Protocols
Users can run multiple agents on dependent stories with automatic context sharing, handoff protocols, and file conflict prevention.
**FRs covered:** FR-AI-17, FR-AI-18, FR-AI-19, FR-AI-20, FR-AI-21

### Cycle 4: BMAD Workflow Orchestration

**Parallelizable with Cycle 3. Critical path: 6a→6b→(8a, 9, 10 in parallel)→7→8b→12**

### Epic 6a: Workflow Data Foundation
The system has a typed artifact model, dependency graph, state machine engine, and workflow events — enabling all downstream workflow dashboard features.
**FRs covered:** FR-WF-1, FR-WF-2, FR-WF-3, FR-WF-4, FR-WF-5, FR-WF-28
**Note:** Foundation epic — no direct user-visible output. Tested via 6b acceptance criteria. Target: 1 sprint max.

### Epic 6b: Workflow Dashboard Experience
Users can see their project's current BMAD phase ("You Are Here"), get recommended next steps, and understand phase readiness — all from the web dashboard.
**FRs covered:** FR-WF-6, FR-WF-7, FR-WF-8, FR-WF-9, FR-WF-10
**Depends on:** Epic 6a

### Epic 7: Agent Communication & Intelligence
Users can understand what agents are doing and why through narrative status updates, structured help requests, and proactive anti-pattern coaching.
**FRs covered:** FR-WF-12, FR-WF-13, FR-WF-14, FR-WF-22, FR-WF-30
**Note:** Mostly prompt engineering changes. FR-WF-30 (feedback loop) is enhanced by Cycle 3 Epic 1 learning store but functions independently.

### Epic 8a: Agent Health & Recovery
Users can trust the system to detect dead/stuck agents and prevent cascade failures across the fleet.
**FRs covered:** FR-WF-17, FR-WF-18

### Epic 8b: Conflict & Checkpoint Management
Users can resolve merge conflicts through a visual wizard, roll back agent work to checkpoints, and discover safe parallelization opportunities.
**FRs covered:** FR-WF-19, FR-WF-20, FR-WF-21
**Depends on:** Epic 8a (health infrastructure)

### Epic 9: Cost & Efficiency Analytics
Users can track agent token costs, measure efficiency per story/sprint, and see a visual sprint clock showing time-vs-work gap.
**FRs covered:** FR-WF-15, FR-WF-16, FR-WF-27

### Epic 10: Dashboard Command Center
Users can navigate the dashboard with full keyboard control, see the War Room fleet grid, get contextual hover previews, and receive prioritized notifications — a complete Mission Control experience.
**FRs covered:** FR-WF-11, FR-WF-23, FR-WF-24, FR-WF-25, FR-WF-26
**Note:** Extends existing FleetMatrix.tsx and WorkflowDashboard.tsx components.

### Epic 12: Project Intelligence & Conversational Interface (STRETCH)
Users can chat with their project to ask questions, get insights, and receive intelligent answers powered by the artifact graph and event log.
**FRs covered:** FR-WF-29
**Note:** Marked as STRETCH — high-wow, not essential. Defer to Cycle 5 if velocity is tight.

---

## Epic 5: Tech Debt Resolution & Quality Infrastructure

Users can trust the platform's reliability through comprehensive testing, validated performance benchmarks, and complete health monitoring.

### Story 5.1: Health CLI Config Consumption & DLQ Display

As a **DevOps engineer**,
I want `ao health` to consume the `health:` YAML config section and display DLQ depth,
So that I can see complete system health including dead letter queue status from a single command.

**Acceptance Criteria:**

**Given** a configured `health:` section in `agent-orchestrator.yaml`
**When** I run `ao health`
**Then** the output includes DLQ depth row with current queue size
**And** the health thresholds from YAML config are used for status indicators (green/yellow/red)
**And** if no `health:` config exists, sensible defaults are used

### Story 5.2: CLI Integration Tests for Fleet, Burndown, Logs, Events

As a **developer**,
I want integration tests for `ao fleet`, `ao burndown`, `ao logs`, and `ao events` commands using `runCliWithTsx`,
So that CLI commands are regression-tested and I can refactor with confidence.

**Acceptance Criteria:**

**Given** the `runCliWithTsx` test helper exists
**When** integration tests run for `ao fleet`
**Then** tests verify table output format, status indicators, and empty-state handling
**And** `ao burndown` tests verify ASCII chart rendering with fixture sprint data
**And** `ao logs` tests verify agent log retrieval and filtering
**And** `ao events` tests verify event listing and time-range filtering
**And** all tests pass in CI with no external service dependencies

### Story 5.3: Next.js API Route Testing Infrastructure

As a **developer**,
I want testing infrastructure for Next.js API routes (health, workflow, sessions),
So that API endpoints are regression-tested and contract changes are caught before deployment.

**Acceptance Criteria:**

**Given** a test helper that creates mock Next.js request/response objects
**When** tests run for the health API route
**Then** tests verify status codes, response shapes, and error handling
**And** workflow API route tests verify project state retrieval and edge cases
**And** session API route tests verify session listing and filtering
**And** tests run without starting a Next.js server

### Story 5.4: Performance NFR Validation Benchmarks

As a **tech lead**,
I want automated benchmarks validating stated performance targets,
So that performance regressions are caught in CI before they reach production.

**Acceptance Criteria:**

**Given** performance targets: 500ms CLI, 100ms API, 2s dashboard load
**When** benchmark suite runs
**Then** CLI command execution times are measured against 500ms threshold
**And** API route response times are measured against 100ms threshold
**And** results output in machine-readable format for CI
**And** benchmarks fail if any target exceeded by >20%

### Story 5.5: Infrastructure Documentation

As a **new contributor**,
I want documentation covering port migration (3000→5000) and zombie prevention patterns,
So that I understand infrastructure decisions and can troubleshoot common issues.

**Acceptance Criteria:**

**Given** the existing docs/ directory
**When** I look for infrastructure documentation
**Then** I find documentation explaining port 3000→5000 migration rationale
**And** zombie process prevention patterns are documented
**And** documentation references relevant source files and configuration

---

## Epic 1: Agent Learning & Memory

Users can benefit from agents that learn from past sessions, avoid repeating mistakes, and improve over time through accumulated project knowledge.

### Story 1.1: Session Outcome Capture

As a **developer**,
I want the system to capture structured session outcomes (success, failure, blocked, duration, key decisions) when agents complete stories,
So that agent performance data accumulates for future optimization.

**Acceptance Criteria:**

**Given** an agent completes a story (any outcome)
**When** the completion handler fires
**Then** a structured outcome record is created with: storyId, agentId, outcome enum, duration, error categories, key decisions
**And** capture adds <50ms to completion flow (NFR-AI-P1)

### Story 1.2: Learning Knowledge Base Storage

As a **developer**,
I want session learnings stored in a persistent JSONL knowledge base per project,
So that learnings survive across sessions and can be queried.

**Acceptance Criteria:**

**Given** a session outcome is captured
**When** it is persisted
**Then** it is appended to `{project}/.ao/learnings.jsonl`
**And** supports 10,000+ records without degradation (NFR-AI-SC1)
**And** data retained 90 days by default, configurable via `learning.retentionDays`
**And** learnings never contain file contents or secrets (NFR-AI-S1)

### Story 1.3: Learning Injection into Agent Prompts

As a **developer**,
I want relevant past learnings injected into agent prompts when spawning for similar stories,
So that agents benefit from accumulated project knowledge.

**Acceptance Criteria:**

**Given** an agent is being spawned for a story
**When** the prompt builder runs
**Then** it queries the learning knowledge base for relevant entries (same domain, similar story characteristics)
**And** injects top-N relevant learnings into the system prompt
**And** query returns in <100ms (NFR-AI-P3)
**And** injection does not break existing prompt structure

### Story 1.4: Failure Pattern Detection & Guidance

As a **tech lead**,
I want the system to identify patterns in agent failures and surface preventive guidance,
So that recurring issues are addressed proactively.

**Acceptance Criteria:**

**Given** the learning knowledge base has 10+ failure records
**When** pattern analysis runs
**Then** it identifies repeated error categories (e.g., "type error in auth module" appearing 3+ times)
**And** surfaces patterns as preventive guidance in agent prompts
**And** guidance is additive — zero impact when knowledge base is empty (AC-AI-3)

### Story 1.5: Agent History CLI Command

As a **developer**,
I want to view agent learning history via `ao agent-history <agent-id>`,
So that I can understand an agent's track record and performance trends.

**Acceptance Criteria:**

**Given** the learning knowledge base has session records
**When** I run `ao agent-history agent-1`
**Then** I see a table of past sessions: story, outcome, duration, error summary
**And** summary statistics: success rate, avg duration, common error categories
**And** output respects existing CLI format conventions (chalk colors, cli-table3)

### Story 1.6: Outcome-Story Correlation Analysis

As a **developer**,
I want the system to correlate session outcomes with story characteristics,
So that assignment optimization can be data-driven.

**Acceptance Criteria:**

**Given** session outcomes linked to story metadata (complexity, domain, dependencies)
**When** correlation analysis runs
**Then** it produces affinity data: "agent-1 succeeds 90% on auth stories, 60% on UI stories"
**And** data is queryable by the assignment service (enables Epic 2)
**And** analysis runs on-demand, not blocking agent operations

---

## Epic 2: Smart Story Assignment

Users can have stories automatically routed to the best-fit agent based on performance history, domain expertise, and success rates.

### Story 2.1: Agent-Story Affinity Scoring

As a **tech lead**,
I want the system to score agent-story affinity based on past performance,
So that story assignment is data-driven.

**Acceptance Criteria:**

**Given** learning data from Epic 1 exists for agents
**When** the scoring function evaluates agent-story pairs
**Then** it produces a 0-100 affinity score based on domain match, complexity match, and technology overlap
**And** scoring completes in <200ms for 50 candidates (NFR-AI-P2)

### Story 2.2: Assignment Factor Weighting

As a **tech lead**,
I want assignment decisions to factor success rate, completion time, and retry count,
So that consistently high-performing agents are preferred.

**Acceptance Criteria:**

**Given** agent history with success/failure/duration data
**When** the assignment algorithm runs
**Then** it weights: success rate (40%), avg completion time (30%), retry count (30%)
**And** weights are configurable in YAML
**And** agents with zero history receive a neutral score

### Story 2.3: Assignment Suggestion CLI

As a **developer**,
I want `ao assign-suggest <story-id>` to show scored agent candidates,
So that I can make informed manual assignment decisions.

**Acceptance Criteria:**

**Given** a story ID and available agents with history
**When** I run `ao assign-suggest story-001`
**Then** I see a ranked table: agent name, affinity score, success rate, avg duration, recommendation
**And** top recommendation is highlighted
**And** if no history exists, output explains "no data yet, using default assignment"

### Story 2.4: Smart Auto-Assignment Mode

As a **PM**,
I want `auto-assign: smart` config to route stories to best-fit agents,
So that optimal assignment happens without manual intervention.

**Acceptance Criteria:**

**Given** `auto-assign: smart` is set in `agent-orchestrator.yaml`
**When** a story enters the queue
**Then** the system selects the highest-scoring available agent
**And** existing `auto-assign: priority` behavior is unchanged (AC-AI-3)
**And** falls back to priority queue if scoring data is insufficient

### Story 2.5: Pluggable Assignment Scorer API

As a **plugin developer**,
I want to register custom scoring functions via plugin API,
So that teams can implement domain-specific assignment logic.

**Acceptance Criteria:**

**Given** the plugin API exposes `registerAssignmentScorer()`
**When** a custom scorer plugin is installed
**Then** it replaces the default scoring function
**And** default rule-based scorer works without any plugins (AC-AI-4)
**And** scorer interface is exported from `@composio/ao-core`

---

## Epic 3: Automated Code Review Integration

Users can have review findings automatically feed back into agent prompts, preventing repeat issues and tracking resolution rates.

### Story 3.1: Review Findings Capture

As a **developer**,
I want code review findings captured in structured format linked to story and agent,
So that review patterns can be analyzed.

**Acceptance Criteria:**

**Given** a code review workflow completes
**When** findings are produced
**Then** each finding is stored with: storyId, agentId, category, severity, file, description
**And** stored in JSONL format consistent with learning store pattern

### Story 3.2: Review Findings Prompt Injection

As a **developer**,
I want past review findings injected into agent prompts to prevent repeat issues,
So that agents learn from reviewer feedback.

**Acceptance Criteria:**

**Given** review findings exist for a codebase area
**When** an agent is spawned for a story touching that area
**Then** relevant past findings are injected: "In previous reviews, this area had issues with X"
**And** injection uses the prompt-builder extension pattern (AC-AI-1)

### Story 3.3: Review Category Tracking & Resolution Rates

As a **tech lead**,
I want review finding categories tracked with resolution rates per agent,
So that I can identify systematic quality issues.

**Acceptance Criteria:**

**Given** multiple review findings across stories
**When** tracking aggregates data
**Then** categories are counted: type-safety, error-handling, test-coverage, naming, etc.
**And** resolution rate computed per agent
**And** data queryable for the review-stats CLI command

### Story 3.4: Review Stats CLI Command

As a **tech lead**,
I want `ao review-stats` showing common issues and agent performance,
So that I have visibility into code quality trends.

**Acceptance Criteria:**

**Given** accumulated review findings data
**When** I run `ao review-stats`
**Then** I see: top 5 finding categories, resolution rate by agent, trend over last 5 sprints
**And** output uses existing CLI format conventions

### Story 3.5: Auto-Generated Pre-Review Checklist

As a **reviewer**,
I want the system to auto-generate a pre-review checklist based on past findings,
So that reviews are targeted and efficient.

**Acceptance Criteria:**

**Given** a PR is ready for review
**When** the checklist generator runs
**Then** it produces 3-7 checklist items based on most common findings for that codebase area
**And** checklist is attached to the PR or displayed in dashboard

---

## Epic 4: Agent Collaboration Protocols

Users can run multiple agents on dependent stories with automatic context sharing, handoff protocols, and file conflict prevention.

### Story 4.1: Dependency Chain Detection & Scheduling

As a **PM**,
I want the system to detect story dependency chains and schedule them sequentially,
So that dependent stories don't start before prerequisites complete.

**Acceptance Criteria:**

**Given** stories with `dependencies` field in sprint plan
**When** the scheduler processes the queue
**Then** dependent stories are held until all prerequisites are `completed`
**And** dependency cycles are detected and reported as errors
**And** works with 10+ concurrent agents (NFR-AI-SC2)

### Story 4.2: Cross-Agent Context Sharing

As a **developer**,
I want agents working on related stories to receive shared context,
So that later agents benefit from earlier agents' work.

**Acceptance Criteria:**

**Given** Agent A completes story-001 which modified `session-manager.ts`
**When** Agent B is spawned for story-002 which depends on story-001
**Then** Agent B's prompt includes: "Agent A modified session-manager.ts — key changes: [summary]"
**And** context sharing respects project boundaries (NFR-AI-S2)

### Story 4.3: Agent Handoff Protocol

As a **developer**,
I want automatic handoff when a prerequisite story completes,
So that dependent agents are unblocked without manual intervention.

**Acceptance Criteria:**

**Given** story-001 is a prerequisite for story-002
**When** story-001 completes
**Then** story-002 is automatically unblocked in the queue
**And** the next available agent is assigned with handoff context
**And** event `story.handoff` is published to the event bus

### Story 4.4: File-Level Conflict Prevention

As a **tech lead**,
I want the system to detect and prevent concurrent file modifications by multiple agents,
So that merge conflicts are avoided.

**Acceptance Criteria:**

**Given** Agent A is modifying `types.ts`
**When** Agent B attempts to modify `types.ts`
**Then** the system detects the overlap and either blocks Agent B or warns the tech lead
**And** detection works across all git worktrees concurrently (NFR-AI-SC3)

### Story 4.5: Collaboration Graph CLI

As a **tech lead**,
I want `ao collab-graph` showing agent dependencies and handoff status,
So that I can visualize how agents coordinate.

**Acceptance Criteria:**

**Given** a sprint with dependency chains and active agents
**When** I run `ao collab-graph`
**Then** I see a text-based graph: story nodes, dependency edges, agent assignments, handoff status
**And** blocked dependencies highlighted in red, completed handoffs in green

---

## Epic 6a: Workflow Data Foundation

The system has a typed artifact model, dependency graph, state machine engine, and workflow events — enabling all downstream workflow dashboard features.

### Story 6a.1: Artifact Type Definition

As a **developer**,
I want `Artifact` defined as a first-class typed interface in `types.ts`,
So that the system can reason about BMAD artifacts programmatically.

**Acceptance Criteria:**

**Given** the existing `types.ts` in `@composio/ao-core`
**When** the Artifact interface is added
**Then** it includes: `type: ArtifactType`, `phase: Phase`, `path: string`, `status: 'draft'|'complete'|'validated'`, `dependencies: ArtifactRef[]`, `createdBy?: SessionRef`
**And** `ArtifactType` enum covers: prd, architecture, epic, story, sprint-plan, review, retrospective, ux-design
**And** exported from `@composio/ao-core` index.ts

### Story 6a.2: Workflow State Machine Model

As a **developer**,
I want the BMAD workflow modeled as a state machine with phases and transitions,
So that "what's next" can be computed deterministically.

**Acceptance Criteria:**

**Given** a state machine definition
**When** queried with current project state
**Then** it returns available transitions (next phases)
**And** transitions have guard conditions (readiness checks)
**And** the model is pure data — no side effects, fully testable

### Story 6a.3: YAML Workflow Configuration

As a **developer**,
I want BMAD workflow phases defined in `agent-orchestrator.yaml`,
So that workflows are configurable data, not hardcoded logic.

**Acceptance Criteria:**

**Given** a `workflow:` section in YAML config
**When** the config is loaded and validated with Zod
**Then** phases, transitions, required artifacts, and guard conditions are parsed
**And** a default BMAD workflow is provided when no config exists (FR-WF-28)
**And** custom phases can be added without code changes

### Story 6a.4: Artifact Scanner Service

As a **developer**,
I want a service that scans `_bmad-output/` and builds the artifact dependency graph,
So that project state is queryable from flat files.

**Acceptance Criteria:**

**Given** `_bmad-output/` contains BMAD artifacts with frontmatter
**When** the scanner runs
**Then** it parses all artifact files, extracts frontmatter metadata, builds in-memory dependency graph
**And** completes in <500ms for <100 artifacts (NFR-WF-P1)
**And** watches for file changes via `fs.watch()` and updates incrementally (NFR-WF-A5)
**And** follows factory function + impl class pattern

### Story 6a.5: Workflow Event Types & SSE Integration

As a **developer**,
I want workflow-specific events emitted via the existing SSE infrastructure,
So that the dashboard receives real-time workflow state changes.

**Acceptance Criteria:**

**Given** the existing event bus and SSE system
**When** a workflow phase changes or artifact is created
**Then** events are published: `workflow.phase.entered`, `workflow.phase.completed`, `workflow.artifact.created`, `workflow.recommendation.generated`
**And** dashboard subscribes via existing SSE endpoint
**And** propagation to dashboard in <2 seconds (NFR-WF-P3)

### Story 6a.6: Zero-Config Default Workflow

As a **new user**,
I want the system to work with zero configuration for standard BMAD workflow,
So that I can start immediately.

**Acceptance Criteria:**

**Given** no `workflow:` section in YAML config
**When** the workflow engine initializes
**Then** a default BMAD workflow is used: brief → prd → architecture → epics → sprint → stories → dev → review
**And** artifact scanner infers current phase from existing `_bmad-output/` artifacts
**And** recommendations work out-of-the-box

---

## Epic 6b: Workflow Dashboard Experience

Users can see their project's current BMAD phase, get recommended next steps, and understand phase readiness from the web dashboard.

### Story 6b.1: "You Are Here" Phase Pipeline Component

As a **PM**,
I want a visual pipeline showing all BMAD phases with current position highlighted,
So that I instantly know where my project stands.

**Acceptance Criteria:**

**Given** the workflow state machine and artifact scanner data
**When** I view the workflow dashboard
**Then** I see a horizontal pipeline: Brief → PRD → Architecture → Epics → Sprint → Stories → Dev → Review
**And** completed phases green, current phase highlighted, future phases gray
**And** renders in <500ms (NFR-WF-P4)

### Story 6b.2: "Next Step" Recommendation Launcher

As a **PM**,
I want a prominent button showing the recommended next workflow action,
So that I never need to memorize the BMAD workflow order.

**Acceptance Criteria:**

**Given** the state machine has computed available transitions
**When** I view the dashboard
**Then** I see "Recommended next: [action]" button with one-sentence explanation
**And** clicking it navigates to the appropriate workflow action
**And** if multiple transitions available, top shown with "more options" dropdown

### Story 6b.3: Deterministic Recommendation Engine

As a **developer**,
I want recommendations computed from state machine graph traversal,
So that "what's next" is deterministic and testable.

**Acceptance Criteria:**

**Given** current project state (completed artifacts, current phase)
**When** the recommendation engine runs
**Then** it returns available transitions sorted by natural workflow order
**And** computation completes in <50ms (NFR-WF-P2)
**And** same state always produces same recommendations

### Story 6b.4: Phase Readiness Scoring

As a **PM**,
I want each phase transition to show a readiness percentage with specific gaps,
So that I know exactly what's missing before advancing.

**Acceptance Criteria:**

**Given** a phase transition requires certain artifacts
**When** readiness is computed
**Then** score = (present artifacts / required artifacts) × 100%
**And** gaps listed: "Architecture readiness: 73% — missing: error handling strategy, deployment plan"
**And** score updates in real-time as artifacts are created

### Story 6b.5: Recommendation Reasoning Display

As a **PM**,
I want every recommendation to show its reasoning,
So that I understand and trust the system's suggestions.

**Acceptance Criteria:**

**Given** a recommendation is generated
**When** I view it in the dashboard
**Then** I see reasoning: "(1) PRD complete ✅, (2) Architecture validated ✅, (3) No epics created yet ❌"
**And** each reason shows pass/fail status
**And** clicking reasoning expands to show underlying data

---

## Epic 7: Agent Communication & Intelligence

Users can understand what agents are doing and why through narrative status updates, structured help requests, and proactive coaching.

### Story 7.1: Commander's Intent in Agent Prompts

As a **developer**,
I want agent prompts to include goal-based "Commander's Intent" alongside specs,
So that agents can adapt when prescribed approaches fail.

**Acceptance Criteria:**

**Given** a story spec with acceptance criteria
**When** an agent is spawned
**Then** prompt includes: "The intent of this story is [goal]. Any solution achieving [goal] is acceptable."
**And** intent auto-generated from story title + acceptance criteria summary
**And** does not break existing prompt structure (AC-AI-3)

### Story 7.2: Agent Narrative Status Updates

As a **tech lead**,
I want agents to emit narrative status updates alongside enum states,
So that I understand what agents are actually doing.

**Acceptance Criteria:**

**Given** an agent is working
**When** it reports status
**Then** status includes narrative: "Finished auth endpoint. Working on test suite. Difficulty mocking OAuth — trying alternative."
**And** narratives displayed in agent session cards
**And** narrative supplements (not replaces) existing status enum

### Story 7.3: Structured Help Request Protocol

As a **developer**,
I want agents to raise formal help requests with structured choices,
So that I get clear decision points instead of vague "blocked" states.

**Acceptance Criteria:**

**Given** an agent is stuck
**When** it raises a help request
**Then** request includes: question, options (A/B/C), context per option
**And** dashboard surfaces help request prominently with clickable choices
**And** human's choice passed back to agent as context

### Story 7.4: Workflow Anti-Pattern Detector

As a **PM**,
I want the system to detect workflow anti-patterns and surface coaching nudges,
So that common BMAD mistakes are prevented.

**Acceptance Criteria:**

**Given** project workflow history
**When** anti-pattern analysis runs
**Then** it detects: "PRD edited 5+ times without advancing", "Architecture skipped", "Missing acceptance criteria"
**And** nudges displayed as non-blocking dashboard banners
**And** dismissible, max 1 per pattern per day

### Story 7.5: Recommendation Feedback Loop

As a **PM**,
I want the system to track which recommendations I accept vs dismiss,
So that suggestions improve over time.

**Acceptance Criteria:**

**Given** recommendations displayed with accept/dismiss actions
**When** I accept or dismiss
**Then** decision logged with recommendation type and context
**And** frequently-dismissed types deprioritized
**And** functions independently (stores in own JSONL)

---

## Epic 8a: Agent Health & Recovery

Users can trust the system to detect dead/stuck agents and prevent cascade failures across the fleet.

### Story 8a.1: Dead Agent Detection

As a **tech lead**,
I want the system to detect agents with no activity for a configurable threshold,
So that stuck agents are surfaced before they waste time.

**Acceptance Criteria:**

**Given** an agent has no output for `health.agentTimeoutMinutes` (default: 15)
**When** the health monitor checks
**Then** dashboard shows amber warning at threshold, red alert at 2× threshold
**And** configurable per-project in YAML
**And** offers recovery actions: "Ping", "Restart with context", "Reassign"

### Story 8a.2: Agent Recovery Actions

As a **tech lead**,
I want one-click recovery actions for stuck agents,
So that I can resolve issues without manual terminal access.

**Acceptance Criteria:**

**Given** a dead/stuck agent is detected
**When** I click a recovery action
**Then** "Ping" sends a nudge prompt to the agent
**And** "Restart with context" kills session, respawns with accumulated context
**And** "Reassign" kills agent and returns story to queue with boosted priority

### Story 8a.3: Cascade Failure Circuit Breaker

As a **tech lead**,
I want the system to auto-pause agents when 3+ fail within 5 minutes,
So that systemic issues don't burn tokens.

**Acceptance Criteria:**

**Given** 3+ agents fail within a 5-minute window
**When** the circuit breaker triggers
**Then** remaining agents are paused (not killed)
**And** dashboard shows: "Cascade detected — running diagnostics..."
**And** auto-diagnostic checks: API connectivity, config validity, basic operations
**And** manual "Resume All" button to restart after resolution

---

## Epic 8b: Conflict & Checkpoint Management

Users can resolve merge conflicts visually, roll back agent work to checkpoints, and discover safe parallelization opportunities.

### Story 8b.1: Merge Conflict Resolution Wizard

As a **developer**,
I want a visual 3-way merge interface when agents create file conflicts,
So that conflicts are resolved in the dashboard.

**Acceptance Criteria:**

**Given** two agents modified the same file in different worktrees
**When** a merge is attempted
**Then** dashboard shows: base version, Agent A changes, Agent B changes side-by-side
**And** AI-generated merge suggestion offered as one-click accept
**And** manual inline editing available for custom resolution

### Story 8b.2: Agent Work Checkpoint & Rollback

As a **developer**,
I want auto-committed WIP checkpoints every N minutes,
So that I can recover from agents going off-rails.

**Acceptance Criteria:**

**Given** `checkpoint.intervalMinutes` configured (default: 10)
**When** the interval elapses during agent work
**Then** a WIP commit is created on agent's branch with `[checkpoint]` prefix
**And** dashboard shows checkpoint timeline per agent
**And** "Rollback to checkpoint" restores worktree and respawns

### Story 8b.3: Parallelism Opportunity Finder

As a **PM**,
I want the system to identify safe parallelism in the dependency graph,
So that I can spawn concurrent agents and save time.

**Acceptance Criteria:**

**Given** a sprint with story dependencies
**When** I view the sprint dashboard
**Then** I see: "Stories 1-1, 1-2, 1-5 have no dependencies — spawn all 3 to save ~4 hours"
**And** shows sequential vs parallel Gantt comparison
**And** "Spawn parallel" button executes the recommendation

---

## Epic 9: Cost & Efficiency Analytics

Users can track agent token costs, measure efficiency, and see sprint time-vs-work gap.

### Story 9.1: Token Consumption Tracking

As a **tech lead**,
I want real-time token consumption per agent, story, and sprint,
So that I can monitor AI costs.

**Acceptance Criteria:**

**Given** agents consume API tokens during operation
**When** I view the cost dashboard
**Then** I see: tokens per active agent, cumulative per story, total per sprint
**And** burn rate (tokens/minute) and projected sprint cost
**And** flags runaway agents consuming >3× average

### Story 9.2: Agent Efficiency Scoring

As a **tech lead**,
I want efficiency scores per agent (tokens per story point),
So that I can optimize agent configuration.

**Acceptance Criteria:**

**Given** token consumption and story point data
**When** efficiency is computed
**Then** score = tokens consumed / story points delivered
**And** dashboard ranks agents by efficiency
**And** identifies patterns: "Stories in packages/core/ cost 2× more tokens"

### Story 9.3: Sprint Clock Countdown

As a **PM**,
I want a visual countdown showing sprint time remaining vs estimated remaining work,
So that I instantly see if we're on track.

**Acceptance Criteria:**

**Given** sprint dates and story completion data
**When** I view the sprint dashboard
**Then** I see: "Sprint ends in 2d 14h. Remaining work: 3d 2h. STATUS: BEHIND by 12h"
**And** color-coded: green (on track), amber (tight), red (behind)
**And** updates in real-time as stories complete

---

## Epic 10: Dashboard Command Center

Users can navigate the dashboard with keyboard control, see the War Room fleet grid, get hover previews, and receive prioritized notifications.

### Story 10.1: War Room Fleet Grid

As a **tech lead**,
I want a story-centric agent grid (stories as rows, status as columns),
So that I see all sprint work at a glance.

**Acceptance Criteria:**

**Given** an active sprint with agents assigned to stories
**When** I view the War Room
**Then** rows = stories, columns: title, agent, status, duration, last activity
**And** color-coded: green (working), amber (slow), red (blocked)
**And** extends existing `FleetMatrix.tsx` component

### Story 10.2: Breadcrumb Navigation

As a **user**,
I want breadcrumb navigation showing my location in the BMAD hierarchy,
So that I always know where I am.

**Acceptance Criteria:**

**Given** I'm viewing a story detail page
**When** I look at the top
**Then** I see: `Project > Sprint 3 > Story 1-3 > Agent Session`
**And** each level is clickable to navigate up
**And** breadcrumbs update dynamically on navigation

### Story 10.3: Keyboard Shortcut System

As a **power user**,
I want full keyboard navigation throughout the dashboard,
So that I can orchestrate without touching the mouse.

**Acceptance Criteria:**

**Given** the dashboard is loaded
**When** I press shortcuts
**Then** `g+f` → fleet, `g+s` → sprint, `g+w` → workflow
**And** `n` → next notification, `space` → approve
**And** `?` shows shortcut help modal
**And** no conflicts with browser defaults

### Story 10.4: Hover Preview Tooltips

As a **user**,
I want hover previews for any story/agent reference,
So that I get context without navigating away.

**Acceptance Criteria:**

**Given** any story ID or agent reference in dashboard
**When** I hover over it
**Then** tooltip shows: status, agent, last activity, key metrics
**And** appears within 200ms, dismisses on mouse-out
**And** works consistently across all pages

### Story 10.5: Notification Priority Tiers

As a **user**,
I want notifications in 3 tiers with different visual treatment,
So that critical alerts stand out.

**Acceptance Criteria:**

**Given** the notification system
**When** notifications are generated
**Then** Tier 1 (Red): agent stuck, conflict, decision needed — prominent alert
**And** Tier 2 (Amber): PR ready, scope creep — badge indicator
**And** Tier 3 (Green): story completed, milestone — subtle toast
**And** tier assignment is rule-based and configurable

---

## Epic 12: Project Intelligence & Conversational Interface (STRETCH)

Users can chat with their project to ask questions and receive intelligent answers powered by the artifact graph and event log.

### Story 12.1: Project Context Aggregator

As a **developer**,
I want the system to aggregate artifact graph, event log, and sprint state into coherent context,
So that the conversational interface has complete project knowledge.

**Acceptance Criteria:**

**Given** the artifact scanner and event log
**When** context aggregation runs
**Then** it produces structured summary: phase, artifacts, sprint status, agent states, recent events
**And** summary fits within <8K tokens
**And** updates incrementally as state changes

### Story 12.2: Project Chat Interface

As a **PM**,
I want a chat interface where I can ask questions about my project,
So that I get answers without navigating multiple screens.

**Acceptance Criteria:**

**Given** project context is aggregated
**When** I type "What's blocking sprint progress?"
**Then** system responds with specific, data-backed answers from actual project state
**And** chat maintains conversation history within session
**And** UI is a sidebar panel, not separate page

### Story 12.3: Proactive Project Insights

As a **tech lead**,
I want the chat to proactively surface insights,
So that I discover issues I wouldn't have asked about.

**Acceptance Criteria:**

**Given** a chat session starts
**When** the interface loads
**Then** it shows 2-3 proactive insights: "3 stories blocked by story-001", "Agent-2 stuck 45 min", "Sprint 20% behind"
**And** insights generated from aggregated context, not hardcoded
**And** clicking an insight opens relevant dashboard view
