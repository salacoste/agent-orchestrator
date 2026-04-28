---
title: Session Detail
nav_order: 3
parent: Web Dashboard
description: Session detail page with agent notepad, timeline, cost breakdown, session state, project memory, PR integration, CI checks, and direct terminal — real-time SSE updates
---

# Session Detail

The Session Detail page provides a deep-dive view into an individual agent session, combining real-time intelligence panels, PR integration with CI/review status, and a live terminal. It is the primary view for inspecting what an agent is doing, what it has learned, and interacting with it directly.

{: .highlight }
The session detail page at `/sessions/[id]` is a **client component** (not a server component). It has the `"use client"` directive and fetches all data via REST polling and SSE hooks. The route parameter is `[id]`, not `[sessionId]`.

## Overview

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/sessions/[id]` | `SessionPage` → `SessionDetail` | Client (`"use client"`) | Session detail with header, PR, intelligence panels, terminal |

The session page (`packages/web/src/app/sessions/[id]/page.tsx`) fetches three data sources on mount:

| Data Source | Method | Interval | Endpoint |
|-------------|--------|----------|----------|
| Session data | REST polling | 5000ms | `GET /api/sessions/{id}` |
| Zone counts | REST polling | 5000ms (delayed 2000ms) | `GET /api/sessions` |
| Issue data | REST one-time | None | `GET /api/sessions/{id}/issue` |

The document title is set dynamically by `buildSessionTitle()` — it shows an activity emoji, session ID, and a context-dependent detail:
- Orchestrator sessions: `"Orchestrator Terminal"`
- Sessions with a PR: `#N branch` (PR number + branch truncated to 30 chars)
- Sessions with a branch but no PR: branch name (truncated to 30 chars)
- Fallback: `"Session Detail"`

## Session Header

The header card (`packages/web/src/components/SessionDetail.tsx`) renders session metadata with a colored left border based on activity status:

- **Session ID** — `h1` heading
- **Activity badge** — `ActivityDot` with pulsing animation for active sessions, plus a label:

| Activity | Label | Color |
|----------|-------|-------|
| `active` | "Active" | `var(--color-status-working)` |
| `ready` | "Ready" | `var(--color-status-ready)` |
| `idle` | "Idle" | `var(--color-status-idle)` |
| `waiting_input` | "Waiting for input" | `var(--color-status-attention)` |
| `blocked` | "Blocked" | `var(--color-status-error)` |
| `exited` | "Exited" | `var(--color-status-error)` |

- **Summary** — agent's last summary text
- **Meta chips** — projectId, PR link, branch name, issue URL
- **ClientTimestamps** — humanized status chip, relative creation time, relative last activity time (via `relativeTime()`: `"just now"`, `"Xm ago"`, `"Xh ago"`, `"Xd ago"`)

## PR Card

`PRCard` renders when `session.pr` exists. It provides a comprehensive PR status view:

**PR metadata:**
- Title, branch URL, base branch
- Additions (green) and deletions (red) counts
- Draft badge when `pr.isDraft` is true
- `"Merged"` badge (purple `#a371f7`) when `pr.state === "merged"`

**Merge readiness:**
- `"Ready to merge"` banner with checkmark SVG when `isPRMergeReady(pr)` returns true (open, mergeable, CI passing, approved, no conflicts)
- Left border color: green when ready, purple when merged, default otherwise

**CI checks** — rendered via `CICheckList`:
- `"expanded"` layout when failed checks exist (stacked with view links)
- `"inline"` layout when all checks pass (horizontal wrap)
- Sort order: failed → running → pending → passed → skipped

**Issues list** — heading renders as "Blockers". 8 check types with icons and colors:

| Check | Icon | Color |
|-------|------|-------|
| CI failing | X | Error |
| CI pending | Dot | Attention |
| Changes requested | X | Error |
| Not approved | Circle | Tertiary |
| Merge conflicts | X | Error |
| Not mergeable | Circle | Tertiary |
| Unresolved comments | Dot | Attention |
| Draft PR | Circle | Tertiary |

**Unresolved comments** — collapsible `<details>` elements showing path, author, and body.

**"Ask Agent to Fix" button** — each comment has a button that:
1. Parses comment body via `cleanBugbotComment()` (extracts title from `### ` heading and description from `<!-- DESCRIPTION START -->` block)
2. Sends `POST /api/sessions/{id}/message` with a message asking the agent to address the review comment
3. Shows three button states: `"Sending…"` (disabled, Unicode ellipsis), sent checkmark (green, auto-clears after 3000ms), failed (red, auto-clears after 3000ms)

