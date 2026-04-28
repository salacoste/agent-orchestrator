# Epic 60 Retrospective — Dashboard Intelligence

**Date**: 2026-04-29
**Epic**: 60 — Dashboard Intelligence
**Status**: Complete (all 9 stories done)
**Source**: epics-cycle-11.md

## Epic Summary

Epic 60 built the dashboard intelligence layer, giving the web dashboard real-time visibility into agent sessions. Every session detail page now displays: the agent's notepad (priority, working memory, manual notes), a sub-agent activity timeline with event-type color coding, a model cost breakdown panel with per-tier bar visualization, the current OMC execution state (mode, active agents, progress bars), and a project memory viewer with inline edit and delete. All panels receive real-time updates via SSE streams or 30-second polling.

The epic followed a consistent API-first pattern: each feature was split into a backend story (API route + SSE stream + core module) followed by a frontend story (React hook + dashboard panel + SessionDetail integration). This created 4 parallel tracks (notepad, timeline, cost, state) plus a capstone story (project memory) that spanned the full stack in a single story.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 60-1 | Notepad API Route | 12 (7 GET + 5 SSE) | 6 (H1 race condition, H2 missing field, L1-L3) | Done |
| 60-2 | Notepad Dashboard Panel | 24 (17 hook + 7 component) | 3 (M1 connected state, L2 act warning, L3 status) | Done |
| 60-3 | Agent Timeline API Route | 28 (9 core + 13 GET + 6 SSE) | 6 (H1 no runtime validation, M1-M2, L1-L3) | Done |
| 60-4 | Agent Activity Timeline Component | 27 (15 hook + 12 component) | 5 (M1 file render, M2 dead code, L1-L3) | Done |
| 60-5 | Model Cost API Route | 18 | 6 (H1 exhaustive guard, M1-M3, L1-L2) | Done |
| 60-6 | Model Cost Dashboard Panel | 23 (9 hook + 14 component) | 14 (H1 error state, H2 unsafe cast, M1-M8, L1-L4) | Done |
| 60-7 | Session State API Route | 21 (10 core + 6 REST + 5 SSE) | — | Done |
| 60-8 | Session State Dashboard Panel | 27 (13 hook + 14 panel) | 6 (M1 truthiness at 0, M2 optional fields, M3 layout, L1-L3) | Done |
| 60-9 | Project Memory API & Viewer | 48 (10 core + 11 route + 13 hook + 14 panel) | — | Done |

**Total new tests**: ~228
**New core modules**: timeline.ts, session-state.ts, project-memory.ts
**New API routes**: 5 GET routes, 5 SSE streams, 1 PUT route
**New React hooks**: 5 (useNotepadSSE, useTimelineSSE, useCostData, useSessionStateSSE, useProjectMemorySSE)
**New components**: 5 (NotepadViewer, TimelineViewer, CostBreakdownPanel, SessionStatePanel, ProjectMemoryViewer)
**External dependencies added**: 0

## Party Mode

| Agent | Role | Highlights |
|-------|------|-----------|
| **R2d2** | Lead architect, story sequencing | Designed the consistent API-first split pattern; ensured all 5 panels share identical card wrapper, ActivityDot, and SSE hook patterns. Established the `session.workspacePath` guard convention. |
| **Nova** | Code reviewer, pattern enforcer | Caught 46 review findings across all stories. Enforced runtime validation (H1 in 60-3, H2 in 60-6), exhaustiveness guards (60-5), and accessibility attributes (60-6, 60-8, 60-9). Eliminated all `expect(true).toBe(true)` assertions. |
| **Blaze** | Full-stack implementer, Stories 60-1/60-3/60-5/60-7 | Built all API routes and core modules. Discovered that `session.workspacePath` (not `worktreePath`) is the correct field. Established the SSE race condition fix (poll starts after initial snapshot). Added `Object.freeze()` for empty response constants. |
| **Pax** | Frontend implementer, Stories 60-2/60-4/60-6/60-8/60-9 | Built all dashboard panels and hooks. Established the MockEventSource test pattern in 60-2 that was reused across all subsequent hook tests. Handled the named-event distinction (`addEventListener` vs `onmessage`) for state and memory streams. |

## What Went Well

1. **Consistent architecture pattern across all features** — Every feature followed the same split: core module (best-effort file reader) -> REST API route -> SSE stream -> React hook (REST fetch + EventSource + exponential backoff) -> dashboard panel (card wrapper + ActivityDot). By story 60-4, the pattern was mechanical to implement.

2. **Zero external dependencies** — All 9 stories use only existing dependencies (React, EventSource API, node:fs/promises, Next.js API routes). No chart libraries, no SSE client libraries, no markdown renderers. Pure CSS bar visualizations, native EventSource, preformatted text display.

3. **Code review process caught real issues** — 46 findings across 9 stories, including 4 HIGH severity: SSE race condition (60-1), missing runtime validation on JSONL parsing (60-3), missing exhaustive switch guard (60-5), unsafe type cast without runtime validation (60-6). Every finding was fixed before story close.

4. **Best-effort pattern is now universal** — Every data source (notepad, timeline, cost, session state, project memory) follows the same pattern: missing data returns empty defaults with HTTP 200, not errors. Read failures return `exists: false` or empty arrays. The dashboard never crashes from missing backend data.

5. **SSE architecture scaled cleanly** — Started with simple `data:` events (notepad, timeline) and naturally extended to named `event:` events (state, memory) without architectural changes. The `addEventListener` vs `onmessage` distinction was caught in code review and applied consistently.

6. **Test count growth** — From ~2,539 tests at the start of the epic to ~2,728 tests at completion, a net gain of ~189 tests. All stories passed with zero regressions against the full suite.

