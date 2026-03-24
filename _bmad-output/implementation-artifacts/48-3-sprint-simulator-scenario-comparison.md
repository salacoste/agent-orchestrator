# Story 48.3: Sprint Simulator — Scenario Comparison

Status: done

## Story

As a team lead evaluating trade-offs,
I want to compare multiple simulation scenarios side by side,
so that I can choose the best scope for the sprint.

## Acceptance Criteria

1. `compareScenarios(scenarios)` accepts 2+ simulation results
2. Side-by-side comparison: completion probability, risk level, cost estimate
3. Recommended scenario highlighted (highest on-time probability)
4. Pure function (testable)
5. Tests verify comparison, ranking, and recommendation

## Tasks / Subtasks

- [ ] Task 1: Create scenario comparator (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `packages/core/src/scenario-comparator.ts`
  - [ ] 1.2: `Scenario`: name, stories, simulationResult, color
  - [ ] 1.3: `compareScenarios(scenarios)` → ranked list with recommendation
  - [ ] 1.4: Recommend scenario with highest onTimeProbability
- [ ] Task 2: Write tests (AC: #5)
  - [ ] 2.1: Test comparison ranks by probability
  - [ ] 2.2: Test recommendation picks best
  - [ ] 2.3: Test with identical scenarios

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
scenario-comparator.ts (pure)
  ├── Scenario: { name, storyCount, result: SimulationResult, color }
  ├── ScenarioComparison: { scenarios: RankedScenario[], recommendedIndex }
  └── compareScenarios(scenarios) → ScenarioComparison
```

### Files to Create

1. `packages/core/src/scenario-comparator.ts` (new)
2. `packages/core/src/__tests__/scenario-comparator.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
