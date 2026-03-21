# Story 17.3: Deterministic Recommendation Engine

Status: done

## Story

As a **developer**,
I want recommendations computed from state machine graph traversal,
So that "what's next" is deterministic, testable, and requires zero AI.

## Acceptance Criteria

1. **AC1: Recommendations derived from state machine transitions**
   - **Given** the current project phase and artifact context
   - **When** the recommendation engine runs
   - **Then** it uses `stateMachine.getTransitionReadiness()` to find the first transition with unsatisfied guards
   - **And** produces a recommendation based on the first unsatisfied guard

2. **AC2: Computation completes in <50ms**
   - **Given** up to 100 artifacts
   - **When** recommendations are computed
   - **Then** total computation (phase detection + readiness + recommendation) completes in <50ms (NFR-WF-P2)

3. **AC3: Backward compatible with existing recommendation format**
   - **Given** the existing `Recommendation` interface (tier, observation, implication, phase)
   - **When** the new engine produces output
   - **Then** the output shape matches the existing interface
   - **And** existing tests pass with adjusted expectations where needed

4. **AC4: Recommendation includes blocked-by reasoning data**
   - **Given** a transition with unsatisfied guards
   - **When** a recommendation is produced
   - **Then** it includes the list of unsatisfied guard descriptions (for Story 17.5 display)

5. **AC5: Same state always produces same recommendation**
   - **Given** identical artifact state
   - **When** computed multiple times
   - **Then** the same recommendation is returned every time (fully deterministic)

## Tasks / Subtasks

- [ ] Task 1: Create state-machine-based recommendation function (AC: #1, #2, #5)
  - [ ] 1.1: Create `getStateMachineRecommendation(artifacts, stateMachine)` in recommendation-engine.ts
  - [ ] 1.2: Find current active phase from phase states
  - [ ] 1.3: Get transition readiness from active phase
  - [ ] 1.4: Return recommendation based on first unsatisfied guard with phase + observation + implication

- [ ] Task 2: Extend Recommendation type with reasoning (AC: #4)
  - [ ] 2.1: Add optional `reasoning` field to Recommendation interface
  - [ ] 2.2: Add optional `blockers` field (array of guard descriptions that aren't satisfied)

- [ ] Task 3: Maintain backward compatibility (AC: #3)
  - [ ] 3.1: Keep existing `getRecommendation()` function unchanged
  - [ ] 3.2: New function is ADDITIVE — called alongside or as replacement in API route
  - [ ] 3.3: Verify existing recommendation tests still pass

- [ ] Task 4: Write tests (AC: #1, #2, #5)
  - [ ] 4.1: Test state-machine recommendation for each phase scenario
  - [ ] 4.2: Test determinism (same input → same output)
  - [ ] 4.3: Test performance (<50ms)
  - [ ] 4.4: Test reasoning/blockers populated correctly

- [ ] Task 5: Validate
  - [ ] 5.1: `pnpm test` — all tests pass
  - [ ] 5.2: `pnpm build` — succeeds

## Dev Notes

### Key Design: Keep Existing Engine, Add New Function

**Do NOT replace `getRecommendation()`.** Add `getStateMachineRecommendation()` alongside it. The existing engine has 487 lines of tests — breaking it is wasteful. The new function uses the state machine from Story 16.2.

```typescript
export function getStateMachineRecommendation(
  artifacts: ClassifiedArtifact[],
  stateMachine: WorkflowStateMachine,
): Recommendation | null {
  const presence = buildPhasePresence(artifacts);
  const phases = computePhaseStates(presence);
  const context: GuardContext = { phasePresence: presence, artifacts };

  // Find the active phase
  const activePhase = phases.find(p => p.state === "active");
  if (!activePhase) {
    // No active phase — either all not-started or all done
    const allNotStarted = phases.every(p => p.state === "not-started");
    if (allNotStarted) {
      return { tier: 1, phase: "analysis", observation: "...", implication: "...", reasoning: "...", blockers: [...] };
    }
    return null; // All done
  }

  // Get readiness for transitions from active phase
  const readiness = stateMachine.getTransitionReadiness(activePhase.id, context);
  // ... build recommendation from readiness data
}
```

### Source Tree Components to Touch

| File | Action |
|------|--------|
| `packages/web/src/lib/workflow/recommendation-engine.ts` | ADD new function |
| `packages/web/src/lib/workflow/types.ts` | ADD reasoning/blockers to Recommendation |
| `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` | ADD new tests |

### References

- [Source: packages/web/src/lib/workflow/recommendation-engine.ts] — Existing 7-rule engine
- [Source: packages/web/src/lib/workflow/state-machine.ts] — State machine with getTransitionReadiness
- [Source: epics-cycle-3-4.md#Epic 6b, Story 6b.3] — Requirements

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
