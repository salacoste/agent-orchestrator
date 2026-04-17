# Story 60.1: Notepad API Route

Status: done

## Story

As a developer using the dashboard,
I want an API endpoint that reads the notepad contents from a session's worktree,
so that I can view the agent's priority context, working memory, and manual notes in the dashboard.

## Acceptance Criteria

1. **AC1 — GET `/api/session/[id]/notepad` route**: A new Next.js API route at `packages/web/src/app/api/session/[id]/notepad/route.ts` exports a `GET` handler. The route receives a session ID via the URL path parameter and returns the notepad contents.

2. **AC2 — Structured response**: The response returns JSON with the shape:
   ```typescript
   {
     sessionId: string;
     notepad: {
       priority: string;
       working: string;
       manual: string;
     };
     exists: boolean;
   }
   ```
   When the notepad file does not exist, returns `{ sessionId, notepad: { priority: "", working: "", manual: "" }, exists: false }` with HTTP 200 (not 404 — the session exists, the notepad just hasn't been created yet).

3. **AC3 — Session lookup**: The route uses `getServices()` to get the `sessionManager`, calls `sessionManager.get(id)` to resolve the session. Returns HTTP 404 with `{ error: "Session not found" }` if the session does not exist.

4. **AC4 — Worktree path resolution**: After resolving the session, the route extracts the worktree path from `session.worktreePath`. If the session has no worktree path, returns `{ sessionId, notepad: { priority: "", working: "", manual: "" }, exists: false }`.

5. **AC5 — Notepad read via core function**: The route imports `readNotepad` from `@composio/ao-core` and calls `readNotepad(worktreePath)` to parse the `.omc/notepad.md` file. The `exists` field is `true` only when the notepad file exists and has at least one non-empty section.

6. **AC6 — SSE endpoint for notepad change notifications**: A new SSE endpoint at `GET /api/session/[id]/notepad/stream` that:
   - Sends an initial notepad snapshot on connection
   - Polls for notepad changes every 5 seconds (compares content hash)
   - Sends `data: {"type": "notepad-update", "sessionId": "...", "notepad": {...}}` when content changes
   - Sends `: heartbeat\n\n` every 15 seconds
   - Sets `export const dynamic = "force-dynamic"` and standard SSE headers

7. **AC7 — Error handling**: All errors are caught and returned as `{ error: string }` with appropriate HTTP status codes. Notepad read failures (permission errors, corrupted files) return `{ sessionId, notepad: { priority: "", working: "", manual: "" }, exists: false }` rather than crashing.

8. **AC8 — Unit tests**: Comprehensive vitest tests covering:
   - Returns notepad content for valid session with existing notepad
   - Returns `{ exists: false }` for valid session without notepad
   - Returns 404 for non-existent session
   - Returns `{ exists: false }` for session without worktree path
   - Handles notepad read failure gracefully (permission error)
   - SSE stream sends initial snapshot and heartbeat
   - SSE stream detects notepad content changes
   - SSE stream cleans up intervals on cancel

## Tasks / Subtasks

- [x] Task 1: Create GET notepad API route (AC: #1, #2, #3, #4, #5, #7)
  - [x] 1.1 Create `packages/web/src/app/api/session/[id]/notepad/route.ts`
  - [x] 1.2 Import `getServices` from `@/lib/services` and `readNotepad` from `@composio/ao-core`
  - [x] 1.3 Implement GET handler: resolve session, extract worktreePath, read notepad, return structured response
  - [x] 1.4 Handle edge cases: session not found (404), no worktree path (exists: false), read failure (exists: false)
  - [x] 1.5 Ensure `params` is awaited (Next.js 15 Promise convention)

- [x] Task 2: Create SSE notepad stream endpoint (AC: #6)
  - [x] 2.1 Create `packages/web/src/app/api/session/[id]/notepad/stream/route.ts`
  - [x] 2.2 Implement ReadableStream SSE pattern with initial snapshot and 5s poll interval
  - [x] 2.3 Use content hash comparison to detect changes (avoid sending unchanged data)
  - [x] 2.4 Set heartbeat at 15s intervals, cleanup on cancel
  - [x] 2.5 Set `export const dynamic = "force-dynamic"` and SSE response headers

- [x] Task 3: Unit tests (AC: #8)
  - [x] 3.1 Create `packages/web/src/app/api/session/[id]/notepad/route.test.ts`
  - [x] 3.2 Test valid session with existing notepad
  - [x] 3.3 Test valid session without notepad
  - [x] 3.4 Test non-existent session (404)
  - [x] 3.5 Test session without worktree path
  - [x] 3.6 Test notepad read failure graceful handling
  - [x] 3.7 Create `packages/web/src/app/api/session/[id]/notepad/stream/route.test.ts`
  - [x] 3.8 Test SSE initial snapshot and heartbeat
  - [x] 3.9 Test SSE change detection
  - [x] 3.10 Test SSE cleanup on cancel

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

Dashboard panel component (notepad viewer UI) is deferred to Story 60-2.
Notepad write/PUT endpoint is deferred — the notepad is managed by the agent session, not the dashboard.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `SessionManager.get(id)` — look up session by ID
- [x] `readNotepad(worktreePath)` — read notepad contents from worktree
- [x] `getServices()` — obtain service instances

**Feature Flags:**
- Notepad API only works for sessions that have a worktree with `.omc/notepad.md`. Sessions without OMC provider will return `exists: false`.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing `@composio/ao-core` notepad functions and standard Next.js API patterns.

## Dev Notes

### Architecture Context

This story is the first in Epic 60 (Dashboard Intelligence) and builds on the notepad infrastructure from Epic 59 (Story 59-1). The notepad is a markdown file at `.omc/notepad.md` in the session's worktree, structured with three sections: Priority, Working Memory, and Manual.

The API route provides the data access layer that Story 60-2 (Notepad Dashboard Panel) will consume. It follows the same patterns as existing session API routes.

### How API Routes Work in This Project

Every API route follows this pattern:
1. Import `getServices` from `@/lib/services` (lazy singleton that loads config, plugins, sessionManager)
2. `await params` to get URL parameters (Next.js 15 Promise convention)
3. Use `sessionManager.get(id)` to resolve the session
4. Return `NextResponse.json()` for success or error
5. Wrap everything in try/catch, return `{ error: string }` for failures

### SSE Pattern

The project has an established SSE pattern at `/api/events/route.ts`:
- Uses `ReadableStream` with `TextEncoder`
- Sends `data: ${JSON.stringify(payload)}\n\n` for events
- Sends `: heartbeat\n\n` for keep-alive (every 15s)
- Sets `export const dynamic = "force-dynamic"` to disable caching
- Returns `Response` with `Content-Type: text/event-stream` headers
- Cleans up intervals in `cancel()` callback

For the notepad SSE, we add a polling approach since there's no event bus for notepad file changes. Poll every 5s, compare content hash, emit only on change.

### Notepad Functions Available

From `@composio/ao-core`:
- `readNotepad(worktreePath): Promise<NotepadContent>` — returns `{ priority: string, working: string, manual: string }`. Returns all-empty strings if file doesn't exist.
- No import extension needed — `@composio/ao-core` is a package import, not a local file import.

### Session Worktree Path

The `Session` object has a `worktreePath` field that points to the git worktree directory. The notepad lives at `{worktreePath}/.omc/notepad.md`. The `readNotepad()` function handles the `.omc/` prefix internally — just pass the worktree path.

### Import Conventions (MUST follow)

- **Package imports**: `import { readNotepad } from "@composio/ao-core"` — NO `.js` extension for package imports
- **Local web imports**: `import { getServices } from "@/lib/services"` — NO `.js` extension for `@/` imports (Next.js webpack convention)
- **Type imports**: `import type { Session } from "@composio/ao-core"` for type-only imports

### Testing Standards

- **Framework**: vitest
- **Location**: `route.test.ts` co-located with route file
- **Mocking**: Mock `getServices` and `readNotepad` since they depend on config/filesystem
- **Pattern**: Use the standard API route test pattern from existing route tests in this project
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in packages/web

### Anti-Patterns to Avoid

- **DO NOT** import `readNotepad` with `.js` extension — it's a package import
- **DO NOT** forget to `await params` — Next.js 15 requires it
- **DO NOT** return 404 when notepad is missing — return `{ exists: false }` with 200
- **DO NOT** create a PUT/write endpoint — notepad writes are agent-only (deferred)
- **DO NOT** add file watching for SSE — use polling (simpler, no chokidar dependency needed)
- **DO NOT** add external dependencies — this is pure Next.js + existing core functions

### Limitations (Deferred Items)

1. **Notepad write/PUT endpoint**
   - Status: Deferred — not in scope for this story
   - Requires: Dashboard panel may need edit capability
   - Current: Notepad is agent-managed, dashboard is read-only

2. **Real-time file watching for notepad changes**
   - Status: Deferred — polling is sufficient for dashboard use
   - Requires: chokidar or fs.watch integration
   - Current: SSE endpoint polls every 5 seconds

3. **Notepad change event bus integration**
   - Status: Deferred — would require hooking into writeNotepadSection
   - Requires: Event bus integration in notepad module
   - Current: Content hash comparison in SSE poll

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-1 definition, FR-D1-1, FR-D1-3]
- [Source: `packages/core/src/notepad.ts` — readNotepad, createNotepad, writeNotepadSection]
- [Source: `packages/core/src/types.ts` — NotepadSection, NotepadContent, SprintContext types]
- [Source: `packages/web/src/lib/services.ts` — getServices() singleton]
- [Source: `packages/web/src/app/api/events/route.ts` — SSE endpoint pattern]
- [Source: `packages/web/src/app/api/sessions/[id]/route.ts` — GET route pattern]
- [Source: `packages/web/src/hooks/useSSEConnection.ts` — client-side SSE hook]
- [Source: `_bmad-output/implementation-artifacts/59-1-notepad-creation-story-context.md` — Previous story that created notepad module]
- [Source: `_bmad-output/implementation-artifacts/epic-59-retrospective.md` — Action items: extract spawn orchestration, complete OMC provider integration test]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, Next.js dev server patterns]

### Previous Story Intelligence (59-7)

**Key learnings from 59-7 that impact this story:**

1. **Best-effort enrichment pattern**: All enrichment wraps in try/catch and falls back gracefully. The notepad API should follow this same pattern — if readNotepad fails, return `exists: false` rather than erroring.

2. **`ao:executionMode` metadata pattern**: Sessions store resolved config in metadata fields (`ao:modelTier`, `ao:model`, `ao:executionMode`). The session object is the source of truth for runtime state.

3. **`readNotepad()` returns empty strings for missing files**: The function already handles the "file doesn't exist" case gracefully. The API route doesn't need to check file existence separately.

4. **Full test suite: 2484 tests pass**: The codebase has extensive test coverage. New tests should follow the established mocking patterns.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vi.mock factory hoisting requires `vi.hoisted()` for mock references used in `vi.mock()` factories
- SSE tests require real timers — fake timers block ReadableStream async operations

### Completion Notes List

1. GET route created at `packages/web/src/app/api/session/[id]/notepad/route.ts` — returns `{ sessionId, notepad, exists }`
2. SSE stream created at `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` — polls every 5s, heartbeat every 15s, content hash comparison via MD5
3. Used `session.workspacePath` instead of story's `session.worktreePath` — the actual Session interface field is `workspacePath`
4. Best-effort error handling: notepad read failures return `exists: false` with HTTP 200
5. All 12 tests passing: 7 GET route tests + 5 SSE stream tests
6. Full suite: 204 test files, 2539 tests passed, 0 regressions

### Code Review Fixes (Post-Implementation)

7. **H1 — SSE race condition**: Poll `setInterval` started immediately in `start()` while initial snapshot ran as async IIFE, creating a window where both could fire simultaneously. Fixed by nesting poll start inside the async IIFE after initial snapshot completes.
8. **H2 — SSE missing `exists` field**: SSE payloads now include the `exists` boolean matching GET route behavior.
9. **L1 — Missing `export const dynamic`**: Added `export const dynamic = "force-dynamic"` to GET route.
10. **M3 — Placeholder assertion**: Replaced `expect(true).toBe(true)` in SSE cleanup test with real assertion verifying no data arrives after stream cancellation.
11. **L2 — Heartbeat ordering**: Heartbeat test now verifies event ordering (snapshot first, heartbeat second) with chunk-level assertions.
12. **EMPTY_NOTEPAD frozen**: Both routes now use `Object.freeze(EMPTY_NOTEPAD)` to prevent accidental mutation.

### File List

| File | Change |
|------|--------|
| `packages/web/src/app/api/session/[id]/notepad/route.ts` | NEW — GET handler returning structured notepad data |
| `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` | NEW — SSE stream with polling and heartbeat |
| `packages/web/src/app/api/session/[id]/notepad/route.test.ts` | NEW — 7 unit tests for GET route |
| `packages/web/src/app/api/session/[id]/notepad/stream/route.test.ts` | NEW — 5 unit tests for SSE stream |
| `_bmad-output/implementation-artifacts/60-1-notepad-api-route.md` | MODIFY — Tasks marked complete, status → review |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 60-1 status: ready-for-dev → in-progress → review |
