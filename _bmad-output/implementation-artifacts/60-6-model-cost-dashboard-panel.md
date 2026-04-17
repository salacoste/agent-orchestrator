# Story 60.6: Model Cost Dashboard Panel

Status: done

## Story

As a developer using the dashboard,
I want a panel in the session detail view that shows model cost breakdown by tier,
so that I can see how much each model tier (low/medium/high) costs per session and compare across dimensions.

## Acceptance Criteria

1. **AC1 — `useCostData` hook**: A new custom hook at `packages/web/src/hooks/useCostData.ts` that:
   - Accepts no parameters (session-level cost fetched from summary dimension)
   - Returns `{ summary: CostSummary | null; loading: boolean; error: string | null }`
   - Fetches `GET /api/costs/breakdown?dimension=summary` on mount
   - Re-fetches every 30 seconds (polling, matches `useSprintCost` pattern)
   - Uses AbortController for in-flight request cancellation
   - Silently retains previous data on fetch failure
   - Cleans up interval and abort controller on unmount

2. **AC2 — `CostBreakdownPanel` component**: A new `"use client"` component at `packages/web/src/components/CostBreakdownPanel.tsx` that:
   - Uses `useCostData()` hook for all data fetching
   - Renders a card shell matching the established dashboard panel pattern
   - Shows the section header "Model Cost" with `ActivityDot` connection indicator

3. **AC3 — Summary metrics display**: The component displays the summary view:
   - Total tokens (formatted with locale string: `toLocaleString()`)
   - Total estimated cost in USD (formatted as `$X.XX`)
   - Per-tier breakdown: three rows showing tier name, tokens, cost, and session count
   - Each tier row uses a color-coded indicator: low = green (`var(--color-status-ready)`), medium = amber (`var(--color-status-attention)`), high = red/accent (`var(--color-status-error)`)

4. **AC4 — Per-tier bar visualization**: Each tier row includes a proportional bar:
   - Bar width proportional to that tier's token count relative to total
   - Bar uses the tier's color
   - Zero-width bar renders as 1px minimum so the row isn't empty
   - Bars use `transition: width 300ms ease` for smooth updates

5. **AC5 — Empty state**: When summary data is null (no data available):
   - Shows the card shell with header and empty state message "No cost data available."
   - Uses the established empty state pattern: `text-[12px] text-[var(--color-text-secondary)]`

6. **AC6 — Loading state**: When `loading === true` and no prior data exists:
   - Shows the card shell with header and loading text "Loading cost data..."
   - Once data arrives, replaces loading text with the summary display
   - If data exists from a previous fetch, shows that data even while loading (no flicker)

7. **AC7 — Integration in SessionDetail**: The `CostBreakdownPanel` is rendered in `packages/web/src/components/SessionDetail.tsx`:
   - Conditionally rendered when `session.workspacePath` exists (same pattern as NotepadViewer/TimelineViewer)
   - Placed below the TimelineViewer

8. **AC8 — Unit tests for `useCostData` hook**: Comprehensive vitest tests covering:
   - Returns null summary initially
   - Fetches summary on mount and updates state
   - Sets loading to false after successful fetch
   - Retains previous data on fetch failure
   - Clears interval and abort controller on unmount
   - Re-fetches on 30-second interval

9. **AC9 — Unit tests for `CostBreakdownPanel` component**: Comprehensive vitest tests covering:
   - Renders summary data when available
   - Shows empty state when no data
   - Shows loading state when loading with no prior data
   - Shows existing data during re-fetch (no flicker)
   - Displays all tier rows with correct colors
   - Formats cost as USD string
   - Formats tokens with locale string
   - Passes correct props to ActivityDot

10. **AC10 — No new dependencies**: Uses only existing dependencies (React, no external chart libraries).

## Tasks / Subtasks

