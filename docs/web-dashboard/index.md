---
title: Web Dashboard
nav_order: 6
has_children: true
description: Web dashboard for monitoring and managing parallel AI coding agents — pages, real-time SSE updates, navigation, and design system
---

# Web Dashboard

The Agent Orchestrator web dashboard is a **Next.js 15 + React 19 + Tailwind CSS v4** single-page application that provides real-time visibility into your agent fleet, sprint progress, risk analytics, and more.

{: .highlight }
The dashboard reads from `agent-orchestrator.yaml` and the session metadata directory. Start it with `cd packages/web && pnpm dev`.

## Overview

| Feature | Technology |
|---------|-----------|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 with custom theme tokens |
| Fonts | IBM Plex Sans (300–700), IBM Plex Mono (300–500) |
| Theme | Dark mode only (`class="dark"`) |
| Real-time | Server-Sent Events (SSE) via 9 custom hooks |
| PWA | Manifest + service worker registration |

The dashboard runs on port 5000 by default (configurable via the `PORT` environment variable). It loads its configuration from `agent-orchestrator.yaml` in the working directory and initializes a `Services` singleton with the config, plugin registry, session manager, and learning store. See [Getting Started](../getting-started/) for setup instructions.

## Pages

The dashboard has **16 page routes** — 10 are accessible from the navigation bar, 4 are drill-down pages reached by clicking through other views, and 2 are development/test pages (not documented).

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/` | `HomeView` | Server | Primary dashboard with enriched sessions, PR/CI status, and agent summaries |
| `/portfolio` | `PortfolioView` | Server | Multi-project portfolio with aggregated story counts and progress |
| `/portfolio/[projectId]` | `Dashboard` + project header | Server | Single project drill-down with filtered sessions |
| `/sprints` | `UnifiedSprintView` | Server | Cross-project sprint tracking with health scores and velocity |
| `/sessions/[id]` | `SessionDetail` | Client | Agent session detail with live polling (5 s) and dynamic tab title |
| `/scenarios` | `ScenariosView` | Server | What-if scenario planning with project story counts |
| `/scenarios/[id]` | `ScenarioDetail` | Server | Single scenario detail with revision history |
| `/scenarios/compare` | `ScenarioComparisonView` | Server | Side-by-side scenario comparison (`?ids=` query param) |
| `/conflicts` | `ConflictAlertDashboard` | Server | Resource conflict detection (file-path, branch conflicts) |
| `/risk` | 5 stacked panels | Server | Risk scoring, bottlenecks, utilization metrics, optimization |
| `/events` | Inline + `EventDetailModal` | Client | Audit trail with SSE, pagination, filtering, JSONL export |
| `/fleet` | `FleetMatrix` | Client | Real-time fleet monitoring with SSE auto-refresh |
| `/workflow` | `WorkflowPage` | Server | Workflow visualization and management |
| `/settings` | Inline | Server | Read-only config inspector (plugins, projects, reactions) |

Server pages use `force-dynamic` rendering (except `/scenarios/compare`). Client pages (`/sessions/[id]`, `/events`, `/fleet`) fetch data via API calls and SSE streams.

## Navigation

The dashboard uses a **horizontal top navigation bar** with 10 links:

```text
Dashboard | Portfolio | Sprints | Scenarios | Conflicts | Fleet | Workflow | Events | Risk | Settings
```

- **Active-state detection** uses `usePathname()` — the current route is highlighted with primary text color
- **Responsive layout** — on mobile (`< md` breakpoint) the nav collapses into a hamburger menu with a dropdown
- **Mobile status bar** — on small screens, a `MobileStatusBar` component shows a health badge, active agent count, and blocker count, fetched from `/api/sprint/digest`

## Layout Architecture

All pages share a root layout (`packages/web/src/app/layout.tsx`) that renders:

```text
<html lang="en" class="dark">
  <body>
    <AppNav />              <!-- top navigation bar (always visible) -->
    <MobileStatusBar />     <!-- mobile-only health/agent summary -->
    {children}              <!-- page content -->
  </body>
