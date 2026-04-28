# Epic 25b Retrospective — Dashboard Component Wiring

**Date**: 2026-03-22
**Epic**: 25b — Dashboard Component Wiring
**Status**: Complete (all 5 stories done)
**Source**: epics-cycle-5.md (part of Cycle 5)
**Cycle**: 5

## Epic Summary

Eic 25b wired five new dashboard components into the WorkflowDashboard layout: CascadeAlert (cascade failure banner with Resume All), SprintCostPanel (token burn rate and sprint clock), ConflictCheckpointPanel (file conflict list with checkpoint rollback), ProjectChatPanel (project insight bubbles with question input), and useKeyboardShortcuts (chord-based keyboard navigation with help modal). All five components were built as self-contained React components with typed props, integrated into the existing widget-registry-driven layout, and tested with vitest. Each component follows the established pattern: typed props interface, `data-testid` attributes for test selectors, CSS variable theming via `var(--color-*)`, and Tailwind utility classes at fixed font sizes (11px/12px/13px) matching the dashboard aesthetic.

The epic completed as part of Cycle 5 alongside ESLint guardrails, SDK scaffolding, and collaboration modules. All five stories were implemented by Claude Opus 4.6 with 1M context.

## Story Delivery

| Story | Title | Component | Tests | Status |
|-------|-------|-----------|-------|--------|
| 25b-1 | Cascade Detector Dashboard Panel | `CascadeAlert.tsx` | 6 | Done |
| 25b-2 | Cost & Sprint Clock Dashboard | `SprintCostPanel.tsx` | 6 | Done |
| 25b-3 | Conflict & Checkpoint UI | `ConflictCheckpointPanel.tsx` | 5 | Done |
| 25b-4 | Project Chat Panel | `ProjectChatPanel.tsx` | 7 | Done |
| 25b-5 | Keyboard Shortcut Hook & Help Modal | `useKeyboardShortcuts.ts` | 0 (hook only) | Done |

**Total new tests**: 24
**New components**: 4 (CascadeAlert, SprintCostPanel, ConflictCheckpointPanel, ProjectChatPanel)
**New hooks**: 1 (useKeyboardShortcuts)
**New modules**: 5 source files + 4 test files
**External dependencies added**: 0

### Component Integration Points

Each component was wired into `WorkflowDashboard.tsx` via the widget registry's `renderWidget()` switch:

| Widget ID | Component | Data Source |
|-----------|-----------|-------------|
| `cascadeAlert` | `CascadeAlert` | `useCascadeStatus()` hook |
| `costPanel` | `SprintCostPanel` | `useSprintCost()` hook |
| `conflictPanel` | `ConflictCheckpointPanel` | `useConflictCheckpoint()` hook |
| `chatPanel` | `ProjectChatPanel` | `useProjectChat()` hook + `generateInsights()` |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — dashboard vision, user workflows, feature priorities
- Nova (Architect) — component design, widget registry, extensibility
- Blaze (Dev) — implementation patterns, hook design, pain points
- Pax (QA) — test coverage, component accessibility, edge cases

---

### What Went Well

**R2d2 (Project Lead):** Five components, 24 tests, zero external dependencies — this is the velocity the dashboard needed. The cascade alert is the highest-value piece: when three agents fail in five minutes, the tech lead sees a red banner and can resume all agents with one click. No more digging through logs to figure out why agents stopped. The sprint cost panel gives real-time visibility into token burn rate and runaway agents, which directly addresses the "how much is this sprint costing?" question that was previously unanswerable without manual calculation.

**Nova (Architect):** Three architectural decisions paid off:

1. **Widget registry pattern** — Every new component plugs into the existing `renderWidget()` switch in `WorkflowDashboard.tsx` by adding a `WidgetId` case. The layout is determined by role + experience level, not by component ordering. This means CascadeAlert renders at full width (`colSpan: 3`) for all roles because it's registered that way in `WIDGET_META`. New components don't touch the grid layout logic at all.

2. **Hook-per-data-source pattern** — Each component receives its data through a dedicated hook (`useCascadeStatus`, `useSprintCost`, `useConflictCheckpoint`, `useProjectChat`). The component is a pure presentational shell — it renders whatever the hook provides. This makes components trivially testable: pass mock data via props, assert on rendered output. The hooks handle SSE polling, caching, and reconnection independently.