## Linked Issue Card

Shown when `issueData` is present (fetched from `GET /api/sessions/{id}/issue`). The component renders its heading as "Linked Story". Displays:

- **Title** and **state badge** with 4 states:

| State | Color |
|-------|-------|
| `open` | Default |
| `in_progress` | Blue |
| `closed` | Green |
| `cancelled` | Muted |

- **Labels** — epic labels get distinct styling from regular labels
- **Description** — truncated to 200 characters
- **URL link** to the issue in the tracker

## Agent Notepad

`NotepadViewer` (`packages/web/src/components/NotepadViewer.tsx`) displays the agent's working notepad with real-time SSE updates.

**Three tabs:**

| Tab | Key | Description |
|-----|-----|-------------|
| Priority | `priority` | High-priority context for the agent |
| Working Memory | `working` | Current working state |
| Manual | `manual` | Manually added notes |

- Default tab: `"priority"`
- Empty state: `"No notepad content yet."` when notepad doesn't exist, `"No content yet."` when active tab is empty
- Content rendered in `<pre>` with `whitespace-pre-wrap font-mono`
- SSE connection indicator via `ActivityDot` (dotOnly mode, size 6)
- Uses `useNotepadSSE(sessionId)` hook — REST `GET /api/session/{id}/notepad` for initial data, SSE `GET /api/session/{id}/notepad/stream` for updates

## Agent Timeline

`TimelineViewer` (`packages/web/src/components/TimelineViewer.tsx`) shows a chronological replay of agent activity with real-time SSE updates.

**Event categories and colors:**

| Category | Events | Color | Background |
|----------|--------|-------|------------|
| agent | `agent_start`, `agent_stop` | `var(--color-accent)` | `rgba(88,166,255,0.08)` |
| tool | `tool_start`, `tool_end` | `var(--color-status-ready)` | `rgba(63,185,80,0.08)` |
| file | `file_touch` | `var(--color-status-attention)` | `rgba(210,153,34,0.08)` |
| system | (other) | `var(--color-text-muted)` | `rgba(72,79,88,0.08)` |

**Features:**
- Agent name filter input — case-insensitive substring match, shows `"N of M"` count when active
- Scrollable container — `max-h-[400px]`
- Each entry shows: timestamp (MM:SS format), color dot, agent name badge with 12% background, optional agent type badge (9px), action text, optional file path (max 200px truncated, monospace), optional duration badge (Xms or X.Xs), optional success indicator (checkmark or X)
- Uses `useTimelineSSE(sessionId)` hook — REST for initial data, SSE for updates

## Cost Breakdown

`CostBreakdownPanel` (`packages/web/src/components/CostBreakdownPanel.tsx`) displays model token usage and estimated costs.

**Three model tiers:**

| Tier | Label | Color |
|------|-------|-------|
| `low` | "Haiku" | `var(--color-status-ready)` |
| `medium` | "Sonnet" | `var(--color-status-attention)` |
| `high` | "Opus" | `var(--color-status-error)` |

**Display:**
- Total tokens (locale-formatted) and estimated cost (`$X,XXX.XX` format)
- Each tier row: color dot, label, token count (right-aligned, monospace), cost (right-aligned), proportional progress bar (300ms ease transition, `role="progressbar"` with ARIA attributes), session count
- Bar width: `Math.max(1, (tokens / totalTokens) * 100)`
- Uses `useCostData()` hook — REST-only polling every 30 seconds at `GET /api/costs/breakdown?dimension=summary`, no SSE

## Session State

`SessionStatePanel` (`packages/web/src/components/SessionStatePanel.tsx`) shows the session's execution mode, active agents, running modes, and health status.

**Four sub-components:**

1. **`ExecutionModeBadge`** — mode name capitalized, or `"Standard"` if null. Green background `rgba(63,185,80,0.12)`.
2. **`ActiveAgentsRow`** — lists agent name badges with blue styling. Shows `"No agents"` when empty. Configured status indicator (green/tertiary).
3. **`ActiveModesSection`** — for each active mode:
   - Active indicator dot (green/tertiary)
   - Mode name with optional phase text
   - Optional task progress (`"X/Y tasks"`)
   - Optional progress bar (120px wide, `h-1.5` Tailwind class ≈ 6px height, green fill, computed as `Math.min(Math.round((iteration / maxIterations) * 100), 100)`)
