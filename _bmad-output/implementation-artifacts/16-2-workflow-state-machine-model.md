# Story 16.2: Workflow State Machine Model

Status: done

## Story

As a **developer**,
I want the BMAD workflow modeled as a state machine with phases and transitions,
So that "what's next" can be computed deterministically from project state.

## Acceptance Criteria

1. **AC1: State machine definition with phases and transitions**
   - **Given** the BMAD workflow has 4 phases (analysis, planning, solutioning, implementation)
   - **When** the state machine is instantiated
   - **Then** it defines transitions between phases with descriptive metadata
   - **And** each transition has guard conditions (prerequisites that must be true)
   - **And** the definition is pure data — no side effects, no I/O

2. **AC2: Guard condition evaluation**
   - **Given** a transition with guard conditions and a project context
   - **When** guards are evaluated
   - **Then** each guard returns satisfied (true/false) with its description
   - **And** evaluation is a pure function taking context, returning results

3. **AC3: Available transitions computation**
   - **Given** a current phase and project context
   - **When** available transitions are queried
   - **Then** it returns transitions where ALL guards are satisfied
   - **And** also returns potential transitions (guards partially satisfied) with readiness info
   - **And** computation completes in <50ms (NFR-WF-P2)

4. **AC4: Transition readiness scoring**
   - **Given** a transition with multiple guards
   - **When** readiness is computed
   - **Then** score = (satisfied guards / total guards) × 100
   - **And** unsatisfied guards are listed with their descriptions
   - **And** output matches format: "Planning readiness: 75% — missing: architecture spec"

5. **AC5: Default BMAD workflow definition**
   - **Given** no custom workflow configuration
   - **When** the default state machine is loaded
   - **Then** it defines the standard BMAD flow: analysis → planning → solutioning → implementation
   - **And** guards check for key artifacts: brief, PRD, architecture, epics
   - **And** the definition is NOT hardcoded in logic — it's a data structure that Story 16.3 can later load from YAML

6. **AC6: Fully testable with exhaustive tests**
   - **Given** the state machine functions
   - **When** tests run
   - **Then** all transition paths are covered
   - **And** all guard conditions tested individually
   - **And** edge cases tested (no artifacts, all artifacts, partial artifacts)
   - **And** all tests pass with `pnpm test`

## Tasks / Subtasks

