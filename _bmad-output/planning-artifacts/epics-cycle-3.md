---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
workflowStatus: complete
completedAt: '2026-03-18'
inputDocuments:
  - _bmad-output/planning-artifacts/prd-cycle-3-ai-intelligence.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/implementation-artifacts/final-project-retrospective-cycle-2.md
  - _bmad-output/implementation-artifacts/epic-4-retrospective.md
  - _bmad-output/implementation-artifacts/epic-5-retrospective.md
---

# Agent Orchestrator — Cycle 3 Epic Breakdown: AI Agent Intelligence & Tech Debt

## Overview

This document provides the epic and story breakdown for Planning Cycle 3 of agent-orchestrator. Cycle 3 builds on the fully delivered Cycles 1-2 (111 stories, 20 epics, ~2,760 tests) to add AI intelligence capabilities and resolve accumulated tech debt.

**Parent Epics Document:** [epics.md](./epics.md) (Cycles 1-2, all 45 stories done)
**Source PRD:** [prd-cycle-3-ai-intelligence.md](./prd-cycle-3-ai-intelligence.md)

## Requirements Inventory

### Functional Requirements

**AI Agent Learning (FR-AI-1 through FR-AI-6):**
FR-AI-1: System can capture structured session outcomes (success, failure, blocked, duration, key decisions) when agents complete stories
FR-AI-2: System can store session learnings in a persistent knowledge base per project (JSONL format, consistent with existing event log pattern)
FR-AI-3: System can inject relevant past learnings into agent prompts when spawning for similar stories (via prompt-builder.ts extension)
FR-AI-4: System can identify patterns in agent failures (repeated errors, common blockers) and surface them as preventive guidance
FR-AI-5: Developers can view agent learning history via `ao agent-history <agent-id>` CLI command
FR-AI-6: System can correlate session outcomes with story characteristics (complexity, domain, dependencies) for assignment optimization

**Smart Story Assignment (FR-AI-7 through FR-AI-11):**
FR-AI-7: System can score agent-story affinity based on past performance on similar stories (domain, complexity, technology)
FR-AI-8: System can factor agent success rate, average completion time, and retry count into assignment decisions
FR-AI-9: System can recommend optimal agent assignment via `ao assign-suggest <story-id>` showing scored candidates
FR-AI-10: System can auto-assign stories to best-fit agents when `auto-assign: smart` is configured (vs. current `auto-assign: priority`)
FR-AI-11: Assignment algorithm is pluggable — custom scoring functions can be registered via plugin API

**Automated Code Review Integration (FR-AI-12 through FR-AI-16):**
FR-AI-12: System can capture code review findings (from `code-review` workflow) in structured format linked to story and agent
FR-AI-13: System can inject past review findings into agent prompts to prevent repeat issues
FR-AI-14: System can track review finding categories and measure resolution rate per agent
FR-AI-15: Developers can view review analytics via `ao review-stats` showing common issues, resolution rates, agent performance
FR-AI-16: System can auto-generate pre-review checklist based on past findings for the story's domain/codebase area

**Agent Collaboration Protocols (FR-AI-17 through FR-AI-21):**
FR-AI-17: System can detect story dependency chains and schedule dependent stories for sequential agent execution
FR-AI-18: System can share context between agents working on related stories
FR-AI-19: System can implement handoff protocol when one agent completes a prerequisite story — automatically notifying and unblocking the next agent
FR-AI-20: System can detect and prevent concurrent modifications to the same files by multiple agents (file-level locking or advisory)
FR-AI-21: Developers can view collaboration graph via `ao collab-graph` showing agent dependencies and handoff status

**Tech Debt Resolution (FR-TD-1 through FR-TD-5):**
FR-TD-1: CLI `ao health` consumes `health:` YAML config section and displays DLQ depth row (deferred 3x from Stories 4-4, 5-5)
FR-TD-2: CLI integration tests using `runCliWithTsx` helper for `ao fleet`, `ao burndown`, `ao logs`, `ao events` commands
FR-TD-3: Next.js API route testing infrastructure for health, workflow, and session endpoints
FR-TD-4: Performance NFR validation — automated benchmarks for stated performance targets (500ms CLI, 100ms API, 2s dashboard)
FR-TD-5: Infrastructure documentation — port migration (3000→5000) and zombie prevention documented as completed work

