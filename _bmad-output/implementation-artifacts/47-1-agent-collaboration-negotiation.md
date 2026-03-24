# Story 47.1: Agent Collaboration — Direct Negotiation

Status: done

## Story

As a system enabling smart multi-agent work,
I want agents to negotiate directly when they detect conflicts,
so that common issues are resolved without human escalation.

## Acceptance Criteria

1. Agents exchange messages via the messaging bus (46a.3) when file overlap detected
2. Messages include: agent ID, conflicting file, proposed resolution
3. Receiving agent acknowledges and adjusts OR escalates to human
4. Negotiation logged in audit trail
5. Timeout: if no agreement in 2 minutes, escalate to human notification
6. Negotiation protocol is a pure module (testable without side effects)
7. Tests verify message exchange, timeout, escalation, and audit logging

## Tasks / Subtasks

- [ ] Task 1: Create negotiation protocol (AC: #1, #2, #3, #6)
  - [ ] 1.1: Create `packages/core/src/agent-negotiation.ts`
  - [ ] 1.2: Define `NegotiationRequest` and `NegotiationResponse` message types
  - [ ] 1.3: `startNegotiation(agentId, targetAgent, conflictFiles)` → publishes to message bus
  - [ ] 1.4: `handleNegotiationRequest(request)` → returns accept/reject/escalate
  - [ ] 1.5: `NegotiationOutcome` type: agreed | rejected | timeout | escalated
- [ ] Task 2: Add timeout and escalation (AC: #5)
  - [ ] 2.1: Default timeout 2 minutes (configurable)
  - [ ] 2.2: On timeout → escalate to human via notification
- [ ] Task 3: Write tests (AC: #7)
  - [ ] 3.1: Test negotiation request/response flow
  - [ ] 3.2: Test timeout produces escalation
  - [ ] 3.3: Test message types and structure
  - [ ] 3.4: Test outcome types

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
agent-negotiation.ts (core module)
  ├── NegotiationRequest: { requesterId, targetId, files[], channel }
  ├── NegotiationResponse: { accepted, adjustedFiles[], escalate }
  ├── startNegotiation() → publishes request to message bus channel
  ├── handleNegotiationRequest() → pure decision logic
  └── NegotiationOutcome: agreed | rejected | timeout | escalated
```

### Message Bus Integration (Story 46a.3)

Uses `createMessageBus()` with channel `agent.negotiation`:
```typescript
bus.publish("agent.negotiation", {
  type: "negotiation.request",
  payload: { requesterId, targetId, files, timeout: 120000 },
  sender: requesterId,
});
```

### Protocol Flow

1. Agent A detects overlap → publishes `negotiation.request` to bus
2. Agent B subscribed to `agent.negotiation` → receives request
3. Agent B evaluates: can it avoid the files? → responds `negotiation.response`
4. If accepted → both continue with adjusted scope
5. If rejected or timeout → escalate to human notification

### Anti-Patterns

- Do NOT block agents waiting for response — negotiation is async via message bus
- Do NOT implement actual file-level blocking — this story defines the protocol only
- Do NOT add new dependencies — use existing message bus from 46a.3

### Files to Create

1. `packages/core/src/agent-negotiation.ts` (new)
2. `packages/core/src/__tests__/agent-negotiation.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: packages/core/src/message-bus.ts] — bus publish/subscribe
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.1] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
