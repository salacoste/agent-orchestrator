# Story 39.1: Collaboration SSE Broadcasting

Status: review

## Story

As a dashboard user viewing collaboration data (presence, claims, decisions),
I want real-time updates when other users make changes,
so that all connected clients see the same collaboration state without polling.

## Acceptance Criteria

1. When a user updates their presence, all connected SSE clients receive a `collaboration.presence` event
2. When a review item is claimed/unclaimed, all connected SSE clients receive a `collaboration.claim` event
3. When a decision is logged, all connected SSE clients receive a `collaboration.decision` event
4. The collaboration module exposes a `subscribe(callback)` API that returns an unsubscribe function
5. The existing `/api/events` SSE route integrates collaboration change notifications
6. Tests verify that subscribers are notified on each change type

## Tasks / Subtasks

- [x] Task 1: Add change listener system to collaboration.ts (AC: #4)
  - [x] 1.1: Define `CollaborationEvent` type with `type`, `action`, `data`, `timestamp` fields
  - [x] 1.2: Add module-level `Set<callback>` for subscribers
  - [x] 1.3: Implement `subscribeCollaborationChanges(cb): () => void` (returns unsubscribe)
  - [x] 1.4: Call `notify()` from `updatePresence`, `removePresence`, `claimItem`, `unclaimItem`, `logDecision`
- [x] Task 2: Integrate into SSE events route (AC: #1, #2, #3, #5)
  - [x] 2.1: Import `subscribeCollaborationChanges` in `/api/events/route.ts`
  - [x] 2.2: Subscribe in `start()`, emit `collaboration.*` events to SSE stream
  - [x] 2.3: Unsubscribe in `cancel()` cleanup
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: Test subscriber receives presence updates
  - [x] 3.2: Test subscriber receives claim/unclaim events
  - [x] 3.3: Test subscriber receives decision events
  - [x] 3.4: Test unsubscribe stops notifications
  - [x] 3.5: Test multiple subscribers receive events

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Dev Notes

### Architecture Constraints

- **ESM modules** — `.js` extensions NOT needed in web package (Next.js webpack)
- **No `node:` imports in client components** — collaboration.ts is a pure module used by both server and client
- **Pure module pattern** — collaboration.ts uses module-level state (Maps/arrays), not classes. Keep this pattern.
- **SSE pattern** — existing `/api/events/route.ts` uses `ReadableStream` with `controller.enqueue()` + `TextEncoder`. Follow the same pattern for collaboration events.

### Implementation Approach

The collaboration module (`packages/web/src/lib/workflow/collaboration.ts`) currently has 3 sections:
1. **Team Presence** — `updatePresence()`, `removePresence()`, `getPresenceForPage()`, `getAllPresence()`
2. **Review Claims** — `claimItem()`, `unclaimItem()`, `getClaimForItem()`, `getAllClaims()`
3. **Decision Log** — `logDecision()`, `getDecisionLog()`, `getRecentDecisions()`

All mutating functions need to emit events to subscribers. Add a new section at the bottom:

```
// Story 39.1: Change Broadcasting
```

**Event format:**
```typescript
interface CollaborationEvent {
  type: "presence" | "claim" | "decision";
  action: "update" | "remove" | "claim" | "unclaim" | "log";
  data: UserPresence | ReviewClaim | Decision;
  timestamp: string;
}
```

**SSE integration:** In `/api/events/route.ts`, add alongside the existing `subscribeWorkflowChanges`:
```typescript
const unsubCollab = subscribeCollaborationChanges((event) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: `collaboration.${event.type}`, ...event })}\n\n`));
});
```

### Files to Modify

1. `packages/web/src/lib/workflow/collaboration.ts` — add subscriber system + notify calls
2. `packages/web/src/app/api/events/route.ts` — subscribe to collaboration changes
3. `packages/web/src/lib/workflow/__tests__/collaboration.test.ts` — new test file for broadcasting

### Previous Story Intelligence

Epic 38 established the pattern of using `getServices()` for API routes and proper error handling. The SSE route in `/api/events/route.ts` already has cleanup in `cancel()` — follow this pattern for the collaboration unsubscribe.

### References

- [Source: packages/web/src/lib/workflow/collaboration.ts] — existing module
- [Source: packages/web/src/app/api/events/route.ts] — existing SSE pattern
- [Source: _bmad-output/planning-artifacts/epics-cycle-8.md#Story-39.1] — epic spec

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Added `CollaborationEvent` interface and `CollaborationSubscriber` type
- Added `subscribeCollaborationChanges()` with unsubscribe return
- Added `notify()` internal function called from all 5 mutating functions
- Integrated into SSE `/api/events` route with cleanup in `cancel()`
- 12 tests covering all event types, unsubscribe, multi-subscriber, error isolation, reset
- All 1,119 web tests pass, typecheck clean

### File List

- packages/web/src/lib/workflow/collaboration.ts (modified — added broadcasting section)
- packages/web/src/app/api/events/route.ts (modified — subscribe to collaboration changes)
- packages/web/src/lib/workflow/__tests__/collaboration-broadcasting.test.ts (new — 12 tests)
