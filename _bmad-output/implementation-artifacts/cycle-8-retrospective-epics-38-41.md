# Cycle 8 Retrospective (Epics 38-41): Technical Debt Zero

**Date:** 2026-03-22
**Scope:** 4 epics, 18 stories (of 23 total in Cycle 8)
**Remaining:** Epic 42 (6 stories — spec-to-implementation completion)

---

## What Went Well

1. **Per-story code review discipline** — Every single story got an adversarial code review immediately after implementation. 25 review rounds total, catching ~80 issues. This is the highest review-to-story ratio of any cycle.

2. **Security improvements accumulated** — Reviews caught path traversal (38.3 previousLogsPath), information disclosure (38.1 workspacePath, 38.3 server paths in API), error message leaking (40.4 Anthropic API errors), and missing auth documentation (40.1 cascade resume). These were fixed in-place rather than deferred.

3. **Pattern consistency across stories** — The same fix patterns appeared repeatedly and were applied consistently:
   - NaN/negative param guards (38.2, 38.3)
   - Set snapshot iteration (39.1, 39.3, 41.1)
   - AbortController timeouts (40.2, 40.4, 41.1, 41.3)
   - beforeEach mock cleanup (38.1, 38.3, multiple)
   - Shape validation on JSON.parse (38.2, 39.2)

4. **Real data wiring worked cleanly** — Every stub/placeholder was replaced with actual SessionManager, LearningStore, or EventPublisher data. The architecture's plugin-slot design made this straightforward.

5. **Test count growth** — Session added ~120 new tests across all packages:
   - Web: 1,171 tests (+80 from session start)
   - SDK: 22 tests (+12)
   - VS Code: 10 tests (new)
   - GitHub Action: 9 tests (new)
   - CLI: +4 hook tests

## What Could Be Improved

1. **WorkflowPage test fragility** — Adding polling hooks (useSprintCost, useConflictCheckpoint) broke WorkflowPage tests because they count total `fetch()` calls. Had to increment expected counts twice (40.2 and 40.3). A better approach: use `toHaveBeenCalledWith` for specific URLs instead of `toHaveBeenCalledTimes`.

2. **Collaboration store flaky test** — The initial `setTimeout(50)` approach for waiting on async writes was flaky in full-suite runs. Fixed with `writeChain` + `flush()`, but this should have been the design from the start.

3. **EventSource in test environments** — `useCascadeStatus` hook crashed WorkflowPage tests because `EventSource` isn't defined in jsdom. Required a `typeof EventSource === "undefined"` guard. This is a recurring pattern — all browser-only APIs need guards for SSR/test environments.

4. **Epic 42 deferred** — The 6 spec-to-implementation stories (UI components, lint rules, conventions) remain in backlog. These are lower priority but represent the last remaining technical debt items.

## Key Decisions

- **Discriminated unions for event types** (39.1) — `CollaborationEvent` uses a discriminated union instead of loose string combinations. This prevents invalid type+action combinations at compile time.
- **Shared cascade detector via globalThis** (40.1) — The cascade detector is a module-level singleton cached in `globalThis` for HMR resilience, following the same pattern as `services.ts`.
- **Fallback-first LLM integration** (40.4) — Chat endpoint works without API key by returning a helpful configuration message instead of erroring.
- **Inline Node.js hook script** (41.4) — Git hook uses `node -e` with `require()` instead of a non-existent `ao hook` CLI command. Fail-safe: errors in the hook never block commits.

## Metrics

| Metric | Value |
|--------|-------|
| Stories shipped | 18 |
| New tests added | ~120 |
| Code review rounds | 25 |
| Issues found in reviews | ~80 |
| Issues fixed | ~80 (100%) |
| Commits | 27 |
| Build | Green |
| Typecheck | Clean |

## Action Items for Epic 42

1. **Fix WorkflowPage test pattern** — Refactor to use URL-based assertions instead of call counts
2. **Add EventSource guard pattern to coding standards** — All browser-only APIs need `typeof` checks
3. **Consider shared SSE context** — Multiple hooks create separate EventSource connections; a React context could share one
4. **Checkpoint timeline git log** — Deferred from 40.3; implement `execFile("git", ["log"])` on worktrees when ready

---

**Session summary:** This was the most disciplined development session — every story got implemented, reviewed, and fixed in a tight loop. The per-story review pattern caught issues early and established consistent patterns across the codebase. The technical debt backlog is 94.9% cleared (192/198 stories done) with only Epic 42's 6 spec-only stories remaining.
