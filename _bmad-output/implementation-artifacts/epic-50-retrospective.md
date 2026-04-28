# Epic 50 Retrospective — Shared Agent Pool

**Date**: 2026-04-29
**Epic**: 50 — Shared Agent Pool
**Status**: Complete (all 6 stories done)
**Source**: epics-cycle-10.md

## Epic Summary

Epic 50 delivered the shared agent pool: a configuration-driven system that allows agents to work across project boundaries, with intelligent allocation, exclusive reservations, utilization tracking, and over-allocation prevention. The feature spans 6 stories that layer capabilities incrementally — from config types (50-1) through reservation (50-2), allocation algorithm (50-3), cross-project execution (50-4), utilization observability (50-5), and capacity enforcement (50-6).

The design follows a pure-function architecture: allocation scoring, capacity checks, and utilization computation are all deterministic, side-effect-free functions that accept pre-fetched data. This makes the entire system testable without mocking external services. The allocation algorithm handles 100 agents across 50 projects in 19ms (well under the 500ms NFR target).

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 50-1 | Shared Pool Configuration | 31 core + web | 1H+3M+3L | Done |
| 50-2 | Agent Reservation for Exclusive Use | 21 new core + web | 1H+3M+2L | Done |
| 50-3 | Intelligent Allocation Algorithm | 43 core | 8 (code review) | Done |
| 50-4 | Cross-Project Story Assignment | 17 core + web | 1H+4M+2L | Done |
| 50-5 | Agent Utilization Tracking | 26 core + web | 3H+3M+2L | Done |
| 50-6 | Over-Allocation Prevention | 30 core + web | 2H+3M+2L | Done |

**Total new tests**: ~168 (core + web)
**New modules**: shared-pool.ts, pool-allocation.ts, cross-project-assignment.ts, agent-utilization.ts, capacity-check.ts
**External dependencies added**: 0
**Code reviews**: 6 reviews, all issues fixed
**Agent models used**: Claude Opus 4.6 (50-2, 50-3, 50-6), Claude Sonnet 4 (50-1, 50-4, 50-5)

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 50 delivered a complete, production-grade shared agent pool with zero external dependencies. The incremental layering — config, reservation, allocation, execution, tracking, enforcement — meant every story built on a stable foundation. The allocation algorithm's 19ms performance for 100 agents across 50 projects means we can scale without worrying about bottlenecks. The capacity guard with force-override gives project managers control without being paternalistic.

**Nova (Architect):** Three architectural decisions proved their worth across all six stories:

1. **Pure-function allocation engine** — `pool-allocation.ts` is a set of pure functions with no I/O, no state mutation, no external dependencies. Input: config + runtime context maps. Output: ranked allocation decisions. This made the 43 allocation tests trivial to write and the performance NFR trivially achievable. The scoring formula (weighted sum of urgency 0.3, priority 0.3, affinity 0.25, workload 0.15) is configurable via `allocationWeights` without code changes.

2. **SprintDataReader injection pattern** — Story 50-4 introduced a `SprintDataReader` interface injected into `gatherPoolStories()` for testability. This pattern — pure functions accepting injected data readers — should be the default for any new data-gathering module. It eliminates the need for filesystem mocking.

3. **Guard pattern with force override** — `guardAssignment()` returns a result object (allow/deny) rather than throwing. The caller throws `CapacityExceededError` if denied. Force mode logs a warning event but proceeds. This separates policy from mechanism cleanly.

**Blaze (Dev):** The code review catches across this epic were consistently high quality. Story 50-3's review fixed 8 issues including a real bug where `computeWorkloadScore` returned >1 for negative `activeAssignments` and an O(S) performance issue in tiebreaking that used `stories.find()` per comparison. Story 50-4's review caught a real event-loop-blocking `readFileSync` that got converted to async `readFile`. These are not cosmetic — they're production issues caught before merge.

**Pax (QA):** 168 new tests across core and web with real assertions. Every story includes edge-case coverage: no available agents, empty sprint-status, all agents reserved, zero maxConcurrent, negative workload, over-capacity race conditions. The performance test in 50-3 validates the 500ms NFR with 100 agents x 50 projects. Story 50-6's known limitation on AC #5 (concurrent allocation race condition) is honestly documented with the SpawnQueue mitigation — this is the right approach.

---

### What Could Be Improved

**R2d2 (Project Lead):** The `NotificationPriority` vs `EventPriority` key mismatch is not from this epic but remains unresolved — it will cause confusion when notification integrations reference pool events. Also, the fact that AC #5 in 50-6 (concurrent allocation safety) is accepted as a known limitation means the shared pool has a theoretical race window. The SpawnQueue serialization mitigates this in practice, but it should be documented in the config guide.

