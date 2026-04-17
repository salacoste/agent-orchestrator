# Story 60.3: Agent Timeline API Route

Status: done

## Story

As a developer using the dashboard,
I want an API endpoint that aggregates OMC trace data into a session timeline,
so that I can visualize which sub-agent ran when, what tools were used, and what files were touched.

## Acceptance Criteria

1. **AC1 — `ReplayEvent` and `TimelineEntry` types**: New types defined in `types.ts` and exported from `index.ts`:
   ```typescript
   export type ReplayEventType =
     | "agent_start" | "agent_stop"
     | "tool_start" | "tool_end"
     | "file_touch"
     | "intervention" | "error"
     | "hook_fire" | "hook_result"
     | "keyword_detected"
     | "skill_activated" | "skill_invoked"
     | "mode_change";

   export interface ReplayEvent {
     t: number;                // seconds since session start
     agent: string;
     agent_type: string;
     event: ReplayEventType;
     tool?: string;
     file?: string;
     duration_ms?: number;
     success?: boolean;
     model?: string;
   }

   export interface TimelineEntry {
     agent: string;
     agentType: string;
     action: string;           // human-readable description
     event: ReplayEventType;
     timestamp: number;        // seconds since session start
     duration?: number;        // milliseconds, if applicable
     tool?: string;
     file?: string;
     success?: boolean;
     model?: string;
   }
   ```

2. **AC2 — `readTimeline` core function**: A new exported function `readTimeline(workspacePath: string, sessionId: string): Promise<TimelineEntry[]>` in a new module `packages/core/src/timeline.ts` that:
   - Reads `.omc/state/agent-replay-{sessionId}.jsonl` line by line
   - Parses each line as a `ReplayEvent` (skips malformed lines)
   - Maps each `ReplayEvent` to a `TimelineEntry` with a human-readable `action` string
   - Returns entries sorted by `t` (ascending)
   - Returns empty array if the file doesn't exist (not an error)
   - Wraps in try/catch for permission/IO errors — returns empty array

3. **AC3 — Action description mapping**: The `action` field on `TimelineEntry` is derived from `ReplayEventType`:
   - `agent_start` → `"Agent {agent} started"`
   - `agent_stop` → `"Agent {agent} stopped"`
   - `tool_start` → `"Called {tool}"`
   - `tool_end` → `"Finished {tool}"`
   - `file_touch` → `"Modified {file}"`
   - `intervention` → `"Human intervention"`
   - `error` → `"Error occurred"`
   - `hook_fire` → `"Hook {tool} fired"`
   - `hook_result` → `"Hook {tool} completed"`
   - `keyword_detected` → `"Keyword detected"`
   - `skill_activated` → `"Skill {tool} activated"`
   - `skill_invoked` → `"Skill {tool} invoked"`
   - `mode_change` → `"Mode changed"`

4. **AC4 — GET `/api/session/[id]/timeline` route**: A new Next.js API route at `packages/web/src/app/api/session/[id]/timeline/route.ts` exports a `GET` handler. The route receives a session ID via URL path parameter and returns timeline entries.

5. **AC5 — Structured response**: The response returns JSON with the shape:
   ```typescript
   {
     sessionId: string;
     timeline: TimelineEntry[];
     totalEntries: number;
   }
   ```
   When no timeline data exists, returns `{ sessionId, timeline: [], totalEntries: 0 }` with HTTP 200.

6. **AC6 — Session lookup**: The route uses `getServices()` to get the `sessionManager`, calls `sessionManager.get(id)` to resolve the session. Returns HTTP 404 with `{ error: "Session not found" }` if the session does not exist.

7. **AC7 — Workspace path resolution**: After resolving the session, the route extracts the workspace path from `session.workspacePath`. If the session has no workspace path, returns `{ sessionId, timeline: [], totalEntries: 0 }` with HTTP 200.

8. **AC8 — Query parameter filtering**: The route supports optional query parameters for filtering timeline entries:
   - `?agent=<string>` — filter by agent name (case-insensitive substring match)
   - `?tool=<string>` — filter by tool name (case-insensitive substring match)
   - `?from=<number>` — filter entries with `timestamp >= from` (seconds)
   - `?to=<number>` — filter entries with `timestamp <= to` (seconds)
   - Multiple filters are AND-combined
   - Unrecognized query params are silently ignored

