# Story 4.3: Retry with Exponential Backoff and Circuit Breaker

Status: ready-for-dev

## Story

As a Developer,
I want failed operations to be retried with exponential backoff and circuit breaker protection,
so that transient failures don't cascade and overload the system.

## Acceptance Criteria

1. **Given** a transient error occurs
   **When** the operation fails
   **Then** retry with exponential backoff: 1s, 2s, 4s, 8s, 16s
   - Log each retry attempt

2. **Given** 5 failures occur in succession
   **When** the 5th failure occurs
   **Then** the circuit breaker opens
   - Subsequent operations fail immediately (no retry)
   - Breaker remains open for 30 seconds (AR5)
   - After 30s, enters "half-open" state

3. **Given** a non-transient error occurs
   **When** detected as non-retryable
   - Move directly to DLQ
   - Log as "Non-retryable error"

4. **Given** I run `ao retry --error-id <error-id>`
   - Retry immediately (bypass circuit breaker)
   - Display result

## Tasks / Subtasks

- [ ] Create RetryService with exponential backoff
- [ ] Create CircuitBreaker with state machine
  - CLOSED → OPEN (after threshold) → HALF-OPEN → CLOSED
- [ ] Implement backoff: 1s, 2s, 4s, 8s, 16s
- [ ] Implement non-retryable error detection
- [ ] CLI command `ao retry --error-id`
- [ ] Write unit tests

## Dev Notes

### Circuit Breaker States

```
CLOSED (normal) → [5 failures] → OPEN (pause 30s)
OPEN → [30s elapsed] → HALF-OPEN (probe)
HALF-OPEN → [success] → CLOSED
HALF-OPEN → [failure] → OPEN
```

### Configuration

```yaml
retry:
  maxAttempts: 7
  backoffMs: 1000
  maxBackoffMs: 60000
  circuitBreaker:
    failureThreshold: 5
    openDurationMs: 30000
```

## Dev Agent Record

_(To be filled by Dev Agent)_
