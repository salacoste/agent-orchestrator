# Story 46b.2: Approval Workflows — Human Gates

Status: done

## Story

As a team lead,
I want certain actions to require approval before execution,
so that risky operations have human oversight.

## Acceptance Criteria

1. `approvalRequired` config lists actions that need approval (spawn, kill, autopilot-advance)
2. Actions requiring approval enter PENDING state until approved
3. `GET /api/approvals` returns pending approval queue
4. `POST /api/approvals/{id}/approve` approves a pending action
5. `POST /api/approvals/{id}/reject` rejects a pending action
6. Approvals logged in audit trail with approver identity
7. Configurable auto-approve timeout (default: none — waits indefinitely)
8. Tests verify approval flow, config, queue API, and audit logging

## Tasks / Subtasks

- [ ] Task 1: Create approval service (AC: #1, #2, #7)
  - [ ] 1.1: Create `packages/core/src/approval-service.ts`
  - [ ] 1.2: `requestApproval(action, target, requestedBy)` → creates pending approval
  - [ ] 1.3: `approve(id, approvedBy)` → marks approved, returns action details
  - [ ] 1.4: `reject(id, rejectedBy)` → marks rejected
  - [ ] 1.5: `getPending()` → returns all pending approvals
  - [ ] 1.6: Optional timeout for auto-approve (default: none)
- [ ] Task 2: Add config schema (AC: #1)
  - [ ] 2.1: Add `approvalRequired` array to config schema
  - [ ] 2.2: Action types: "spawn", "kill", "autopilot-advance"
- [ ] Task 3: Create approval API routes (AC: #3, #4, #5)
  - [ ] 3.1: `GET /api/approvals` — list pending
  - [ ] 3.2: `POST /api/approvals/{id}/approve` — approve action
  - [ ] 3.3: `POST /api/approvals/{id}/reject` — reject action
- [ ] Task 4: Write tests (AC: #8)
  - [ ] 4.1: Test request/approve/reject flow
  - [ ] 4.2: Test pending queue
  - [ ] 4.3: Test config schema
  - [ ] 4.4: Test API routes

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- Deferred items explicitly documented

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture — In-Memory Queue + Config

```
approval-service.ts (core)
  ├── requestApproval(action, target, requestedBy) → PendingApproval
  ├── approve(id, approvedBy) → ApprovalResult
  ├── reject(id, rejectedBy) → ApprovalResult
  ├── getPending() → PendingApproval[]
  └── isApprovalRequired(action, config) → boolean

API routes (wiring)
  ├── GET /api/approvals → getPending()
  ├── POST /api/approvals/{id}/approve
  └── POST /api/approvals/{id}/reject
```

### Interfaces

```typescript
interface PendingApproval {
  id: string;           // UUID
  action: string;       // "spawn", "kill", "autopilot-advance"
  target: string;       // Session ID, story ID, etc.
  requestedBy: string;  // User ID from X-AO-User
  requestedAt: string;  // ISO 8601
  status: "pending" | "approved" | "rejected";
  resolvedBy?: string;
  resolvedAt?: string;
  timeoutMs?: number;   // Auto-approve after N ms (null = wait forever)
}
```

### Config Schema

```typescript
approvalRequired: z.array(z.enum(["spawn", "kill", "autopilot-advance"])).default([]),
```

### Anti-Patterns to Avoid

- Do NOT persist approvals to disk — in-memory queue (resets on restart is acceptable for v1)
- Do NOT block the event loop waiting for approval — store pending, check on demand
- Do NOT add dashboard UI — backend only (future story)

### Files to Create

1. `packages/core/src/approval-service.ts` (new)
2. `packages/core/src/__tests__/approval-service.test.ts` (new)
3. `packages/web/src/app/api/approvals/route.ts` (new)
4. `packages/web/src/app/api/approvals/[id]/approve/route.ts` (new)
5. `packages/web/src/app/api/approvals/[id]/reject/route.ts` (new)
6. `packages/web/src/app/api/approvals/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/config.ts` — add approvalRequired
2. `packages/core/src/index.ts` — export approval service

### References

- [Source: packages/core/src/types.ts:1543] — EventBus pattern for service design
- [Source: packages/core/src/config.ts] — Zod schema
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 46b.2] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
