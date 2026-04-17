# Story 60.7: Session State API Route

Status: done

## Story

As a developer using the dashboard,
I want an API route that reads the current execution state of a session from its worktree,
so that the dashboard can display execution mode, active agents, progress indicators, and health status in real-time.

## Acceptance Criteria

1. **AC1 — REST endpoint `GET /api/session/[id]/state`**: A new route at `packages/web/src/app/api/session/[id]/state/route.ts` that:
   - Reads session via `sessionManager.get(id)`
   - Returns `404` if session not found
   - Returns empty state with `exists: false` if no workspace path
   - Reads OMC state files from the worktree's `.omc/state/` directory
   - Reads session metadata `omc:*` keys for provider-injected state
   - Returns structured JSON: `{ sessionId, state: SessionState, exists }`
   - Has `export const dynamic = "force-dynamic"`
   - Has `Cache-Control: no-cache, no-store, must-revalidate` headers

2. **AC2 — `SessionState` response shape**: The REST endpoint returns:
   ```typescript
   interface SessionState {
     executionMode: string | null;        // from metadata["omc:executionMode"] or "standard"
     activeAgents: string[];               // from metadata["omc:agents"] (JSON parsed)
     configured: boolean;                  // from metadata["omc:configured"]
     activeModes: ActiveModeState[];       // from .omc/state/*.json files
     health: SessionHealth | null;         // aggregated health status
   }

   interface ActiveModeState {
     mode: string;          // "ralph" | "ultrawork" | "autopilot" | etc.
     active: boolean;
     iteration?: number;
     maxIterations?: number;
     phase?: string;
     tasksCompleted?: number;
     tasksTotal?: number;
   }

   interface SessionHealth {
     healthy: boolean;
     message?: string;
     lastCheck: string | null;  // ISO timestamp
   }
   ```

3. **AC3 — SSE endpoint `GET /api/session/[id]/state/stream`**: A new route at `packages/web/src/app/api/session/[id]/state/stream/route.ts` that:
   - Follows the established SSE streaming pattern from `notepad/stream/route.ts`
   - Sends initial snapshot on connect
   - Polls every 5 seconds for state changes
   - Uses JSON.stringify comparison for change detection
   - Sends heartbeat every 15 seconds
   - Sends events as `event: state-update` with JSON data payload
   - Cleans up intervals on cancel

4. **AC4 — Core reader module**: A new module at `packages/core/src/session-state.ts` that:
   - Exports `readSessionState(worktreePath: string, metadata: Record<string, string>): Promise<SessionState>`
   - Reads `ralph-state.json`, `ultrawork-state.json`, `autopilot-state.json` from `.omc/state/`
   - Gracefully handles missing/malformed files (returns empty defaults)
   - Parses metadata `omc:*` keys for execution mode and agent list
   - Wraps all file reads in try/catch (best-effort pattern)

5. **AC5 — Types exported from core**: New types added to `packages/core/src/types.ts`:
   - `SessionState`, `ActiveModeState`, `SessionHealth` interfaces
   - Exported from `packages/core/src/index.ts`

6. **AC6 — Best-effort error handling**: All file reads and JSON parsing wrapped in try/catch:
   - Missing state files → empty mode entry (not included in array)
   - Malformed JSON → skip that file (log warning, continue)
   - Missing metadata keys → null/empty defaults
   - No `.omc/state/` directory → empty `activeModes` array