### Non-Functional Requirements

**Performance (NFR-AI-P1 through NFR-AI-P3):**
NFR-AI-P1: Session learning capture adds <50ms to agent completion flow
NFR-AI-P2: Smart assignment scoring completes in <200ms for up to 50 story candidates
NFR-AI-P3: Learning knowledge base query returns results in <100ms for prompt injection

**Scalability (NFR-AI-SC1 through NFR-AI-SC3):**
NFR-AI-SC1: Learning knowledge base supports 10,000+ session records per project without degradation
NFR-AI-SC2: Collaboration protocol handles 10+ concurrent agents with dependency tracking
NFR-AI-SC3: File-level conflict detection works across all git worktrees concurrently

**Data & Storage (NFR-AI-D1 through NFR-AI-D3):**
NFR-AI-D1: Session learnings stored as JSONL (append-only, consistent with audit trail pattern)
NFR-AI-D2: Learning data retained for 90 days by default, configurable via `learning.retentionDays` in YAML
NFR-AI-D3: No external ML service dependency — all intelligence runs locally (rule-based minimum)

**Security (NFR-AI-S1 through NFR-AI-S2):**
NFR-AI-S1: Session learnings never contain file contents or secrets — only metadata
NFR-AI-S2: Agent collaboration context sharing respects project boundaries — no cross-project leakage

### Additional Requirements

**From Architecture (AC-AI-1 through AC-AI-4):**
- AC-AI-1: All services follow factory + impl class pattern, JSONL storage, plugin API extensibility
- AC-AI-2: No new npm dependencies in core or CLI packages
- AC-AI-3: All features opt-in (backward compatible), zero impact when unconfigured
- AC-AI-4: Assignment scoring pluggable via `registerAssignmentScorer()` plugin API

**From Retrospectives:**
- Code review gate must be enforced (100% review rate)
- Stories with 7+ tasks should be split across packages
- Integration testing should be explicit stories, not deferred
- Performance validation should be first-class

### CLI UX Patterns for New Commands

All Cycle 3 CLI commands follow the established UX1 visual patterns from the UX Design Specification. The table below specifies the output format for each new command:

| Command | Primary Output | Table Columns | Flags | Empty State |
|---------|---------------|---------------|-------|-------------|
| `ao agent-history <id>` | htop-style table | Story ID, Outcome (🟢/🔴/🟡), Duration, Domain, Date | `--json`, `--since <window>` | "No learning history for agent \<id\>" |
| `ao assign-suggest <id>` | Ranked table with highlight | Agent ID, Score, Domain Match, Success Rate, Recommendation | `--json` | "No agents with scoring data available" |
| `ao review-stats` | Multi-section: severity bars + category table + agent table | Severity, Category, Count, Resolution Rate, Agent Performance | `--json`, `--since <window>` | "No review findings recorded" |
| `ao collab-graph` | Default: dependency table. `--graph`: ASCII diagram | Agent, Status (🟢/🟡/🔴), Waiting On, Duration | `--json`, `--graph` | "No active agent dependencies" |
| `ao learning-patterns` | htop-style table | Pattern, Occurrences, Last Seen, Suggested Action | `--json` | "No recurring failure patterns detected" |

**Shared conventions (from UX1):**
- Color-coded status: 🟢 success/working, 🟡 warning/idle, 🔴 error/blocked
- All commands complete within 500ms (NFR-P8)
- All commands support `--json` for machine-readable output
- Error messages include actionable next steps
- Empty states are informative, not blank

### FR Coverage Map

| FR Range | Epic | Domain |
|----------|------|--------|
| FR-TD-1 through FR-TD-5 | Epic 10 | Tech Debt & Testing |
| FR-AI-1, FR-AI-2, FR-AI-5, FR-AI-6 | Epic 11 | Learning Infrastructure |
| FR-AI-3, FR-AI-4 | Epic 12 | Learning Intelligence |
| FR-AI-7, FR-AI-8, FR-AI-9, FR-AI-10, FR-AI-11 | Epic 13 | Smart Assignment |
| FR-AI-12, FR-AI-13, FR-AI-14, FR-AI-15, FR-AI-16 | Epic 14 | Code Review Intelligence |
| FR-AI-17, FR-AI-18, FR-AI-19, FR-AI-20, FR-AI-21 | Epic 15 | Multi-Agent Collaboration |