4. **`HealthIndicator`** — colored dot (green/red) + `"Healthy"` or health message + optional last check timestamp

- Has `data-testid="session-state-panel"`, `role="region"`, `aria-labelledby`
- Uses `useSessionStateSSE(sessionId)` hook with **named SSE event** `state-update`

## Project Memory

`ProjectMemoryViewer` (`packages/web/src/components/ProjectMemoryViewer.tsx`) displays and edits per-session memory entries grouped by type.

**Four entry groups:**

| Group | Type |
|-------|------|
| Conventions | `convention` |
| Decisions | `decision` |
| Directives | `directive` |
| Learnings | `learning` |

**Features:**
- Hover reveals Edit/Delete buttons (opacity transition)
- `EditEntryForm` — textarea (3 rows) with Save/Cancel buttons. Save updates `timestamp` to `new Date().toISOString()`.
- `DeleteConfirm` — shows first 40 chars of content, red Delete button, Cancel button
- Persistence via `PUT /api/session/{id}/memory` with `{ entries: ProjectMemoryEntry[] }` — validates each entry has non-empty string `type` and `content`
- Uses `useProjectMemorySSE(sessionId)` hook with **named SSE event** `memory-update`

## Cross-Session Memory

`CrossSessionMemoryViewer` (`packages/web/src/components/CrossSessionMemoryViewer.tsx`) shows knowledge shared across sessions within a project.

{: .highlight }
Cross-session memory is **config-gated** — it only displays when `learning.crossSessionMemory === true` in the project configuration. Otherwise it shows `"Enable cross-session memory in project config..."`.

**Features:**
- Type filter (`<select>`) and session filter (`<input>`) — both applied client-side
- Entry types with colored badges: convention (blue), decision (purple), directive (orange), learning (green)
- Inline edit mode: textarea + Save/Cancel
- Delete with confirmation modal (fixed overlay, z-50, `bg-black/30`)
- Edit saves via `PUT /api/cross-session-memory/{project}` with `{ contentHash, content }`
- Delete via `DELETE /api/cross-session-memory/{project}` with `{ contentHash }`
- Uses `useCrossSessionMemory(projectName)` hook — SSE only connects after initial REST succeeds (`sseReady` state gate). Max 10 SSE retries before giving up.

## Direct Terminal

`DirectTerminal` (`packages/web/src/components/DirectTerminal.tsx`) provides a live terminal connected to the agent session via WebSocket.

{: .highlight }
The terminal uses **WebSocket** (NOT SSE). It connects to port 14801 (configurable via `NEXT_PUBLIC_DIRECT_TERMINAL_PORT`) at `ws://{hostname}:{port}/ws?session={sessionId}`.

**xterm.js configuration:**

| Setting | Value |
|---------|-------|
| Font | IBM Plex Mono, SF Mono, Menlo, Monaco |
| Font size | 13px |
| Scrollback | 10000 lines |
| Cursor blink | true |
| Fast scroll | Alt modifier, sensitivity 3 |

**Theme colors (agent variant):**

| Element | Color |
|---------|-------|
| Background | `#0a0a0f` |
| Foreground | `#d4d4d8` |
| Cursor | `#5b7ef8` |
| Selection | `rgba(91, 126, 248, 0.3)` |

Orchestrator variant uses purple cursor (`#a371f7`) and purple selection (`rgba(163, 113, 247, 0.25)`).

**Special features:**
- **OSC 52 clipboard** — decodes base64 clipboard data and writes to `navigator.clipboard`
- **XDA handler** — responds to `CSI > q` with `\x1bP>|XTerm(370)\x1b\\` for tmux clipboard support
- **Selection preservation** — buffers incoming WebSocket data while text is selected (for Cmd+C). Flushes on selection clear, after 5000ms safety timer, or when buffer exceeds 1MB
- **Copy key handler** — intercepts Cmd+C (Mac) and Ctrl+Shift+C (Linux/Win)

**Reconnection:**
- Exponential backoff: `Math.min(1000 * Math.pow(2, attempt), 15000)` — 1s, 2s, 4s, 8s, 15s cap
- Permanent error codes 4001 (auth failure) and 4004 (session not found) — no retry

**Fullscreen mode:**
- URL sync: sets/removes `?fullscreen=true` via `router.replace`
- Resize: uses `requestAnimationFrame` polling (max 60 attempts) with backup timers at 300ms and 600ms

