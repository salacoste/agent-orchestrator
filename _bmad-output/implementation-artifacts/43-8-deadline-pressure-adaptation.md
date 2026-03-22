# Story 43.8: Deadline Pressure Adaptation

Status: ready-for-dev

## Story

As a team lead approaching a deadline,
I want the orchestrator to adapt its behavior when the sprint clock is tight,
so that it prioritizes completion over thoroughness.

## Acceptance Criteria

1. Detects deadline pressure: <20% time remaining with >30% stories undone
2. Dashboard shows a "Deadline pressure" indicator when triggered
3. Provides adapted recommendations: skip optional reviews, parallelize more, suggest scope cuts
4. Pressure thresholds are configurable
5. Tests verify pressure detection at threshold boundaries

## Tasks / Subtasks

- [ ] Task 1: Create deadline pressure detector (AC: #1, #4)
  - [ ] 1.1: Create `packages/core/src/deadline-pressure.ts` with `detectDeadlinePressure()` pure function
  - [ ] 1.2: Inputs: timeRemainingMs, totalTimeMs, storiesDone, storiesTotal, thresholds
  - [ ] 1.3: Returns: isPressured, timePercent, completionPercent, level (none/moderate/critical), recommendations
- [ ] Task 2: Write tests (AC: #5)
  - [ ] 2.1: Test pressure detected at threshold (20% time, 30% undone)
  - [ ] 2.2: Test no pressure with healthy margins
  - [ ] 2.3: Test critical level (<10% time, >50% undone)
  - [ ] 2.4: Test custom thresholds
  - [ ] 2.5: Test recommendations differ by level

## Dev Notes

### Architecture

- Pure function — takes numbers in, returns pressure status + recommendations
- No side effects, no config reading, no API calls
- Integrates with sprint clock (computeSprintClock from cost-tracker.ts)
- Recommendations are string arrays — the dashboard renders them

### Files to Create

1. `packages/core/src/deadline-pressure.ts` (new)
2. `packages/core/src/__tests__/deadline-pressure.test.ts` (new)
3. `packages/core/src/index.ts` (modify — export)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
