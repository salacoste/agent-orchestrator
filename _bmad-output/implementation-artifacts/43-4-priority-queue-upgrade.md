# Story 43.4: Priority Queue Upgrade

Status: ready-for-dev

## Story

As a developer,
I want queued agent spawns to execute in priority order,
so that the most important stories get agents first.

## Acceptance Criteria

1. Queued spawns are ordered by priority (not FIFO)
2. Priority: blocked-dependency-unblocked stories > story order in sprint-status.yaml
3. `GET /api/sprint/queue` shows entries in priority order
4. When priorities are equal, FIFO order is preserved (stable sort)
5. Tests verify priority ordering, stability, and API response

## Tasks / Subtasks

- [ ] Task 1: Add priority scoring to spawn queue (AC: #1, #2, #4)
  - [ ] 1.1: Add `priority?: number` to QueueEntry in spawn-queue.ts
  - [ ] 1.2: Create `computeSpawnPriority(storyId)` — higher = spawn first
  - [ ] 1.3: Unblocked dependencies get +100 priority boost
  - [ ] 1.4: Story order from sprint-status gives base priority (earlier = higher)
  - [ ] 1.5: On processNext(), pick highest-priority entry instead of shift()
- [ ] Task 2: Update API response (AC: #3)
  - [ ] 2.1: Include priority in queue state entries
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test higher priority spawns before lower
  - [ ] 3.2: Test equal priority preserves FIFO
  - [ ] 3.3: Test unblocked dependency gets priority boost

## Dev Notes

### Architecture

- Upgrade existing `spawn-queue.ts` from 43.3 — replace `shift()` with priority-based selection
- Priority is a number: higher = spawn first. Default: story order index (100, 99, 98...)
- Unblocked dependencies get +100 boost
- Stable sort: entries with same priority maintain insertion order

### Files to Modify

1. `packages/core/src/spawn-queue.ts` (modify — add priority selection)
2. `packages/core/src/__tests__/spawn-queue.test.ts` (modify — add priority tests)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
