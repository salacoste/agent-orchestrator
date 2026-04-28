# Epic 52 Retrospective — Resource Conflict Detection

**Date**: 2026-04-29
**Epic**: 52 — Resource Conflict Detection
**Status**: Complete (all 5 stories done)
**Source**: epics-cycle-10.md
**Cycle**: 10

## Epic Summary

Epic 52 built the resource conflict detection layer on top of the portfolio (Epic 49), shared agent pool (Epic 50), and cross-project dependencies (Epic 51) infrastructure. The system now automatically detects when multiple projects target overlapping resources (repositories, agents, file paths), surfaces conflicts in a real-time SSE-powered dashboard, generates contextual resolution suggestions, applies configurable auto-resolution policies, and tracks resolution history with pattern analysis.

The five stories form a clean vertical slice: detection engine (52-1) provides types and pure functions, dashboard (52-2) adds visualization with SSE, suggestions (52-3) adds intelligent resolution guidance, policies (52-4) adds configurable auto-resolution, and history (52-5) closes the loop with analytics and export.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 52-1 | Resource Conflict Detection Engine | 42 core + 6 route | 18 issues (code review) | Done |
| 52-2 | Conflict Alert Dashboard | 32 new (SSE, components) | 3H + 4M (adversarial review) | Done |
| 52-3 | Conflict Resolution Suggestions | 29 core + 5 route + 7 component | 0 (clean first pass) | Done |
| 52-4 | Conflict Resolution Policy Configuration | 13 core + API routes + component | 0 (clean first pass) | Done |
| 52-5 | Conflict History Tracking | 32 core + 10 route + 25 component | 1H + 2M (code review) | Done |

**Total new tests**: ~213
**New modules**: resource-conflict.ts, resource-conflict-suggestions.ts, conflict-policy.ts, conflict-history.ts, conflict-broadcaster.ts, useConflictSSE hook, 12+ new React components
**External dependencies added**: 0
**Agent models used**: Claude Opus 4.6 (52-1, 52-3, 52-4), Claude Sonnet 4.6 (52-2, 52-5)

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 52 delivered the conflict detection pipeline end-to-end in a single epic with zero external dependencies. The progression from detection to dashboard to suggestions to policies to history is exactly the layered approach we planned. The key user outcome is that project managers can now see conflicts in real time, get actionable suggestions, configure automatic resolution, and learn from patterns over time. The fact that all five stories share a consistent type system (`ResourceConflict`, `ResourceConflictType`, `ResourceConflictSeverity`) makes the entire feature feel cohesive.

**Nova (Architect):** Three architectural decisions paid off significantly:

1. **Separation of detection JSONL from history JSONL** — Story 52-1's `resource-conflicts-audit.jsonl` (detection scan log) and Story 52-5's `resource-conflicts-history.jsonl` (resolution events) serve different query patterns and write cadences. Co-locating them would have created unnecessary coupling. This two-file pattern should be the reference for future dual-concern append-only stores.

2. **Config cascade for policies** — Story 52-4's four-tier resolution (project per-type > project default > global default > hardcoded "manual") reuses the same config hierarchy pattern from shared-pool.ts. The `source` field ("project:proj-a", "global", "hardcoded") gives operators immediate visibility into where a policy originates.

3. **Pub/sub broadcaster for SSE** — The `conflict-broadcaster.ts` singleton using `globalThis` is a lightweight pattern for cross-request event propagation without Redis or a message broker. It integrates with the existing 5-second polling cadence in `/api/events` rather than introducing a new infrastructure dependency.

**Blaze (Dev):** The pure function pattern from the cross-project dependencies epic (Epic 51) carried over cleanly. `detectResourceConflicts()`, `generateSuggestions()`, `filterConflictHistory()` — all pure sync functions with no I/O. This made testing straightforward: no mocks needed for the core logic, only for the file store and API route adapters. Story 52-3 shipping with zero code review issues is the strongest signal that the pattern is well-established.

**Pax (QA):** 213 new tests with real assertions across four testing layers: core unit tests (pure function logic), route tests (API endpoint behavior), component tests (React rendering and interaction), and integration tests (end-to-end detection to persistence to audit). The 42-test core suite in 52-1 and the 32-test core suite in 52-5 both cover edge cases like malformed YAML, missing files, empty configs, and AND-combined filters. The adversarial review on 52-2 caught 7 real issues (3 high, 4 medium) — the highest count of any story, and all fixed.

---

### What Could Be Improved

**R2d2 (Project Lead):** Story 52-4 shipped with several significant deferred items: YAML persistence (PUT endpoint only updates in-memory config), missing route and component tests, and no priority ordering UI. The core engine is solid but the configuration workflow is incomplete. A project manager cannot actually save policy changes to disk and have them survive a restart. This is a functional gap, not a cosmetic one.

**Nova (Architect):** The `request.nextUrl` issue in 52-5's route tests is a recurring pattern — Next.js `Request` objects in test contexts don't have `nextUrl`. This has bitten at least three different stories across multiple epics. We should extract a shared test utility (`makeGetRequest(path)` or similar) that handles URL construction correctly rather than each story discovering this independently.

**Blaze (Dev):** The pre-existing namespace collision with `conflict-resolution.ts` (Epic 50 agent assignment conflicts) required careful naming discipline across all five stories. Every new file had to be named `resource-conflict-*` or `conflict-policy` or `conflict-history` to avoid colliding with the existing 480-line module. This friction is manageable but error-prone — a wrong import from `conflict-resolution.ts` instead of `resource-conflict.ts` would silently use the wrong system.

