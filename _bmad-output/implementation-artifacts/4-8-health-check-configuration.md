# Story 4.8: Health Check Configuration

Status: ready-for-dev

## Story

As a DevOps Engineer,
I want configurable health checks for all system components,
so that I can monitor system health and detect issues early.

## Acceptance Criteria

1. **Given** I run `ao health`
   - Show health status of all components
   - Event bus, BMAD tracker, local state
   - Latency metrics, queue depths

2. **Given** health check fails
   - Exit code 1 (for CI/CD)
   - Display which components failed

3. **Given** I run `ao health --watch`
   - Continuously monitor health
   - Alert on status changes

4. **Given** I configure thresholds
   - Max latency, max queue depth
   - Custom health check rules

## Tasks / Subtasks

- [ ] Create HealthCheck service
  - [ ] Check all system components
  - [ ] Aggregate health status
  - [ ] Exit code 1 on any failure
- [ ] Implement component checks
  - [ ] Event bus: connection, latency
  - [ ] BMAD tracker: availability
  - [ ] Local state: file access, integrity
- [ ] CLI command `ao health [--watch]`
  - [ ] Table output format
  - [ ] Watch mode with alerts
- [ ] Implement configurable thresholds
- [ ] Write unit tests

## Dev Notes

### Health Check Output

```
Component           Status  Latency   Details
─────────────────────────────────────────────────
Event Bus (Redis)   ✅      12ms      Connected
BMAD Tracker       ✅      234ms     Sync OK
Local State         ✅      -         YAML valid
Agent Registry      ✅      -         3 active
```

### Dependencies

- Story 2.1 (Redis Event Bus) - Health check target
- Story 2.8 (State Sync) - Health check target

## Dev Agent Record

_(To be filled by Dev Agent)_
