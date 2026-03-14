# Story 7.2: Workflow API Route

Status: done

## Story

As a dashboard user,
I want a `GET /api/workflow/[project]` endpoint that returns the complete workflow state for a project,
so that the frontend can render all workflow panels from a single API call.

## Acceptance Criteria

1. **Given** a valid project ID for a project with BMAD artifacts
   **When** `GET /api/workflow/[project]` is called
   **Then** it returns HTTP 200 with a `WorkflowResponse` JSON body containing `phases`, `recommendation`, `artifacts`, `agents`, `lastActivity` fields

2. **Given** a valid project ID for a project with no `_bmad/` directory
   **When** the endpoint is called
   **Then** it returns HTTP 200 with `hasBmad: false` and all data fields as null (phases as 4 "not-started" entries per WD-4)

3. **Given** an unknown project ID
   **When** the endpoint is called
   **Then** it returns HTTP 404 with `{ error: "Project not found" }`

4. **Given** a project with malformed artifact files (truncated YAML, permission denied)
   **When** the endpoint is called
   **Then** it returns HTTP 200 with gracefully degraded data (valid fields populated, problematic fields as null or empty)
   **And** no error is surfaced to the client

5. **Given** any valid BMAD state (no artifacts, partial, complete, malformed)
   **When** the endpoint is called
   **Then** response time is <100ms
   **And** the response shape matches the frozen `WorkflowResponse` interface exactly

## Prior Implementation Notice

**IMPORTANT:** The API route file `app/api/workflow/[project]/route.ts` was already created and fully implemented as Task 7 of Story 7-1 (Artifact Scanner & Phase Computation Engine). It was subsequently code-reviewed and 5 issues were fixed (2 HIGH, 3 MEDIUM). The implementation:

- Orchestrates: scan → classify → compute → recommend → respond
- Returns 404 for unknown projects, 200 for everything else
- Handles `hasBmad: false` with 4 "not-started" phase entries (H1 fix)
- Returns `lastActivity` from first non-null-phase artifact (H2 fix)
- Returns 500 for unexpected errors (M2 fix)
- Uses static imports (M3 fix)
- R4/R5 tiers corrected to Tier 2 (M1 fix)

**Dev agent responsibility**: Validate existing implementation against all 5 ACs, add route-level tests if missing, and close this story if validation passes. Do NOT rewrite the existing route.

## Tasks / Subtasks

- [x] Task 1: Validate existing route against all ACs (AC: 1-5)
  - [x] Read `app/api/workflow/[project]/route.ts` and verify it handles all 5 ACs
  - [x] Verify response shape matches frozen `WorkflowResponse` interface from `lib/workflow/types.ts`
  - [x] Verify `hasBmad: false` returns 4 "not-started" phases (not empty array)
  - [x] Verify unknown project returns 404
  - [x] Verify unexpected errors return 500
  - [x] Verify `lastActivity` skips null-phase artifacts
- [x] Task 2: Create route-level tests (AC: 1-5)
  - [x] Create `app/api/workflow/[project]/route.test.ts` (co-located, matching existing pattern)
  - [x] Test: valid project with BMAD artifacts → 200 with full WorkflowResponse
  - [x] Test: valid project without `_bmad/` directory → 200 with hasBmad: false, 4 not-started phases
  - [x] Test: unknown project → 404 with error message
  - [x] Test: unexpected error in pipeline → 500 with error message
  - [x] Test: response shape matches WorkflowResponse interface (all required fields present)
  - [x] Test: lastActivity is null when no phased artifacts exist
  - [x] Test: agents is null when manifest file is missing
  - [x] Mock `getServices()` and filesystem operations for isolation
- [x] Task 3: Verify lint, typecheck, and all tests pass (AC: all)
  - [x] Run `pnpm lint` — clean
  - [x] Run `pnpm typecheck` — clean
  - [x] Run `pnpm test` — all passing (82 existing + 19 new route tests = 101 workflow tests)

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
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] This story does NOT modify any `@composio/ao-core` interfaces
- [x] API route uses `getServices()` from `@/lib/services.js` for config access only
- [x] No imports from tracker-bmad or Sprint Board code
- [x] Import boundaries preserved: `lib/workflow/*` imports only from siblings and `node:` builtins

**Methods Used:**
- [x] `getServices()` from `@/lib/services.js` — access `config.projects[projectId]` for project path
- [x] `computePhaseStates()` from `@/lib/workflow/compute-state.js`
- [x] `scanAllArtifacts()`, `buildPhasePresence()` from `@/lib/workflow/scan-artifacts.js`
- [x] `getRecommendation()` from `@/lib/workflow/recommendation-engine.js`
- [x] `parseAgentManifest()` from `@/lib/workflow/parse-agents.js`
- [x] `node:fs/promises` — `readdir`, `readFile`
- [x] `node:path` — `join`, `resolve`

**Feature Flags:**
- [x] None required — uses only Node builtins and existing web package patterns

## Dependency Review (if applicable)

**No new dependencies.** This story validates existing code and adds tests using vitest (already in devDependencies).

Zero new entries in package.json (NFR-P6).

## Dev Notes

### Prior Implementation Summary

The route file was created in Story 7-1 (Task 7) and subsequently code-reviewed. Five issues were found and fixed:

