# Story 54.5: Scenario Persistence and History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to save scenario results and review them later**,
so that **I can reference past simulations for future decisions**.

## Acceptance Criteria

1. **Given** I have created and simulated scenarios
   **When** the server restarts
   **Then** all scenarios are preserved and still accessible
   **And** scenario data (name, parameters, results) is intact after restart

2. **Given** I navigate to the scenarios list page
   **When** I view the scenario cards
   **Then** each card shows the last modified timestamp
  **And** the timestamp reflects when the scenario was last updated (created, parameter change, or simulated)

3. **Given** I have run simulations in the past
   **When** I navigate to the scenarios list page
   **Then** I see all saved scenarios with name, date, and key results
  **And** I can re-open a scenario to view full details
  **And** I can delete old scenarios to clean up

4. **Given** I want to track scenario changes over time
   **When** I view a scenario detail page
  **Then** I see a history/revision log showing parameter changes and status transitions
  **And** each revision entry shows timestamp and field changed; and previous/new values

5. **Given** multiple scenarios exist in storage
   **When** the list endpoint is called
  **Then** scenarios are returned sorted by last modified date (newest first)
  **And** the response includes scenario metadata without full simulation results (list view is lightweight)

## Tasks / Subtasks

- [x] Task 1: Create file-based scenario persistence module (AC: #1, #3, #5)
  - [x] 1.1: Create `packages/web/src/lib/scenario-persistence.ts` with JSONL-based event log
  - [x] 1.2: Implement `loadScenarios()` — read JSONL file, replay events to rebuild Map
  - [x] 1.3: Implement `saveScenario()` — append JSONL event for create/update
  - [x] 1.4: Implement `deleteScenario()` — append deletion event, rebuild Map
  - [x] 1.5: Keep existing `scenario-store.ts` as thin re-export wrapper (same API, delegates to persistence)
  - [x] 1.6: Write unit tests in `packages/web/src/lib/__tests__/scenario-persistence.test.ts`

- [x] Task 2: Add revision tracking to scenario events (AC: #4)
  - [x] 2.1: Add `ScenarioRevision` type with timestamp, action, field details
  - [x] 2.2: Append revision entries for parameter changes, status transitions
  - [x] 2.3: Add `getRevisions(scenarioId)` function to query revision history
  - [x] 2.4: Add revision display to `ScenarioDetail` component (revision timeline)
  - [x] 2.5: Write tests for revision tracking

- [x] Task 3: Add `updatedAt` field to WhatIfScenario and API responses (AC: #2, #5)
  - [x] 3.1: Add `updatedAt` computed field to scenario list/detail responses
  - [x] 3.2: Update `ScenarioCard` to display last modified timestamp
  - [x] 3.3: Update `ScenariosView` to show lightweight list (no results in list view)
  - [x] 3.4: Update existing tests for new `updatedAt` field

- [x] Task 4: Run full regression suite and verify no breakage (AC: all)
  - [x] 4.1: Run `pnpm --filter @composio/ao-web test` — verify all tests pass
  - [x] 4.2: No new TypeScript errors introduced
  - [x] 4.3: No new ESLint errors introduced

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
**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Apply-to-production from scenario detail
   - Status: Deferred - Requires apply API route and confirmation dialog
   - Requires: Story 54.6 (Apply Scenario to Production)
   - Epic: Story 54.5 / Epic 54
   - Current: Scenario detail page shows parameter diff but but an apply button, but applying requires separate flow
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation
- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `readFile`, `writeFile`, `appendFile` from `node:fs/promises` — READ/WRITE JSONL persistence file
- `existsSync`, `mkdirSync` from `node:fs` — CHECK data directory existence
- `getScenario()`, `listScenarios()` from `@/lib/scenario-store` — READ scenarios (re-exports from persistence wrapper)
- `addScenario()` from `@/lib/scenario-store` — CREATE scenario (persists to disk)
- `updateScenario()` from `@/lib/scenario-store` — UPDATE scenario (persists to disk)
- `deleteScenario()` from `@/lib/scenario-store` — DELETE scenario (persists to disk)

- `WhatIfScenario`, from `@/lib/types` — TYPE for scenario data
- `ScenarioStatus` from `@/lib/types` — TYPE for scenario lifecycle

- `ScenarioRevision` from `@/lib/scenario-persistence` — TYPE for revision history

**Feature Flags:**
- None required — persistence is purely additive, wraps existing in-memory store

## Dependency Review

No new external dependencies required. All changes use Node.js built-in `node:fs` module:
- `appendFile` (promisified), `readFile` (promisified), `writeFile` (promisified)
- `existsSync`, `mkdirSync` from `node:fs`
- `path.join` from `node:path`
- `JSON.parse`, `JSON.stringify` for serialization (with try/catch for corrupted files)

- Existing `proper-lockfile` dependency can be used for concurrent write safety (optional)

## Dev Notes

### Architecture Context

This is **Story 5 of 6** in **Epic 54: What-If Simulation Engine**. It is the Intelligence phase (Cycle 10 Phase 2).

**Stories 54.1-54.4 (all done) established:**
- `WhatIfScenario` type with stories snapshot, parameters field, result field
- In-memory scenario store (`scenario-store.ts`) — `Map<string, WhatIfScenario>`
- API routes: `GET/POST /api/scenarios`, `GET/DELETE /api/scenarios/[id]`, `POST /api/scenarios/[id]/simulate`, `GET /api/scenarios/compare`
- Components: `ScenarioCreator`, `ScenarioCard`, `ScenariosView`, `ScenarioDetail`, `ScenarioComparisonView`
- Pages: `/scenarios`, `/scenarios/[id]`, `/scenarios/compare`
- Pure lib functions: `scenario-snapshot.ts`, `scenario-params.ts`, `scenario-simulation.ts`, `scenario-comparison.ts`, `scenario-helpers.ts`

**This story (54.5) adds:**
- File-based JSONL persistence replacing in-memory `Map` in `scenario-store.ts`
- Revision history tracking for parameter changes and status transitions
- `updatedAt` computed field on scenarios
- Last modified timestamp display on ScenarioCard
- Revision timeline in ScenarioDetail

**Story 54.6 (next) will add:**
- Apply-to-production flow with confirmation dialog
- Audit log entry for applied changes

### Previous Story Intelligence (Story 54.4)
**Key patterns established:**
1. **Pure function pattern**: `mapToComparableScenarios()` and `getBestMetricIndex()` are pure sync functions — no I/O, deterministic. All new persistence functions should follow this pattern.
2. **Server/Client component split**: Server components read from store; client components use `useState`/`useEffect`. Persistence is server-side only.
3. **API route pattern**: Use `new URL(request.url)` not `request.nextUrl`. Export `dynamic = "force-dynamic"`. Return `NextResponse.json(...)`.
4. **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`. Do NOT introduce new color tokens.
5. **JSONL persistence pattern** (from `collaboration-store.ts`):
   - Each mutation appends a JSONL line with `{ action, timestamp, data }`
   - On init, replay events to rebuild in-memory state
   - Use `proper-lockfile` for concurrent write safety
   - Wrap `JSON.parse` in try/catch — corrupted lines are skipped
   - Persistence errors are non-fatal (logged, don't crash)
6. **`ScenarioStatus` lifecycle**: `"draft"` → `"simulated"` (54.3) → `"applied"` (54.6). Comparison works with `"simulated"` or `"applied"` scenarios.
7. **Type mapping layer**: Core types (`Scenario`, `RankedScenario`) and web types (`WhatIfScenario`) have thin mapping functions between them.
8. **ESLint constraint**: `no-duplicate-imports` requires merged imports. `react-hooks/exhaustive-deps` rule NOT configured — use pre-computed variables for useEffect deps.
**Code review fixes from Story 54.4:**
- H1: Added `uniqueIds` dedup and `fetchedByName` guard for duplicate names detection
- H2: Added name collision guard (400 for duplicate scenario names)
- M1: Used `idsKey` for useEffect dep stability instead of inline join
- M2: Added `encodeURIComponent` for compare URL IDs
- M3: Imported `confidenceLabel` from shared helpers instead of duplicating
- M4: Changed JSDoc from "Throws if" to "Caller should check" for `mapToComparableScenarios`
- L1: Extracted `confidenceLabel` to `scenario-helpers.ts`
- L2: Added `selectedIds` cleanup on delete in ScenariosView
- L3: Removed redundant `.trim()` in compare page (route handles trimming)
- L4: Removed unused `recommendedIndex` from `ComparisonData` interface
**These fixes inform the current story: handle persistence errors gracefully, validate revision data, clean up on delete.

### What Already Exists (Do NOT Reinvent)
1. **`scenario-store.ts`** — Current in-memory store with 6 exports (`listScenarios`, `getScenario`, `addScenario`, `updateScenario`, `deleteScenario`, `clearScenarios`). KEEP the same API. Replace internals with file-backed persistence.
2. **`WhatIfScenario` type** — Already has `id`, `name`, `createdAt`, `projectIds`, `stories`, `status`, `result?`, `parameters?`. ADD `updatedAt` field.
3. **`ScenarioCard.tsx`** — Already renders name, status, delete action. ADD checkbox and last modified display.
4. **`ScenariosView.tsx`** — Already renders grid of ScenarioCard. ADD compare button, multi-select.
5. **`ScenarioDetail.tsx`** — Already renders parameters and simulation results. ADD revision timeline display.
6. **`scenario-helpers.ts`** — Has `statusBadgeColor()`, `statusLabel()`, `confidenceLabel()`. ADD `relativeTime()` for timestamp display.
7. **`collaboration-store.ts`** — JSONL persistence pattern reference. Follow its `appendLine()` and `load()` patterns.
8. **`proper-lockfile`** — Already in dependencies. Use for file write safety.
9. **All existing API routes** — No changes needed; they call the store functions which delegate to persistence.

10. **All existing test files** — Update mocks to handle async persistence (reject dummy mocks, use real file operations)

### Persistence Design
`scenario-persistence.ts` — JSONL event log:
```
// Data directory: .ao-scenarios/ in project root
// File: scenarios.jsonl — one JSONL line per mutation
// Event types: "created", "updated", "deleted"
// Event shape: { action: string, timestamp: string, scenario: WhatIfScenario }
// On init: read JSONL, replay events, rebuild Map
// On mutation: append JSONL line, update Map
// On delete: append JSONL line, remove from Map
// Corrupted lines: skip with warning (non-fatal)
// Uses proper-lockfile for concurrent write safety
```
**`scenario-store.ts` — Thin re-export wrapper:
```
// Keep same 6 exported function signatures
// Internally delegates to scenario-persistence functions
// No changes to any consumer (API routes, components)
```
### ScenarioRevision Type
```typescript
interface ScenarioRevision {
  scenarioId: string;
  timestamp: string;    // ISO 8601
  action: "created" | "updated" | "deleted" | "simulated";
  changes: {
    field: string;           // e.g., "parameters", "status", "result"
    previous?: unknown;   // value before change
    current: unknown;     // value after change
  }[];
}
```
### Revision Tracking Design
- Each `addScenario` appends `"created"` event
- Each `updateScenario` appends `"updated"` event with changes array
  - Parameter changes: `{ field: "parameters", previous: oldParams, current: newParams }`
  - Status transitions (simulated): `{ field: "status", previous: "draft", current: "simulated" }`
  - Result capture: `{ field: "result", previous: null, current: simResult }`
- Each `deleteScenario` appends `"deleted"` event
- `getRevisions(scenarioId)` replays JSONL, filters events for that scenario
- Revision timeline shown in ScenarioDetail with expandable sections
### File Structure to Create/Modify
```
packages/web/src/
├── lib/
│   ├── scenario-persistence.ts                  # NEW: JSONL file-based persistence
│   ├── scenario-store.ts                        # MODIFY: Delegate to persistence (keep same API)
│   ├── types.ts                                 # MODIFY: Add updatedAt to WhatIfScenario
│   └── __tests__/
│       ├── scenario-persistence.test.ts          # NEW: Persistence unit tests
├── components/
│   ├── ScenarioDetail.tsx                       # MODIFY: Add revision timeline display
│   └── __tests__/
│       └── ScenarioDetail.test.tsx                # MODIFY: Update for revision display
```
### Testing Strategy
**Unit tests (scenario-persistence.test.ts):** ~10 tests
- `loadScenarios()` reconstructs Map from JSONL events
- `saveScenario()` appends JSONL event
- `saveScenario()` handles corrupted lines gracefully
- `deleteScenario()` appends deletion event
- `deleteScenario()` removes from Map and updates JSONL
- `getRevisions()` filters events by scenario ID
- `getRevisions()` returns sorted revisions
- `saveScenario()` with proper-lockfile prevents corruption
- `loadScenarios()` handles empty/missing data directory

**Component tests (ScenarioDetail.test.tsx):** ~3 new tests
- Revision timeline renders for scenario with revisions
- Revision timeline shows "No changes yet" for created scenario
- Revision entries show field, previous, current values
**Existing store tests:** Update mocks
- Replace `vi.mock("@/lib/scenario-store")` with real persistence
- Verify existing API route tests still pass
- Verify existing component tests still pass ( new updatedAt assertions

### NFRs
- **NFR-E1-1:** Persistence load completes within 2 seconds for 100 scenarios
- **NFR-R2:** Persistence results are deterministic for identical inputs
- **NFR-S3:** Persistence does NOT modify scenario data without explicit approval
- **NFR-SC4:** Scenario persistence supports up to 1000 scenarios

### Pre-existing Types (Do NOT modify)
- `WhatIfScenario` — ADD `updatedAt?: string` field (optional)
- `ScenarioStatus` — already has `"draft"`, `"simulated"`, `"applied"` values
- `SimulationResult` from core — already has `p50Days`, `p80Days`, `p95Days`, `onTimeProbability`, `confidence`, `iterationsRun`
- `getScenario()` from scenario-store — READ scenarios (delegates to persistence)
- `listScenarios()` from scenario-store — READ scenarios (delegates to persistence)
- `addScenario()` from scenario-store — CREATE scenario (delegates to persistence)
- `updateScenario()` from scenario-store — UPDATE scenario (delegates to persistence)
- `deleteScenario()` from scenario-store — DELETE scenario (delegates to persistence)
- `ScenarioCard` — MODIFY to add last modified display
- `ScenariosView` — already has multi-select and compare button
- `ScenarioDetail` — MODIFY to add revision timeline
- `Navigation` component — NOT modified (already has `/scenarios` link)
### References
- [Source: epics-cycle-10.md#Story 54.5] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-E1-4] — "Scenarios can be saved and revisited later"
- [Source: prd-cycle-10.md#FR-E1-5] — "Users can apply a scenario to the actual system after review"
- [Source: packages/web/src/lib/scenario-store.ts] — Current in-memory store to be replaced
- [Source: packages/web/src/lib/types.ts] — WhatIfScenario, ScenarioStatus types
- [Source: packages/web/src/lib/scenario-helpers.ts] — Shared helper functions
- [Source: packages/web/src/lib/collaboration-store.ts] — JSONL persistence pattern reference
- [Source: packages/web/src/components/ScenarioDetail.tsx] — Component to add revision timeline
- [Source: packages/web/src/components/ScenarioCard.tsx] — Component to add last modified display
- [Source: _bmad-output/implementation-artifacts/54-4-side-by-side-scenario-comparison.md] — Previous story patterns
### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `scenario-persistence.ts`, `scenario-persistence.test.ts`
- Modified files: `scenario-store.ts`, `types.ts`, `ScenarioDetail.tsx`, `ScenarioCard.tsx` and their tests
- All existing tests must continue to pass ( no regressions)
## Dev Agent Record
### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
- `packages/web/src/lib/scenario-persistence.ts` — NEW: JSONL file-based persistence with revision tracking
- `packages/web/src/lib/__tests__/scenario-persistence.test.ts` — NEW: Unit tests for persistence (11 tests)
- `packages/web/src/lib/scenario-store.ts` — MODIFIED: Delegate to persistence, added getRevisions re-export
- `packages/web/src/lib/types.ts` — MODIFIED: Add `updatedAt` field to WhatIfScenario
- `packages/web/src/lib/scenario-helpers.ts` — MODIFIED: Add `relativeTime()` helper
- `packages/web/src/components/ScenarioDetail.tsx` — MODIFIED: Add revision timeline display, import confidenceLabel from helpers (dedup)
- `packages/web/src/components/ScenarioCard.tsx` — MODIFIED: Add last modified timestamp display
- `packages/web/src/app/api/scenarios/route.ts` — MODIFIED: await async store calls
- `packages/web/src/app/api/scenarios/[id]/route.ts` — MODIFIED: await async store calls
- `packages/web/src/app/api/scenarios/[id]/simulate/route.ts` — MODIFIED: await async store calls
- `packages/web/src/app/api/scenarios/compare/route.ts` — MODIFIED: await async store calls
- `packages/web/src/app/scenarios/page.tsx` — MODIFIED: await listScenarios()
- `packages/web/src/app/scenarios/[id]/page.tsx` — MODIFIED: await getScenario() + getRevisions(), pass revisions to ScenarioDetail
- `packages/web/src/app/api/scenarios/[id]/route.test.ts` — MODIFIED: mockReturnValue → mockResolvedValue
- `packages/web/src/app/api/scenarios/[id]/simulate/route.test.ts` — MODIFIED: mockReturnValue → mockResolvedValue
- `packages/web/src/app/api/scenarios/compare/route.test.ts` — MODIFIED: mockReturnValue → mockResolvedValue, async mockImplementation
- `packages/web/src/app/api/scenarios/route.test.ts` — MODIFIED: mockReturnValue → mockResolvedValue