**Coverage: 26/26 unique FRs mapped (100%)**

## Epic List

| Epic | Title | FRs | Stories (est.) | Risk |
|------|-------|-----|----------------|------|
| **10** | Tech Debt & Testing Infrastructure | 5 (FR-TD-1..5) | 4 | LOW |
| **11** | Agent Session Learning — Infrastructure | 4 (FR-AI-1,2,5,6) | 4 | LOW |
| **12** | Agent Session Learning — Intelligence | 2 (FR-AI-3,4) | 4 | MEDIUM |
| **13** | Smart Story Assignment | 5 (FR-AI-7..11) | 4 | MEDIUM |
| **14** | Code Review Intelligence | 5 (FR-AI-12..16) | 4 | LOW |
| **15** | Multi-Agent Collaboration | 5 (FR-AI-17..21) | 5 | HIGH |

### Dependency Flow

```
Epic 10 (Tech Debt) ─── standalone (no dependencies, run first)

Epic 11 (Learning Infra) ──┬──► Epic 12 (Learning Intelligence)
                           ├──► Epic 13 (Smart Assignment)
                           ├──► Epic 14 (Code Review Intelligence)
                           └──► Epic 15 (Collaboration)
```

**Parallelization:** Epics 12, 13, 14, 15 are fully independent after Epic 11. Maximum parallelism possible.

---

## Epic 10: Tech Debt & Testing Infrastructure

**Epic Goal:** Developers and DevOps Engineers can trust that `ao health` reflects their configured thresholds, that CLI commands behave correctly end-to-end, that API contracts are validated, and that the platform meets its stated performance promises — eliminating uncertainty about platform reliability before building intelligence features on top.

**FRs Covered:** FR-TD-1, FR-TD-2, FR-TD-3, FR-TD-4, FR-TD-5

---

### Story 10.1: CLI Health Config & DLQ Display

As a DevOps Engineer,
I want `ao health` to load thresholds from the `health:` YAML config section and display DLQ depth,
so that health monitoring reflects my configured thresholds without code changes.

**Acceptance Criteria:**

**Given** `agent-orchestrator.yaml` has a `health:` section with `thresholds.maxLatencyMs: 500`
**When** I run `ao health`
**Then** the health check uses 500ms latency threshold instead of the default 1000ms
**And** DLQ depth appears as a "Dead Letter Queue" row in the health table
**And** missing `health:` section falls back to default thresholds (backward compatible)

**Requirements:** FR-TD-1
**Extends:** `cli/src/commands/health.ts`, `core/src/types.ts`

---

### Story 10.2: CLI Integration Tests

As a Developer,
I want end-to-end integration tests for `ao fleet`, `ao burndown`, `ao logs`, and `ao events` using `runCliWithTsx`,
so that the full Commander → config → data → output pipeline is validated.

**Acceptance Criteria:**

**Given** a temporary environment with `agent-orchestrator.yaml` and mock session data
**When** `runCliWithTsx(["fleet"])` is executed
**Then** the process exits with code 0 and stdout contains the fleet table headers
**And** `runCliWithTsx(["burndown", "test-project"])` renders burndown output
**And** `runCliWithTsx(["logs"])` handles empty agent list gracefully
**And** `runCliWithTsx(["events", "query"])` handles empty audit trail gracefully

**Requirements:** FR-TD-2
**Extends:** `cli/__tests__/integration/`

---

### Story 10.3: API Route Testing Infrastructure

As a Developer,
I want unit tests for the Next.js API routes (`/api/health`, `/api/workflow/[project]`, `/api/sessions`),
so that API contracts are validated without running a full server.

**Acceptance Criteria:**

