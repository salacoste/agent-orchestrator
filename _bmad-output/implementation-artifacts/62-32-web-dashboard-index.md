# Story 62.32: Web Dashboard Index

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Web Dashboard index page that documents the dashboard's 16 page routes, 10-item navigation, 9 SSE hooks, layout architecture, design system, and API route connections,
so that I can understand the dashboard's full feature set, real-time capabilities, and how each page connects to backend services before diving into individual page documentation.

## Acceptance Criteria

1. **Web Dashboard index page** (`docs/web-dashboard/index.md`) documents an "Overview" section describing the dashboard as a Next.js 15 + React 19 + Tailwind CSS v4 single-page application with dark theme, IBM Plex fonts, and PWA support — sourced from `packages/web/src/app/layout.tsx`
2. **Web Dashboard index page** documents a "Pages" section with a summary table of all 16 page routes (Dashboard, Portfolio, Portfolio Detail, Sprints, Session Detail, Scenarios, Scenario Detail, Scenario Compare, Conflicts, Risk, Events, Fleet, Workflow, Settings) with route path, component, and description — sourced from `packages/web/src/app/*/page.tsx` files
3. **Web Dashboard index page** documents a "Navigation" section describing the 10-item horizontal top bar (Dashboard, Portfolio, Sprints, Scenarios, Conflicts, Fleet, Workflow, Events, Risk, Settings), responsive mobile hamburger menu, and active-state detection via `usePathname()` — sourced from `packages/web/src/components/Navigation.tsx`
4. **Web Dashboard index page** documents a "Layout Architecture" section describing: root layout structure (`<html>` → `<AppNav>` → `<MobileStatusBar>` → `{children}`), dark mode forced via `class="dark"`, IBM Plex Sans/Mono fonts, PWA manifest and service worker registration via `useServiceWorker()` — sourced from `packages/web/src/app/layout.tsx`
5. **Web Dashboard index page** documents a "Real-Time Updates (SSE)" section with a summary table of all 9 SSE hooks, their endpoints, event types, and state management — sourced from `packages/web/src/hooks/useSSE*.ts`, `useSessionEvents.ts`, `useConflictSSE.ts`, `useRiskAlertSSE.ts`, `useWorkflowSSE.ts`, `useTimelineSSE.ts`, `useNotepadSSE.ts`, `useProjectMemorySSE.ts`, `useSessionStateSSE.ts`
6. **Web Dashboard index page** documents SSE architecture patterns: global multiplexed endpoint (`/api/events`) used by 5 hooks vs session-scoped dedicated endpoints (`/api/session/[id]/*/stream`) used by 4 hooks; manual exponential backoff reconnection (1s, 2s, 4s, 8s cap) used by most hooks; two hooks use named SSE events via `addEventListener` (`useSessionStateSSE`, `useProjectMemorySSE`)
7. **Web Dashboard index page** documents a "Design System" section covering: Tailwind CSS v4 with `@theme` block, background/border/text/accent/status color tokens, custom CSS classes (`.orchestrator-btn`, `.nav-glass`, `.detail-card`, `.session-card`), and animations (`activity-pulse`, `spin`, `slide-up`, `highlight-pulse`) — sourced from `packages/web/src/app/globals.css`
8. **Web Dashboard index page** documents a "Backend Services" section describing the `Services` singleton (`config`, `registry`, `sessionManager`, `learningStore`) initialized via `getServices()` with 8 statically registered plugins — sourced from `packages/web/src/lib/services.ts`
9. **Web Dashboard index page** documents a "Key Types" section listing the major type groups from `packages/web/src/lib/types.ts`: DashboardSession, DashboardPR, PortfolioProject, PortfolioMetrics, SSE event types, UnifiedSprintEntry, WhatIfScenario, and the `getAttentionLevel()` function
10. **Web Dashboard index page** documents a "Child Pages" section listing all 7 child documentation pages with brief descriptions and links: Portfolio View, Sprint Board, Session Detail, Scenario Comparison, Conflict Resolution, Risk Management, Workflow Events & Fleet
11. **Page uses correct Just the Docs front matter**: `title: Web Dashboard`, `nav_order: 6`, `has_children: true`, `description` field
12. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
13. **Cross-links** verified: links to Getting Started, Configuration, Core Concepts (8 Plugin Slots), and all 7 child pages

