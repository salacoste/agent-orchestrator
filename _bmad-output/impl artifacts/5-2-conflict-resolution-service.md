# Story 5.2: Conflict Resolution Service

Status: ready-for-dev

## Story

As a Developer,
I want the system to automatically resolve conflicts by reassigning agents,
so that all agents remain productive without manual intervention.

## Acceptance Criteria

1. **Given** conflict detected (two agents on STORY-001)
   - Evaluate both agents using priority scoring
   - Lower-priority agent queued for reassignment
   - Higher-priority agent keeps story

2. **Given** agent queued for reassignment
   - Search story queue for available stories
   - Prioritize: no dependencies, high priority, unblocked by completed story
   - Assign agent to best available story

3. **Given** no available stories exist
   - Mark agent as "idle"
   - Monitor for auto-assignment
   - Notification: "ao-story-001 is idle"

4. **Given** I run `ao conflicts --resolve <conflict-id>`
   - Show recommended resolution
   - Prompt for confirmation
   - Execute if confirmed

5. **Given** I run `ao conflicts --resolve <id> --keep ao-story-001`
   - Specified agent retains story
   - Other agent queued for reassignment

6. **Given** auto-resolution enabled in config
   - Automatically resolve without confirmation
   - Send notifications for awareness

## Tasks / Subtasks

- [ ] Create ConflictResolution service
  - [ ] Priority scoring algorithm
  - [ ] Story queue queries
  - [ ] Reassignment logic
  - [ ] Idle agent monitoring
- [ ] CLI commands
  - [ ] `ao conflicts --resolve <id>`
  - [ ] `--keep <agent-id>` flag
  - [ ] `--manual` flag
- [ ] Write unit tests

## Dev Notes

### Priority Score

```typescript
function calculatePriorityScore(agent: Agent, story: Story): number {
  const progressScore = story.completedCriteria / story.totalCriteria;
  const timeSpent = Date.now() - agent.assignedAt;
  const typeScore = agentType === "claude-code" ? 1.0 : 0.8;

  return (progressScore * 0.5) + (timeSpent * 0.000001) + typeScore;
}
```

### CLI Commands

```bash
ao conflicts --resolve <conflict-id>
ao conflicts --resolve <id> --keep ao-story-001
ao conflicts --resolve <id> --manual
```

## Dependencies

- Story 5.1 (Conflict Detection) - Conflict source
- Story 1.5 (Manual Assignment) - Reassignment

## Dev Agent Record

_(To be filled by Dev Agent)_
