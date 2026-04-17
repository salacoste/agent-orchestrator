# Story 56.1: Risk Dashboard Overview

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **a dashboard showing all identified risk factors with severity scores**,
so that **I can prioritize risk mitigation efforts effectively**.

## Acceptance Criteria

1. **Given** the system has analyzed project data
   **When** I view the risk dashboard
   **Then** I see all risk factors sorted by severity score (0-100)
   **And** each risk shows type, affected projects, and trend (improving/stable/worsening)
   **And** the dashboard loads within 5 seconds for up to 100 risk items

2. **Given** the risk dashboard is displayed
   **When** I select a specific project from the portfolio
   **Then** the risk factors filter to show only that project's risks
   **And** portfolio-level aggregated risks remain accessible

3. **Given** the risk dashboard is displayed
   **When** I click on a risk factor
   **Then** I see a drill-down detail view with contributing factors and affected stories

## Tasks / Subtasks

- [x] Task 1: Create risk aggregation API endpoint (AC: #1)
  - [x] 1.1: Create `packages/web/src/lib/risk-aggregation.ts` — pure computation module that aggregates risk data from existing sources
  - [x] 1.2: Create `packages/web/src/app/api/risk/dashboard/route.ts` — GET endpoint returning aggregated risk factors
  - [x] 1.3: Define `RiskFactor`, `RiskDashboardResponse` types in the aggregation module

- [x] Task 2: Create RiskDashboard component (AC: #1, #2)
  - [x] 2.1: Create `packages/web/src/components/RiskDashboard.tsx` — main dashboard with risk factor list, severity badges, trend indicators (RiskFactorCard inlined)
  - [-] 2.2: RiskFactorCard inlined into RiskDashboard.tsx instead of separate file — exported for testing
  - [x] 2.3: Project filter using select dropdown (shows when multiple projects)

- [x] Task 3: Create risk detail drill-down (AC: #3)
  - [x] 3.1: Expandable detail view inlined into RiskFactorCard within RiskDashboard.tsx
  - [x] 3.2: Click handler on RiskFactorCard toggles expand/collapse

- [x] Task 4: Wire RiskDashboard into the application (AC: #1)
  - [x] 4.1: Created dedicated route at `packages/web/src/app/risk/page.tsx`
  - [x] 4.2: Added "Risk" navigation item in Navigation.tsx

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Create `packages/web/src/lib/__tests__/risk-aggregation.test.ts` — 21 unit tests
  - [x] 5.2: Create `packages/web/src/app/api/risk/dashboard/route.test.ts` — 8 API route tests
  - [x] 5.3: Create `packages/web/src/components/__tests__/RiskDashboard.test.tsx` — 9 component tests
  - [x] 5.4: Create `packages/web/src/components/__tests__/RiskFactorCard.test.tsx` — 14 card rendering tests

- [x] Task 6: Update sprint-status.yaml
  - [x] 6.1: All 58 tests pass (21 + 8 + 9 + 14 + 6)
  - [x] 6.2: Status set to review

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

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. **Emerging risk detection (Story 56.4)**
   - Status: Deferred — Requires time-series pattern analysis
   - Requires: Velocity trend tracking, blocker pattern detection
   - Epic: Story 56.4 / Epic 56
   - Current: Dashboard shows current snapshot only, no trend detection
2. **Configurable risk alerts (Story 56.5)**
   - Status: Deferred — Requires notification integration
   - Requires: Alert threshold configuration, notification channel routing
   - Epic: Story 56.5 / Epic 56
   - Current: No alerting, dashboard-only display
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`
- `registry.get<Tracker>("tracker", pluginName)` — EXISTING: get tracker plugin for health data
- `computeSprintHealth()` from tracker-bmad — EXISTING: returns `SprintHealthResult { overall, indicators, stuckStories, wipColumns }`
- `computePoolUtilizationOverview()` from `@composio/ao-core/agent-utilization` — EXISTING: pool-level utilization
- `getCapacityStatus()` from `@composio/ao-core/capacity-check` — EXISTING: per-agent capacity warnings
- `computeSprintHealth()` from `@/lib/workflow/cost-tracker` — EXISTING: weighted sprint health score (0-100)

**Feature Flags:**
- None required — all data sources already exist in the codebase

## Dependency Review

No new external dependencies required. This story aggregates data from existing core modules and API endpoints.

## Dev Notes

### Architecture Context

This is **Story 1 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is in the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**After all 11 stories, Epic 56 is complete.**

### What Already Exists (Do NOT Reinvent)

This is an **aggregation and presentation story**. The core already computes all risk-related data:

1. **`packages/core/src/health-check.ts`** — `HealthCheckServiceImpl` with multi-component health monitoring
2. **`packages/core/src/health-check-rules.ts`** — `HealthCheckRulesEngine` with weighted aggregation, per-component thresholds, numeric scores (0-1)
3. **`packages/plugins/tracker-bmad/src/sprint-health.ts`** — Most sophisticated: `computeSprintHealth()` returns `SprintHealthResult { overall: HealthSeverity, indicators: HealthIndicator[], stuckStories, wipColumns }`. Checks: stuck stories (>48h warning, >96h critical), WIP limits, throughput drop (7-day vs 4-week ratio), bottleneck detection (column dwell time).
4. **`packages/core/src/agent-utilization.ts`** — `AgentUtilization`, `ProjectAgentUtilization`, `PoolUtilizationOverview`
5. **`packages/core/src/capacity-check.ts`** — `CapacityResult { isAtCapacity, isNearCapacity, utilizationPercent, availableSlots }`
6. **`packages/core/src/resource-conflict.ts`** — `ResourceConflict` with severity levels
7. **`packages/core/src/confidence-calculator.ts`** — Confidence scores (0-100)
8. **`packages/core/src/cost-tracker.ts`** (web) — `computeSprintHealth()` weighted formula: `completion*0.4 + blockers*0.2 + failures*0.2 + cost*0.2`
9. **`packages/core/src/scope-creep-detector.ts`** — Scope creep detection
10. **`packages/core/src/pre-flight-check.ts`** — `RiskSeverity = "low" | "medium" | "high"`, `RiskFactor { name, severity, description }`

**Existing API routes that already serve risk-related data:**
- `GET /api/health` — System-level health check
- `GET /api/sprint/[project]/health` — Per-project sprint health with indicators
- `GET /api/sprint/health` — Global sprint health score
- `GET /api/pool/utilization` — Pool utilization overview
- `GET /api/pool/capacity` — Per-agent capacity status
- `GET /api/workflow/health-metrics` — Workflow metrics with utilization

### What This Story Actually Does

1. **Risk aggregation module** (`risk-aggregation.ts`): Pure computation that calls existing endpoints/sources and normalizes into a unified `RiskFactor[]` with severity scores (0-100), types, trends, and affected projects
2. **Risk API endpoint** (`/api/risk/dashboard`): Single endpoint returning aggregated risk data
3. **RiskDashboard component**: Renders risk factors in a sorted list with severity badges and trend arrows
4. **RiskFactorCard component**: Individual risk card with type icon, severity badge (color-coded), trend indicator, affected project count
5. **RiskFactorDetail component**: Expandable detail view showing contributing factors and affected stories

### Critical Design Decisions

1. **Aggregate, don't compute** — This story creates a unified view of existing risk data. It does NOT implement new risk scoring algorithms. Use existing `SprintHealthResult.indicators`, `CapacityResult`, `PoolUtilizationOverview`, etc.

2. **Severity normalization** — Multiple sources use different severity scales:
   - `HealthSeverity`: "ok" | "warning" | "critical" → map to 0-33 | 34-66 | 67-100
   - `RiskSeverity`: "low" | "medium" | "high" → map to 0-33 | 34-66 | 67-100
   - `SprintHealth.score`: 0-100 → use directly
   - `WeightedHealthResult.score`: 0-1 → multiply by 100

3. **Risk factor types** — Categorize aggregated risks into types matching the PRD:
   - `high-risk-stories`: Stories with high complexity or many dependencies
   - `resource-bottleneck`: Overloaded agents, capacity warnings
   - `velocity-anomaly`: Throughput drops, scope creep
   - `blocking-pattern`: Stuck stories, dependency chains
   - `scope-creep`: Growing backlog, new stories added mid-sprint

4. **Trend calculation** — For MVP, compare current snapshot to previous (if available). Trend values: "improving" | "stable" | "worsening". If no historical data, default to "stable".

5. **No new dependencies** — Use only existing core modules and React patterns.

### Risk Aggregation Strategy

```
RiskFactor[] = [
  // From SprintHealthResult.indicators (BMAD tracker)
  ...indicators.map(i => ({ type: classifyIndicator(i), severity: mapSeverity(i.severity), ... })),

  // From capacity-check (core)
  ...capacityResults.filter(c => c.isAtCapacity || c.isNearCapacity)
    .map(c => ({ type: "resource-bottleneck", severity: c.isAtCapacity ? 80 : 50, ... })),

  // From pool utilization (core)
  ...utilization.agents.filter(a => a.utilizationPercent > 90 || a.utilizationPercent < 30)
    .map(a => ({ type: a.utilizationPercent > 90 ? "resource-bottleneck" : "underutilized", severity: ..., ... })),

  // From sprint health score (cost-tracker)
  { type: "sprint-health", severity: 100 - sprintHealth.score, ... },
]
```

### Component Layout

```
┌─────────────────────────────────────────────────────────┐
│ Risk Dashboard                              [Project ▼] │
├─────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│ │Crit.│ │High │ │Med. │ │Low  │  ← Summary metric cards │
│ │  3  │ │  5  │ │  8  │ │  2  │                        │
│ └─────┘ └─────┘ └─────┘ └─────┘                        │
├─────────────────────────────────────────────────────────┤
│ ▼ Resource Bottleneck: Agent-7 at 95% capacity    ↑ W   │
│   Type: resource-bottleneck · Severity: 80 · 1 project  │
│   Contributing: 4 stories assigned, 0 available slots    │
├─────────────────────────────────────────────────────────┤
│ ▼ Throughput Drop: 40% decline vs 4-week avg     ↓ W    │
│   Type: velocity-anomaly · Severity: 72 · 1 project     │
│   Contributing: 3 stories blocked > 48h                  │
├─────────────────────────────────────────────────────────┤
│ ▶ Scope Creep: 12 new stories added this sprint   → S   │
│ ▶ WIP Alert: "in-progress" at 8/6 limit          → S   │
│ ▶ Stuck Story: S-42 blocked > 96h                → S   │
└─────────────────────────────────────────────────────────┘
```

### API Response Shape

```json
GET /api/risk/dashboard?project=my-project
{
  "riskFactors": [
    {
      "id": "rb-agent-7",
      "type": "resource-bottleneck",
      "title": "Agent-7 at 95% capacity",
      "severity": 80,
      "severityLabel": "high",
      "trend": "worsening",
      "affectedProjects": ["my-project"],
      "contributingFactors": ["4 stories assigned", "0 available slots"],
      "affectedStories": ["S-42", "S-43", "S-44", "S-45"],
      "suggestedAction": "Consider rebalancing stories to underutilized agents"
    }
  ],
  "summary": {
    "critical": 3,
    "high": 5,
    "medium": 8,
    "low": 2,
    "total": 18
  },
  "lastUpdated": "2026-04-06T12:00:00Z"
}
```

### Testing Strategy

**Unit tests (risk-aggregation.test.ts):**
- Aggregation combines data from multiple sources correctly
- Severity normalization maps each scale correctly
- Risk factor classification matches indicator types
- Empty/missing data returns empty risk factors (not errors)
- Summary counts match filtered results

**API route tests (route.test.ts):**
- Returns 200 with aggregated risk factors for valid project
- Returns 404 for unknown project
- Returns risk factors sorted by severity descending
- Filters by project query param when provided

**Component tests (RiskDashboard.test.tsx, RiskFactorCard.test.tsx):**
- Renders risk factors sorted by severity
- Shows summary metric cards with correct counts
- Project filter updates displayed risks
- Empty state when no risk factors
- Click on risk card expands detail view

### NFRs
- **NFR-E3-1:** Risk analysis refreshes within 5 seconds — aggregation calls existing endpoints (already fast)
- **NFR-E3-2:** Dashboard supports up to 100 concurrent risk items — client-side rendering, no server limit
- **NFR-P1:** Dashboard loads within 2 seconds — lightweight aggregation, no heavy computation
- **NFR-P4:** API endpoint responds within 500ms (p95) — aggregation of cached/fast data

### Pre-existing Types (Use These, Do NOT Modify)
- `HealthSeverity = "ok" | "warning" | "critical"` — from `@composio/ao-plugin-tracker-bmad/sprint-health`
- `HealthIndicator { id, severity, message, details[] }` — from tracker-bmad sprint-health
- `RiskSeverity = "low" | "medium" | "high"` — from `@composio/ao-core/pre-flight-check`
- `RiskFactor { name, severity, description }` — from `@composio/ao-core/pre-flight-check`
- `SprintHealth { score: number, color, components }` — from `@/lib/workflow/cost-tracker`
- `CapacityResult { isAtCapacity, utilizationPercent, availableSlots }` — from `@composio/ao-core/capacity-check`
- `AgentUtilization { agentId, utilizationPercent, ... }` — from `@composio/ao-core/agent-utilization`
- `ComponentHealth { component, status, message }` — from `@composio/ao-core/types`

### References
- [Source: epics-cycle-10.md#Epic 56] — Epic definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E3-1 through FR-E3-6] — Risk Analysis FRs
- [Source: prd-cycle-10.md#NFR-E3-1, NFR-E3-2] — Performance NFRs
- [Source: packages/plugins/tracker-bmad/src/sprint-health.ts] — `computeSprintHealth()` with indicators
- [Source: packages/core/src/capacity-check.ts] — Capacity checking
- [Source: packages/core/src/agent-utilization.ts] — Agent utilization tracking
- [Source: packages/core/src/pre-flight-check.ts] — `RiskFactor`, `RiskSeverity` types
- [Source: packages/web/src/components/HealthIndicators.tsx] — Reference component for health display
- [Source: packages/web/src/components/PortfolioMetricsWidget.tsx] — Reference widget with MetricCard pattern
- [Source: packages/web/src/lib/portfolio-metrics.ts] — `getHealthScoreColor()`, `getHealthStatusLabel()`
- [Source: packages/web/src/app/api/sprint/[project]/health/route.ts] — Reference health API route
- [Source: _bmad-output/implementation-artifacts/55-6-simulation-parameter-configuration.md] — Previous story (done)

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use CSS variables for theming: `var(--color-text-primary)`, `var(--color-bg-surface)`, etc.
- Component text sizes: `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`
- Border radius: `rounded-[6px]` for cards, `rounded-[5px]` for inner elements
- `"use client"` directive at top of components

## Dev Agent Record
### Agent Model Used

Claude Opus 4.6 (Sonnet 4.6)

### Debug Log References

None

### Completion Notes List

- Component structure deviates from story spec: RiskFactorCard and RiskFactorDetail were inlined into RiskDashboard.tsx rather than separate files. RiskFactorCard is exported for testing.
- Route at `/risk` page.tsx instead of SprintBoard analytics tab (cleaner separation of concerns).
- All 58 tests pass across 5 test files (21 unit + 8 API + 9 component + 14 card).

### File List

- `packages/web/src/lib/risk-aggregation.ts` — NEW: risk aggregation module (types + helpers + main aggregation function)
- `packages/web/src/app/api/risk/dashboard/route.ts` — NEW: GET /api/risk/dashboard endpoint
- `packages/web/src/app/risk/page.tsx` — NEW: risk dashboard page route
- `packages/web/src/components/RiskDashboard.tsx` — NEW: main dashboard component with inlined RiskFactorCard
- `packages/web/src/components/Navigation.tsx` — MODIFIED: added "Risk" nav item
- `packages/web/src/lib/__tests__/risk-aggregation.test.ts` — NEW: 21 unit tests
- `packages/web/src/app/api/risk/dashboard/route.test.ts` — NEW: 8 API route tests
- `packages/web/src/components/__tests__/RiskDashboard.test.tsx` — NEW: 9 component tests
- `packages/web/src/components/__tests__/RiskFactorCard.test.tsx` — NEW: 14 card tests
- `packages/web/src/components/__tests__/Navigation.test.tsx` — MODIFIED: updated for new nav item
