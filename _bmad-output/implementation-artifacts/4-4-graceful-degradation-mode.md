# Story 4.4: Graceful Degradation Mode

Status: done

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

- [x] Create DegradedMode service
  - [x] Track service availability
  - [x] Enter/exit degraded mode per service
  - [x] Queue operations for later
  - [x] Fallback to local storage
- [x] Implement event bus fallback
  - [x] Log to events.jsonl
  - [x] Queue in-memory events
- [x] Implement BMAD fallback
  - [x] Queue sync operations
  - [x] Continue local state updates
- [x] Implement recovery
  - [x] Drain queued events on reconnect
  - [x] Handle conflicts (timestamp-based)
- [x] CLI command `ao health`
  - [x] Show degraded status
  - [x] Service availability
- [x] Write unit tests
- [x] Integrate DegradedModeService with EventPublisher and StateManager
- [x] Implement actual queue draining in recovery logic
- [x] Add degraded mode status to web dashboard API
- [x] Wire up actual service health checks

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

### Implementation Summary

Implemented Story 4.4 with all acceptance criteria met:

1. **DegradedMode Service** (`packages/core/src/degraded-mode.ts`)
   - Tracks service availability with health checks
   - Enter/exit degraded mode per service (normal, event-bus-unavailable, bmad-unavailable, multiple-services-unavailable)
   - Queue operations for later (in-memory + file backup to JSONL)
   - Fallback to local storage with automatic recovery

2. **Event Bus Fallback**
   - Logs to `events.jsonl` when event bus unavailable
   - In-memory event queue with configurable max size (default: 1000)
   - Automatic queue draining on service recovery within 30s timeout

3. **BMAD Tracker Fallback**
   - Queues sync operations when BMAD unavailable
   - Sync queue with configurable max size (default: 500)
   - Continues local state updates via StateManager

4. **Recovery Logic**
   - Automatic exit degraded mode when services recover
   - Drain queued events via `getQueuedEvents()` and `clearDrainedEvents()`
   - Drain queued syncs via `getQueuedSyncs()` and `clearDrainedSyncs()`
   - Timestamp-based conflict handling

5. **CLI Health Command** (`packages/cli/src/commands/health.ts`)
   - Shows "Degraded" overall status in degraded mode
   - Lists service availability (event-bus, bmad-tracker, local-state)
   - Shows queued operations count
   - JSON output includes `degradedMode` field

6. **LifecycleManager Integration** (`packages/core/src/lifecycle-manager.ts`)
   - DegradedModeService instantiated and started/stopped with lifecycle
   - Health check for event-bus registered (monitors connection status)
   - Health check for bmad-tracker registered (verifies tracker responsiveness)
   - `getDegradedModeStatus()` method exposed for external access

7. **Web Dashboard API** (`packages/web/src/app/api/sprint/[project]/health/route.ts`)
   - Added `degradedMode` field to health API response
   - Optional field that includes mode, service availability, queued operations
   - Gracefully handles when degraded mode unavailable

### Files Created/Modified

**Created:**
- `packages/core/src/degraded-mode.ts` - DegradedModeService implementation (600 lines)
- `packages/core/src/__tests__/degraded-mode.test.ts` - 29 unit tests
- `packages/cli/src/lib/lifecycle.ts` - Lifecycle manager helper

**Modified:**
- `packages/core/src/index.ts` - Added exports for DegradedModeService and types
- `packages/core/src/lifecycle-manager.ts` - Integrated DegradedModeService with health checks
- `packages/core/src/types.ts` - Added DegradedModeStatus method to LifecycleManager interface
- `packages/cli/src/commands/health.ts` - Added degraded mode status display
- `packages/web/src/app/api/sprint/[project]/health/route.ts` - Added degraded mode status to API
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story 4-4 status

### Test Results

- **Core package**: 670 tests passing (including 29 new degraded-mode tests)
- All test categories passing:
  - Service health checks
  - Event queuing
  - Sync operation queuing
  - State transitions
  - Recovery logic
  - Status reporting
  - Persistence (load from backup files)
- Typecheck: Passing for core package
- ESLint: No lint errors

## Dev Notes