**WebSocket protocol:**
- Binary mode: `websocket.binaryType = "arraybuffer"`
- On open: sends `{ type: "resize", cols, rows }`
- On input: `terminal.onData` sends raw data to WebSocket

## Orchestrator Mode

When the session ID ends with `"-orchestrator"`, the page activates orchestrator mode:

**`OrchestratorStatusStrip`** — shows attention zone counts with colored badges:

| Zone | Label | Color | Background |
|------|-------|-------|------------|
| merge | "merge-ready" | `#3fb950` | `rgba(63,185,80,0.1)` |
| respond | "responding" | `#f85149` | `rgba(248,81,73,0.1)` |
| review | "review" | `#d18616` | `rgba(209,134,22,0.1)` |
| working | "working" | `#58a6ff` | `rgba(88,166,255,0.1)` |
| pending | "pending" | `#d29922` | `rgba(210,153,34,0.1)` |
| done | "done" | `#484f58` | `rgba(72,79,88,0.15)` |

Only zones with count > 0 are displayed. The strip background uses `linear-gradient(to bottom, rgba(88,166,255,0.04) 0%, transparent 100%)`.

**Uptime clock** — computed from `createdAt`, refreshed every 30 seconds. Format: `"Xh Xm"` or `"Xm"`.

**Terminal variant** — orchestrator sessions use `"orchestrator"` variant with purple cursor and reduced height (`calc(100vh - 240px)` vs `max(440px, calc(100vh - 440px))`).

## Real-Time Updates

Session detail uses multiple independent data channels:

**Page-level REST polling:**

| Data | Interval | Hook |
|------|----------|------|
| Session data | 5000ms | Direct in `SessionPage` |
| Zone counts | 5000ms (delayed 2000ms) | Direct in `SessionPage` |
| Issue data | One-time | Direct in `SessionPage` |

**Intelligence panel SSE hooks:**

| Hook | SSE Endpoint | Event Type | Poll Interval | Change Detection |
|------|-------------|------------|---------------|------------------|
| `useNotepadSSE` | `/api/session/{id}/notepad/stream` | Default `onmessage` | 5000ms | MD5 hash |
| `useTimelineSSE` | `/api/session/{id}/timeline/stream` | Default `onmessage` | 10000ms | Entry count |
| `useSessionStateSSE` | `/api/session/{id}/state/stream` | Named `state-update` | 5000ms | JSON.stringify |
| `useProjectMemorySSE` | `/api/session/{id}/memory/stream` | Named `memory-update` | 5000ms | JSON.stringify |
| `useCrossSessionMemory` | `/api/cross-session-memory/{project}/stream` | Named `memory-update` | 5000ms | JSON.stringify |
| `useCostData` | (REST only) | None | 30000ms | N/A |

All SSE hooks use exponential backoff reconnection: `Math.min(1000 * Math.pow(2, retry), 8000)` — 1s, 2s, 4s, 8s cap. `useCrossSessionMemory` has a hard limit of 10 retries.

All SSE streams send heartbeat comments (`: heartbeat`) every 15000ms.

**WebSocket terminal** — independent WebSocket connection with its own reconnection logic (1s→15s cap).

## Data Flow

```text
Client
SessionPage
    |
    +-- fetchSession() -----> GET /api/sessions/{id}
    |       |
    |   DashboardSession
    |       |
    +-- fetchIssueData() ---> GET /api/sessions/{id}/issue
    |       |
    |   IssueData | null
    |       |
    +-- fetchZoneCounts() --> GET /api/sessions (orchestrator only)
    |       |
    |   ZoneCounts | null
    |
    SessionDetail
        |
        +-- Header (activity, summary, meta)
        +-- PRCard (if pr exists)
        +-- IssueCard (if issueData)
        |
        +-- NotepadViewer ---------> useNotepadSSE()
        +-- TimelineViewer --------> useTimelineSSE()
        +-- CostBreakdownPanel ----> useCostData()
        +-- SessionStatePanel -----> useSessionStateSSE()
        +-- ProjectMemoryViewer ---> useProjectMemorySSE()
        +-- CrossSessionMemoryViewer -> useCrossSessionMemory()
        +-- DirectTerminal --------> WebSocket :14801
```

## API Routes

The session detail pages use the following API endpoints:

