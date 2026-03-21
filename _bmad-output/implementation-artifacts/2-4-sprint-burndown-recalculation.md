# Story 2.4: Sprint Burndown Recalculation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Product Manager,
I want the sprint burndown to automatically recalculate when stories complete,
so that I always see accurate progress without manual updates.

## Acceptance Criteria

1. **AC1 — Event-driven burndown update:** Story completion events (`story.completed`) trigger burndown data recalculation. The burndown service subscribes to EventBus and recomputes within 2 seconds of event receipt.

2. **AC2 — Burndown data model:** Burndown data includes: remaining stories (and optionally points) by day, ideal burndown line (linear decline from sprint start to end), and actual burndown line (cumulative stories completed per day).

3. **AC3 — Recalculation SLA:** Burndown data is recalculated within 2 seconds of a `story.completed` event (NFR-P2). Calculation is synchronous after event receipt — no deferred batching.

4. **AC4 — Event subscription integration:** The burndown service subscribes to `story.completed` events published by Story 2.2's EventPublisher infrastructure. Uses the same in-memory EventBus wiring pattern as the dependency resolver (Story 2.3).

5. **AC5 — Downstream data availability:** Burndown data is available for both CLI consumers (Epic 5: `ao burndown`) and Dashboard consumers (Epic 7: BurndownChart component) via a typed interface. No manual refresh required — callers get fresh data on each access.

6. **AC6 — Sprint configuration support:** Burndown ideal line calculation uses sprint start/end dates from tracker configuration when available. Falls back to first-story-started / last-story-done dates when sprint dates are not configured.

7. **AC7 — Graceful degradation:** If event subscription, burndown calculation, or sprint-status.yaml read fails, the system logs the error and continues without crashing. Burndown recalculation is non-fatal — the rest of the orchestrator continues working.

8. **AC8 — Points and story count support:** Burndown supports both story count mode (always available) and story points mode (when `priorities` map in sprint-status.yaml contains point values). Consumers can request either metric.

## Tasks / Subtasks

