# Story 40.3: ConflictCheckpointPanel Real Git Data

Status: ready-for-dev

## Story

As a dashboard user monitoring parallel agent work,
I want the ConflictCheckpointPanel to show real file conflicts and checkpoints from active sessions,
so that I can see actual merge risk and have rollback options.

## Acceptance Criteria

1. ConflictCheckpointPanel receives real conflict data from active sessions' modified files
2. Conflicts detected by comparing `filesModified` across concurrent sessions using `detectFileConflicts()`
3. Checkpoint timeline shows real git commits from session worktrees (if available)
4. WorkflowDashboard passes real data instead of `conflicts={[]} timeline={null}`
5. Tests verify conflict detection from session data and fallback paths

## Tasks / Subtasks

- [ ] Task 1: Create API endpoint for conflict/checkpoint data (AC: #1, #2, #3)
  - [ ] 1.1: Create `GET /api/sprint/conflicts` route
  - [ ] 1.2: Query sessions for `filesModified` metadata, map to `AgentFileChange[]`
  - [ ] 1.3: Call `detectFileConflicts()` for conflict list
  - [ ] 1.4: Build checkpoint timeline from first active session's git log (if worktree available)
- [ ] Task 2: Create useConflictCheckpoint hook (AC: #4)
  - [ ] 2.1: Create `useConflictCheckpoint()` hook fetching `/api/sprint/conflicts`
  - [ ] 2.2: Return `{ conflicts, timeline }` state, poll every 30s
- [ ] Task 3: Wire into WorkflowDashboard (AC: #4)
  - [ ] 3.1: Replace `conflicts={[]} timeline={null}` with real data from hook
- [ ] Task 4: Write tests (AC: #5)
  - [ ] 4.1: Test API route returns conflicts from overlapping session files
  - [ ] 4.2: Test empty conflicts when no file overlap
  - [ ] 4.3: Test fallback when no sessions active

## Dev Notes

### Architecture Constraints

- **`detectFileConflicts(changes: AgentFileChange[])`** — takes `{ agentId, filePath }[]`, returns `FileConflict[]`
- **Session metadata** — `session.metadata["filesModified"]` or learning store has `filesModified` arrays
- **Checkpoint data** — requires git log from worktree. `execFile("git", ["log", ...])` in the API route.
- **ConflictCheckpointPanel** — expects `FileConflict[]` and `CheckpointTimeline | null`

### Implementation Approach

The conflict detection uses `AgentFileChange[]` format. For each active session, we can get modified files from:
1. `session.agentInfo?.summary` (may mention files)
2. Session metadata (if filesModified is tracked)
3. Git diff in session worktree (most accurate but requires filesystem access)

Simplest approach: query `SessionLearning` records from learning store — they have `filesModified[]` per session. For currently-active sessions without learnings yet, fall back to empty.

For checkpoints: `git log --oneline` on the first active session's worktree path.

### Files to Create/Modify

1. `packages/web/src/app/api/sprint/conflicts/route.ts` (new)
2. `packages/web/src/hooks/useConflictCheckpoint.ts` (new)
3. `packages/web/src/components/WorkflowDashboard.tsx` (modify)
4. `packages/web/src/app/api/sprint/conflicts/route.test.ts` (new)

### References

- [Source: packages/web/src/lib/workflow/conflict-detector.ts] — detectFileConflicts()
- [Source: packages/web/src/lib/workflow/checkpoint-tracker.ts] — CheckpointTimeline, Checkpoint
- [Source: packages/web/src/components/ConflictCheckpointPanel.tsx] — the component

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
