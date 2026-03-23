# Story 44.6: Focus Mode — Single Story Deep Dive

Status: review

## Story

As a developer,
I want to focus on a single story with all its context,
so that I can deeply review one agent's work without distraction.

## Acceptance Criteria

1. Clicking a story/agent row in WorkflowAgentsPanel enters focus mode
2. Focus mode replaces the widget grid with a single-story view: agent status, log stream, modified files, test results
3. All other dashboard widgets are hidden while in focus mode
4. Breadcrumb shows: Dashboard > Story X-Y (or Agent Name)
5. Pressing Escape returns to the full dashboard
6. Keyboard shortcut `Escape` exits focus mode (already established pattern from useSplitView)
7. Focus mode state is managed in WorkflowDashboard (not URL-based)
8. Component renders correctly in WorkflowDashboard layout

## Tasks / Subtasks

- [x] Task 1: Create FocusMode component (AC: #2, #3)
  - [x] 1.1: Create `packages/web/src/components/FocusMode.tsx`
  - [x] 1.2: Accept `agentId: string` and `onClose: () => void` props
  - [x] 1.3: Render agent status header (name, story, status badge)
  - [x] 1.4: Render LogStream component (reuse from Story 44.3)
  - [x] 1.5: Render modified files list (fetched from `/api/agent/{id}/activity`)
  - [x] 1.6: Render test results summary (from activity events with type "test")
- [x] Task 2: Add breadcrumb navigation (AC: #4)
  - [x] 2.1: Create `packages/web/src/components/FocusBreadcrumb.tsx`
  - [x] 2.2: Show "Dashboard > {agentDisplayName}" with clickable "Dashboard" link
  - [x] 2.3: Dashboard link calls onClose to exit focus mode
- [x] Task 3: Wire focus mode into WorkflowDashboard (AC: #1, #5, #6, #7)
  - [x] 3.1: Add `focusAgent` state to WorkflowDashboard ({ id, displayName } | null)
  - [x] 3.2: Pass `onAgentClick` callback to WorkflowAgentsPanel
  - [x] 3.3: When `focusAgent` is set, render FocusMode instead of widget grid
  - [x] 3.4: Add Escape key listener to exit focus mode (useEffect with keydown)
- [x] Task 4: Update WorkflowAgentsPanel click handling (AC: #1)
  - [x] 4.1: Add `onAgentClick?: (agentName: string, displayName: string) => void` prop
  - [x] 4.2: Make agent list items clickable with `<button>` wrapper and cursor-pointer
  - [x] 4.3: Add focus ring and hover state for accessibility
- [x] Task 5: Write tests (AC: #1-#8)
  - [x] 5.1: Test FocusMode renders agent info and log stream
  - [x] 5.2: Test breadcrumb displays agent name and Dashboard link
  - [x] 5.3: Test clicking breadcrumb back calls onClose
  - [x] 5.4: Test modified files and test results from activity events
  - [x] 5.5: Test empty states and error handling

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

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items
- [x] File List includes all changed files

## Dev Notes

### Architecture & Integration Points

**Focus mode is a LOCAL STATE feature** — no URL routing, no new API routes. It replaces the widget grid in WorkflowDashboard when an agent is selected.

**Component hierarchy:**
```
WorkflowDashboard
  ├── (focusAgentId === null) → widget grid (existing)
  └── (focusAgentId !== null) → FocusMode
       ├── FocusBreadcrumb
       ├── Agent status header
       ├── LogStream (reuse from 44.3)
       └── Activity/files panel
```

### Existing Components to Reuse

1. **`LogStream`** (`packages/web/src/components/LogStream.tsx`) — Live log terminal from Story 44.3. Accept `agentId` prop. Polls `/api/agent/{id}/logs`.
2. **`AgentSessionCard`** (`packages/web/src/components/AgentSessionCard.tsx`) — Has fetch patterns for agent data, activity, logs. Use as REFERENCE but do NOT reuse directly (it's a floating modal with drag/resize — wrong pattern for focus mode).
3. **Escape key pattern** — `useSplitView` (Story 44.2) already establishes Escape listener via `useEffect`. Follow same pattern.

### API Endpoints Available (no new routes needed)

- `GET /api/agent/{agentId}` — agent metadata (name, story, status)
- `GET /api/agent/{agentId}/activity` — activity events array (file modifications, test runs)
- `GET /api/agent/{agentId}/logs` — last 100 log lines (used by LogStream)

### Key Types

```typescript
// From packages/web/src/lib/workflow/types.ts
interface AgentInfo {
  name: string;
  displayName: string;
  icon: string;
  title: string;
  role: string;
}
```

### WorkflowAgentsPanel Modification

Currently renders `<li>` items with no click handler. Add:
- `onAgentClick?: (agentName: string) => void` optional prop
- Wrap each `<li>` content in a `<button>` for accessibility
- Add `cursor-pointer`, hover/focus ring styles

### CSS/Styling Patterns

Follow existing project patterns:
- Tailwind utility classes
- CSS variables: `var(--color-text-primary)`, `var(--color-border-default)`, etc.
- Text sizes: `text-[11px]` for labels, `text-[13px]` for body, `text-[14px]` for headers
- Rounded corners: `rounded-[6px]`
- Border: `border border-[var(--color-border-default)]`
- Surface: `bg-[var(--color-bg-surface)]`

### Testing Pattern

Use vitest + @testing-library/react. Mock fetch with `vi.stubGlobal("fetch", mockFetch)`. Test patterns from `LogStream.test.tsx` and `AgentSessionCard.test.tsx`.

### Previous Story Intelligence (44.5)

- `useExperienceLevel` hook uses `try/catch` + `globalThis.localStorage?.` pattern for SSR safety
- `filterWidgetsByLevel` is pure function — good pattern for any new filtering logic
- WorkflowDashboard already has `useMemo` for computed values — follow same memoization pattern
- Expert mode toggle in header — focus mode exit button should go in similar header position

### Files to Create

1. `packages/web/src/components/FocusMode.tsx` (new)
2. `packages/web/src/components/FocusBreadcrumb.tsx` (new)
3. `packages/web/src/components/__tests__/FocusMode.test.tsx` (new)

### Files to Modify

1. `packages/web/src/components/WorkflowDashboard.tsx` — add focusAgentId state, conditional rendering
2. `packages/web/src/components/WorkflowAgentsPanel.tsx` — add onAgentClick prop, clickable items

### Anti-Patterns to Avoid

- Do NOT use URL routing / `useRouter` for focus mode — keep as local component state
- Do NOT reuse AgentSessionCard (floating modal pattern) — build a full-page replacement view
- Do NOT add new API routes — all required endpoints already exist
- Do NOT fetch agent data in WorkflowDashboard — fetch inside FocusMode component
- Do NOT forget AbortController cleanup on unmount (follow LogStream pattern)

### References

- [Source: packages/web/src/components/LogStream.tsx] — log streaming component to reuse
- [Source: packages/web/src/components/AgentSessionCard.tsx] — fetch patterns reference
- [Source: packages/web/src/hooks/useSplitView.ts] — Escape key listener pattern
- [Source: packages/web/src/components/WorkflowDashboard.tsx] — integration target
- [Source: packages/web/src/components/WorkflowAgentsPanel.tsx] — click handler target
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 44.6] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- FocusMode component fetches agent data + activity from existing API endpoints on mount with AbortController cleanup
- FocusBreadcrumb uses semantic `<nav>` + `<ol>` with `aria-current="page"` for accessibility
- WorkflowAgentsPanel agents now wrapped in `<button>` elements (not just `<li>`) for keyboard accessibility with hover/focus ring
- WorkflowDashboard conditionally renders FocusMode (early return) when `focusAgent` state is set, hiding all widgets
- Escape key listener attached/removed based on focusAgent state — no leak
- 92 test files, 1276 tests — zero regressions
- 9 new FocusMode tests covering: render, breadcrumb, click-back, agent status, log stream, modified files, test results, empty states, error handling

### File List

- packages/web/src/components/FocusMode.tsx (new)
- packages/web/src/components/FocusBreadcrumb.tsx (new)
- packages/web/src/components/__tests__/FocusMode.test.tsx (new)
- packages/web/src/components/WorkflowDashboard.tsx (modified)
- packages/web/src/components/WorkflowAgentsPanel.tsx (modified)
