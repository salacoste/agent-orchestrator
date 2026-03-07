# Story 4.5: Dead Letter Queue

Status: ready-for-dev

## Story

As a Developer,
I want a dead letter queue for failed operations,
so that no data is lost and failed operations can be investigated and replayed.

## Acceptance Criteria

1. **Given** an operation fails after max retries
   - Move to dead letter queue (DLQ)
   - Store with failure reason, timestamp, retry count

2. **Given** I run `ao dlq list`
   - Show all failed operations
   - Display: error ID, operation type, failure reason, timestamp

3. **Given** I run `ao dlq replay <error-id>`
   - Replay the operation immediately
   - Display result

4. **Given** I run `ao dlq purge --older-than 7d`
   - Remove DLQ entries older than 7 days

5. **Given** DLQ grows large (>1000 entries)
   - Alert: "DLQ size: 1250 entries (investigate)"
   - Display notification

## Tasks / Subtasks

- [ ] Create DeadLetterQueue service
  - [ ] Store failed operations
  - [ ] Persist to disk (dlq.jsonl)
  - [ ] CLI commands: list, replay, purge
- [ ] Implement DLQ entry format
  - [ ] Error ID, operation type, payload
  - [ ] Failure reason, retry count, timestamps
- [ ] Implement replay functionality
  - [ ] Retry operation bypassing circuit breaker
  - [ ] Remove from DLQ on success
  - [ ] Keep in DLQ on failure
- [ ] Implement purge functionality
  - [ ] Remove entries older than threshold
  - [ ] Confirm before purging
- [ ] Write unit tests

## Dev Notes

### DLQ Entry Format

```json
{
  "errorId": "uuid-1",
  "operation": "bmad_sync",
  "payload": {...},
  "failureReason": "Connection timeout",
  "retryCount": 5,
  "failedAt": "2026-03-06T10:30:00Z",
  "originalError": {...}
}
```

### CLI Commands

```bash
ao dlq list
ao dlq replay <error-id>
ao dlq purge --older-than 7d
ao dlq stats
```

## Dev Agent Record

_(To be filled by Dev Agent)_
