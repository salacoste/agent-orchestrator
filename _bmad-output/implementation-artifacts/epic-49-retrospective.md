# Epic 49 Retrospective — Portfolio Dashboard

**Date**: 2026-03-27
**Epic**: 49 — Portfolio Dashboard
**Status**: Complete (all 5 stories done)
**Cycle**: 10
**Source**: epics-cycle-10.md

## Epic Summary

Epic 49 delivered the portfolio dashboard -- a multi-project view that gives project managers a single page to monitor all configured projects, their agent activity, sprint health, and real-time status changes. The epic established the foundational page structure (49-1), layered in aggregated metrics with sprint health scoring (49-2), added drill-down navigation to individual project dashboards (49-3), replaced full-page refreshes with granular SSE updates and change highlighting (49-4), and capped it off with multi-dimensional filtering by status, tags, and custom metadata (49-5).

The portfolio dashboard is the primary multi-project interface in the system. It transforms the orchestrator from a single-project tool into a portfolio management surface.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 49-1 | Portfolio Dashboard Page Structure | 1413 (web package) | 3H+3M (R1), all fixed | Done |
| 49-2 | Aggregated Metrics Widget | 36 (new) | 0 (clean after 49-1 fixes) | Done |
| 49-3 | Project Drill-Down Navigation | 1471 (web package) | 2H+3M+1L, all fixed | Done |
| 49-4 | Real-Time SSE Updates | 6 new test cases | 3H+3M (stale closure, degradation, types) | Done |
| 49-5 | Project Filtering | 25+18+21 (new) | 1H+2M+1L, all fixed | Done |

**Total new tests**: ~120+ (portfolio-specific across web package)
**New files created**: 15 (components, utilities, tests, route pages)
**Modified files**: ~12 (types, navigation, existing components)
**External dependencies added**: 0
**Code reviews**: 5 reviews, ~20 issues caught and fixed

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** The portfolio dashboard is the first truly multi-project interface we have built. Before Epic 49, users had to switch contexts between projects manually. Now they see everything at a glance -- agent counts, story breakdowns, sprint health, and resource utilization -- all on one page with real-time updates. The drill-down navigation (49-3) was the right call: reuse the existing Dashboard component filtered by projectId instead of building a new project detail page from scratch. That decision saved an entire story's worth of design and testing.

**Nova (Architect):** Three architectural choices paid off significantly:

1. **Server components for aggregation, client components for interactivity** -- The `portfolio/page.tsx` server component does all data fetching and aggregation via `getServices()`, passing pre-computed `PortfolioProject[]` to the client. This means the client never calls services directly, keeping the boundary clean. The responsive grid, filtering, and SSE updates all happen client-side where they belong.

2. **SSE evolution across stories** -- Story 49.2 introduced SSE with `router.refresh()` (full page re-render). Story 49.4 replaced it with granular `setProjects()` state updates using a `projectsRef` to avoid stale closures. The `pendingUpdatesRef` batching pattern (500ms window) prevents UI jank from rapid events. This two-story progression let the first version ship fast, then optimize once the pattern was proven.

3. **Filter utilities as pure functions** -- `portfolio-filter.ts` exports `filterProjects()` as a pure function with AND logic across status, tags, and metadata dimensions. No React dependencies, no state, no side effects. This made it trivially testable (21 tests) and reusable if we ever add server-side filtering.

**Blaze (Dev):** The biggest win was extracting `enrich-project-sessions.ts` as a shared utility in 49-3. The project detail page and the portfolio aggregation both need to enrich session data with PR information. Extracting it eliminated the duplication before it could spread. Also, the conditional `role` attribute on ProjectCard (`role={onClick ? "button" : "listitem"}`) is a small detail that shows accessibility was baked in, not bolted on.

**Pax (QA):** 49-1's code review caught a critical issue: story count aggregation was returning hardcoded zeros because `portfolio-aggregation.ts` never actually read sprint-status.yaml. That was fixed before moving to 49-2, which means all subsequent metrics and filtering built on a correct foundation. The 49-4 review caught a stale closure bug in `processSnapshot` that would have caused silent data loss in production -- the `projectsRef` pattern fixed it. These are the kinds of bugs that reviews are supposed to catch, and they did.

---

### What Could Be Improved

**R2d2 (Project Lead):** Story 49-1 went to code review with three HIGH-severity issues: story counts always zero (unimplemented aggregation), silent error swallowing in the page component, and empty grid not handling the zero-projects case. All six review items were valid. The story should not have been marked "review" with that many foundational gaps. The "done" checklist in the story file had all boxes checked, but the implementation did not match.

