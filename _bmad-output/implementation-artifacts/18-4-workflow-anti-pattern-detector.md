# Story 18.4: Workflow Anti-Pattern Detector

Status: done

## Story

As a **PM**,
I want the system to detect workflow anti-patterns and surface coaching nudges,
So that common BMAD mistakes are prevented.

## Acceptance Criteria

1. **AC1: Anti-pattern rules defined**
   - **Given** the project's workflow history and artifact state
   - **When** anti-pattern analysis runs
   - **Then** it detects: "PRD edited 5+ times without advancing", "Architecture skipped", "Missing acceptance criteria"
   - **And** each pattern has a unique ID, description, and severity

2. **AC2: Nudges displayed as non-blocking banners**
   - **Given** an anti-pattern is detected
   - **When** the dashboard renders
   - **Then** a dismissible banner appears with the coaching nudge
   - **And** max 1 nudge per pattern per day (frequency controlled)

3. **AC3: Nudges don't block workflow progression**
   - **Given** anti-pattern nudges are shown
   - **When** the user ignores them
   - **Then** workflow continues normally — nudges are advisory only

## Tasks / Subtasks

- [ ] Task 1: Define anti-pattern rules as data (similar to recommendation engine)
  - [ ] 1.1: Create `anti-patterns.ts` with rule definitions
  - [ ] 1.2: Rules evaluate artifact state + history for known bad patterns
- [ ] Task 2: Add nudge display to dashboard
  - [ ] 2.1: Render dismissible banner in WorkflowDashboard
  - [ ] 2.2: Track dismissed patterns in localStorage (per-day frequency limit)
- [ ] Task 3: Write tests
- [ ] Task 4: Validate

## Dev Notes

### Foundation: WorkflowStateMachine + artifact scanner provide all needed data
Anti-patterns can be evaluated as additional rules in the recommendation engine or as a separate module.

### Source Files
- `packages/web/src/lib/workflow/` — new `anti-patterns.ts` module
- `packages/web/src/components/WorkflowDashboard.tsx` — render nudge banners

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
