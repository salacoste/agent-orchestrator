# Story 43.2: Sprint Forecaster — Predictive Completion Probability

Status: ready-for-dev

## Story

As a team lead,
I want to see the probability of completing the sprint on time,
so that I can adjust scope or resources before it's too late.

## Acceptance Criteria

1. `GET /api/sprint/forecast` returns P50/P80/P95 completion date estimates
2. Forecast uses domain-matched sampling from the learning store (party mode decision)
3. Confidence indicator: high (≥20 records), medium (10-19), low (5-9), insufficient (<5)
4. When learning store has <5 records, return configurable default estimates
5. Dashboard component shows forecast with color-coded probability bars
6. Tests verify forecast computation, domain matching, cold start fallback

## Tasks / Subtasks

- [ ] Task 1: Create forecast computation module (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `packages/core/src/sprint-forecaster.ts` with `computeForecast()` pure function
  - [ ] 1.2: Sample story durations from learning store, matched by `domainTags`
  - [ ] 1.3: Compute P50/P80/P95 from sorted duration samples (percentile calculation)
  - [ ] 1.4: Confidence scoring based on sample count
  - [ ] 1.5: Cold start: use configurable `defaultStoryDurationMs` when insufficient data
- [ ] Task 2: Create API endpoint (AC: #1)
  - [ ] 2.1: Create `GET /api/sprint/forecast` route
  - [ ] 2.2: Query learning store + sprint-status for backlog count
  - [ ] 2.3: Call `computeForecast()` and return results
- [ ] Task 3: Write tests (AC: #6)
  - [ ] 3.1: Test forecast with sufficient data produces valid percentiles
  - [ ] 3.2: Test domain matching filters relevant sessions
  - [ ] 3.3: Test cold start fallback with <5 records
  - [ ] 3.4: Test confidence levels at threshold boundaries
  - [ ] 3.5: Test P50 < P80 < P95 ordering invariant

## Dev Notes

### Architecture

- **Pure function** — `computeForecast(backlogStories, learnings, defaultDurationMs)` returns percentiles
- **Domain matching** — match backlog story's domain tags against historical sessions with same tags (party mode: Winston's approach)
- **No Monte Carlo in this story** — that's Epic 48. This story uses percentile computation on historical data directly.
- **Learning store** already wired in 39.4 with `getLearningStore()`

### Implementation Approach

For each backlog story, estimate duration by:
1. Find historical sessions with matching domain tags
2. If matches found: use their `durationMs` values
3. If no matches: use `defaultStoryDurationMs` (configurable, default 2h)
4. Sum estimated durations for all backlog stories
5. Sort all possible totals, compute P50/P80/P95

Simple percentile: sort durations, P50 = median, P80 = 80th percentile index, P95 = 95th.

### Files to Create/Modify

1. `packages/core/src/sprint-forecaster.ts` (new)
2. `packages/core/src/__tests__/sprint-forecaster.test.ts` (new)
3. `packages/core/src/index.ts` (modify — export)
4. `packages/web/src/app/api/sprint/forecast/route.ts` (new)

### References

- [Source: packages/core/src/learning-store.ts] — SessionLearning with durationMs, domainTags
- [Source: packages/web/src/app/api/sprint/cost/route.ts] — similar API route pattern

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
