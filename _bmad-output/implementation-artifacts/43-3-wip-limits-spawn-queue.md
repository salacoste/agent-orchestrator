# Story 43.3: WIP Limits & Spawn Queue

Status: ready-for-dev

## Story

As a team lead,
I want to set a maximum number of concurrent agents with automatic queuing,
so that resources aren't wasted and excess spawns wait their turn.

## Acceptance Criteria

1. `maxConcurrentAgents: N` in config sets the WIP limit
2. When a spawn request would exceed N running agents, it is QUEUED (not rejected)
3. Queued spawns execute automatically when a running agent finishes
4. Queue processes spawns ONE AT A TIME sequentially (no race conditions)
5. `GET /api/sprint/queue` returns current queue state
6. Dashboard shows "N/M agents active (K queued)"
7. When no `maxConcurrentAgents` configured, behavior is unlimited (current default)
8. Tests verify queuing, auto-dequeue, and sequential processing

## Tasks / Subtasks

- [ ] Task 1: Add `maxConcurrentAgents` to config schema (AC: #1, #7)
  - [ ] 1.1: Add optional `maxConcurrentAgents?: number` to `OrchestratorConfig` in types.ts
  - [ ] 1.2: Add to Zod schema in config.ts with default undefined (unlimited)
  - [ ] 1.3: Add to agent-orchestrator.yaml.example with comment
- [ ] Task 2: Create spawn queue module (AC: #2, #3, #4)
  - [ ] 2.1: Create `packages/core/src/spawn-queue.ts` with `SpawnQueue` interface
  - [ ] 2.2: Queue stores pending `SessionSpawnConfig` entries in FIFO order
  - [ ] 2.3: `enqueue(config)` adds to queue, returns a promise that resolves when spawned
  - [ ] 2.4: `processNext()` checks WIP limit via `sessionManager.list()`, spawns if under limit
  - [ ] 2.5: Subscribe to session completion events to auto-trigger `processNext()`
  - [ ] 2.6: Queue is in-memory, rebuilt from sprint-status.yaml backlog on startup
- [ ] Task 3: Wire queue into session manager spawn path (AC: #2, #4)
  - [ ] 3.1: Add `createSpawnQueue(config, sessionManager)` factory
  - [ ] 3.2: Register in service registry via `registerSpawnQueue` / `getSpawnQueue`
  - [ ] 3.3: Web services.ts initializes queue alongside session manager
- [ ] Task 4: Create queue API endpoint (AC: #5)
  - [ ] 4.1: Create `GET /api/sprint/queue` returning queue state (pending items, running count, limit)
- [ ] Task 5: Write tests (AC: #8)
  - [ ] 5.1: Test enqueue when under WIP limit spawns immediately
  - [ ] 5.2: Test enqueue when at WIP limit queues the spawn
  - [ ] 5.3: Test auto-dequeue when agent finishes
  - [ ] 5.4: Test sequential processing (no race conditions)
  - [ ] 5.5: Test unlimited mode when no maxConcurrentAgents configured
  - [ ] 5.6: Test API endpoint returns correct queue state

## Dev Notes

### Architecture Constraints

- **In-memory queue** — rebuilt from sprint-status.yaml on startup (party mode decision)
- **Sequential processing** — all spawns go through the queue, even when under limit (party mode decision to prevent race conditions)
- **No new persistence file** — sprint-status.yaml is the source of truth
- **ESM + `.js` extensions** — core package convention
- **`execFile` not `exec`** — if any subprocess needed

### Implementation Approach

The SpawnQueue wraps session manager's spawn():
```typescript
interface SpawnQueue {
  enqueue(config: SessionSpawnConfig): Promise<Session>;
  getState(): { pending: number; running: number; limit: number | null };
  processNext(): Promise<void>;
}
```

All spawn requests go through `enqueue()`. If under limit, spawn immediately. If at limit, store in queue and resolve the promise when eventually spawned.

Auto-dequeue: subscribe to `story.completed` events via the event publisher. When an agent finishes, call `processNext()`.

### Party Mode Decisions Applied

- Queue IS the WIP enforcement mechanism (all spawns go through it)
- In-memory with sprint-status.yaml as durable truth
- Sequential one-at-a-time processing prevents race conditions
- No cryptographic chaining or complex persistence

### Files to Create/Modify

1. `packages/core/src/types.ts` (modify — add maxConcurrentAgents)
2. `packages/core/src/config.ts` (modify — add to Zod schema)
3. `packages/core/src/spawn-queue.ts` (new — queue module)
4. `packages/core/src/__tests__/spawn-queue.test.ts` (new — tests)
5. `packages/core/src/index.ts` (modify — export queue)
6. `packages/web/src/lib/services.ts` (modify — initialize queue)
7. `packages/web/src/app/api/sprint/queue/route.ts` (new — API endpoint)
8. `agent-orchestrator.yaml.example` (modify — add maxConcurrentAgents)

### References

- [Source: packages/core/src/types.ts#OrchestratorConfig] — config interface
- [Source: packages/core/src/session-manager.ts#spawn] — existing spawn function
- [Source: packages/core/src/service-registry.ts] — service registration pattern

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
