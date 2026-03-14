# Story 10.4: Error Resilience Tests

Status: done

## Story

As a developer,
I want comprehensive tests covering the 30-scenario error resilience matrix, LKG cache sequential validation, file watcher debounce, and panel independence,
so that the system's fault tolerance is verified before release and no regressions can slip through.

## Acceptance Criteria

1. **Given** the LKG cache layer
   **When** tested with sequential calls (valid data → invalid data → valid data)
   **Then** the cache returns valid data on the second call and fresh data on the third

2. **Given** the file watcher debounce
   **When** tested with 10 rapid file change events within 200ms
   **Then** only one SSE notification callback is dispatched

3. **Given** the 6 file states (normal, empty, truncated YAML, invalid frontmatter, permission denied, mid-write)
   **When** tested against each of the 5 data sources (artifacts, phases, recommendation, agents, lastActivity)
   **Then** all 30 scenarios produce graceful results with no thrown exceptions and no error responses (always HTTP 200)

4. **Given** panel independence
   **When** one data source is in an error state and others are normal
   **Then** the API response includes LKG for the failed source and fresh data for all others

## Tasks / Subtasks

- [x] Task 1: Create 30-scenario error resilience matrix test file (AC: 3)
  - [x] 1.1 Create `packages/web/src/app/api/workflow/[project]/route-resilience.test.ts`
  - [x] 1.2 Implement matrix test for **artifacts** across all 6 file states (6 tests)
  - [x] 1.3 Implement matrix test for **agents** across all 6 file states (6 tests)
  - [x] 1.4 Implement matrix test for **phases** across all 6 file states (6 tests)
  - [x] 1.5 Implement matrix test for **recommendation** across all 6 file states (6 tests)
  - [x] 1.6 Implement matrix test for **lastActivity** across all 6 file states (6 tests)
  - [x] 1.7 Verify: all 30 test cases return HTTP 200 + 1 combined failure meta-test (31 tests total)
- [x] Task 2: LKG sequential validation tests (AC: 1)
  - [x] 2.1 Added to `route-resilience.test.ts` as "LKG Sequential Validation" describe block
  - [x] 2.2 Test: valid → invalid → valid sequence for **artifacts** (3-call cycle with cache verification)
  - [x] 2.3 Test: valid → invalid → valid sequence for **agents** (3-call cycle with new agent data on recovery)
  - [x] 2.4 Test: valid → total failure → valid sequence (outer catch path via getServices throw)
  - [x] 2.5 Verify: cached values from call 2 match fresh values from call 1 exactly (dedicated test)
  - [x] 2.6 Verify: fresh values from call 3 are NOT stale (artifact sequence test verifies 3 artifacts vs 2)
- [x] Task 3: File watcher debounce test (AC: 2)
  - [x] 3.1 Verified: existing test at `workflow-watcher.test.ts:89-101` "coalesces 10 rapid events into a single callback"
  - [x] 3.2 N/A — already covered by existing test
  - [x] 3.3 Documented in Dev Notes: test fires 10 events, advances 200ms, asserts callback called once
- [x] Task 4: Panel independence comprehensive tests (AC: 4)
  - [x] 4.1 Added to `route-resilience.test.ts` as "Panel Independence" describe block
  - [x] 4.2 Test: artifacts fail → agents fresh, phases from LKG, recommendation from LKG
  - [x] 4.3 Test: agents fail → artifacts fresh, phases fresh, recommendation fresh, lastActivity fresh
  - [x] 4.4 Test: both artifacts AND agents fail → all from LKG
  - [x] 4.5 Test: artifacts fail on cold start → artifacts `[]`, agents fresh, lastActivity `null`
  - [x] 4.6 Test: fresh sources are NOT pulled from cache (proves freshness with different mock data)
