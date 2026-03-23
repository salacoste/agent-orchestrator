# Story 44.1: Executive View — Role-Based Widget Grid

Status: ready-for-dev

## Story

As a PM or team lead,
I want a dashboard layout customized for my role,
so that I see the most relevant information first.

## Acceptance Criteria

1. Dashboard renders widgets based on role-specific layout configuration
2. Role stored in localStorage, defaults from config, selectable via dropdown (party mode decision)
3. PM default: burndown/cost, blockers, decisions
4. Dev default: phase bar, agents, conflicts, recommendations
5. Lead default: phase bar, burndown, agents, cost, conflicts
6. Role dropdown in dashboard header changes layout immediately
7. Tests verify role-based widget ordering and dropdown behavior

## Tasks / Subtasks

- [ ] Task 1: Create widget registry and role layouts (AC: #1, #3, #4, #5)
  - [ ] 1.1: Define `WidgetId` type and `WIDGET_REGISTRY` mapping widgetId → component
  - [ ] 1.2: Define `ROLE_LAYOUTS: Record<UserRole, WidgetId[]>` with default orderings
  - [ ] 1.3: Create `getWidgetLayout(role)` function returning ordered widget list
- [ ] Task 2: Create role selector (AC: #2, #6)
  - [ ] 2.1: Create `useUserRole()` hook reading from localStorage with config fallback
  - [ ] 2.2: Create `RoleSelector` dropdown component for dashboard header
- [ ] Task 3: Refactor WorkflowDashboard to use widget grid (AC: #1)
  - [ ] 3.1: Replace hardcoded widget layout with dynamic rendering from role layout
  - [ ] 3.2: Each widget rendered via registry lookup
- [ ] Task 4: Write tests (AC: #7)
  - [ ] 4.1: Test role layouts return correct widget order
  - [ ] 4.2: Test useUserRole reads localStorage and falls back to default
  - [ ] 4.3: Test RoleSelector changes role

## Dev Notes

### Architecture (Party Mode Decisions)

- **localStorage for role** — no auth needed. Config `userRole` is the default, localStorage overrides.
- **Widget grid** — same components, different ARRANGEMENT per role.
- **`minLevel` per widget** — each widget declares its experience level (beginner/intermediate/advanced/expert) for Story 44.5 progressive UI.

### Files to Create/Modify

1. `packages/web/src/lib/workflow/widget-registry.ts` (new — widget IDs + role layouts)
2. `packages/web/src/hooks/useUserRole.ts` (new — localStorage + config fallback)
3. `packages/web/src/components/RoleSelector.tsx` (new — dropdown)
4. `packages/web/src/components/WorkflowDashboard.tsx` (modify — dynamic widget rendering)
5. Tests for widget registry and role hook

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