**Given** mock services (config, sessions, workflow scanner)
**When** `GET /api/health` is called
**Then** response is HTTP 200 with JSON containing `overall`, `components`, `timestamp`
**And** `GET /api/workflow/test-project` returns workflow phases
**And** `GET /api/sessions` returns session list with stats
**And** all routes return HTTP 200 even on error (WD-FR31 pattern)

**Requirements:** FR-TD-3
**Creates:** `web/src/app/api/health/route.test.ts`, `web/src/app/api/sessions/route.test.ts`

---

### Story 10.4: Performance Benchmarks & Documentation

As a Tech Lead,
I want automated performance benchmarks that validate stated NFR targets,
so that I know the platform meets its performance promises.

**Acceptance Criteria:**

**Given** a test environment with mock data (50 sessions, 1000 events, 100 stories)
**When** performance benchmarks run
**Then** CLI commands complete within 500ms (NFR-P8)
**And** API routes respond within 100ms (WD-NFR-P1)
**And** health check completes within 200ms
**And** results are logged as a benchmark report
**And** port migration (3000→5000) and zombie prevention are documented in CHANGELOG

**Requirements:** FR-TD-4, FR-TD-5

---

**Epic 10 Summary:** 4 stories. All low-risk, well-scoped, patterns known. Closes all Cycle 1-2 deferred items.

---

## Epic 11: Agent Session Learning — Infrastructure

**Epic Goal:** The system captures structured session outcomes when agents complete stories and stores them in a queryable knowledge base, enabling developers to review agent learning history.

**FRs Covered:** FR-AI-1, FR-AI-2, FR-AI-5, FR-AI-6
**NFRs:** NFR-AI-P1, NFR-AI-SC1, NFR-AI-D1, NFR-AI-D2, NFR-AI-D3, NFR-AI-S1

---

### Story 11.1: Session Outcome Capture

As a Developer,
I want the system to automatically capture structured session outcomes when agents complete stories,
so that learning data accumulates without manual effort.

**Acceptance Criteria:**

**Given** an agent completes a story (via completion-handlers.ts)
**When** the completion handler fires
**Then** a `SessionLearning` record is created with: sessionId, agentId, storyId, projectId, outcome, durationMs, retryCount, filesModified, testsAdded, errorCategories
**And** the capture adds <50ms to the completion flow (NFR-AI-P1)
**And** no file contents or secrets are included (NFR-AI-S1)
**And** domain tags are inferred from modified file extensions (`.tsx`=frontend, `.test.ts`=testing, `route.ts`=API)

**Requirements:** FR-AI-1, FR-AI-6
**Extends:** `core/src/completion-handlers.ts`
**Creates:** `core/src/session-learning.ts`

---

### Story 11.2: Learning Knowledge Base (JSONL Storage)

As a Developer,
I want session learnings stored in a persistent JSONL file per project,
so that learning data survives restarts and is queryable.

**Acceptance Criteria:**

**Given** a session learning record is captured
**When** it is persisted
**Then** it is appended to `{sessionsDir}/learnings.jsonl`
**And** the file supports 10,000+ records without degradation (NFR-AI-SC1)
**And** rotation occurs at 10MB (consistent with DLQ/audit trail pattern)
**And** retention defaults to 90 days, configurable via `learning.retentionDays` (NFR-AI-D2)
**And** no external ML service is required (NFR-AI-D3)

**Requirements:** FR-AI-2
**Creates:** `core/src/learning-store.ts`

---

### Story 11.3: Learning Query API

As a Developer,
I want to query the learning knowledge base by agent, project, domain, and time range,
so that intelligence layers can consume relevant learnings.

**Acceptance Criteria:**

**Given** a knowledge base with 100+ records
**When** `learningStore.query({ agentId, domain: "frontend", limit: 10 })` is called
**Then** it returns matching records sorted by timestamp descending
**And** query completes in <100ms (NFR-AI-P3)
**And** supports filters: agentId, domain, outcome, since, limit
**And** exported from `@composio/ao-core`

**Requirements:** FR-AI-2, FR-AI-6
**Extends:** `core/src/learning-store.ts`, `core/src/index.ts`

---

### Story 11.4: `ao agent-history` CLI Command

As a Developer,
I want to view an agent's learning history from the CLI,
so that I can understand agent performance patterns.

