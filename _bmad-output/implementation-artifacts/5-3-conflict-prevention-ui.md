# Story 5.3: Conflict Prevention UI

Status: ready-for-dev

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

- [ ] Implement conflict check before spawn
- [ ] Block spawn with conflict message
- [ ] `--force` flag to override
- [ ] Auto-resolution config option
- [ ] Write unit tests

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

_(To be filled by Dev Agent)_
