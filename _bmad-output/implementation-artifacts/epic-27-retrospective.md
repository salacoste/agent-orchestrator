# Epic 27 Retrospective — Multi-User Collaboration MVP

**Date**: 2026-04-29
**Epic**: 27 — Multi-User Collaboration MVP
**Status**: Complete (all 3 stories done)
**Source**: Cycle 5

## Epic Summary

Epic 27 introduced the foundational layer for multi-user collaboration in the agent orchestrator. Three stories delivered team presence tracking (who is viewing what), a review claim system (preventing duplicate review work), and a decision log (capturing human judgment calls). All three shipped as a single consolidated module (`collaboration.ts`) using in-memory Maps and arrays for state storage, with a subscriber-based change notification system. The module is pure logic with zero external dependencies and zero persistence — a deliberate MVP scope that establishes the data model and API surface for future WebSocket/SSE integration.

## Story Delivery

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| 27-1 | Team Presence | Done | Tracks user presence per page via `Map<string, UserPresence>`. Supports update, query by page, remove, and list-all operations. Emits presence events to subscribers. |
| 27-2 | Review Claim System | Done | Claims/unclaims review items (PRs, stories) to prevent duplicate work. `Map<string, ReviewClaim>` with claim/unclaim/query/list operations. Emits claim events to subscribers. |
| 27-3 | Decision Log | Done | Appends human decisions (who/what/why/context) to an in-memory array. Auto-generates IDs and timestamps. Supports full log retrieval and recent-N queries. Emits decision events to subscribers. |

**Total new tests**: ~10 (presence: 3, claims: 4, decisions: 3)
**New modules**: 1 (`collaboration.ts` — all three stories consolidated)
**External dependencies added**: 0
**Lines of production code**: ~135 (Epic 27 portions, excluding Stories 39.1/42.1/42.2 additions)

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 27 delivered the minimum viable collaboration surface in the smallest possible footprint. One file, three concerns, zero external dependencies. The decision log is the most important piece — when multiple humans interact with parallel agents, capturing "who decided what and why" is critical for post-mortems and handoffs. The review claim system solves a real coordination problem: two humans should not independently review the same PR at the same time. Team presence is the least critical of the three but sets up the mental model for "who else is here right now."

**Nova (Architect):** The discriminated union type for `CollaborationEvent` is the strongest architectural decision in this epic. By defining the event type as a union of tagged objects (`{ type: "presence" } | { type: "claim" } | { type: "decision" }`), the module gets exhaustive type checking in the subscriber callback. Adding a new collaboration concern (like annotations in Story 42.1 or ownership in Story 42.2) means extending the union — the compiler will flag every subscriber that does not handle the new type. This is a pattern that scales well.

The subscriber pattern (`subscribeCollaborationChanges` returning an unsubscribe function) follows the same contract as `EventTarget.addEventListener` / `removeEventListener`. It is idiomatic, composable, and easy to integrate with React's `useEffect` cleanup. No framework coupling.

**Blaze (Dev):** Consolidating all three stories into a single file was the right call. The three concerns share the same event broadcasting infrastructure (the `notify` function and subscriber set), and the module has a clear section-per-story structure with separator comments. Adding a new section is a copy-paste of the pattern: interface, state variable, CRUD functions, notify calls. The `_resetCollaboration` export for test cleanup is a small but important detail — it resets all five state containers (presence, claims, decisions, annotations, owners) and the subscriber set.

The test structure mirrors the production code: one `describe` block per story, `beforeEach` calling `_resetCollaboration()`. Clean isolation, no cross-test contamination.

**Pax (QA):** 10 tests across 3 describe blocks with full isolation via `beforeEach`. The claim system has the best coverage: claim/unclaim/query/list/all-claimed states. The presence tests cover update/query/remove/list. The decision tests cover log/full-log/recent-N. Edge cases are light — no tests for duplicate presence updates, concurrent claim races, or decision log overflow — but this is acceptable for an in-memory MVP. The `beforeEach` reset ensures no state leaks between tests.

---

### What Could Be Improved

