# Story 20.2: Agent Work Checkpoint & Rollback

Status: done

## Story
As a **developer**, I want auto-committed WIP checkpoints every N minutes, So that I can recover from agents going off-rails.

## Acceptance Criteria
1. Configurable `checkpoint.intervalMinutes` (default: 10) creates WIP commits with `[checkpoint]` prefix
2. Dashboard shows checkpoint timeline per agent
3. "Rollback to checkpoint" restores worktree and respawns agent from that point

## Tasks
- [ ] Task 1: Implement periodic WIP commit in agent session (via git)
- [ ] Task 2: Display checkpoint timeline in AgentSessionCard
- [ ] Task 3: Implement rollback action (git reset + respawn)
- [ ] Task 4: Write tests + validate

## Dev Notes
### Source Files
- `packages/core/src/session-manager.ts` — checkpoint timer integration
- `packages/web/src/components/AgentSessionCard.tsx` — timeline + rollback button

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
