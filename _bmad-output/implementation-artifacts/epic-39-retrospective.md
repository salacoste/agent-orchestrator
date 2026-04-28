# Epic 39 Retrospective — Module Persistence & Real-Time

**Date**: 2026-03-22
**Epic**: 39 — Module Persistence & Real-Time
**Status**: Complete (all 4 stories done)
**Source**: epics-cycle-8.md

## Epic Summary

Epic 39 tackled the persistence gap: in-memory-only modules from earlier cycles (collaboration, cascade detection, compound learning) lost state on every server restart. Story 39-1 added SSE broadcasting so all connected dashboard clients see real-time collaboration changes. Story 39-2 layered JSONL persistence on top of that broadcast system, making decisions and claims survive restarts. Story 39-3 wired the cascade detector into the SSE event stream so cascade alerts trigger automatically from session health snapshots. Story 39-4 connected the compound learning API to real LearningStore data, replacing empty placeholder responses with actual pattern detection and failure analysis from JSONL records.

The key architectural insight: broadcast first, persist second. The subscriber system from 39-1 became the foundation for 39-2's persistence (the store subscribes to the same events it writes to disk) and 39-3's cascade integration (the SSE poll feeds the detector). This subscriber-as-backbone pattern avoided tight coupling between modules.

## Story Delivery

| Story | Title | Tests | Status |
|-------|-------|-------|--------|
| 39-1 | Collaboration SSE Broadcasting | 12 | Done |
| 39-2 | Collaboration JSONL Persistence | 9 | Done |
| 39-3 | Cascade Detector Event Bus Integration | 10 | Done |
| 39-4 | Compound Learning Real Data Connection | 7 | Done |

**Total new tests**: 38
**New modules**: collaboration-store.ts, cascade-detector-wired.ts
**Modified modules**: collaboration.ts (broadcasting), events/route.ts (cascade + collaboration SSE), services.ts (LearningStore init), learning/route.ts (real data)
**External dependencies added**: 0

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 39 delivered on its core promise: no more data loss on restart. The collaboration module went from ephemeral to persistent in two clean stories, and the cascade detector now triggers without manual wiring. The compound learning dashboard finally shows real patterns instead of empty placeholders. This epic transformed three demo-quality features into production-quality features.

**Nova (Architect):** The subscriber-as-backbone pattern is the standout architectural achievement. 39-1 introduced `subscribeCollaborationChanges()` as a generic event bus for the collaboration module. 39-2 consumed that same API to persist events to JSONL. 39-3 could have introduced a separate integration path, but instead the cascade detector consumes session snapshots that were already flowing through the SSE poll. No module depends on another module's internals -- they all communicate through the subscriber interface. This is the plugin-slot design philosophy applied at the module level.

The discriminated union `CollaborationEvent` type (from 39-1) was the right call. Compile-time prevention of invalid type+action combinations means the persistence layer and the SSE layer both handle a known set of events. No stringly-typed event names to mistype.

**Blaze (Dev):** The claim replay logic in 39-2 was satisfying to get right. `resolveLatestClaims()` replays the full claim/unclaim sequence per itemId to determine current state. This means the JSONL is the source of truth -- you can delete in-memory state, reload from disk, and get the correct answer. The `seenFailures` Set in 39-3's wired cascade detector solves a subtle deduplication problem: the SSE poll fires every 5 seconds, and without the Set the same blocked agent would be counted as a new failure on every poll cycle.

**Pax (QA):** 38 tests across 4 stories, all with real assertions. 39-3's 10 tests are particularly thorough -- they cover failure recording, cascade triggering, deduplication, resume clearing, agent recovery and re-failure, empty snapshots, and reset behavior. The malformed JSONL line handling in 39-2 (test 3.3) and presence exclusion verification (test 3.5) show attention to edge cases that would bite in production.

---

### What Could Be Improved

**R2d2 (Project Lead):** The collaboration store flaky test issue from 39-2 should have been caught during implementation, not during full-suite runs. The initial `setTimeout(50)` approach for waiting on async writes was inherently racy. The `writeChain` + `flush()` fix works, but the lesson is clear: never use fixed timeouts to wait on async I/O in tests.