**Acceptance Criteria:**

**Given** an agent has completed 5 stories
**When** I run `ao agent-history <agent-id>`
**Then** a table shows: Story ID, Outcome (🟢/🔴/🟡), Duration, Domain, Date
**And** `--json` outputs raw records
**And** `--since 7d` filters by time window
**And** agent not found shows error with list of known agents

**Requirements:** FR-AI-5
**Creates:** `cli/src/commands/agent-history.ts`

---

**Epic 11 Summary:** 4 stories. Low risk — follows JSONL + CLI patterns. Foundation for Epics 12-15.

---

## Epic 12: Agent Session Learning — Intelligence

**Epic Goal:** Past session learnings are injected into agent prompts to prevent repeat failures, and pattern detection surfaces preventive guidance.

**FRs Covered:** FR-AI-3, FR-AI-4
**Depends on:** Epic 11

---

### Story 12.1: Prompt Learning Injection

As a Developer,
I want relevant past learnings injected into agent prompts when spawning,
so that agents avoid repeating past mistakes.

**Acceptance Criteria:**

**Given** a learning store with 3 failed frontend stories
**When** a new frontend story is spawned
**Then** the prompt includes up to 3 relevant failed learnings (domain match → recency → failure priority)
**And** empty store = no injection (zero impact on existing prompts)
**And** opt-in via `learning.injectInPrompts: true` config

**Requirements:** FR-AI-3
**Extends:** `core/src/prompt-builder.ts`

---

### Story 12.2: Failure Pattern Detection

As a Tech Lead,
I want the system to identify recurring failure patterns,
so that I can address systemic issues.

**Acceptance Criteria:**

**Given** 20+ session records
**When** `detectPatterns(projectId)` is called
**Then** it returns patterns with 3+ occurrences: category, count, affectedStories, suggestedAction
**And** runs in <200ms for 1000 records

**Requirements:** FR-AI-4
**Creates:** `core/src/learning-patterns.ts`

---

### Story 12.3: `ao learning-patterns` CLI Command

As a Tech Lead,
I want to view detected failure patterns from the CLI.

**Acceptance Criteria:**

**Given** 3 recurring patterns detected
**When** I run `ao learning-patterns`
**Then** table shows: Pattern, Occurrences, Last Seen, Suggested Action
**And** `--json` outputs raw data
**And** no patterns = "No recurring failure patterns detected"

**Requirements:** FR-AI-4
**Creates:** `cli/src/commands/learning-patterns.ts`

---

### Story 12.4: Learning Dashboard Panel

As a Tech Lead,
I want learning insights in the web dashboard.

**Acceptance Criteria:**

**Given** 50+ learning records
**When** viewing dashboard
**Then** "Learning Insights" panel shows: total sessions, success rate trend, top patterns, most improved agent
**And** `GET /api/learning/[project]` returns summary
**And** empty data = graceful empty state (LKG pattern)

**Requirements:** FR-AI-3, FR-AI-4
**Creates:** `web/src/components/LearningInsightsPanel.tsx`, `web/src/app/api/learning/[project]/route.ts`

---

**Epic 12 Summary:** 4 stories. Medium risk — prompt injection needs careful testing.

---

## Epic 13: Smart Story Assignment

**Epic Goal:** Stories are assigned to best-fit agents based on performance scoring, with CLI recommendations and pluggable algorithm.

**FRs Covered:** FR-AI-7, FR-AI-8, FR-AI-9, FR-AI-10, FR-AI-11
**Depends on:** Epic 11

---

### Story 13.1: Agent-Story Affinity Scoring

As a Developer,
I want the system to score agent-story affinity from past performance.

**Acceptance Criteria:**

**Given** agent with 5 completed frontend stories, 2 failed API stories
**When** `scoreAffinity(agentId, storyId)` called for frontend story
**Then** score = successRate(40%) + domainMatch(30%) + speedFactor(20%) + retryPenalty(-10%)
**And** <200ms for 50 candidates (NFR-AI-P2)
**And** no history = neutral score (0.5)
**And** scoring function exported for plugin override (AC-AI-4)

