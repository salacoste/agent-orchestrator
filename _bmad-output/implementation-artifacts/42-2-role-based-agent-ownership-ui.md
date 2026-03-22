# Story 42.2: Role-Based Agent Ownership UI

Status: ready-for-dev

## Story

As a team lead managing multiple agents in the fleet view,
I want to assign owners to agent sessions and filter by owner,
so that team members know which agents they're responsible for.

## Acceptance Criteria

1. An `AgentOwnership` module stores owner assignments (agentId → owner)
2. Owner assignment/removal functions are available
3. An `OwnerBadge` component displays the assigned owner on agent cards
4. Fleet view can filter agents by owner
5. Tests verify ownership store and UI component

## Tasks / Subtasks

- [ ] Task 1: Create ownership store in collaboration module (AC: #1, #2)
  - [ ] 1.1: Define `AgentOwner` interface (agentId, owner, assignedAt)
  - [ ] 1.2: Add `assignOwner()`, `removeOwner()`, `getOwner()`, `getAgentsByOwner()` functions
  - [ ] 1.3: Emit collaboration events on ownership changes
- [ ] Task 2: Create OwnerBadge component (AC: #3)
  - [ ] 2.1: Component shows owner name/avatar next to agent ID
  - [ ] 2.2: Shows "Unassigned" when no owner
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test ownership store CRUD operations
  - [ ] 3.2: Test OwnerBadge renders owner name
  - [ ] 3.3: Test filtering by owner

## Dev Notes

### Architecture

- Reuse collaboration module pattern (module-level Map, broadcasting)
- OwnerBadge is a small presentational component
- Filter logic is a pure function, not a React hook

### Files to Create/Modify

1. `packages/web/src/lib/workflow/collaboration.ts` (modify — add ownership section)
2. `packages/web/src/components/OwnerBadge.tsx` (new)
3. Tests for both

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
