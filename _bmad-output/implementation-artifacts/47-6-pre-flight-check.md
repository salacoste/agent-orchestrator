# Story 47.6: Pre-Flight Check — Agent Success Prediction

Status: done

## Story

As a team lead deciding whether to spawn an agent,
I want a success prediction based on historical data,
so that I can avoid spawning agents on stories likely to fail.

## Acceptance Criteria

1. `preFlightCheck(domainTags, acCount, learnings)` returns prediction
2. Predicted success rate from domain-matching historical sessions
3. Estimated duration from matching session averages
4. Risk factors: complexity (AC count), domain novelty, recent failure rate
5. Advisory only — never blocks spawning
6. Tests verify prediction, risk factors, and no-data fallback

## Tasks / Subtasks

- [ ] Task 1: Create pre-flight checker (AC: #1, #2, #3, #4, #5)
  - [ ] 1.1: Create `packages/core/src/pre-flight-check.ts`
  - [ ] 1.2: Match historical sessions by overlapping domainTags
  - [ ] 1.3: Compute success rate from matching sessions
  - [ ] 1.4: Compute avg duration from matching sessions
  - [ ] 1.5: Identify risk factors with severity
- [ ] Task 2: Write tests (AC: #6)
  - [ ] 2.1: Test prediction with matching history
  - [ ] 2.2: Test risk factor detection
  - [ ] 2.3: Test no-data returns optimistic default
  - [ ] 2.4: Test domain novelty detection

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
pre-flight-check.ts (pure — no I/O)
  ├── PreFlightResult: { successRate, estimatedDurationMs, riskFactors[], advisory }
  ├── RiskFactor: { name, severity, description }
  └── preFlightCheck(domainTags, acCount, learnings) → PreFlightResult
```

### Prediction Logic

1. Filter learnings by overlapping domainTags
2. Success rate = completed / total in matching set
3. Duration = average durationMs of matching completed sessions
4. No matches = optimistic default (80% success, domain novelty risk)

### Risk Factors

| Factor | Condition | Severity |
|--------|-----------|----------|
| High complexity | acCount > 7 | medium |
| Domain novelty | 0 matching sessions | high |
| Recent failures | failure rate > 40% in last 10 | high |
| Low sample | < 3 matching sessions | low |

### Files to Create

1. `packages/core/src/pre-flight-check.ts` (new)
2. `packages/core/src/__tests__/pre-flight-check.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.6] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
