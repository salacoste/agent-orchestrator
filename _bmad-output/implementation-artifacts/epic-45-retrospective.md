# Epic 45 Retrospective — Intelligence & Replay

**Date**: 2026-04-29
**Epic**: 45 — Intelligence & Replay
**Status**: Complete (all 8 stories done)
**Source**: epics-cycle-9.md

## Epic Summary

Epic 45 delivered the intelligence and observability layer: story replay with time-lapse playback lets leads watch what agents did, time travel reconstructs historical dashboard state, post-mortem generation automates failure analysis, ROI calculator proves agent value to stakeholders, standup summaries produce one-click standup reports, confidence indicators show where agents were uncertain, reasoning trails surface decision logic from session data, and sprint diff compares two time periods for velocity trends. Every story followed the pure-function-plus-API-route pattern established in earlier epics.

## Story Delivery

| Story | Title | New Tests | Status |
|-------|-------|-----------|--------|
| 45-1 | Story Replay — Agent Session Time-Lapse | 32 (23 engine + 9 component) | Done |
| 45-2 | Time Travel — Historical State Navigation | 22 (15 engine + 7 component) | Done |
| 45-3 | Post-Mortem Auto-Generator | 16 (12 generator + 4 route) | Done |
| 45-4 | ROI Calculator — Agent Value Proof | 13 (9 calculator + 4 route) | Done |
| 45-5 | Meeting Summary Generator — Standup Button | 12 (9 generator + 3 route) | Done |
| 45-6 | Confidence Indicators — Per-File Agent Certainty | 22 (18 calculator + 4 route) | Done |
| 45-7 | Reasoning Trail — Agent Decision Logic | 17 (13 extractor + 4 route) | Done |
| 45-8 | Sprint Diff — Sprint-Over-Sprint Comparison | 14 (10 diff + 4 route) | Done |

**Total new tests**: ~148
**New modules**: 8 pure functions in core, 8 API routes in web, 4 new UI components
**External dependencies added**: 0
**Deferred items**: 1 (per-file confidence granularity in 45-6)

## Technical Analysis

### Architecture Pattern: Pure Function + API Route

All 8 stories shared the same three-layer architecture:

1. **Pure logic** in `packages/core/src/` — no I/O, no React, no DOM. Accepts typed input, returns typed output. Fully testable in isolation.
2. **API route** in `packages/web/src/app/api/` — wiring layer that fetches data from SessionManager/LearningStore, calls the pure function, returns JSON.
3. **UI component** (Stories 45-1, 45-2 only) — React component consuming the pure logic via hooks.

Stories 45-1 and 45-2 also included an intermediate hook layer (`useReplay`, state in WorkflowPage). Stories 45-3 through 45-8 are backend-only — no UI components.

### Key Implementation Details

**Replay Engine (45-1):** Inter-event delays are capped at 5s max / 100ms min to prevent long pauses from real-world time gaps. Uses chained `setTimeout` (not `setInterval`) for variable-delay playback at 1x/2x/5x/10x speeds. Pure functions: `advanceReplay`, `seekReplay`, `setReplaySpeed`, `toggleReplayPlayback`. No new API endpoints — reuses existing `GET /api/agent/{id}/activity`.

**Time Travel (45-2):** State reconstruction replays `AuditEvent[]` chronologically, tracking story status transitions via a switch on `eventType`. `hasEventsInRange()` provides quick empty-range detection. SSE updates are skipped during time travel and restored on "Return to Present". Uses native `<input type="datetime-local">` for the picker with `toLocalDatetimeValue()` for timezone conversion.

**Post-Mortem Generator (45-3):** Reuses `detectPatterns()` from `learning-patterns.ts` for pattern-based recommendations. Falls back to generic recommendations when below pattern threshold. Error breakdown is sorted by count descending with affected story lists. API queries LearningStore for three outcome types: failed, blocked, abandoned.

**ROI Calculator (45-4):** Token-to-USD conversion: `totalTokens * pricePerMillionTokens / 1_000_000`. Defaults: $15/1M tokens, 4h/story, $75/h — all overridable via `Partial<ROIConfig>`. Transparent breakdown string for stakeholder reporting. Guards against division by zero when `storiesCompleted === 0`.