**Nova (Architect):** The cascade detector's integration via the SSE poll interval (5s) introduces a minimum detection latency. A cascade can't be detected faster than the poll cycle. For most scenarios this is fine, but a direct EventBus integration (core's event bus, not a new one) would enable sub-second cascade detection. The current approach was the pragmatic choice given the web package's lack of EventBus access, but it's a known latency ceiling.

**Blaze (Dev):** The `injectDecisions`/`injectClaims` callback pattern in `initCollaborationStore` is a bit awkward. The store loads from disk, then the caller has to provide callbacks that push the loaded data back into the collaboration module's in-memory state. A cleaner API would be `initCollaborationStore()` returns the loaded data, and the caller decides what to do with it. But this was the path of least disruption to the existing module, so it's a reasonable tradeoff.

**Pax (QA):** 39-4 has only 7 tests, the lowest of the four stories. The fallback path when LearningStore is not initialized is tested, but the graceful degradation when `store.start()` throws a non-fatal error (mentioned in the dev notes) is only implicitly covered. A dedicated test for the non-fatal init error path would be valuable -- services.ts wraps the init in error handling, but that code path is untested at the unit level.

---

### Key Decisions

1. **Broadcast first, persist second (39-1 then 39-2)** -- The subscriber system from 39-1 became the foundation for 39-2's persistence. The store subscribes to the same events it writes to disk. This ordering avoided any modification to the collaboration module's mutation functions for persistence purposes.

2. **Presence is NOT persisted (39-2)** -- Presence is ephemeral by nature. Stale presence data (from a server restart while users are connected) would be misleading. Decisions and claims survive restarts; presence does not. This was the correct UX call.

3. **Wired cascade detector wraps base detector (39-3)** -- The base `cascade-detector.ts` stays unchanged. The wired version adds snapshot processing and deduplication on top. This follows the "pure module pattern" convention established in earlier epics.

4. **No EventBus dependency in web package (39-3)** -- The web package doesn't import core's EventBus. Instead, the cascade detector consumes session snapshots that are already available in the SSE poll. This keeps the dependency boundary clean.

5. **Non-fatal LearningStore initialization (39-4)** -- If LearningStore fails to start, the learning API returns empty data instead of erroring. This follows the "non-fatal enrichment" pattern: the dashboard works without learning data, it just shows empty panels.

---

### Lessons Learned

1. **Subscriber systems enable layering** -- The `subscribeCollaborationChanges()` API from 39-1 served three consumers: SSE broadcasting (39-1), JSONL persistence (39-2), and could serve future consumers without modifying the collaboration module. A well-designed subscriber interface is a force multiplier.

2. **JSONL replay requires careful state resolution** -- Loading claims from JSONL isn't just reading the file; it's replaying the claim/unclaim sequence per item to determine current state. This replay pattern (append-only writes, resolve-at-load-reads) is the correct approach for event-sourced data and should be used consistently across all JSONL stores.

3. **Set-based deduplication for polling systems** -- The `seenFailures` Set in 39-3 is a reusable pattern for any system that polls and needs to avoid double-counting. Track what you've already processed, clear on recovery, re-allow on subsequent failures. This pattern should be documented as a convention.

4. **Discriminated unions prevent invalid state combinations** -- The `CollaborationEvent` type with discriminated `type` and `action` fields prevents compile-time invalid combinations like `{ type: "presence", action: "log" }`. This is strictly better than loose string types and should be the default for all event systems.

---

### Deferred Items

| Item | Story | Notes |
|------|-------|-------|
| Direct EventBus integration for cascade detection | 39-3 | Current SSE poll latency (5s) is acceptable; direct bus would be faster but requires web-to-core dependency change |
| LearningStore non-fatal init error test | 39-4 | services.ts wraps init in try/catch but error path not unit-tested |
| Shared SSE context for multiple EventSource connections | 39-1 | Multiple hooks create separate connections; a React context could share one |

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Fix WorkflowPage test fragility -- use URL-based assertions instead of call counts | Dev | HIGH |
| 2 | Add EventSource guard pattern to coding standards for browser-only APIs | Dev | MEDIUM |
| 3 | Consider shared SSE context to consolidate multiple EventSource connections | Dev | LOW |
| 4 | Add unit test for LearningStore non-fatal init error path | QA | LOW |
| 5 | Document Set-based deduplication pattern for polling systems | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4 |
| Total new tests | 38 |
| New modules created | 2 (collaboration-store.ts, cascade-detector-wired.ts) |
| Modified existing modules | 4 (collaboration.ts, events/route.ts, services.ts, learning/route.ts) |
| External dependencies added | 0 |
| Code review rounds | ~4 (one per story) |
| Deferred items | 3 |
| Test suite after epic | ~1,146 web tests (up from ~1,119) |