- [x] Task 1: Create BurndownService in core (AC: #1, #2, #3, #6, #7, #8)
  - [x] 1.1 Create `packages/core/src/burndown-service.ts` with factory function `createBurndownService(config)`
  - [x] 1.2 Define `BurndownData` and `BurndownResult` interfaces (daily data points, ideal line, actual line, sprint dates)
  - [x] 1.3 Implement `calculateBurndown(sprintData)` — compute remaining/completed per day from development_status
  - [x] 1.4 Implement ideal burndown line (linear interpolation from totalStories at start to 0 at end)
  - [x] 1.5 Support both story count and story points modes (AC #8)
  - [x] 1.6 Implement `onStoryCompleted(event)` handler that triggers recalculation
  - [x] 1.7 Cache result in memory for fast access by downstream consumers
  - [x] 1.8 Wrap all operations in try/catch for graceful degradation (AC #7)
- [x] Task 2: Wire event subscription (AC: #1, #4)
  - [x] 2.1 Subscribe to `story.completed` events in `wire-detection.ts` (same pattern as dependency resolver)
  - [x] 2.2 Create and pass BurndownService to event handler
  - [x] 2.3 Log burndown recalculation events to console (non-blocking)
- [x] Task 3: Export and integrate (AC: #5)
  - [x] 3.1 Export `createBurndownService`, `BurndownData`, `BurndownResult`, `BurndownServiceConfig` from `packages/core/src/index.ts`
  - [x] 3.2 Add `getBurndownResult()` accessor method for downstream consumers (CLI/Dashboard)
  - [x] 3.3 Verify types are available for tracker-bmad plugin and web API consumers
- [x] Task 4: Comprehensive tests (AC: #1-#8)
  - [x] 4.1 Unit test: burndown calculation with known story data (3 stories, deterministic completion dates)
  - [x] 4.2 Unit test: ideal burndown line calculation (linear decline from total to 0)
  - [x] 4.3 Unit test: event-driven recalculation — story.completed fires → burndown updated
  - [x] 4.4 Unit test: graceful degradation — missing YAML, malformed data → no crash
  - [x] 4.5 Unit test: story points mode vs count mode
  - [x] 4.6 Unit test: sprint date configuration (explicit dates vs inferred dates)
  - [x] 4.7 Unit test: empty sprint (no stories) returns valid empty result

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

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] No sprint-status.yaml limitations to add

**Methods Used:**
- [x] `EventBus.subscribe(callback)` — `core/src/types.ts` (subscribe to story.completed events in wire-detection.ts)
- [x] `EventPublisher.publishStoryCompleted()` — consumed (published by Story 2.2 completion handlers)
- [x] `loadSprintStatus(projectPath)` — internal helper in burndown-service.ts, reads sprint-status.yaml
- [ ] `logAuditEvent()` — NOT USED: burndown service does not log audit events (not required by ACs)
- [ ] `StateManager.getAll()` — NOT USED: reads sprint-status.yaml directly (simpler, no StateManager dependency)

**Feature Flags:**
- [x] No new feature flags needed — all required interfaces exist from Stories 2.1-2.3

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dev Notes

### Critical Architecture & Implementation Context

**EXISTING CODE TO REUSE — DO NOT REINVENT:**

1. **`dependency-resolver.ts`** (Story 2.3) — EXACT pattern to follow:
   - Factory function `createDependencyResolver(config)` returning service interface
   - `onStoryCompleted(event)` handler pattern — subscribes to EventBusEvent
   - Internal `loadSprintStatus(projectPath)` helper to read sprint-status.yaml
   - Try/catch wrapping for graceful degradation
   - Wired in `wire-detection.ts` via `eventBus.subscribe()`
   - **Copy this pattern exactly for the burndown service**

2. **`tracker-bmad/src/forecast.ts`** — Burndown calculation reference:
   - `computeForecast(project)` → `SprintForecast` with velocity, pace, projectedCompletionDate
   - Uses linear regression on cumulative completions by day
   - Reads history entries from tracker plugin
   - **Burndown calculation is simpler — just remaining = total - cumDone per day**

3. **`tracker-bmad/src/throughput.ts`** — Throughput pattern reference:
   - `computeThroughput(project)` → `ThroughputResult` with daily/weekly aggregations
   - Reads history entries for status transitions
   - Groups by date for aggregation
   - **Follow this pattern for daily burndown data point calculation**

4. **`web/src/app/api/sprint/[project]/velocity/route.ts`** — Existing velocity API:
   - Already calculates daily completions from history
   - Deduplicates stories that bounce (done → reopened → done)
   - Returns `{ dailyCompletions: [{date, count, points}], totalStories, doneCount }`
   - **Burndown service should provide data that this API can also consume**

5. **`web/src/components/BurndownChart.tsx`** — Existing burndown UI:
   - Already renders burndown visualization (755 lines)
   - Fetches from `/api/sprint/[project]/velocity` endpoint
   - Renders ideal line, forecast regression, Monte Carlo markers
   - **This component is the downstream consumer — the core service feeds it**

**KEY INSIGHT: The burndown calculation is NOT complex. The main work is:**
- Creating a core service that reads sprint-status.yaml and computes remaining/completed counts
- Subscribing to story.completed events to trigger recalculation
- Caching the result for fast access by API/CLI consumers
- The web BurndownChart component already exists and works

### Burndown Calculation Algorithm

```
Input: development_status from sprint-status.yaml
       priorities (optional, for story points)
       sprint start/end dates (from tracker config or inferred)

1. Count total stories (all non-epic, non-retro keys)
2. Count done stories (status === "done")
3. Remaining = total - done
4. Ideal line: linear interpolation from total at sprintStart to 0 at sprintEnd
5. Actual line: plot remaining at each day based on when stories were completed
6. Completion percentage: done / total * 100

Output: BurndownResult {
  totalStories, completedStories, remainingStories
  completionPercentage
  sprintStart, sprintEnd (dates)
  idealBurndown: [{day, remaining}] — perfect linear decline
  actualBurndown: [{day, remaining}] — real remaining per day
  currentPace: "ahead" | "on-pace" | "behind"
  totalPoints?, completedPoints?, remainingPoints? (if points available)
}
```

### Service Interface Design

```typescript
export interface BurndownServiceConfig {
  projectPath: string;
  auditDir: string;
  sprintStartDate?: string; // ISO date, optional
  sprintEndDate?: string;   // ISO date, optional
}

export interface BurndownData {
  date: string;           // ISO date (YYYY-MM-DD)
  remaining: number;      // Stories remaining
  completed: number;      // Cumulative completed
  idealRemaining: number; // Ideal burndown value for this day
}

export interface BurndownResult {
  totalStories: number;
  completedStories: number;
  remainingStories: number;
  completionPercentage: number;
  sprintStart: string | null;  // ISO date
  sprintEnd: string | null;    // ISO date
  dailyData: BurndownData[];
  currentPace: "ahead" | "on-pace" | "behind" | "no-data";
  // Optional story points
  totalPoints?: number;
  completedPoints?: number;
  remainingPoints?: number;
  lastUpdated: string; // ISO timestamp
}

export interface BurndownService {
  /** Recalculate burndown from current sprint state */
  recalculate(): BurndownResult;
  /** Handle a story.completed event (triggers recalculate) */
  onStoryCompleted(event: EventBusEvent): Promise<void>;
  /** Get the latest cached burndown result */
  getResult(): BurndownResult;
}
```

### File Location Conventions

All core services are flat in `packages/core/src/` — NOT in a `services/` subdirectory:
- `packages/core/src/burndown-service.ts` — service implementation
- `packages/core/src/__tests__/burndown-service.test.ts` — tests

### sprint-status.yaml Data Shape

The burndown service reads these fields from sprint-status.yaml:
```yaml
development_status:
  1-1-story-name: done
  1-2-story-name: in-progress
  1-3-story-name: backlog
  # ... etc

priorities:              # Optional — for story points mode
  1-1-story-name: 3
  1-2-story-name: 5
  1-3-story-name: 2
```

Use the `story_dependencies` / `dependencies` dual-key pattern from Story 2.3 if needed, but burndown only needs `development_status` and optionally `priorities`.

### Wiring Pattern (from Story 2.3)

In `wire-detection.ts`, the burndown service is wired the same way as the dependency resolver:
```typescript
// After eventBus and eventPublisher are created...
try {
  const burndownService = createBurndownService({
    projectPath,
    auditDir,
  });

  await eventBus.subscribe((event: EventBusEvent) => {
    if (event.eventType === "story.completed") {
      void burndownService.onStoryCompleted(event).then(() => {
        const result = burndownService.getResult();
        console.log(chalk.dim(`  ↳ Burndown: ${result.completedStories}/${result.totalStories} stories done (${result.completionPercentage.toFixed(0)}%)`));
      });
    }
  });
} catch (err) {
  console.log(chalk.dim(`  ⚠ Burndown service setup skipped: ${err instanceof Error ? err.message : String(err)}`));
}
```

### Testing Standards

- Use vitest with `describe`/`it`/`expect`
- Mock sprint-status.yaml with `mkdtempSync` temp directories (same pattern as dependency-resolver.test.ts)
- Test with deterministic data — known story counts and completion dates
- Test both story count mode and story points mode
- Test graceful degradation — missing YAML, malformed data
- Add `_resetForTesting()` to any singletons (per project-context.md)

### Non-Fatal Pattern (CRITICAL)

ALL burndown operations must be wrapped in try/catch. Follow the pattern from `dependency-resolver.ts`:
```typescript
try {
  // Calculate burndown
} catch (err) {
  console.error(`[burndown-service] Burndown recalculation failed:`, err);
  // Continue — burndown is an enhancement, not critical path
}
```

### TypeScript Conventions (from CLAUDE.md)

- ESM modules with `.js` extensions in imports
- `node:` prefix for builtins
- `type` imports for type-only usage
- `execFile` never `exec` for shell commands
- Semicolons, double quotes, 2-space indent

### Project Structure Notes

- New service goes in `packages/core/src/burndown-service.ts`
- New tests go in `packages/core/src/__tests__/burndown-service.test.ts`
- Types defined in burndown-service.ts (co-located, not in types.ts — keeps types.ts from growing further)
- Wire into `packages/cli/src/lib/wire-detection.ts`
- Export from `packages/core/src/index.ts`

### Limitations (Deferred Items)

1. **Web API burndown endpoint**
   - Status: Deferred — Epic 7 (Dashboard Monitoring)
   - Requires: Dashboard stories for API route + component integration
   - Current: Core service provides typed interface; web API route NOT created in this story
   - Epic: Story 7-3 (Sprint Burndown Chart & Analytics Dashboard)

2. **CLI burndown command**
   - Status: Deferred — Epic 5 (CLI Sprint Management)
   - Requires: CLI story for `ao burndown` command
   - Current: Core service provides typed interface; CLI command NOT created in this story
   - Epic: Story 5-2 (ao burndown — Sprint Analytics CLI)

3. **History-based daily burndown (time series)**
   - Status: Deferred — requires JSONL history entries for day-by-day tracking
   - Requires: History recording infrastructure (already exists in tracker-bmad)
   - Current: Story calculates current-state burndown (snapshot), not historical time-series
   - The tracker-bmad velocity/forecast endpoints already do historical analysis from JSONL

### References

- [Source: packages/core/src/dependency-resolver.ts — pattern to follow for event-driven service]
- [Source: packages/plugins/tracker-bmad/src/forecast.ts — velocity/pace calculation reference]
- [Source: packages/plugins/tracker-bmad/src/throughput.ts — daily aggregation pattern reference]
- [Source: packages/web/src/app/api/sprint/[project]/velocity/route.ts — existing velocity API, downstream consumer]
- [Source: packages/web/src/components/BurndownChart.tsx — existing burndown UI component, downstream consumer]
- [Source: packages/cli/src/lib/wire-detection.ts — event wiring pattern for CLI commands]
- [Source: packages/core/src/types.ts#EventBus — event subscription interface]
- [Source: packages/core/src/types.ts#StoryCompletedEvent — event shape]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4 — requirements FR12, FR15]
- [Source: _bmad-output/implementation-artifacts/2-3-dependency-resolution-story-unblocking.md — previous story learnings]
- [Source: _bmad-output/project-context.md — singleton _resetForTesting(), Promise.allSettled(), non-fatal patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Build: `pnpm build` — all packages pass
- Typecheck: `pnpm typecheck` — all packages pass
- Tests: all tests pass including 29 burndown-service tests
- Lint: 0 errors (1 pre-existing warning in web package)

### Completion Notes List

- Followed exact same factory function pattern as `createDependencyResolver` from Story 2-3
- Types co-located in `burndown-service.ts` (not types.ts) to avoid bloat, per story spec
- Used direct `EventBus.subscribe()` in wire-detection.ts (same as dependency resolver)
- Burndown is snapshot-based (current state from YAML), not historical time-series (deferred)
- `getResult()` returns cached result for fast access; `recalculate()` re-reads YAML
- `isStoryKey()` regex excludes epic- prefixed and retrospective entries from story counts
- Story points mode activates automatically when `priorities` map has numeric values

### Code Review Fixes Applied

- **MEDIUM-1**: Replaced module-level `EMPTY_RESULT` constant (stale `lastUpdated` at load time) with `emptyResult()` factory function that generates fresh timestamps
- **MEDIUM-2**: Removed unused `auditDir` from `BurndownServiceConfig` interface — was accepted but never referenced
- **LOW-1**: Added missing "behind" pace test (sprint ended with incomplete stories)
- **LOW-2**: Added missing "on-pace" pace test (sprint hasn't started yet)
- **LOW-3 (DST)**: Accepted as-is — UTC conversion via `toISOString()` mitigates DST edge cases
- **MEDIUM-3 (flat actual line)**: Accepted as documented limitation — snapshot-based, not historical time-series

### File List

- `packages/core/src/burndown-service.ts` — NEW: BurndownService factory with interfaces, calculation, caching
- `packages/core/src/__tests__/burndown-service.test.ts` — NEW: 29 tests covering all ACs
- `packages/core/src/index.ts` — MODIFIED: added exports for burndown-service module
- `packages/cli/src/lib/wire-detection.ts` — MODIFIED: wired burndown service subscription to story.completed events
