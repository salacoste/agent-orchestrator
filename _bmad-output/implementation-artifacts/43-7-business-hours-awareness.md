# Story 43.7: Business Hours Awareness — Time-Sensitive Spawning

Status: ready-for-dev

## Story

As a team operating across timezones,
I want autopilot spawning to respect business hours,
so that agents don't spawn during off-hours when no one can respond to issues.

## Acceptance Criteria

1. `businessHours: { start: "09:00", end: "18:00", timezone: "UTC" }` in config
2. Autopilot queues spawns outside business hours until next window
3. Manual spawns are NOT restricted (only autopilot)
4. Config is optional (default: 24/7 — no restriction)
5. Tests verify in-hours/out-of-hours/default behavior

## Tasks / Subtasks

- [ ] Task 1: Create business hours checker (AC: #1, #2, #4)
  - [ ] 1.1: Create `packages/core/src/business-hours.ts` with `isWithinBusinessHours(config, now?)` pure function
  - [ ] 1.2: Parse "HH:MM" start/end times, compare against current time in configured timezone
  - [ ] 1.3: Return false if outside hours, true if within or no config (24/7)
- [ ] Task 2: Integrate with autopilot (AC: #2, #3)
  - [ ] 2.1: In autopilot.ts `onStoryCompleted()`, check business hours before enqueue
  - [ ] 2.2: If outside hours, log "Queued until business hours" and defer
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test within hours returns true
  - [ ] 3.2: Test outside hours returns false
  - [ ] 3.3: Test no config returns true (24/7)
  - [ ] 3.4: Test overnight hours (start > end, e.g. 22:00-06:00)

## Dev Notes

### Architecture

- Pure function — no side effects. Takes config + optional `now` Date for testability.
- Timezone handling: compare in UTC. Config specifies timezone offset.
- Integrates with autopilot (43.1) — business hours check is an additional gate before enqueue.

### Files to Create/Modify

1. `packages/core/src/business-hours.ts` (new)
2. `packages/core/src/__tests__/business-hours.test.ts` (new)
3. `packages/core/src/index.ts` (modify — export)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
