# Story 8.2: Recommendation Engine Tests

Status: done

## Story

As a developer,
I want thorough unit tests for the recommendation engine covering all 7 rules, edge cases, and output format,
so that recommendation logic is verified before wiring to the UI.

## Acceptance Criteria

1. **Given** the recommendation engine
   **When** the test suite runs
   **Then** each of the 7 rules (R1–R7) has at least one dedicated test case verifying its trigger condition, output tier, observation, implication, and phase

2. **Given** R7 (null recommendation)
   **When** tested
   **Then** the function returns null, not an empty object or undefined

3. **Given** the rule chain ordering
   **When** tested with states that could match multiple rules
   **Then** only the first matching rule's recommendation is returned

4. **Given** all recommendation outputs
   **When** tested
   **Then** each has the structured shape: `{ tier: 1|2, observation: string, implication: string, phase: Phase }`

5. **Given** recommendation text content
   **When** tested against context voice rules
   **Then** no observation or implication contains imperative verbs

## Tasks / Subtasks

- [x] Task 1: Validate existing tests cover all ACs (AC: 1-5)
  - [x] Read `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` and map each test to the ACs above
  - [x] Verify AC1: Each of 7 rules (R1-R7) has at least one dedicated test case checking trigger condition, tier, observation, implication, and phase
  - [x] Verify AC2: R7 test asserts `null` return (uses `toBeNull()`, not `toBeFalsy()` or similar)
  - [x] Verify AC3: First-match-wins test exists and verifies only first rule fires
  - [x] Verify AC4: Structured output shape explicitly tested — was missing, added in Task 2
  - [x] Verify AC5: Context voice test covers all rules (R1-R6), not just R1

- [x] Task 2: Add missing test coverage for structured shape validation (AC: 4)
  - [x] Add explicit test that validates the complete `Recommendation` shape for at least one rule: check that result has exactly `tier`, `observation`, `implication`, `phase` keys with correct types
  - [x] Verify R1 returns `tier: 1` (not 2), R4 returns `tier: 2` (not 1) — tier boundary validation (all R1-R6 tiers tested)
  - [x] Verify each rule's `phase` value matches the WD-3 spec: R1/R2→"analysis", R3→"planning", R4/R5→"solutioning", R6→"implementation"

- [x] Task 3: Add edge case tests for robustness (AC: 1, 3)
  - [x] Test: `buildContext()` with artifacts containing mixed-case filenames (e.g., "Product-BRIEF.md") — verify case-insensitive matching
  - [x] Test: R6 behavior when implementation phase state is "done" (not "active") — should NOT fire R6, should fall through to R7
  - [x] Test: Multiple rules skipping in sequence — when brief, PRD, architecture, and epics all present but implementation is not active → returns null (R7)

- [x] Task 4: Verify lint, typecheck, and all tests pass (AC: all)
  - [x] Run `pnpm lint` from project root — clean
  - [x] Run `pnpm typecheck` from project root — clean
  - [x] Run `pnpm test` — all 19 recommendation engine tests pass
  - [x] Verify no regressions in existing workflow tests (compute-state, scan-artifacts, artifact-rules, parse-agents) — 2 pre-existing failures in conflicts.test.ts unrelated to this story

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items — all ACs fully met
- [x] File List includes all changed files

## Interface Validation

- [x] This story does NOT modify any `@composio/ao-core` interfaces
- [x] This story does NOT modify `recommendation-engine.ts` (test-only story)
- [x] Import boundaries preserved: test file imports only from `../recommendation-engine.js`, `../types.js`, and `vitest`

**Methods Used:**
- [x] `getRecommendation()` from `@/lib/workflow/recommendation-engine.js` — function under test
- [x] `Recommendation` type from `@/lib/workflow/types.js` — return type to validate shape
- [x] `ClassifiedArtifact` type from `@/lib/workflow/types.js` — test input type
- [x] `Phase` type from `@/lib/workflow/types.js` — phase identifiers
- [x] `PhaseState` type from `@/lib/workflow/types.js` — used in `makePhases` helper
- [x] `PhaseEntry` type from `@/lib/workflow/types.js` — computed phase states

**Feature Flags:**
- [x] None required — test-only story, no runtime behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story adds only test code using existing vitest infrastructure. Zero new entries in package.json (NFR-P6).

## Dev Notes

### CRITICAL: Existing Test Suite

**The recommendation engine test file already exists with 13 tests.** It was built as part of Story 7-1/7-2 and enhanced in Story 8-1 (code review). This story is a **validation + enhancement pass**, NOT a from-scratch test implementation.

**Current test file:** `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` — 13 tests

**Current test coverage:**
1. R1: No artifacts → tier 1, analysis ✅
2. R2: No brief — fires when artifacts exist but no brief ✅
3. R2: Does not fire when brief exists ✅
4. R3: No PRD → tier 1, planning ✅
5. R4: No architecture → tier 2, solutioning ✅
6. R5: No epics → tier 2, solutioning ✅
7. R6: Implementation active → tier 2, implementation ✅
8. R7: Null return → `toBeNull()` ✅
9. Context voice: R1 uses factual observations ✅
10. Context voice: R2-R6 use factual observations ✅
11. Gap: R4 fires when solutioning skipped ✅
12. Gap: R1 fires with null-phase-only artifacts ✅
13. First-match-wins: R1 priority over R2-R7 ✅

**What's potentially missing (verify in Task 1):**
- AC4: Explicit structured shape assertion validating all 4 keys exist with correct types in one test
- Edge case: case-insensitive filename matching in `buildContext()`
- Edge case: R6 with implementation "done" (not "active") → should fall through to R7
- Edge case: all rules skip except R7 (complete pipeline walkthrough)

### Approach