## Tasks / Subtasks

- [x] Task 1: Write Web Dashboard index page (AC: #1-13)
  - [x] Replace stub content in docs/web-dashboard/index.md
  - [x] Update front matter (add `description` field, verify nav_order: 6, has_children: true)
  - [x] Write "Overview" section — tech stack, dark theme, PWA, fonts (AC #1)
  - [x] Write "Pages" section — 16-page summary table with routes, components, descriptions (AC #2)
  - [x] Write "Navigation" section — 10-item nav, responsive hamburger, active state (AC #3)
  - [x] Write "Layout Architecture" section — root layout, AppNav, MobileStatusBar, dark mode, PWA (AC #4)
  - [x] Write "Real-Time Updates (SSE)" section — 9-hook table with endpoints, events, state (AC #5)
  - [x] Write SSE architecture patterns subsection — global vs session-scoped, reconnection, named events (AC #6)
  - [x] Write "Design System" section — color tokens, custom CSS classes, animations (AC #7)
  - [x] Write "Backend Services" section — Services singleton, plugin registration (AC #8)
  - [x] Write "Key Types" section — major type groups from types.ts (AC #9)
  - [x] Write "Child Pages" section — 7 child page links with descriptions (AC #10)
  - [x] Write "Next Steps" cross-links section (AC #13)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All page routes verified against actual app directory structure
- All SSE hooks verified against actual hook source files
- No hero font classes
- Cross-links verified
- All code blocks use correct syntax highlighting

## Dev Notes

### Design Decisions

- **This story covers the Web Dashboard INDEX (parent) page** — the 7 child pages (Portfolio View, Sprint Board, Session Detail, Scenario Comparison, Conflict Resolution, Risk Management, Workflow Events & Fleet) are separate stories (62-33 through 62-39)
- **The stub file** at `docs/web-dashboard/index.md` has front matter with `title: Web Dashboard`, `nav_order: 6`, `has_children: true` — needs `description` added and "Content coming soon -- Story 62.18." replaced
- **16 page routes** found in app directory (10 in navigation + 4 drill-down + 2 dev/test pages excluded from docs)
- **9 SSE hooks** (not 11 as the epic definition says — the discrepancy is because `useConflictCheckpoint` is REST polling, not SSE, and `useCrossSessionMemory` is a REST hook)
- **Epic definition says "11 SSE hooks"** but only 9 are actual SSE hooks — count discrepancy to note
- **This is an INDEX page**, not a command reference — the structure should be: overview → pages table → navigation → architecture → SSE → design system → backend → types → child pages
- **Pages are server components by default** with `force-dynamic` — only `/sessions/[id]`, `/events`, and `/fleet` are client components

### Previous Story Learnings (62-31)

- Source strings must be quoted EXACTLY from source — no paraphrasing
- Front matter needs `description` field for searchability
- Cross-link file existence must be verified
- No hero font classes (`.fs-5`, `.fw-300`)
- `{: .highlight }` callout for important notes
- Syntax highlighting: `bash` for CLI examples, `text` for output examples, `typescript` for code
- Epic definitions may not match actual implementation — always verify against source code

### Source Files

- **packages/web/src/app/layout.tsx** — Root layout (AppNav, MobileStatusBar, fonts, PWA, dark mode)
- **packages/web/src/app/page.tsx** — Home/Dashboard page (HomeView component)
- **packages/web/src/app/portfolio/page.tsx** — Portfolio page (PortfolioView component)
- **packages/web/src/app/portfolio/[projectId]/page.tsx** — Project detail page
- **packages/web/src/app/sprints/page.tsx** — Sprints page (UnifiedSprintView component)
- **packages/web/src/app/sessions/[id]/page.tsx** — Session detail page (SessionDetail component)
- **packages/web/src/app/scenarios/page.tsx** — Scenarios page (ScenariosView component)
- **packages/web/src/app/scenarios/[id]/page.tsx** — Scenario detail page
- **packages/web/src/app/scenarios/compare/page.tsx** — Scenario comparison page
- **packages/web/src/app/conflicts/page.tsx** — Conflicts page (ConflictAlertDashboard)
- **packages/web/src/app/risk/page.tsx** — Risk page (RiskScorePanel + RiskDashboard + BottleneckDashboard + UtilizationMetricsPanel + OptimizationPanel)
- **packages/web/src/app/events/page.tsx** — Events page (audit trail with SSE)
- **packages/web/src/app/fleet/page.tsx** — Fleet page (FleetMatrix component)
- **packages/web/src/app/workflow/page.tsx** — Workflow page (WorkflowPage component)
- **packages/web/src/app/settings/page.tsx** — Settings page (config inspector)
- **packages/web/src/components/Navigation.tsx** — Top navigation bar (10 links, responsive)
- **packages/web/src/components/AppNav.tsx** — Navigation client wrapper
- **packages/web/src/components/MobileStatusBar.tsx** — Mobile status bar (health badge, agent count)
- **packages/web/src/hooks/useSSEConnection.ts** — Generic SSE multiplexer (5 event types)
- **packages/web/src/hooks/useSessionEvents.ts** — Session snapshot SSE (reducer-based)
- **packages/web/src/hooks/useConflictSSE.ts** — Conflict detection SSE
- **packages/web/src/hooks/useRiskAlertSSE.ts** — Risk alert SSE (activeAlerts state)
- **packages/web/src/hooks/useWorkflowSSE.ts** — Workflow change SSE (callback)
- **packages/web/src/hooks/useSessionStateSSE.ts** — Session state SSE (named events, dedicated endpoint)
- **packages/web/src/hooks/useTimelineSSE.ts** — Timeline SSE (dedicated endpoint)
- **packages/web/src/hooks/useNotepadSSE.ts** — Notepad SSE (dedicated endpoint)
- **packages/web/src/hooks/useProjectMemorySSE.ts** — Project memory SSE (named events, dedicated endpoint)
- **packages/web/src/lib/services.ts** — Backend Services singleton (config, registry, sessionManager, learningStore)
- **packages/web/src/lib/types.ts** — All dashboard types (DashboardSession, DashboardPR, Portfolio types, SSE types, Sprint types, Scenario types)
- **packages/web/src/app/globals.css** — Design system (Tailwind v4 theme tokens, custom classes, animations)
- **docs/web-dashboard/index.md** — Replace stub with full documentation
- **docs/web-dashboard/portfolio-view.md** — Child page for cross-reference
- **docs/web-dashboard/sprint-board.md** — Child page for cross-reference
- **docs/web-dashboard/session-detail.md** — Child page for cross-reference
- **docs/web-dashboard/scenario-comparison.md** — Child page for cross-reference
- **docs/web-dashboard/conflict-resolution.md** — Child page for cross-reference
- **docs/web-dashboard/risk-management.md** — Child page for cross-reference
- **docs/web-dashboard/workflow-events-fleet.md** — Child page for cross-reference

### Key Dashboard Facts (verified against source)

**Page count**: 16 page routes (10 in navigation, 4 drill-down, 2 dev/test pages excluded)

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/` | `HomeView` | Server (force-dynamic) | Primary dashboard with enriched sessions, PR/CI status, agent summaries |
| `/portfolio` | `PortfolioView` | Server (force-dynamic) | Multi-project portfolio with aggregated story counts and progress |
| `/portfolio/[projectId]` | `Dashboard` + project header | Server (force-dynamic) | Single project drill-down with filtered sessions |
| `/sprints` | `UnifiedSprintView` | Server (force-dynamic) | Cross-project sprint tracking with health scores and velocity |
| `/sessions/[id]` | `SessionDetail` | Client | Agent session detail with live polling (5s) and tab title updates |
| `/scenarios` | `ScenariosView` | Server (force-dynamic) | What-if scenario planning with project story counts |
| `/scenarios/[id]` | `ScenarioDetail` | Server (force-dynamic) | Single scenario detail with revision history |
| `/scenarios/compare` | `ScenarioComparisonView` | Server | Side-by-side scenario comparison (`?ids=` query param) |
| `/conflicts` | `ConflictAlertDashboard` | Server (force-dynamic) | Resource conflict detection (file-path, branch conflicts) |
| `/risk` | 5 stacked panels | Server (force-dynamic) | Risk scoring, bottlenecks, utilization, optimization |
| `/events` | Inline + `EventDetailModal` | Client | Audit trail with SSE, pagination, filtering, JSONL export |
| `/fleet` | `FleetMatrix` | Client | Real-time fleet monitoring with SSE auto-refresh |
| `/workflow` | `WorkflowPage` | Server (force-dynamic) | Workflow visualization and management |
| `/settings` | Inline | Server (force-dynamic) | Read-only config inspector (plugins, projects, reactions) |

**SSE Hook count**: 9 hooks (5 global endpoint, 4 session-scoped)

| Hook | Endpoint | Event Type | Named Event? | Reconnect | State |
|------|----------|------------|-------------|-----------|-------|
| `useSSEConnection` | `/api/events` | `story.*`, `agent.*`, `cascade.*` | No | Manual exp. backoff | `connected`, `reconnecting` |
| `useSessionEvents` | `/api/events` | `snapshot` | No | Browser auto | `sessions[]` (reducer) |
| `useConflictSSE` | `/api/events` | `conflict-detected` | No | Browser auto | callback only |
| `useRiskAlertSSE` | `/api/events` | `risk-alert` | No | Browser auto | `activeAlerts[]`, `acknowledge()` |
| `useWorkflowSSE` | `/api/events` | `workflow-change` | No | Manual exp. backoff | callback only |
| `useSessionStateSSE` | `/api/session/[id]/state/stream` | `state-update` | **Yes** | Manual exp. backoff | `state`, `exists`, `connected` |
| `useTimelineSSE` | `/api/session/[id]/timeline/stream` | `timeline-update` | No | Manual exp. backoff | `timeline[]`, `connected` |
| `useNotepadSSE` | `/api/session/[id]/notepad/stream` | `notepad-update` | No | Manual exp. backoff | `notepad`, `exists`, `connected` |
| `useProjectMemorySSE` | `/api/session/[id]/memory/stream` | `memory-update` | **Yes** | Manual exp. backoff | `memory`, `exists`, `connected` |

**Navigation items** (from Navigation.tsx): Dashboard `/`, Portfolio `/portfolio`, Sprints `/sprints`, Scenarios `/scenarios`, Conflicts `/conflicts`, Fleet `/fleet`, Workflow `/workflow`, Events `/events`, Risk `/risk`, Settings `/settings`

**Registered plugins** (from services.ts): pluginRuntimeTmux, pluginAgentClaudeCode, pluginAgentGlm, pluginWorkspaceWorktree, pluginScmGithub, pluginTrackerBmad, pluginTrackerGithub, pluginTrackerLinear

**Design tokens** (from globals.css):
- Backgrounds: `bg-base` (#0d1117), `bg-surface`, `bg-elevated`, `bg-subtle`
- Text: `text-primary` (#e6edf3), `text-secondary` (#7d8590), `text-muted` (#484f58)
- Accent: `accent` (#58a6ff blue)
- Status: `working` (blue), `ready` (green), `attention` (yellow), `idle` (gray), `error` (red)
- Custom classes: `.orchestrator-btn`, `.nav-glass`, `.detail-card`, `.session-card`

**Key types** (from types.ts):
- `DashboardSession` — flattened session with PR, issue, summary data
- `DashboardPR` — flattened PR with CI, review, mergeability data
- `AttentionLevel` — "merge" | "respond" | "review" | "pending" | "working" | "done"
- `PortfolioProject` — project with status, agents, stories, shared pool config, capacity
- `PortfolioMetrics` — cross-project aggregates with health score and utilization
- `SSESnapshotEvent`, `SSEActivityEvent` — SSE event type definitions
- `UnifiedSprintEntry` / `UnifiedSprintSummary` — sprint aggregation types
- `WhatIfScenario` — scenario with parameters, simulation result
- `getAttentionLevel(session)` — priority-ordered attention computation

### Just the Docs Features Used

- `has_children: true` on parent page
- Markdown tables for page routes, SSE hooks, navigation items
- `text` syntax highlighting for config/code examples
- `{: .highlight }` callout for important notes

### References

- [Source: packages/web/src/app/layout.tsx — Root layout, AppNav, MobileStatusBar, PWA]
- [Source: packages/web/src/app/page.tsx — Dashboard/Home page]
- [Source: packages/web/src/app/portfolio/page.tsx — Portfolio page]
- [Source: packages/web/src/app/sprints/page.tsx — Sprints page]
- [Source: packages/web/src/app/sessions/[id]/page.tsx — Session detail page]
- [Source: packages/web/src/app/scenarios/page.tsx — Scenarios page]
- [Source: packages/web/src/app/conflicts/page.tsx — Conflicts page]
- [Source: packages/web/src/app/risk/page.tsx — Risk page]
- [Source: packages/web/src/app/events/page.tsx — Events page]
- [Source: packages/web/src/app/fleet/page.tsx — Fleet page]
- [Source: packages/web/src/app/workflow/page.tsx — Workflow page]
- [Source: packages/web/src/app/settings/page.tsx — Settings page]
- [Source: packages/web/src/components/Navigation.tsx — Top navigation bar]
- [Source: packages/web/src/hooks/useSSEConnection.ts — Generic SSE multiplexer]
- [Source: packages/web/src/hooks/useSessionEvents.ts — Session snapshot SSE]
- [Source: packages/web/src/hooks/useConflictSSE.ts — Conflict SSE]
- [Source: packages/web/src/hooks/useRiskAlertSSE.ts — Risk alert SSE]
- [Source: packages/web/src/hooks/useWorkflowSSE.ts — Workflow SSE]
- [Source: packages/web/src/hooks/useSessionStateSSE.ts — Session state SSE]
- [Source: packages/web/src/hooks/useTimelineSSE.ts — Timeline SSE]
- [Source: packages/web/src/hooks/useNotepadSSE.ts — Notepad SSE]
- [Source: packages/web/src/hooks/useProjectMemorySSE.ts — Project memory SSE]
- [Source: packages/web/src/lib/services.ts — Backend Services singleton]
- [Source: packages/web/src/lib/types.ts — Dashboard types]
- [Source: packages/web/src/app/globals.css — Design system]
- [Source: docs/web-dashboard/index.md — Stub to replace]
- [Source: Story 62-31 — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- 1 documentation file written replacing stub (docs/web-dashboard/index.md)
- All 13 ACs satisfied
- 16 page routes documented with route, component, rendering mode, and description
- 9 SSE hooks documented in two architecture pattern tables (global multiplexed + session-scoped)
- 10-item navigation documented with responsive behavior
- Layout architecture documented (AppNav, MobileStatusBar, fonts, PWA, dark mode)
- Design system documented (color tokens, custom CSS classes, animations)
- Backend Services singleton documented with 8 registered plugins
- Key Types section covers 8 major type groups + getAttentionLevel function
- Child Pages section lists all 7 child docs with descriptions and links
- Cross-links verified: Getting Started, Configuration, Core Concepts, all 7 child pages
- Front matter correct: title, nav_order: 6, has_children: true, description present
- No hero font classes on page
- All code blocks use correct syntax highlighting (text for layouts, typescript for code)

### File List

- `docs/web-dashboard/index.md` — replace stub with Web Dashboard index documentation

### Change Log

- **2026-04-24:** Story created — Web Dashboard Index documentation page (1 file to replace)
- **2026-04-24:** Task 1 completed — Web Dashboard Index page written with all sections, SSE hooks, pages table, design system, and cross-links
- **2026-04-24:** Story marked review — Phase 5 (Web Dashboard) started
- **2026-04-24:** Code review — 5 findings (1 MEDIUM, 4 LOW), all fixed
- **2026-04-24:** Second-pass review — 2 findings (1 MEDIUM, 1 LOW), all fixed
- **2026-04-24:** Story marked done

### Senior Developer Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (5 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[MEDIUM]** Fix route count: 14→16 (10 nav + 4 drill-down + 2 dev/test, not 12+2)
- [x] **[LOW]** Fix `force-dynamic` blanket claim — `/scenarios/compare` is the exception
- [x] **[LOW]** Fix `useRiskAlertSSE` state — add missing `acknowledge()` function
- [x] **[LOW]** Fix `learningStore` interface — `append?` is optional, not `append`
- [x] **[LOW]** Fix navigation count — 10 items in nav, not 12

### Second-Pass Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (2 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[MEDIUM]** Fix default port — 3000 → 5000 (source: `packages/web/package.json` uses `${PORT:-5000}`)
- [x] **[LOW]** Fix startup instructions — remove misleading `pnpm build` prerequisite (`next dev` does not require prior build)