| Endpoint | Method | Purpose | Response Shape |
|----------|--------|---------|---------------|
| `/api/sessions/{id}` | GET | Session data with PR enrichment | `DashboardSession` (16 fields including id, status, activity, pr, workspacePath) |
| `/api/sessions/{id}/issue` | GET | Linked issue data | `{ id, title, description, state, labels, url }` or 404 |
| `/api/sessions/{id}/message` | POST | Send message to agent | `{ success: true }` |
| `/api/sessions/{id}/kill` | POST | Kill session | `{ ok: true, sessionId }` |
| `/api/sessions/{id}/restore` | POST | Restore session | `{ ok: true, sessionId, session }` |
| `/api/sessions/{id}/send` | POST | Send raw input | `{ ok: true, sessionId, message }` |
| `/api/sessions` | GET | All sessions (zone counts) | `{ sessions: DashboardSession[] }` |
| `/api/session/{id}/notepad` | GET | Notepad content | `{ sessionId, notepad: { priority, working, manual }, exists }` |
| `/api/session/{id}/notepad/stream` | SSE | Notepad real-time | `{ type: "notepad-update", sessionId, notepad, exists }` |
| `/api/session/{id}/timeline` | GET | Timeline entries | `{ sessionId, timeline: TimelineEntry[], totalEntries }` |
| `/api/session/{id}/timeline/stream` | SSE | Timeline real-time | `{ type: "timeline-update", sessionId, timeline, totalEntries }` |
| `/api/session/{id}/state` | GET | Session state | `{ sessionId, state: SessionState, exists }` |
| `/api/session/{id}/state/stream` | SSE | State real-time | Named `state-update` event with `{ sessionId, state, exists }` |
| `/api/session/{id}/memory` | GET/PUT | Project memory CRUD | GET: `{ sessionId, memory, exists }` / PUT: `{ sessionId, memory, exists }` |
| `/api/session/{id}/memory/stream` | SSE | Memory real-time | Named `memory-update` event with `{ sessionId, memory, exists }` |
| `/api/costs/breakdown` | GET | Cost breakdown | `{ dimension: "summary", totalTokens, totalCost, byTier: { low, medium, high } }` |
| `/api/cross-session-memory/{project}` | GET/PUT/DELETE | Cross-session memory | `{ entries, project, enabled }` |
| `/api/cross-session-memory/{project}/stream` | SSE | Cross-session memory real-time | Named `memory-update` event |
| `/api/agent/{id}` | GET | Agent detail | `{ id, projectId, status, activity, branch, pr, metadata }` |
| `/api/agent/{id}/logs` | GET | Agent log tail | `{ logs: string[], source: "primary" \| "previous" \| "none" }` |
| `/api/agent/{id}/resume` | POST | Resume agent | `{ success: true, agentId, previousStatus, newStatus }` — resumable: `blocked`, `ci_failed`, `changes_requested` |
| `/api/agent/{id}/restart` | POST | Restart agent | `{ success: true, agentId, previousAgentId, newStatus, storyId, branch }` or 207 partial |
| `/api/agent/{id}/reassign` | POST | Kill + return story | `{ success: true, agentId, previousStatus }` |
| `/api/agent/{id}/ping` | GET | Agent status check | `{ success: true, agentId, status, lastActivityAt }` |
| `/api/agent/{id}/activity` | GET | Activity events | `{ events: ActivityEvent[] }` — limit 1-500, default 100 |
| `/api/agent/{id}/capacity` | GET | Capacity check | `{ maxCapacity, availableSlots, isAtCapacity, isNearCapacity, utilizationPercent }` |
| `/api/agent/{id}/confidence` | GET | Confidence indicators | `{ agentId, files: ConfidenceResult[] }` |
| `/api/agent/{id}/reasoning` | GET | Reasoning trail | Reasoning results (no wrapper) |
| `/api/agent/cascade/resume` | POST | Clear cascade state | `{ success: true, previousFailureCount, wasPaused }` |

## Key Types

All types are defined in `packages/web/src/lib/types.ts` unless noted.

**`DashboardSession`** — 16 fields per session:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Session identifier |
| `projectId` | `string` | Project this session belongs to |
| `status` | `SessionStatus` | Current session status (from `@composio/ao-core`) |
| `activity` | `ActivityState \| null` | Current activity state |
| `branch` | `string \| null` | Git branch name |
| `issueId` | `string \| null` | Tracker issue ID (deprecated, use issueUrl) |
| `issueUrl` | `string \| null` | Tracker issue URL |
| `issueLabel` | `string \| null` | Issue label text |
| `issueTitle` | `string \| null` | Issue title |
| `summary` | `string \| null` | Agent's last summary |
| `summaryIsFallback` | `boolean` | Whether summary is auto-generated |
| `createdAt` | `string` | ISO timestamp |
| `lastActivityAt` | `string` | ISO timestamp |
| `pr` | `DashboardPR \| null` | Pull request data |
| `workspacePath` | `string \| null` | Path to workspace directory |
| `metadata` | `Record<string, string>` | Session metadata |

