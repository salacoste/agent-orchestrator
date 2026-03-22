# Story 40.2: SprintCostPanel Real Token Data

Status: review

## Story

As a team lead monitoring sprint costs on the dashboard,
I want the SprintCostPanel to show real token usage from active agent sessions,
so that I can track actual spending and identify runaway agents.

## Acceptance Criteria

1. SprintCostPanel receives real cost data from session token usage
2. Cost data computed from `session.agentInfo.cost` via `computeSprintCost()`
3. Sprint clock shows time remaining based on sprint-status.yaml `generated` date
4. WorkflowDashboard passes real cost and clock data instead of `null`
5. Tests verify cost computation and dashboard wiring

## Tasks / Subtasks

- [x] Task 1: Create API endpoint for sprint cost data (AC: #1, #2, #3)
  - [x] 1.1: Create `GET /api/sprint/cost` route
  - [x] 1.2: Query `sessionManager.list()` for active sessions with agentInfo.cost
  - [x] 1.3: Map session cost data to `TokenUsage[]` format
  - [x] 1.4: Call `computeSprintCost()` for cost summary
  - [x] 1.5: Call `computeSprintClock()` with earliest session as sprint start
- [x] Task 2: Create useSprintCost hook (AC: #4)
  - [x] 2.1: Create `useSprintCost()` hook that fetches `/api/sprint/cost`
  - [x] 2.2: Return `{ cost, clock }` state, poll every 30s
- [x] Task 3: Wire into WorkflowDashboard (AC: #4)
  - [x] 3.1: Replace `cost={null} clock={null}` with real data from hook
- [x] Task 4: Write tests (AC: #5)
  - [x] 4.1: Test API route returns cost summary from sessions (token totals, agents, burn rate)
  - [x] 4.2: Test empty cost when no sessions have cost data
  - [x] 4.3: Test sprint clock computation + status field
  - [x] 4.4: Test merged sessions counted as done stories
  - [x] 4.5: Test graceful fallback on error
  - [x] 4.6: Updated WorkflowPage tests for sprint cost fetch count

## Dev Notes

### Architecture Constraints

- **Session.agentInfo.cost** — `CostEstimate { inputTokens, outputTokens, estimatedCostUsd }` from `types.ts:407`
- **cost-tracker.ts** — has `computeSprintCost(usages: TokenUsage[])` and `computeSprintClock(endDate, done, total, avgDuration)`
- **SprintCostPanel** — expects `SprintCostSummary | null` and `SprintClock | null` as props
- **No `node:` imports in client** — hook uses fetch, API route does the server work

### Implementation Approach

**API route** (`/api/sprint/cost`):
- Get sessions via `sessionManager.list()`
- Map each session with `agentInfo?.cost` to `TokenUsage` format
- Call `computeSprintCost()` for summary
- Sprint dates: use config's `generated` date + 14 days as sprint end (configurable)

**Hook** (`useSprintCost`):
- `fetch("/api/sprint/cost")` on mount + 30s interval
- Returns `{ cost: SprintCostSummary | null, clock: SprintClock | null }`

### Files to Create/Modify

1. `packages/web/src/app/api/sprint/cost/route.ts` (new)
2. `packages/web/src/hooks/useSprintCost.ts` (new)
3. `packages/web/src/components/WorkflowDashboard.tsx` (modify)
4. `packages/web/src/app/api/sprint/cost/route.test.ts` (new)

### References

- [Source: packages/web/src/lib/workflow/cost-tracker.ts] — cost computation functions
- [Source: packages/web/src/components/SprintCostPanel.tsx] — the component
- [Source: packages/core/src/types.ts#CostEstimate] — token cost data in sessions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created GET /api/sprint/cost route: queries sessions for CostEstimate data
- Maps session.agentInfo.cost to TokenUsage[], calls computeSprintCost()
- Sprint clock uses earliest session creation + 14 day window
- Created useSprintCost hook with 30s polling
- Wired WorkflowDashboard: SprintCostPanel receives real cost + clock
- Updated WorkflowPage tests: adjusted fetch counts for sprint cost poll
- 6 tests, all 1,159 web tests pass, typecheck clean

### File List

- packages/web/src/app/api/sprint/cost/route.ts (new — cost API)
- packages/web/src/app/api/sprint/cost/route.test.ts (new — 6 tests)
- packages/web/src/hooks/useSprintCost.ts (new — polling hook)
- packages/web/src/components/WorkflowDashboard.tsx (modified — real cost/clock)
- packages/web/src/components/__tests__/WorkflowPage.test.tsx (modified — fetch counts)