## What Could Be Improved

1. **SSE test execution time** — Heartbeat tests wait 15+ seconds with real timers (fake timers break ReadableStream/EventSource async primitives). Timeline SSE tests take 25+ seconds. Across 5 SSE stream test files, this adds significant latency to the test suite.

2. **Story 60-6 had the most review findings (14)** — The CostBreakdownPanel went through an adversarial review that found 2 HIGH and 8 MEDIUM issues, suggesting the initial implementation was rushed. The `validateCostSummary()` runtime validation function should have been included from the start.

3. **Provider health check remains deferred** — Stories 60-7 and 60-8 both defer the health display because the provider registry is not accessible from API routes. This leaves the SessionStatePanel with a permanent "Health check not available" state.

4. **Cost panel shows global summary, not per-session** — The CostBreakdownPanel fetches `/api/costs/breakdown?dimension=summary` (global) rather than per-session cost. The API supports all dimensions, but the drill-down UI is deferred. Users cannot yet see cost for the specific session they are viewing.

5. **Multiple filter dimensions deferred** — The timeline API supports `?agent=`, `?tool=`, `?from=`, `?to=` query params, but the TimelineViewer only exposes agent filtering. Tool-type and time-range filter UIs are deferred.

## Key Decisions

| Decision | Rationale | Tradeoff |
|----------|-----------|----------|
| API-first story split (backend story then frontend story) | Backend API can be tested independently; frontend story has stable contract to consume | More stories, but each is smaller and independently testable |
| Polling for SSE change detection (not file watching) | Simpler, no chokidar dependency, consistent across all SSE streams | Up to 5-10 second delay before dashboard reflects changes |
| `session.workspacePath` guard for all panels | Sessions without worktrees cannot have `.omc/` state files | Panels silently hidden for non-worktree sessions |
| Named SSE events for state/memory streams | Allows consumers to filter by event type; cleaner than parsing default messages | Requires `addEventListener` instead of `onmessage` |
| Polling hook for cost data (30s interval) instead of SSE | Cost API is REST-only; cost changes infrequently (on session completion) | Not truly real-time, but sufficient for cost monitoring |
| Atomic writes for project memory (temp + rename) | Prevents partial writes from corrupting the JSON file | Slightly more complex write path |
| `Object.freeze()` for all empty response constants | Prevents accidental mutation of shared default objects | None meaningful |

## Lessons Learned

1. **The `workspacePath` vs `worktreePath` field name matters** — Story 60-1 discovered that the Session interface uses `workspacePath`, not `worktreePath`. This was documented and carried forward to all 8 subsequent stories. Without this early discovery, every story would have had the same bug.

2. **`vi.useFakeTimers()` is incompatible with SSE/ReadableStream tests** — Fake timers block the async primitives used by ReadableStream and EventSource. All SSE tests must use real timers with explicit waits. This was learned the hard way in 60-1 and applied consistently from 60-3 onward.

3. **`vi.hoisted()` is required for mock references in `vi.mock()` factories** — Without hoisting, mock function references used inside `vi.mock()` factory functions are undefined at execution time. This pattern was established in 60-2 and reused across all hook tests.

4. **Runtime validation is essential for external data** — The 60-3 H1 finding (JSONL parsing accepted any valid JSON without structural validation) led to `isValidReplayEvent()` and a new test. The 60-6 H2 finding (unsafe `as CostSummary` cast) led to `validateCostSummary()`. Both patterns should be applied proactively in future stories.

5. **Named SSE events require `addEventListener`, not `onmessage`** — The state stream (60-7) and memory stream (60-9) send typed events (`event: state-update`, `event: memory-update`). The browser's `onmessage` handler only receives default (unnamed) events. This distinction must be documented clearly for each SSE endpoint.

6. **The card wrapper pattern is copy-paste stable** — By story 60-8, the `detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5` wrapper with `ActivityDot` header was identical across all 5 panels. This stability reduced implementation errors and review findings.

## Action Items

| # | Action Item | Owner | Target |
|---|------------|-------|--------|
| 1 | Add provider health check to SessionStatePanel — requires registry access from API routes | Dev | Epic 62+ |
| 2 | Add per-session cost drill-down to CostBreakdownPanel — API supports all dimensions | Dev | Epic 62+ |
| 3 | Add tool-type and time-range filter UI to TimelineViewer — API already supports query params | Dev | Epic 62+ |
| 4 | Investigate faster SSE test patterns — heartbeat waits add 15-25s per test file | Dev | Tech debt |
| 5 | Add SSE streaming endpoint for cost data (`/api/costs/breakdown/stream`) — currently REST-only | Dev | Epic 62+ |
| 6 | Add Gantt-style timeline visualization as alternative to scrollable list | Dev | Future |
| 7 | Fix pre-existing test failures noted in Epic 59 retro (standup-generator, resource-conflict) | Dev | Tech debt |

## Previous Retro Integration

Epic 59 action items status:
- **Extract spawn orchestration from session-manager.ts**: Not yet addressed. Session-manager complexity continues to grow.
- **Fix standup-generator.test.ts**: Not yet addressed.
- **Fix resource-conflict.test.ts**: Not yet addressed.
- **Complete OMC provider integration test**: Not yet addressed.
- **Wire compact-event detection**: Deferred to Epic 61.

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 9 / 9 (100%) |
| Total new tests | ~228 |
| Total new files (source) | ~25 |
| Total new files (test) | ~17 |
| Review findings | 46 (4 HIGH, 16 MEDIUM, 26 LOW) |
| Review fix rate | 100% (all findings resolved) |
| External dependencies added | 0 |
| Test regressions | 0 |
| Deferred items | 14 across all stories |