1. **Validate** existing 13 tests map to all 5 ACs
2. **Add** structured shape validation test (AC4 gap)
3. **Add** edge case tests for robustness
4. **Verify** CI passes with no regressions

### Architecture Compliance (CRITICAL)

**WD-3 Recommendation Engine Specification:**

```
Rule chain (evaluated in order, first match returns):
| # | Tier | Condition                           | Phase          |
|---|------|-------------------------------------|----------------|
| R1 | 1   | No artifacts at all                 | analysis       |
| R2 | 1   | No product brief                    | analysis       |
| R3 | 1   | No PRD                              | planning       |
| R4 | 2   | No architecture                     | solutioning    |
| R5 | 2   | No epics                            | solutioning    |
| R6 | 2   | Implementation active               | implementation |
| R7 | —   | All phases have artifacts           | null           |
```

**NFR-T1:** >80% code coverage for recommendation engine. Current 13 tests already exceed this with every branch covered.

**Context voice rules** (enforced in all observation/implication strings):
- No imperative verbs ("Create...", "Run...", "Start...", "Install...", "Configure...")
- Pattern: "[State observation]. [Implication/next artifact]."
- Factual tone — observations, not instructions

**Null recommendation**: R7 returns `null`. Tests must assert `toBeNull()` specifically.

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `recommendation-engine.test.ts` | `../recommendation-engine.js`, `../types.js`, vitest | `@composio/ao-core`, Sprint Board, tracker-bmad |

### Data Contract (WD-4 — frozen)

```typescript
// From types.ts — DO NOT MODIFY
export interface Recommendation {
  tier: 1 | 2;
  observation: string;
  implication: string;
  phase: Phase;
}
```

### Test Helpers (already in test file)

```typescript
function makeArtifact(filename: string, phase: Phase | null): ClassifiedArtifact
function makePhases(states: [PhaseState, PhaseState, PhaseState, PhaseState]): PhaseEntry[]
function makePresence(a: boolean, p: boolean, s: boolean, i: boolean): Record<Phase, boolean>
```

These helpers are properly typed with `PhaseState` (from Story 8-1 code review fix).

### Previous Story Intelligence

**From Story 8-1 (Recommendation Engine — done):**
- WD-3 contextual prefixes added to R3-R6 observations (e.g., "Product brief present. No PRD found")
- `as Phase` type casts removed — TypeScript infers correctly from `Recommendation` return type
- `makePhases` helper uses `PhaseState` type for safety
- `hasType()` substring matching has known false-positive limitation (deferred, not tracked in current epics)
- Comprehensive context voice test added covering R2-R6 (not just R1)

**From Story 7-5 (Phase Bar — code review):**
- Use `PhaseState` type instead of `string` for type safety
- Precise test assertions (`toHaveLength(n)` not `toBeGreaterThanOrEqual(n)`)
- Test names must accurately describe what's being tested

**From Story 7-3 (Phase Computation Tests):**
- ESM imports with `.js` extensions
- `describe` blocks to group related tests
- Import boundary violations caught by ESLint

### Current Observation Text (for assertion reference)

| Rule | Observation |
|------|-------------|
| R1 | "No BMAD artifacts detected in this project" |
| R2 | "No product brief found" |
| R3 | "Product brief present. No PRD found" |
| R4 | "PRD present. Architecture spec not found" |
| R5 | "Architecture spec present. No epic or story files found" |
| R6 | "All solutioning artifacts present. Implementation phase active" |
| R7 | returns `null` |

### Project Structure Notes

**Files to modify:**
```
packages/web/src/
├── lib/
│   └── workflow/
│       └── __tests__/
│           └── recommendation-engine.test.ts  # MODIFY: Add structured shape + edge case tests
```

**Files to read (not modify):**
```
packages/web/src/
├── lib/
│   └── workflow/
│       ├── recommendation-engine.ts           # READ: Implementation under test
│       └── types.ts                           # READ: Recommendation, Phase, PhaseState types
```

### References

- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 2.2 Recommendation Engine Tests]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-3 Recommendation Engine, NFR-T1]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR5, FR7, FR8, NFR-T1]
- [Source: packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts — Current tests (13 tests)]
- [Source: packages/web/src/lib/workflow/recommendation-engine.ts — Implementation under test (156 lines)]
- [Source: packages/web/src/lib/workflow/types.ts — Recommendation, Phase, PhaseState types]
- [Source: _bmad-output/implementation-artifacts/8-1-recommendation-engine.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean execution, no debugging required.

### Completion Notes List

1. **Task 1 — Validation**: Mapped all 13 pre-existing tests to 5 ACs. Found AC4 gap (no explicit structured shape test) and confirmed AC1-AC3, AC5 already covered.

2. **Task 2 — Structured Shape Validation**: Added 3 new tests:
   - Explicit shape test verifying `{ tier, observation, implication, phase }` keys exist with correct types
   - Tier boundary test: R1-R3 return tier 1, R4-R6 return tier 2
   - Phase-per-rule test: R1/R2→"analysis", R3→"planning", R4/R5→"solutioning", R6→"implementation"

3. **Task 3 — Edge Cases**: Added 3 new tests:
   - Case-insensitive filename matching ("Product-BRIEF.md" correctly sets hasBrief=true)
   - R6 with "done" state (not "active") falls through to R7 → null
   - Full pipeline walkthrough: all docs present, implementation not active → R7 returns null

4. **Task 4 — CI Green**: `pnpm lint` clean, `pnpm typecheck` clean, 19 recommendation engine tests passing. 2 pre-existing failures in `conflicts.test.ts` are unrelated (present before this story).

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` | Modified | Added 6 new tests: structured shape validation (3), edge cases (3). Total: 19 tests |
