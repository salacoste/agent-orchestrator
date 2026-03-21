# Story 19.2: Agent Recovery Actions

Status: done

## Story

As a **tech lead**,
I want one-click recovery actions for stuck agents,
So that I can resolve issues without manual terminal access.

## Acceptance Criteria

1. **AC1: Ping action sends nudge**
   - **Given** a stuck agent
   - **When** I click "Ping"
   - **Then** the system checks if the agent is still alive and updates status

2. **AC2: Restart with context**
   - **Given** a stuck agent
   - **When** I click "Restart with context"
   - **Then** the session is killed and respawned with accumulated context

3. **AC3: Reassign returns story to queue**
   - **Given** a stuck agent
   - **When** I click "Reassign"
   - **Then** the agent is killed and the story returns to the queue with boosted priority

## Tasks / Subtasks

- [ ] Task 1: Define recovery action types and API endpoint
- [ ] Task 2: Implement ping (check liveness via Runtime plugin)
- [ ] Task 3: Implement restart (kill + respawn via SessionManager)
- [ ] Task 4: Implement reassign (kill + return story to queue)
- [ ] Task 5: Add recovery buttons to AgentSessionCard dead-agent UI
- [ ] Task 6: Write tests
- [ ] Task 7: Validate

## Dev Notes

### Leverages: SessionManager.kill() + spawn(), AgentRegistry, existing Runtime plugin
Recovery actions are orchestration commands routed through SessionManager.

### Source Files
- `packages/core/src/session-manager.ts` — kill/spawn operations
- `packages/core/src/types.ts` — AgentRegistry interface
- `packages/web/src/components/AgentSessionCard.tsx` — recovery buttons
- New API endpoint for recovery actions

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