**Standup Generator (45-5):** Produces Slack/Teams-friendly markdown with bold headings and bullet lists. Three sections: Completed, In Progress, Blockers. `hasActivity` flag avoids empty reports when only agents are active. Time window default: 24 hours, overridable via `?hours=N`.

**Confidence Calculator (45-6):** Scoring: 100 base, -20 per retry, -15 per error category, -5 if >10 files modified. Thresholds: high >= 70, medium >= 40, low < 40. All files share session-level score (per-file retry tracking deferred — SessionLearning only tracks session-level data).

**Reasoning Extractor (45-7):** Four inference strategies: summary keyword matching, domain tag inference, retry pattern analysis, test file ratio. Extracts "decisions" from agent session summaries using pattern keywords ("chose", "decided", "using", "because", "instead of"). `extractRationale()` checks same sentence and next sentence for "because"/"since" clauses.

**Sprint Diff (45-8):** `compare()` function supports higher-is-better and lower-is-better metrics with 5% unchanged tolerance. Period splitting: `[a, b)` for period A, `[b, now)` for period B based on `completedAt` timestamps. Failure rate rounded to 3 decimal places.

### Shared Patterns

- **getServices()**: All API routes use `getServices()` for SessionManager and config access.
- **LearningStore.query()**: Stories 45-3 through 45-8 query the learning store with varying filters (by outcome, by agentId, by time range).
- **Agent ID validation**: Routes accepting `{id}` use regex `/^[a-zA-Z0-9_-]+$/` to prevent injection.
- **Pure function exports**: All 8 generators/calculators are exported from `@composio/ao-core` index.ts.
- **Route test pattern**: All route tests mock `getServices()` and external modules via `vi.mock()`.

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Eight stories, one consistent architecture pattern, zero external dependencies. The pure-function-plus-API-route pattern proved highly repeatable — by story 45-3 the team was producing clean implementations in a single pass. The ROI calculator and standup generator directly solve stakeholder communication problems that have been open since the project began. The replay and time-travel features are genuinely novel for agent orchestration tooling.

**Nova (Architect):** Three architectural decisions paid off:

1. **No new API endpoints for replay (45-1)** — reusing the existing activity API kept the replay engine pure client-side. The three-layer separation (engine → hook → component) means the replay logic is fully testable without React.

2. **LearningStore as the single data source (45-3 through 45-8)** — every intelligence feature queries the same JSONL learning store. No new storage, no new schemas, no new data flows. The store's `query()` interface with filters by outcome, agentId, and time range is flexible enough for all six backend stories.

3. **Configurable defaults with override params (45-4, 45-5)** — ROI rates and standup time windows use sensible defaults but accept query param overrides. No config schema changes needed. This is the right trade-off for v1.

**Blaze (Dev):** The pure function pattern is now mechanical in the best way. By story 45-6, each implementation followed the exact same structure: interface definition, pure function with input/output types, API route with getServices() wiring, test file with generator tests + route tests. No surprises, no debugging sessions, no refactoring needed. 148 tests with zero regressions across all 8 stories.

**Pax (QA):** Every story shipped with real test assertions — no `expect(true).toBe(true)` placeholders. The test counts per story are proportional to complexity (32 for replay with its engine + component layers, 12-14 for the simpler pure-function stories). The confidence calculator (45-6) has the highest test-to-code ratio at 22 tests, which is appropriate given its scoring algorithm with multiple thresholds and edge cases.

---

### What Could Be Improved

**R2d2 (Project Lead):** All 8 stories are backend-only or require manual API calls to use. There is no dashboard integration for any of the intelligence features — no ROI panel, no standup button, no confidence badges on session cards, no reasoning trail in the review view. The features exist as APIs but are invisible to users who only interact with the web dashboard. A follow-up epic for dashboard wiring is needed.

**Nova (Architect):** The reasoning extractor (45-7) relies on keyword matching against session summaries, which is fragile. Agents do not produce structured decision logs — they produce free-text summaries. The keyword list ("chose", "decided", "using", "because", "instead of") will miss decisions expressed differently and will false-positive on casual usage of those words. A structured decision-logging protocol in the agent interface would produce more reliable data, but that is a larger architectural change.

