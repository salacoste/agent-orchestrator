# Story 43.6: Scope Creep Detector — Token/File Budget Monitoring

Status: ready-for-dev

## Story

As a team lead,
I want warnings when an agent's token usage or file changes exceed expected bounds,
so that scope creep is caught early.

## Acceptance Criteria

1. Computes historical averages for tokens-per-story and files-per-story from learning store
2. When a running agent exceeds threshold × average, flags as "scope creep"
3. Warning includes: agent ID, story, current usage vs average, suggested action
4. Threshold multiplier is configurable (default: 2x)
5. `GET /api/agent/[id]/scope` returns scope creep status
6. Tests verify threshold detection, average computation, and configurable multiplier

## Tasks / Subtasks

- [ ] Task 1: Create scope creep detector module (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `packages/core/src/scope-creep-detector.ts`
  - [ ] 1.2: `computeHistoricalAverages(learnings)` → avg tokens, avg files per completed session
  - [ ] 1.3: `checkScopeCreep(session, averages, multiplier)` → returns warning or null
  - [ ] 1.4: Warning includes: agentId, storyId, metric (tokens/files), current, average, threshold
- [ ] Task 2: Write tests (AC: #6)
  - [ ] 2.1: Test average computation from learning records
  - [ ] 2.2: Test scope creep detection at threshold
  - [ ] 2.3: Test below threshold returns null
  - [ ] 2.4: Test custom multiplier
  - [ ] 2.5: Test with empty learning store (no averages available)

## Dev Notes

### Architecture

- Pure module — functions take data in, return warnings out
- Uses `SessionLearning.filesModified.length` for file count and `CostEstimate.inputTokens + outputTokens` for token count
- Separate from loop detector (43.5) — loop tracks restarts, scope creep tracks metrics

### Files to Create

1. `packages/core/src/scope-creep-detector.ts` (new)
2. `packages/core/src/__tests__/scope-creep-detector.test.ts` (new)
3. `packages/core/src/index.ts` (modify — export)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
