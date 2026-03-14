# Story 9.2: Last Activity Indicator

Status: done

## Story

As a dashboard user,
I want to see the most recent BMAD workflow activity showing filename, phase, and relative timestamp,
so that I can quickly understand when and where the last change occurred.

## Acceptance Criteria

1. **Given** a project with BMAD artifacts that have modification timestamps
   **When** the WorkflowLastActivity component renders
   **Then** it displays the most recently modified artifact's filename, phase (using PHASE_LABELS), and a relative timestamp (e.g., "2 minutes ago", "yesterday")

2. **Given** no artifacts exist
   **When** the component renders
   **Then** it displays an appropriate empty state (e.g., "No activity yet")

3. **Given** the relative timestamp
   **When** time passes
   **Then** the displayed relative time reflects the current moment accurately (updated on re-render, not live-ticking required)

4. **Given** the component renders
   **When** inspected for accessibility
   **Then** it uses semantic HTML with ARIA labels describing the activity context, and the timestamp has a `<time>` element with an absolute `datetime` attribute

5. **Given** activity data is null or loading
   **When** the component renders
   **Then** it shows a graceful empty state without crashing (loading handled at parent level per WD-7)

## Tasks / Subtasks

- [x] Task 1 — Enhance component with phase label formatting and accessibility (AC: 1, 3, 4)
  - [x] Import `PHASE_LABELS` and `Phase` type from `@/lib/workflow/types.js`
  - [x] Add `phaseLabel()` helper to convert raw phase string to human-readable label
  - [x] Add sr-only `<span>` with complete activity description for screen readers
  - [x] Add `aria-hidden="true"` on decorative/duplicate visible elements
  - [x] Verify `<time datetime={...}>` element is preserved
  - [x] Review `formatRelativeTime()` for edge cases (future dates, invalid ISO strings)
- [x] Task 2 — Unit tests (AC: 1, 2, 3, 4, 5)
  - [x] Create `WorkflowLastActivity.test.tsx` with 3 describe blocks: activity rendering, empty state, accessibility
  - [x] Test filename, phase label, and relative timestamp rendering
  - [x] Test relative time formatting at various intervals (just now, minutes, hours, days, >7 days)
  - [x] Test empty state when `lastActivity` is `null`
  - [x] Test `<time>` element has correct `datetime` attribute
  - [x] Test sr-only text content
  - [x] Test aria-hidden on visible elements
  - [x] Test section aria-label and h2 heading
- [x] Task 3 — CI green (AC: all)
  - [x] `pnpm lint` clean
  - [x] `pnpm typecheck` clean
  - [x] All tests passing with zero regressions

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

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items — all ACs fully met
- [x] File List includes all changed files

## Interface Validation

- [x] This story does NOT modify any `@composio/ao-core` interfaces
- [x] This story does NOT modify `scan-artifacts.ts`, `artifact-rules.ts`, or `types.ts` (UI-only story)
- [x] Import boundaries preserved: component imports only from `@/lib/workflow/types.js`

**Methods Used:**
- [x] `PHASE_LABELS` constant from `@/lib/workflow/types.js` — phase display labels
- [x] `Phase` type from `@/lib/workflow/types.js` — for type-safe phase key access (via type guard or cast)

**Feature Flags:**
- [x] None required — UI-only story, no runtime behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story modifies only a React component and adds tests using existing vitest + @testing-library/react infrastructure. Zero new entries in package.json (NFR-P6).

## Dev Notes

### CRITICAL: Existing Component

**The WorkflowLastActivity component already exists** at `packages/web/src/components/WorkflowLastActivity.tsx`. It was built as a placeholder in Story 7-4 (page shell). This story is an **enhancement pass**, NOT a from-scratch implementation.

**Current component** (~45 lines):
- Receives `lastActivity: { filename: string; phase: string; modifiedAt: string; } | null` as props
- Has `formatRelativeTime()` helper that converts ISO timestamps to relative format ("just now", "2m ago", "5h ago", "3d ago", `toLocaleDateString()` for >7 days)
- Renders filename as primary text (`text-[13px]`)
- Renders phase as raw string + relative timestamp with `&middot;` separator
- Has `<time dateTime={...}>` element with ISO datetime attribute
- Shows "No activity yet." when `lastActivity` is null
- Has `aria-label="Last activity"` on section
- Has h2 "Last Activity" heading
- **Missing**: Phase label formatting (shows raw "analysis" not "Analysis"), sr-only text for screen readers, aria-hidden on visible elements, unit tests

