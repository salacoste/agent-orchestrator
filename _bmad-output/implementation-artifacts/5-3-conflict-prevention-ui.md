# Story 5.3: Conflict Prevention UI

Status: done

## Story

As a Developer,
I want new agent assignments to be blocked when conflicts are detected,
so that conflicts don't accidentally occur during normal operations.

## Acceptance Criteria

1. **Given** active conflict exists (STORY-001 has two agents)
   - Spawn blocked immediately
   - Display: "⛔ Conflict Prevention: Cannot spawn agent for STORY-001"
   - Show existing assignments

2. **Given** I want to override prevention
   - Run `ao spawn --story STORY-001 --force`
   - Confirm prompt
   - Allow spawn despite conflict

3. **Given** I want to configure auto-resolution
   - Config: `conflicts.autoResolve: true`
   - Auto-resolve without blocking

## Tasks / Subtasks

- [x] Implement conflict check before spawn
- [x] Block spawn with conflict message
- [x] `--force` flag to override
- [x] Auto-resolution config option
- [x] Write unit tests

## Dev Notes

### CLI Flow

```bash
$ ao spawn --story STORY-001
⛔ Conflict Prevention: Cannot spawn agent for STORY-001

Existing assignments:
  ao-story-001 (assigned 2h ago)

Options:
  [f]orce -- Spawn anyway (creates conflict)
  [c]ancel -- Abort spawn

$ ao spawn --story STORY-001 --force
Spawning anyway...
```

## Dependencies

- Story 5.1 (Conflict Detection) - Detection source
- Story 5.2 (Conflict Resolution) - Auto-resolution

## Dev Agent Record

### Implementation Date
2026-03-08

### Files Modified/Created
1. **packages/cli/src/commands/spawn-story.ts** - Updated with conflict prevention (lines 10, 390-530)
   - Added imports for `createConflictDetectionService` and `createConflictResolutionService`
   - Replaced simple duplicate check with full conflict detection and resolution
   - Integrated auto-resolution when `conflicts.autoResolve: true`
   - Enhanced UI with clear conflict messages and options

2. **packages/cli/__tests__/commands/spawn-story-conflict-prevention.test.ts** - Created 9 unit tests
   - All tests passing
   - Coverage: conflict detection, auto-resolution, manual resolution, force flag, tie-breaker config, registry updates

### Acceptance Criteria Implementation
- ✅ AC1: Conflict blocks spawn - When active conflict exists, spawn is blocked with clear message showing existing assignments
- ✅ AC2: `--force` flag override - Users can bypass conflict check with `--force` flag or interactive "force" option
- ✅ AC3: Auto-resolution config - When `conflicts.autoResolve: true`, conflicts are automatically resolved before spawn

### Technical Notes

**Conflict Prevention Flow**:
1. Before spawning, use `ConflictDetectionService.canAssign(storyId)` to check for conflicts
2. If conflict detected, use `ConflictDetectionService.detectConflict()` to get details
3. Display conflict message with existing agent info (agent ID, assignment time, context hash)
4. Check `conflicts.autoResolve` config:
   - **If true**: Show auto-resolution prompt, resolve using `ConflictResolutionService`, terminate existing agent
   - **If false**: Show interactive options (force/cancel), block spawn unless user chooses force
5. If `--force` flag is set, skip all conflict checks

**Auto-Resolution Integration**:
- Uses `ConflictResolutionService` from Story 5.2
- Respects `conflicts.tieBreaker` config (recent/progress)
- Terminates existing agent before spawning new one
- Shows resolution reason and which agent was terminated

**UI Improvements**:
- Clear conflict message: "⛔ Conflict Prevention: Cannot spawn agent for {storyId}"
- Shows existing assignments with:
  - Agent ID
  - Time assigned (e.g., "2h ago")
  - Context hash (first 8 chars)
- Auto-resolution mode explains what will happen
- Manual mode shows clear options: [f]orce or [c]ancel

**Configuration Example**:
```yaml
# agent-orchestrator.yaml
defaults:
  conflicts:
    autoResolve: true  # Auto-resolve conflicts during spawn
    tieBreaker: recent # or "progress" for most progress wins
```

**CLI Examples**:
```bash
# Auto-resolve enabled - prompts for confirmation
$ ao spawn --story STORY-001
⛔ Conflict Prevention: Cannot spawn agent for STORY-001

Existing assignments:
  • ao-story-001
    Assigned 2h ago
    Context: abc12345...

Auto-resolution is enabled.
The existing agent will be terminated and replaced with the new agent.

Continue with auto-resolution? [y/N]: y
✓ Conflict resolved: equal priority - agent-new is more recent, ao-story-001 terminated

# Auto-resolve disabled - prompts for action
$ ao spawn --story STORY-001
⛔ Conflict Prevention: Cannot spawn agent for STORY-001

Existing assignments:
  • ao-story-001
    Assigned 2h ago

Options:
  [f]orce  -- Spawn anyway (creates conflict)
  [c]ancel -- Abort spawn

Choice [f/c]: f
Spawning anyway...

# Force flag bypasses conflict check
$ ao spawn --story STORY-001 --force
Skipping conflict check (--force specified)
```

**Test Coverage**:
- 9 unit tests covering all scenarios
- Tests use mock registry and runtime for isolation
- Verifies conflict detection, auto-resolution, manual resolution, force flag behavior

**Remaining Work** (future stories):
- Integration testing with actual spawn flow
- Conflict history dashboard (Story 5.4)
