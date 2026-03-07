# Story 4.4: Graceful Degradation Mode

Status: ready-for-dev

## Story

As a Developer,
I want the system to continue operating in degraded mode when services are unavailable,
so that partial functionality is maintained instead of complete failure.

## Acceptance Criteria

1. **Given** event bus becomes unavailable
   - Enter "degraded mode: event-bus-unavailable"
   - Display warning, log to local file
   - CLI commands continue to function (NFR-R2)

2. **Given** BMAD tracker becomes unavailable
   - Enter "degraded mode: bmad-unavailable"
   - Queue sync operations with timestamps
   - Local state updates continue

3. **Given** event bus recovers
   - Exit degraded mode
   - Drain queued events within 30s (NFR-SC6)

4. **Given** both services unavailable
   - "degraded mode: multiple-services-unavailable"
   - Core CLI operations continue
   - Dashboard shows degraded status

5. **Given** I run `ao health` in degraded mode
   - Show overall status: "Degraded"
   - List service availability
   - Show queued operations

## Tasks / Subtasks

- [ ] Create DegradedMode service
  - [ ] Track service availability
  - [ ] Enter/exit degraded mode per service
  - [ ] Queue operations for later
  - [ ] Fallback to local storage
- [ ] Implement event bus fallback
  - [ ] Log to events.jsonl
  - [ ] Queue in-memory events
- [ ] Implement BMAD fallback
  - [ ] Queue sync operations
  - [ ] Continue local state updates
- [ ] Implement recovery
  - [ ] Drain queued events on reconnect
  - [ ] Handle conflicts (timestamp-based)
- [ ] CLI command `ao health`
  - [ ] Show degraded status
  - [ - Service availability
- [ ] Write unit tests

## Dev Notes

### Degraded Mode States

```typescript
type DegradedMode =
  | "normal"
  | "event-bus-unavailable"
  | "bmad-unavailable"
  | "multiple-services-unavailable";
```

### CLI Output

```
Overall: Degraded
├─ Event bus: ❌ Unavailable
├─ BMAD tracker: ❌ Unavailable
├─ Local state: ✅ Operational
└─ Queued: 12 events, 5 syncs
```

### Dependencies

- Story 2.1 (Redis Event Bus) - Service being monitored
- Story 2.8 (State Sync) - Service being monitored

## Dev Agent Record

_(To be filled by Dev Agent)_