**R2d2 (Project Lead):** The collaboration module is in-memory only. Restart the server, lose all presence, claims, and decisions. This was a deliberate scope cut for Cycle 5, but it means the module is only useful in single-session scenarios. Real multi-user collaboration needs persistence (JSONL event log would match the project's existing event architecture) and real-time synchronization (WebSocket or SSE broadcasting). The cycle-5 retrospective flagged both of these as action items.

**Nova (Architect):** The `claims` Map uses `itemId` as the key, which means an item can only be claimed by one person at a time. This is correct for review claims (one reviewer per PR) but does not generalize to other claim scenarios (e.g., "I'm working on this story" where multiple people might collaborate). The data model is opinionated in a way that may need to be relaxed later.

The presence system tracks `currentPage` but not `cursorPosition` or `selectionRange` — the kind of fine-grained presence that tools like Figma or Google Docs provide. This is fine for an MVP (knowing someone is on `/workflow` is useful) but the interface should anticipate richer presence data without a breaking change.

**Blaze (Dev):** The `notify` function catches all subscriber errors silently (`catch {}`). This prevents a buggy subscriber from crashing the notification chain, which is good. But it also means a subscriber can throw indefinitely and no one will notice. In a production system, we would want at least a `console.warn` or a failed-subscriber counter. For an in-memory MVP, silent catch is acceptable.

The decision log uses an auto-incrementing counter (`decision-${decisions.length + 1}`) for IDs. If decisions are ever persisted and reloaded, this counter would reset. A UUID or timestamp-based ID would be more robust. Low priority for now.

**Pax (QA):** No tests for the subscriber/change-broadcasting system. Stories 39.1 added `subscribeCollaborationChanges` and `notify`, but the collaboration.test.ts file does not verify that subscribers receive events when presence is updated, claims are made, or decisions are logged. This is a meaningful gap — the subscriber pattern is the module's primary integration point, and it has zero test coverage in the Epic 27 test suite. (Story 39.1 may have added its own subscriber tests, but they are not in the collaboration.test.ts file.)

No tests for concurrent modifications: two users updating presence simultaneously, two users claiming the same item in rapid succession, or decisions being logged while a subscriber is iterating the log. These are edge cases that matter more when the module moves to async/WebSocket territory.

---

### Key Decisions

1. **Single consolidated module, not three separate files.** All three stories ship in `collaboration.ts`. Rationale: shared event broadcasting infrastructure, shared subscriber set, shared reset function. The section-per-story structure with separator comments provides adequate code organization without file-proliferation overhead for what is ultimately ~135 lines of production code.

2. **In-memory Maps and arrays, no persistence.** Deliberate MVP scope cut. Persistence would require deciding on a storage backend (JSONL, SQLite, Redis), designing a reload strategy, and handling crash recovery. All three are deferred to a follow-up cycle.

3. **Subscriber-based change notification (pull, not push to network).** The module emits events to registered callbacks but does not manage network transport. This decouples the collaboration logic from the delivery mechanism. When WebSocket/SSE is added, it will be a subscriber that bridges to the network layer.

4. **No authentication or authorization in the MVP.** `userId` is a string passed by the caller. The module trusts the caller to provide a valid identity. Real authentication is a cross-cutting concern that belongs in middleware, not in the collaboration module.

### Lessons Learned

1. **Consolidating related stories into one file reduces integration overhead.** Three stories produced one file with one test file. If we had created three separate modules, we would have needed a fourth module to coordinate the shared event broadcasting. The consolidation avoided this overhead.

2. **The discriminated union event type scales better than string-based event names.** TypeScript's exhaustive checking on the `CollaborationEvent` union means that adding a new event type (annotations, ownership) produces compiler errors in every subscriber until it is handled. This is stronger than a string-based `EventEmitter` pattern where missing handlers fail silently.

3. **In-memory state is a valid MVP strategy but creates a false sense of completeness.** The module's API surface is complete — update, query, remove, list, subscribe — but the state is ephemeral. Users who test the module in a single session will see it work perfectly and may assume it is production-ready. The story specs should have been more explicit about the persistence gap.

4. **The cycle-5 retrospective correctly identified the persistence and real-time gaps.** Action items 1 (WebSocket/SSE for team presence) and 3 (JSONL persistence) from the cycle-5 retrospective remain open. Epic 27 proved the data model and API surface; the follow-up work is infrastructure, not design.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Add JSONL event log persistence to collaboration module (append-only, reload on startup) | Dev | HIGH |
| 2 | Add WebSocket/SSE transport layer for real-time team presence and claim synchronization | Dev | HIGH |
| 3 | Add subscriber notification tests (verify events emitted on presence/claim/decision mutations) | QA | MEDIUM |
| 4 | Replace auto-increment decision IDs with UUIDs for persistence compatibility | Dev | MEDIUM |
| 5 | Add concurrent-modification edge case tests (duplicate claims, rapid presence updates) | QA | LOW |
| 6 | Consider richer presence data (cursor position, selection) in `UserPresence` interface before WebSocket integration | Nova | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 3 |
| Stories completed | 3 (100%) |
| Production files created | 1 (`collaboration.ts`) |
| Test files created | 1 (`collaboration.test.ts`) |
| Total new tests | ~10 |
| External dependencies added | 0 |
| Regressions | 0 |
| Deferred items | 2 (persistence, real-time sync) |
| Epic duration | Part of Cycle 5 (1 session) |
| Build status | Green |