**Requirements:** FR-AI-7, FR-AI-8
**Creates:** `core/src/assignment-scorer.ts`

---

### Story 13.2: `ao assign-suggest` CLI Command

As a Developer,
I want scored agent recommendations for a story.

**Acceptance Criteria:**

**Given** 3 agents with varying histories
**When** `ao assign-suggest <story-id>`
**Then** ranked table: Agent ID, Score, Domain Match, Success Rate, Recommendation
**And** top agent highlighted as "Recommended"
**And** `--json` outputs raw scores

**Requirements:** FR-AI-9
**Creates:** `cli/src/commands/assign-suggest.ts`

---

### Story 13.3: Smart Auto-Assignment Mode

As a Tech Lead,
I want `auto-assign: smart` config for data-driven assignment.

**Acceptance Criteria:**

**Given** `autoAssign: smart` in config
**When** agent becomes idle
**Then** system uses affinity scoring for best match
**And** `autoAssign: priority` unchanged (backward compatible)
**And** no learning data = fallback to priority

**Requirements:** FR-AI-10
**Extends:** `core/src/assignment-service.ts`, `core/src/config.ts`

---

### Story 13.4: Pluggable Assignment Scorer API

As a Plugin Developer,
I want to register custom scoring functions.

**Acceptance Criteria:**

**Given** plugin implements custom scorer
**When** `registerAssignmentScorer(name, fn)` called
**Then** custom scorer used instead of default
**And** `clearAssignmentScorers()` resets (for testing)
**And** follows `registerReplayHandler()` pattern
**And** exported from `@composio/ao-core`

**Requirements:** FR-AI-11
**Extends:** `core/src/assignment-scorer.ts`, `core/src/index.ts`

---

**Epic 13 Summary:** 4 stories. Medium risk — scoring algorithm deterministic but needs tuning.

---

## Epic 14: Code Review Intelligence

**Epic Goal:** Review findings captured, analyzed, and fed back to agents. Developers get analytics.

**FRs Covered:** FR-AI-12, FR-AI-13, FR-AI-14, FR-AI-15, FR-AI-16
**Depends on:** Epic 11

---

### Story 14.1: Structured Review Findings Capture

As a Developer,
I want review findings captured in structured format.

**Acceptance Criteria:**

**Given** code review completed
**When** findings generated
**Then** each stored with: storyId, agentId, severity, category, description, file, resolution
**And** appended to `review-findings.jsonl`
**And** session learning updated with findingsCount

**Requirements:** FR-AI-12, FR-AI-14
**Creates:** `core/src/review-findings-store.ts`

---

### Story 14.2: Review Findings Prompt Injection

As a Developer,
I want past findings injected into prompts for same codebase area.

**Acceptance Criteria:**

**Given** 5 past findings for frontend (category: "type-safety")
**When** new frontend story spawned
**Then** prompt includes top 5 relevant findings
**And** filtered by domain relevance
**And** opt-in via `review.injectFindings: true`

**Requirements:** FR-AI-13
**Extends:** `core/src/prompt-builder.ts`

---

### Story 14.3: `ao review-stats` CLI Command

As a Tech Lead,
I want review analytics from the CLI.

**Acceptance Criteria:**

**Given** 30 findings across 10 stories
**When** `ao review-stats`
**Then** shows: severity bars, top categories, resolution rate, agent performance
**And** `--since 30d`, `--json` supported

**Requirements:** FR-AI-15
**Creates:** `cli/src/commands/review-stats.ts`

---

### Story 14.4: Auto-Generated Pre-Review Checklist

As a Code Reviewer,
I want auto-checklist based on past findings.

**Acceptance Criteria:**

**Given** past: type-safety(5x), input-guards(3x), test-cleanup(2x) for frontend
**When** new frontend story enters review
**Then** checklist generated: "☐ type safety (5) ☐ input guards (3) ☐ test cleanup (2)"
**And** appended to story file
**And** no past findings = no checklist

**Requirements:** FR-AI-16
**Creates:** `core/src/review-checklist-generator.ts`

---

**Epic 14 Summary:** 4 stories. Low risk — structured data + analytics.

---

## Epic 15: Multi-Agent Collaboration