| ID | Severity | Issue | Fix Applied |
|----|----------|-------|-------------|
| H1 | HIGH | `hasBmad: false` returned empty `phases: []` instead of 4 "not-started" entries | Now calls `computePhaseStates(emptyPresence)` |
| H2 | HIGH | `lastActivity` used `artifacts[0]` which could be uncategorized (null phase) | Now uses `.find(a => a.phase !== null)` |
| M1 | MEDIUM | R4/R5 tiers were 1 instead of 2 per WD-3 architecture | Changed to `tier: 2` |
| M2 | MEDIUM | Outer catch returned HTTP 200 instead of 500 | Changed to `status: 500` |
| M3 | MEDIUM | Dynamic `import("node:fs/promises")` in `dirExists()` | Changed to static import |

All fixes were validated with `pnpm lint`, `pnpm typecheck`, and `pnpm test` (82 tests passing).

### Architecture Requirements (WD-4)

**WorkflowResponse Interface (FROZEN)**:
```typescript
interface WorkflowResponse {
  projectId: string;
  projectName: string;
  hasBmad: boolean;
  phases: Array<{ id: Phase; label: string; state: PhaseState }>;
  agents: Array<{ name: string; displayName: string; title: string; icon: string; role: string }> | null;
  recommendation: { tier: 1 | 2; observation: string; implication: string; phase: Phase } | null;
  artifacts: ClassifiedArtifact[];
  lastActivity: { filename: string; phase: Phase; modifiedAt: string } | null;
}
```

Key contract rules:
- HTTP 200 for all valid BMAD states (including "no BMAD", "partial", "malformed")
- HTTP 404 only for unknown project IDs
- HTTP 500 only for unexpected server errors
- Nullable fields for absent data, never error responses for expected states
- `hasBmad: false` → phases populated with 4 "not-started" entries, all other data fields null/empty
- Response shape MUST NOT change without a breaking change process

### Testing Strategy

**Route tests should mock:**
- `getServices()` — return controlled config with known project entries
- `node:fs/promises` (`readdir`, `readFile`, `stat`) — control filesystem state
- Or alternatively, use a temp directory structure per test (matching scan-artifacts test pattern)

**Test scenarios (maps to ACs):**
1. Happy path: project with `_bmad/` + `_bmad-output/` containing artifacts → full response
2. No BMAD: project without `_bmad/` → `hasBmad: false`, 4 not-started phases
3. Unknown project: nonexistent project ID → 404
4. Error in pipeline: mock filesystem to throw → 500
5. Shape validation: verify all required fields are present and correctly typed
6. Edge: no phased artifacts (all null-phase) → `lastActivity: null`
7. Edge: missing agent manifest → `agents: null`

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `lib/workflow/*` | `node:fs`, `node:path`, own sibling modules | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `app/api/workflow/*/route.ts` | `lib/workflow/*`, `@/lib/services.js` | Component code, Sprint Board API routes |

### Existing File Reference

The route file already exists at:
- `packages/web/src/app/api/workflow/[project]/route.ts` (created in Story 7-1, code-reviewed)

**Do NOT recreate this file.** Task 1 validates it, Task 2 adds tests alongside it.

### Project Structure Notes

**Files to create (this story):**
```
packages/web/src/app/api/workflow/[project]/
├── route.ts                    # EXISTS — created in Story 7-1
└── __tests__/
    └── route.test.ts           # NEW — route-level tests
```

**No existing files modified.** This story adds test coverage for the existing route.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — WD-4 API Design]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-1 Phase Computation]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-8 File Scanning]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 1.2 Workflow API Route]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR23, FR31, FR28]
- [Source: _bmad-output/implementation-artifacts/7-1-artifact-scanner-and-phase-computation-engine.md — Task 7, Code Review Fixes]
- [Source: packages/web/src/app/api/workflow/[project]/route.ts — existing implementation]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `node:fs/promises` mock: initial approach failed because `vi.mock` is hoisted — resolved by using `vi.hoisted()` for mock function declarations
- Fixed TypeScript error on `Services` type cast in "unnamed project" test — used `as any` with ESLint disable comment for test mock
- Test file co-located at `route.test.ts` (not in `__tests__/` subdirectory) matching existing project pattern from `conflicts.test.ts`
- Code review (M1): Reorganized AC4 test section — moved 500 test to separate "unexpected errors" describe, added proper graceful degradation test
- Code review (M2): Added test for empty `parseAgentManifest` result → `agents: null`
- Code review (M3): Added `beforeEach(() => vi.clearAllMocks())` for test isolation, imported `beforeEach` from vitest
- Removed unused eslint-disable directive after mock cleanup fix

### Completion Notes List

- Story 7-2 was primarily a validation story — the API route was already implemented in Story 7-1 Task 7
- All 5 ACs validated against existing implementation: all satisfied
- Created 20 route-level tests covering all ACs plus edge cases (null-phase lastActivity, unnamed project, non-Error throws, empty agent manifest)
- Total workflow test count: 102 tests across 6 files (82 existing lib tests + 20 new route tests)
- `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` all passing
- Code review: 3 MEDIUM issues fixed (AC4 test reorganization, missing empty-manifest test, mock cleanup)
- Zero new dependencies (NFR-P6)
- Import boundaries verified: route imports only from `lib/workflow/*` and `@/lib/services`

### Limitations (Deferred Items)

1. LKG Cache Layer
   - Status: Deferred - Covered by Story 4.3 (LKG State Pattern & Error Resilience)
   - Requires: API-level caching of last-known-good responses
   - Epic: Epic 10 (Real-Time Updates & Error Resilience)
   - Current: Scanner handles file errors gracefully (returns empty), but no API-level cache for previously valid responses

### File List

**New files created:**
- `packages/web/src/app/api/workflow/[project]/route.test.ts` — 19 route-level tests covering all 5 ACs

**No existing files modified.**
