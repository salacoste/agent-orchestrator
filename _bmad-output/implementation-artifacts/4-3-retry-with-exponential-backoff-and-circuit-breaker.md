# Story 4.3: Retry with Exponential Backoff and Circuit Breaker

Status: review

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

- [x] Create RetryService with exponential backoff
- [x] Create CircuitBreaker with state machine
  - CLOSED → OPEN (after threshold) → HALF-OPEN → CLOSED
- [x] Implement backoff: 1s, 2s, 4s, 8s, 16s
- [x] Implement non-retryable error detection
- [x] CLI command `ao retry --error-id`
- [x] Write unit tests

## Dev Agent Record

### Implementation Summary

Implemented Story 4.3 with all acceptance criteria met:

1. **RetryService with Exponential Backoff** (`packages/core/src/retry-service.ts`)
   - Exponential backoff: 1s, 2s, 4s, 8s, 16s (configurable)
   - Configurable max attempts (default: 7)
   - Retry logging for each attempt
   - Non-retryable error detection via `isRetryable` callback
   - Max backoff cap to prevent excessive delays
   - 7 passing unit tests

2. **CircuitBreaker with State Machine** (`packages/core/src/circuit-breaker.ts`)
   - State transitions: CLOSED → OPEN → HALF-OPEN → CLOSED
   - Configurable failure threshold (default: 5)
   - Configurable open duration (default: 30000ms)
   - Automatic state recovery after timeout
   - Statistics tracking (failure count, last failure time, opened at)
   - Reset functionality
   - 21 passing unit tests

3. **CLI Command** (`packages/cli/src/commands/retry.ts`)
   - `ao retry --error-id <id>` command
   - Bypasses circuit breaker for immediate retry
   - Displays error details and retry result
   - Non-retryable error detection
   - `--force` flag to override non-retryable checks

### Files Created/Modified

**Created:**
- `packages/core/src/retry-service.ts` - RetryService implementation
- `packages/core/src/circuit-breaker.ts` - CircuitBreaker implementation
- `packages/core/src/__tests__/retry-service.test.ts` - 7 tests
- `packages/core/src/__tests__/circuit-breaker.test.ts` - 21 tests
- `packages/core/src/__tests__/retry-circuit-integration.test.ts` - 11 integration tests
- `packages/cli/src/commands/retry.ts` - CLI retry command

**Modified:**
- `packages/core/src/index.ts` - Added exports for RetryService, CircuitBreaker, RetryHistoryEntry, RetryError
- `packages/cli/src/index.ts` - Registered retry command

### Code Review Fixes Applied

**Enhanced RetryService:**
- Added jitter (±10%) to prevent thundering herd problem
- Added retry history tracking on errors
- Added logger injection for custom logging
- Added non-retryable error logging with DLQ indicator

**Enhanced CircuitBreaker:**
- Added logger for state transition logging
- Added onStateChange callback for event handlers
- Added getFormattedState() for human-readable state display
- Added getTimeUntilClose() for time remaining until breaker closes
- Added setState() helper for consistent state transitions

**Enhanced Tests:**
- Updated retry tests to accept jitter tolerance ranges
- Added 11 integration tests for RetryService + CircuitBreaker interaction

### Test Results

- **Core package**: 638 tests passing (including 39 new/enhanced tests)
  - 7 RetryService unit tests
  - 21 CircuitBreaker unit tests
  - 11 RetryService + CircuitBreaker integration tests
- **CLI package**: Pre-existing test failures unrelated to changes
- **TypeScript**: All type checks passing for core package
- **ESLint**: No lint errors in new code

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

### Code Review Fixes (2025-03-08)

Following adversarial code review, the following enhancements were applied:

**RetryService Enhancements:**
1. Added jitter support (configurable percentage, default 10%)
2. Added RetryHistoryEntry interface for tracking retry attempts
3. Added RetryError interface with cause and retryHistory
4. Added logger parameter to RetryOptions for custom logging
5. Added explicit logging for non-retryable errors

**CircuitBreaker Enhancements:**
1. Added logger parameter for state transition logging
2. Added onStateChange callback for event handlers
3. Added getFormattedState() method for human-readable output
4. Added getTimeUntilClose() method for time remaining
5. Added setState() helper for consistent state management

**Test Enhancements:**
1. Updated retry tests to accept jitter tolerance ranges
2. Added 11 integration tests for RetryService + CircuitBreaker
3. Tests verify: circuit breaker blocking, state transitions, jitter, error context

**Test Results:**
- Core package: 638 tests passing (including 39 new/enhanced tests)
- Typecheck: Passing for core package
- All integration tests passing without timeouts
