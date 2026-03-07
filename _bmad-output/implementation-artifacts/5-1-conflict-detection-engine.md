# Story 5.1: Conflict Detection Engine

Status: ready-for-dev

## Story

As a Developer,
I want the system to automatically detect when multiple agents are assigned to the same story,
so that conflicts are identified before they cause issues.

## Acceptance Criteria

1. **Given** STORY-001 is assigned to agent "ao-story-001"
   **When** I attempt to spawn another agent for STORY-001
   - Conflict detection engine identifies duplicate assignment
   - Publishes "conflict.detected" event
   - Displays: "⚠️ Conflict detected: STORY-001 is already assigned to ao-story-001"
   - Blocks spawn until confirmation

2. **Given** concurrent spawn operations occur for the same story
   - First spawn acquires lock, succeeds
   - Second spawn detects conflict
   - Logged with timestamps
   - Manual resolution required

3. **Given** I run `ao conflicts`
   - Display all active conflicts
   - Story ID, conflicting agents, duration, recommended resolution
   - Sorted by severity

4. **Given** the system starts with existing conflicts
   - Detect during startup validation
   - Show startup summary

## Tasks / Subtasks

- [ ] Create ConflictDetection service
  - [ ] Track agent assignments in registry
  - [ ] Check for duplicates before spawn
  - [ ] Detect concurrent spawn attempts
  - ] Publish conflict events
- [ ] Implement priority scoring
  - [ ] Calculate based on story progress, time spent
  - [ ] Agent type weighting
- [ ] CLI command `ao conflicts`
  - [ ] List all conflicts
  - [ ] Show resolution recommendations
  - [ ] Sort by severity
- [ ] Write unit tests

## Dev Notes

### Conflict Event Format

```json
{
  "conflictId": "uuid-1",
  "storyId": "STORY-001",
  "existingAgent": "ao-story-001",
  "conflictingAgent": "ao-story-002",
  "type": "duplicate_assignment",
  "priorityScores": { "ao-story-001": 0.8, "ao-story-002": 0.3 }
}
```

### Dependencies

- Story 1.3 (Agent Registry) - Assignment source
- Story 1.2 (Spawn Agent) - Conflict trigger
- Story 3.1 (Notification) - Alert on conflict

## Dev Agent Record

_(To be filled by Dev Agent)_