</html>
```

- **`AppNav`** — client wrapper that reads `usePathname()` and delegates to `<Navigation />`
- **`MobileStatusBar`** — client component (`md:hidden`) with health badge, agent count, blocker count, and PWA service worker registration via `useServiceWorker()`
- **Fonts** — IBM Plex Sans and IBM Plex Mono loaded via `next/font/google`, exposed as CSS variables `--font-ibm-plex-sans` and `--font-ibm-plex-mono`
- **Metadata** — dynamic title template `%s | {projectName}` with PWA manifest and Apple Web App configuration

## Real-Time Updates (SSE)

The dashboard uses **9 Server-Sent Events (SSE) hooks** for real-time updates. They follow two architecture patterns:

### Global Multiplexed Endpoint

Five hooks connect to `/api/events` — a single SSE stream that carries multiple event types, differentiated by a `type` field in the JSON payload.

| Hook | Event Types | State | Reconnect |
|------|-------------|-------|-----------|
| `useSSEConnection` | `story.started`, `story.completed`, `story.blocked`, `agent.status_changed`, `cascade.triggered` | `connected`, `reconnecting` | Manual exp. backoff (1 s → 8 s cap) |
| `useSessionEvents` | `snapshot` | `sessions[]` (useReducer) | Browser auto-reconnect |
| `useConflictSSE` | `conflict-detected` | callback only | Browser auto-reconnect |
| `useRiskAlertSSE` | `risk-alert` | `activeAlerts[]`, `acknowledge()` | Browser auto-reconnect |
| `useWorkflowSSE` | `workflow-change` | callback only | Manual exp. backoff (1 s → 8 s cap) |

### Session-Scoped Dedicated Endpoints

Four hooks connect to per-session SSE streams (`/api/session/[id]/*/stream`). Each performs an initial REST fetch for immediate data, then subscribes to the SSE stream for live updates.

| Hook | Endpoint | Event Type | State | Reconnect |
|------|----------|------------|-------|-----------|
| `useSessionStateSSE` | `/api/session/[id]/state/stream` | `state-update` (named event) | `state`, `exists`, `connected` | Manual exp. backoff |
| `useTimelineSSE` | `/api/session/[id]/timeline/stream` | `timeline-update` | `timeline[]`, `connected` | Manual exp. backoff |
| `useNotepadSSE` | `/api/session/[id]/notepad/stream` | `notepad-update` | `notepad`, `exists`, `connected` | Manual exp. backoff |
| `useProjectMemorySSE` | `/api/session/[id]/memory/stream` | `memory-update` (named event) | `memory`, `exists`, `connected` | Manual exp. backoff |

{: .highlight }
`useSessionStateSSE` and `useProjectMemorySSE` use **named SSE events** via `addEventListener` instead of the default `onmessage` handler. This distinction is critical when extending the SSE infrastructure.

The manual exponential backoff strategy starts at 1 second and doubles up to an 8-second cap on each retry.

## Design System

The dashboard uses **Tailwind CSS v4** with a custom `@theme` block in `globals.css`. Key design tokens:

| Category | Tokens |
|----------|--------|
| Backgrounds | `bg-base` (#0d1117), `bg-surface`, `bg-elevated`, `bg-subtle` |
| Borders | `border-subtle`, `border-default`, `border-strong` |
| Text | `text-primary` (#e6edf3), `text-secondary` (#7d8590), `text-muted` (#484f58) |
| Accent | `accent` (#58a6ff blue), `accent-hover`, `accent-subtle` |
| Status | `working` (blue), `ready` (green), `attention` (yellow), `idle` (gray), `error` (red) |

**Custom CSS classes:**

| Class | Purpose |
|-------|---------|
| `.orchestrator-btn` | Gradient blue button with glow effect |
| `.nav-glass` | Frosted glass effect with backdrop blur |
| `.detail-card` | Subtle depth card for detail views |
| `.session-card` | Hoverable card with green glow variant (`.card-merge-ready`) |

**Animations:** `activity-pulse`, `spin`, `pulse`, `slide-up`, `highlight-pulse`

## Backend Services

All API routes share a **`Services` singleton** initialized by `getServices()` in `packages/web/src/lib/services.ts`:

```typescript
interface Services {
  config: OrchestratorConfig;
  registry: PluginRegistry;
  sessionManager: SessionManager;
  learningStore?: { list(); query(); append?() };
}
```

The singleton is cached in `globalThis._aoServices` to survive HMR. It registers **8 plugins** statically (required for webpack bundling):

| Slot | Plugin |
|------|--------|
| Runtime | `pluginRuntimeTmux` |
| Agent | `pluginAgentClaudeCode`, `pluginAgentGlm` |
| Workspace | `pluginWorkspaceWorktree` |
| SCM | `pluginScmGithub` |
| Tracker | `pluginTrackerBmad`, `pluginTrackerGithub`, `pluginTrackerLinear` |

## Key Types

The dashboard's TypeScript types are defined in `packages/web/src/lib/types.ts`:

| Type | Description |
|------|-------------|
| `DashboardSession` | Flattened session with PR, issue, and summary data |
| `DashboardPR` | Flattened PR with CI checks, review decision, mergeability |
| `AttentionLevel` | Priority ordering: `merge` > `respond` > `review` > `pending` > `working` > `done` |
| `PortfolioProject` | Per-project data: status, agents, stories, shared pool, capacity |
| `PortfolioMetrics` | Cross-project aggregates with health score (0–100) and utilization |
| `UnifiedSprintEntry` | Per-project sprint: dates, story counts, health, velocity |
| `WhatIfScenario` | Scenario with parameters, simulation result, status |
| `SSESnapshotEvent` | SSE snapshot with session status, activity, attention level |

The `getAttentionLevel(session)` function computes the highest-priority attention state for a session, checking in order: done, merge-ready, needs-response, needs-review, pending, and working.

## Child Pages

Detailed documentation for each dashboard page:

| Page | Description |
|------|-------------|
| [Portfolio View](portfolio-view/) | Project grid, cards with status/metrics/health, filtering, aggregated metrics |
| [Sprint Board](sprint-board/) | Story columns, assignment interface, sprint metrics, drill-down |
| [Session Detail](session-detail/) | Timeline visualization, log streaming, output/artifacts, agent controls |
| [Scenario Comparison](scenario-comparison/) | Monte Carlo interface, what-if parameters, forecast visualization |
| [Conflict Resolution](conflict-resolution/) | Conflict visualization, policy configuration, resolution workflows |
| [Risk Management](risk-management/) | Risk score, utilization metrics, optimization recommendations, alerts |
| [Workflow Events & Fleet](workflow-events-fleet/) | Workflow builder, event stream (SSE), fleet management |

## Next Steps

- [Getting Started](../getting-started/) — install and run the dashboard
- [Configuration](../getting-started/configuration.md) — configure projects, plugins, and reactions
- [Core Concepts](../core-concepts/) — understand the 8 plugin slots
- [CLI Reference](../cli/) — manage agents and sprints from the terminal
