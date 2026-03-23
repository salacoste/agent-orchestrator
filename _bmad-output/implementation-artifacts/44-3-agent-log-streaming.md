# Story 44.3: Agent Log Streaming — Live Terminal in Browser

Status: ready-for-dev

## Story

As a developer monitoring an agent,
I want to see live agent output in the browser,
so that I don't need to switch to a terminal window.

## Acceptance Criteria

1. Last 100 log lines loaded immediately via existing logs API (38.3)
2. New log lines polled every 2s via `GET /api/agent/[id]/logs?lines=20&since=lastTimestamp` (party mode decision — poll, not SSE)
3. Terminal view uses monospace font
4. "Copy All" button copies visible log content to clipboard
5. Tests verify initial load, polling, and copy functionality

## Tasks / Subtasks

- [ ] Task 1: Create LogStream component (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `LogStream.tsx` with monospace log display
  - [ ] 1.2: Initial load: fetch last 100 lines on mount
  - [ ] 1.3: Poll every 2s for new lines (append to display)
  - [ ] 1.4: Auto-scroll to bottom on new content
  - [ ] 1.5: "Copy All" button using navigator.clipboard
- [ ] Task 2: Write tests (AC: #5)
  - [ ] 2.1: Test initial log lines rendered
  - [ ] 2.2: Test copy button exists
  - [ ] 2.3: Test component renders with monospace styling

## Dev Notes

### Architecture (Party Mode Decision)

- **Poll existing logs API** every 2s with `since` parameter — no new SSE endpoint needed
- Uses `GET /api/agent/[id]/logs` from Story 38.3
- Monospace: `font-mono` Tailwind class
- Auto-scroll: `scrollIntoView()` on new content ref
- AbortController for cleanup on unmount

### Files to Create

1. `packages/web/src/components/LogStream.tsx` (new)
2. `packages/web/src/components/__tests__/LogStream.test.tsx` (new)

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
