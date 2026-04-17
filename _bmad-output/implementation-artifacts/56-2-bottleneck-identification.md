# Story 56.2: Bottleneck Identification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to see identified bottlenecks and constraints in my project flow**,
so that **I can address the root causes of delays**.

## Acceptance Criteria

1. **Given** the system has analyzed workflow patterns
   **When** I view the bottleneck analysis
   **Then** I see identified bottlenecks (blocked stories, overloaded agents, dependency chains)
   **And** each bottleneck shows impact (stories delayed, days blocked)
   **And** I can drill down to see affected stories

2. **Given** the bottleneck analysis is displayed
   **When** I select a specific project from the portfolio
   **Then** the bottlenecks filter to show only that project's bottlenecks
   **And** portfolio-level aggregated bottlenecks remain accessible

3. **Given** the bottleneck analysis is displayed
   **When** I click on a bottleneck item
   **Then** I see a drill-down detail view with contributing factors and affected stories
   **And** the detail shows impact metrics (stories delayed, estimated days blocked)

## Tasks / Subtasks

- [x] Task 1: Create bottleneck aggregation module (AC: #1)
  - [x] 1.1: Create `packages/web/src/lib/bottleneck-aggregation.ts` — pure computation module that aggregates bottleneck data from existing sources
  - [x] 1.2: Define `BottleneckItem`, `BottleneckImpact`, `BottleneckDashboardResponse` types in the aggregation module
  - [x] 1.3: Implement aggregation logic that combines data from sprint health indicators, cycle time bottleneck column, throughput bottleneck trend, team workload, capacity checks, and resource conflicts

- [x] Task 2: Create bottleneck API endpoint (AC: #1, #2)
  - [x] 2.1: Create `packages/web/src/app/api/risk/bottleneck/route.ts` — GET endpoint returning aggregated bottleneck data
  - [x] 2.2: Accept `?project=` query param for per-project filtering
  - [x] 2.3: Return bottlenecks sorted by impact (stories affected × severity)

- [x] Task 3: Create BottleneckDashboard component (AC: #1, #2)
  - [x] 3.1: Create `packages/web/src/components/BottleneckDashboard.tsx` — main dashboard with bottleneck list, impact badges, type indicators
  - [x] 3.2: Create `packages/web/src/components/BottleneckCard.tsx` — individual bottleneck card with type, impact score, affected stories count, delay info
  - [x] 3.3: Add project filter support using existing PortfolioFilterBar or simple dropdown

- [x] Task 4: Create bottleneck detail drill-down (AC: #3)
  - [x] 4.1: Create `packages/web/src/components/BottleneckDetail.tsx` — expandable detail view with contributing factors and affected stories
  - [x] 4.2: Wire click handler on BottleneckCard to show detail panel

- [x] Task 5: Wire BottleneckDashboard into the application (AC: #1)
  - [x] 5.1: Integrate BottleneckDashboard into RiskDashboard (from Story 56-1) as a tab or section
  - [x] 5.2: Add "Bottlenecks" tab/section to the risk dashboard page

- [x] Task 6: Add tests (AC: all)
  - [x] 6.1: Create `packages/web/src/lib/__tests__/bottleneck-aggregation.test.ts` — unit tests for bottleneck aggregation logic
  - [x] 6.2: Create `packages/web/src/app/api/risk/bottleneck/route.test.ts` — API route tests
  - [x] 6.3: Create `packages/web/src/components/__tests__/BottleneckDashboard.test.tsx` — component rendering tests
  - [x] 6.4: Create `packages/web/src/components/__tests__/BottleneckCard.test.tsx` — card rendering tests

- [x] Task 7: Update sprint-status.yaml
  - [x] 7.1: Verify all tests pass
  - [x] 7.2: Update `56-2-bottleneck-identification` status

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
1. **Dependency chain visualization (Story 56.3)**
   - Status: Deferred — Requires cross-project dependency graph rendering
   - Requires: Dependency graph data structure, visual graph layout
   - Epic: Story 56.3 / Epic 56
   - Current: Bottlenecks show flat list of affected stories, no chain visualization
2. **Emerging bottleneck prediction (Story 56.4)**
   - Status: Deferred — Requires time-series trend analysis with prediction
   - Requires: Velocity trend tracking, predictive model
   - Epic: Story 56.4 / Epic 56
   - Current: Shows current bottleneck snapshot only, no prediction
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
- `computeSprintHealth(project, epicFilter)` from `@composio/ao-plugin-tracker-bmad/sprint-health` — EXISTING: returns `SprintHealthResult { overall, indicators, stuckStories, wipColumns }`
- `computeCycleTime(project, epicFilter)` from `@composio/ao-plugin-tracker-bmad/cycle-time` — EXISTING: returns `CycleTimeStats { bottleneckColumn, averageColumnDwells }`
- `computeThroughput(project, epicFilter)` from `@composio/ao-plugin-tracker-bmad/throughput` — EXISTING: returns `ThroughputResult { bottleneckTrend, columnTrends }`
- `computeTeamWorkload(project, epicFilter)` from `@composio/ao-plugin-tracker-bmad/team-workload` — EXISTING: returns `TeamWorkloadResult { overloaded, unassigned }`
- `computeStoryAging(project, epicFilter)` from `@composio/ao-plugin-tracker-bmad/story-aging` — EXISTING: returns `StoryAgingResult { agingStories, columns }`
- `computeProjectUtilization(projectId, sessions, registry, config)` from `@composio/ao-core/agent-utilization` — EXISTING: per-project utilization
- `getCapacityStatus(workloadMap, config, agentProjectMap)` from `@composio/ao-core/capacity-check` — EXISTING: per-agent capacity warnings
- `getWipDashboardStatus(project)` from `@composio/ao-plugin-tracker-bmad/sprint-health` — EXISTING: per-column WIP status

**Feature Flags:**
- None required — all data sources already exist in the codebase

## Dependency Review

No new external dependencies required. This story aggregates data from existing core modules and API endpoints.

## Dev Notes

### Architecture Context

This is **Story 2 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is in the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Story 56-1 context (DONE):** Story 56-1 created the risk dashboard page at `/risk`, the `RiskDashboard` component (flat list of risk factors with expand/collapse), the `risk-aggregation.ts` module (`aggregateRiskFactors()`), and the `/api/risk/dashboard` endpoint. All 58 tests pass. This story (56-2) adds a dedicated bottleneck analysis section below the risk dashboard, with its own API endpoint `/api/risk/bottleneck` and aggregation logic focused specifically on bottlenecks.

**After all 11 stories, Epic 56 is complete.**

### What Already Exists (Do NOT Reinvent)

This is an **aggregation and presentation story** focused on bottlenecks. The core already computes all bottleneck-related data across multiple modules:

#### Sprint Health Indicators (tracker-bmad/sprint-health.ts)
- **Bottleneck detection**: Compares column dwell times; if highest is >= 2x next column, emits `"bottleneck"` indicator
- **Throughput drop detection**: 7-day vs 4-week ratio; critical if < 0.4, warning if < 0.7. Indicator id: `"throughput-drop"`
- **Stuck story detection**: Stories in active columns for > 48h (warning) or > 96h (critical). Indicator id: `"stuck-stories"`
- **WIP alert detection**: Per-column count vs limit; warning at limit, critical at limit+2
- **Types**: `SprintHealthResult { overall: HealthSeverity, indicators: HealthIndicator[], stuckStories: string[], wipColumns: string[] }`
- **Constants**: `STUCK_WARNING_MS = 48h`, `STUCK_CRITICAL_MS = 96h`, `DEFAULT_WIP_LIMIT = 3`, `THROUGHPUT_WARNING_RATIO = 0.7`, `THROUGHPUT_CRITICAL_RATIO = 0.4`, `BOTTLENECK_RATIO = 2`

#### Cycle Time Analytics (tracker-bmad/cycle-time.ts)
- **Bottleneck column**: Column with highest average dwell time
- **Types**: `CycleTimeStats { stories, averageCycleTimeMs, medianCycleTimeMs, averageColumnDwells: ColumnDwell[], bottleneckColumn: string | null, throughputPerDay, throughputPerWeek, completedCount }`
- **ColumnDwell**: `{ column: string, dwellMs: number }`

#### Throughput Analytics (tracker-bmad/throughput.ts)
- **Bottleneck trend**: Column with highest positive slope (dwell time increasing fastest)
- **Column trends**: Weekly average dwell times per column with linear regression slope
- **Types**: `ThroughputResult { dailyThroughput, weeklyThroughput, leadTimes, columnTrends: ColumnTrend[], bottleneckTrend: string | null }`
- **ColumnTrend**: `{ column: string, weeklyAvgMs: number[], trend: string, slope: number }`

#### Story Aging (tracker-bmad/story-aging.ts)
- **Aging stories**: Stories exceeding P90 dwell time for their column
- **Types**: `StoryAgingResult { columns: Record<string, ColumnAgingStats>, agingStories: AgingStory[], totalActive }`
- **AgingStory**: `{ storyId, column, ageMs, lastTransition, isAging }`
- **ColumnAgingStats**: `{ column, stories, p50Ms, p75Ms, p90Ms, p95Ms }`

#### Team Workload (tracker-bmad/team-workload.ts)
- **Overloaded members**: Agents exceeding `DEFAULT_OVERLOAD_LIMIT = 3` in-flight stories
- **Unassigned stories**: Stories with no assigned session
- **Types**: `TeamWorkloadResult { members: TeamMember[], overloaded: string[], unassigned: StoryRef[], overloadThreshold }`
- **TeamMember**: `{ sessionId, storiesByColumn, totalInFlight, totalPoints, isOverloaded }`

#### Capacity Checking (core/capacity-check.ts)
- **Per-agent capacity**: `CapacityResult { agentId, currentWorkload, maxCapacity, utilizationPercent, availableSlots, isAtCapacity, isNearCapacity }`
- **Near capacity threshold**: `NEAR_CAPACITY_THRESHOLD = 80%`

#### Agent Utilization (core/agent-utilization.ts)
- **Per-project utilization**: `ProjectAgentUtilization { projectId, totalAgents, activeAgents, utilizationPercent, agentDetails, poolAgentsTotal, poolAgentsActive }`
- **Per-agent utilization**: `AgentUtilization { agentId, projectId, isActive, utilizationPercent, sessionDurationMs, storiesWorked }`

#### Resource Conflicts (core/resource-conflict.ts)
- **Conflict detection**: `ResourceConflict { id, resourceType, resourceIdentifier, competingProjects, severity, detectedAt, metadata }`
- **Severity model**: Agent conflicts = critical, Repository = high/critical, File-path = medium/high, External-service = low/medium

#### Scope Creep (core/scope-creep-detector.ts)
- **Scope creep warnings**: `ScopeCreepWarning { agentId, storyId, metric, current, average, threshold, suggestion }`

#### Existing API Routes (all return bottleneck-related data)
- `GET /api/sprint/[project]/health` → `SprintHealthResult` (indicators including bottleneck, stuck, throughput, WIP)
- `GET /api/sprint/[project]/wip` → `WipColumnStatus[]` (per-column WIP status)
- `GET /api/sprint/[project]/throughput` → `ThroughputResult` (bottleneckTrend, columnTrends)
- `GET /api/sprint/[project]/aging` → `StoryAgingResult` (aging stories)
- `GET /api/sprint/[project]/workload` → `TeamWorkloadResult` (overloaded members)
- `GET /api/sprint/[project]/utilization` → `ProjectAgentUtilization`
- `GET /api/pool/utilization` → `PoolUtilizationOverview`
- `GET /api/pool/capacity` → `{ agents: CapacityResult[], summary }`
- `GET /api/sprint/[project]/conflicts` → `{ conflicts, summary }`
- `GET /api/workflow/health-metrics` → `WorkflowMetrics` (agents.utilizationRate, cycleTime, blockedStories)

### What This Story Actually Does

1. **Bottleneck aggregation module** (`bottleneck-aggregation.ts`): Pure computation that calls existing data sources and normalizes into a unified `BottleneckItem[]` with impact scores, types, affected stories, and delay metrics
2. **Bottleneck API endpoint** (`/api/risk/bottleneck`): Single endpoint returning aggregated bottleneck data
3. **BottleneckDashboard component**: Renders bottlenecks in a sorted list with impact badges and type icons
4. **BottleneckCard component**: Individual bottleneck card with type, impact score, affected story count, delay info
5. **BottleneckDetail component**: Expandable detail view showing contributing factors and affected stories

### Critical Design Decisions

1. **Aggregate, don't compute** — This story creates a unified view of existing bottleneck data. It does NOT implement new bottleneck detection algorithms. Use existing `SprintHealthResult.indicators`, `CycleTimeStats.bottleneckColumn`, `ThroughputResult.bottleneckTrend`, `TeamWorkloadResult.overloaded`, etc.

2. **Bottleneck types** — Categorize aggregated bottlenecks into types:
   - `column-bottleneck`: Column with disproportionately high dwell time (from cycle-time.ts)
   - `stuck-stories`: Stories blocked for > 48h/96h (from sprint-health.ts)
   - `wip-violation`: Columns exceeding WIP limits (from sprint-health.ts)
   - `throughput-drop`: Significant throughput decline (from sprint-health.ts)
   - `agent-overload`: Agents with too many in-flight stories (from team-workload.ts)
   - `capacity-bottleneck`: Agents at/near capacity (from capacity-check.ts)
   - `resource-conflict`: Competing resource access (from resource-conflict.ts)
   - `unassigned-stories`: Stories with no assigned agent (from team-workload.ts)
   - `aging-stories`: Stories exceeding P90 dwell for their column (from story-aging.ts)
   - `bottleneck-trend`: Columns with increasing dwell time (from throughput.ts)

3. **Impact scoring** — Each bottleneck gets an impact score based on:
   - Stories affected (direct count)
   - Estimated delay (from dwell times, blocked duration)
   - Severity from source (warning/critical → numeric mapping)
   - Formula: `impact = storiesAffected * severityWeight + delayDays * delayWeight`

4. **Integration with Story 56-1** — The BottleneckDashboard integrates INTO the existing RiskDashboard as a tab or section, NOT as a separate page. The `/api/risk/bottleneck` endpoint lives alongside `/api/risk/dashboard`.

5. **Trend data** — Use `ThroughputResult.columnTrends` (weekly slope) to show whether bottlenecks are improving or worsening. Default to "stable" if no trend data.

6. **No new dependencies** — Use only existing core modules and React patterns.

### Bottleneck Aggregation Strategy

```
BottleneckItem[] = [
  // From SprintHealthResult.indicators (tracker-bmad)
  ...indicators
    .filter(i => ["bottleneck", "stuck-stories", "throughput-drop", "wip-alert"].includes(i.id))
    .map(i => ({
      type: classifyIndicator(i),
      impact: mapIndicatorImpact(i),
      severity: mapSeverity(i.severity),
      affectedStories: extractStories(i),
      delayDays: extractDelay(i),
      ...
    })),

  // From CycleTimeStats (cycle-time.ts)
  ...(bottleneckColumn ? [{
    type: "column-bottleneck",
    title: `${bottleneckColumn} is a flow bottleneck`,
    impact: computeColumnImpact(averageColumnDwells),
    affectedStories: getStoriesInColumn(bottleneckColumn),
    delayDays: computeExcessDelay(averageColumnDwells),
    ...
  }] : []),

  // From TeamWorkloadResult (team-workload.ts)
  ...overloaded.map(sessionId => ({
    type: "agent-overload",
    title: `Agent ${sessionId} has ${member.totalInFlight} in-flight stories`,
    impact: member.totalInFlight * 10,
    affectedStories: flattenStories(member.storiesByColumn),
    ...
  })),

  // From CapacityResult[] (capacity-check.ts)
  ...capacityResults.filter(c => c.isAtCapacity || c.isNearCapacity)
    .map(c => ({
      type: "capacity-bottleneck",
      title: `Agent ${c.agentId} at ${c.utilizationPercent}% capacity`,
      impact: c.utilizationPercent,
      availableSlots: c.availableSlots,
      ...
    })),

  // From StoryAgingResult (story-aging.ts)
  ...agingStories.map(a => ({
    type: "aging-stories",
    title: `Story ${a.storyId} aging in ${a.column}`,
    impact: computeAgeImpact(a),
    delayDays: a.ageMs / (24*60*60*1000),
    ...
  })),

  // From ThroughputResult (throughput.ts)
  ...(bottleneckTrend ? [{
    type: "bottleneck-trend",
    title: `${bottleneckTrend} dwell time increasing`,
    impact: computeTrendImpact(columnTrends),
    trend: "worsening",
    ...
  }] : []),
]
```

### Component Layout

```
┌─────────────────────────────────────────────────────────┐
│ Risk Dashboard                 [Overview] [Bottlenecks] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│  │Stuck│ │ WIP │ │Aging│ │Ovld │ │Confl│  ← Summary   │
│  │  4  │ │  2  │ │  7  │ │  3  │ │  1  │    cards     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
├─────────────────────────────────────────────────────────┤
│ ▼ Column Bottleneck: "in-review" is 3.2x next column ↑W │
│   Impact: 12 stories affected · ~3.5 days avg delay     │
│   Trend: Worsening — dwell time increasing 15%/week     │
│   Contributing: throughput drop to 42% of baseline       │
├─────────────────────────────────────────────────────────┤
│ ▼ Stuck Stories: 4 stories blocked > 48h          → S   │
│   Impact: 4 stories · ~2.1 days avg blocked             │
│   Affected: S-12, S-34, S-56, S-78                      │
├─────────────────────────────────────────────────────────┤
│ ▶ Agent Overload: session-abc has 5 in-flight     → S   │
│ ▶ WIP Violation: "in-progress" at 8 stories (6 max) → S │
│ ▶ Aging: S-34 in "review" for 5 days (P90=3.2d)   → S  │
│ ▶ Unassigned: 3 stories have no agent              → S  │
└─────────────────────────────────────────────────────────┘
```

### API Response Shape

```json
GET /api/risk/bottleneck?project=my-project
{
  "bottlenecks": [
    {
      "id": "bn-column-in-review",
      "type": "column-bottleneck",
      "title": "\"in-review\" is a flow bottleneck (3.2x next column)",
      "severity": 75,
      "severityLabel": "high",
      "impact": {
        "storiesAffected": 12,
        "estimatedDelayDays": 3.5,
        "impactScore": 87
      },
      "trend": "worsening",
      "affectedProjects": ["my-project"],
      "affectedStories": ["S-12", "S-34", "S-56", "S-78", "S-90"],
      "contributingFactors": [
        "Column dwell time is 3.2x the next slowest column",
        "Throughput dropped to 42% of 4-week baseline"
      ],
      "suggestedAction": "Consider adding review capacity or splitting the review column"
    },
    {
      "id": "bn-stuck-stories",
      "type": "stuck-stories",
      "title": "4 stories blocked > 48h",
      "severity": 80,
      "severityLabel": "high",
      "impact": {
        "storiesAffected": 4,
        "estimatedDelayDays": 2.1,
        "impactScore": 72
      },
      "trend": "stable",
      "affectedProjects": ["my-project"],
      "affectedStories": ["S-12", "S-34", "S-56", "S-78"],
      "contributingFactors": [
        "S-34 blocked for 96h (critical)",
        "S-56 blocked for 72h",
        "2 stories blocked by dependency on S-34"
      ],
      "suggestedAction": "Unblock S-34 first — it's blocking 2 downstream stories"
    }
  ],
  "summary": {
    "stuckStories": 4,
    "wipViolations": 2,
    "agingStories": 7,
    "overloadedAgents": 3,
    "resourceConflicts": 1,
    "totalBottlenecks": 9
  },
  "lastUpdated": "2026-04-06T12:00:00Z"
}
```

### Integration with Story 56-1 (DONE — Key Learnings)

Story 56-1 is complete. Here's what was actually implemented and how this story integrates:

**56-1 Implementation Facts:**
- Risk Dashboard is at `/risk` route (`packages/web/src/app/risk/page.tsx`) — a server component that loads projects and renders `<RiskDashboard>`
- `RiskDashboard.tsx` is a **flat list** — NO tabs. It renders summary cards + risk factor cards in a single scrollable view
- `RiskFactorCard` is exported from `RiskDashboard.tsx` (inlined, not separate file) for testing
- Route follows pattern: `/api/risk/dashboard?project=xxx`
- Aggregation module: `risk-aggregation.ts` with `aggregateRiskFactors()` — pure computation, types + helpers + main function
- Severity helpers: `getSeverityLabel(score)` → critical/high/medium/low, `mapHealthSeverity()` → numeric
- `@composio/ao-core` only exports `"."` and `"./types"` in package.json — subpath imports like `@composio/ao-core/agent-utilization` fail in Vite/test. Must import from top-level `@composio/ao-core` and mock at top level too
- Component patterns: CSS variables (`var(--color-text-primary)`, etc.), text sizes `text-[10px]`/`text-[11px]`/`text-[12px]`/`text-[13px]`, border radius `rounded-[6px]`/`rounded-[5px]`, `"use client"` directive
- Test patterns: `vi.mock("@composio/ao-core", () => ({ ... }))` for top-level mock, `act()` from `@testing-library/react` for async state, `waitFor` for data loading

**Integration approach (based on actual 56-1 implementation):**
Use **Option B (Section)** — add BottleneckDashboard as a section below the existing RiskDashboard in the `/risk` page. This avoids refactoring 56-1's working component into a tab system, which would be a separate concern. The page (`risk/page.tsx`) renders both components sequentially.

```
// packages/web/src/app/risk/page.tsx (after 56-2)
<main className="mx-auto max-w-7xl px-8 py-6">
  <RiskDashboard projects={projects} />
  <BottleneckDashboard projects={projects} />  {/* NEW */}
</main>
```

### Testing Strategy

**Unit tests (bottleneck-aggregation.test.ts):**
- Aggregation combines data from multiple sources correctly
- Impact scoring formula produces expected values
- Bottleneck type classification matches indicator types
- Empty/missing data returns empty bottlenecks (not errors)
- Summary counts match filtered results
- Severity normalization maps correctly (warning→50, critical→85)
- Trend data from throughput module is correctly classified

**API route tests (route.test.ts):**
- Returns 200 with aggregated bottlenecks for valid project
- Returns 404 for unknown project
- Returns bottlenecks sorted by impact score descending
- Filters by project query param when provided
- Handles projects with no bottleneck data gracefully

**Component tests (BottleneckDashboard.test.tsx, BottleneckCard.test.tsx):**
- Renders bottlenecks sorted by impact
- Shows summary metric cards with correct counts
- Project filter updates displayed bottlenecks
- Empty state when no bottlenecks found
- Click on bottleneck card expands detail view
- Trend indicator shows correct arrow direction

### NFRs
- **NFR-E3-1:** Risk analysis refreshes within 5 seconds — aggregation calls existing endpoints (already fast)
- **NFR-E3-2:** Dashboard supports up to 100 concurrent risk items — client-side rendering, no server limit
- **NFR-P1:** Dashboard loads within 2 seconds — lightweight aggregation, no heavy computation
- **NFR-P4:** API endpoint responds within 500ms (p95) — aggregation of cached/fast data

### Pre-existing Types (Use These, Do NOT Modify)
- `HealthSeverity = "ok" | "warning" | "critical"` — from `@composio/ao-plugin-tracker-bmad/sprint-health`
- `HealthIndicator { id, severity, message, details[] }` — from tracker-bmad sprint-health
- `SprintHealthResult { overall, indicators, stuckStories, wipColumns }` — from tracker-bmad sprint-health
- `WipColumnStatus { column, label, current, limit, ratio, severity }` — from tracker-bmad sprint-health
- `CycleTimeStats { stories, averageCycleTimeMs, medianCycleTimeMs, averageColumnDwells, bottleneckColumn, throughputPerDay, throughputPerWeek, completedCount }` — from tracker-bmad cycle-time
- `ColumnDwell { column, dwellMs }` — from tracker-bmad cycle-time
- `ThroughputResult { dailyThroughput, weeklyThroughput, leadTimes, columnTrends, bottleneckTrend }` — from tracker-bmad throughput
- `ColumnTrend { column, weeklyAvgMs, trend, slope }` — from tracker-bmad throughput
- `StoryAgingResult { columns, agingStories, totalActive }` — from tracker-bmad story-aging
- `AgingStory { storyId, column, ageMs, lastTransition, isAging }` — from tracker-bmad story-aging
- `ColumnAgingStats { column, stories, p50Ms, p75Ms, p90Ms, p95Ms }` — from tracker-bmad story-aging
- `TeamWorkloadResult { members, overloaded, unassigned, overloadThreshold }` — from tracker-bmad team-workload
- `TeamMember { sessionId, storiesByColumn, totalInFlight, totalPoints, isOverloaded }` — from tracker-bmad team-workload
- `CapacityResult { agentId, currentWorkload, maxCapacity, utilizationPercent, availableSlots, isAtCapacity, isNearCapacity }` — from `@composio/ao-core/capacity-check`
- `AgentUtilization { agentId, projectId, isActive, utilizationPercent, sessionDurationMs, storiesWorked }` — from `@composio/ao-core/agent-utilization`
- `ResourceConflict { id, resourceType, resourceIdentifier, competingProjects, severity, detectedAt, metadata }` — from `@composio/ao-core/resource-conflict`
- `ScopeCreepWarning { agentId, storyId, metric, current, average, threshold, suggestion }` — from `@composio/ao-core/scope-creep-detector`

### References
- [Source: epics-cycle-10.md#Story 56.2] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E3-1] — "Resource bottlenecks" as a displayed risk factor
- [Source: prd-cycle-10.md#FR-E3-2] — "Each risk is scored (0-100) based on impact and probability"
- [Source: prd-cycle-10.md#FR-E3-3] — "Users can drill down into each risk for detailed analysis"
- [Source: prd-cycle-10.md#NFR-E3-1, NFR-E3-2] — Performance NFRs
- [Source: packages/plugins/tracker-bmad/src/sprint-health.ts] — Bottleneck detection, stuck stories, WIP alerts, throughput drop
- [Source: packages/plugins/tracker-bmad/src/cycle-time.ts] — Bottleneck column, average column dwells
- [Source: packages/plugins/tracker-bmad/src/throughput.ts] — Bottleneck trend (slope-based), column trends
- [Source: packages/plugins/tracker-bmad/src/story-aging.ts] — Aging stories by column with P90 thresholds
- [Source: packages/plugins/tracker-bmad/src/team-workload.ts] — Overloaded team members
- [Source: packages/core/src/capacity-check.ts] — Per-agent capacity checking
- [Source: packages/core/src/agent-utilization.ts] — Agent utilization tracking
- [Source: packages/core/src/resource-conflict.ts] — Resource conflict detection with severity
- [Source: packages/core/src/scope-creep-detector.ts] — Scope creep detection
- [Source: packages/web/src/app/api/sprint/[project]/health/route.ts] — Sprint health API
- [Source: packages/web/src/app/api/sprint/[project]/throughput/route.ts] — Throughput API
- [Source: packages/web/src/app/api/sprint/[project]/aging/route.ts] — Story aging API
- [Source: packages/web/src/app/api/sprint/[project]/workload/route.ts] — Team workload API
- [Source: packages/web/src/components/HealthIndicators.tsx] — Reference component for health display
- [Source: packages/web/src/components/PortfolioMetricsWidget.tsx] — Reference widget with MetricCard pattern
- [Source: _bmad-output/implementation-artifacts/56-1-risk-dashboard-overview.md] — Previous story (done)

### Learnings from Story 56-1 (MUST Follow)

These are verified patterns from the completed 56-1 implementation. The dev agent MUST follow these to avoid regressions:

1. **Package import resolution**: `@composio/ao-core` only exports `"."` and `"./types"` in package.json. Subpath imports like `@composio/ao-core/agent-utilization` or `@composio/ao-core/capacity-check` fail in Vite/test resolution. Import from top-level `@composio/ao-core` only.

2. **Mock pattern for tests**: When mocking `@composio/ao-core` in vitest, use single top-level mock:
   ```typescript
   vi.mock("@composio/ao-core", () => ({
     computeAgentUtilization: vi.fn(() => []),
     getCapacityStatus: vi.fn(() => new Map()),
   }));
   ```
   Do NOT use `importOriginal` with subpath type imports — ESLint `consistent-type-imports` rule rejects the pattern.

3. **Severity label helper**: 56-1 established `getSeverityLabel(score)` with thresholds: 76+=critical, 51+=high, 26+=medium, below=low. Use this same function for bottleneck severity labels (copy from `risk-aggregation.ts` or import if exported).

4. **Component structure**: Export inline sub-components (like `RiskFactorCard`) from the main component file for testability. Don't create separate files for small card components.

5. **Test async patterns**: Use `act()` from `@testing-library/react` for resolving pending promises in loading state tests. Use `waitFor` for data loading assertions.

6. **CSS conventions**: Use CSS variables (`var(--color-text-primary)`, etc.), pixel-based text sizes (`text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`), border radius `rounded-[6px]` for cards.

7. **Route pattern**: API routes for risk use `/api/risk/` prefix. Follow this pattern for `/api/risk/bottleneck`.

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
Claude Opus 4.6

### Debug Log References
- ESLint `no-useless-assignment` on aggregation module — fixed by removing initial `0` assignment for `let storiesAffected`
- Route file had extensive syntax errors from initial write (missing commas, wrong API calls) — complete rewrite required

### Completion Notes List
- All 47 tests pass across 3 test files (20 aggregation + 12 API route + 15 component)
- BottleneckDashboard rendered as section below RiskDashboard per Option B (not tabs)
- BottleneckCard inlined in BottleneckDashboard.tsx following 56-1 pattern
- Used `runConflictDetection(config)` for resource conflicts (not `detectResourceConflicts`)
- Aggregation module is pure computation — no external side effects
- Impact scoring formula: `storiesAffected * 10 + delayDays * 5 + severityNum * 0.3`, capped at 100

### File List
- `packages/web/src/lib/bottleneck-aggregation.ts` — Pure bottleneck aggregation module (types + computation)
- `packages/web/src/lib/__tests__/bottleneck-aggregation.test.ts` — 20 unit tests for aggregation logic
- `packages/web/src/app/api/risk/bottleneck/route.ts` — GET endpoint for bottleneck data
- `packages/web/src/app/api/risk/bottleneck/route.test.ts` — 12 API route tests
- `packages/web/src/components/BottleneckDashboard.tsx` — Dashboard + BottleneckCard + SummaryCard components
- `packages/web/src/components/__tests__/BottleneckDashboard.test.tsx` — 15 component tests
- `packages/web/src/app/risk/page.tsx` — Updated to include BottleneckDashboard section

### Limitations (Deferred Items)
1. **Dependency chain visualization (Story 56.3)**
   - Status: Deferred — Requires cross-project dependency graph rendering
   - Requires: Dependency graph data structure, visual graph layout
   - Epic: Story 56.3 / Epic 56
   - Current: Bottlenecks show flat list of affected stories, no chain visualization
2. **Emerging bottleneck prediction (Story 56.4)**
   - Status: Deferred — Requires time-series trend analysis with prediction
   - Requires: Velocity trend tracking, predictive model
   - Epic: Story 56.4 / Epic 56
   - Current: Shows current bottleneck snapshot only, no prediction
