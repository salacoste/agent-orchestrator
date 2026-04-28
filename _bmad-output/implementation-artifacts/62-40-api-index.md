# Story 62.40: API Index

Status: done

## Story

As a developer integrating with the Agent Orchestrator,
I want a comprehensive API Index documentation page that provides a REST API overview with base URL, authentication model, common request/response patterns, standardized error format, endpoint categorization, and links to all individual API reference pages,
so that I can quickly understand the API surface, know how to authenticate, format requests, handle errors, and navigate to specific endpoint documentation for sessions, sprints, agents, events, portfolio, dependencies, scenarios, conflicts, and risk.

## Acceptance Criteria

1. **API Index page** (`docs/api/index.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: REST API`, `nav_order: 7`, `has_children: true`, `description` field — serving as the parent index for all API reference child pages
2. **Overview section** documents: Next.js App Router file-based routing under `/api/`, 124 total route files, 9 child doc pages (sessions, sprints, agents, events, portfolio, dependencies, scenarios, conflicts, risk), and `force-dynamic` rendering for most routes
3. **Base URL section** documents: default base URL `http://localhost:3000/api` (or configured host), no custom `basePath` in `next.config.js`, all routes served under `/api/*` — sourced from `packages/web/next.config.js`
4. **Authentication section** documents: no API-wide authentication middleware, all routes are unauthenticated (designed for local/self-hosted deployment behind a reverse proxy), Telegram webhook (`/api/telegram/webhook`) validates `X-Telegram-Bot-Api-Secret-Token` header as the only route-level auth, chat route (`/api/chat`) requires `ANTHROPIC_API_KEY` env var for outbound LLM calls — sourced from route implementations
5. **Request Format section** documents: JSON request bodies for POST/PATCH/PUT, Next.js 15 dynamic segments using `params: Promise<{ ... }>` pattern (e.g., `[id]`, `[project]`, `[conflictId]`, `[resourceType]`), query parameters for filtering/pagination (e.g., `page`, `limit`, `since`, `severity`), input validation via `validateString()`, `validateIdentifier()`, `stripControlChars()` in `packages/web/src/lib/validation.ts`
6. **Response Format section** documents: success responses as bare JSON objects (no envelope wrapper), collection pattern (`{ items: T[], stats?: object }`), single resource pattern (direct object), action confirmation pattern (`{ ok: true, sessionId: string }` or `{ success: true }`), creation responses with `201` status, SSE streaming responses with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` headers, 15-second heartbeat interval (`: heartbeat\n\n`) — sourced from `packages/web/src/app/api/events/route.ts` and other route files
7. **Error Format section** documents: standardized error shape `{ error: string }`, status code table (400 validation, 401 unauthorized, 403 forbidden, 404 not found, 409 conflict, 422 unprocessable, 500 internal, 503 service unavailable), error extraction pattern (`err instanceof Error ? err.message : "Fallback message"`), one extended error: dependency cycle detection returns `{ error: string, cyclePath: string[] }` with status 422 — sourced from route implementations and `packages/web/src/lib/validation.ts`
8. **Common Headers section** documents: `Content-Type: application/json` for request/response, `Cache-Control` variants (`no-cache, no-store, must-revalidate` for health/costs; `public, max-age=5, stale-while-revalidate=30` for audit events), SSE headers, `X-Accel-Buffering: no` for SSE routes
9. **Endpoint Categories section** provides a categorized endpoint table with: category name, route prefix, route count, child doc page link, and brief description — covering all 9 categories: Sessions (8 routes), Sprints (47 routes), Agents (11 routes), Events & Audit (4 routes), Portfolio & Pool (4 routes), Dependencies (4 routes), Scenarios (5 routes), Conflicts (10 routes), Risk (7 routes) — plus misc single routes (health, spawn, learning, users, resources, costs, chat, approvals, DLQ, state, Telegram webhook)
10. **Configuration Requirement section** documents: `agent-orchestrator.yaml` required in working directory, loaded via `loadConfig()` in `packages/core/src/config.ts`, missing config returns `{ error: "No agent-orchestrator.yaml found. Run 'ao init' to create one." }` with status 500, `getServices()` singleton in `packages/web/src/lib/services.ts` provides `config`, `registry`, `sessionManager` to all routes, `/api/health` is the exception that gracefully handles missing config (always returns 200)
11. **SSE section** documents: centralized SSE endpoint at `/api/events`, 6 SSE stream routes (events + 5 per-session streams), event format (`data: JSON\n\n`), heartbeat interval (15s), polling interval (5s), EventSource client usage with auto-reconnect
12. **Pagination section** documents: offset-based pagination in audit events route (`page`, `limit`, `totalPages`), no cursor-based pagination in current API
13. **Quick Start example** shows a minimal curl example: `curl http://localhost:3000/api/health` and `curl http://localhost:3000/api/sessions`
14. **Child page navigation** lists all 9 child pages with nav_order and one-line description, linking to each: Sessions API (nav_order: 1), Sprints API (nav_order: 2), Agents API (nav_order: 3), Events API (nav_order: 4), Portfolio API (nav_order: 5), Dependencies API (nav_order: 6), Scenarios API (nav_order: 7), Conflicts API (nav_order: 8), Risk API (nav_order: 9)
15. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
16. **Cross-links** verified: links to Getting Started, Configuration, and all 9 child API pages

## Tasks / Subtasks

- [x] Task 1: Write API Index page (AC: #1-16)
  - [x] Replace stub content in docs/api/index.md
  - [x] Write front matter (title, nav_order: 7, has_children: true, description)
  - [x] Write "Overview" section — 124 routes, 9 categories, App Router (AC #2)
  - [x] Write "Base URL" section — localhost:3000/api, no basePath (AC #3)
  - [x] Write "Authentication" section — no auth middleware, Telegram webhook secret, chat API key (AC #4)
  - [x] Write "Request Format" section — JSON bodies, dynamic segments, query params, validation (AC #5)
  - [x] Write "Response Format" section — bare JSON, collection/single/action patterns, SSE, heartbeats (AC #6)
  - [x] Write "Error Format" section — error shape, status code table, cycle detection extension (AC #7)
  - [x] Write "Common Headers" section — Content-Type, Cache-Control variants, SSE headers (AC #8)
  - [x] Write "Endpoint Categories" section — 9 category table with route counts and links (AC #9)
  - [x] Write "Configuration Requirement" section — yaml file, loadConfig(), getServices(), health exception (AC #10)
  - [x] Write "SSE Streaming" section — /api/events, 6 stream routes, event format, heartbeat (AC #11)
  - [x] Write "Pagination" section — offset-based, page/limit/totalPages (AC #12)
  - [x] Write "Quick Start" section — curl examples (AC #13)
  - [x] Write "API Reference" child page navigation — 9 links with descriptions (AC #14)
  - [x] Verify no hero font classes (AC #15)
  - [x] Verify all cross-links resolve (AC #16)

## Task Completion Validation

**Task Completion Criteria:**
- All 17 subtasks checked off
- `docs/api/index.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used

## Dev Notes

### Architecture Patterns (from Story 62-36/37/39 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to top-level nav, child links to each API sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files; annotate forward references with *(upcoming)*

### Source Tree Components

- 124 API route files across 26 top-level directories under `packages/web/src/app/api/`
- 9 existing stub child pages under `docs/api/` (all referencing "Story 62.19" — this epic)
- Shared services: `packages/web/src/lib/services.ts` (getServices/getSCM singletons)
- Shared validation: `packages/web/src/lib/validation.ts` (validateString, validateIdentifier, stripControlChars)
- Shared serialization: `packages/web/src/lib/serialize.ts` (sessionToDashboard, enrichSessionPR, computeStats)
- Shared types: `packages/web/src/lib/types.ts`, `packages/core/src/types.ts`

### Route Category Summary

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| sprint | 47 | Sprint CRUD, metrics, velocity, CFD, Monte Carlo, ceremonies, story CRUD |
| agent | 11 | Status, activity, capacity, confidence, logs, ping, reasoning, reassign |
| sessions | 7 | List, per-session CRUD, kill, restore, message, send, issue |
| risk | 7 | Score, alerts, alert config, bottleneck, dashboard, optimization, utilization |
| conflicts | 7 | Detection, detail, suggestions, history, export, policies |
| scenarios | 5 | CRUD, simulate, compare, apply |
| session | 8 | State, memory, notepad, timeline (with SSE streams) |
| dependencies | 4 | Cross-project graph, blocking-status, search-stories |
| workflow | 3 | Per-project state, feedback, health-metrics |
| audit | 3 | Events, export, immutable log |
| approvals | 3 | Pending list, approve, reject |
| pool | 2 | Capacity, utilization |
| dlq | 2 | List, retry |
| cross-session-memory | 2 | Per-project read, SSE stream |
| misc (1 each) | 8 | health, events, learning, spawn, users, resources, costs, chat, sprints/unified, telegram, state, prs |

### HTTP Methods Distribution

| Method | Count | Usage |
|--------|-------|-------|
| GET | 102 | Reads, list queries, SSE streams, exports |
| POST | 27 | Creates, mutations, actions |
| PATCH | 6 | Partial updates |
| DELETE | 6 | Removals |
| PUT | 4 | Full replacements |

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (default) |
| 201 | Resource created |
| 400 | Validation failure |
| 401 | Unauthorized (Telegram webhook only) |
| 403 | Feature not enabled |
| 404 | Resource not found |
| 409 | Conflict |
| 422 | Unprocessable (cycle detection, merge failure) |
| 500 | Internal server error |
| 503 | Service unavailable (missing credentials) |

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.40]
- [Source: packages/web/src/lib/services.ts]
- [Source: packages/web/src/lib/validation.ts]
- [Source: packages/web/src/lib/serialize.ts]
- [Source: packages/web/src/lib/types.ts]
- [Source: packages/core/src/config.ts]
- [Source: packages/web/next.config.js]

## Change Log

- 2026-04-25: Story created from sprint backlog (create-story workflow)
- 2026-04-25: Wrote comprehensive API Index documentation covering all 16 ACs — 13 sections replacing 10-line stub
- 2026-04-25: Adversarial code review — 15 claims verified (13 accurate, 2 inaccurate). Fixed 6 issues: Portfolio/Pool route count (4→2), Conflicts route count (10→7), chat auth response (401→200 fallback), added 3 missing routes (workflow/feedback, workflow/health-metrics, cross-session-memory read), pagination default (20→100) and response shape, sprint conflict routes note

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- Replaced `docs/api/index.md` stub (10 lines) with comprehensive documentation (~280 lines)
- All 16 acceptance criteria covered across 13 sections: Overview, Base URL, Authentication, Request Format, Response Format, Error Format, Common Headers, Endpoint Categories, Configuration Requirement, SSE Streaming, Pagination, Quick Start, API Reference
- Front matter includes `description` field (was missing from stub)
- Cross-links: 9 child API pages verified (all exist as stubs), 3 getting-started pages verified (all exist)
- No hero font classes used
- Source verification: next.config.js (no basePath), services.ts (getServices singleton, globalThis caching), health route (always 200, graceful degradation), validation.ts (3 validators)
- Route count: 124 files across 26 top-level directories (verified by file listing)
- HTTP methods: GET (102), POST (27), PATCH (6), DELETE (6), PUT (4)
- Status codes: 200, 201, 400, 401, 403, 404, 409, 422, 500, 503
- Code review fixes: Portfolio/Pool 4→2, Conflicts 10→7, chat auth 401→200 fallback, 3 missing routes added, pagination limit default 20→100 and response shape corrected, sprint conflict note added

### File List

- `docs/api/index.md` — replaced stub with comprehensive API Index documentation