**Epic Goal:** Multiple agents work on dependent stories safely with handoffs, context sharing, and file conflict prevention.

**FRs Covered:** FR-AI-17, FR-AI-18, FR-AI-19, FR-AI-20, FR-AI-21
**Depends on:** Epic 11

---

### Story 15.1: Dependency-Aware Story Scheduling

As a Tech Lead,
I want dependency chains detected and agents scheduled sequentially.

**Acceptance Criteria:**

**Given** chain A → B → C
**When** all queued
**Then** only A assigned; B waits on A; C waits on B
**And** A completes → B auto-unblocked
**And** handles diamond deps (A→C, B→C)
**And** supports 10+ concurrent agents (NFR-AI-SC2)

**Requirements:** FR-AI-17
**Extends:** `core/src/dependency-resolver.ts`, `core/src/assignment-service.ts`

---

### Story 15.2: Cross-Agent Context Sharing

As a Developer,
I want agents on related stories to receive context about other agents' changes.

**Acceptance Criteria:**

**Given** Agent A modified `health-check.ts` in Story 1
**When** Agent B spawned for dependent Story 2
**Then** prompt includes: "Agent A modified health-check.ts (added DLQ check)"
**And** respects project boundaries (NFR-AI-S2)

**Requirements:** FR-AI-18
**Extends:** `core/src/prompt-builder.ts`, `core/src/session-learning.ts`

---

### Story 15.3: Agent Handoff Protocol

As a Developer,
I want automatic handoffs when prerequisites complete.

**Acceptance Criteria:**

**Given** Agent A completes prerequisite Story 1
**When** completion detected
**Then** Story 2 auto-unblocked and queued
**And** next agent receives handoff context
**And** `story.handoff` event published
**And** notification sent to developer

**Requirements:** FR-AI-19
**Extends:** `core/src/completion-handlers.ts`, `core/src/event-publisher.ts`

---

### Story 15.4: File-Level Conflict Prevention

As a Developer,
I want concurrent file modifications detected and prevented.

**Acceptance Criteria:**

**Given** Agent A modifying `types.ts`
**When** Agent B about to spawn for story also modifying `types.ts`
**Then** warning: "File conflict: types.ts modified by Agent A"
**And** assignment delayed until Agent A completes (or `--force` override)
**And** works across git worktrees (NFR-AI-SC3)
**And** advisory locking (git-based)

**Requirements:** FR-AI-20
**Creates:** `core/src/file-conflict-detector.ts`

---

### Story 15.5: `ao collab-graph` CLI Command

As a Tech Lead,
I want to view collaboration graph showing dependencies and handoff status.

**Acceptance Criteria:**

**Given** 3 agents with dependencies
**When** `ao collab-graph`
**Then** default: table showing agent dependencies (Agent | Status | Waiting On | Duration)
**And** `--graph` flag renders ASCII dependency diagram (recommended for <6 agents)
**And** waiting agents show: "Waiting on Agent A — Story 1 (in progress 2h 15m)"
**And** `--json` outputs structured data
**And** no deps = "No active agent dependencies"

**Requirements:** FR-AI-21
**Creates:** `cli/src/commands/collab-graph.ts`

---

**Epic 15 Summary:** 5 stories. HIGH risk — file conflict detection across worktrees is complex. Capstone epic.

---

## Grand Summary

| Epic | Title | Stories | FRs | Risk |
|------|-------|---------|-----|------|
| **10** | Tech Debt & Testing | 4 | FR-TD-1..5 | LOW |
| **11** | Learning Infrastructure | 4 | FR-AI-1,2,5,6 | LOW |
| **12** | Learning Intelligence | 4 | FR-AI-3,4 | MEDIUM |
| **13** | Smart Assignment | 4 | FR-AI-7..11 | MEDIUM |
| **14** | Code Review Intelligence | 4 | FR-AI-12..16 | LOW |
| **15** | Multi-Agent Collaboration | 5 | FR-AI-17..21 | HIGH |
| **Total** | | **25** | **26 FRs (100%)** | |

**Coverage:** 26/26 FRs mapped, 8 NFRs addressed, 4 architecture constraints enforced.
