# Story 4.6: Event Bus Backlog Recovery

Status: ready-for-dev

## Story

As a Developer,
I want queued events to be drained when the event bus recovers,
so that no events are lost during outages.

## Acceptance Criteria

1. **Given** event bus was unavailable
   - Events queued in memory
2. **When** event bus reconnects
   - Drain all queued events within 30s (NFR-SC6)
   - Publish in order
   - Display progress

3. **Given** I run `ao events drain --force`
   - Manually trigger drain
   - Show count of drained events

## Tasks / Subtasks

- [ ] Implement event drain on reconnection
- [ ] Track queue size
- [ ] CLI command `ao events drain`
- [ ] Write unit tests

## Dev Notes

### Drain Process

```typescript
async function drainQueue() {
  let count = 0;
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    await eventBus.publish(event);
    count++;
  }
  console.log(`Drained ${count} events`);
}
```

### Dependencies

- Story 2.1 (Redis Event Bus) - Target for draining
- Story 4.4 (Graceful Degradation) - Queue source

## Dev Agent Record

_(To be filled by Dev Agent)_
