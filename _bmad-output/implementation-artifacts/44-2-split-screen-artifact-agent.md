# Story 44.2: Split Screen — Artifact + Agent Side-by-Side

Status: ready-for-dev

## Story

As a developer reviewing agent work,
I want to view an artifact alongside the agent's session,
so that I can see the context and output together.

## Acceptance Criteria

1. A "Split View" button appears on agent session context
2. Clicking it splits the view into two resizable panes
3. Left pane: agent session details. Right pane: story/artifact content
4. Panes are resizable via drag handle
5. Escape or close button returns to single-pane view
6. Tests verify split/close behavior and pane rendering

## Tasks / Subtasks

- [ ] Task 1: Create SplitPane layout component (AC: #2, #3, #4)
  - [ ] 1.1: Create `SplitPane.tsx` with left/right children + drag handle
  - [ ] 1.2: Drag handle resizes panes (CSS flexbox with adjustable flex-basis)
  - [ ] 1.3: Minimum pane width (200px) to prevent collapse
- [ ] Task 2: Create split view state management (AC: #1, #5)
  - [ ] 2.1: `useSplitView()` hook with `open(agentId)` / `close()` / `isOpen`
  - [ ] 2.2: Escape key listener to close split view
- [ ] Task 3: Write tests (AC: #6)
  - [ ] 3.1: Test SplitPane renders both panes
  - [ ] 3.2: Test close button hides split view
  - [ ] 3.3: Test hook state management (open/close/isOpen)

## Dev Notes

### Architecture

- SplitPane is a generic layout component — reusable for other split-view features
- useSplitView hook manages which agent is in split view
- No new API routes — uses existing agent data from dashboard props
- Resizable via CSS flexbox + mousedown/mousemove/mouseup on drag handle

### Files to Create

1. `packages/web/src/components/SplitPane.tsx` (new — generic split layout)
2. `packages/web/src/hooks/useSplitView.ts` (new — state management)
3. `packages/web/src/components/__tests__/SplitPane.test.tsx` (new)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