3. **Consistent prop interfaces** — Every component follows the same pattern: typed props interface, optional callback props (`onResume`, `onRollback`, `onAskQuestion`), and a `null`/empty guard that returns either `null` (CascadeAlert) or a placeholder message (all others). This consistency means the learning curve for understanding any one component transfers to all of them.

**Blaze (Dev):** The chord shortcut system in `useKeyboardShortcuts` was the most interesting implementation. The `g` key triggers a one-time `keydown` listener for the second key (`g`+`f` for fleet, `g`+`s` for sprint, `g`+`w` for workflow). The listener auto-cleans after 1 second via `setTimeout`. The `?` key toggles the help modal. The hook also correctly skips shortcuts when focus is in `INPUT`, `TEXTAREA`, or `contentEditable` elements — this prevents accidental navigation while typing in the chat input. Clean implementation, no stale listener leaks.

**Pax (QA):** 24 tests across 4 test files, all co-located in `__tests__/`. Test coverage is consistent: each component test file covers the happy path (renders with data), the empty state (renders with null/no data), and user interactions (button clicks, input changes). CascadeAlert tests verify the "Resume All" button fires `onResume`. SprintCostPanel tests verify runaway agent warnings appear conditionally. ConflictCheckpointPanel tests verify the rollback button calls `onRollback` with the correct SHA. ProjectChatPanel tests (7, the highest count) cover input submission, Enter key handling, and disabled send button on empty input. Good coverage for presentational components.

---

### What Could Be Improved

**R2d2 (Project Lead):** The Cycle 5 retrospective flagged that SprintCostPanel was created but not wired into the parent layout during initial implementation — the code review caught it. This is the "unintegrated component" anti-pattern where a component passes its unit tests (it renders correctly with mock data) but isn't actually imported or rendered anywhere in the application. The "renders in parent" acceptance criterion convention from Story 37.3 was supposed to prevent this, but it wasn't enforced during Story 25b-2 development.

**Nova (Architect):** The `useKeyboardShortcuts` hook (25b-5) was shipped without tests. The story file lists no test file. This is the only story in the epic without tests. Keyboard event handling has subtle edge cases — the chord timeout cleanup, the `isContentEditable` guard, the `preventDefault` on space (which would otherwise scroll the page). These should have at least basic unit tests. The `KEYBOARD_SHORTCUTS` constant is imported from a separate module and re-exported, which suggests the help modal content is decoupled from the hook logic, but the help modal itself wasn't delivered as a component in this story.

**Blaze (Dev):** The `ProjectChatPanel` mixes two data sources in `WorkflowDashboard.tsx`: it receives both `insights` from `generateInsights()` and `chatMessages` from `useProjectChat()`, merged inline with `.map()` before passing to the component. This merging logic lives in the parent's `renderWidget()` function rather than inside the component or the hook. If the chat panel evolves (threading, responses, typing indicators), this inline merge will become a maintenance problem. A `useChatWithInsights()` composable hook would be cleaner.

**Pax (QA):** No accessibility audit was performed on the new components. CascadeAlert correctly uses `role="alert"` and the panels use `aria-label` on their `<section>` elements, which is good. But the keyboard shortcuts hook doesn't announce shortcut activation to screen readers (no `aria-live` region), and the chat panel's scrollable message area has no `aria-label` or `role="log"`. The rollback buttons in ConflictCheckpointPanel use a 10px font size — this is below the 12px minimum recommended for readability. These are minor but should be addressed in a follow-up pass.

---

### Previous Retro Action Items Review

This is the first epic-level retrospective for Epic 25b. No previous epic-level action items exist. However, the Cycle 5 retrospective had relevant observations:

| # | Cycle 5 Observation | Status | Notes |
|---|---------------------|--------|-------|
| 1 | Unintegrated components caught in code review | Partially addressed | SprintCostPanel was wired after review, but the AC convention still isn't enforced by tooling |
| 2 | Dashboard layout redesigned with 6 rows | Done | Layout uses widget registry with role-based ordering |
| 3 | Per-story code review pattern established | Done | All 5 stories received code review |

---

### Key Decisions

1. **Presentational components only** — All four panel components are pure presentational. State management, data fetching, and SSE subscriptions live in hooks. Components accept typed props and callbacks. This separation was explicit from the start and enables straightforward unit testing with mock data.

2. **Widget registry integration over hardcoded layout** — New components register via `WidgetId` in the widget registry rather than being hardcoded into the dashboard grid. This means role-based layout changes (e.g., hiding cost panel from junior developers) require only a registry update, not a component change.

