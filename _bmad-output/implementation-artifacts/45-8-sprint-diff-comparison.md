# Story 45.8: Sprint Diff — Sprint-Over-Sprint Comparison

Status: review

## Story

As a team lead tracking improvement,
I want to compare two sprints side by side,
so that I can see velocity trends and recurring issues.

## Acceptance Criteria

1. `GET /api/sprint/diff?a=<since1>&b=<since2>` returns comparison of two time periods
2. Comparison shows: stories completed, avg duration, failure rate, top error categories, cost
3. Each metric shows direction: improved, regressed, or unchanged
4. Sprint diff generator is a pure function (testable without side effects)
5. If no data for a period, returns zeros for that period
6. Tests verify comparison logic, direction detection, and API response

## Tasks / Subtasks

- [x] Task 1: Create sprint diff generator (pure function) (AC: #2, #3, #4)
  - [x] 1.1: Create `packages/core/src/sprint-diff.ts`
  - [x] 1.2: Accept SessionLearning[] for period A and B
  - [x] 1.3: Compute: completed count, avg duration, failure rate (3dp), top 5 errors
  - [x] 1.4: Direction with 5% tolerance: higher-is-better vs lower-is-better
- [x] Task 2: Create sprint diff API route (AC: #1, #5)
  - [x] 2.1: Create `packages/web/src/app/api/sprint/diff/route.ts`
  - [x] 2.2: `?a=<ISO>&b=<ISO>` with validation; period A = [a,b), period B = [b,now)
  - [x] 2.3: Fetch all learnings, filter by completedAt timestamp per period
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: 10 diff tests: comparison, improved/regressed/unchanged, empty, errors, rounding
  - [x] 3.2: Direction detection for all 3 states with threshold
  - [x] 3.3: Both periods empty returns all unchanged
  - [x] 3.4: 4 route tests: success, missing params, invalid timestamps, service failure

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

### Architecture — Pure Diff Generator + API Route

```
sprint-diff.ts (pure — no I/O)
  ├── Input: SessionLearning[] for period A and B
  └── Output: SprintDiff { periodA metrics, periodB metrics, directions }

API route (wiring)
  └── Parse date params → LearningStore.query() per period → diff generator → JSON
```

### SprintDiff Interface

```typescript
interface PeriodMetrics {
  storiesCompleted: number;
  avgDurationMs: number;
  failureRate: number;        // 0-1
  topErrorCategories: string[];
  totalTokens: number;        // placeholder — cost data from learning store
}

type Direction = "improved" | "regressed" | "unchanged";

interface MetricComparison {
  periodA: number;
  periodB: number;
  direction: Direction;
}

interface SprintDiff {
  storiesCompleted: MetricComparison;
  avgDuration: MetricComparison;
  failureRate: MetricComparison;
  totalTokens: MetricComparison;
  topErrorsA: string[];
  topErrorsB: string[];
}
```

### Direction Logic

```
storiesCompleted: B > A → improved, B < A → regressed
avgDuration: B < A → improved (faster), B > A → regressed
failureRate: B < A → improved (fewer failures), B > A → regressed
totalTokens: B < A → improved (cheaper), B > A → regressed (direction subjective)
unchanged: |A - B| < threshold (5% tolerance)
```

### API Query Parameters

`GET /api/sprint/diff?a=2026-03-01T00:00:00Z&b=2026-03-15T00:00:00Z`

- `a`: Start of period A (ISO 8601)
- `b`: Start of period B (ISO 8601)
- Both periods run until "now" implicitly — period A = sessions from `a` to `b`, period B = sessions from `b` to now

### Data Source

```typescript
// Period A: sessions between a and b
const periodA = learningStore.query({ sinceMs: nowMs - aMs }).filter(s => s.completedAt < b);
// Period B: sessions after b
const periodB = learningStore.query({ sinceMs: nowMs - bMs });
```

### Anti-Patterns to Avoid

- Do NOT hardcode sprint boundaries — use ISO timestamps
- Do NOT use "sprint1"/"sprint2" string identifiers — use date ranges
- Do NOT add UI — backend only

### Files to Create

1. `packages/core/src/sprint-diff.ts` (new)
2. `packages/core/src/__tests__/sprint-diff.test.ts` (new)
3. `packages/web/src/app/api/sprint/diff/route.ts` (new)
4. `packages/web/src/app/api/sprint/diff/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export computeSprintDiff)

### References

- [Source: packages/core/src/types.ts:1432-1459] — SessionLearning
- [Source: packages/core/src/learning-store.ts] — query with sinceMs
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.8] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure computeSprintDiff() with MetricComparison pattern: periodA, periodB, direction
- compare() function supports higher-is-better and lower-is-better with 5% unchanged threshold
- computePeriodMetrics() aggregates: completed count, avg duration, failure rate, top 5 errors
- Failure rate rounded to 3 decimal places for precision
- Route validates both ?a= and ?b= ISO params, returns 400 for missing or invalid
- Period splitting: completedAt >= a and < b for period A, >= b for period B
- Exported: computeSprintDiff, SprintDiff, MetricComparison, Direction
- 14 new tests (10 diff + 4 route), zero regressions

### File List

- packages/core/src/sprint-diff.ts (new)
- packages/core/src/__tests__/sprint-diff.test.ts (new)
- packages/core/src/index.ts (modified — export computeSprintDiff)
- packages/web/src/app/api/sprint/diff/route.ts (new)
- packages/web/src/app/api/sprint/diff/route.test.ts (new)
