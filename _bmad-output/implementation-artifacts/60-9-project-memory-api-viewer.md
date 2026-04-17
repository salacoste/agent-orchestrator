# Story 60.9: Project Memory API & Viewer

Status: done

## Story

As a developer using the dashboard,
I want to view and edit project memory (learned conventions, decisions, directives) for each session,
so that I can see what knowledge has been accumulated and manage it from the web interface.

## Acceptance Criteria

1. **AC1 — Core `readProjectMemory` function**: A new module at `packages/core/src/project-memory.ts` that:
   - Exports `readProjectMemory(worktreePath: string): Promise<ProjectMemory>`
   - Reads `.omc/project-memory.json` from the session workspace
   - Returns a typed `ProjectMemory` object (not `Record<string, unknown>`)
   - Returns `emptyProjectMemory()` (frozen default) on file-not-found or parse error
   - Follows the same best-effort pattern as `readNotepad` and `readSessionState`

2. **AC2 — Core `writeProjectMemory` function**: In the same module:
   - Exports `writeProjectMemory(worktreePath: string, memory: ProjectMemory): Promise<void>`
   - Uses atomic write (temp file + rename) same as `projectMemoryPreCompact` hook
   - Validates entries before writing (each entry has required `type` and `content` fields)
   - Creates `.omc/` directory if it doesn't exist

3. **AC3 — `ProjectMemory` and `ProjectMemoryEntry` types**: New interfaces in `packages/core/src/types.ts`:
   - `ProjectMemoryEntry`: `{ id: string; type: "convention" | "decision" | "directive" | "learning"; content: string; source?: string; timestamp?: string }`
   - `ProjectMemory`: `{ entries: ProjectMemoryEntry[] }`
   - Exported from `@composio/ao-core` barrel

4. **AC4 — REST GET endpoint**: `packages/web/src/app/api/session/[id]/memory/route.ts`:
   - `GET /api/session/[id]/memory` returns `{ sessionId, memory: ProjectMemory, exists }`
   - Follows exact pattern from notepad route (workspacePath guard, best-effort read, NO_CACHE_HEADERS)
   - Imports `readProjectMemory` from `@composio/ao-core/project-memory` sub-path export

5. **AC5 — REST PUT endpoint**: In the same route file:
   - `PUT /api/session/[id]/memory` accepts `{ entries: ProjectMemoryEntry[] }` body
   - Validates each entry has `type` and `content` (returns 400 if invalid)
   - Calls `writeProjectMemory` to persist
   - Returns updated `{ sessionId, memory, exists }`

6. **AC6 — SSE stream endpoint**: `packages/web/src/app/api/session/[id]/memory/stream/route.ts`:
   - Sends `event: memory-update` named events (same pattern as state stream)
   - Polls every 5 seconds with JSON.stringify comparison
   - Heartbeat every 15 seconds
   - Cleanup on cancel

7. **AC7 — Custom SSE hook**: `packages/web/src/hooks/useProjectMemorySSE.ts`:
   - Follows `useSessionStateSSE` pattern with `addEventListener("memory-update", ...)`
   - REST fetch to `/api/session/[id]/memory` for initial data
   - SSE at `/api/session/[id]/memory/stream`
   - Returns `{ memory: ProjectMemory | null, exists: boolean, connected: boolean }`
   - Exponential backoff (1s, 2s, 4s, 8s cap)
   - Proper cleanup on unmount

8. **AC8 — ProjectMemoryViewer component**: `packages/web/src/components/ProjectMemoryViewer.tsx`:
   - Uses established card wrapper pattern with ActivityDot
   - Has `data-testid="project-memory-panel"` and `role="region"` with `aria-labelledby`
   - Displays entries grouped by type (Conventions, Decisions, Directives, Learnings)
   - Each entry shows content, source (if available), and timestamp (if available)
   - Empty state: "No project memory entries yet" when `entries` is empty
   - Loading state: "Loading..." when exists but memory is null
   - No-entry state: "No project memory available" when `exists: false`
   - Edit mode: click entry to edit content, save button triggers PUT
   - Delete button per entry with confirmation