### What Needs to Be Added

1. **Phase label formatting**: Import `PHASE_LABELS` and use it to display human-readable phase names (e.g., "Analysis" not "analysis"). The `lastActivity.phase` is typed as `string` in `WorkflowResponse`, but the API always returns a valid `Phase` value (uncategorized artifacts with `phase === null` are skipped in the API route). Use a type guard or safe lookup.

2. **Accessibility enhancements**:
   - Add sr-only `<span>` with complete activity description: e.g., "Last activity: {filename}, {phase} phase, {relativeTime}"
   - Add `aria-hidden="true"` on the visible duplicate elements (filename paragraph, phase+timestamp paragraph)
   - The `<time>` element with `datetime` attribute is already present — preserve it

3. **Unit tests**: Following established patterns from WorkflowAgentsPanel.test.tsx and WorkflowArtifactInventory.test.tsx

### Architecture Compliance (CRITICAL)

**WD-6 Component Architecture:**
- Props-only interface: receives `lastActivity: { filename: string; phase: string; modifiedAt: string; } | null`
- No internal fetching or state management
- Renders empty state when lastActivity is null
- Unit testable in isolation with mock data
- Component prefixed with "Workflow"

**WD-4 API Contract (frozen):**
```typescript
// From WorkflowResponse (types.ts)
lastActivity: {
  filename: string;
  phase: string;        // Raw phase key (e.g., "analysis", "planning")
  modifiedAt: string;   // ISO 8601 timestamp
} | null;               // null if no artifacts found
```

**Important**: `lastActivity` CAN be `null` (unlike `artifacts` which is always an array). The API returns `null` when no phased artifacts exist. This matches the `agents: AgentInfo[] | null` nullability pattern.

**How lastActivity is computed** (from API route `packages/web/src/app/api/workflow/[project]/route.ts`):
```typescript
// Artifacts are sorted newest-first by scanAllArtifacts()
// Find first artifact with non-null phase (skip uncategorized)
const latestPhased = artifacts.find((a) => a.phase !== null);
const lastActivity = latestPhased && latestPhased.phase !== null
  ? { filename: latestPhased.filename, phase: latestPhased.phase, modifiedAt: latestPhased.modifiedAt }
  : null;
```

This means `lastActivity.phase` is always a valid Phase value — never null, never "Uncategorized". Safe to use `PHASE_LABELS[phase as Phase]`.

**Component Layout (WD-6):**
```
WorkflowDashboard (CSS Grid)
├── PhaseBar (full width, md:col-span-3)
├── AIGuide (2/3 width, md:col-span-2)
├── LastActivity (1/3 width)              ← THIS STORY
├── ArtifactInventory (2/3 width, md:col-span-2)
└── AgentsPanel (1/3 width)
```

The LastActivity panel occupies 1/3 width (single column), so it has limited horizontal space — the layout should be compact/vertical.

**NFRs:**
- NFR-A1: WCAG 2.1 AA compliance
- NFR-A2: Semantic markup (no div-soup) — use `<section>`, `<h2>`, `<time>`, semantic elements
- NFR-A3: Color independence (labels + text, never color alone)
- NFR-A5: Screen reader support (ARIA labels with descriptive state information)
- NFR-A6: Focus visibility (visible focus indicators on interactive elements)
- NFR-M1: Component isolation (renderable/testable independently with mock data)
- NFR-P6: Zero new dependencies
- NFR-T3: Component test coverage >70%

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `WorkflowLastActivity.tsx` | `@/lib/workflow/types.js` | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `WorkflowLastActivity.test.tsx` | `../WorkflowLastActivity`, `@/lib/workflow/types.js`, vitest, @testing-library/react | `@composio/ao-core`, Sprint Board, tracker-bmad |

### UI Styling Patterns (from existing components)

**Section container:**
```
rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full
```

**Section heading:**
```
text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3
```

**Text styling:**
- Primary text (filename): `text-[13px] text-[var(--color-text-primary)]`
- Muted text (phase, timestamp): `text-[11px] text-[var(--color-text-muted)]`
- Empty state: `text-[12px] text-[var(--color-text-secondary)]`

**CSS Custom Properties available:**
- `--color-bg-base`: #0d1117
- `--color-bg-surface`: rgba(22, 27, 34, 0.8)
- `--color-text-primary`: #e6edf3
- `--color-text-secondary`: #7d8590
- `--color-text-muted`: #484f58
- `--color-border-default`: rgba(48, 54, 61, 1)

