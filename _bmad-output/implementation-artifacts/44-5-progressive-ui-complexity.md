# Story 44.5: Progressive UI Complexity

Status: ready-for-dev

## Story

As a new user,
I want a simpler dashboard that reveals features as I gain expertise,
so that I'm not overwhelmed on first use.

## Acceptance Criteria

1. User experience level tracked via calendar-day counter in localStorage (party mode decision)
2. Levels: beginner (days 1-3), intermediate (days 4-7), advanced (day 8+)
3. Beginner: only essential widgets shown (phaseBar, recommendation, agents)
4. Intermediate: adds health score, cost, last activity
5. Advanced/expert: shows everything including conflicts, chat
6. "Expert mode" toggle shows all widgets immediately
7. Tests verify level calculation and widget filtering

## Tasks / Subtasks

- [ ] Task 1: Create experience level tracker (AC: #1, #2)
  - [ ] 1.1: Create `useExperienceLevel()` hook with calendar-day counter in localStorage
  - [ ] 1.2: Increment on each unique calendar day the dashboard is opened
  - [ ] 1.3: Return level: beginner/intermediate/advanced/expert
- [ ] Task 2: Filter widgets by experience level (AC: #3, #4, #5)
  - [ ] 2.1: Create `filterWidgetsByLevel(layout, level)` that uses WIDGET_META.minLevel
  - [ ] 2.2: Integrate into WorkflowDashboard widget rendering
- [ ] Task 3: Expert mode toggle (AC: #6)
  - [ ] 3.1: Add "Expert mode" toggle to dashboard header (next to role selector)
  - [ ] 3.2: When toggled, bypass level filtering and show all widgets
- [ ] Task 4: Write tests (AC: #7)
  - [ ] 4.1: Test level calculation from day count
  - [ ] 4.2: Test widget filtering at each level
  - [ ] 4.3: Test expert mode bypass

## Dev Notes

### Architecture (Party Mode Decision)

- **Calendar-day counter in localStorage** — `JSON.parse(localStorage.getItem('ao-active-days') ?? '[]')`. Add today's date if not present. Check array length.
- **WIDGET_META.minLevel** already defined in widget-registry.ts (Story 44.1)
- **Experience levels**: beginner (1-3 days), intermediate (4-7), advanced (8+), expert (manual toggle)

### Files to Create/Modify

1. `packages/web/src/hooks/useExperienceLevel.ts` (new)
2. `packages/web/src/lib/workflow/widget-registry.ts` (modify — add filterWidgetsByLevel)
3. `packages/web/src/components/WorkflowDashboard.tsx` (modify — integrate filtering)
4. Tests

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
