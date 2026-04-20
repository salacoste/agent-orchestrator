# Story 61.2: Project Memory Dashboard Viewer

Status: done

## Story

As a project lead managing accumulated knowledge across sessions,
I want a dashboard panel to view, filter, edit, and delete cross-session memory entries,
so that I can curate and manage the knowledge that flows into future agent sessions.

## Acceptance Criteria

1. **AC#1 — Load Display**: API route loads accumulated cross-session memory via `loadAccumulatedMemory()` and returns entries as JSON
2. **AC#2 — Type Filtering**: Dashboard panel filters entries by type (convention, decision, directive, learning)
3. **AC#3 — Source Session Filter**: Dashboard panel filters entries by source session ID (text search)
4. **AC#4 — Edit Capability**: PUT endpoint updates an entry's content, rewrites JSONL atomically; dashboard provides inline edit with save/cancel
5. **AC#5 — Delete Capability**: DELETE endpoint removes an entry by contentHash, rewrites JSONL atomically; dashboard provides delete with confirmation dialog
6. **AC#6 — Entry Metadata**: Each displayed entry shows: type badge (color-coded), content, source session count, first/last seen timestamps
7. **AC#7 — SSE Updates**: SSE endpoint streams memory updates with polling-based change detection (same pattern as 60-9)
8. **AC#8 — Config Gate**: API only returns data when `project.learning.crossSessionMemory` is enabled; shows disabled state when off
9. **AC#9 — Non-Fatal**: API errors never crash — graceful degradation with empty/error states
10. **AC#10 — Test Coverage**: Unit tests for new core functions, API route tests, component tests

## Tasks / Subtasks