**`DashboardPR`** — PR with CI and review status:

| Field | Type | Description |
|-------|------|-------------|
| `number` | `number` | PR number |
| `url` | `string` | PR URL |
| `title` | `string` | PR title |
| `owner` | `string` | Repository owner |
| `repo` | `string` | Repository name |
| `branch` | `string` | Head branch |
| `baseBranch` | `string` | Base branch |
| `isDraft` | `boolean` | Draft PR status |
| `state` | `"open" \| "merged" \| "closed"` | PR state |
| `additions` | `number` | Lines added |
| `deletions` | `number` | Lines deleted |
| `ciStatus` | `CIStatus` | CI check status |
| `ciChecks` | `DashboardCICheck[]` | Individual CI checks |
| `reviewDecision` | `ReviewDecision` | Review status |
| `mergeability` | `DashboardMergeability` | Merge readiness |
| `unresolvedThreads` | `number` | Unresolved thread count |
| `unresolvedComments` | `DashboardUnresolvedComment[]` | Unresolved comments |

**`IssueData`** — linked tracker issue:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Issue ID |
| `title` | `string` | Issue title |
| `description` | `string` | Issue description |
| `state` | `"open" \| "in_progress" \| "closed" \| "cancelled"` | Issue state |
| `labels` | `string[]` | Issue labels |
| `url` | `string` | Issue URL |

**`AttentionLevel`** — priority classification:

```typescript
type AttentionLevel = "merge" | "respond" | "review" | "pending" | "working" | "done";
```

Computed by `getAttentionLevel()` with priority: done → merge → respond → review → pending → working.

**`NotepadData`** — agent notepad sections:

```typescript
interface NotepadData {
  priority: string;
  working: string;
  manual: string;
}
```

**`CostSummary`** — model cost aggregation:

```typescript
interface CostSummary {
  dimension: "summary";
  totalTokens: number;
  totalCost: number;
  byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
}
// ModelTier = "low" | "medium" | "high"
```

**`SessionState`** — session execution state (from `@composio/ao-core`):

| Field | Type | Description |
|-------|------|-------------|
| `executionMode` | `string \| null` | Current execution mode |
| `activeAgents` | `string[]` | Active agent IDs |
| `configured` | `boolean` | Whether session is configured |
| `activeModes` | `ActiveModeState[]` | Running modes with progress |
| `health` | `{ healthy, message?, lastCheck? } \| null` | Health status |

**`ProjectMemory`** and **`ProjectMemoryEntry`** — session-level memory:

```typescript
interface ProjectMemory {
  entries: ProjectMemoryEntry[];
}
interface ProjectMemoryEntry {
  id: string;
  type: string;      // "convention" | "decision" | "directive" | "learning"
  content: string;
  source?: string;
  timestamp?: string;
}
```

**`CrossSessionMemoryEntry`** — cross-session knowledge:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `EntryType` | `"convention" \| "decision" \| "directive" \| "learning"` |
| `content` | `string` | Memory content |
| `contentHash` | `string` | Deduplication hash |
| `sourceSessionIds` | `string[]` | Sessions that contributed |
| `lastSeenAt` | `string` (optional) | Last seen timestamp |

## Next Steps

- [Web Dashboard](.) — dashboard overview, pages, SSE hooks, design system
- [Portfolio View](portfolio-view/) — project grid, aggregated metrics, filtering
- [Sprint Board](sprint-board/) — story columns, assignment interface, sprint metrics
- [Scenario Comparison](scenario-comparison/) — Monte Carlo interface, forecast visualization
- [Conflict Resolution](conflict-resolution/) — conflict detection and resolution workflows
- [Risk Management](risk-management/) — risk scoring, utilization, optimization
- [Workflow Events & Fleet](workflow-events-fleet/) — workflow builder, event stream, fleet management
- [Getting Started](../getting-started/) — install and run the dashboard
- [Configuration](../getting-started/configuration.md) — configure projects, plugins, and reactions