**Nova (Architect):** The `PortfolioMetrics` type grew across three stories without a cohesive design pass. Story 49-1 added `PortfolioProject`. Story 49-2 added `PortfolioMetrics`. Story 49-4 added `lastUpdated?: number` to `PortfolioProject`. Story 49-5 added `tags` and `metadata`. Each addition was correct in isolation, but the final `PortfolioProject` interface has fields from four different stories with no single design document describing the complete shape. A type-design note at the start of the epic would have helped.

**Blaze (Dev):** The Next.js App Router page export restriction in 49-5 caught us off guard. Extracting `ProjectNotFound`, `ProjectBreadcrumb`, and `ProjectHeader` into a separate `ProjectDetailComponents.tsx` file was the right fix, but it should have been done in 49-3 when those components were first created. The page file was already too large with inline component definitions.

**Pax (QA):** Story 49-4's deferred item -- partial session data in SSE events -- means the granular update path can only update the `lastUpdated` timestamp, not the actual metrics (agent counts, story counts). For real metric updates, the code falls back to `router.refresh()`. This is documented but it means the "granular SSE" story is really "granular highlighting + periodic full refresh." The limitation should be clearer in the AC status.

---

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project detail page content | Filtered dashboard (reuse Dashboard component) | Mental model consistency -- users already know the dashboard. No new UI patterns needed. |
| SSE update strategy | Granular `setProjects()` with `projectsRef` | Avoids full page re-render. Only affected card re-renders. Batching prevents jank. |
| Filtering implementation | Client-side with `useMemo` | No server round-trip for 50 projects. Pure functions for testability. |
| Sprint health formula | `(done/total)*100 - blocked*5`, clamped [0,100] | Simple, interpretable. Blocked stories penalize score. Zero edge case: empty sprint = 0. |
| Filter logic | AND across dimensions | Most restrictive -- all conditions must match. Predictable for users. |
| Error state for invalid project | Inline error with back link | Shows context (why it failed) instead of silent redirect. |
| Hover effect on cards | `hover:-translate-y-0.5 hover:shadow-md` | Lift effect gives clear click affordance beyond color change. |
| Connection status indicator | Hidden when connected, shown when reconnecting | Non-intrusive by default. Only appears when there is a problem. |

---

### Lessons Learned

1. **Aggregation functions must have tests before code review.** 49-1's story count aggregation returned zeros because the implementation was stubbed. Unit tests for `portfolio-aggregation.ts` would have caught this immediately. The fix was straightforward (read sprint-status.yaml, count by status), but the review had to find it.

2. **SSE stale closures are a systematic risk.** The `processSnapshot` function in 49-4 captured the `projects` state variable in its closure. When projects updated, the closure still referenced the old array. The `projectsRef` pattern (read `.current` at call time) is now the standard for any SSE handler that reads component state. Document this in CLAUDE.md for future SSE work.

3. **Conditional ARIA roles improve accessibility.** `ProjectCard` uses `role={onClick ? "button" : "listitem"}` so it announces correctly whether or not navigation is available. This pattern should be applied to all interactive list items.

4. **Extract shared utilities early.** `enrich-project-sessions.ts` was extracted in 49-3 when the project detail page needed the same enrichment as the portfolio page. If it had been a standalone utility from 49-1, the extraction step would not have been needed.

5. **Batch updates with `useRef`, not `useState`.** The `pendingUpdatesRef` pattern in 49-4 uses `useRef<Map>` to accumulate updates and flush them via a single `setProjects()` call. Using `useState` for the pending map would trigger re-renders on every accumulation, defeating the purpose of batching.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Add SSE stale closure pattern (`projectsRef`) to CLAUDE.md as a standard pattern | Dev | HIGH |
| 2 | Pre-check aggregation functions have unit tests before marking stories as review-ready | Dev | HIGH |
| 3 | Design complete type shapes at epic start -- write a type-design note for `PortfolioProject`-like interfaces before first story | Architect | MEDIUM |
| 4 | Extract inline page components into separate files at creation time (avoid large page.tsx files) | Dev | MEDIUM |
| 5 | Enhance SSE event payloads with full session data to enable true granular metric updates (remove `router.refresh()` fallback) | Dev | LOW |
| 6 | Add E2E test for full portfolio drill-down flow (49-3 task 5.9, marked optional, never done) | QA | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5 |
| Stories with 0 review issues | 1 (49-2) |
| Stories requiring review fixes | 4 |
| Total review issues found | ~20 |
| Total new tests | ~120+ |
| External dependencies added | 0 |
| New files created | 15 |
| Files modified | ~12 |
| Deferred items | 1 (E2E test for drill-down) |
| Sprint health score at completion | N/A (portfolio health is now visible via the dashboard itself) |