7. **AC7 — Unit tests for core reader**: Tests at `packages/core/src/__tests__/session-state.test.ts` covering:
   - Reads state files successfully
   - Handles missing state directory
   - Handles malformed JSON in state files
   - Parses metadata correctly
   - Returns defaults when all files missing
   - Handles partial state (some files exist, some don't)

8. **AC8 — Unit tests for REST route**: Tests at `packages/web/src/app/api/session/[id]/state/route.test.ts` covering:
   - Returns 404 for unknown session
   - Returns empty state with `exists: false` for session without workspace
   - Returns full state for session with workspace and state files
   - Handles missing state files gracefully
   - Verifies response headers (Cache-Control, Content-Type)

9. **AC9 — Unit tests for SSE stream**: Tests at `packages/web/src/app/api/session/[id]/state/stream/route.test.ts` covering:
   - Sends initial snapshot on connect
   - Sends heartbeat after 15 seconds
   - Detects state changes via polling
   - Cleans up on cancel

10. **AC10 — No new dependencies**: Uses only existing dependencies (Node fs, path, core types).

## Tasks / Subtasks

- [x] Task 1: Define types and export (AC: #5)
  - [x] 1.1 Add `SessionState`, `ActiveModeState`, `SessionHealth` to `packages/core/src/types.ts`
  - [x] 1.2 Export new types from `packages/core/src/index.ts`

- [x] Task 2: Create core reader module (AC: #4, #6)
  - [x] 2.1 Create `packages/core/src/session-state.ts`
  - [x] 2.2 Implement `readSessionState()` with metadata parsing
  - [x] 2.3 Implement `readModeStateFiles()` for `.omc/state/*.json` reading
  - [x] 2.4 Implement `parseActiveMode()` for individual state file parsing
  - [x] 2.5 Add best-effort error handling (try/catch on all file reads)

- [x] Task 3: Create REST endpoint (AC: #1, #2)
  - [x] 3.1 Create `packages/web/src/app/api/session/[id]/state/route.ts`
  - [x] 3.2 Implement GET handler following notepad/route.ts pattern
  - [x] 3.3 Import and call `readSessionState()` from core
  - [x] 3.4 Add Cache-Control headers and force-dynamic export

- [x] Task 4: Create SSE stream endpoint (AC: #3)
  - [x] 4.1 Create `packages/web/src/app/api/session/[id]/state/stream/route.ts`
  - [x] 4.2 Implement SSE stream following notepad/stream/route.ts pattern
  - [x] 4.3 Set poll interval to 5 seconds
  - [x] 4.4 Implement JSON.stringify change detection
  - [x] 4.5 Implement heartbeat every 15 seconds

- [x] Task 5: Unit tests — core reader (AC: #7)
  - [x] 5.1 Create `packages/core/src/__tests__/session-state.test.ts`
  - [x] 5.2 Test successful state file reads
  - [x] 5.3 Test missing state directory
  - [x] 5.4 Test malformed JSON handling
  - [x] 5.5 Test metadata parsing
  - [x] 5.6 Test defaults when all files missing
  - [x] 5.7 Test partial state (some files exist)

- [x] Task 6: Unit tests — REST route (AC: #8)
  - [x] 6.1 Create `packages/web/src/app/api/session/[id]/state/route.test.ts`
  - [x] 6.2 Test 404 for unknown session
  - [x] 6.3 Test empty state for no workspace
  - [x] 6.4 Test full state response
  - [x] 6.5 Test graceful missing files
  - [x] 6.6 Test response headers

- [x] Task 7: Unit tests — SSE stream (AC: #9)
  - [x] 7.1 Create `packages/web/src/app/api/session/[id]/state/stream/route.test.ts`
  - [x] 7.2 Test initial snapshot
  - [x] 7.3 Test heartbeat
  - [x] 7.4 Test state change detection
  - [x] 7.5 Test cleanup on cancel

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

Provider health check integration deferred. The `SessionEnhancementProvider.healthCheck()` method requires a live provider instance from the plugin registry. The initial implementation reads static state from files on disk. Health check can be integrated when the provider registry is more accessible from API routes.

OMC config file (`.claude/omc.jsonc`) reading deferred. The full `PluginConfig` is large and not all fields are relevant for the dashboard. Initial implementation reads only metadata and state files. Config reading can be added when the dashboard needs model routing or feature flag information.

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
- [x] `sessionManager.get(id)` — Existing core service (session lookup)
- [x] `session.workspacePath` — Existing Session field (worktree path)
- [x] `session.metadata` — Existing Session field (provider-injected metadata)

**Feature Flags:**
- None. All required interfaces exist.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing Node.js `fs`, `path`, and `readFile` from `node:fs/promises`.

## Dev Notes

### Architecture Context

This story is the seventh in Epic 60 (Dashboard Intelligence). It creates the API route that reads OMC (oh-my-claudecode) execution state from a session's worktree. The data comes from two sources:

1. **Session metadata** — `omc:executionMode`, `omc:agents`, `omc:configured` keys injected by the OMC provider during `enhance()`
2. **OMC state files** — JSON files in `.omc/state/` directory written by OMC modes (ralph, ultrawork, autopilot)

### Data Sources

**Metadata keys** (injected by OMC provider at `packages/plugins/provider-omc/src/index.ts:194-206`):
- `metadata["omc:agents"]` = JSON string of agent name array, e.g. `'["omc","explore","analyst"]'`
- `metadata["omc:executionMode"]` = `"standard"` (string)
- `metadata["omc:configured"]` = `"true"` (string)

**State files** (in session worktree under `.omc/state/`):
- `ralph-state.json` → `{ active: boolean, iteration: number, max_iterations: number, prd_mode?: boolean, current_story_id?: string }`
- `ultrawork-state.json` → `{ active: boolean, reinforcement_count: number }`
- `autopilot-state.json` → `{ active: boolean, phase: string, iteration: number, max_iterations: number, execution?: { tasks_completed?: number, tasks_total?: number, files_created?: string[] } }`

### Core Module Design

The `readSessionState()` function should:

1. Parse metadata for execution mode, agents, and configured status
2. Read state files from `.omc/state/` — use `readFile` from `node:fs/promises`
3. Map each state file to an `ActiveModeState` object
4. Return combined `SessionState`

```typescript
// packages/core/src/session-state.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionState, ActiveModeState } from "./types.js";

interface ModeFileMapping {
  file: string;
  mode: string;
}

const MODE_FILES: ModeFileMapping[] = [
  { file: "ralph-state.json", mode: "ralph" },
  { file: "ultrawork-state.json", mode: "ultrawork" },
  { file: "autopilot-state.json", mode: "autopilot" },
];

export async function readSessionState(
  worktreePath: string,
  metadata: Record<string, string>,
): Promise<SessionState> {
  const executionMode = metadata["omc:executionMode"] ?? null;
  const activeAgents = safeParseJSON<string[]>(metadata["omc:agents"]) ?? [];
  const configured = metadata["omc:configured"] === "true";

  const activeModes = await readModeStateFiles(join(worktreePath, ".omc", "state"));

  return {
    executionMode,
    activeAgents,
    configured,
    activeModes,
    health: null, // Deferred — requires live provider instance
  };
}
```

### REST Route Pattern

Follow the exact pattern from `notepad/route.ts`:

```typescript
// packages/web/src/app/api/session/[id]/state/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { readSessionState } from "@composio/ao-core/session-state";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = { "Cache-Control": "no-cache, no-store, must-revalidate" } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { sessionManager } = await getServices();
  const session = await sessionManager.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.workspacePath) {
    return NextResponse.json({
      sessionId: id,
      state: emptyState(),
      exists: false,
    }, { headers: NO_CACHE_HEADERS });
  }

  const state = await readSessionState(session.workspacePath, session.metadata);
  return NextResponse.json({ sessionId: id, state, exists: true }, { headers: NO_CACHE_HEADERS });
}
```

### SSE Stream Pattern

Follow the exact pattern from `notepad/stream/route.ts` with these parameters:
- **Poll interval**: 5 seconds (state changes more frequently than notepad)
- **Change detection**: `JSON.stringify(currentState) !== JSON.stringify(previousState)`
- **Heartbeat**: Every 15 seconds (same as notepad/timeline)
- **Event type**: `event: state-update` (typed SSE events for consumer convenience)

### Session Lookup Pattern

```typescript
const { sessionManager } = await getServices();
const session = await sessionManager.get(id);
```

This is the standard pattern used by ALL session-scoped API routes in this codebase. The `getServices()` function initializes the service registry from config.

### File Read Pattern for State Files

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null; // File missing or malformed — best-effort
  }
}
```

This follows the best-effort pattern: missing files return null, not errors. The route always returns HTTP 200 with whatever state is available.

### Import Conventions (MUST follow)

- **Core imports in web package**: `import { readSessionState } from "@composio/ao-core/session-state"` — NO `.js` extension (web package convention)
- **Node builtins**: `import { readFile } from "node:fs/promises"` — `node:` prefix required
- **Core local imports**: `import type { SessionState } from "./types.js"` — `.js` extension required (core package ESM convention)
- **Sibling imports**: `import { cn } from "./cn"` — no extension (web package convention)

### Anti-Patterns to Avoid

- **DO NOT** use `import * as fs from "node:fs"` synchronous API — use `node:fs/promises` for async
- **DO NOT** throw errors on missing files — return empty defaults (best-effort pattern)
- **DO NOT** read state files with `readFileSync` — all file I/O must be async
- **DO NOT** add `health` field populated from provider registry — deferred, return `null`
- **DO NOT** use `exec` or `execFile` for file reads — use `readFile` from `node:fs/promises`
- **DO NOT** use `.js` extensions in web package imports — the web package convention is extensionless
- **DO NOT** forget `export const dynamic = "force-dynamic"` — prevents Next.js caching
- **DO NOT** forget `"use client"` on any client components — NOT applicable here (server-only routes)

### Limitations (Deferred Items)

1. **Provider health check integration**
   - Status: Deferred — requires live provider instance from registry
   - Requires: Access to `registry.get("provider", "omc")` from within API routes, or a dedicated health service
   - Current: `health` field returns `null` in all responses

2. **OMC config file reading (`.claude/omc.jsonc`)**
   - Status: Deferred — full `PluginConfig` is large and not all fields are dashboard-relevant
   - Requires: JSONC parser, selective field extraction
   - Current: Only metadata keys and state files are read

3. **Team state and other mode files**
   - Status: Deferred — `team-state.json`, `ultraqa-state.json`, `ralplan-state.json` are less common
   - Requires: Add to `MODE_FILES` array when types are defined
   - Current: Only ralph, ultrawork, and autopilot states are read

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-7 definition, FR-D4-1, FR-D4-2]
- [Source: `packages/web/src/app/api/session/[id]/notepad/route.ts` — REST route pattern]
- [Source: `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` — SSE stream pattern]
- [Source: `packages/web/src/app/api/session/[id]/timeline/route.ts` — REST route pattern with query params]
- [Source: `packages/web/src/app/api/session/[id]/timeline/stream/route.ts` — SSE stream pattern with entry count comparison]
- [Source: `packages/core/src/types.ts:1383-1391` — `ProviderHealth` interface]
- [Source: `packages/core/src/types.ts:1409-1456` — `SessionEnhancementProvider` interface]
- [Source: `packages/plugins/provider-omc/src/index.ts:194-206` — OMC metadata injection]
- [Source: `_tmp/oh-my-claudecode/src/hud/state.ts` — State file reader patterns (reference only)]
- [Source: `_tmp/oh-my-claudecode/src/hud/omc-state.ts:39-41` — State file path resolution chain]
- [Source: `_tmp/oh-my-claudecode/src/lib/mode-names.ts:49-56` — Mode-to-filename mapping]
- [Source: `packages/web/src/lib/services.ts` — `getServices()` for session lookup]
- [Source: `packages/web/src/lib/types.ts:59-76` — `DashboardSession` type]

### Previous Story Intelligence (60-6)

1. **Runtime validation on API responses**: Code review added `validateCostSummary()` — consider if API responses need similar validation. For this story, the response IS the API, so validation applies to file reads instead (handled by try/catch).

2. **NO_CACHE_HEADERS constant**: Established pattern for all API routes — `{ "Cache-Control": "no-cache, no-store, must-revalidate" }`.

3. **Export types from core**: New types must be added to `packages/core/src/types.ts` AND exported from `packages/core/src/index.ts`.

4. **Best-effort pattern**: Missing data returns empty results (HTTP 200), not errors.

5. **Code review lesson — render all data fields**: Ensure the API response includes ALL fields from the `SessionState` type.

6. **Code review lesson — error state**: API routes should handle service initialization failures gracefully (try/catch around `getServices()`).

7. **SSE tests take time**: Notepad stream tests take 15+ seconds due to heartbeat waits. Timeline stream tests take 25+ seconds. Plan test timeouts accordingly.

### Previous Story Intelligence (60-5)

1. **`NO_CACHE_HEADERS` constant**: Used across all cost breakdown route cases.
2. **`VALID_DIMENSIONS` as Set**: The code review changed from array to Set for O(1) lookup.
3. **Exhaustiveness guard**: Switch blocks should have a final catch-all returning 500.

### Previous Story Intelligence (60-1, 60-3)

1. **Notepad SSE uses MD5 hash for change detection**: The pattern compares content hashes to detect changes.
2. **Timeline SSE uses entry count for change detection**: Simpler — just compares `entries.length`.
3. **Both use 15-second heartbeats**: Standard across all SSE endpoints.
4. **Session lookup pattern**: `getServices()` → `sessionManager.get(id)` → check workspace.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — clean implementation, no blocking issues.

### Completion Notes List

- Added `SessionState`, `ActiveModeState`, `SessionHealth` interfaces to `packages/core/src/types.ts`
- Created `packages/core/src/session-state.ts` with `readSessionState()`, `readModeStateFiles()`, `parseActiveMode()`, `emptySessionState()` — all best-effort with try/catch
- Added `./session-state` sub-path export to `packages/core/package.json`
- Exported `readSessionState` function and types from `packages/core/src/index.ts`
- Created REST endpoint `GET /api/session/[id]/state/route.ts` following notepad pattern with NO_CACHE_HEADERS
- Created SSE endpoint `GET /api/session/[id]/state/stream/route.ts` with 5s poll, JSON.stringify change detection, 15s heartbeat, `event: state-update` typed events
- 10 core reader tests (temp dir based, all pass — includes frozen object and non-array JSON guard tests from review)
- 6 REST route tests (mock based, all pass)
- 5 SSE stream tests (real timers, all pass including 15s heartbeat wait and no-workspace coverage from review)

### File List

**New files:**
- `packages/core/src/session-state.ts` — Core reader module
- `packages/core/src/__tests__/session-state.test.ts` — 8 core reader tests
- `packages/web/src/app/api/session/[id]/state/route.ts` — REST endpoint
- `packages/web/src/app/api/session/[id]/state/route.test.ts` — 6 REST route tests
- `packages/web/src/app/api/session/[id]/state/stream/route.ts` — SSE stream endpoint
- `packages/web/src/app/api/session/[id]/state/stream/route.test.ts` — 5 SSE stream tests

**Modified files:**
- `packages/core/src/types.ts` — Added `SessionState`, `ActiveModeState`, `SessionHealth` interfaces
- `packages/core/src/index.ts` — Added `readSessionState` export and type exports
- `packages/core/package.json` — Added `./session-state` sub-path export

**Test summary:** 21 new tests (10 core + 6 REST + 5 SSE), all passing
