# Story 45.1: Story Replay — Agent Session Time-Lapse

Status: review

## Story

As a team lead reviewing completed work,
I want to replay an agent's session as a time-lapse of events,
so that I can understand what the agent did and how it approached the story.

## Acceptance Criteria

1. Events are displayed chronologically in an animated timeline from JSONL event log
2. Each event shows: timestamp, type, description (reusing activity API from 38.2)
3. Playback speed is adjustable (1x, 2x, 5x, 10x)
4. User can pause, scrub, and jump to any point in the timeline
5. "Replay" button triggers the replay from a session card or focus mode
6. Replay is a pure client-side feature — no new API endpoints needed
7. Tests verify playback controls, speed changes, and event rendering

## Tasks / Subtasks

- [x] Task 1: Create replay engine (pure logic) (AC: #1, #3, #4)
  - [x] 1.1: Create `packages/web/src/lib/workflow/replay-engine.ts`
  - [x] 1.2: Accept `ReplayEvent[]` sorted by timestamp
  - [x] 1.3: Compute inter-event delays with MIN/MAX caps
  - [x] 1.4: Expose state: `currentIndex`, `isPlaying`, `speed`, `progress` (0-1)
  - [x] 1.5: Pure functions: advanceReplay, seekReplay, setReplaySpeed, toggleReplayPlayback
- [x] Task 2: Create useReplay hook (AC: #1, #3, #4)
  - [x] 2.1: Create `packages/web/src/hooks/useReplay.ts`
  - [x] 2.2: Wrap engine in useState/useRef with auto-advance timer
  - [x] 2.3: Auto-advance via chained `setTimeout` (delay / speed)
  - [x] 2.4: Clean up timer on unmount and events change
- [x] Task 3: Create ReplayTimeline component (AC: #1, #2, #3, #4)
  - [x] 3.1: Create `packages/web/src/components/ReplayTimeline.tsx`
  - [x] 3.2: Vertical event list with current-event highlight and future-event opacity
  - [x] 3.3: Playback controls: play/pause, speed selector (1x/2x/5x/10x), event counter
  - [x] 3.4: Range input scrubber for seeking
  - [x] 3.5: Auto-scroll current event via scrollIntoView
- [x] Task 4: Wire replay into FocusMode (AC: #5)
  - [x] 4.1: Add "Replay" / "Live Logs" toggle button in FocusMode header
  - [x] 4.2: Toggle between ReplayTimeline and LogStream
  - [x] 4.3: Replay uses activity events already fetched by FocusMode
- [x] Task 5: Write tests (AC: #7)
  - [x] 5.1: Test replay engine: 23 tests covering all pure functions
  - [x] 5.2: Test inter-event delay calculation with caps and edge cases
  - [x] 5.3: Test ReplayTimeline renders events, controls, empty state (9 tests)
  - [x] 5.4: Test speed selector changes aria-pressed state
  - [x] 5.5: Test scrubber and click-to-seek update counter

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items
- [x] File List includes all changed files

## Dev Notes

### Architecture — Engine + Hook + Component

Three layers with clean separation:

```
replay-engine.ts (pure logic — no React, no DOM)
  ├── Input: ActivityEvent[] sorted by timestamp
  ├── State: currentIndex, isPlaying, speed
  └── Methods: play, pause, setSpeed, seekTo, reset

useReplay.ts (React hook — timer management)
  ├── Wraps engine in useState/useRef
  ├── Auto-advance via setTimeout (delay / speed)
  └── Cleanup on unmount

ReplayTimeline.tsx (UI — visual timeline + controls)
  ├── Event list with current-event highlight
  ├── Playback controls (play/pause, speed, scrub)
  └── Auto-scroll current event into view
```

### Event Data Source (NO new APIs)

Reuse existing `GET /api/agent/{id}/activity?limit=500` which returns:
```typescript
interface ActivityEvent {
  timestamp: string;   // ISO 8601
  type: string;        // "story.started", "story.completed", etc.
  description: string; // Human-readable
  metadata: Record<string, unknown>;
}
```

The events are already sorted and formatted by `read-events.ts` (Story 38.2). The replay engine consumes them directly.

### Inter-Event Delay Calculation

```typescript
// Real-world time between events, capped to prevent long waits
const MAX_DELAY_MS = 5000; // Cap at 5s even for hour-long gaps
const MIN_DELAY_MS = 100;  // Minimum visible delay

function computeDelay(prev: string, curr: string): number {
  const diff = new Date(curr).getTime() - new Date(prev).getTime();
  return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, diff));
}

// Actual playback delay = computeDelay / speed
```

### Existing Components to Reuse

1. **`StoryTimeline.tsx`** — Vertical timeline with dots and status colors. Use as visual reference but build simpler (no polling, no status columns).
2. **`ActivityDot.tsx`** — Pulsing animation for active state. Can reuse for "current event" highlight.
3. **`FocusMode.tsx`** (Story 44.6) — The replay button goes in the agent header. Replay replaces the log stream section.
4. **`formatRelativeTime()`** from `WorkflowLastActivity.tsx` — For event timestamp display.

### Playback Controls Pattern

```
[◄◄] [▶/⏸] [►►]   Speed: [1x] [2x] [5x] [10x]
[===●===============] 12/47 events
```

- Range input (`<input type="range">`) for scrubber
- Button group for speed selection
- Play/pause toggle button

### FocusMode Integration

Add state to FocusMode:
```typescript
const [showReplay, setShowReplay] = useState(false);
```

When `showReplay` is true, render `<ReplayTimeline events={activity} />` instead of `<LogStream>`. Toggle via "Replay" / "Live Logs" button in the header.

### CSS/Styling

- Current event: `bg-[var(--color-accent)]/10` with left border accent
- Past events: normal text, slightly muted
- Future events: `opacity-50`
- Controls bar: `sticky bottom-0` within the replay container

### Anti-Patterns to Avoid

- Do NOT use `setInterval` — use `setTimeout` chained per event (variable delays)
- Do NOT create new API endpoints — reuse existing activity API
- Do NOT poll during replay — load events once, animate client-side
- Do NOT use `requestAnimationFrame` — `setTimeout` is sufficient for event-level granularity
- Do NOT store replay state in localStorage — ephemeral, resets on close

### Previous Story Intelligence (44.8)

- Service worker caches `/api/agent/*/activity` responses — replay may work partially offline
- MobileStatusBar uses `useServiceWorker` hook — follow same hook-in-component pattern
- `getProgressColor` established for progress-based coloring (not health-score thresholds)

### Files to Create

1. `packages/web/src/lib/workflow/replay-engine.ts` (new)
2. `packages/web/src/lib/workflow/__tests__/replay-engine.test.ts` (new)
3. `packages/web/src/hooks/useReplay.ts` (new)
4. `packages/web/src/components/ReplayTimeline.tsx` (new)
5. `packages/web/src/components/__tests__/ReplayTimeline.test.tsx` (new)

### Files to Modify

1. `packages/web/src/components/FocusMode.tsx` — add Replay button and toggle

### References

- [Source: packages/web/src/app/api/agent/[id]/activity/route.ts] — activity API endpoint
- [Source: packages/web/src/app/api/agent/[id]/activity/read-events.ts] — JSONL reader, ActivityEvent shape
- [Source: packages/web/src/components/StoryTimeline.tsx] — vertical timeline pattern
- [Source: packages/web/src/components/ActivityDot.tsx] — animation patterns
- [Source: packages/web/src/components/FocusMode.tsx] — integration point
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.1] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure replay engine with immutable state functions — no React dependencies, fully testable
- Inter-event delays capped at 5s max / 100ms min to prevent long pauses from real-world gaps
- useReplay hook chains setTimeout per event (not setInterval) for variable delay support
- ReplayTimeline: clickable event list, range scrubber, 4 speed presets with aria-pressed
- FocusMode gains "Replay" / "Live Logs" toggle — replaces log stream section, no new routes
- Auto-restart from beginning when play pressed at end of sequence
- 32 new tests (23 engine + 9 component), 96 total web files, 1325 tests — zero regressions

### File List

- packages/web/src/lib/workflow/replay-engine.ts (new)
- packages/web/src/lib/workflow/__tests__/replay-engine.test.ts (new)
- packages/web/src/hooks/useReplay.ts (new)
- packages/web/src/components/ReplayTimeline.tsx (new)
- packages/web/src/components/__tests__/ReplayTimeline.test.tsx (new)
- packages/web/src/components/FocusMode.tsx (modified — replay toggle)