3. **Chord shortcuts over modifier keys** — `g`+`f`/`s`/`w` chords instead of `Ctrl+Shift+F` style shortcuts. Chords are easier to implement cross-platform (no browser/OS modifier key conflicts) and more discoverable via the `?` help modal. The tradeoff is a 1-second timeout window for the second keypress.

4. **CSS variable theming throughout** — All new components use `var(--color-*)` CSS variables for colors rather than hardcoded Tailwind color classes. The exception is severity-specific colors (red for cascade, amber for warning, green for on-track) which use Tailwind's built-in palette with opacity modifiers (`bg-red-500/10`).

5. **No external dependencies** — All five stories were implemented with React, TypeScript, and Tailwind only. No chart libraries, no rich text editors, no keyboard shortcut libraries. The chat input is a plain `<input>`, the cost display uses `toLocaleString()` for number formatting.

---

### Lessons Learned

1. **"Renders in parent" must be an acceptance criterion** — The SprintCostPanel gap showed that component-level tests alone don't prove integration. The acceptance criterion should explicitly require that the component is imported and rendered in its parent container, verifiable by a test that queries the parent DOM for the component's `data-testid`.

2. **Hook-only stories need tests too** — Story 25b-5 shipped `useKeyboardShortcuts` without a test file. React hooks can be tested with `renderHook` from `@testing-library/react`. The chord mechanism, input guard, and help toggle all have testable behavior. Skipping tests on hooks because they "don't render anything" is a false economy.

3. **Inline data merging in renderWidget is a code smell** — The chat panel's inline merge of insights + messages in `WorkflowDashboard.tsx` lines 141-149 is a merge operation that belongs in a hook or a utility. Six lines of mapping and spreading inside a `switch` case reduces readability. Extract early, keep `renderWidget` focused on component instantiation.

4. **Consistent component structure pays dividends** — All four panel components follow the same structure: typed props interface, JSDoc with story reference, outer `<section>` with `aria-label`, `<h2>` header with uppercase tracking, content area, and null/empty guard. This consistency made the Cycle 5 code review faster because the reviewer's mental model from 25b-1 applied to 25b-2 through 25b-4.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Add `renderHook` tests for `useKeyboardShortcuts` — cover chord logic, input guard, help toggle | Dev | HIGH |
| 2 | Enforce "renders in parent" AC convention — add integration test for each new widget in WorkflowDashboard | Dev | MEDIUM |
| 3 | Extract chat insights merge from `renderWidget` into a `useChatWithInsights()` hook | Dev | MEDIUM |
| 4 | Accessibility audit on dashboard components — `aria-live` for shortcut activation, `role="log"` on chat messages, minimum font sizes | Dev | LOW |
| 5 | Wire `useKeyboardShortcuts` into WorkflowDashboard — hook exists but isn't invoked in the dashboard component | Dev | HIGH |

---

### Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Keyboard shortcut hook tests | Tech debt | 25b-5 |
| Help modal component (referenced but not delivered) | Tech debt | 25b-5 |
| Accessibility improvements (aria-live, role="log", font sizes) | Tech debt | All |
| Chat insights merge extraction | Tech debt | 25b-4 |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5 |
| Stories with tests | 4 (25b-5 has no tests) |
| Total new tests | 24 |
| New components | 4 |
| New hooks | 1 |
| External dependencies added | 0 |
| Components integrated into WorkflowDashboard | 4 of 4 (after review fix) |
| Epic duration | ~1 day (within Cycle 5 session) |
| Agent model | Claude Opus 4.6 (1M context) |

## Component Test Summary

| Component | Test File | Test Count | Key Assertions |
|-----------|-----------|------------|----------------|
| CascadeAlert | `__tests__/CascadeAlert.test.tsx` | 6 | Renders when paused, hidden when not, Resume All fires callback |
| SprintCostPanel | `__tests__/SprintCostPanel.test.tsx` | 6 | Token display, burn rate, runaway warning, clock status colors |
| ConflictCheckpointPanel | `__tests__/ConflictCheckpointPanel.test.tsx` | 5 | Conflict list, agent names, rollback button fires with SHA |
| ProjectChatPanel | `__tests__/ProjectChatPanel.test.tsx` | 7 | Input change, Enter submit, disabled send on empty, insight rendering |
| useKeyboardShortcuts | (none) | 0 | N/A — no test file created |
