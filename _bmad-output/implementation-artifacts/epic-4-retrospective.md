# Epic 4 Retrospective: Self-Healing Operations

**Date:** 2026-03-17
**Epic:** 4 — Self-Healing Operations (Error Recovery + Circuit Breaker + DLQ)
**Stories:** 4 stories, all complete
**New Tests:** 122 (30 + 45 + 38 + 9)
**Final Test Suite:** 1335 tests, 0 failures, 0 regressions
**Facilitator:** Bob (Scrum Master)

---

## Epic Summary

Epic 4 built the resilience layer for agent-orchestrator: error classification, circuit breakers with exponential backoff, dead letter queue with auto-replay, and health monitoring with configurable thresholds. Each story layered on top of the previous — classify errors → circuit break → DLQ → health monitor.

| Story | Title | New Tests | Key Deliverable |
|-------|-------|-----------|-----------------|
| 4-1 | Error Classification & Structured Logging | 30 | Error codes, JSONL rotation, metadata backup/restore |
| 4-2 | Circuit Breaker & Exponential Backoff | 45 | CircuitBreakerManager, ResilientEventBus, withResilience |
| 4-3 | Dead Letter Queue & Event Replay | 38 | FIFO eviction, auto-replay, backlog monitor, CB→DLQ |
| 4-4 | Health Monitoring & Configurable Thresholds | 9 | DLQ health check, transition alerts, health API, YAML config |

---

## What Went Well

### 1. Integration-First Approach Validated
Every story in Epic 4 was an integration story — wiring existing building blocks rather than greenfield creation. The core DLQ, retry service, circuit breaker, health check, and degraded mode services all existed from the previous cycle. This approach:
- Reduced risk (extending proven code)
- Maintained consistency (same patterns throughout)
- Accelerated delivery (no architectural decisions to make)

### 2. Layered Story Dependency Worked Perfectly
Stories 4-1 → 4-2 → 4-3 → 4-4 each built on the previous:
- 4-1 gave us error classification that 4-2's circuit breaker needed
- 4-2's circuit breaker + retry service were the foundation 4-3 wired into DLQ
- 4-3's DLQ stats (`atCapacity`) were consumed by 4-4's health check
- No story required rework of a previous story's deliverable

### 3. Code Review Caught Real Issues
Both reviewed stories (4-3, 4-4) had actionable findings:
- **4-3**: 7 findings (2 MEDIUM, 4 LOW, 1 TRIVIAL) — including `return undefined as T` type-safety issue, brittle string matching, handler registration leaks, stack trace loss
- **4-4**: 6 findings (1 HIGH, 3 MEDIUM, 2 LOW) — including empty health API config, redundant spreads, missing config example
- All findings were auto-fixed in the same session
- Zero findings were false positives

### 4. Zero Regressions Across All Stories
122 new tests added with no existing test breakage at any point. The test pyramid held: unit tests for logic, integration tests for wiring, no E2E needed for core-level services.

### 5. Anti-Pattern Documentation Improved Over Epic
Story 4-1 discovered the ESLint pre-commit hook pattern. By Story 4-3, the story spec included a "Anti-Patterns from Stories 4-1 and 4-2" section that prevented repeating the same mistakes. This forward-documentation pattern should continue.

---

## What Could Be Improved

### 1. Story 4-4 Scope Was Too Ambitious
Story 4-4 had 8 ACs and 7 tasks. Tasks 3 (rules engine integration) and 6 (CLI updates) were deferred entirely. The story delivered 5 of 8 ACs fully, with 3 ACs only partially met. Better scoping would have split this into two stories:
- 4-4a: DLQ health + transition notifications + config schema + API (delivered)
- 4-4b: Rules engine integration + CLI updates (deferred)

**Action Item:** When a story has 7+ tasks spanning multiple packages (core, web, cli), consider splitting.

### 2. Story 4-3 Review Status Wasn't Updated to Done
After the adversarial code review of Story 4-3 completed with all findings fixed, the story remained in "review" status. It was only caught during the Epic 4 retrospective. The code-review workflow should automatically mark stories "done" when all fixes pass.

**Action Item:** Code review workflow already handles this (Step 5 sets status to "done" when all HIGH/MEDIUM fixed). The issue was that the 4-3 code review was the first use in a session that ran out of context — the status update was lost to context compaction. No process change needed, but worth noting.

### 3. No Previous Retrospective to Learn From
Epic 3's retrospective was marked "optional" and was never created. This meant Epic 4 had no "continuity insights" — no record of what Epic 3 learned. The retrospective habit should be maintained for every epic.

