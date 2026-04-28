# Story 62.35: Session Detail

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Session Detail documentation page that documents the session detail page, agent notepad, agent timeline, cost breakdown, session state, project memory, cross-session memory, PR card with CI checks and review comments, agent controls, and the direct terminal,
so that I can understand the session detail's components, data flow, SSE real-time updates, PR integration, agent control actions, and how each sub-component connects to backend services.

## Acceptance Criteria

1. **Session Detail page** (`docs/web-dashboard/session-detail.md`) documents an "Overview" section describing the session detail page at `/sessions/[id]` — a client component (NOT server component despite Next.js convention) that fetches session data, zone counts, and issue data — sourced from `packages/web/src/app/sessions/[id]/page.tsx`
2. **Session Detail page** documents a "Session Header" section describing the header card with session ID, activity badge using `ActivityDot`, summary text, meta chips (projectId, PR link, branch, issueUrl), and `ClientTimestamps` with humanized status and relative times — sourced from `packages/web/src/components/SessionDetail.tsx`
3. **Session Detail page** documents a "PR Card" section describing `PRCard` with CI checks via `CICheckList`, "Ready to merge" banner when `isPRMergeReady()`, unresolved comments with collapsible `<details>`, "Ask Agent to Fix" button with sending/sent/error states (3000ms auto-clear), `IssuesList` with 8 check types — sourced from `packages/web/src/components/SessionDetail.tsx`
4. **Session Detail page** documents a "Linked Issue Card" section describing the issue card shown when `issueData` is present, with title, state badge (4 states with colors), labels, description truncated to 200 chars — sourced from `packages/web/src/components/SessionDetail.tsx`
5. **Session Detail page** documents an "Agent Notepad" section describing `NotepadViewer` with 3 tabs (Priority, Working Memory, Manual), SSE via `useNotepadSSE`, `<pre>` rendering with monospace font — sourced from `packages/web/src/components/NotepadViewer.tsx`
6. **Session Detail page** documents an "Agent Timeline" section describing `TimelineViewer` with 4 event categories (agent/tool/file/system), color coding, agent filter, `useTimelineSSE` hook, scrollable container (400px max), timestamp/duration formatting — sourced from `packages/web/src/components/TimelineViewer.tsx`
7. **Session Detail page** documents a "Cost Breakdown" section describing `CostBreakdownPanel` with total tokens/cost, 3 model tier rows (Haiku/Sonnet/Opus) with proportional bars, `useCostData` polling every 30s — sourced from `packages/web/src/components/CostBreakdownPanel.tsx`
8. **Session Detail page** documents a "Session State" section describing `SessionStatePanel` with execution mode badge, active agents row, active modes with progress bars, health indicator, `useSessionStateSSE` with named `state-update` events — sourced from `packages/web/src/components/SessionStatePanel.tsx`
9. **Session Detail page** documents a "Project Memory" section describing `ProjectMemoryViewer` with 4 entry groups (conventions, decisions, directives, learnings), inline edit/delete, `PUT /api/session/{id}/memory` persistence — sourced from `packages/web/src/components/ProjectMemoryViewer.tsx`
10. **Session Detail page** documents a "Cross-Session Memory" section describing `CrossSessionMemoryViewer` with type/session filters, edit/delete with `PUT/DELETE /api/cross-session-memory/{project}`, config-gated (`learning.crossSessionMemory`), max 10 SSE retries — sourced from `packages/web/src/components/CrossSessionMemoryViewer.tsx`
11. **Session Detail page** documents a "Direct Terminal" section describing `DirectTerminal` with xterm.js (IBM Plex Mono, 10000 scrollback), WebSocket on port 14801, OSC 52 clipboard, selection preservation (5s buffer, 1MB limit), exponential backoff 1s→15s, permanent error codes 4001/4004 — sourced from `packages/web/src/components/DirectTerminal.tsx`
12. **Session Detail page** documents an "Orchestrator Mode" section describing `OrchestratorStatusStrip` with 6 attention zones (merge/respond/review/pending/working/done), uptime clock (30s refresh), and the orchestrator-specific terminal cursor/selection colors — sourced from `packages/web/src/components/SessionDetail.tsx`
13. **Session Detail page** documents a "Real-Time Updates" section describing: page-level polling (5s for session + zones, one-time for issue), 6 SSE hooks (useNotepadSSE, useTimelineSSE, useCostData, useSessionStateSSE, useProjectMemorySSE, useCrossSessionMemory), and WebSocket terminal — sourced from multiple hook files
14. **Session Detail page** documents a "Data Flow" section describing the fetch pipeline: session REST → DashboardSession → PR enrichment → attention level → header/tabs rendering — sourced from `packages/web/src/app/sessions/[id]/page.tsx`
15. **Session Detail page** documents an "API Routes" section listing the 20+ endpoints used by session detail with method, purpose, and response shape — sourced from `packages/web/src/app/api/session/` and `packages/web/src/app/api/agent/` route files
16. **Session Detail page** documents a "Key Types" section listing: `DashboardSession` (16 fields), `DashboardPR` (17 fields), `IssueData` (6 fields), `NotepadData`, `CostSummary`, `SessionState`, `ProjectMemory`, `AttentionLevel` — sourced from `packages/web/src/lib/types.ts` and component files
17. **Page uses correct Just the Docs front matter**: `title: Session Detail`, `nav_order: 3`, `parent: Web Dashboard`, `description` field
18. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
19. **Cross-links** verified: parent link to Web Dashboard index, sibling links to 6 other Web Dashboard child pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Session Detail page (AC: #1-19)
  - [x] Replace stub content in docs/web-dashboard/session-detail.md
  - [x] Write front matter (title, nav_order: 3, parent: Web Dashboard, description)
  - [x] Write "Overview" section — client component, API polling, data flow (AC #1)
  - [x] Write "Session Header" section — ID, activity, summary, meta chips, timestamps (AC #2)
  - [x] Write "PR Card" section — CI checks, merge readiness, comments, ask-agent-to-fix (AC #3)
  - [x] Write "Linked Issue Card" section — title, state, labels, description (AC #4)
  - [x] Write "Agent Notepad" section — 3 tabs, SSE, pre rendering (AC #5)
  - [x] Write "Agent Timeline" section — categories, colors, filter, duration format (AC #6)
  - [x] Write "Cost Breakdown" section — tiers, bars, polling (AC #7)
  - [x] Write "Session State" section — mode badge, agents, modes, health (AC #8)
  - [x] Write "Project Memory" section — 4 groups, edit/delete, persistence (AC #9)
  - [x] Write "Cross-Session Memory" section — filters, edit/delete, config-gating (AC #10)
  - [x] Write "Direct Terminal" section — xterm.js, WebSocket, clipboard, reconnection (AC #11)
  - [x] Write "Orchestrator Mode" section — status strip, zones, uptime (AC #12)
  - [x] Write "Real-Time Updates" section — polling, SSE hooks, WebSocket (AC #13)
  - [x] Write "Data Flow" section — fetch pipeline, enrichment, rendering (AC #14)
  - [x] Write "API Routes" section — 20+ endpoints with method/purpose/response (AC #15)
  - [x] Write "Key Types" section — DashboardSession, DashboardPR, IssueData, etc. (AC #16)
  - [x] Write "Next Steps" cross-links section (AC #19)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All component names verified against actual source code
- All SSE event types and polling intervals verified against source
- All API endpoint paths verified against route files
- No hero font classes
- Cross-links verified
- All code blocks use correct syntax highlighting
- `{: .highlight }` callout for important notes

## Dev Notes

### Design Decisions

- **This story covers the Session Detail CHILD page** — the index page (62-32) is done. This is the third of 7 child pages (62-33 through 62-39)
- **The stub file** at `docs/web-dashboard/session-detail.md` has front matter with `title: Session Detail`, `nav_order: 3`, `parent: Web Dashboard` — needs `description` added and "Content coming soon — Story 62.18." replaced
- **Session detail is a CLIENT component** — despite being at `app/sessions/[id]/page.tsx`, it has `"use client"` directive. It is NOT a server component
- **Route parameter is `[id]`, not `[sessionId]`** — the file is `app/sessions/[id]/page.tsx`
- **Session page polls 3 data sources** — session data (5s), zone counts (5s, delayed 2s on initial), issue data (one-time)
- **DirectTerminal uses WebSocket, NOT SSE** — it connects to port 14801 via WebSocket, not the SSE `/api/events` endpoint
- **6 SSE hooks for session detail** — each with its own SSE stream endpoint, not using the shared `useSSEConnection` hook

### Previous Story Learnings (62-34)

- Source strings must be quoted EXACTLY from source — no paraphrasing
- Front matter needs `description` field for searchability
- Cross-link file existence must be verified
- No hero font classes (`.fs-5`, `.fw-300`)
- `{: .highlight }` callout for important notes
- Syntax highlighting: `bash` for CLI examples, `text` for output examples, `typescript` for code
- Epic definitions may not match actual implementation — always verify against source code
- Default port is 5000 (not 3000) — configurable via `PORT` env var
- `pnpm dev` (next dev) does NOT require prior `pnpm build`
- Capacity badge: describe visible text and aria-label separately, use conditional plural descriptions (no `(s)` notation)
- API response shapes: use specific field names, not vague descriptions

### Source Files

- **packages/web/src/app/sessions/[id]/page.tsx** — Session page (CLIENT component, polls 3 data sources)
- **packages/web/src/components/SessionDetail.tsx** — Main session detail component (header, PR card, issue card, notepad, timeline, cost, state, memory, terminal)
- **packages/web/src/components/NotepadViewer.tsx** — 3-tab notepad viewer with SSE
- **packages/web/src/components/TimelineViewer.tsx** — Agent timeline with 4 event categories
- **packages/web/src/components/CostBreakdownPanel.tsx** — Model cost breakdown with 3 tiers
- **packages/web/src/components/SessionStatePanel.tsx** — Session state with mode badge, agents, modes, health
- **packages/web/src/components/ProjectMemoryViewer.tsx** — Project memory with 4 entry groups
- **packages/web/src/components/CrossSessionMemoryViewer.tsx** — Cross-session memory with filters
- **packages/web/src/components/DirectTerminal.tsx** — xterm.js terminal with WebSocket
- **packages/web/src/components/ActivityDot.tsx** — Activity status dot with 6 states
- **packages/web/src/components/CIBadge.tsx** — CI status badge and check list
- **packages/web/src/hooks/useNotepadSSE.ts** — Notepad SSE hook
- **packages/web/src/hooks/useTimelineSSE.ts** — Timeline SSE hook
- **packages/web/src/hooks/useCostData.ts** — Cost polling hook (30s, no SSE)
- **packages/web/src/hooks/useSessionStateSSE.ts** — Session state SSE hook (named event)
- **packages/web/src/hooks/useProjectMemorySSE.ts** — Project memory SSE hook (named event)
- **packages/web/src/hooks/useCrossSessionMemory.ts** — Cross-session memory hook (max 10 retries)
- **packages/web/src/hooks/useSessionEvents.ts** — Session snapshot SSE hook
- **packages/web/src/lib/types.ts** — DashboardSession, DashboardPR, IssueData, AttentionLevel
- **docs/web-dashboard/session-detail.md** — Replace stub with full documentation

### Key Session Detail Facts (verified against source)

**Page route:** 1 route

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/sessions/[id]` | `SessionPage` → `SessionDetail` | Client (`"use client"`) | Session detail with header, PR card, notepad, timeline, cost, state, memory, terminal |

**SessionPage polling intervals:**

| Data Source | Method | Interval | Notes |
|-------------|--------|----------|-------|
| Session data | REST polling | 5000ms | `GET /api/sessions/{id}` |
| Zone counts | REST polling | 5000ms | `GET /api/sessions`, delayed 2000ms on initial load |
| Issue data | REST one-time | None | `GET /api/sessions/{id}/issue`, 404 = no issue |

**SessionDetail component sections (conditional rendering):**

| Section | Condition | Component |
|---------|-----------|-----------|
| Nav bar | Always | Sticky top bar with breadcrumb |
| OrchestratorStatusStrip | `isOrchestrator && orchestratorZones` | Zone counts strip |
| Header card | Always | Session ID, activity, summary, meta |
| Linked Issue Card | `issueData` present | Issue title, state, labels |
| PRCard | `session.pr` exists | CI checks, comments, merge readiness |
| NotepadViewer | `session.workspacePath` exists | 3-tab notepad |
| TimelineViewer | `session.workspacePath` exists | Agent activity timeline |
| CostBreakdownPanel | `session.workspacePath` exists | Model cost tiers |
| SessionStatePanel | `session.workspacePath` exists | Execution mode, agents, health |
| ProjectMemoryViewer | `session.workspacePath` exists | Per-session memory entries |
| CrossSessionMemoryViewer | `session.workspacePath && session.projectId` | Cross-session knowledge |
| DirectTerminal | Always | xterm.js terminal with WebSocket |

**ActivityDot activity config (6 states):**

| Activity | Label | Dot Color |
|----------|-------|-----------|
| `active` | "Active" | `var(--color-status-working)` |
| `ready` | "Ready" | `var(--color-status-ready)` |
| `idle` | "Idle" | `var(--color-status-idle)` |
| `waiting_input` | "Waiting for input" | `var(--color-status-attention)` |
| `blocked` | "Blocked" | `var(--color-status-error)` |
| `exited` | "Exited" | `var(--color-status-error)` |

**OrchestratorStatusStrip zone colors:**

| Zone | Label | Color | Background |
|------|-------|-------|------------|
| merge | "merge-ready" | `#3fb950` | `rgba(63,185,80,0.1)` |
| respond | "responding" | `#f85149` | `rgba(248,81,73,0.1)` |
| review | "review" | `#d18616` | `rgba(209,134,22,0.1)` |
| working | "working" | `#58a6ff` | `rgba(88,166,255,0.1)` |
| pending | "pending" | `#d29922` | `rgba(210,153,34,0.1)` |
| done | "done" | `#484f58` | `rgba(72,79,88,0.15)` |

**TimelineViewer event categories:**

| Category | Events | Color | Background |
|----------|--------|-------|------------|
| agent | `agent_start`, `agent_stop` | `var(--color-accent)` | `rgba(88,166,255,0.08)` |
| tool | `tool_start`, `tool_end` | `var(--color-status-ready)` | `rgba(63,185,80,0.08)` |
| file | `file_touch` | `var(--color-status-attention)` | `rgba(210,153,34,0.08)` |
| system | (other) | `var(--color-text-muted)` | `rgba(72,79,88,0.08)` |

**CostBreakdownPanel tier labels and colors:**

| Tier | Label | Color |
|------|-------|-------|
| low | "Haiku" | `var(--color-status-ready)` |
| medium | "Sonnet" | `var(--color-status-attention)` |
| high | "Opus" | `var(--color-status-error)` |

**DirectTerminal configuration:**

| Setting | Value |
|---------|-------|
| Font | IBM Plex Mono, SF Mono, Menlo, Monaco |
| Font size | 13px |
| Scrollback | 10000 lines |
| WebSocket port | `NEXT_PUBLIC_DIRECT_TERMINAL_PORT ?? 14801` |
| Selection buffer | 5000ms / 1MB limit |
| Reconnection | 1s → 15s (exponential backoff) |
| Permanent error codes | 4001 (auth), 4004 (session not found) |
| Agent cursor color | `#5b7ef8` |
| Orchestrator cursor color | `#a371f7` |

**SSE hooks for session detail:**

| Hook | SSE Endpoint | Event Type | Poll Interval |
|------|-------------|------------|---------------|
| `useNotepadSSE` | `/api/session/{id}/notepad/stream` | Default `onmessage` | 5000ms (MD5 hash) |
| `useTimelineSSE` | `/api/session/{id}/timeline/stream` | Default `onmessage` | 10000ms (count) |
| `useSessionStateSSE` | `/api/session/{id}/state/stream` | Named `state-update` | 5000ms (JSON.stringify) |
| `useProjectMemorySSE` | `/api/session/{id}/memory/stream` | Named `memory-update` | 5000ms (JSON.stringify) |
| `useCrossSessionMemory` | `/api/cross-session-memory/{project}/stream` | Named `memory-update` | 5000ms (JSON.stringify) |
| `useCostData` | `/api/costs/breakdown?dimension=summary` | None (REST polling) | 30000ms |

**All SSE hooks reconnection:** Exponential backoff 1s → 8s cap (`Math.min(1000 * Math.pow(2, retry), 8000)`), except `useCrossSessionMemory` which has max 10 retries.

**API endpoints used by session detail:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions/{id}` | GET | Session data with PR enrichment |
| `/api/sessions/{id}/issue` | GET | Linked issue data |
| `/api/sessions/{id}/message` | POST | Send message to agent (ask-agent-to-fix) |
| `/api/sessions/{id}/kill` | POST | Kill session |
| `/api/sessions/{id}/restore` | POST | Restore session |
| `/api/sessions/{id}/send` | POST | Send raw input to session |
| `/api/sessions` | GET | All sessions (for zone counts) |
| `/api/session/{id}/notepad` | GET | Notepad content |
| `/api/session/{id}/notepad/stream` | SSE | Notepad SSE stream |
| `/api/session/{id}/timeline` | GET | Timeline entries |
| `/api/session/{id}/timeline/stream` | SSE | Timeline SSE stream |
| `/api/session/{id}/state` | GET | Session state |
| `/api/session/{id}/state/stream` | SSE | State SSE stream |
| `/api/session/{id}/memory` | GET/PUT | Project memory (read/write) |
| `/api/session/{id}/memory/stream` | SSE | Memory SSE stream |
| `/api/costs/breakdown` | GET | Cost breakdown (query: `?dimension=summary`) |
| `/api/cross-session-memory/{project}` | GET/PUT/DELETE | Cross-session memory |
| `/api/cross-session-memory/{project}/stream` | SSE | Cross-session memory SSE |
| `/api/agent/{id}` | GET | Agent detail |
| `/api/agent/{id}/logs` | GET | Agent log tail (query: `?lines=100`) |
| `/api/agent/{id}/resume` | POST | Resume agent (resumable: blocked, ci_failed, changes_requested) |
| `/api/agent/{id}/restart` | POST | Restart agent (kill + respawn) |
| `/api/agent/{id}/reassign` | POST | Kill agent, return story to queue |
| `/api/agent/{id}/ping` | GET | Check agent status |
| `/api/agent/{id}/activity` | GET | Activity events |
| `/api/agent/{id}/capacity` | GET | Agent capacity check |
| `/api/agent/{id}/confidence` | GET | Agent confidence indicators |
| `/api/agent/{id}/reasoning` | GET | Agent reasoning trail |
| `/api/agent/cascade/resume` | POST | Clear cascade state for all agents |

**Key types (from types.ts):**

- `DashboardSession` — 16 fields: id, projectId, status, activity, branch, issueId, issueUrl, issueLabel, issueTitle, summary, summaryIsFallback, createdAt, lastActivityAt, pr, workspacePath, metadata
- `DashboardPR` — 14 fields: number, url, title, owner, repo, branch, baseBranch, isDraft, state, additions, deletions, ciStatus, ciChecks, reviewDecision, mergeability, unresolvedThreads, unresolvedComments
- `IssueData` — 6 fields: id, title, description, state ("open"|"in_progress"|"closed"|"cancelled"), labels, url
- `AttentionLevel` — `"merge" | "respond" | "review" | "pending" | "working" | "done"`
- `NotepadData` — `{ priority: string, working: string, manual: string }`
- `CostSummary` — `{ dimension: "summary", totalTokens, totalCost, byTier: Record<ModelTier, { tokens, cost, sessions }> }`
- `SessionState` — `{ executionMode, activeAgents[], configured, activeModes: ActiveModeState[], health }`
- `ProjectMemory` — `{ entries: ProjectMemoryEntry[] }` where entry has `{ id, type, content, source?, timestamp? }`
- `CrossSessionMemoryEntry` — `{ type, content, contentHash, sourceSessionIds[], lastSeenAt? }`

**Data flow:**
1. Client: `SessionPage` fetches `GET /api/sessions/{id}` → `DashboardSession`
2. Client: Fetches `GET /api/sessions/{id}/issue` → `IssueData | null`
3. Client: If orchestrator, fetches `GET /api/sessions` → zone counts (delayed 2s)
4. Client: Renders `SessionDetail` with all props
5. Client: Each intelligence panel uses its own SSE hook for real-time updates
6. Client: `DirectTerminal` connects via WebSocket to port 14801

### Just the Docs Features Used

- `parent: Web Dashboard` on child page
- Markdown tables for routes, metrics, categories, API endpoints
- `text` syntax highlighting for layout examples
- `typescript` syntax highlighting for type definitions
- `{: .highlight }` callout for important notes

### References

- [Source: packages/web/src/app/sessions/[id]/page.tsx — Session page client component]
- [Source: packages/web/src/components/SessionDetail.tsx — Main session detail component]
- [Source: packages/web/src/components/NotepadViewer.tsx — 3-tab notepad viewer]
- [Source: packages/web/src/components/TimelineViewer.tsx — Agent activity timeline]
- [Source: packages/web/src/components/CostBreakdownPanel.tsx — Model cost breakdown]
- [Source: packages/web/src/components/SessionStatePanel.tsx — Session state panel]
- [Source: packages/web/src/components/ProjectMemoryViewer.tsx — Project memory viewer]
- [Source: packages/web/src/components/CrossSessionMemoryViewer.tsx — Cross-session memory]
- [Source: packages/web/src/components/DirectTerminal.tsx — xterm.js terminal]
- [Source: packages/web/src/components/ActivityDot.tsx — Activity status dot]
- [Source: packages/web/src/components/CIBadge.tsx — CI status badge and check list]
- [Source: packages/web/src/hooks/useNotepadSSE.ts — Notepad SSE hook]
- [Source: packages/web/src/hooks/useTimelineSSE.ts — Timeline SSE hook]
- [Source: packages/web/src/hooks/useCostData.ts — Cost polling hook]
- [Source: packages/web/src/hooks/useSessionStateSSE.ts — Session state SSE hook]
- [Source: packages/web/src/hooks/useProjectMemorySSE.ts — Project memory SSE hook]
- [Source: packages/web/src/hooks/useCrossSessionMemory.ts — Cross-session memory hook]
- [Source: packages/web/src/lib/types.ts — DashboardSession, DashboardPR, IssueData, AttentionLevel]
- [Source: docs/web-dashboard/session-detail.md — Stub to replace]
- [Source: Story 62-34 — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- Story file created with exhaustive source analysis from 3 parallel subagents
- 19 ACs covering all session detail sections
- All component names verified against actual source code
- Actual filenames verified: NotepadViewer.tsx (not NotepadPanel), TimelineViewer.tsx (not SessionTimeline), CostBreakdownPanel.tsx (not ModelCostPanel)
- All SSE event types and polling intervals verified against hook source files
- All 28 API endpoint paths verified against route files
- DirectTerminal uses WebSocket (NOT SSE) on port 14801
- Session page is a CLIENT component with `"use client"` directive
- Route parameter is `[id]` not `[sessionId]`
- PR Card "Ask Agent to Fix" button uses `POST /api/sessions/{id}/message`
- CrossSessionMemoryViewer is config-gated by `learning.crossSessionMemory`
- Documentation page written to `docs/web-dashboard/session-detail.md` — replaced 9-line stub with comprehensive documentation covering all 19 ACs
- All 10 cross-link targets verified to exist on disk
- No hero font classes used
- 4 `{: .highlight }` callouts for important notes
- Front matter includes `description` field for searchability

### File List

- `_bmad-output/implementation-artifacts/62-35-session-detail.md` — story file (created)
- `docs/web-dashboard/session-detail.md` — documentation page (stub replaced with full content)

### Change Log

- **2026-04-24:** Story created — Session Detail documentation page (1 file to replace)
- **2026-04-24:** Implementation complete — stub replaced with comprehensive documentation covering all 19 ACs
- **2026-04-24:** Code review — 6 issues found and fixed (2 medium, 2 low, 1 AC count fix, 1 naming clarification)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Date:** 2026-04-24

### Findings

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | MEDIUM | `buildSessionTitle()` description missing PR case and fallback | [x] Fixed — added all 4 title cases |
| 2 | MEDIUM | Issues list heading is "Blockers" not "Issues list" | [x] Fixed — noted rendered heading |
| 3 | MEDIUM | Progress bar height "1.5px" wrong — `h-1.5` = 6px | [x] Fixed — corrected to Tailwind value |
| 4 | LOW | `"Sending..."` uses ASCII dots, source uses Unicode ellipsis `"Sending…"` | [x] Fixed — matched source |
| 5 | LOW | "Linked Issue Card" section title but component renders "Linked Story" | [x] Fixed — noted rendered heading |
| 6 | AC-1 | DashboardPR field count claimed 14, actual is 17 | [x] Fixed — corrected AC to 17 |

**Outcome:** Approve — all issues fixed
