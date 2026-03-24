# Story 48.2: Sprint Simulator API & Dashboard

Status: done

## Story

As a team lead,
I want the simulation results displayed on the dashboard,
so that I can make data-driven scope decisions.

## Acceptance Criteria

1. `GET /api/sprint/simulate?iterations=N` returns simulation results
2. Color coding: green (>80%), amber (50-80%), red (<50%) on-time probability
3. Simulation runs on demand (not automatically)
4. API uses simulateSprint from 48.1
5. Tests verify API route and color coding logic

## Tasks / Subtasks

- [ ] Task 1: Create simulation API route (AC: #1, #3, #4)
  - [ ] 1.1: Create `packages/web/src/app/api/sprint/simulate/route.ts`
  - [ ] 1.2: Accept `?iterations=N` query param (default: 1000, max: 10000)
  - [ ] 1.3: Gather stories from sprint status, learnings from store
  - [ ] 1.4: Call simulateSprint and return results with color
- [ ] Task 2: Create color coding utility (AC: #2)
  - [ ] 2.1: Add `getSimulationColor(onTimeProbability)` to sprint-simulator.ts
  - [ ] 2.2: green >0.8, amber 0.5-0.8, red <0.5
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test API route returns simulation results
  - [ ] 3.2: Test color coding thresholds
  - [ ] 3.3: Test default iterations

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
API route (wiring)
  └── GET /api/sprint/simulate?iterations=1000 → simulateSprint + color

sprint-simulator.ts (extended)
  └── getSimulationColor(probability) → "green" | "amber" | "red"
```

### Files to Create

1. `packages/web/src/app/api/sprint/simulate/route.ts` (new)
2. `packages/web/src/app/api/sprint/simulate/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/sprint-simulator.ts` — add getSimulationColor
2. `packages/core/src/index.ts` — export getSimulationColor

### References

- [Source: packages/core/src/sprint-simulator.ts] — simulateSprint engine
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 48.2] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