9. **AC9 — SSE endpoint for timeline change notifications**: A new SSE endpoint at `GET /api/session/[id]/timeline/stream` that:
   - Sends an initial timeline snapshot on connection
   - Polls for timeline changes every 10 seconds (compares entry count)
   - Sends `data: {"type": "timeline-update", "sessionId": "...", "timeline": [...], "totalEntries": N}` when new entries are detected
   - Sends `: heartbeat\n\n` every 15 seconds
   - Sets `export const dynamic = "force-dynamic"` and standard SSE headers

10. **AC10 — Error handling**: All errors are caught and returned as `{ error: string }` with appropriate HTTP status codes. Timeline read failures (permission errors, corrupted files) return `{ sessionId, timeline: [], totalEntries: 0 }` rather than crashing.

11. **AC11 — Unit tests**: Comprehensive vitest tests covering:
    - `readTimeline()` returns parsed entries for valid JSONL file
    - `readTimeline()` returns empty array for missing file
    - `readTimeline()` skips malformed JSONL lines
    - `readTimeline()` maps ReplayEventType to human-readable actions
    - `readTimeline()` sorts entries by timestamp ascending
    - GET route returns timeline for valid session with data
    - GET route returns empty timeline for session without data
    - GET route returns 404 for non-existent session
    - GET route returns empty for session without workspacePath
    - GET route filters by `?agent=` query param
    - GET route filters by `?tool=` query param
    - GET route filters by `?from=` and `?to=` time range
    - GET route combines multiple filters (AND)
    - GET route handles read failure gracefully
    - SSE stream sends initial snapshot and heartbeat
    - SSE stream detects new timeline entries
    - SSE stream cleans up intervals on cancel

## Tasks / Subtasks