- [x] Task 5: Lint, typecheck, verify (all ACs)
  - [x] 5.1 Run `pnpm lint` — 0 errors (1 pre-existing warning in lkg-cache.ts)
  - [x] 5.2 Run `pnpm typecheck` — clean
  - [x] 5.3 Run `pnpm test` — 496 tests pass (all packages); web: 770 passed, 2 pre-existing failures in conflicts.test.ts
  - [x] 5.4 Verified: no test uses `expect(true).toBe(true)` — all assertions are real
  - [x] 5.5 Verified: all 30 matrix scenarios tested (5 sources × 6 states = 30 tests + 1 combined + 4 sequential + 5 panel = 40 total)

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

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [x] No core interface methods used — this story is test-only within `packages/web`
- [x] No feature flags needed — tests use vitest mocks against existing implementation

**Methods Used:**
- [x] All tested methods already exist: `scanAllArtifacts`, `buildPhasePresence`, `computePhaseStates`, `getRecommendation`, `parseAgentManifest`
- [x] `lkgCache.get()`, `lkgCache.setAll()`, `lkgCache._resetForTesting()` — from Story 10-3
- [x] `subscribeWorkflowChanges()` — from Story 10-1 (for debounce tests)

**Feature Flags:**
- None required

## Dependency Review (if applicable)

**No new dependencies required.** This story is test-only, using:
- `vitest` (existing dev dependency)
- `vi.mock`, `vi.hoisted`, `vi.fn` — vitest mock utilities (already in use)
- Existing production code — all modules from Stories 10-1, 10-2, 10-3

## Dev Notes

### Critical Architecture Context

**WD-7 (LKG State Pattern — Three Layers):** Stories 10-1, 10-2, 10-3 implemented all three layers. This story VALIDATES them with exhaustive testing.

| Layer | Responsibility | Story | Test Coverage Before 10-4 |
|-------|---------------|-------|--------------------------|
| Layer 1 — File Reading | Try/catch per data source | 10-3 | Basic: 6 tests in route-lkg.test.ts |
| Layer 2 — API Cache | In-memory per-field LKG | 10-3 | 8 unit tests + 8 integration tests |
| Layer 3 — Client State | React state retention | 10-2 | 6 tests in useWorkflowSSE.test.ts |
| **WD-5 — Debounce** | 200ms chokidar stabilization | 10-1 | ~20 tests in workflow-watcher.test.ts |

**NFR-R1 (Error Resilience Coverage):** Zero user-visible errors across 6 file states × 5 panels = 30 scenarios. This story proves it.

**NFR-T5 (File State Test Matrix):** Explicit test cases for all 6 file states. This story provides them.

### 30-Scenario Matrix Design

The matrix tests 6 file states against 5 data sources at the **API route level** (integration tests). Each test:
1. Sets up mocks to simulate the file state for that data source
2. Calls `GET /api/workflow/[project]`
3. Asserts HTTP 200
4. Asserts the affected field is gracefully populated (fresh, cached, or default)
5. Asserts unaffected fields are fresh (panel independence)

**6 File States:**

| # | State | How to Mock | Behavior |
|---|-------|-------------|----------|
| 1 | Normal (readable) | Default mock behavior | Fresh data returned |
| 2 | Empty (0-byte) | Return `""` from readFile / return `[]` from scanAllArtifacts | Empty arrays, null fields |
| 3 | Truncated YAML | Return malformed string from readFile | parseAgentManifest returns `[]`, artifacts partially classified |
| 4 | Invalid frontmatter | Return CSV with wrong columns / artifacts with null phases | Parsing skips invalid rows |
| 5 | Permission denied (EACCES) | `mockRejectedValueOnce(new Error("EACCES: permission denied"))` | LKG fallback |
| 6 | Mid-write (EBUSY) | `mockRejectedValueOnce(new Error("EBUSY: resource busy"))` | LKG fallback |

**5 Data Sources (mapped to response fields):**