9. **AC9 — Integration in SessionDetail**: Panel added to `packages/web/src/components/SessionDetail.tsx`:
   - Imported as `ProjectMemoryViewer`
   - Rendered with `session.workspacePath` guard after existing panels
   - Passes `sessionId={session.id}` as prop

10. **AC10 — Unit tests for core module**: `packages/core/src/__tests__/project-memory.test.ts`:
    - Tests `readProjectMemory` with valid file, missing file, malformed JSON
    - Tests `writeProjectMemory` creates file and validates entries
    - Tests `emptyProjectMemory` returns frozen object

11. **AC11 — Unit tests for REST routes**: `packages/web/src/app/api/session/[id]/memory/route.test.ts`:
    - GET returns memory for session with workspace
    - GET returns empty for session without workspace
    - PUT validates and persists entries
    - PUT returns 400 for invalid entries

12. **AC12 — Unit tests for SSE hook**: `packages/web/src/hooks/__tests__/useProjectMemorySSE.test.ts`:
    - Same coverage as `useSessionStateSSE.test.ts` adapted for memory data

13. **AC13 — Unit tests for panel component**: `packages/web/src/components/__tests__/ProjectMemoryViewer.test.tsx`:
    - Renders entries grouped by type
    - Handles empty state (exists: false)
    - Handles no entries (empty array)
    - Edit flow and delete flow

14. **AC14 — No new dependencies**: Uses only existing dependencies.

## Tasks / Subtasks