- [x] Task 1: Define state machine types (AC: #1, #2)
  - [x] 1.1: Add `WorkflowTransition` interface to web workflow types.ts
  - [x] 1.2: Add `TransitionGuard` interface with pure evaluate function
  - [x] 1.3: Add `GuardContext` interface (phasePresence + artifacts)
  - [x] 1.4: Add `GuardResult` interface (guardId, satisfied, description)
  - [x] 1.5: Add `TransitionReadiness` interface (score, satisfied[], unsatisfied[])
  - [x] 1.6: Add `WorkflowStateMachine` interface (phases, transitions, getAvailable, getReadiness)

- [x] Task 2: Implement default BMAD state machine definition (AC: #5)
  - [x] 2.1: Create `packages/web/src/lib/workflow/state-machine.ts`
  - [x] 2.2: Define BMAD_TRANSITIONS constant array with 3 transitions
  - [x] 2.3: Define guard functions: HAS_BRIEF, HAS_PRD, HAS_ARCHITECTURE, HAS_EPICS
  - [x] 2.4: Export `createBmadStateMachine()` and generic `createStateMachine()` factories

- [x] Task 3: Implement transition computation functions (AC: #2, #3, #4)
  - [x] 3.1: Implement `evaluateGuards(transition, context)` — returns GuardResult[]
  - [x] 3.2: Implement `getAvailableTransitions(currentPhase, transitions, context)` — returns transitions where all guards pass
  - [x] 3.3: Implement `getTransitionReadiness(currentPhase, transitions, context)` — returns TransitionReadiness with score

- [x] Task 4: Write exhaustive tests (AC: #6)
  - [x] 4.1: Create `packages/web/src/lib/workflow/__tests__/state-machine.test.ts` — 36 tests
  - [x] 4.2: Test all transition paths (analysis→planning, planning→solutioning, solutioning→implementation)
  - [x] 4.3: Test guard evaluation for each guard (HAS_BRIEF, HAS_PRD, HAS_ARCHITECTURE, HAS_EPICS)
  - [x] 4.4: Test readiness scoring (0%, 50%, 100% scenarios)
  - [x] 4.5: Test edge cases (no artifacts, all artifacts, terminal phase, unrelated types)
  - [x] 4.6: Test performance (<50ms confirmed)
  - [x] 4.7: Guard type string sync test (Quinn's review finding — verifies guard strings match artifact-rules.ts)

- [x] Task 5: Validate backward compatibility (AC: #6)
  - [x] 5.1: `pnpm test` — web: 43 files, 829 tests pass (includes 36 new + 3 sync from 16.1)
  - [x] 5.2: `pnpm build` — all packages build including Next.js
  - [x] 5.3: Existing recommendation engine unchanged

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions
- No placeholder tests
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] No runtime interface methods — this story adds NEW types and pure functions

**Methods Used:**
- [ ] `Phase` type from core types.ts (Story 16.1)
- [ ] `ClassifiedArtifact` interface from web workflow types.ts
- [ ] `buildPhasePresence()` from scan-artifacts.ts (existing)

**Feature Flags:**
- [ ] None — this is additive, no modifications to existing behavior

## Dev Notes

### Architecture Patterns & Constraints

**CRITICAL — Follow these patterns exactly:**

1. **Pure functions ONLY** — No I/O, no mutations, no side effects. Every function takes input, returns output. Period.
   ```typescript
   // ✅ CORRECT — pure function
   export function evaluateGuards(
     transition: WorkflowTransition,
     context: GuardContext
   ): GuardResult[] { ... }

   // ❌ WRONG — side effects
   export function evaluateGuards(transition, context) {
     console.log("evaluating..."); // NO
     fs.readFileSync("..."); // NO
   }
   ```

2. **Data-driven transitions** — Transitions are a CONSTANT ARRAY, not switch/case logic:
   ```typescript
   // ✅ CORRECT — transitions as data
   export const BMAD_TRANSITIONS: readonly WorkflowTransition[] = [
     { from: "analysis", to: "planning", guards: [hasBriefGuard], description: "..." },
     { from: "planning", to: "solutioning", guards: [hasPrdGuard], description: "..." },
   ];

   // ❌ WRONG — transitions as logic
   function getNextPhase(current) {
     switch(current) { case "analysis": return "planning"; }
   }
   ```

3. **Factory pattern for pluggability** — Story 16.3 will load transitions from YAML:
   ```typescript
   // ✅ CORRECT — factory returns interface
   export function createBmadStateMachine(): WorkflowStateMachine { ... }

   // Future Story 16.3:
   export function createStateMachineFromConfig(yaml: WorkflowConfig): WorkflowStateMachine { ... }
   ```

4. **Follow existing test patterns** from compute-state.test.ts:
   - Helper functions for creating test context
   - Exhaustive coverage of all permutations
   - Clear descriptions in test names

### Source Tree Components to Touch

| File | Action | Notes |
|------|--------|-------|
| `packages/web/src/lib/workflow/types.ts` | ADD | WorkflowTransition, TransitionGuard, GuardContext, GuardResult, TransitionReadiness, WorkflowStateMachine interfaces |
| `packages/web/src/lib/workflow/state-machine.ts` | CREATE | BMAD transitions, guard functions, factory |
| `packages/web/src/lib/workflow/__tests__/state-machine.test.ts` | CREATE | Exhaustive tests |

### What NOT to Touch

- `compute-state.ts` — existing phase inference stays unchanged
- `recommendation-engine.ts` — existing 7-rule chain stays unchanged (Story 17.3 may enhance it later)
- `artifact-rules.ts` — classification rules unchanged
- `scan-artifacts.ts` — artifact discovery unchanged
- `packages/core/src/types.ts` — no new core types needed; web-specific types stay in web

### Guard Conditions to Implement

| Guard ID | Description | Evaluates |
|----------|-------------|-----------|
| `has-brief` | Product brief exists | `artifacts.some(a => a.type === "Brief")` |
| `has-prd` | PRD exists | `artifacts.some(a => a.type === "PRD")` |
| `has-architecture` | Architecture doc exists | `artifacts.some(a => a.type === "Architecture")` |
| `has-epics` | Epics document exists | `artifacts.some(a => a.type === "Epics")` |
| `has-ux-design` | UX design spec exists (optional) | `artifacts.some(a => a.type === "UX Design")` |

**Note:** Guard evaluation uses `ClassifiedArtifact.type` field which comes from `artifact-rules.ts`. The `type` values are: "Brief", "Research Report", "Project Context", "PRD", "UX Design", "UX Spec", "Architecture", "Epics", "Sprint Plan", "Story Spec", "Uncategorized".

### BMAD Transition Map

```
analysis ──[has-brief]──► planning
planning ──[has-prd]──► solutioning
solutioning ──[has-architecture, has-epics]──► implementation
```

Additional optional transitions:
```
analysis ──[has-brief]──► solutioning  (skip planning if architecture-first)
planning ──[has-prd, has-architecture]──► implementation  (skip solutioning if epics inline)
```

**Design decision:** Start with the linear happy path (3 transitions). Non-linear paths can be added in Story 16.3 via YAML config.

### Relationship to Existing Recommendation Engine

The existing `getRecommendation()` in `recommendation-engine.ts` uses a 7-rule chain with hardcoded checks like `hasPrd`, `hasArchitecture`. Story 16.2 formalizes these as guard conditions. The recommendation engine will NOT be modified in this story — Story 17.3 (Deterministic Recommendation Engine) will later replace the hardcoded rules with state machine transitions.

### Performance Requirements

- NFR-WF-P2: State machine recommendation computation completes in <50ms
- Existing `computePhaseStates()` runs in ~1ms for any input
- Guard evaluation should be O(artifacts × guards) — typically <100 artifacts × <10 guards = negligible

### Testing Standards

- Use `describe/it` from vitest
- Follow compute-state.test.ts patterns:
  - Helper functions for creating contexts
  - Exhaustive permutation testing where applicable
  - Clear test names describing input → expected output

### References

- [Source: packages/web/src/lib/workflow/compute-state.ts] — Existing phase computation (pattern reference)
- [Source: packages/web/src/lib/workflow/recommendation-engine.ts] — Existing recommendation logic (will be enhanced later)
- [Source: packages/web/src/lib/workflow/artifact-rules.ts] — Artifact classification rules and type values
- [Source: packages/web/src/lib/workflow/__tests__/compute-state.test.ts] — Test pattern reference
- [Source: packages/web/src/lib/workflow/__tests__/core-type-sync.test.ts] — Cross-package test pattern
- [Source: epics-cycle-3-4.md#Epic 6a, Story 6a.2] — Epic/story requirements

### Project Structure Notes

- All new code in `packages/web/src/lib/workflow/` (web package, consistent with existing workflow modules)
- Types added to web's `types.ts` (not core — these are web-specific workflow model types)
- State machine is a pure module with zero dependencies on Node.js APIs
- Can be imported by both server components and client components in Next.js

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- ESLint caught duplicate imports (type + value from same module) — merged into single import
- ESLint caught `import()` type annotations in tests — replaced with standard type imports

### Completion Notes List

- Created state-machine.ts with pure functions: evaluateGuards, getAvailableTransitions, getTransitionReadiness
- Defined 6 new interfaces in types.ts: GuardContext, GuardResult, TransitionGuard, WorkflowTransition, TransitionReadiness, WorkflowStateMachine
- 4 guard instances (HAS_BRIEF, HAS_PRD, HAS_ARCHITECTURE, HAS_EPICS) using artifactTypeGuard factory
- 3 BMAD transitions defined as data (BMAD_TRANSITIONS constant)
- Generic createStateMachine() factory enables pluggable workflows (Story 16.3)
- 36 tests covering: guards, transitions, readiness, factory, guard-rules sync, performance
- Performance: <1ms for all 4 phases (well under 50ms NFR)

### File List

- `packages/web/src/lib/workflow/types.ts` — MODIFIED (added 7 state machine interfaces)
- `packages/web/src/lib/workflow/state-machine.ts` — CREATED (state machine model + pure functions)
- `packages/web/src/lib/workflow/__tests__/state-machine.test.ts` — CREATED (36 tests)
