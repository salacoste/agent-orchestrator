# Story 44.4: Sprint Health Score — Composite Metric

Status: ready-for-dev

## Story

As a team lead,
I want a single 0-100 health score for the sprint,
so that I can assess sprint status at a glance.

## Acceptance Criteria

1. Health score 0-100 with color coding (green >70, amber 40-70, red <40)
2. Score computed from: story completion %, blocker count, agent failure rate, cost burn rate (party mode: weighted normalized composite — completion 0.4, others 0.2 each)
3. Hovering shows the score breakdown
4. `GET /api/sprint/health` returns score and components
5. Tests verify score computation, color coding, and component breakdown

## Tasks / Subtasks

- [ ] Task 1: Create health score computation (AC: #1, #2)
  - [ ] 1.1: Create `computeSprintHealth()` pure function in cost-tracker.ts
  - [ ] 1.2: Normalize each component to 0-1 range
  - [ ] 1.3: Weighted sum: completion 0.4, blockers 0.2, failures 0.2, cost 0.2
  - [ ] 1.4: Map to color: green >70, amber 40-70, red <40
- [ ] Task 2: Create API endpoint (AC: #4)
  - [ ] 2.1: Create `GET /api/sprint/health` returning score + components
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test perfect score (all done, no blockers)
  - [ ] 3.2: Test low score (many blockers, failures)
  - [ ] 3.3: Test color mapping at boundaries
  - [ ] 3.4: Test component breakdown values

## Dev Notes

### Architecture (Party Mode Decision)

- **Weighted normalized composite** — hard-coded weights for Cycle 9 (configurable later)
- Pure function in `cost-tracker.ts` alongside existing `computeSprintCost`
- Color: `getHealthColor(score)` returns "green" | "amber" | "red"

### Files to Create/Modify

1. `packages/web/src/lib/workflow/cost-tracker.ts` (modify — add computeSprintHealth)
2. `packages/web/src/app/api/sprint/health/route.ts` (new)
3. Tests

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