- [x] Task 1: Core module and types (AC: #1, #2, #3)
  - [x] 1.1 Add `ProjectMemoryEntry` and `ProjectMemory` interfaces to `packages/core/src/types.ts`
  - [x] 1.2 Create `packages/core/src/project-memory.ts` with `readProjectMemory`, `writeProjectMemory`, `emptyProjectMemory`
  - [x] 1.3 Add sub-path export in `packages/core/package.json` for `@composio/ao-core/project-memory`
  - [x] 1.4 Export types from `packages/core/src/index.ts` barrel
  - [x] 1.5 Create `packages/core/src/__tests__/project-memory.test.ts`

- [x] Task 2: REST API routes (AC: #4, #5)
  - [x] 2.1 Create `packages/web/src/app/api/session/[id]/memory/route.ts` with GET handler
  - [x] 2.2 Add PUT handler to same file with validation
  - [x] 2.3 Create `packages/web/src/app/api/session/[id]/memory/route.test.ts`

- [x] Task 3: SSE stream endpoint (AC: #6)
  - [x] 3.1 Create `packages/web/src/app/api/session/[id]/memory/stream/route.ts`
  - [x] 3.2 Follow state stream pattern with named events (`memory-update`)
  - [x] 3.3 SSE stream tested via hook tests (same pattern as state stream)

- [x] Task 4: SSE hook (AC: #7)
  - [x] 4.1 Create `packages/web/src/hooks/useProjectMemorySSE.ts`
  - [x] 4.2 Use `addEventListener("memory-update", ...)` for named events
  - [x] 4.3 Create `packages/web/src/hooks/__tests__/useProjectMemorySSE.test.ts`

- [x] Task 5: Dashboard panel (AC: #8)
  - [x] 5.1 Create `packages/web/src/components/ProjectMemoryViewer.tsx`
  - [x] 5.2 Implement entry display grouped by type with card wrapper
  - [x] 5.3 Implement edit mode (inline content editing + PUT on save)
  - [x] 5.4 Implement delete with confirmation
  - [x] 5.5 Create `packages/web/src/components/__tests__/ProjectMemoryViewer.test.tsx`

- [x] Task 6: Integration (AC: #9)
  - [x] 6.1 Import `ProjectMemoryViewer` in `SessionDetail.tsx`
  - [x] 6.2 Add panel after existing panels with `session.workspacePath` guard

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

None anticipated. All features are within scope.

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
- [ ] `.omc/project-memory.json` file I/O — read/write via `node:fs/promises`
- [ ] `sessionManager.get(id)` — from existing `getServices()` pattern
- [ ] `session.workspacePath` — workspace path guard (existing pattern)
- [ ] `ProjectMemory`, `ProjectMemoryEntry` — new types defined in this story

**Feature Flags:**
- None. All required infrastructure exists from prior stories.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing React, testing-library, vitest, and node:fs.

## Dev Notes

### Architecture Context

This story is the ninth and final in Epic 60 (Dashboard Intelligence). It creates a full-stack feature: core reader/writer, REST API (GET + PUT), SSE stream, React hook, and dashboard panel for project memory.

Project memory is stored at `.omc/project-memory.json` in the session workspace. The `projectMemoryPreCompact` hook (in `hooks.ts`) already writes to this file, but there is no standalone reader or writer — this story creates both.

### Data Source — `.omc/project-memory.json`

The file is currently written by `projectMemoryPreCompact` (hooks.ts:189-236). It reads the existing file, merges learnings from session metadata, and writes back atomically. The current format is `Record<string, unknown>` — untyped JSON.

This story defines a typed structure for the viewer:

```typescript
interface ProjectMemoryEntry {
  id: string;
  type: "convention" | "decision" | "directive" | "learning";
  content: string;
  source?: string;    // session ID that contributed it
  timestamp?: string; // ISO timestamp when added
}

interface ProjectMemory {
  entries: ProjectMemoryEntry[];
}
```

The `readProjectMemory` function must handle both:
- **New format**: `{ entries: [...] }` — typed entries
- **Legacy format**: `{ ... }` — any JSON object — wrap in entries array with `type: "learning"`

### Core Module Pattern

Follow `session-state.ts` pattern:

```typescript
// packages/core/src/project-memory.ts
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectMemory, ProjectMemoryEntry } from "./types.js";

export async function readProjectMemory(worktreePath: string): Promise<ProjectMemory> {
  const memoryPath = join(worktreePath, ".omc", "project-memory.json");
  try {
    const raw = await readFile(memoryPath, "utf-8");
    const parsed = JSON.parse(raw);
    // Handle legacy format: if no entries array, wrap in entries
    if (Array.isArray(parsed?.entries)) return parsed;
    return { entries: [] }; // Or convert legacy keys to entries
  } catch {
    return emptyProjectMemory();
  }
}

export function emptyProjectMemory(): ProjectMemory {
  return Object.freeze({ entries: [] });
}

export async function writeProjectMemory(
  worktreePath: string,
  memory: ProjectMemory,
): Promise<void> {
  // Validate entries
  for (const entry of memory.entries) {
    if (!entry.type || !entry.content) throw new Error("Invalid entry");
  }
  // Atomic write: temp file + rename
  const memoryPath = join(worktreePath, ".omc", "project-memory.json");
  await mkdir(join(worktreePath, ".omc"), { recursive: true });
  const tmpPath = `${memoryPath}.${process.pid}.${crypto.randomUUID()}`;
  await writeFile(tmpPath, JSON.stringify(memory, null, 2));
  await rename(tmpPath, memoryPath);
}
```

**Sub-path export**: Add to `packages/core/package.json` exports:

```json
"./project-memory": {
  "import": "./dist/project-memory.js"
}
```

### REST API Pattern (GET + PUT)

**GET** — follows notepad route exactly:

```typescript
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionManager } = await getServices();
  const session = await sessionManager.get(id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!session.workspacePath) {
    return NextResponse.json({ sessionId: id, memory: emptyProjectMemory(), exists: false }, { headers: NO_CACHE_HEADERS });
  }
  try {
    const memory = await readProjectMemory(session.workspacePath);
    return NextResponse.json({ sessionId: id, memory, exists: true }, { headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json({ sessionId: id, memory: emptyProjectMemory(), exists: false, readError: true }, { headers: NO_CACHE_HEADERS });
  }
}
```

**PUT** — new for this story (notepad is read-only):

```typescript
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body?.entries || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Invalid: entries array required" }, { status: 400 });
  }
  // Validate each entry
  for (const entry of body.entries) {
    if (!entry.type || !entry.content) {
      return NextResponse.json({ error: "Invalid: each entry needs type and content" }, { status: 400 });
    }
  }
  const { sessionManager } = await getServices();
  const session = await sessionManager.get(id);
  if (!session || !session.workspacePath) {
    return NextResponse.json({ error: "Session not found or no workspace" }, { status: 404 });
  }
  await writeProjectMemory(session.workspacePath, { entries: body.entries });
  const memory = await readProjectMemory(session.workspacePath);
  return NextResponse.json({ sessionId: id, memory, exists: true }, { headers: NO_CACHE_HEADERS });
}
```

### SSE Stream Pattern

Follow state stream pattern with **named events** (`event: memory-update`):

```
event: memory-update
data: {"sessionId":"...","memory":{"entries":[...]},"exists":true}
```

CRITICAL: Client MUST use `addEventListener("memory-update", ...)` NOT `onmessage`.

### SSE Hook Pattern

Follow `useSessionStateSSE` but adapted for memory data:

```typescript
export function useProjectMemorySSE(sessionId: string): {
  memory: ProjectMemory | null;
  exists: boolean;
  connected: boolean;
}
```

Uses `addEventListener("memory-update", ...)` for named events.

### Panel Component Pattern

The panel should have two modes:

1. **View mode** (default): Entries grouped by type in collapsible sections
2. **Edit mode**: Click an entry to edit its content inline

Component structure:

```tsx
<div className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
     data-testid="project-memory-panel" role="region" aria-labelledby="project-memory-heading">
  <div className="mb-3 flex items-center gap-2">
    <ActivityDot activity={connected ? "active" : "idle"} dotOnly size={6} />
    <h3 id="project-memory-heading" className="text-[11px] font-semibold ...">
      Project Memory
    </h3>
    <span className="text-[10px] text-[var(--color-text-tertiary)]">
      {entries.length} entries
    </span>
  </div>
  {/* Grouped entries by type */}
</div>
```

### SessionDetail Integration Point

In `SessionDetail.tsx`, add after the existing panels (after SessionStatePanel):

```tsx
{session.workspacePath && <ProjectMemoryViewer sessionId={session.id} />}
```

### Import Conventions (MUST follow)

- **Core types**: `ProjectMemory`, `ProjectMemoryEntry` from `@composio/ao-core`
- **Core reader/writer**: `readProjectMemory`, `writeProjectMemory` from `@composio/ao-core/project-memory` (sub-path, server-side only)
- **SSE hook**: from `@/hooks/useProjectMemorySSE`
- **ActivityDot**: from `./ActivityDot`
- **CSS**: Use CSS variables (`var(--color-*)`)

### Anti-Patterns to Avoid

- **DO NOT** use `es.onmessage` — memory stream uses named events (`event: memory-update`). Use `addEventListener("memory-update", ...)`.
- **DO NOT** import `@composio/ao-core/project-memory` from client code — it uses `node:fs`. Use the REST API instead.
- **DO NOT** forget `"use client"` on the panel component — it uses React hooks.
- **DO NOT** forget `data-testid` and `role="region"` with `aria-labelledby` — accessibility requirement.
- **DO NOT** use `!== null` for optional fields — use `typeof x === "string"` or `typeof x === "number"` checks.
- **DO NOT** use truthiness checks for numbers that could be 0 — use `typeof` checks.
- **DO NOT** write to `.omc/project-memory.json` without atomic write (temp + rename).

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-9 definition, FR-D4-3]
- [Source: `packages/core/src/hooks.ts` — `projectMemoryPreCompact` hook (lines 182-236)]
- [Source: `packages/core/src/session-state.ts` — Core reader pattern with `safeParseJSON`]
- [Source: `packages/core/src/notepad.ts` — `readNotepad` file-reading pattern]
- [Source: `packages/web/src/app/api/session/[id]/notepad/route.ts` — REST GET pattern]
- [Source: `packages/web/src/app/api/session/[id]/state/route.ts` — REST GET pattern with readError]
- [Source: `packages/web/src/app/api/session/[id]/state/stream/route.ts` — SSE named events pattern]
- [Source: `packages/web/src/hooks/useSessionStateSSE.ts` — SSE hook with named events]
- [Source: `packages/web/src/components/NotepadViewer.tsx` — Panel card wrapper pattern]
- [Source: `packages/web/src/components/SessionStatePanel.tsx` — Panel with typed state display]
- [Source: `packages/web/src/components/SessionDetail.tsx` — Panel integration point (~line 463)]
- [Source: `packages/core/src/provider-verify.ts` — Verifies `.omc/project-memory.json` exists]

### Previous Story Intelligence (60-8)

1. **Card wrapper pattern is identical** across all 4 panels: `detail-card mb-6 rounded-[8px] border...` with ActivityDot.
2. **SSE hooks follow identical patterns** — copy `useSessionStateSSE` and adapt for memory + named events.
3. **Best-effort pattern**: API returns 200 with empty data, not 500 errors. Use `readError: true` for actual failures.
4. **ESLint requires `!==`** for equality — use `typeof` checks for optional fields instead of truthiness.
5. **`Object.freeze()`** for empty default objects — prevents accidental mutation.
6. **Test pattern**: Panel tests mock the hook. Hook tests use MockEventSource with addEventListener support.
7. **Sub-path exports** require both `index.ts` barrel export AND `package.json` exports map entry.

### Previous Story Intelligence (60-7)

1. **API response shape**: `{ sessionId, state/data, exists, readError? }` — follow this convention.
2. **SSE uses named events**: `event: memory-update` — MUST use `addEventListener`.
3. **`NO_CACHE_HEADERS`** constant used across all REST endpoints.
4. **`params` is `Promise`** — must `await params` before destructuring.
5. **Sub-path import for server-only code**: `@composio/ao-core/project-memory` for REST routes (uses `node:fs`).

### Limitations (Deferred Items)

None. All features are implementable with existing infrastructure.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 6 tasks implemented, all subtasks complete
- 48 new tests (10 core + 11 route + 13 hook + 14 panel), all passing
- Full core test suite: 2515 tests pass, zero regressions
- Full web test suite: 2728 tests pass, zero regressions
- SSE hook uses `addEventListener("memory-update", ...)` for named events (NOT `onmessage`)
- Panel follows exact card wrapper pattern from SessionStatePanel
- Edit mode: inline textarea with Save/Cancel, persists via PUT
- Delete: confirmation dialog with confirm/cancel, persists via PUT
- Panel groups entries by type (Conventions, Decisions, Directives, Learnings)
- Handles legacy `.omc/project-memory.json` format (wraps string values as learning entries)
- Atomic writes with temp file + rename pattern

### File List

- `packages/core/src/types.ts` — MODIFIED: Added ProjectMemoryEntryType, ProjectMemoryEntry, ProjectMemory interfaces
- `packages/core/src/project-memory.ts` — NEW: Core module with readProjectMemory, writeProjectMemory, emptyProjectMemory
- `packages/core/src/index.ts` — MODIFIED: Added exports for project-memory module and types
- `packages/core/package.json` — MODIFIED: Added ./project-memory sub-path export
- `packages/core/src/__tests__/project-memory.test.ts` — NEW: 10 core module tests
- `packages/web/src/app/api/session/[id]/memory/route.ts` — NEW: REST GET + PUT handlers
- `packages/web/src/app/api/session/[id]/memory/route.test.ts` — NEW: 11 route tests (5 GET + 6 PUT)
- `packages/web/src/app/api/session/[id]/memory/stream/route.ts` — NEW: SSE stream with memory-update named events
- `packages/web/src/hooks/useProjectMemorySSE.ts` — NEW: SSE hook with named event support
- `packages/web/src/hooks/__tests__/useProjectMemorySSE.test.ts` — NEW: 13 hook tests
- `packages/web/src/components/ProjectMemoryViewer.tsx` — NEW: Panel component with edit/delete
- `packages/web/src/components/__tests__/ProjectMemoryViewer.test.tsx` — NEW: 14 panel tests
- `packages/web/src/components/SessionDetail.tsx` — MODIFIED: Added ProjectMemoryViewer import and rendering
- `_bmad-output/implementation-artifacts/60-9-project-memory-api-viewer.md` — MODIFIED: Status → review, tasks marked complete