| # | Source | I/O Function | Response Field | Error → Fallback |
|---|--------|-------------|----------------|-----------------|
| 1 | Artifacts | `scanAllArtifacts()` | `artifacts` | LKG `artifacts` or `[]` |
| 2 | Phases | `buildPhasePresence()` + `computePhaseStates()` | `phases` | LKG `phases` or all "not-started" |
| 3 | Recommendation | `getRecommendation()` | `recommendation` | LKG `recommendation` or `null` |
| 4 | Agents | `readFile()` + `parseAgentManifest()` | `agents` | LKG `agents` or `null` |
| 5 | LastActivity | Derived from `artifacts.find(a => a.phase !== null)` | `lastActivity` | Derived from LKG artifacts or `null` |

**IMPORTANT — Data Source Dependencies:**
- **Phases, recommendation, and lastActivity are DERIVED from artifacts.** When `scanAllArtifacts()` fails, all three are affected. The per-source try/catch blocks isolate them so each can fall back to its own LKG cache independently.
- **Agents are fully independent** — `readFile()` for agent manifest is a separate I/O path from `scanAllArtifacts()`.
- **States 2-4 (empty/truncated/invalid)** for derived sources (phases, recommendation, lastActivity) should be tested by providing bad artifact data to their computation functions, not by making the pure functions throw (they never throw).

### Mock Patterns (Reuse from Story 10-3)

The test file should follow the SAME mock setup as `route-lkg.test.ts`:

```typescript
// vi.hoisted for fs mocks
const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(async (dirPath: string) => { /* ... */ }),
  mockReadFile: vi.fn(async () => { /* default valid CSV */ }),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: mockReaddir, readFile: mockReadFile },
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

// Module-level mocks for workflow functions
const { mockScanAllArtifacts, mockBuildPhasePresence } = vi.hoisted(() => ({
  mockScanAllArtifacts: vi.fn(async () => mockArtifacts),
  mockBuildPhasePresence: vi.fn(() => mockPresence),
}));
```

**Error simulation patterns:**
```typescript
// EACCES
mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES: permission denied"));
// EBUSY
mockScanAllArtifacts.mockRejectedValueOnce(new Error("EBUSY: resource busy"));
// ENOENT
mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));
// Empty result
mockScanAllArtifacts.mockResolvedValueOnce([]);
// Truncated CSV
mockReadFile.mockResolvedValueOnce("name,displayName");  // Missing required columns
// Invalid content
mockScanAllArtifacts.mockResolvedValueOnce([{ filename: "unknown.md", path: "...", modifiedAt: "...", phase: null, type: "Uncategorized" }]);
```

### LKG Sequential Validation Pattern

The sequential validation tests verify the cache lifecycle:

```
Call 1 (valid):   scanAllArtifacts → [artifact1, artifact2] → response has fresh artifacts → cache stores [artifact1, artifact2]
Call 2 (invalid): scanAllArtifacts throws EACCES → catch uses lkgCache.get("artifacts") → returns [artifact1, artifact2] from cache
Call 3 (valid):   scanAllArtifacts → [artifact1, artifact2, artifact3] → response has FRESH artifacts → cache updated to [artifact1, artifact2, artifact3]
```

Key assertion: call 3's cache value must be the NEW data (3 artifacts), not the stale data from call 1. This proves AC6 (cache refresh after recovery).

### File Watcher Debounce (AC2)

Check `packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts` first. If it already has a test that fires rapid events and verifies callback count = 1, document which test satisfies AC2 and skip writing a duplicate.

If not covered, add a test:
```typescript
it("dispatches one callback for 10 rapid events within 200ms", async () => {
  const callback = vi.fn();
  subscribeWorkflowChanges(callback);

  // Simulate 10 rapid file changes
  for (let i = 0; i < 10; i++) {
    emitFileChange("test-project", `file${i}.md`);
  }

  // Wait for debounce stabilization (200ms + margin)
  await new Promise(resolve => setTimeout(resolve, 300));

  expect(callback).toHaveBeenCalledTimes(1);
});
```