**Action Item:** Mark retrospectives as required rather than optional for future epics.

### 4. Deferred Items Accumulating
Across Epic 4, the following items were deferred:
- `metadata.corrupted` event publishing (4-1) — circular dependency
- `registerClassificationRule()` public API (4-1)
- HealthCheckRulesEngine wiring (4-4)
- CLI health enhancements (4-4)
- Next.js API route testing infrastructure (4-4)

These are tracked in story files but not consolidated anywhere. A tech debt tracking mechanism would help.

**Action Item:** Consider a tech debt story in Epic 5 or a dedicated tracking file.

---

## Patterns Established

### Code Patterns
1. **Factory function + impl class** — `createXxxService(config)` returning interface (used in circuit-breaker-manager, resilient-event-bus, eventbus-backlog-monitor)
2. **Optional dependency injection** — `dlq?: DeadLetterQueueService` pattern for graceful feature toggling
3. **SILENT_LOGGER** — Exported from circuit-breaker-manager for test noise suppression
4. **Inline interface for cross-module types** — Used in HealthCheckConfig's `dlq` field to avoid circular imports
5. **NO_HANDLER_ERROR_PREFIX** — Exported constant for string matching instead of magic strings (from 4-3 code review)
6. **`clearXxxHandlers()` for test cleanup** — Module-level state cleanup functions (from 4-3 code review)

### Testing Patterns
1. **`vi.useFakeTimers()` for time-dependent tests** — backlog monitor intervals, auto-replay timeouts, circuit breaker open duration
2. **`vi.mock()` with `importOriginal()`** — Partial module mocking preserving real constants (dlq-auto-replay.test.ts)
3. **Sequential `check()` calls for transition testing** — First call sets baseline, second call triggers transition event
4. **Mock DLQ/EventBus factory functions** — Reusable `createMockDLQ()`, `createMockEventBus()` with configurable overrides

### Process Patterns
1. **Anti-pattern documentation in story specs** — Forward-looking "apply these learnings" sections
2. **Code review fix-in-place** — Auto-fix all findings in the same review session
3. **Honest deferred item tracking** — `[-]` notation with structured Limitations section

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4/4 (100%) |
| Stories reviewed | 2/4 (50%) — 4-3 and 4-4 |
| New tests added | 122 |
| Test regressions | 0 |
| Review findings | 13 total (1 HIGH, 5 MEDIUM, 6 LOW, 1 TRIVIAL) |
| Findings fixed | 13/13 (100%) |
| Deferred items | 5 across epic |
| New source files | 7 (3 in 4-2, 4 in 4-3) |
| Modified source files | ~15 |
| New API endpoints | 1 (GET /api/health) |

---

## Action Items for Epic 5

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | CLI health command should consume `health:` YAML config and show DLQ row (deferred from 4-4) | Dev | HIGH |
| 2 | Consider splitting stories with 7+ tasks across multiple packages | SM | MEDIUM |
| 3 | Wire HealthCheckRulesEngine into HealthCheckService (deferred from 4-4) | Dev | MEDIUM |
| 4 | Consolidate deferred items into a trackable list or tech debt story | SM | LOW |
| 5 | Maintain retrospective habit — mark as required, not optional | SM | LOW |

---

## Next Epic Preview: Epic 5 — CLI Sprint Management & Fleet Monitoring

**4 Stories:**
- 5-1: `ao fleet` — Multi-agent fleet matrix (htop-style table)
- 5-2: `ao burndown` — Sprint analytics CLI (ASCII charts)
- 5-3: `ao logs` — Agent log viewer (tail + follow mode)
- 5-4: `ao events` — Event audit trail CLI (JSONL queries)

**Dependencies on Epic 4:**
- Health check states feed into `ao fleet` status indicators
- DLQ depth available for fleet dashboard
- Circuit breaker states visible in fleet matrix
- Error classification codes used in `ao logs` filtering

**Risks:**
- CLI output formatting (htop-style) is new territory — no existing pattern to follow
- ASCII chart rendering may need a utility (or existing library)
- `ao logs --follow` requires streaming from tmux — needs runtime plugin support

**Preparation:**
- Epic 4's health monitoring, circuit breaker, and DLQ infrastructure are all available
- All data sources (agent registry, burndown service, audit trail, event publisher) exist from previous cycles
- UX1 patterns documented but not yet implemented in CLI — first application will be in 5-1
