# Story 42.3: Handoff Protocol Implementation

Status: ready-for-dev

## Story

As a team member handing off work to another person,
I want to package agent states, pending decisions, and context into a handoff bundle,
so that the recipient has everything needed to continue the work.

## Acceptance Criteria

1. A `createHandoff()` function captures agent state, pending decisions, and context
2. A `HandoffBundle` type contains all handoff data with metadata
3. Handoff bundles can be serialized to JSON for transfer
4. Tests verify handoff creation and content completeness

## Tasks / Subtasks

- [ ] Task 1: Create handoff module (AC: #1, #2, #3)
  - [ ] 1.1: Define `HandoffBundle` interface (sender, recipient, agents, decisions, context, timestamp)
  - [ ] 1.2: Implement `createHandoff()` that captures current collaboration state
  - [ ] 1.3: Implement `applyHandoff()` that restores state from a bundle
- [ ] Task 2: Write tests (AC: #4)
  - [ ] 2.1: Test handoff creation captures decisions and claims
  - [ ] 2.2: Test handoff includes agent ownership data
  - [ ] 2.3: Test applyHandoff restores state
  - [ ] 2.4: Test bundle serializes to JSON correctly

## Dev Notes

### Architecture

- Pure module in `packages/web/src/lib/workflow/handoff.ts`
- Reads from collaboration module (decisions, claims, ownership, annotations)
- HandoffBundle is a plain serializable object (no class instances)

### Files to Create

1. `packages/web/src/lib/workflow/handoff.ts` (new)
2. `packages/web/src/lib/workflow/__tests__/handoff.test.ts` (new)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
