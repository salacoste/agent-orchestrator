# Story 17.4: Phase Readiness Scoring

Status: done

## Story

As a **PM**,
I want each phase transition to show a readiness percentage with specific gaps listed,
So that I know exactly what's missing before advancing.

## Acceptance Criteria

1. **AC1: Readiness score displayed per transition**
   - **Given** phase transitions computed by state machine
   - **When** the workflow API returns data
   - **Then** each transition includes: score (0-100), satisfied guards, unsatisfied guards

2. **AC2: Specific gaps listed**
   - **Given** a transition with unsatisfied guards
   - **When** readiness is displayed
   - **Then** gaps are listed as human-readable descriptions (e.g., "Architecture readiness: 50% — missing: Epics & Stories document")

3. **AC3: Real-time updates**
   - **Given** an artifact is created
   - **When** the score is recomputed
   - **Then** readiness score updates via SSE without manual refresh

4. **AC4: API returns readiness data**
   - **Given** the workflow API endpoint
   - **When** called
   - **Then** readiness data is included as an optional field (backward compatible with WD-4 frozen contract)

## Tasks / Subtasks

- [ ] Task 1: Add readiness to API response (AC: #4)
  - [ ] 1.1: Add optional `readiness` field to WorkflowResponse or create separate response type
  - [ ] 1.2: Compute readiness in API route using `stateMachine.getTransitionReadiness()`
  - [ ] 1.3: Include readiness only when state machine is available

- [ ] Task 2: Display readiness in dashboard (AC: #1, #2)
  - [ ] 2.1: Show readiness percentage near phase bar or AI Guide
  - [ ] 2.2: List unsatisfied guards as gap descriptions
  - [ ] 2.3: Color-code: 100% green, 50-99% amber, 0% muted

- [ ] Task 3: Write tests (AC: #1, #2)
  - [ ] 3.1: Test readiness computation in API
  - [ ] 3.2: Test readiness rendering in component
  - [ ] 3.3: Test gap listing

- [ ] Task 4: Validate
  - [ ] 4.1: `pnpm test` — all pass
  - [ ] 4.2: `pnpm build` — succeeds

## Dev Notes

### Key Pattern: Use State Machine from Story 16.2

```typescript
const sm = createBmadStateMachine();
const ctx: GuardContext = { phasePresence, artifacts };
const readiness = sm.getTransitionReadiness(activePhase, ctx);
// readiness[0].score → 50
// readiness[0].unsatisfied → [{ guardId: "has-epics", description: "Epics & stories..." }]
```

### WD-4 Frozen Contract Note

WorkflowResponse is frozen. Add readiness as OPTIONAL field:
```typescript
interface WorkflowResponse {
  // ... existing fields unchanged ...
  readiness?: TransitionReadiness[]; // NEW: optional, backward compatible
}
```

### Source Tree Components to Touch

| File | Action |
|------|--------|
| `packages/web/src/lib/workflow/types.ts` | ADD optional readiness to WorkflowResponse |
| `packages/web/src/app/api/workflow/[project]/route.ts` | MODIFY to compute readiness |
| `packages/web/src/components/WorkflowAIGuide.tsx` or new component | MODIFY/CREATE readiness display |
| Tests | ADD readiness tests |

### References

- [Source: packages/web/src/lib/workflow/state-machine.ts] — getTransitionReadiness()
- [Source: packages/web/src/lib/workflow/types.ts] — TransitionReadiness interface
- [Source: epics-cycle-3-4.md#Epic 6b, Story 6b.4] — Requirements

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
