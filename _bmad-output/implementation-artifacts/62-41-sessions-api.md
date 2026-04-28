# Story 62.41: Sessions API

Status: done

## Story

As a developer integrating with the Agent Orchestrator,
I want a comprehensive Sessions API documentation page that documents all session endpoints (CRUD, spawn, kill, restore, message/send, issue details) and per-session detail endpoints (state, memory, notepad, timeline) with their SSE stream variants, request/response shapes, status codes, and type definitions,
so that I can programmatically manage agent sessions, read and write session state, subscribe to real-time updates, and understand the complete session lifecycle API surface.

## Acceptance Criteria

1. **Sessions API page** (`docs/api/sessions.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Sessions API`, `nav_order: 1`, `parent: REST API`, `description` field — sourced from `docs/api/sessions.md`
2. **Overview section** documents: 15 session-related route files (7 under `/api/sessions/` + 8 under `/api/session/`) + 1 spawn route, grouped into Session CRUD (7 routes), Session Detail (8 routes), and Session Spawn (1 route) — sourced from `packages/web/src/app/api/sessions/` and `packages/web/src/app/api/session/`
3. **List Sessions section** documents: `GET /api/sessions` with optional `?active=true` query param (filters out `activity === "exited"`), response shape `{ sessions: DashboardSession[], stats: DashboardStats, orchestratorId: string | null }`, orchestrator sessions filtered from array but ID returned separately, metadata enrichment capped at 3s, PR enrichment capped at 4s with TTL cache (5 min default, 60 min rate-limited) — sourced from `packages/web/src/app/api/sessions/route.ts`
4. **Get Session section** documents: `GET /api/sessions/{id}` returning a single `DashboardSession` directly (not wrapped), 404 on not found, two-phase PR enrichment strategy (cache-only first, then block to populate) — sourced from `packages/web/src/app/api/sessions/[id]/route.ts`
5. **Spawn Session section** documents: `POST /api/spawn` with body `{ projectId: string, issueId?: string }`, validates projectId as identifier (`^[a-zA-Z0-9_-]+$`, max 128 chars), returns `{ session: DashboardSession }` with status 201, delegates to `sessionManager.spawn()` — sourced from `packages/web/src/app/api/spawn/route.ts`
6. **Kill Session section** documents: `POST /api/sessions/{id}/kill`, validates `id` via `validateIdentifier`, returns `{ ok: true, sessionId: string }`, delegates to `sessionManager.kill()` — sourced from `packages/web/src/app/api/sessions/[id]/kill/route.ts`
7. **Restore Session section** documents: `POST /api/sessions/{id}/restore`, returns `{ ok: true, sessionId, session: DashboardSession }`, domain-specific errors: 409 for `SessionNotRestorableError` (non-restorable state like "merged"), 422 for `WorkspaceMissingError` (worktree deleted) — sourced from `packages/web/src/app/api/sessions/[id]/restore/route.ts`
8. **Send Message section** documents two endpoints: `POST /api/sessions/{id}/message` (rich path via runtime plugin, returns `{ success: true }`) and `POST /api/sessions/{id}/send` (simple path via sessionManager, returns `{ ok: true, sessionId, message: string }` with sanitized echo), both validate body `{ message: string }` (max 10000 chars, control chars stripped via `stripControlChars`, re-validated after stripping) — sourced from `packages/web/src/app/api/sessions/[id]/message/route.ts` and `send/route.ts`
9. **Get Issue section** documents: `GET /api/sessions/{id}/issue`, returns `{ id, title, description (truncated 500 chars), state, labels, url }`, 404 when no issue linked or no tracker configured, uses `tracker.issueLabel()` stripping `#` prefix — sourced from `packages/web/src/app/api/sessions/[id]/issue/route.ts`
10. **Session State section** documents: `GET /api/session/{id}/state` and `GET /api/session/{id}/state/stream`, response `{ sessionId, state: SessionState, exists, readError? }`, SSE event type `event: state-update`, graceful degradation (200 with empty state on read failure), 5s polling with JSON.stringify change detection — sourced from `packages/web/src/app/api/session/[id]/state/route.ts` and `state/stream/route.ts`
11. **Session Memory section** documents: `GET /api/session/{id}/memory` (read), `PUT /api/session/{id}/memory` (write with body `{ entries: Array<{type: string, content: string}> }`), and `GET /api/session/{id}/memory/stream` (SSE event type `event: memory-update`), response shape `{ sessionId, memory: ProjectMemory, exists, readError? }` — sourced from `packages/web/src/app/api/session/[id]/memory/route.ts` and `memory/stream/route.ts`
12. **Session Notepad section** documents: `GET /api/session/{id}/notepad` returning `{ sessionId, notepad: { priority, working, manual }, exists }` where `exists` is true only when at least one section is non-whitespace, and `GET /api/session/{id]/notepad/stream` using MD5 hash comparison (unique among stream routes), SSE event includes `type: "notepad-update"` — sourced from `packages/web/src/app/api/session/[id]/notepad/route.ts` and `notepad/stream/route.ts`
13. **Session Timeline section** documents: `GET /api/session/{id}/timeline` with query params `agent` (substring filter), `tool` (substring filter), `from`/`to` (timestamp range in seconds), returning `{ sessionId, timeline: TimelineEntry[], totalEntries }`, and `GET /api/session/{id]/timeline/stream` with 10s polling (unique among stream routes) and entry-count change detection — sourced from `packages/web/src/app/api/session/[id]/timeline/route.ts` and `timeline/stream/route.ts`
14. **SSE Streams Summary section** provides a comparison table of all 4 stream routes with event type, poll interval, change detection method, and named event usage — sourced from all stream route files
15. **Key Types section** documents: `DashboardSession` (17 fields), `DashboardStats` (4 fields), `DashboardPR` (18 fields), `DashboardCICheck` (3 fields), `DashboardMergeability` (= MergeReadiness), `DashboardUnresolvedComment` (4 fields), `SessionSpawnConfig` (8 fields), `SessionState` (6 fields), `SessionStatus` (18 values), `ActivityState` (6 values), `AttentionLevel` (6 values) — sourced from `packages/web/src/lib/types.ts` and `packages/core/src/types.ts`
16. **Page uses correct Just the Docs front matter**: `title: Sessions API`, `nav_order: 1`, `parent: REST API`, `description` field
17. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
18. **Cross-links** verified: parent link to REST API index, sibling links to other API pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Sessions API page (AC: #1-18)
  - [x] Replace stub content in docs/api/sessions.md
  - [x] Write front matter (title, nav_order: 1, parent: REST API, description)
  - [x] Write "Overview" section — 16 routes, 3 groups (CRUD/Detail/Spawn) (AC #1-2)
  - [x] Write "List Sessions" section — GET /api/sessions with query params, response, caching (AC #3)
  - [x] Write "Get Session" section — GET /api/sessions/{id}, two-phase PR enrichment (AC #4)
  - [x] Write "Spawn Session" section — POST /api/spawn, body, validation, 201 response (AC #5)
  - [x] Write "Kill Session" section — POST kill, validation, response (AC #6)
  - [x] Write "Restore Session" section — POST restore, domain errors 409/422 (AC #7)
  - [x] Write "Send Message" section — two endpoints (message vs send), validation (AC #8)
  - [x] Write "Get Issue" section — GET issue, truncation, tracker integration (AC #9)
  - [x] Write "Session State" section — GET state + SSE stream, graceful degradation (AC #10)
  - [x] Write "Session Memory" section — GET/PUT memory + SSE stream (AC #11)
  - [x] Write "Session Notepad" section — GET notepad + SSE stream, MD5 change detection (AC #12)
  - [x] Write "Session Timeline" section — GET timeline with filters + SSE stream, 10s polling (AC #13)
  - [x] Write "SSE Streams Summary" section — comparison table (AC #14)
  - [x] Write "Key Types" section — all session-related types with field counts (AC #15)
  - [x] Write "Next Steps" cross-links section (AC #18)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #17)

## Task Completion Validation

**Task Completion Criteria:**
- All 19 subtasks checked off
- `docs/api/sessions.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used

## Dev Notes

### Architecture Patterns (from Story 62-40 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to REST API index, sibling links to each API sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files; annotate forward references with *(upcoming)*
- Route counts must be verified against actual file listings (API Index had inflated counts)
- Auth claims must match actual behavior (API Index had wrong 401 for chat route)
- Pagination defaults must match source code (API Index had wrong limit=20)

### Source Tree Components

### Page Routes
- `packages/web/src/app/api/sessions/route.ts` — GET list
- `packages/web/src/app/api/sessions/[id]/route.ts` — GET single
- `packages/web/src/app/api/sessions/[id]/kill/route.ts` — POST kill
- `packages/web/src/app/api/sessions/[id]/restore/route.ts` — POST restore
- `packages/web/src/app/api/sessions/[id]/message/route.ts` — POST message (runtime)
- `packages/web/src/app/api/sessions/[id]/send/route.ts` — POST send (sessionManager)
- `packages/web/src/app/api/sessions/[id]/issue/route.ts` — GET issue details
- `packages/web/src/app/api/session/[id]/state/route.ts` — GET state
- `packages/web/src/app/api/session/[id]/state/stream/route.ts` — SSE state
- `packages/web/src/app/api/session/[id]/memory/route.ts` — GET/PUT memory
- `packages/web/src/app/api/session/[id]/memory/stream/route.ts` — SSE memory
- `packages/web/src/app/api/session/[id]/notepad/route.ts` — GET notepad
- `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` — SSE notepad
- `packages/web/src/app/api/session/[id]/timeline/route.ts` — GET timeline
- `packages/web/src/app/api/session/[id]/timeline/stream/route.ts` — SSE timeline
- `packages/web/src/app/api/spawn/route.ts` — POST spawn

### Shared Lib
- `packages/web/src/lib/serialize.ts` — sessionToDashboard, enrichSessionPR, enrichSessionsMetadata, computeStats
- `packages/web/src/lib/types.ts` — DashboardSession (17 fields), DashboardStats (4 fields), DashboardPR (18 fields)
- `packages/web/src/lib/validation.ts` — validateString, validateIdentifier, stripControlChars
- `packages/web/src/lib/services.ts` — getServices singleton

### Core Types
- `packages/core/src/types.ts` — Session (17 fields), SessionManager (10 methods), SessionStatus (18 values), ActivityState (6 values), SessionSpawnConfig (8 fields)

### Route Count Summary

| Group | Prefix | Count |
|-------|--------|-------|
| Session CRUD | `/api/sessions` | 7 |
| Session Detail | `/api/session` | 8 |
| Session Spawn | `/api/spawn` | 1 |
| **Total** | | **16** |

### SSE Stream Comparison

| Route | Event Type | Poll | Change Detection | Named Event |
|-------|-----------|------|-------------------|-------------|
| state/stream | `event: state-update` | 5s | JSON.stringify | Yes |
| memory/stream | `event: memory-update` | 5s | JSON.stringify | Yes |
| notepad/stream | `data:` only | 5s | MD5 hash | No |
| timeline/stream | `data:` only | 10s | Entry count | No |

All use 15s heartbeat (`: heartbeat\n\n`), `X-Accel-Buffering: no`, clean up on cancel.

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all type field counts match actual TypeScript interfaces
- Verify API endpoint parameters and response shapes match route implementations
- Confirm SSE poll intervals and change detection methods match source
- Validate error status codes match route implementations (especially 409 for SessionNotRestorableError)

### Project Structure Notes

- Doc file location: `docs/api/sessions.md`
- Nav order: 1 (first child under REST API)
- Parent: REST API (docs/api/index.md)
- Sibling pages: sprints (2), agents (3), events (4), portfolio (5), dependencies (6), scenarios (7), conflicts (8), risk (9)

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.41]
- [Source: packages/web/src/app/api/sessions/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/kill/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/restore/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/message/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/send/route.ts]
- [Source: packages/web/src/app/api/sessions/[id]/issue/route.ts]
- [Source: packages/web/src/app/api/session/[id]/state/route.ts]
- [Source: packages/web/src/app/api/session/[id]/memory/route.ts]
- [Source: packages/web/src/app/api/session/[id]/notepad/route.ts]
- [Source: packages/web/src/app/api/session/[id]/timeline/route.ts]
- [Source: packages/web/src/app/api/spawn/route.ts]
- [Source: packages/web/src/lib/serialize.ts]
- [Source: packages/web/src/lib/types.ts]
- [Source: packages/core/src/types.ts]

## Change Log

- 2026-04-25: Story created from sprint backlog
- 2026-04-25: Wrote comprehensive Sessions API documentation covering all 18 ACs — 16+ sections replacing 6-line stub
- 2026-04-25: Adversarial code review — 26 claims verified across 16 route files + 2 type files. Found and fixed 9 issues: DashboardSession 17→16 fields, DashboardPR 18→17 fields, SessionState 6→7 fields (added persistentMaxRetries), PR enrichment mechanism precision (Promise.race wrapping Promise.allSettled), active filter enum precision (ACTIVITY_STATE.EXITED), state/memory response readError conditional clarification, notepad/timeline stream route typos {id]→{id}

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- Replaced `docs/api/sessions.md` stub (6 lines) with comprehensive documentation (~534 lines)
- All 18 acceptance criteria covered across 16+ sections: Overview, List Sessions, Get Session, Spawn Session, Kill Session, Restore Session, Send Message (two endpoints), Get Issue, Session State (GET + SSE), Session Memory (GET/PUT + SSE), Session Notepad (GET + SSE), Session Timeline (GET + SSE), SSE Streams Summary, Key Types, cross-links
- Front matter includes `description` field (was missing from stub)
- Cross-links: 9 sibling API pages verified (all exist), 3 getting-started pages verified (all exist)
- No hero font classes used
- Route counts: 7 CRUD, 8 detail, 1 spawn = 16 total (verified against file listings)
- SSE comparison table: 4 streams with event type, poll interval, change detection, named event
- Key types: DashboardSession (16 fields), DashboardStats (4 fields), DashboardPR (17 fields), SessionStatus (18 values), ActivityState (6 values), AttentionLevel (6 values), SessionState (7 fields)
- Code review fixes: 9 issues (5 HIGH, 2 MEDIUM, 2 LOW) — field count corrections (3), mechanism precision (2), response shape clarification (2), route path typos (2)

### File List

- `docs/api/sessions.md` — replaced stub with comprehensive Sessions API documentation