- [x] Task 1: Create `useCostData` hook (AC: #1)
  - [x] 1.1 Create `packages/web/src/hooks/useCostData.ts`
  - [x] 1.2 Implement fetch to `GET /api/costs/breakdown?dimension=summary`
  - [x] 1.3 Implement 30-second polling with `setInterval`
  - [x] 1.4 Implement AbortController for in-flight cancellation
  - [x] 1.5 Implement mounted guard for cleanup
  - [x] 1.6 Retain previous data on fetch failure

- [x] Task 2: Create `CostBreakdownPanel` component (AC: #2, #3, #4, #5, #6)
  - [x] 2.1 Create `packages/web/src/components/CostBreakdownPanel.tsx` with `"use client"` directive
  - [x] 2.2 Implement card shell with header and ActivityDot
  - [x] 2.3 Implement summary metrics (total tokens, total cost)
  - [x] 2.4 Implement per-tier rows with color indicators and proportional bars
  - [x] 2.5 Implement empty state ("No cost data available.")
  - [x] 2.6 Implement loading state ("Loading cost data...")
  - [x] 2.7 Format cost as `$X.XX` and tokens with `toLocaleString()`

- [x] Task 3: Integrate in SessionDetail (AC: #7)
  - [x] 3.1 Add `CostBreakdownPanel` import to `packages/web/src/components/SessionDetail.tsx`
  - [x] 3.2 Render `<CostBreakdownPanel />` conditionally on `session.workspacePath`, below TimelineViewer

- [x] Task 4: Unit tests — hook (AC: #8)
  - [x] 4.1 Create `packages/web/src/hooks/__tests__/useCostData.test.ts`
  - [x] 4.2 Test initial null state and loading flag
  - [x] 4.3 Test successful fetch updates state
  - [x] 4.4 Test retains previous data on failure
  - [x] 4.5 Test cleanup (clearInterval, abort controller)
  - [x] 4.6 Test 30-second re-fetch interval

- [x] Task 5: Unit tests — component (AC: #9)
  - [x] 5.1 Create `packages/web/src/components/__tests__/CostBreakdownPanel.test.tsx`
  - [x] 5.2 Test renders summary data when available
  - [x] 5.3 Test shows empty state when no data
  - [x] 5.4 Test shows loading state
  - [x] 5.5 Test shows existing data during re-fetch
  - [x] 5.6 Test displays tier rows with correct colors
  - [x] 5.7 Test formats cost as USD
  - [x] 5.8 Test formats tokens with locale

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

SSE real-time cost updates deferred. The API route (Story 60-5) provides REST-only snapshot data. A polling hook (30s interval) provides near-real-time updates. An SSE endpoint can be added later if sub-second cost monitoring is needed.

Drill-down navigation (sprint → project → story → session) deferred. Initial implementation shows summary-level cost data only. The dimension-based API from Story 60-5 supports drill-down queries, but the component will only consume the summary dimension initially.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `GET /api/costs/breakdown?dimension=summary` — REST endpoint from Story 60-5 (already validated)
- [x] `useCostData()` — NEW hook added by this story (polling, no interface dependency)

**Feature Flags:**
- None. The API endpoint is already built and tested in Story 60-5.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing React and fetch API.

## Dev Notes

### Architecture Context

This story is the sixth in Epic 60 (Dashboard Intelligence). It creates the frontend component that consumes the model cost API route built in Story 60-5. Unlike NotepadViewer and TimelineViewer (which use SSE for real-time updates), this component uses a **polling hook** because:

1. The cost API route (Story 60-5) is REST-only — no SSE endpoint exists
2. Cost data changes infrequently (only on session completion/failure)
3. A 30-second polling interval provides adequate freshness without SSE complexity
4. The existing `useSprintCost` hook (Epic 21/40) already established the polling pattern

### Data Flow

```
Session Completion → captureModelUsage() → ModelUsageAggregator.recordUsage()
                                                    ↓
                          ModelUsageAggregator JSONL (audit/model-usage.jsonl)
                                                    ↓
                          GET /api/costs/breakdown?dimension=summary  (Story 60-5)
                                                    ↓
                          useCostData hook → CostBreakdownPanel component
```

### API Endpoint Consumed

**REST** — `GET /api/costs/breakdown?dimension=summary`
- Response shape:
```json
{
  "dimension": "summary",
  "totalTokens": 150000,
  "totalCost": 0.45,
  "byTier": {
    "low": { "tokens": 10000, "cost": 0.01, "sessions": 2 },
    "medium": { "tokens": 100000, "cost": 0.30, "sessions": 5 },
    "high": { "tokens": 40000, "cost": 0.14, "sessions": 1 }
  }
}
```
- Has `Cache-Control: no-cache, no-store, must-revalidate` headers
- Has `export const dynamic = "force-dynamic"` — never cached by Next.js

### Component Type Reference

```typescript
// Internal types for the component (derived from API response)
interface CostSummary {
  dimension: "summary";
  totalTokens: number;
  totalCost: number;
  byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
}

type ModelTier = "low" | "medium" | "high";

const TIER_COLORS: Record<ModelTier, string> = {
  low: "var(--color-status-ready)",      // green
  medium: "var(--color-status-attention)", // amber
  high: "var(--color-status-error)",      // red
};

const TIER_LABELS: Record<ModelTier, string> = {
  low: "Haiku",
  medium: "Sonnet",
  high: "Opus",
};
```

### Hook Pattern — Follow useSprintCost Exactly

The hook MUST follow the `useSprintCost` polling pattern:

```typescript
export function useCostData() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchSummary() {
      if (!mountedRef.current) return;
      // Abort previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/costs/breakdown?dimension=summary", {
          signal: controller.signal,
        });
        if (!mountedRef.current) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mountedRef.current) return;
        setSummary(data);
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Retain previous data on failure — don't null out summary
        setError("Failed to fetch cost data");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchSummary();
    const interval = setInterval(fetchSummary, 30_000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, []);

  return { summary, loading, error };
}
```

### Component Pattern — Follow NotepadViewer/TimelineViewer Card Shell

```tsx
"use client";

import { useCostData } from "@/hooks/useCostData";
import { ActivityDot } from "./ActivityDot";

export function CostBreakdownPanel() {
  const { summary, loading } = useCostData();

  return (
    <div className="detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6">
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        Model Cost
        <ActivityDot activity={summary ? "active" : "idle"} dotOnly size={6} />
      </h2>

      {/* Content area */}
    </div>
  );
}
```

### SessionDetail Integration Point

In `packages/web/src/components/SessionDetail.tsx`, add after the TimelineViewer:

```tsx
{session.workspacePath && <NotepadViewer sessionId={session.id} />}
{session.workspacePath && <TimelineViewer sessionId={session.id} />}
{session.workspacePath && <CostBreakdownPanel />}
```

Note: `CostBreakdownPanel` does NOT receive `sessionId` — it fetches the global summary. Per-session cost drill-down is deferred.

### Tier Row Rendering Pattern

Each tier row should show: color dot + tier label + token count + cost + proportional bar.

```tsx
function TierRow({ tier, tokens, cost, sessions, totalTokens }: TierRowProps) {
  const barWidth = totalTokens > 0 ? Math.max(1, (tokens / totalTokens) * 100) : 1;
  const color = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Color dot */}
      <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
      {/* Tier label */}
      <span className="text-[12px] font-medium text-[var(--color-text-primary)] w-16">{label}</span>
      {/* Token count */}
      <span className="text-[11px] text-[var(--color-text-secondary)] w-24 text-right font-[var(--font-mono)]">
        {tokens.toLocaleString()}
      </span>
      {/* Cost */}
      <span className="text-[11px] text-[var(--color-text-secondary)] w-16 text-right">
        ${cost.toFixed(2)}
      </span>
      {/* Proportional bar */}
      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${barWidth}%`,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
      {/* Session count */}
      <span className="text-[10px] text-[var(--color-text-tertiary)] w-8 text-right">
        {sessions}s
      </span>
    </div>
  );
}
```

### Testing Standards

- **Framework**: vitest + React Testing Library
- **Hook tests**: Follow `useSprintCost.test.ts` pattern — mock fetch, simulate responses
- **Component tests**: Follow `NotepadViewer.test.tsx` pattern — mock the hook, test rendering
- **Mock pattern**: Use `vi.fn()` at module scope + `vi.mock()` for the hook
- **No `expect(true).toBe(true)`** — all assertions must verify real behavior
- **Run command**: `npx vitest run` in packages/web

### Import Conventions (MUST follow)

- **Package imports**: `import type { ... } from "@composio/ao-core"` — NO `.js` extension
- **Local imports**: `import { useCostData } from "@/hooks/useCostData"` — NO `.js` extension
- **React imports**: `import { useState, useEffect, useRef } from "react"` — standard
- **Sibling imports**: `import { ActivityDot } from "./ActivityDot"` — relative

### Anti-Patterns to Avoid

- **DO NOT** add external dependencies (chart libraries, animation libraries) — use pure CSS and React
- **DO NOT** fetch data directly in the component — delegate to `useCostData` hook
- **DO NOT** use SSE for cost data — the API is REST-only, use polling
- **DO NOT** use `vi.useFakeTimers()` in hook tests — use `vi.useFakeTimers()` ONLY for testing the interval, and restore with `vi.useRealTimers()` after each test
- **DO NOT** forget `"use client"` directive — this is a client component using hooks
- **DO NOT** use `.js` extensions in imports — the web package convention is extensionless
- **DO NOT** null out `summary` on fetch failure — retain previous data (no flicker)
- **DO NOT** receive `sessionId` prop — the panel shows global summary, not per-session cost

### Integration with Epic 21 Token Tracking

The existing `SprintCostPanel` (Epic 21/40) uses `useSprintCost` which fetches from `/api/sprint/cost` — a different data source that aggregates raw `agentInfo.cost` fields from sessions. This new `CostBreakdownPanel` uses the `ModelUsageAggregator` from Story 60-5 which tracks per-tier (low/medium/high) model usage from JSONL events. These are complementary:

- `SprintCostPanel` → high-level sprint cost + clock (WorkflowDashboard widget)
- `CostBreakdownPanel` → per-tier model cost breakdown (SessionDetail panel)

Both panels can coexist — they show different views of cost data.

### Limitations (Deferred Items)

1. **SSE streaming for cost updates**
   - Status: Deferred — API route is REST-only (snapshot)
   - Requires: SSE endpoint at `/api/costs/breakdown/stream` following timeline/notepad stream pattern
   - Current: Polling every 30 seconds via `useCostData` hook

2. **Drill-down navigation (sprint → project → story → session)**
   - Status: Deferred — API supports all dimensions but component only shows summary
   - Requires: Click handlers on tier rows to switch dimension, breadcrumb navigation
   - Current: Summary view only, no dimension switching

3. **Date-range filtering**
   - Status: Deferred — aggregator doesn't support time-based queries yet
   - Requires: Date-range index or in-memory filtering in aggregator
   - Current: Shows all-time cost data

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-6 definition, FR-D3-3]
- [Source: `_bmad-output/implementation-artifacts/60-5-model-cost-api-route.md` — Previous story (API route), response shapes, types]
- [Source: `packages/web/src/app/api/costs/breakdown/route.ts` — API route to consume]
- [Source: `packages/web/src/hooks/useSprintCost.ts` — Polling hook pattern to follow exactly]
- [Source: `packages/web/src/components/SprintCostPanel.tsx` — Existing cost panel component (Epic 21/40)]
- [Source: `packages/web/src/components/NotepadViewer.tsx` — Dashboard panel card shell pattern]
- [Source: `packages/web/src/components/TimelineViewer.tsx` — Dashboard panel pattern with ActivityDot]
- [Source: `packages/web/src/components/SessionDetail.tsx:458-459` — Integration point for dashboard panels]
- [Source: `packages/web/src/components/ActivityDot.tsx` — Connection indicator component]
- [Source: `packages/web/src/lib/workflow/cost-tracker.ts` — Existing cost types (SprintCostSummary, etc.)]
- [Source: `packages/core/src/types.ts:1001-1033` — `ModelTier`, `UsageAggregate` types]
- [Source: `packages/core/src/model-usage.ts` — `ModelUsageAggregator` interface]

### Previous Story Intelligence (60-5)

**Key learnings from 60-5 that impact this story:**

1. **Dimension-based API**: Single endpoint `/api/costs/breakdown?dimension=X` — the panel only needs `dimension=summary` for initial implementation.

2. **Response shape is spread**: The route returns `{ dimension, ...summary }` where summary has `totalTokens`, `totalCost`, `byTier`. The hook should type the response to match this exact shape.

3. **Cache-Control headers**: Route returns `no-cache, no-store, must-revalidate` — browser won't cache, which is correct for polling.

4. **Empty aggregator returns zeros**: When no data exists, `byTier` still has all three tiers with `{ tokens: 0, cost: 0, sessions: 0 }`. The component will always have a complete `byTier` object — no need to handle missing keys.

5. **Tier labels**: The API uses `low`, `medium`, `high` as tier keys. Map to `Haiku`, `Sonnet`, `Opus` in the UI for user-friendliness.

6. **Post-review fix — all response fields must be rendered**: The 60-4 code review caught fields not being displayed. Ensure the component renders ALL fields from the summary response: `totalTokens`, `totalCost`, and all three tier entries with `tokens`, `cost`, `sessions`.

### Previous Story Intelligence (60-4)

1. **`vi.hoisted()` for mock references**: Required when mock instances are referenced in `vi.mock()` factory functions.

2. **Best-effort pattern**: Missing data returns empty results (200), not errors. The component should handle null summary gracefully.

3. **No `vi.useFakeTimers()` for SSE tests**: Not relevant for this polling hook — `vi.useFakeTimers()` is acceptable for testing setInterval behavior in the hook, but must be restored after each test.

4. **Code review lesson — render all data fields**: 60-4 review caught `entry.file` and `entry.agentType` not being displayed. Ensure all summary response fields are surfaced in the component.

### Previous Story Intelligence (60-2)

1. **`session.workspacePath` is the correct field**: Conditionally render on this field.

2. **Best-effort pattern**: Missing data returns empty arrays/objects (200), not errors.

3. **Mock pattern for component tests**: Define mock function at module scope, use `vi.mock()` to wire it up, override return value per-test in `beforeEach` or individual tests.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 5 tasks completed. 15 new tests (6 hook + 9 component), all passing.
- Full test suite: 213 files, 2644 tests, 0 failures.
- Hook test uses top-level `import` with `vi.advanceTimersByTimeAsync()` to avoid `vi.runAllTimersAsync()` infinite loop from setInterval.
- Component test uses `vi.mock("@/hooks/useCostData")` pattern matching codebase convention.
- ActivityDot queries use CSS selector on rounded-full div with style attribute (no data-testid/data-activity available).

### Senior Developer Review (AI)

**Reviewer:** AI Code Review (Opus 4.6) | **Date:** 2026-04-14

**Issues Found:** 2 High, 8 Medium, 4 Low → **All Fixed**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| H1 | HIGH | Error state from hook never rendered | Destructure `error`, render stale-data warning and standalone error message |
| H2 | HIGH | Unsafe `as CostSummary` cast on API response | Added `validateCostSummary()` runtime validation function |
| M1 | MEDIUM | No test for HTTP error (non-ok) response | Added test: "sets error on HTTP error response" |
| M2 | MEDIUM | No test for error state rendering | Added tests: "renders error state", "renders stale data warning" |
| M3 | MEDIUM | No edge-case tests (zero tokens) | Added test: "handles zero total tokens without crash" |
| M4 | MEDIUM | `formatCost` doesn't handle negative/large values | Uses `toLocaleString` with fraction digits; handles negative prefix |
| M5 | MEDIUM | Missing `data-testid` on panel root | Added `data-testid="cost-breakdown-panel"` |
| M6 | MEDIUM | No accessibility attributes | Added `role="region"`, `aria-labelledby`, progress bar `role="progressbar"` with aria attrs, session count `aria-label` |
| M7 | MEDIUM | `global.fetch` not restored in afterEach | Now saves original and restores in `afterEach` |
| M8 | MEDIUM | ActivityDot tests fragile CSS selector | Replaced with proper `getByRole("progressbar")` and `getByLabelText` |
| L1 | LOW | CSS `--color-text-muted` vs `--color-text-tertiary` | Standardized to `--color-text-tertiary` |
| L2 | LOW | `advanceTimersByTimeAsync(0)` fragile | Hook tests now use `waitFor()` for non-timer tests, fake timers only for interval-specific tests |
| L3 | LOW | Hardcoded `POLL_INTERVAL_MS` | Kept as-is (matches codebase pattern in `useSprintCost`) |
| L4 | LOW | `type CostSummary` import | Kept for explicit typing of `CostContent` props |

**Test count after fixes:** 23 tests (9 hook + 14 component), all passing. Full suite: 213 files, 2652 tests, 0 failures.

### Change Log

- 2026-04-14: Story created, implemented (Tasks 1-5), initial test suite (15 tests)
- 2026-04-14: Adversarial code review — 14 findings (2H, 8M, 4L), all fixed. Story status: done.

### File List

- `packages/web/src/hooks/useCostData.ts` — NEW polling hook (fetches summary every 30s) + runtime validation
- `packages/web/src/components/CostBreakdownPanel.tsx` — NEW dashboard panel component + error/accessibility
- `packages/web/src/components/SessionDetail.tsx` — MODIFIED (added import + JSX render)
- `packages/web/src/hooks/__tests__/useCostData.test.ts` — NEW (9 tests)
- `packages/web/src/components/__tests__/CostBreakdownPanel.test.tsx` — NEW (14 tests)