### Relative Time Formatting

The existing `formatRelativeTime()` helper is already implemented in the placeholder:

```typescript
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
```

**Testing relative time**: Since `formatRelativeTime` depends on `new Date()`, tests must either:
- Mock `Date` / use `vi.useFakeTimers()` to control "now"
- OR pass known timestamps and verify output patterns using regex (e.g., `/\d+[mhd] ago/`)

The recommended approach is `vi.useFakeTimers()` + `vi.setSystemTime()` to set a fixed "now", then pass known ISO dates to get deterministic outputs. Remember to call `vi.useRealTimers()` in `afterEach`.

**Edge cases to consider**:
- `diffMinutes < 1` → "just now" (very recent)
- `diffMinutes = 1` → "1m ago"
- `diffHours = 1` → "1h ago"
- `diffDays = 1` → "1d ago"
- `diffDays >= 7` → `toLocaleDateString()` (full date)
- The function doesn't handle future dates or negative diffs — this is acceptable since `modifiedAt` is always a past filesystem timestamp

### Testing Patterns (from WorkflowAgentsPanel.test.tsx and WorkflowArtifactInventory.test.tsx)

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowLastActivity } from "../WorkflowLastActivity";

// No type import needed — lastActivity is an inline object type, not a named type

// Helper to create test activity data
function makeLastActivity(
  filename: string,
  phase: string,
  modifiedAt: string,
): { filename: string; phase: string; modifiedAt: string } {
  return { filename, phase, modifiedAt };
}
```

**Test patterns to follow:**
- Use `render()` + `screen.getByText()` / `screen.getByRole()` for assertions
- Test section `aria-label` with `screen.getByRole("region", { name: "Last activity" })`
- Test heading with `screen.getByRole("heading", { level: 2 })`
- Test `<time>` element with `container.querySelector("time")` and `.toHaveAttribute("dateTime", ...)`
- Test sr-only text with `screen.getByText("...")` (sr-only text is still in DOM)
- Group tests in `describe` blocks: "activity rendering", "empty state", "accessibility"
- Use `vi.useFakeTimers()` / `vi.setSystemTime()` for deterministic relative time testing

### Previous Story Intelligence

**From Story 9-1 (Artifact Inventory Panel — done):**
- Component pattern: section + aria-label + h2 + content (table or empty state)
- sr-only text moved from standalone element to `<span className="sr-only">` inside first content element (M1 fix)
- `aria-hidden="true"` on decorative/duplicate visible elements — the first visible element gets `aria-hidden` on its `<span>`, subsequent elements get it on their `<td>`/container
- Exact date assertion patterns: `screen.getByText("Mar 14")` not regex
- AC5 loading state documented with comment: "Parent component handles loading before rendering this panel"
- `PHASE_LABELS` import pattern: `import { PHASE_LABELS, type ClassifiedArtifact, type Phase } from "@/lib/workflow/types.js"`
- Code review caught column count mismatch — ALWAYS verify DOM structure matches expected element counts
- Code review caught missing field assertions in "all fields" tests

**From Story 8-4 (Agents Panel — done):**
- Two distinct null states: `agents={null}` ("No agent manifest found.") vs `agents=[]` ("No agents configured in manifest.")
- For LastActivity, there is only ONE null state: `lastActivity={null}` → "No activity yet."
- sr-only text combines all fields: "{name}, {title}. {role}" → for LastActivity: "Last activity: {filename}, {phase} phase, {relativeTime}"

**From Story 8-3 (AI Guide — done):**
- AC5 loading state comment pattern: "AC4 (loading/skeleton state) is handled by the parent WorkflowDashboard via WD-7 LKG pattern"
- `it.each` for parameterized tests (useful for testing all 4 phases)
- aria-hidden badge pattern: visible badges aria-hidden, sr-only text describes them

**CRITICAL LESSON from Story 8-4 code review:** The dev agent marked tasks as `[x]` but NEVER implemented all fields. For THIS story, verify that ALL 3 fields from AC1 (filename, phase label, relative timestamp) are actually rendered AND tested.

### Project Structure Notes

**Files to modify:**
```
packages/web/src/
├── components/
│   └── WorkflowLastActivity.tsx     # MODIFY: Add phase label formatting, sr-only text, aria-hidden
```

**Files to create:**
```
packages/web/src/
├── components/
│   └── __tests__/
│       └── WorkflowLastActivity.test.tsx  # CREATE: Unit tests
```

**Files to read (not modify):**
```
packages/web/src/
├── components/
│   ├── WorkflowAgentsPanel.tsx            # READ: Component pattern reference
│   ├── WorkflowArtifactInventory.tsx      # READ: Component pattern reference (enhanced in 9-1)
│   ├── __tests__/
│   │   ├── WorkflowAgentsPanel.test.tsx   # READ: Test pattern reference (14 tests, null handling)
│   │   ├── WorkflowArtifactInventory.test.tsx  # READ: Test pattern reference (20 tests)
│   │   └── WorkflowAIGuide.test.tsx       # READ: Test pattern reference (14 tests, it.each)
│   └── WorkflowDashboard.tsx              # READ: How LastActivity is wired (receives lastActivity prop)
├── lib/
│   └── workflow/
│       └── types.ts                       # READ: WorkflowResponse, Phase, PHASE_LABELS types
├── app/
│   └── api/workflow/[project]/route.ts    # READ: How lastActivity is computed
```

### References

- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 3.2 Last Activity Indicator]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-4 API Contract, WD-6 Component Architecture, WD-7 LKG Pattern]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR12, NFR-A1-A6, NFR-M1, NFR-P6, NFR-T3]
- [Source: packages/web/src/components/WorkflowLastActivity.tsx — Current placeholder (~45 lines)]
- [Source: packages/web/src/lib/workflow/types.ts — WorkflowResponse, Phase, PHASE_LABELS (frozen)]
- [Source: packages/web/src/app/api/workflow/[project]/route.ts — lastActivity computation logic]
- [Source: packages/web/src/components/WorkflowDashboard.tsx — Data flow: data.lastActivity prop]
- [Source: _bmad-output/implementation-artifacts/9-1-artifact-inventory-panel.md — Previous story intelligence]
- [Source: packages/web/src/components/__tests__/WorkflowAgentsPanel.test.tsx — Test pattern reference (null handling)]
- [Source: packages/web/src/components/__tests__/WorkflowAIGuide.test.tsx — Test pattern reference (it.each, fake timers)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean execution, no debugging required.

### Completion Notes List

1. **Task 1 — Component Enhancement**: Added `import { PHASE_LABELS, type Phase }` from types. Added `phaseLabel()` helper with safe `in` check for type guard — returns `PHASE_LABELS[phase as Phase]` for valid phases, falls back to raw string for unknown. Added sr-only `<span>` with complete activity description: "Last activity: {filename}, {phase} phase, {relativeTime}". Added `aria-hidden="true"` on both visible `<p>` elements (filename and phase+timestamp). Preserved existing `<time dateTime={...}>` element. Reviewed `formatRelativeTime()` — handles all expected cases (just now, minutes, hours, days, >7d full date); future dates not an issue since `modifiedAt` is always a filesystem timestamp.

2. **Task 2 — Unit Tests**: Created 25 tests across 3 describe blocks: activity rendering (17 tests including `it.each` for all 4 phases + 4 boundary tests), empty state (2 tests), accessibility (6 tests). Used `vi.useFakeTimers()` + `vi.setSystemTime()` for deterministic relative time testing. Tests cover: filename, phase label via PHASE_LABELS, all 5 relative time intervals (just now, minutes, hours, days, >7d), boundary cases (60s, 60m, 24h, 7d), all three fields together, unknown phase fallback, null empty state, no time element when null, section aria-label, h2 heading, `<time>` datetime attribute, sr-only text content, aria-hidden count, no sr-only when null.

3. **Task 3 — CI Green**: `pnpm lint` clean, `pnpm typecheck` clean, 496 tests passing (25 WorkflowLastActivity tests). Zero regressions.

4. **Code Review Fixes** (4 LOW):
   - **L1 (LOW)**: Corrected completion notes test counts (was 21/11/5, now 25/17/6).
   - **L2 (LOW)**: Added 4 boundary-case tests for `formatRelativeTime` (60s, 60m, 24h, 7d boundaries).
   - **L3 (LOW)**: Enhanced >7d test to verify rendered text is non-empty and doesn't match "ago" pattern.
   - **L4 (LOW)**: Extracted `phaseLabel` and `formatRelativeTime` calls into local variables, computed once per render instead of twice.

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/components/WorkflowLastActivity.tsx` | Modified | Added PHASE_LABELS import, phaseLabel() helper, sr-only span, aria-hidden on visible elements |
| `packages/web/src/components/__tests__/WorkflowLastActivity.test.tsx` | Created | 25 unit tests covering rendering (17), empty state (2), accessibility (6), using fake timers |
