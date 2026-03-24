# Story 46a.3: Inter-Agent Messaging Bus

Status: done

## Story

As a platform enabling agent-to-agent communication,
I want a message bus that agents can publish and subscribe to,
so that agents can coordinate without human intermediary.

## Acceptance Criteria

1. In-memory message bus with named channels for publish/subscribe
2. Publishers send typed messages to named channels
3. Subscribers receive messages on channels they're subscribed to
4. Messages persisted to JSONL for replay on restart
5. Bus accessible via `createMessageBus()` factory
6. At-least-once delivery — messages survive restart via JSONL replay
7. Tests verify pub/sub, channel isolation, persistence, and replay

## Tasks / Subtasks

- [x] Task 1: Create message bus service (AC: #1, #2, #3, #5)
  - [x] 1.1: Create `packages/core/src/message-bus.ts`
  - [x] 1.2: In-memory Map<string, Set<callback>> for channel isolation
  - [x] 1.3: publish() appends to JSONL then delivers to channel subscribers
  - [x] 1.4: subscribe() returns unsubscribe function that removes from Set
  - [x] 1.5: Delivers only to matching channel; errors in one subscriber don't break others
- [x] Task 2: Add JSONL persistence and replay (AC: #4, #6)
  - [x] 2.1: appendFile to messages.jsonl on every publish
  - [x] 2.2: replay(since?) reads JSONL, filters by timestamp, delivers to current subscribers
  - [x] 2.3: At-least-once: persist before deliver; replay on new bus instance
- [x] Task 3: Write tests (AC: #7)
  - [x] 3.1: 7 pub/sub tests: delivery, isolation, multi-sub, unsub, close, error resilience
  - [x] 3.2: Channel isolation verified — messages don't leak across channels
  - [x] 3.3: Unsubscribe stops delivery, verified with before/after count
  - [x] 3.4: 5 persistence tests: JSONL write, replay, since filter, nonexistent file, channel isolation on replay
  - [x] 3.5: Multiple subscribers receive same message

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items
- [x] File List includes all changed files

## Dev Notes

### Architecture — Channel-Based Pub/Sub + JSONL

```
message-bus.ts
  ├── createMessageBus(jsonlPath?) → MessageBus
  ├── publish(channel, message) → append to JSONL + deliver to subscribers
  ├── subscribe(channel, callback) → returns unsubscribe()
  └── replay(since?) → read JSONL, deliver to current subscribers
```

### MessageBus Interface

```typescript
interface BusMessage {
  id: string;           // UUID
  channel: string;      // Named channel (e.g., "agent.coordination", "story.updates")
  type: string;         // Message type within channel
  payload: Record<string, unknown>;
  timestamp: string;    // ISO 8601
  sender: string;       // Agent or service ID
}

interface MessageBus {
  publish(channel: string, message: { type: string; payload: Record<string, unknown>; sender: string }): Promise<void>;
  subscribe(channel: string, callback: (message: BusMessage) => void): () => void;
  replay(since?: string): Promise<number>;  // Returns count of replayed messages
  close(): Promise<void>;
}
```

### Channel Isolation

Subscribers only receive messages from their subscribed channel. Internal storage: `Map<string, Set<callback>>`.

### JSONL Persistence

Each `publish()` appends to `messages.jsonl`:
```json
{"id":"uuid","channel":"agent.coord","type":"handoff","payload":{},"timestamp":"...","sender":"agent-1"}
```

### Replay on Restart

`replay(since?)` reads the JSONL file and re-delivers messages to current subscribers. Optional `since` parameter filters by timestamp. Returns count of replayed messages.

### Existing Patterns to Follow

- **JSONL append**: Same pattern as `immutable-audit-log.ts` (appendFile)
- **Subscriber Map**: Same pattern as `EventBus` in types.ts (subscribe returns unsubscribe)
- **UUID generation**: `randomUUID()` from `node:crypto`

### Anti-Patterns to Avoid

- Do NOT implement the full EventBus interface — this is a simpler channel-based bus
- Do NOT add Redis or external dependencies — in-memory + JSONL only
- Do NOT use `setInterval` for polling — deliver synchronously on publish

### Files to Create

1. `packages/core/src/message-bus.ts` (new)
2. `packages/core/src/__tests__/message-bus.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export createMessageBus)

### References

- [Source: packages/core/src/types.ts:1543-1583] — EventBus interface pattern
- [Source: packages/core/src/immutable-audit-log.ts] — JSONL append pattern
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 46a.3] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- createMessageBus(jsonlPath?) factory — optional JSONL for persistence
- Channel isolation via Map<string, Set<MessageSubscriber>>
- Publish: persist to JSONL first (at-least-once), then deliver synchronously
- Subscriber errors caught per-callback — don't break other deliveries
- Unsubscribe removes from Set; empty channels cleaned up
- replay(since?) reads JSONL, filters by timestamp, delivers to current subscribers
- close() sets closed flag and clears all subscribers
- 12 new tests (7 pub/sub + 5 persistence), zero regressions

### File List

- packages/core/src/message-bus.ts (new)
- packages/core/src/__tests__/message-bus.test.ts (new)
- packages/core/src/index.ts (modified — export createMessageBus)