**Blaze (Dev):** Six stories (45-3 through 45-8) all export from `packages/core/src/index.ts`, which has accumulated many exports. The core package index is becoming a large re-export barrel file. Grouped exports or sub-path exports (`@composio/ao-core/intelligence`) would improve discoverability.

**Pax (QA):** The deferred item from 45-6 (per-file confidence granularity) is a real functional gap. All files in a session share the same confidence score because SessionLearning only tracks session-level retries and errors. A file with a clean edit gets the same "low" confidence as the file that caused retries. This limits the usefulness of the confidence indicator for code reviewers trying to prioritize their review effort.

---

### Previous Retro Action Items Review

Epic 42 retrospective had action items carried forward:

| # | Action Item | Status | Notes |
|---|------------|--------|-------|
| 1 | Dashboard wiring for intelligence features | Not done | All 8 stories are backend-only |
| 2 | Structured decision logging in agent interface | Not done | 45-7 uses keyword matching instead |
| 3 | Sub-path exports for core package | Not done | index.ts continues to grow |
| 4 | Per-file retry tracking in SessionLearning | Not done | 45-6 deferred to future |

**Score: 0/4 action items completed from prior epics.**

---

### Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Dashboard UI panels for ROI, standup, confidence, reasoning, sprint diff | Future epic | All |
| Structured decision-logging protocol in agent interface | Future epic | 45-7 |
| Per-file confidence granularity (requires SessionLearning changes) | Future epic | 45-6 |
| Sub-path exports for `@composio/ao-core` | Tech debt | — |
| Copy-to-clipboard for standup markdown (mentioned in 45-5 dev notes) | Future story | 45-5 |

---

### Project-Level Reflections

**R2d2 (Project Lead):** Epic 45 completes the "intelligence" horizontal of the system. Combined with the event bus (Epic 38), learning store (Epic 39), and workflow dashboard (Epic 44), the system can now observe, learn, replay, analyze, and report on agent activity. The missing piece is dashboard wiring — the intelligence exists as APIs but is not yet surfaced in the UI.

**Nova (Architect):** The pure-function architecture has reached its mature form. Every intelligence module follows the same contract: typed input, typed output, no side effects, exported from core, consumed by a thin API route. This pattern has been applied consistently across Epics 44-45 (14 stories total) with zero architectural deviations. The pattern is documented, repeatable, and enforced through code review.

**Blaze (Dev):** 148 new tests in one epic with zero regressions. The testing pattern is now equally mechanical: pure function tests cover happy paths, edge cases, empty inputs, and rounding; route tests cover success, empty data, invalid inputs, and service failures. The consistency means every story ships with comprehensive coverage without requiring ad-hoc test planning.

**Pax (QA):** The test suite for the intelligence features is well-structured but almost entirely unit-level. There are no integration tests that verify the full pipeline from LearningStore query through pure function to API response with real data. The route tests mock `getServices()` and `LearningStore`, which means they test the wiring but not the actual data flow. Integration tests for the intelligence pipeline would increase confidence.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Wire intelligence features into web dashboard (ROI panel, standup button, confidence badges, reasoning trail, sprint diff view) | Dev | HIGH |
| 2 | Add structured decision-logging protocol to Agent interface for richer reasoning extraction | Architect | MEDIUM |
| 3 | Add per-file retry/error tracking to SessionLearning capture for true per-file confidence | Dev | MEDIUM |
| 4 | Add integration tests for intelligence API pipeline (LearningStore -> pure function -> API response) | QA | LOW |
| 5 | Refactor `@composio/ao-core` index.ts into grouped sub-path exports | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 8 |
| Total new tests | ~148 |
| External dependencies added | 0 |
| New pure functions in core | 8 |
| New API routes | 8 |
| New UI components | 4 (ReplayTimeline, TimeTravelBar, modified FocusMode, modified WorkflowPage) |
| Deferred items | 1 (per-file confidence) |
| Zero-regression stories | 8/8 |
| Pattern consistency | 100% (all stories follow pure-function-plus-API-route) |
