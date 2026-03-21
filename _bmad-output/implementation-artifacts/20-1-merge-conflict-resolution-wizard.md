# Story 20.1: Merge Conflict Resolution Wizard

Status: done

## Story
As a **developer**, I want a visual 3-way merge interface when agents create file conflicts, So that conflicts are resolved in the dashboard.

## Acceptance Criteria
1. Dashboard shows base, Agent A changes, Agent B changes side-by-side when conflict detected
2. AI-generated merge suggestion offered as one-click accept
3. Manual inline editing available for custom resolution

## Tasks
- [ ] Task 1: Detect overlapping file modifications across agent worktrees
- [ ] Task 2: Create 3-way diff component (base + 2 agent versions)
- [ ] Task 3: Generate AI merge suggestion
- [ ] Task 4: Write tests + validate

## Dev Notes
### Source Files
- `packages/web/src/components/` — new MergeConflictWizard component
- `packages/core/src/` — file overlap detection via git worktree comparison

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