- [x] Task 1: Define types (AC: #1)
  - [x] 1.1 Add `ReplayEventType`, `ReplayEvent`, `TimelineEntry` to `packages/core/src/types.ts`
  - [x] 1.2 Export new types from `packages/core/src/index.ts`

- [x] Task 2: Create timeline core module (AC: #2, #3)
  - [x] 2.1 Create `packages/core/src/timeline.ts`
  - [x] 2.2 Implement `readTimeline(workspacePath, sessionId)` — reads JSONL, parses ReplayEvents, maps to TimelineEntry
  - [x] 2.3 Implement action description mapping (ReplayEventType → human-readable string)
  - [x] 2.4 Handle missing file (return empty array), malformed lines (skip), IO errors (return empty)
  - [x] 2.5 Export `readTimeline` from `packages/core/src/index.ts`

- [x] Task 3: Create GET timeline API route (AC: #4, #5, #6, #7, #8, #10)
  - [x] 3.1 Create `packages/web/src/app/api/session/[id]/timeline/route.ts`
  - [x] 3.2 Import `getServices` from `@/lib/services` and `readTimeline` from `@composio/ao-core`
  - [x] 3.3 Implement GET handler: resolve session, extract workspacePath, read timeline, return structured response
  - [x] 3.4 Implement query parameter filtering (`agent`, `tool`, `from`, `to`)
  - [x] 3.5 Handle edge cases: session not found (404), no workspace path (empty), read failure (empty)
  - [x] 3.6 Ensure `params` is awaited (Next.js 15 Promise convention)
  - [x] 3.7 Set `export const dynamic = "force-dynamic"`

- [x] Task 4: Create SSE timeline stream endpoint (AC: #9)
  - [x] 4.1 Create `packages/web/src/app/api/session/[id]/timeline/stream/route.ts`
  - [x] 4.2 Implement ReadableStream SSE pattern with initial snapshot and 10s poll interval
  - [x] 4.3 Compare entry count to detect changes (avoid sending unchanged data)
  - [x] 4.4 Set heartbeat at 15s intervals, cleanup on cancel
  - [x] 4.5 Set `export const dynamic = "force-dynamic"` and SSE response headers

- [x] Task 5: Unit tests — core module (AC: #11)
  - [x] 5.1 Create `packages/core/src/__tests__/timeline.test.ts`
  - [x] 5.2 Test `readTimeline()` returns parsed entries for valid JSONL
  - [x] 5.3 Test `readTimeline()` returns empty array for missing file
  - [x] 5.4 Test `readTimeline()` skips malformed lines
  - [x] 5.5 Test action description mapping for all ReplayEventType values
  - [x] 5.6 Test `readTimeline()` sorts entries by timestamp ascending
  - [x] 5.7 Test `readTimeline()` handles IO errors gracefully

- [x] Task 6: Unit tests — API routes (AC: #11)
  - [x] 6.1 Create `packages/web/src/app/api/session/[id]/timeline/route.test.ts`
  - [x] 6.2 Test valid session with timeline data
  - [x] 6.3 Test valid session without timeline data
  - [x] 6.4 Test non-existent session (404)
  - [x] 6.5 Test session without workspacePath
  - [x] 6.6 Test `?agent=` filter
  - [x] 6.7 Test `?tool=` filter
  - [x] 6.8 Test `?from=` and `?to=` time range filter
  - [x] 6.9 Test combined filters (AND)
  - [x] 6.10 Test read failure graceful handling
  - [x] 6.11 Create `packages/web/src/app/api/session/[id]/timeline/stream/route.test.ts`
  - [x] 6.12 Test SSE initial snapshot and heartbeat
  - [x] 6.13 Test SSE new entry detection
  - [x] 6.14 Test SSE cleanup on cancel

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

Dashboard timeline component is deferred to Story 60-4.
SubagentTrackingState JSON parsing is deferred — the primary data source is the JSONL replay file.

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
- [x] `readTimeline(workspacePath, sessionId)` — NEW function added by this story
- [x] `getServices()` — obtain service instances

**Feature Flags:**
- Timeline API only works for sessions that have a workspace with `.omc/state/agent-replay-{sessionId}.jsonl`. Sessions without OMC provider will return empty timeline.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing `node:fs/promises` for JSONL reading and standard Next.js API patterns.

## Dev Notes

### Architecture Context

This story is the third in Epic 60 (Dashboard Intelligence) and builds on the OMC provider infrastructure from Epic 58-59. The timeline data comes from the OMC provider's trace logging, which writes agent activity to `.omc/state/agent-replay-{sessionId}.jsonl` in JSONL format.

The API route provides the data access layer that Story 60-4 (Agent Activity Timeline Component) will consume. It follows the same patterns as the notepad API routes from Stories 60-1 and 60-2.

### OMC Trace Data Format

**Primary source**: `.omc/state/agent-replay-{sessionId}.jsonl`

Each line is a JSON object (`ReplayEvent`):
```json
{"t": 1.234, "agent": "planner", "agent_type": "planner", "event": "agent_start", "model": "claude-sonnet-4-6"}
{"t": 5.678, "agent": "planner", "agent_type": "planner", "event": "tool_start", "tool": "Read"}
{"t": 6.123, "agent": "planner", "agent_type": "planner", "event": "tool_end", "tool": "Read", "duration_ms": 445, "success": true}
{"t": 8.0, "agent": "planner", "agent_type": "planner", "event": "file_touch", "file": "src/types.ts"}
{"t": 30.0, "agent": "planner", "agent_type": "planner", "event": "agent_stop", "duration_ms": 28766}
```

Key fields:
- `t` — seconds since session start (float)
- `agent` — sub-agent name (e.g., "planner", "executor", "verifier")
- `agent_type` — agent category
- `event` — ReplayEventType enum value
- `tool` — tool name (only for tool_start/tool_end/hook events)
- `file` — file path (only for file_touch events)
- `duration_ms` — duration in milliseconds (for tool_end, agent_stop)
- `success` — boolean outcome (for tool_end)
- `model` — model used (for agent_start)

**Secondary source** (deferred): `.omc/state/subagent-tracking.json`
Contains `SubagentTrackingState` with per-agent token usage, tool usage counts, and file ownership. This is not used in this story — deferred to future enhancement.

### How API Routes Work in This Project

Every API route follows this pattern (see 60-1 notepad route):
1. Import `getServices` from `@/lib/services` (lazy singleton that loads config, plugins, sessionManager)
2. `await params` to get URL parameters (Next.js 15 Promise convention)
3. Use `sessionManager.get(id)` to resolve the session
4. Return `NextResponse.json()` for success or error
5. Wrap everything in try/catch, return `{ error: string }` for failures

### JSONL Reading Pattern

The project has an existing `readLastJsonlEntry()` in `utils.ts` that reads the last line of a JSONL file. For the timeline, we need to read ALL lines, so we'll create a new `readTimeline()` function:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readTimeline(workspacePath: string, sessionId: string): Promise<TimelineEntry[]> {
  const filePath = join(workspacePath, ".omc/state", `agent-replay-${sessionId}.jsonl`);
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim() !== "");
    const entries: TimelineEntry[] = [];
    for (const line of lines) {
      try {
        const replayEvent: ReplayEvent = JSON.parse(line);
        entries.push(mapToTimelineEntry(replayEvent));
      } catch {
        // Skip malformed lines
      }
    }
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    // File doesn't exist or permission error — return empty
    return [];
  }
}
```

### SSE Pattern

The project has established SSE patterns at `/api/events/route.ts` and `/api/session/[id]/notepad/stream/route.ts`:
- Uses `ReadableStream` with `TextEncoder`
- Sends `data: ${JSON.stringify(payload)}\n\n` for events
- Sends `: heartbeat\n\n` for keep-alive (every 15s)
- Sets `export const dynamic = "force-dynamic"` to disable caching
- Returns `Response` with `Content-Type: text/event-stream` headers
- Cleans up intervals in `cancel()` callback
- Polls for changes (compare content hash or entry count)

For the timeline SSE, poll every 10s (timeline changes less frequently than notepad), compare entry count to detect new data.

### Query Parameter Filtering

Filtering is applied AFTER reading the timeline, before returning. This keeps the core `readTimeline()` function simple and moves filtering to the API layer:

```typescript
let entries = await readTimeline(session.workspacePath, id);

// Apply filters
const { agent, tool, from, to } = Object.fromEntries(request.nextUrl.searchParams);
if (agent) entries = entries.filter(e => e.agent.toLowerCase().includes(agent.toLowerCase()));
if (tool) entries = entries.filter(e => e.tool?.toLowerCase().includes(tool.toLowerCase()));
if (from) entries = entries.filter(e => e.timestamp >= Number(from));
if (to) entries = entries.filter(e => e.timestamp <= Number(to));
```

### Import Conventions (MUST follow)

- **Package imports**: `import { readTimeline } from "@composio/ao-core"` — NO `.js` extension for package imports
- **Local web imports**: `import { getServices } from "@/lib/services"` — NO `.js` extension for `@/` imports (Next.js webpack convention)
- **Type imports**: `import type { TimelineEntry } from "@composio/ao-core"` for type-only imports
- **Core local imports**: `import { join } from "node:path"` — always use `node:` prefix for builtins

### Testing Standards

- **Framework**: vitest
- **Location**: `route.test.ts` co-located with route file; `__tests__/timeline.test.ts` for core module
- **Mocking**: Mock `getServices` and `readTimeline` in API route tests; use temp files for core tests
- **Pattern**: Use the standard API route test pattern from existing route tests
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in packages/web

### Anti-Patterns to Avoid

- **DO NOT** import `readTimeline` with `.js` extension — it's a package import from `@composio/ao-core`
- **DO NOT** forget to `await params` — Next.js 15 requires it
- **DO NOT** return 404 when timeline is missing — return empty array with 200
- **DO NOT** read the secondary `subagent-tracking.json` file — deferred
- **DO NOT** add file watching for SSE — use polling (simpler, consistent with notepad SSE)
- **DO NOT** add external dependencies — this is pure Node.js + existing core patterns
- **DO NOT** filter inside `readTimeline()` — filtering belongs in the API route layer
- **DO NOT** parse the entire JSONL into memory for very large files without considering streaming — but for dashboard use, the full parse is acceptable (sessions typically have <10K events)

### Limitations (Deferred Items)

1. **SubagentTrackingState JSON parsing**
   - Status: Deferred — secondary data source, not needed for initial timeline
   - Requires: Parsing `.omc/state/subagent-tracking.json` for token usage and file ownership
   - Current: Only reads primary JSONL replay file

2. **Timeline write endpoint**
   - Status: Deferred — timeline is written by the OMC provider, not the dashboard
   - Requires: N/A — dashboard is read-only
   - Current: No write endpoint needed

3. **Real-time file watching for timeline changes**
   - Status: Deferred — polling is sufficient for dashboard use
   - Requires: chokidar or fs.watch integration
   - Current: SSE endpoint polls every 10 seconds

4. **Streaming JSONL parsing for large sessions**
   - Status: Deferred — full file parse is acceptable for typical session sizes (<10K events)
   - Requires: Line-by-line streaming reader
   - Current: Reads entire JSONL file into memory

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-3 definition, FR-D2-1, FR-D2-3]
- [Source: `packages/core/src/types.ts` — existing type patterns, NotepadSection/NotepadContent]
- [Source: `packages/core/src/utils.ts:90-105` — `readLastJsonlEntry()` for JSONL reading pattern]
- [Source: `packages/core/src/notepad.ts` — `readNotepad()` pattern for workspace file reading]
- [Source: `packages/core/src/provider-verify.ts:47-92` — `.omc/state/` directory structure verification]
- [Source: `packages/web/src/lib/services.ts` — `getServices()` singleton]
- [Source: `packages/web/src/app/api/session/[id]/notepad/route.ts` — GET route pattern (best-effort read)]
- [Source: `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` — SSE stream pattern]
- [Source: `packages/core/src/index.ts:70` — `readNotepad` export (pattern for new exports)]
- [Source: `_bmad-output/implementation-artifacts/60-1-notepad-api-route.md` — Previous story patterns]

### Previous Story Intelligence (60-2)

**Key learnings from 60-2 that impact this story:**

1. **session.workspacePath is the correct field**: The Session interface uses `workspacePath` (not `worktreePath`). The timeline check should use this field.

2. **Best-effort pattern established**: Both 60-1 and 60-2 established that missing data returns empty results (200 with `exists: false` or empty arrays), not errors. Timeline should follow the same pattern.

3. **SSE uses standard EventSource format**: Events are `data: {...}\n\n` format — compatible with browser's native EventSource API.

4. **MockEventSource pattern for SSE tests**: The `useNotepadSSE.test.ts` established a MockEventSource class with `simulateOpen/Error/Message` methods and `mockInstances` array. SSE route tests should use the same mock pattern.

5. **Full test suite: 206 test files, 2563 tests pass**: New tests should follow the established mocking patterns and not break existing tests.

6. **vi.hoisted() for mock references used in vi.mock() factories**: Required when mock instances are referenced in `vi.mock()` factory functions.

### Previous Story Intelligence (60-1)

**Key learnings from 60-1 that impact this story:**

1. **Object.freeze for empty response constants**: Both GET and SSE routes use `Object.freeze(EMPTY_NOTEPAD)` to prevent accidental mutation. Timeline route should use `Object.freeze` for its empty response.

2. **SSE race condition fix**: Poll interval starts inside the async IIFE after initial snapshot completes, preventing simultaneous fire. Timeline SSE must follow the same pattern.

3. **SSE payloads include `exists` field**: Timeline SSE should include `totalEntries` for parity.

4. **`export const dynamic = "force-dynamic"` on GET route too**: Both GET and SSE routes need this directive.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

1. **ESLint: unused `TimelineEntry` import** in `packages/core/src/__tests__/timeline.test.ts` — Removed from import statement, keeping only `ReplayEvent`.
2. **ESLint: unused `afterEach` import** in `packages/web/src/app/api/session/[id]/timeline/route.test.ts` — Removed from import.
3. **ESLint: `import()` type annotations forbidden** in route test — Changed `as unknown as import("next/server").NextRequest` to top-level `import type { NextRequest }` and used `new NextRequest(url)`.
4. **ESLint: 6x `import()` type annotations** in `stream/route.test.ts` — Rewrote file with proper `vi.hoisted()` pattern, `import type`, and `makeRequest()` helper.
5. **Runtime: `request.nextUrl.searchParams` undefined** — Plain `new Request()` lacks `nextUrl` (Next.js-specific). Fixed by using `new NextRequest(url)`.
6. **Runtime: SSE tests timeout with fake timers** — `vi.useFakeTimers()` blocks ReadableStream async primitives. Rewrote all SSE tests to use real timers with `readChunk`/`readChunks` helpers and explicit test timeouts, matching the notepad SSE test pattern.

### Completion Notes List

1. All 11 ACs implemented and verified with tests.
2. Core module (`timeline.ts`) reads JSONL replay files, maps 13 ReplayEventType values to human-readable actions, sorts by timestamp.
3. GET route supports `?agent=`, `?tool=`, `?from=`, `?to=` filtering (AND-combined, case-insensitive substring for agent/tool).
4. SSE endpoint polls every 10s, compares entry count for change detection, sends heartbeats every 15s.
5. Best-effort pattern: missing files/permissions return empty arrays (200), not errors.
6. Test counts: Core 2494, Web 2582, 0 regressions. New tests: 9 core + 13 GET route + 6 SSE = 28 tests.
7. Pre-existing `provider-omc` test flakiness (ENOENT on temp dir) confirmed unrelated to this story.

### File List

**New files (4 source + 3 test = 7):**
- `packages/core/src/timeline.ts` — `readTimeline()` core module
- `packages/web/src/app/api/session/[id]/timeline/route.ts` — GET timeline API route
- `packages/web/src/app/api/session/[id]/timeline/stream/route.ts` — SSE timeline stream
- `packages/core/src/__tests__/timeline.test.ts` — Core module tests (9 tests)
- `packages/web/src/app/api/session/[id]/timeline/route.test.ts` — GET route tests (13 tests)
- `packages/web/src/app/api/session/[id]/timeline/stream/route.test.ts` — SSE stream tests (6 tests)

**Modified files (3):**
- `packages/core/src/types.ts` — Added `ReplayEventType`, `ReplayEvent`, `TimelineEntry` types
- `packages/core/src/index.ts` — Added timeline exports (`readTimeline`, type exports)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Date:** 2026-04-14

### Review Findings

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| H1 | HIGH | `readTimeline` accepts any valid JSON — no runtime structural validation | **Fixed** |
| M1 | MEDIUM | `lastCount = -1` edge case causes spurious SSE events on service failure | **Fixed** |
| M2 | MEDIUM | `expect(true).toBe(true)` placeholder assertion in SSE cleanup test | **Fixed** |
| L1 | LOW | No `never` exhaustiveness check in `describeAction` switch default | **Fixed** |
| L2 | LOW | `let entries;` missing explicit `TimelineEntry[]` type annotation | **Fixed** |
| L3 | LOW | Inconsistent mock strategies between `route.test.ts` and `stream/route.test.ts` | **Fixed** |

### Fixes Applied

1. **H1**: Added `isValidReplayEvent()` runtime guard with `VALID_EVENT_TYPES` set — validates `event` is a known ReplayEventType and `t` is numeric before accepting parsed JSON. Added new test "skips valid JSON objects missing required fields".
2. **M1**: Changed `lastCount` initialization from `-1` to `0`. Added `snapshotSent` flag — poll interval only starts if initial snapshot was successfully sent, preventing spurious events on service failure.
3. **M2**: Replaced `expect(true).toBe(true)` with real assertions verifying initial snapshot content (`toContain("timeline-update")`, `toContain('"totalEntries":0')`).
4. **L1**: Added `const _exhaustive: never = event` in switch default for compile-time exhaustiveness checking.
5. **L2**: Added `TimelineEntry[]` type annotation to `let entries` and imported the type.
6. **L3**: Aligned `route.test.ts` to use `vi.hoisted()` pattern with `importOriginal` passthrough, matching `stream/route.test.ts` style.

### Post-Fix Test Results

- Core tests: 10 passed (including new validation test)
- Web route tests: 13 passed
- Web SSE tests: 6 passed
- ESLint: 0 errors on all timeline files

### Verdict

All HIGH, MEDIUM, and LOW issues fixed. All tests passing. Story approved.
