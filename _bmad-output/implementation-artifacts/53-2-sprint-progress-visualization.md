# Story 53.2: Sprint Progress Visualization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to see visual progress bars showing how each sprint is tracking**,
so that **I can quickly identify sprints that are ahead or behind schedule**.

## Acceptance Criteria

1. **Given** multiple sprints are displayed
   **When** I view the sprint list
   **Then** each sprint shows a progress bar (stories completed vs total)
   **And** the progress bar color indicates health (green/yellow/red)
   **And** hovering shows detailed breakdown

## Tasks / Subtasks

- [x] Task 1: Implement progress bar component with health coloring (AC: #1)
  - [x] 1.1: Create `packages/web/src/components/SprintProgressBar.tsx` — client component rendering a horizontal progress bar
  - [x] 1.2: Implement progress bar fill width as `progressPercent%` of total width
  - [x] 1.3: Implement health-based coloring: green (`on-track`), yellow (`at-risk`), red (`blocked`)
  - [x] 1.4: Add native `title` tooltip showing detailed breakdown: "X done / Y total (Z%)" plus story counts by status
  - [x] 1.5: Add accessible `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label`

- [x] Task 2: Integrate progress bar into SprintCard component (AC: #1)
  - [x] 2.1: Modify `packages/web/src/components/SprintCard.tsx` to render `SprintProgressBar` with `progressPercent` and `health` props
  - [x] 2.2: Ensure SprintCard shows the progress bar below the sprint name/date section
  - [x] 2.3: Verify hover tooltip displays story breakdown (total, done, in-progress, blocked, backlog)

- [x] Task 3: Write tests (AC: #1)
  - [x] 3.1: Create `packages/web/src/components/__tests__/SprintProgressBar.test.tsx` — component tests
  - [x] 3.2: Test: renders progress bar with correct width style
  - [x] 3.3: Test: applies green color for on-track health
  - [x] 3.4: Test: applies yellow color for at-risk health
  - [x] 3.5: Test: applies red color for blocked health
  - [x] 3.6: Test: title tooltip contains detailed breakdown text
  - [x] 3.7: Test: renders with aria progressbar role and correct aria values
  - [x] 3.8: Test: handles 0% and 100% edge cases

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- No hidden TODOs or FIXMEs in completed tasks
- Deferred items explicitly documented

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Animated progress bar transitions
   - Status: Deferred - Static bar sufficient for MVP
   - Requires: CSS transition or framer-motion for smooth width changes
   - Current: Instant width change on render
2. Progress bar comparison overlay (target vs actual)
   - Status: Deferred - Story 53.4 adds velocity comparison
   - Requires: Sprint target/baseline data in UnifiedSprintEntry
   - Current: Single bar showing actual progress only
```

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `UnifiedSprintEntry` type from `@/lib/types` — data source for progress and health
- `SprintHealthStatus` type from `@/lib/types` — health color mapping
- `SprintCard` component from Story 53-1 — integration point

**Feature Flags:**
- None required — uses types established by Story 53-1

## Dependency Review

No new external dependencies required. Uses existing:
- Vitest for testing
- React for UI components
- Tailwind CSS for styling
- `UnifiedSprintEntry` / `SprintHealthStatus` types from Story 53-1

## Dev Notes

### Architecture Context

This is **Story 2 of 5** in **Epic 53: Unified Sprint View**. It depends on:
- **Story 53-1 (ready-for-dev):** Unified Sprint Dashboard — must be implemented FIRST. This story provides `UnifiedSprintEntry`, `SprintHealthStatus`, `SprintCard`, and the `/sprints` page with data fetching infrastructure.

This story adds the **visual progress layer** — a `SprintProgressBar` component with health-based coloring and detailed hover tooltips, integrated into the `SprintCard` component created by 53-1.

### Previous Story Intelligence (53-1: Unified Sprint Dashboard)

Key patterns and learnings from the story definition:
- **Pure function pattern**: `computeSprintSummary()`, `computeSprintHealth()` are pure sync functions. Follow the same pattern for any helper functions.
- **Server/Client component split**: Server component (`page.tsx`) fetches data, passes to client component wrapper for interactivity.
- **Component test pattern**: Use `vi.stubGlobal("fetch", ...)` for mocking fetch in view component tests. Use `render()` + `screen.getByText()` + `waitFor()` for async loading states.
- **Build before test**: Always rebuild `@composio/ao-core` after adding new exports.

### Health Color Mapping

The `SprintHealthStatus` type defined in Story 53-1:
```typescript
type SprintHealthStatus = "on-track" | "at-risk" | "blocked";
```

Color mapping for progress bars (uses CSS custom properties from design system):

| Health | CSS Variable Class | Semantic |
|--------|-------------------|----------|
| on-track | `bg-[var(--color-success)]` | Green |
| at-risk | `bg-[var(--color-warning)]` | Yellow |
| blocked | `bg-[var(--color-error)]` | Red |

### SprintProgressBar Component Design

```
┌─────────────────────────────────────────────────────────┐
│  ████████████████████████████░░░░░░░░░░  72%            │
│  (green = on-track, yellow = at-risk, red = blocked)     │
└─────────────────────────────────────────────────────────┘
  Hover tooltip (newline-separated):
    "13 done / 18 total (72%)
     3 in-progress
     2 blocked
     0 backlog"
```

> **Note:** The tooltip uses newline-separated lines (via `title` attribute) rather than comma-separated as initially sketched. Each metric gets its own line for better readability on hover.

**Props:**
```typescript
interface SprintProgressBarProps {
  progressPercent: number;      // 0-100
  health: SprintHealthStatus;   // "on-track" | "at-risk" | "blocked"
  stories: {                    // For tooltip breakdown
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    backlog: number;
  };
  projectName: string;          // For aria-label specificity
}
```

> **Note:** `projectName` was added beyond the original spec to provide a more descriptive `aria-label` (e.g., `"Test Project sprint progress"` instead of the generic `"Sprint progress: 72% complete"`).

**Accessibility:**
- `role="progressbar"` on the outer container
- `aria-valuenow={progressPercent}`
- `aria-valuemin={0}`
- `aria-valuemax={100}`
- `aria-label="Sprint progress: {progressPercent}% complete"`
- Native `title` attribute for hover tooltip (no custom tooltip library needed)

### SprintCard Integration

Story 53-1 creates `SprintCard.tsx` with this structure:
```
SprintCard
  ├── Header: project name, sprint name
  ├── Date range (if available)
  ├── Progress bar:  ← THIS STORY adds SprintProgressBar here
  ├── Story breakdown: total, done, in-progress, blocked
  └── Health indicator badge
```

The `SprintProgressBar` replaces or enhances the progress bar section of SprintCard. If SprintCard already has a basic progress indicator, this story upgrades it to the full health-colored bar with tooltip.

### File Structure to Create/Modify

```
packages/web/src/
├── components/
│   ├── SprintProgressBar.tsx                        # NEW: Health-colored progress bar component
│   ├── SprintCard.tsx                               # MODIFY: Integrate SprintProgressBar
│   └── __tests__/
│       └── SprintProgressBar.test.tsx               # NEW: Component tests
```

### Testing Strategy

**Component tests (SprintProgressBar.test.tsx):**
- Renders progress bar with correct width style (e.g., `width: 72%`)
- Applies green background class for `on-track` health
- Applies yellow background class for `at-risk` health
- Applies red background class for `blocked` health
- Title tooltip contains breakdown: "X done / Y total (Z%)"
- Title tooltip contains in-progress, blocked, backlog counts
- Renders with `role="progressbar"` and correct `aria-valuenow`
- Handles 0% progress (empty bar)
- Handles 100% progress (full bar)
- Handles edge case: progressPercent > 100 (clamp to 100)

### NFRs

- **NFR-F5-2:** Progress bars render as part of the unified sprint view (loaded within 2 seconds per NFR-F5-1)
- **NFR-P1:** Progress bar rendering is instant (pure CSS, no async operations)

### Pre-existing Types (Do NOT modify)

- `SprintSummary` in `packages/core/src/types.ts` — core type for single-project sprint summary
- `SprintDataMap` in `packages/core/src/cross-project-deps.ts` — used for dependency resolution
- Use `UnifiedSprintEntry` and `SprintHealthStatus` from Story 53-1 in `packages/web/src/lib/types.ts`

### References

- [Source: epics-cycle-10.md#Epic 53 Story 53.2] — Story definition and ACs
- [Source: prd-cycle-10.md#F5] — Unified Sprint View requirements (FR-F5-2: progress bars, color coding)
- [Source: prd-cycle-10.md#NFR-F5-1] — Performance: 2-second load
- [Source: _bmad-output/implementation-artifacts/53-1-unified-sprint-dashboard.md] — Previous story: types, aggregation, SprintCard
- [Source: packages/web/src/components/PortfolioMetricsWidget.tsx] — Pattern: health-colored metric cards
- [Source: packages/web/src/lib/status-colors.ts] — Existing status → color mapping
- [Source: packages/web/src/components/PortfolioView.tsx] — Pattern: client component with SSE updates
- [Source: CLAUDE.md] — TypeScript conventions (ESM, .js extensions, node: prefix, strict mode)

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- Story 53-1 MUST be implemented before this story (types and SprintCard dependency)
- All existing tests must continue to pass (no regressions)
- Use CSS custom properties (`var(--color-*)`) for colors where available, fall back to Tailwind direct classes for health-specific colors (green/yellow/red)

## Dev Agent Record

### Agent Model Used

Claude claude-sonnet-4-20250514

### Debug Log References

- SprintCard already had inline progress bar from Story 53-1. Extracted into SprintProgressBar component.
- `healthColorClass` removed from SprintCard — now lives in SprintProgressBar.

### Completion Notes List

1. Created `SprintProgressBar` component with health-colored progress bar, clamped width, tooltip, and ARIA accessibility
2. Integrated `SprintProgressBar` into `SprintCard`, replacing the inline progress bar
3. 11 SprintProgressBar tests: width, health colors (3), tooltip, ARIA, edge cases (0%, 100%, >100%, negative), percentage label
4. All 12 SprintCard tests continue passing (integration verified)
5. Full regression: 1,797 tests pass, 0 failures

### Limitations (Deferred Items)

1. Animated progress bar transitions
   - Status: Deferred - Static bar sufficient for MVP
   - Requires: CSS transition or framer-motion for smooth width changes
   - Current: Instant width change on render
2. Progress bar comparison overlay (target vs actual)
   - Status: Deferred - Story 53.4 adds velocity comparison
   - Requires: Sprint target/baseline data in UnifiedSprintEntry
   - Current: Single bar showing actual progress only

### File List

**New Files:**
- `packages/web/src/components/SprintProgressBar.tsx` — Health-colored progress bar with tooltip
- `packages/web/src/components/__tests__/SprintProgressBar.test.tsx` — 11 component tests

**Modified Files:**
- `packages/web/src/components/SprintCard.tsx` — Replaced inline progress bar with SprintProgressBar component

**Verified Existing (no changes, backward compat confirmed):**
- `packages/web/src/components/__tests__/SprintCard.test.tsx` — 12 existing tests still pass after integration

**Verified Existing Files (no changes, backward compatibility confirmed):**
- `packages/web/src/components/__tests__/SprintCard.test.tsx` — 12 existing tests still pass after integration
