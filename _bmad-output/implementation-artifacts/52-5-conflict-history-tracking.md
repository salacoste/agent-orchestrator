# Story 52.5: Conflict History Tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to see a history of past conflicts and how they were resolved**,
so that **I can identify patterns and prevent recurring conflicts**.

## Acceptance Criteria

1. **Given** conflicts have occurred and been resolved
   **When** I view the conflict history
   **Then** I see a chronological log of conflicts with resolution method
   **And** each entry shows the conflict details, resolution strategy, and outcome

2. **Given** I am viewing the conflict history
   **When** I apply filters
   **Then** I can filter by date range (from/to), resource type, and project
   **And** the filtered results update immediately

3. **Given** I am viewing the conflict history
   **When** I click the export button
   **Then** I can download the history as a JSON file
   **And** the export respects any active filters

## Tasks / Subtasks

- [x] Task 1: Define conflict history types (AC: #1)
  - [x] 1.1: Define `ConflictResolutionOutcome` union: `"resolved" | "dismissed" | "escalated" | "auto-resolved"`
  - [x] 1.2: Define `ConflictHistoryEntry` interface extending `ResourceConflict` with resolution fields: `{ resolvedAt, resolutionStrategy, resolutionOutcome, resolvedBy, notes }`
  - [x] 1.3: Define `ConflictHistoryFilter` interface: `{ dateFrom?, dateTo?, resourceType?, projectId?, resolutionOutcome? }`
  - [x] 1.4: Define `ConflictPatternSummary` interface for aggregated statistics
  - [x] 1.5: Export all new types from `packages/core/src/index.ts`

- [x] Task 2: Implement conflict history store and query functions (AC: #1, #2)
  - [x] 2.1: Create `packages/core/src/conflict-history.ts` — conflict history module
  - [x] 2.2: Implement `appendConflictResolution(configPath, entry)` — append resolution event to JSONL history file
  - [x] 2.3: Implement `readConflictHistory(configPath): ConflictHistoryEntry[]` — load and parse JSONL history file
  - [x] 2.4: Implement `filterConflictHistory(entries, filter): ConflictHistoryEntry[]` — pure function for date range, resource type, project, outcome filtering
  - [x] 2.5: Implement `exportConflictHistory(entries): string` — serialize filtered entries to JSON export format
  - [x] 2.6: Implement `computeConflictPatterns(entries): ConflictPatternSummary` — aggregate statistics (most common resource type, recurring conflicts, avg resolution time)
  - [x] 2.7: Write unit tests — 32 tests passing for history store, query, filter, export, and pattern functions

- [x] Task 3: Add conflict history API routes (AC: #1, #2, #3)
  - [x] 3.1: Create `packages/web/src/app/api/conflicts/history/route.ts` — GET endpoint returning filtered conflict history with query params: `?dateFrom=&dateTo=&resourceType=&projectId=&outcome=`
  - [x] 3.2: Create `packages/web/src/app/api/conflicts/history/export/route.ts` — GET endpoint returning downloadable JSON export respecting query filter params
  - [x] 3.3: Handle edge cases: no history file (200 with empty array), file read errors (500)
  - [x] 3.4: Write route tests — 7 tests passing for both endpoints

- [x] Task 4: Create conflict history dashboard panel (AC: #1, #2, #3)
  - [x] 4.1: Create `packages/web/src/components/ConflictHistoryView.tsx` — main history panel with filter bar, pattern summary, and chronological list
  - [x] 4.2: Create `packages/web/src/components/ConflictHistoryFilters.tsx` — date range inputs, resource type select, project select, outcome select, clear button
  - [x] 4.3: Create `packages/web/src/components/ConflictHistoryList.tsx` — renders history entries with resolution details, outcome badges, and notes
  - [x] 4.4: Create `packages/web/src/components/ConflictPatternSummary.tsx` — displays total resolved, avg resolution time, most conflicted resource, recurring conflicts
  - [x] 4.5: Add export button that triggers download via `/api/conflicts/history/export`
  - [x] 4.6: Integrate into conflicts page as "History" tab alongside "Active Conflicts" tab via `ConflictsPageClient`
  - [x] 4.7: Write component tests — 25 tests passing across 4 test files (ConflictHistoryView, ConflictHistoryFilters, ConflictHistoryList, ConflictPatternSummary)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- No hidden TODOs or FIXMEs in completed tasks
- Deferred items explicitly documented

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. CSV export format
   - Status: Deferred - JSON export sufficient for MVP
   - Requires: CSV serializer, column selection UI
   - Current: JSON export only
2. Conflict history SSE updates
   - Status: Deferred - History view uses polling or manual refresh
   - Requires: Real-time resolution event broadcasting
   - Current: On-demand load via API
```

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `ResourceConflict` type from `@composio/ao-core` — base type for history entries
- `ResourceConflictType` type from `@composio/ao-core` — filter dimension
- `ResourceConflictResolutionStrategy` type from `@composio/ao-core` — resolution method recorded
- `createResourceConflictStore()` — access conflicts for resolution tracking
- `OrchestratorConfig` — project configuration for history queries
- `getServices()` from `@/lib/services` — service access in API routes
- `appendConflictAudit()` from `@composio/ao-core` — existing audit trail pattern to follow

**Feature Flags:**
- None required — builds on Story 52.1 JSONL audit trail infrastructure

## Dependency Review

No new external dependencies required. Uses existing:
- Vitest for testing
- `@composio/ao-core` for types and functions
- React hooks for UI components
- Tailwind CSS for styling

## Dev Notes

### Architecture Context

This is **Story 5 of 5** in **Epic 52: Resource Conflict Detection**. It depends on:
- **Story 52.1 (done):** Resource Conflict Detection Engine — all types (`ResourceConflict`, `ResourceConflictType`, `ResourceConflictSeverity`), detection functions, file store, JSONL audit trail (`appendConflictAudit`)
- **Story 52.2 (done):** Conflict Alert Dashboard — `ConflictDetailPanel`, `ConflictAlertDashboard`, SSE integration, conflict broadcaster
- **Story 52.3 (review):** Conflict Resolution Suggestions — `generateSuggestions`, `ConflictResolutionResponse`, `ResourceConflictResolutionStrategy` type

This story builds the **history tracking layer** — recording resolution outcomes, querying past conflicts, identifying patterns, and providing export capability.

### Previous Story Intelligence (52.3: Conflict Resolution Suggestions)

Key patterns and learnings:
- **Pure function pattern**: `generateSuggestions()` is pure sync. Follow the same pattern for `filterConflictHistory()` and `exportConflictHistory()` — pure functions, no I/O
- **ID generation**: Use the same `generateConflictId()` pattern (timestamp-base36 + random hex) for history entry IDs
- **JSONL audit trail already exists**: `appendConflictAudit()` in `resource-conflict.ts` writes scan results to `resource-conflicts-audit.jsonl`. This story adds a **resolution history** JSONL — separate file for resolution events
- **Export pattern**: Export builds on the existing JSONL read pattern — parse entries, filter, serialize to JSON
- **Build before test**: Always rebuild `@composio/ao-core` after adding new exports

### JSONL History Design

**Two JSONL files** (separate concerns):

| File | Purpose | Written By | Content |
|---|---|---|---|
| `resource-conflicts-audit.jsonl` | Detection scan log | Story 52.1 `appendConflictAudit()` | Scan results: timestamp, conflict count, scan duration, conflicts |
| `resource-conflicts-history.jsonl` | Resolution history | This story `appendConflictResolution()` | Resolution events: conflict snapshot + resolution details |

**Why separate files?** The audit trail records *detections* (every scan). The history file records *resolutions* (human actions). Different write cadences, different query patterns.

**Resolution history entry shape:**
```json
{
  "id": "history-<timestamp-base36>-<random>",
  "conflict": { ...ResourceConflict... },
  "resolvedAt": "2026-04-01T14:30:00Z",
  "resolutionStrategy": "sequential-scheduling",
  "resolutionOutcome": "resolved",
  "resolvedBy": "user@example.com",
  "notes": "Queued project B after project A completion",
  "detectedAt": "2026-04-01T12:00:00Z"
}
```

### Filter Design

**`ConflictHistoryFilter`:**
```typescript
interface ConflictHistoryFilter {
  dateFrom?: string;     // ISO date, inclusive
  dateTo?: string;       // ISO date, inclusive
  resourceType?: ResourceConflictType;
  projectId?: string;    // matches against competingProjects array
  resolutionOutcome?: ConflictResolutionOutcome;
}
```

**`filterConflictHistory` pure function:**
- Date range: `resolvedAt >= dateFrom && resolvedAt <= dateTo`
- Resource type: `conflict.resourceType === filter.resourceType`
- Project: `conflict.competingProjects.includes(filter.projectId)`
- Outcome: `resolutionOutcome === filter.resolutionOutcome`
- Multiple filters combine with AND logic
- Empty filter returns all entries

### Pattern Analysis Design

**`ConflictPatternSummary`:**
```typescript
interface ConflictPatternSummary {
  totalResolved: number;
  byResourceType: Record<ResourceConflictType, number>;
  byOutcome: Record<ConflictResolutionOutcome, number>;
  byStrategy: Record<ResourceConflictResolutionStrategy, number>;
  mostConflictedResource: string | null;
  avgResolutionTimeMs: number;  // resolvedAt - detectedAt
  recurringConflicts: Array<{ resourceIdentifier: string; count: number }>;
}
```

### API Route Design

**Endpoint 1: `GET /api/conflicts/history`**
- Query params: `dateFrom`, `dateTo`, `resourceType`, `projectId`, `outcome`
- Response: `{ entries: ConflictHistoryEntry[], patterns: ConflictPatternSummary, filter: ConflictHistoryFilter }`
- Returns 200 with empty array if no history file exists

**Endpoint 2: `GET /api/conflicts/history/export`**
- Query params: same filters as history endpoint
- Response: JSON file download with `Content-Disposition: attachment` header
- Returns filtered entries as JSON array

### Conflict Page Tab Integration

The existing `/conflicts` page has a `ConflictAlertDashboard` for live conflicts. This story adds a **History** tab:

```
┌─────────────────────────────────────────┐
│  [Active Conflicts]  [History]          │  ← Tab toggle
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │  Filters: [From] [To] [Type]   │    │  ← ConflictHistoryFilters
│  │          [Project] [Outcome]    │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Pattern Summary:               │    │  ← ConflictPatternSummary
│  │  Total: 24  Most: repository    │    │
│  │  Avg resolution: 2.5h           │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  [Export JSON]                   │    │  ← Export button
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  History Entry 1                │    │  ← ConflictHistoryList
│  │  repo/org/shared • 2 projects   │    │
│  │  Resolved: sequential-schedule  │    │
│  │  Apr 1, 2026                    │    │
│  ├─────────────────────────────────┤    │
│  │  History Entry 2                │    │
│  │  ...                            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Tab implementation**: Add `activeTab` state to the conflicts page. When "History" is selected, render `ConflictHistoryView` instead of `ConflictAlertDashboard`. No router changes needed — client-side state toggle.

### File Structure to Create/Modify

```
packages/core/src/
├── conflict-history.ts                            # NEW: Types, history store, query, filter, export, pattern analysis
├── index.ts                                       # MODIFY: Export new types and functions
└── __tests__/
    └── conflict-history.test.ts                   # NEW: Unit tests for history functions

packages/web/src/
├── app/api/conflicts/
│   ├── history/
│   │   ├── route.ts                               # NEW: GET endpoint for conflict history
│   │   └── route.test.ts                          # NEW: History route tests
│   └── history/
│       └── export/
│           ├── route.ts                           # NEW: GET endpoint for history export
│           └── route.test.ts                      # NEW: Export route tests
├── components/
│   ├── ConflictHistoryView.tsx                    # NEW: Main history panel (tab wrapper)
│   ├── ConflictHistoryFilters.tsx                 # NEW: Filter bar component
│   ├── ConflictHistoryList.tsx                    # NEW: Paginated history list
│   ├── ConflictPatternSummary.tsx                 # NEW: Pattern statistics display
│   └── ConflictDetailPanel.tsx                    # NO CHANGE (already has suggestions from 52.3)
└── components/__tests__/
    ├── ConflictHistoryView.test.tsx               # NEW: History view tests
    ├── ConflictHistoryFilters.test.tsx            # NEW: Filter component tests
    ├── ConflictHistoryList.test.tsx               # NEW: List component tests
    └── ConflictPatternSummary.test.tsx            # NEW: Pattern summary tests
```

### Testing Strategy

**Core unit tests (conflict-history.test.ts):**
- `appendConflictResolution` writes valid JSONL entry
- `readConflictHistory` loads and parses JSONL entries
- `readConflictHistory` handles missing file (returns empty array)
- `readConflictHistory` handles malformed lines (skips, continues)
- `filterConflictHistory` filters by date range
- `filterConflictHistory` filters by resource type
- `filterConflictHistory` filters by project ID
- `filterConflictHistory` filters by resolution outcome
- `filterConflictHistory` combines multiple filters (AND logic)
- `filterConflictHistory` returns all entries with empty filter
- `exportConflictHistory` produces valid JSON
- `computeConflictPatterns` computes correct aggregates
- `computeConflictPatterns` handles empty input
- `computeConflictPatterns` identifies recurring conflicts

**API route tests:**
- GET /api/conflicts/history returns history entries
- GET /api/conflicts/history returns empty array when no history
- GET /api/conflicts/history applies query filters
- GET /api/conflicts/history returns patterns summary
- GET /api/conflicts/history/export returns JSON with download headers
- GET /api/conflicts/history/export respects filter params

**Component tests:**
- `ConflictHistoryView` renders history tab with filters, list, and summary
- `ConflictHistoryFilters` renders all filter inputs
- `ConflictHistoryFilters` calls onFilterChange when values change
- `ConflictHistoryList` renders history entries
- `ConflictHistoryList` shows empty state when no entries
- `ConflictPatternSummary` renders aggregate statistics
- `ConflictPatternSummary` handles empty history gracefully

### NFRs

- **NFR-P4:** History API responds within 500ms (JSONL read + filter is fast for typical history sizes)
- **NFR-F4-2:** Pattern analysis scales to 50 projects (O(n) scan of JSONL entries)
- **NFR-F4-5:** Conflict history is tracked and queryable for pattern analysis (core requirement for this story)
- **NFR-P1:** History dashboard loads within 2 seconds

### Pre-existing Conflict Types (Do NOT use)

Same warning as Stories 52.1-52.3: there are existing conflict types in `types.ts` for agent assignment conflicts (Epic 50):
- `ConflictResolutionService` — for agent assignment conflicts, NOT resource conflicts
- `ResolutionStrategy` — for agent assignment, NOT resource conflicts
- `AgentConflict` — different system entirely

These are in a **separate namespace**. Story 52.5 creates new types specifically for **resource conflict history**. Do NOT import or extend the agent assignment types.

### References

- [Source: epics-cycle-10.md#Epic 52 Story 52.5] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-F4-5] — Conflict history tracking requirement
- [Source: prd-cycle-10.md#NFR-F4-1, NFR-F4-2] — Performance and scalability NFRs
- [Source: _bmad-output/implementation-artifacts/52-1-resource-conflict-detection-engine.md] — Previous story: types, detection, store, JSONL audit trail
- [Source: _bmad-output/implementation-artifacts/52-3-conflict-resolution-suggestions.md] — Previous story: suggestion types, resolution strategy types
- [Source: packages/core/src/resource-conflict.ts] — ResourceConflict types, detection engine, JSONL audit trail pattern
- [Source: packages/core/src/resource-conflict-suggestions.ts] — Resolution strategy types
- [Source: packages/web/src/app/conflicts/page.tsx] — Current conflicts page (add History tab here)
- [Source: packages/web/src/components/ConflictAlertDashboard.tsx] — Active conflicts dashboard (tab sibling)
- [Source: CLAUDE.md] — TypeScript conventions (ESM, .js extensions, node: prefix, strict mode)

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New file `conflict-history.ts` follows same module pattern as `resource-conflict.ts`
- API routes follow same pattern as existing `/api/conflicts` routes
- JSONL history file follows same pattern as `resource-conflicts-audit.jsonl`
- All existing tests must continue to pass (no regressions)

## Dev Agent Record

### Agent Model Used

Claude claude-sonnet-4-20250514

### Debug Log References

- Route tests initially returned 500 because `request.nextUrl` is undefined on plain `Request` objects. Fixed by using `new URL(request.url)` instead.
- `computeConflictPatterns` mock needed to be overridden in "empty entries" test to return zero stats.

### Completion Notes List

1. Core module: All 32 unit tests passing (ID generation, filter, export, patterns, JSONL persistence, integration pipeline)
2. API routes: 7 tests passing (history endpoint with filtering, export endpoint with download headers, error handling)
3. Dashboard components: 25 tests passing across 4 test files (ConflictHistoryView, ConflictHistoryFilters, ConflictHistoryList, ConflictPatternSummary)
4. Conflicts page updated with tab navigation (Active Conflicts / History)
5. Full regression suite: 1,721 tests passing across 146 test files
6. **Code Review Fixes (2026-04-02)**:
   - Fixed `avgResolutionTimeMs` bug: now divides by valid-date count instead of total entries count
   - Fixed pattern summary: now computes on filtered dataset (not always all entries)
   - Extracted shared `parseHistoryFilter()` into `filter-utils.ts` — DRY violation resolved
   - Expanded export route tests: added coverage for resourceType, dateFrom/dateTo, outcome filters
   - All 67 tests pass (32 core + 10 route + 25 component)

### File List

**New Files (core):**
- `packages/core/src/conflict-history.ts` — Types, JSONL store, query/filter/export, pattern analysis
- `packages/core/src/__tests__/conflict-history.test.ts` — 32 unit tests

**New Files (web API):**
- `packages/web/src/app/api/conflicts/history/route.ts` — GET /api/conflicts/history
- `packages/web/src/app/api/conflicts/history/filter-utils.ts` — Shared filter parsing (DRY refactored from both routes)
- `packages/web/src/app/api/conflicts/history/export/route.ts` — GET /api/conflicts/history/export
- `packages/web/src/app/api/conflicts/history/route.test.ts` — 10 route tests (expanded from 7)

**New Files (web components):**
- `packages/web/src/components/ConflictHistoryView.tsx` — Main history panel with data fetching
- `packages/web/src/components/ConflictHistoryFilters.tsx` — Filter bar with date/type/project/outcome
- `packages/web/src/components/ConflictHistoryList.tsx` — Chronological entry list with outcome badges
- `packages/web/src/components/ConflictPatternSummary.tsx` — Pattern statistics cards
- `packages/web/src/components/__tests__/ConflictHistoryView.test.tsx` — 5 tests
- `packages/web/src/components/__tests__/ConflictHistoryFilters.test.tsx` — 7 tests
- `packages/web/src/components/__tests__/ConflictHistoryList.test.tsx` — 6 tests
- `packages/web/src/components/__tests__/ConflictPatternSummary.test.tsx` — 7 tests

**Modified Files:**
- `packages/core/src/index.ts` — Added conflict history exports
- `packages/web/src/app/conflicts/page.tsx` — Server component rendering ConflictsPageClient
- `packages/web/src/app/conflicts/client.tsx` — NEW: Client component with Active/History tab toggle

### Limitations (Deferred Items)

1. CSV export format
   - Status: Deferred - JSON export sufficient for MVP
   - Requires: CSV serializer, column selection UI
   - Current: JSON export only
2. Conflict history SSE updates
   - Status: Deferred - History view uses on-demand fetch (no polling/SSE)
   - Requires: Real-time resolution event broadcasting
   - Current: Manual refresh via tab switch
