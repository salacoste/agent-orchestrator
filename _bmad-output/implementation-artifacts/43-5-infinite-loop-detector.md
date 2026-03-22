# Story 43.5: Infinite Loop Detector — Agent Cycle Breaker

Status: ready-for-dev

## Story

As a system operator,
I want the orchestrator to detect agents stuck in restart loops,
so that tokens aren't burned on unresolvable issues.

## Acceptance Criteria

1. When an agent is restarted/resumed ≥N times for the same story, status set to "loop-detected"
2. Notification sent: "Agent X appears stuck on story Y — manual investigation needed"
3. Loop detection tracks restart/resume events (session lifecycle), NOT token usage
4. Threshold is configurable (`loopDetectionThreshold`, default: 3)
5. `GET /api/agent/[id]/loop-status` returns loop detection state
6. Tests verify threshold detection, notification, and reset behavior

## Tasks / Subtasks

- [ ] Task 1: Create loop detector module (AC: #1, #3, #4)
  - [ ] 1.1: Create `packages/core/src/loop-detector.ts` with `createLoopDetector(threshold)` factory
  - [ ] 1.2: Track restart/resume count per agentId+storyId pair
  - [ ] 1.3: `recordRestart(agentId, storyId)` → returns true if loop detected
  - [ ] 1.4: `getLoopStatus(agentId)` → returns count, threshold, isLooping
  - [ ] 1.5: `reset(agentId)` → clear count (for manual recovery)
- [ ] Task 2: Wire into resume/restart paths (AC: #1, #2)
  - [ ] 2.1: Check loop detector before sessionManager.restore() in resume route
  - [ ] 2.2: If loop detected, return 429 "loop-detected" instead of proceeding
  - [ ] 2.3: Send notification via notifier system
- [ ] Task 3: Write tests (AC: #6)
  - [ ] 3.1: Test threshold triggers at correct count
  - [ ] 3.2: Test below-threshold allows restart
  - [ ] 3.3: Test reset clears count
  - [ ] 3.4: Test different agents tracked independently

## Dev Notes

### Architecture

- Pure module — Map<string, number> tracking restart counts per `agentId:storyId` key
- Integrates with existing resume route (38.4) and restart route (38.5)
- Config: `loopDetectionThreshold?: number` in OrchestratorConfig (default: 3)

### Files to Create/Modify

1. `packages/core/src/loop-detector.ts` (new)
2. `packages/core/src/__tests__/loop-detector.test.ts` (new)
3. `packages/core/src/index.ts` (modify — export)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