- [x] Task 1: Add write operations to memory-bridge.ts (AC: #4, #5)
  - [x] Add `removeEntry(projectDir, contentHash): Promise<void>` — reads all entries via `loadAccumulatedMemory()`, filters out matching contentHash, atomic rewrite of remaining entries
  - [x] Add `updateEntry(projectDir, contentHash, newContent): Promise<void>` — reads all entries, updates matching entry's content + lastSeenAt, atomic rewrite
  - [x] Both use atomic temp-file-then-rename pattern (same as `writeProjectMemory` in `project-memory.ts`)
  - [x] Both recompute contentHash for updated entries via `computeContentHash()`
  - [x] Export both from `packages/core/src/index.ts`
- [x] Task 2: Create API route — GET/PUT/DELETE (AC: #1, #4, #5, #8, #9)
  - [x] Create `packages/web/src/app/api/cross-session-memory/[project]/route.ts`
  - [x] GET handler: resolve project config from `[project]` param, check `learning.crossSessionMemory` config gate, call `loadAccumulatedMemory(projectPath)`, return `{ entries, project, enabled }`
  - [x] DELETE handler: accept `{ contentHash }` body, call `removeEntry()`, return updated entries
  - [x] PUT handler: accept `{ contentHash, content }` body, validate content non-empty, call `updateEntry()`, return updated entries
  - [x] All wrapped in try/catch — return appropriate error status or empty array on failure
  - [x] Set `Cache-Control: no-cache, no-store, must-revalidate` on all responses
- [x] Task 3: Create SSE stream route (AC: #7)
  - [x] Create `packages/web/src/app/api/cross-session-memory/[project]/stream/route.ts`
  - [x] Same polling pattern as `/api/session/[id]/memory/stream` from Story 60-9
  - [x] Initial `event: memory-update` snapshot, then poll every 5s with JSON.stringify diff detection
  - [x] `: heartbeat` comments every 15 seconds
  - [x] Config-gated: returns empty snapshot when feature disabled
- [x] Task 4: Create data fetching hook (AC: #1, #7)
  - [x] Create `packages/web/src/hooks/useCrossSessionMemory.ts`
  - [x] Same pattern as `useProjectMemorySSE` — initial REST GET then SSE EventSource subscription
  - [x] Listen for named `memory-update` events (use `addEventListener`, not `onmessage`)
  - [x] Exponential backoff reconnection on errors (up to 8s)
  - [x] Returns `{ entries: CrossSessionMemoryEntry[], enabled: boolean, connected: boolean, error: boolean }`
- [x] Task 5: Create CrossSessionMemoryViewer component (AC: #2, #3, #4, #5, #6)
  - [x] Create `packages/web/src/components/CrossSessionMemoryViewer.tsx` — `"use client"` component
  - [x] Props: `{ projectName: string }`
  - [x] Uses `useCrossSessionMemory(projectName)` hook
  - [x] **Filter bar**: type dropdown (All / Convention / Decision / Directive / Learning) + session ID text input
  - [x] **Entry list**: grouped by type with section headers (same grouping pattern as `ProjectMemoryViewer`)
  - [x] **Per entry row**: type badge (color-coded), content text, session count badge ("from N session(s)"), relative timestamps, hover-revealed Edit/Delete buttons
  - [x] **Edit mode**: inline `<textarea>` replacing content, Save calls PUT then refreshes, Cancel restores original
  - [x] **Delete flow**: confirmation dialog, DELETE on confirm, refresh after
  - [x] **Empty state**: "No cross-session memory entries yet"
  - [x] **Disabled state**: when `enabled=false`, show "Enable cross-session memory in project config"
  - [x] Green activity dot when SSE connected, entry count in header, "Saving..." indicator during mutations
- [x] Task 6: Wire into dashboard view (AC: #2)
  - [x] Add `CrossSessionMemoryViewer` to `SessionDetail.tsx` as a collapsible panel alongside existing `ProjectMemoryViewer`
  - [x] Pass project name from session data
  - [x] Label: "Cross-Session Knowledge" to distinguish from per-session "Project Memory"
- [x] Task 7: Write tests (AC: #10)
  - [x] Core tests: `packages/core/src/__tests__/memory-bridge-write.test.ts`
    - [x] `removeEntry` — removes entry matching contentHash, leaves others intact, rewrites atomically
    - [x] `removeEntry` — no-op when contentHash not found
    - [x] `removeEntry` — handles missing JSONL file gracefully
    - [x] `updateEntry` — updates content and lastSeenAt, recomputes contentHash
    - [x] `updateEntry` — no-op when contentHash not found
    - [x] `updateEntry` — handles missing JSONL file gracefully
    - [x] Both: test atomic rewrite (temp file + rename pattern)
  - [x] API route tests: `packages/web/src/app/api/cross-session-memory/[project]/route.test.ts`
    - [x] GET: returns entries when enabled, empty when disabled, 404 for unknown project, error handling
    - [x] DELETE: removes entry successfully, handles missing contentHash, validation
    - [x] PUT: updates entry successfully, validates content, handles errors
  - [x] Component tests: `packages/web/src/components/__tests__/CrossSessionMemoryViewer.test.tsx`
    - [x] Renders entries grouped by type
    - [x] Filter by type and source session
    - [x] Edit flow (enter edit mode → modify → save via PUT → cancel)
    - [x] Delete flow (confirm → delete via DELETE → cancel)
    - [x] Empty/loading/disabled states
    - [x] Entry count display (singular/plural)

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

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Methods Used:**
- `loadAccumulatedMemory(projectDir)` — from `memory-bridge.ts` — reads deduped cross-session entries
- `removeEntry(projectDir, contentHash)` — NEW — removes entry from JSONL
- `updateEntry(projectDir, contentHash, newContent)` — NEW — updates entry in JSONL
- `computeContentHash(type, content)` — from `memory-bridge.ts` — recomputes hash after edit
- `loadConfig(configPath)` — from `config.ts` — resolve project config for route handler

**Feature Flags:**
- `project.learning.crossSessionMemory` — config gate for entire feature (checked in API routes)

## Dev Notes

### Architecture Overview

This story surfaces the cross-session memory bridge (Story 61-1) in the web dashboard. The bridge stores accumulated knowledge entries from completed sessions in a project-level JSONL file (`.omc/cross-session-memory.jsonl`). This story adds read/write API and an interactive dashboard panel.

**Key difference from Story 60-9 (ProjectMemoryViewer):**
- 60-9: **per-session** memory from `.omc/project-memory.json` (one workspace)
- 61-2: **cross-session** accumulated memory from `.omc/cross-session-memory.jsonl` (all sessions)
- 61-2 entries have additional metadata: `sourceSessionIds[]`, `firstSeenAt`, `lastSeenAt`, `contentHash`

### Data Flow

```
Dashboard Component
    ↓ useCrossSessionMemory(projectName)
    ↓ GET /api/cross-session-memory/[project]
    ↓
Route handler → loadConfig → find project.path
    ↓
Config gate: project.learning.crossSessionMemory === true?
    ↓ (yes)
loadAccumulatedMemory(projectPath) → CrossSessionMemoryEntry[]
    ↓
Return { entries, project, enabled: true }

DELETE / PUT:
    ↓
removeEntry / updateEntry → loadAccumulatedMemory → filter/update → atomic rewrite → return updated
```

### Core Module Additions

The current `memory-bridge.ts` only supports append and load. This story adds write operations:

```typescript
export async function removeEntry(projectDir: string, contentHash: string): Promise<void> {
  // 1. Load all deduped entries via loadAccumulatedMemory()
  // 2. Filter out entry matching contentHash
  // 3. Write remaining entries to temp file (PID+UUID suffix)
  // 4. Atomic rename temp → cross-session-memory.jsonl
}

export async function updateEntry(
  projectDir: string,
  contentHash: string,
  newContent: string,
): Promise<void> {
  // 1. Load all deduped entries
  // 2. Find entry matching contentHash
  // 3. Update content, recompute contentHash, update lastSeenAt
  // 4. Write all entries to temp file
  // 5. Atomic rename temp → cross-session-memory.jsonl
}
```

Both functions use the same atomic write pattern as `writeProjectMemory()` in `project-memory.ts`.

### Critical Patterns to Follow

- **NO `.js` extensions in web imports**: Web package convention is bare imports like `@/lib/services` (NOT `@/lib/services.js`). This is a known issue — see the `.js` import fix plan.
- **Atomic writes**: temp file with PID+UUID suffix, then `rename()` (see `writeProjectMemory` in `project-memory.ts`)
- **Config gate**: Check `learning.crossSessionMemory` in every API handler (same as `completion-handlers.ts` line 472-483)
- **Non-fatal I/O**: All API errors caught and returned as graceful empty/error states
- **Component pattern**: Follow `ProjectMemoryViewer.tsx` structure exactly — inline edit/delete, type grouping, SSE, empty states
- **Hook pattern**: Follow `useProjectMemorySSE.ts` — REST GET + SSE EventSource, named events, exponential backoff
- **Route pattern**: Follow `/api/session/[id]/memory/route.ts` for GET/PUT structure
- **Test patterns**: Use `vi.hoisted()` for mock references, real timers for async, `Object.freeze()` for defaults

### Testing Patterns (from Epic 60/61 lessons)

- Use `vi.hoisted()` for mock references used in `vi.mock()` factories
- Use real timers for async operations (JSONL read/write)
- Use `Object.freeze()` for empty default objects
- Best-effort pattern: test error cases return empty/skip, never throw
- Test malformed input tolerance
- Web route tests: mock `loadConfig` to return test project configs
- Component tests: test filter state changes, edit flow, delete flow, empty/loading/disabled states

### Project Structure Notes

**New files:**
- `packages/core/src/__tests__/memory-bridge-write.test.ts` — core write operation tests
- `packages/web/src/app/api/cross-session-memory/[project]/route.ts` — GET/PUT/DELETE API routes
- `packages/web/src/app/api/cross-session-memory/[project]/stream/route.ts` — SSE stream
- `packages/web/src/hooks/useCrossSessionMemory.ts` — data fetching hook
- `packages/web/src/components/CrossSessionMemoryViewer.tsx` — main dashboard component
- `packages/web/src/app/api/cross-session-memory/[project]/route.test.ts` — route tests
- `packages/web/src/components/__tests__/CrossSessionMemoryViewer.test.tsx` — component tests

**Modified files:**
- `packages/core/src/memory-bridge.ts` — add `removeEntry()`, `updateEntry()`
- `packages/core/src/index.ts` — export new functions
- `packages/web/src/components/SessionDetail.tsx` — add CrossSessionMemoryViewer panel

### References

- [Source: packages/core/src/memory-bridge.ts] — existing bridge functions (loadAccumulatedMemory, appendEntries, computeContentHash)
- [Source: packages/core/src/project-memory.ts] — atomic write pattern (writeProjectMemory)
- [Source: packages/core/src/types.ts:3559-3587] — ProjectMemoryEntry, CrossSessionMemoryEntry types
- [Source: packages/core/src/types.ts:1167] — LearningConfig type (crossSessionMemory flag)
- [Source: packages/core/src/completion-handlers.ts:469-486] — config gate pattern for crossSessionMemory
- [Source: packages/web/src/app/api/session/[id]/memory/route.ts] — GET/PUT route pattern (Story 60-9)
- [Source: packages/web/src/app/api/session/[id]/memory/stream/route.ts] — SSE stream pattern
- [Source: packages/web/src/hooks/useProjectMemorySSE.ts] — data hook pattern
- [Source: packages/web/src/components/ProjectMemoryViewer.tsx] — component pattern (inline edit/delete, type grouping)
- [Source: packages/web/src/components/__tests__/ProjectMemoryViewer.test.tsx] — component test patterns
- [Source: _bmad-output/implementation-artifacts/61-1-cross-session-memory-bridge.md] — previous story learnings and architecture

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 7 tasks completed. All 10 ACs satisfied.
- Core: 8 write-operation tests pass (removeEntry: 4, updateEntry: 4)
- API: 15 route tests pass (GET: 4, DELETE: 5, PUT: 6)
- Component: 17 tests pass (render, filter, edit, delete, states, SSE indicator, filtered-empty)
- Core regression: 136 files, 2550 tests pass (1 pre-existing skip)
- No TODOs or FIXMEs introduced

### File List

**New files:**
- `packages/core/src/__tests__/memory-bridge-write.test.ts` — core write operation tests (8 tests)
- `packages/web/src/app/api/cross-session-memory/[project]/route.ts` — GET/PUT/DELETE API routes
- `packages/web/src/app/api/cross-session-memory/[project]/route.test.ts` — route tests (15 tests)
- `packages/web/src/app/api/cross-session-memory/[project]/stream/route.ts` — SSE stream endpoint
- `packages/web/src/hooks/useCrossSessionMemory.ts` — data fetching hook (REST + SSE)
- `packages/web/src/components/CrossSessionMemoryViewer.tsx` — dashboard panel component
- `packages/web/src/components/__tests__/CrossSessionMemoryViewer.test.tsx` — component tests (17 tests)

**Modified files:**
- `packages/core/src/memory-bridge.ts` — added `removeEntry()`, `updateEntry()`, `rewriteEntries()` helper, write lock manager, temp file cleanup
- `packages/core/src/index.ts` — exported new functions from memory-bridge
- `packages/web/src/components/SessionDetail.tsx` — added CrossSessionMemoryViewer panel

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 on 2026-04-18
**Outcome:** Approved (all issues fixed)

### Issues Found and Fixed (11 total)

**HIGH (2):**
- H1: Read-modify-write race condition in `rewriteEntries` — added per-project write lock manager (`writeLockManager.withLock`) to serialize `removeEntry`/`updateEntry` operations
- H2: Missing `encodeURIComponent` on `projectName` in URLs — fixed in both `useCrossSessionMemory.ts` and `CrossSessionMemoryViewer.tsx`

**MEDIUM (5):**
- M1: SSE stream returned empty payload for unknown projects instead of closing — added project existence check that sends `event: error` and closes stream
- M2: No user-facing feedback on save/delete failure — added `mutationError` state with red error banner in component
- M3: Route tests missing 403/500/PUT 404 paths — added 6 new tests: DELETE 400 (invalid JSON), DELETE 403 (disabled), PUT 400 (invalid JSON), PUT 403 (disabled), PUT 404 (unknown project), GET 500 (service error)
- M4: SSE connected even when REST fetch fails — split into two effects: SSE only starts after successful REST response (`sseReady` state)
- M5: `updateEntry` mutated entries in place — changed to `.map()` creating new objects instead of mutation

**LOW (4):**
- L1: Fragile index-based button targeting in component tests — replaced with `getByLabelText("Edit convention entry")` / `getByLabelText("Delete convention entry")` selectors
- L2: SSE retry with no maximum — added `MAX_SSE_RETRIES = 10` constant, stops reconnecting after 10 failures
- L3: Temp file not cleaned up on rename failure — added try/catch around `writeFile`+`rename` with `unlink` cleanup in catch
- L4: No test for "filtered empty" state — added test that filters to "directive" type and verifies "No entries match the current filters" message

### Post-Fix Test Results
- Core: 8/8 pass
- API routes: 15/15 pass (was 9)
- Component: 17/17 pass (was 16)