### Previous Story Learnings (Story 10-3)

- **Variable scoping in try/catch:** `const` in `try` block is NOT accessible in `catch`. Must hoist with `let`.
- **Module-level singleton isolation:** Always call `lkgCache._resetForTesting()` in `beforeEach`.
- **`mockRejectedValueOnce` vs `mockRejectedValue`:** Use `Once` variants so default behavior restores automatically for subsequent calls.
- **ESLint hook enforcement:** Import + usage must be in the same edit to avoid "unused import" errors.
- **Test for `hasBmad: false` on cold-start failure:** The outer catch returns `hasBmad: false` when BMAD state is unknown (code review fix M3).

### Cross-Story Context

| Story | Status | What It Built | What 10-4 Validates |
|-------|--------|--------------|---------------------|
| 10-1 | done | File watcher + SSE dispatch | Debounce behavior (AC2) |
| 10-2 | done | Client SSE subscription + Layer 3 LKG | (Client tests already complete) |
| 10-3 | done | Server LKG cache + per-source try/catch | 30-scenario matrix (AC3), sequential validation (AC1), panel independence (AC4) |

### Project Structure Notes

- All new test files in `packages/web/src/app/api/workflow/[project]/` (route-level integration tests)
- ESM imports with `.js` extensions required
- `type` keyword for type-only imports
- Co-located test files follow `*.test.ts` naming
- Test isolation: `lkgCache._resetForTesting()` in `beforeEach`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WD-7 LKG State Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-5 SSE Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-4 API Design & Contract]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md#Epic 4 Story 4.4]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md#FR24 FR25 FR26 FR27]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md#NFR-R1 NFR-T5]
- [Source: _bmad-output/implementation-artifacts/10-3-lkg-state-pattern-and-error-resilience.md]
- [Source: packages/web/src/app/api/workflow/[project]/route.ts — API route with per-source LKG]
- [Source: packages/web/src/app/api/workflow/[project]/route-lkg.test.ts — existing LKG tests]
- [Source: packages/web/src/lib/workflow/lkg-cache.ts — LKG cache module]
- [Source: packages/web/src/lib/workflow/scan-artifacts.ts — artifact scanner (readdir/stat)]
- [Source: packages/web/src/lib/workflow/parse-agents.ts — CSV parser]
- [Source: packages/web/src/lib/workflow/compute-state.ts — phase computation (pure)]
- [Source: packages/web/src/lib/workflow/recommendation-engine.ts — 7-rule chain (pure)]
- [Source: packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts — debounce tests]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Created `route-resilience.test.ts` with 40 tests covering all 4 acceptance criteria
- 30-scenario matrix: 5 data sources × 6 file states, each asserting HTTP 200 and correct field values
- LKG sequential validation: 4 tests covering valid→invalid→valid cycles for artifacts, agents, and total failure
- Panel independence: 5 tests proving failed sources use LKG while working sources stay fresh
- File watcher debounce (AC2): satisfied by existing test `workflow-watcher.test.ts:89-101` ("coalesces 10 rapid events into a single callback")
- Fixed TypeScript error: `mockGetRecommendation` return type needed `unknown` instead of inferred `Recommendation` to allow `null` return
- All hoisted mocks use `vi.hoisted()` pattern with explicit `beforeEach` restoration
- 2 pre-existing failures in `conflicts.test.ts` confirmed as unrelated (exist on clean main)

### Debounce Test Coverage (AC2)

AC2 is satisfied by the existing test in `packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts` at line 89-101:
```
describe("debounce") → "coalesces 10 rapid events into a single callback"
```
This test fires exactly 10 rapid events, advances the timer by 200ms, and asserts the callback was called exactly once. This directly satisfies the AC2 requirement.

### File List

- `packages/web/src/app/api/workflow/[project]/route-resilience.test.ts` — NEW: 40 tests (30 matrix + 4 sequential + 5 panel + 1 combined)
