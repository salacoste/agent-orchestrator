# Product Requirements Document — Cycle 3: AI Agent Intelligence & Tech Debt

**Version:** 1.0
**Date:** 2026-03-18
**Author:** R2d2
**Status:** Draft
**Parent PRD:** [prd.md](./prd.md) (Cycle 1-2, all 175 requirements delivered)
**Related:** [architecture.md](./architecture.md), [ux-design-specification.md](./ux-design-specification.md)

---

## 1. Overview

### 1.1 Purpose

This PRD addendum defines requirements for Planning Cycle 3 of agent-orchestrator. Cycle 3 focuses on two areas:

1. **AI Agent Intelligence** — Making agents smarter through session learning, ML-based assignment, automated code review integration, and multi-agent collaboration
2. **Tech Debt Resolution** — Closing accumulated deferred items from Cycles 1-2 (8 items tracked across 5 epics)

### 1.2 Context

Cycles 1-2 delivered the complete platform foundation:
- 111 stories across 20 epics (all done)
- ~2,760 tests, 0 failures
- 8 plugin slots, 70+ CLI commands, full web dashboard
- Core: spawn → assign → track → resume → notify lifecycle
- Resilience: circuit breaker, DLQ, health monitoring, degraded mode
- Dashboard: fleet matrix, burndown, workflow phases, conflict resolution

**What's missing:** The agents themselves are stateless — they don't learn from past sessions, can't collaborate, and assignment is rule-based (priority queue) rather than intelligent. Code review is manual. These are the next frontier.

### 1.3 Success Criteria

- Agents improve completion rate over time through session learning
- Story assignment considers agent past performance, not just priority
- Code review findings automatically feed back to agent prompts
- Multiple agents can coordinate on dependent stories without conflicts

---

## 2. Functional Requirements

### AI Agent Learning (FR-AI-1 through FR-AI-6)

**FR-AI-1:** System can capture structured session outcomes (success, failure, blocked, duration, key decisions) when agents complete stories
**FR-AI-2:** System can store session learnings in a persistent knowledge base per project (JSONL format, consistent with existing event log pattern)
**FR-AI-3:** System can inject relevant past learnings into agent prompts when spawning for similar stories (via prompt-builder.ts extension)
**FR-AI-4:** System can identify patterns in agent failures (repeated errors, common blockers) and surface them as preventive guidance
**FR-AI-5:** Developers can view agent learning history via `ao agent-history <agent-id>` CLI command
**FR-AI-6:** System can correlate session outcomes with story characteristics (complexity, domain, dependencies) for assignment optimization

### Smart Story Assignment (FR-AI-7 through FR-AI-11)

**FR-AI-7:** System can score agent-story affinity based on past performance on similar stories (domain, complexity, technology)
**FR-AI-8:** System can factor agent success rate, average completion time, and retry count into assignment decisions
**FR-AI-9:** System can recommend optimal agent assignment via `ao assign-suggest <story-id>` showing scored candidates
**FR-AI-10:** System can auto-assign stories to best-fit agents when `auto-assign: smart` is configured (vs. current `auto-assign: priority`)
**FR-AI-11:** Assignment algorithm is pluggable — custom scoring functions can be registered via plugin API

### Automated Code Review Integration (FR-AI-12 through FR-AI-16)

**FR-AI-12:** System can capture code review findings (from `code-review` workflow) in structured format linked to story and agent
**FR-AI-13:** System can inject past review findings into agent prompts to prevent repeat issues ("in previous reviews, this codebase had issues with X")
**FR-AI-14:** System can track review finding categories and measure resolution rate per agent
**FR-AI-15:** Developers can view review analytics via `ao review-stats` showing common issues, resolution rates, agent performance
**FR-AI-16:** System can auto-generate pre-review checklist based on past findings for the story's domain/codebase area

### Agent Collaboration Protocols (FR-AI-17 through FR-AI-21)

**FR-AI-17:** System can detect story dependency chains and schedule dependent stories for sequential agent execution
**FR-AI-18:** System can share context between agents working on related stories (e.g., "Agent A modified file X, Agent B's story depends on X")
**FR-AI-19:** System can implement handoff protocol when one agent completes a prerequisite story — automatically notifying and unblocking the next agent
**FR-AI-20:** System can detect and prevent concurrent modifications to the same files by multiple agents (file-level locking or advisory)
**FR-AI-21:** Developers can view collaboration graph via `ao collab-graph` showing agent dependencies and handoff status

### Tech Debt Resolution (FR-TD-1 through FR-TD-5)

**FR-TD-1:** CLI `ao health` consumes `health:` YAML config section and displays DLQ depth row (deferred 3x from Stories 4-4, 5-5)
**FR-TD-2:** CLI integration tests using `runCliWithTsx` helper for `ao fleet`, `ao burndown`, `ao logs`, `ao events` commands
**FR-TD-3:** Next.js API route testing infrastructure for health, workflow, and session endpoints
**FR-TD-4:** Performance NFR validation — automated benchmarks for stated performance targets (500ms CLI, 100ms API, 2s dashboard)
**FR-TD-5:** Infrastructure documentation — port migration (3000→5000) and zombie prevention documented as completed work

