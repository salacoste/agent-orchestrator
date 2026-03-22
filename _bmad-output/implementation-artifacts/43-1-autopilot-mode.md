# Story 43.1: Autopilot Mode — Supervised Workflow Advancement

Status: ready-for-dev

## Story

As a team lead,
I want the orchestrator to automatically advance workflows when stories complete,
so that I don't have to manually trigger the next agent spawn.

## Acceptance Criteria

1. `autopilot: off | supervised | autonomous` config option (default: off)
2. When a story reaches "done" status, autopilot finds the next backlog story in sprint-status.yaml
3. In `autonomous` mode: auto-enqueues spawn via SpawnQueue (43.3), notifies after
4. In `supervised` mode: sends notification with approve/skip/pause options, 5-min timeout → queued (not auto-approved)
5. In `off` mode: no auto-spawning (current behavior)
6. Autopilot state visible on dashboard (mode + recent actions)
7. If no valid next story exists, autopilot pauses with "No next story" notification
8. Tests verify all 3 modes, story discovery, queue integration, timeout behavior

## Tasks / Subtasks

- [ ] Task A: Backend autopilot engine (AC: #1, #2, #3, #4, #5, #7)
  - [ ] A.1: Add `autopilot?: "off" | "supervised" | "autonomous"` to OrchestratorConfig + Zod schema
  - [ ] A.2: Create `packages/core/src/autopilot.ts` with `createAutopilot(config, queue, notifier)` factory
  - [ ] A.3: Listen for story completion events (subscribe to EventBus or poll sprint-status changes)
  - [ ] A.4: Find next backlog story from sprint-status.yaml (read + parse, find first `backlog` entry)
  - [ ] A.5: Autonomous mode: enqueue spawn via SpawnQueue, send post-facto notification
  - [ ] A.6: Supervised mode: send notification with approve action, 5-min timeout → queue (not approve)
  - [ ] A.7: Off mode: no-op
  - [ ] A.8: No next story: pause autopilot, send "No next story" notification
- [ ] Task B: Dashboard autopilot UI (AC: #6)
  - [ ] B.1: Create `GET /api/autopilot` endpoint returning mode + recent actions
  - [ ] B.2: Create `POST /api/autopilot/mode` to change mode (off/supervised/autonomous)
  - [ ] B.3: Create `useAutopilot()` hook for dashboard
  - [ ] B.4: Create `AutopilotPanel` component showing mode toggle + recent actions
- [ ] Task C: Write tests (AC: #8)
  - [ ] C.1: Test autonomous mode: story done → next story found → spawn enqueued
  - [ ] C.2: Test supervised mode: story done → notification sent → timeout → queued
  - [ ] C.3: Test off mode: story done → nothing happens
  - [ ] C.4: Test no next story → pause + notification
  - [ ] C.5: Test sprint-status.yaml parsing for next backlog story

## Dev Notes

### Architecture Constraints

- **SpawnQueue from 43.3** — autopilot enqueues via `getSpawnQueue().enqueue()`, NOT direct `sessionManager.spawn()`
- **Notification service** — existing `NotificationService` in core for sending notifications
- **Sprint-status.yaml** — read with `readFileSync` + yaml parse to find next backlog story
- **Event-driven** — subscribe to story completion events via EventPublisher or SSE
- **Config-based mode** — `autopilot: off | supervised | autonomous` in agent-orchestrator.yaml

### Implementation Approach

The autopilot engine is a service that:
1. Subscribes to story completion (via event bus or polling sprint-status changes)
2. On completion: reads sprint-status.yaml, finds first `backlog` story
3. Based on mode: auto-spawn (autonomous), notify-and-wait (supervised), or no-op (off)
4. Supervised timeout: after 5 minutes without approval, queue the spawn (don't auto-approve — party mode decision)

For the dashboard: a simple panel showing current mode with a dropdown toggle, and a list of recent autopilot actions (last 10).

### Party Mode Decisions Applied

- Autopilot is STORY-LEVEL (sprint-status driven), not phase-level (state-machine driven)
- Three modes: off / supervised / autonomous
- Supervised timeout → queue (not auto-approve)
- All spawns go through SpawnQueue (no direct sessionManager.spawn)
- Subtask A (backend) + Subtask B (dashboard) within one story

### Files to Create/Modify

1. `packages/core/src/types.ts` (modify — add autopilot config)
2. `packages/core/src/config.ts` (modify — add to Zod schema)
3. `packages/core/src/autopilot.ts` (new — autopilot engine)
4. `packages/core/src/__tests__/autopilot.test.ts` (new — tests)
5. `packages/core/src/index.ts` (modify — export)
6. `packages/web/src/app/api/autopilot/route.ts` (new — GET status)
7. `packages/web/src/app/api/autopilot/mode/route.ts` (new — POST mode change)
8. `packages/web/src/hooks/useAutopilot.ts` (new — dashboard hook)
9. `packages/web/src/components/AutopilotPanel.tsx` (new — dashboard component)
10. `agent-orchestrator.yaml.example` (modify — add autopilot)

### References

- [Source: packages/core/src/spawn-queue.ts] — SpawnQueue (43.3)
- [Source: packages/core/src/event-publisher.ts] — story completion events
- [Source: packages/core/src/notification-service.ts] — notification sending

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