**Pax (QA):** Story 52-4's test coverage is the thinnest of the five stories — 13 core unit tests with no route or component tests. The policy resolution engine is the most complex logic in the epic (config hierarchy with four tiers, three resolution modes, priority ordering with tiebreakers) and it has the fewest tests. The deferred route/component test items from 52-4 represent a real coverage gap that should be addressed.

---

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Two separate JSONL files (audit vs history) | Different write cadences and query patterns; audit is scan-level, history is resolution-level | Slightly more file management complexity |
| Config-driven agent extraction (not SprintDataMap) | Uses `sharedPool.enabled && resourcePool` from config for agent resources | Snapshot-only; cannot detect in-flight agent conflicts |
| `globalThis` pub/sub broadcaster for SSE | No external dependency; leverages existing 5-second polling loop | Lost on server restart; no persistence |
| Policy source tracking field | Immediate visibility into where each policy originates | Adds a non-standard string field to policy objects |
| Suggestions generated on-the-fly (not stored) | No storage needed; always reflects current conflict state | Cannot track which suggestions were shown/accepted without history |
| Pure sync functions for core logic | Testable without mocks; follows established pattern | Requires I/O adapters for API routes |

---

### Lessons Learned

1. **Namespace collision planning matters** — When adding a new "conflict" system alongside an existing one, establish naming conventions in the story artifact before implementation. The `resource-conflict-*` prefix pattern worked but was discovered reactively during 52-1 implementation.

2. **Deferred YAML write-back compounds** — Story 52-4's missing `writeConfig()` infrastructure means policy changes don't persist. This is a pattern seen in other config-heavy features: the read path works immediately but write-back requires plumbing that doesn't exist yet.

3. **SSE batching with 500ms window prevents flicker** — Story 52-2 reused the `pendingUpdatesRef` / `scheduleFlush` pattern from PortfolioView. Conflicts arriving in rapid succession (e.g., a scan that detects 5 conflicts) get batched into a single state update instead of causing 5 re-renders.

4. **Adversarial code review on dashboard stories** — Story 52-2 had the highest review issue count (7) because dashboard components touch SSE, state management, UI rendering, and API integration simultaneously. Dashboard stories should always get adversarial review.

5. **`request.nextUrl` vs `new URL(request.url)` in tests** — Next.js server route tests with plain `Request` objects must use `new URL(request.url)` for query parameter parsing. Documented multiple times across stories but keeps recurring.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Implement `writeConfig()` in core config module for YAML persistence — Story 52-4 policy PUT endpoint cannot save to disk | Dev | HIGH |
| 2 | Add route and component tests for Story 52-4 policy API endpoints and ConflictPolicyPanel | Dev | HIGH |
| 3 | Extract shared `makeGetRequest(path)` test utility for Next.js route tests to prevent `nextUrl` issues | Dev | MEDIUM |
| 4 | Add priority ordering editor UI to ConflictPolicyPanel (deferred from 52-4 Task 5.4) | Dev | MEDIUM |
| 5 | Consider namespacing or renaming existing `conflict-resolution.ts` to `agent-conflict-resolution.ts` to reduce import confusion | Dev | LOW |
| 6 | Wire conflict detection into session spawn pre-flight for real-time agent conflict detection during assignment | Dev | LOW |

---

### Deferred Items Forward

| Item | Deferred From | Notes |
|------|--------------|-------|
| YAML persistence for policy config updates | Story 52-4 | Requires `writeConfig()` infrastructure in core |
| Priority ordering UI in ConflictPolicyPanel | Story 52-4 | Mode selector exists but no priority list editor |
| Project selector in ConflictPolicyPanel | Story 52-4 | Panel always shows global policies |
| Real-time conflict detection during spawn | Story 52-1 | Requires hook into sessionManager.spawn() pre-flight |
| Agent-level conflict during active assignment | Story 52-1 | Requires session-aware detection during spawn flow |
| External service conflict detection | Story 52-1 | Type defined but no extraction logic (no config schema) |
| CSV export format for conflict history | Story 52-5 | JSON export sufficient for MVP |
| Conflict history SSE real-time updates | Story 52-5 | History view uses manual refresh |

---

### Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5/5 |
| Total new tests | ~213 |
| Stories with 0 review issues | 2 (52-3, 52-4) |
| Stories with adversarial review | 2 (52-2, 52-5) |
| Total review issues found and fixed | ~27 |
| External dependencies added | 0 |
| New core modules | 4 (resource-conflict, suggestions, policy, history) |
| New React components | 12+ |
| New API routes | 7 (conflicts, suggestions, policies, history, export) |
| Files created | ~30 |
| Files modified | ~15 |
| Deferred items | 8 |
| Epic duration | ~4 days |

---

### Dependency Graph

```
Epic 49 (Portfolio) ──┐
Epic 50 (Shared Pool) ──┤
Epic 51 (Dependencies) ──┴──> Story 52-1 (Detection Engine)
                                     │
                                     ├──> Story 52-2 (Dashboard + SSE)
                                     │         │
                                     ├──> Story 52-3 (Suggestions)
                                     │         │
                                     ├──> Story 52-4 (Policy Config)
                                     │         │
                                     └──> Story 52-5 (History Tracking)
                                               │
                                               └──> Completes the loop
```

All five stories built on the 52-1 foundation. Stories 52-2 through 52-5 could theoretically be parallelized after 52-1, though the implementation ran sequentially to carry forward patterns and learnings.

---

## Next Epics Preview

- **Epic 53** (backlog): Sprint Planning Intelligence — sprint velocity tracking, capacity forecasting, story point estimation
- **Epic 54** (backlog): Agent Performance Analytics — agent success rates, time-per-story, model cost tracking

Both epics can leverage the conflict history data from 52-5 for cross-project planning intelligence.