---

## 3. Non-Functional Requirements

### Performance (NFR-AI-P1 through NFR-AI-P3)

**NFR-AI-P1:** Session learning capture adds <50ms to agent completion flow
**NFR-AI-P2:** Smart assignment scoring completes in <200ms for up to 50 story candidates
**NFR-AI-P3:** Learning knowledge base query returns results in <100ms for prompt injection

### Scalability (NFR-AI-SC1 through NFR-AI-SC3)

**NFR-AI-SC1:** Learning knowledge base supports 10,000+ session records per project without degradation
**NFR-AI-SC2:** Collaboration protocol handles 10+ concurrent agents with dependency tracking
**NFR-AI-SC3:** File-level conflict detection works across all git worktrees concurrently

### Data & Storage (NFR-AI-D1 through NFR-AI-D3)

**NFR-AI-D1:** Session learnings stored as JSONL (append-only, consistent with audit trail pattern)
**NFR-AI-D2:** Learning data retained for 90 days by default, configurable via `learning.retentionDays` in YAML
**NFR-AI-D3:** No external ML service dependency — all intelligence runs locally (embeddings optional, rule-based minimum)

### Security (NFR-AI-S1 through NFR-AI-S2)

**NFR-AI-S1:** Session learnings never contain file contents or secrets — only metadata (story ID, duration, outcome, error categories)
**NFR-AI-S2:** Agent collaboration context sharing respects project boundaries — no cross-project learning leakage

---

## 4. Architecture Constraints

### AC-AI-1: Extension of Existing Patterns
All new services must follow established patterns:
- Factory function + impl class (`createXxxService(config)`)
- Optional dependency injection
- JSONL for persistent storage
- Plugin API for extensibility
- Export from `@composio/ao-core` index.ts

### AC-AI-2: No New External Dependencies
Cycle 3 must not add new npm dependencies to core or CLI packages. Web package may add visualization libraries only if under 50KB.

### AC-AI-3: Backward Compatibility
- All new features must be opt-in (config-driven)
- Existing `auto-assign: priority` behavior unchanged
- Prompt builder extension must not break existing prompts
- Learning knowledge base is additive — zero impact when empty

### AC-AI-4: Pluggable Intelligence
- Assignment scoring must use plugin API (`registerAssignmentScorer()`)
- Default scorer is rule-based (no ML required)
- Advanced scorers (embedding-based similarity) are optional plugins

---

## 5. Dependencies on Delivered Platform

| Cycle 3 Feature | Depends On | Status |
|-----------------|-----------|--------|
| Session learning | `completion-handlers.ts`, `agent-completion-detector.ts` | ✅ Delivered (E1, E4) |
| Smart assignment | `assignment-service.ts`, `agent-registry.ts` | ✅ Delivered (E1) |
| Review integration | `code-review` workflow, story file format | ✅ Delivered (BMAD) |
| Collaboration | `dependency-resolver.ts`, `event-publisher.ts` | ✅ Delivered (E2) |
| Tech debt: health CLI | `health-check.ts`, `config.ts` health schema | ✅ Delivered (E4) |
| Tech debt: CLI tests | `runCliWithTsx` helper, fleet/burndown/logs/events | ✅ Delivered (E5) |

---

## 6. Out of Scope (Cycle 3)

- Multi-node deployment / Kubernetes runtime
- External ML service integration (GPT-based scoring)
- Agent cost tracking / budget management
- Mobile-responsive dashboard redesign
- Multi-tenant support

---

## 7. Requirements Traceability

### Link to Parent PRD
This document extends [prd.md](./prd.md) which defined FR1-FR50 and NFR-P1 through NFR-R10. All 175 original requirements are delivered.

### New Requirements Summary
| Category | Count | Range |
|----------|-------|-------|
| AI Functional | 21 | FR-AI-1 through FR-AI-21 |
| Tech Debt Functional | 5 | FR-TD-1 through FR-TD-5 |
| Non-Functional | 8 | NFR-AI-P1 through NFR-AI-S2 |
| Architecture Constraints | 4 | AC-AI-1 through AC-AI-4 |
| **Total New** | **38** | — |

### Cross-Reference with Retrospectives
| Retro Item | Addressed By |
|-----------|-------------|
| CLI health config (3x deferred) | FR-TD-1 |
| CLI integration tests | FR-TD-2 |
| Performance NFR validation | FR-TD-4 |
| Code review discipline | FR-AI-12 through FR-AI-16 |
| Story splitting guidance | AC-AI-1 (established patterns) |
| Infrastructure documentation | FR-TD-5 |
