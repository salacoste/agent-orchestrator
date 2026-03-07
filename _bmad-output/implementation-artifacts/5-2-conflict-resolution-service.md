# Story 5.2: Conflict Resolution Service

Status: ready-for-dev

## Story

As a Developer,
I want conflicts to be automatically resolved using priority-based agent reassignment,
so that duplicate assignments are handled without manual intervention.

## Acceptance Criteria

1. **Given** conflict detected (STORY-001 assigned to two agents)
   - Compare priority scores from Conflict Detection Engine
   - Higher priority agent keeps assignment
   - Lower priority agent is reassigned or terminated
   - Publish "conflict.resolved" event

2. **Given** both agents have equal priority
   - Use tie-breaking rules: most recent assignment wins
   - Or: agent with most progress wins (configurable)
   - Log resolution decision

3. **Given** automatic resolution enabled
   - Config: `conflicts.autoResolve: true`
   - Resolve without blocking
   - Notify user of resolution action

4. **Given** automatic resolution disabled
   - Config: `conflicts.autoResolve: false`
   - Block spawn until manual resolution
   - Show conflict with `ao conflicts` command

5. **Given** agent is terminated due to conflict
   - Graceful shutdown (run cleanup if configured)
   - Update story assignment
   - Log termination reason

## Tasks / Subtasks

- [ ] Create ConflictResolution service
  - [ ] Evaluate conflict using priority scores
  - [ ] Apply tie-breaking rules
  - [ ] Execute resolution (terminate/reassign)
  - [ ] Publish resolution events
- [ ] Implement resolution strategies
  - [ ] Priority-based (keep highest)
  - [ ] Most-recent-wins (configurable)
  - [ ] Most-progress-wins (configurable)
- [ ] Auto-resolution configuration
  - [ ] `conflicts.autoResolve` boolean
  - [ ] `conflicts.tieBreaker` enum (recent|progress)
  - [ ] Per-project override support
- [ ] CLI command `ao resolve <conflict-id>`
  - [ ] Manual resolution trigger
  - [ ] Show resolution options
  - [ ] Apply selected resolution
- [ ] Write unit tests

## Dev Notes

### Resolution Service Interface

```typescript
export interface ConflictResolution {
  resolve(conflict: Conflict): Promise<ResolutionResult>;
  canAutoResolve(): boolean;
  getResolutionStrategy(): ResolutionStrategy;
}

export interface ResolutionResult {
  conflictId: string;
  action: "keep_existing" | "keep_new" | "terminate_both" | "manual";
  keptAgent: string | null;
  terminatedAgent: string | null;
  reason: string;
}
```

### Configuration

```yaml
# agent-orchestrator.yaml
conflicts:
  autoResolve: true
  tieBreaker: recent  # or "progress"
  notifyOnResolution: true
```

### CLI Manual Resolution

```bash
$ ao conflicts
Active Conflicts:
  CONFLICT-001: STORY-001
    Agents: ao-story-001 (priority: 0.8), ao-story-002 (priority: 0.3)
    Detected: 2h ago

$ ao resolve CONFLICT-001
Resolution options:
  [1] Keep ao-story-001 (higher priority)
  [2] Keep ao-story-002 (more recent)
  [3] Terminate both (manual reassignment)

Selected: 1
Terminating ao-story-002...
Conflict resolved. STORY-001 assigned to ao-story-001
```

### Dependencies

- Story 5.1 (Conflict Detection) - Conflict source, priority scores
- Story 1.6 (Agent Completion Detection) - Graceful termination
- Story 3.1 (Notification Service) - Resolution notifications

## Dev Agent Record

_(To be filled by Dev Agent)_