**Nova (Architect):** Two structural concerns:

1. **File sprawl in core** — Five new files (shared-pool.ts, pool-allocation.ts, cross-project-assignment.ts, agent-utilization.ts, capacity-check.ts) all live flat in `packages/core/src/`. Each is 80-200 lines, but collectively they represent a "pool" subsystem that deserves a `pool/` directory. The flat structure makes it harder to understand the dependency graph (allocation depends on shared-pool, cross-project depends on allocation, capacity depends on both).

2. **`active agent` definition inconsistency** — Story 50-5's code review (H2) revealed that the definition of "active agent" differed between core (`activity === "active" || status === "working"`) and web (`portfolio-aggregation.ts`). This required alignment. The root cause is that `Session.activity` (ActivityState) and `Session.status` (SessionStatus) overlap in semantics but serve different purposes. A canonical `isAgentActive(session)` utility would prevent future drift.

**Blaze (Dev):** The `pnpm build` monorepo type propagation issue (50-1 debug log) continues to slow development. After adding `sharedPool` to `ProjectConfig` in core, the web package couldn't see it until `pnpm build` ran. This is a workspace linking issue that affects every cross-package type change. The workaround (build after every core type change) is correct but adds 30-60 seconds per iteration.

**Pax (QA):** Binary utilization (0/100) in 50-5 is accepted as a design decision, but it means the dashboard shows agents as either 0% or 100% utilized with no intermediate values. True time-based utilization requires session state history, which the system doesn't track. This is an honest limitation but it makes the utilization metric less useful for capacity planning than it could be.

---

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Pure-function allocation engine | Deterministic, testable, fast | Caller must gather data externally |
| Target-project session spawning | Agent works in target repo with target plugins | Source project loses visibility into cross-project sessions |
| Config-level reservations (not runtime) | Simple, auditable, no state management | Cannot reserve dynamically without config reload |
| Binary utilization (active/idle) | Matches existing session data model | No granular utilization percentages |
| Force-override on capacity guard | User autonomy, no false blocks | Can cause over-allocation if misused |
| `onCapacitySkip` callback (not event bus) | Allocation algorithm stays pure | Callback errors must be caught by caller |
| Known limitation: no concurrent allocation safety | Stateless architecture, no distributed locks | Race window exists (mitigated by SpawnQueue) |

---

### Lessons Learned

1. **Inject data readers, not filesystem calls.** The `SprintDataReader` pattern from 50-4 eliminated filesystem mocking entirely. This should be applied retroactively to `assignment-service.ts` and any module that reads sprint-status or metadata files.

2. **Performance test early.** The 50-3 allocation algorithm was designed for O(S x A) with Map-based lookups from the start. The 19ms result validated the design. If we had waited until 50-4 to test performance with real cross-project data, we might have discovered architectural issues too late.

3. **Code review catches real production issues.** The `readFileSync` → `readFile` fix in 50-4, the negative workload bug in 50-3, and the `SessionStatus` vs `ActivityState` confusion in 50-4 were all real bugs that would have manifested in production. Every review cycle paid for itself.

4. **Shared type definitions need canonical sources.** The "active agent" definition drift between core and web (caught in 50-5 review) shows that shared semantics should live in a single canonical utility, not be recomputed in each module.

5. **Config-gated features with Zod defaults maintain backward compatibility.** Every story added optional config fields with sensible defaults. Existing projects without `sharedPool` are completely unaffected. This pattern is now mature and repeatable.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Create canonical `isAgentActive(session)` utility in core | Dev | HIGH |
| 2 | Consolidate pool modules into `packages/core/src/pool/` directory | Dev | MEDIUM |
| 3 | Document AC #5 concurrent allocation limitation in config guide | Dev | MEDIUM |
| 4 | Add session state history tracking for time-based utilization | Dev | LOW |
| 5 | Fix pre-existing `pnpm build` type propagation issue in monorepo | Dev | MEDIUM |

---

### Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Time-based utilization (non-binary) | Tech debt | 50-5 |
| Concurrent allocation race condition safety | Tech debt (requires persistence layer) | 50-6 |
| Historical story count per agent (beyond current assignments) | Tech debt | 50-5 |
| Capacity filter UI in assignable agents dashboard | Tech debt | 50-6 |
| Pool membership as portfolio filter dimension | Tech debt | 50-1 |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 |
| Stories with 0 review issues | 0 |
| Total review issues found | ~30 |
| Total new tests | ~168 |
| External dependencies added | 0 |
| New core modules | 5 |
| New API routes | 5 |
| Allocation algorithm performance | 19ms (100 agents, 50 projects) |
| Deferred items | 5 |
| Epic duration | ~5 days |
