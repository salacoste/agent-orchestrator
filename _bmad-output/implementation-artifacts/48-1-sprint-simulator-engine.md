# Story 48.1: Sprint Simulator Engine — Monte Carlo Core

Status: done

## Story

As a team lead planning a sprint,
I want to simulate sprint outcomes using historical data,
so that I can see the probability distribution of completion dates.

## Acceptance Criteria

1. `simulateSprint(backlog, learnings, iterations)` runs Monte Carlo simulation
2. Returns P50, P80, P95 completion estimates (in days)
3. Probability of completing on time based on sprint end date
4. Samples story durations from historical sessions with matching domain tags
5. Configurable default distribution when insufficient data
6. Confidence indicator based on data coverage
7. Tests verify simulation, percentiles, and insufficient-data fallback

## Tasks / Subtasks

- [ ] Task 1: Create simulator engine (AC: #1, #2, #3, #4, #5, #6)
  - [ ] 1.1: Create `packages/core/src/sprint-simulator.ts`
  - [ ] 1.2: Monte Carlo loop: for each iteration, sample durations for each story
  - [ ] 1.3: Duration sampling: match by domainTags, fallback to configurable default
  - [ ] 1.4: Compute percentiles (P50, P80, P95) from iteration results
  - [ ] 1.5: Compute on-time probability from sprint end date
  - [ ] 1.6: Confidence: ratio of stories with matching historical data
- [ ] Task 2: Write tests (AC: #7)
  - [ ] 2.1: Test simulation produces valid percentiles
  - [ ] 2.2: Test with sufficient historical data
  - [ ] 2.3: Test fallback for no matching data
  - [ ] 2.4: Test confidence indicator
  - [ ] 2.5: Test on-time probability

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
sprint-simulator.ts (pure — no I/O)
  ├── SimulationInput: { stories, learnings, iterations, sprintEndDate?, defaultDurationMs }
  ├── SimulationResult: { p50, p80, p95, onTimeProbability, confidence, iterations }
  └── simulateSprint(input) → SimulationResult
```

### Monte Carlo Algorithm

```
for i in 1..iterations:
  totalDays = 0
  for story in backlog:
    duration = sampleDuration(story.domainTags, learnings) or defaultDuration
    totalDays += duration
  results.push(totalDays)

sort(results)
p50 = results[iterations * 0.50]
p80 = results[iterations * 0.80]
p95 = results[iterations * 0.95]
```

### Duration Sampling

- Find learnings with overlapping domainTags + outcome="completed"
- Pick random entry's durationMs
- If no matches, use `defaultDurationMs` (configurable, default: 4 hours)

### Seeded Random (for reproducible tests)

Use simple LCG for deterministic tests: `seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF`

### Files to Create

1. `packages/core/src/sprint-simulator.ts` (new)
2. `packages/core/src/__tests__/sprint-simulator.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 48.1] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
