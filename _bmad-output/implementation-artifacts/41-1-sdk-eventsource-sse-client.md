# Story 41.1: SDK EventSource SSE Client

Status: review

## Story

As an SDK consumer building integrations with the agent orchestrator,
I want `ao.onEvent()` to work with real EventSource SSE subscription,
so that I receive live event notifications from the orchestrator.

## Acceptance Criteria

1. `onEvent(eventType, handler)` creates a real EventSource connection to `/api/events`
2. Events are filtered by `eventType` before calling the handler
3. The unsubscribe function closes the EventSource when no more handlers remain
4. Multiple `onEvent()` calls share a single EventSource connection
5. `disconnect()` closes the EventSource and clears all handlers
6. Tests verify event subscription, filtering, unsubscribe, and disconnect

## Tasks / Subtasks

- [x] Task 1: Implement EventSource SSE in SDK (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Lazy EventSource connection via ensureSSE() on first onEvent
  - [x] 1.2: Parse SSE messages, match type against handlers Map
  - [x] 1.3: Unsubscribe removes handler, maybeCloseSSE when empty
  - [x] 1.4: disconnect() closes EventSource and clears all handlers
  - [x] 1.5: Guard with typeof EventSource check + console.warn
- [x] Task 2: Write tests (AC: #6)
  - [x] 2.1: Test handler receives matching events with correct shape
  - [x] 2.2: Test non-matching events filtered
  - [x] 2.3: Test unsubscribe removes handler
  - [x] 2.4: Test disconnect closes + clears
  - [x] 2.5: Test shared connection + auto-close when empty
  - [x] 2.6: Test handler errors don't crash other handlers
  - [x] 2.7: Test warning when EventSource unavailable

## Dev Notes

### Architecture Constraints

- **SDK is ESM** — `packages/sdk/src/index.ts`, published as `@composio/ao-sdk`
- **EventSource availability** — Browser has `EventSource` natively. Node.js needs polyfill. Guard with `typeof EventSource !== "undefined"` and warn if unavailable.
- **Shared connection** — All onEvent calls share one EventSource to `/api/events`. Handlers stored in a Map<EventType, Set<Handler>>.
- **SSE message format** — Server sends `data: {"type": "story.completed", ...}\n\n`. Parse JSON, match `type` against registered handlers.

### Implementation Approach

Add a closure-scoped SSE manager inside `createOrchestrator`:
```typescript
let eventSource: EventSource | null = null;
const handlers = new Map<EventType, Set<EventHandler>>();

function ensureConnection() {
  if (eventSource) return;
  eventSource = new EventSource(`${baseUrl}/api/events`);
  eventSource.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    const typeHandlers = handlers.get(data.type);
    typeHandlers?.forEach(h => h(data));
  };
}
```

### Files to Modify

1. `packages/sdk/src/index.ts` (modify — implement onEvent + disconnect)
2. `packages/sdk/src/index.test.ts` (modify — add SSE tests)

### References

- [Source: packages/sdk/src/index.ts] — current SDK with onEvent stub
- [Source: packages/web/src/app/api/events/route.ts] — SSE server endpoint

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Completion Notes List

- Replaced onEvent stub with real EventSource SSE subscription
- Lazy connection — EventSource created on first onEvent, shared across handlers
- Handlers stored in Map<EventType, Set<EventHandler>> for O(1) dispatch
- Auto-close when all handlers removed via maybeCloseSSE()
- disconnect() closes connection + clears all handlers
- Guard for missing EventSource in Node.js environments
- 12 unit tests (up from 5), all 22 SDK tests pass

### File List

- packages/sdk/src/index.ts (modified — real SSE implementation)
- packages/sdk/src/index.test.ts (rewritten — 12 tests with MockEventSource)
