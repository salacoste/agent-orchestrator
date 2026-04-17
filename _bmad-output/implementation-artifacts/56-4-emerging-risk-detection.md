# Story 56.4: Emerging Risk Detection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **the system to detect emerging risks based on pattern analysis**,
so that **I can address risks before they become critical**.

## Acceptance Criteria

1. **Given** the system monitors project metrics
   **When** patterns indicate a developing risk (velocity drop, increasing blockers)
   **Then** the risk appears in the dashboard with "emerging" status
   **And** the system suggests potential causes

2. **Given** emerging risks are displayed on the dashboard
   **When** I view the risk panel
   **Then** emerging risks are visually distinct from current risks
   **And** I can see the pattern/trend that triggered the detection
   **And** I see the trajectory (improving/stable/worsening)

3. **Given** risk factors and bottlenecks have trend data
   **When** trend analysis runs
   **Then** existing `trend` fields on `RiskFactor` and `BottleneckItem` are populated with real values
   **And** trends are derived from throughput time-series data and sprint health patterns

4. **Given** the risk score API returns data
   **When** the route collects data for scoring
   **Then** actual throughput, cycle time, team workload, and story aging data is wired in
   **And** bottleneck aggregation receives real data instead of empty stubs

## Tasks / Subtasks

- [x] Task 1: Create emerging risk detection module (AC: #1, #3)
  - [x] 1.1: Create `packages/web/src/lib/emerging-risk-detection.ts` — pure computation module that analyzes time-series patterns to detect emerging risks
  - [x] 1.2: Define `EmergingRisk` type extending risk concepts with pattern details: `{ id, type, title, status: "emerging", severity, trajectory, pattern, detectedAt, cause, suggestedAction }`
  - [x] 1.3: Define `EmergingRiskPattern` enum/union: `"velocity-drop"`, `"blocker-accumulation"`, `"capacity-trend"`, `"throughput-decline"`, `"aging-acceleration"`
  - [x] 1.4: Implement `detectEmergingRisks(input: EmergingRiskInput): EmergingRisk[]` — analyzes throughput trends, sprint health indicator patterns, and capacity trajectories
  - [x] 1.5: Implement velocity drop detection — compare `weeklyThroughput` recent vs baseline, flag if recent 2-week average drops below 60% of 4-week baseline
  - [x] 1.6: Implement throughput decline detection — check `columnTrends[].slope > 0` (increasing dwell = worsening) for active columns
  - [x] 1.7: Implement capacity trend detection — compare current agent utilization snapshot vs expected capacity thresholds (agents trending toward at-capacity)

- [x] Task 2: Wire real data into risk score route (AC: #4)
  - [x] 2.1: Update `packages/web/src/app/api/risk/score/route.ts` — import `computeCycleTime`, `computeThroughput`, `computeTeamWorkload`, `computeStoryAging` from `@composio/ao-plugin-tracker-bmad`
  - [x] 2.2: Replace empty stubs in `computeProjectScore()` with real calls to tracker functions when `isBmad` is true
  - [x] 2.3: Pass real `ThroughputResult`, `CycleTimeStats`, `TeamWorkloadResult`, `StoryAgingResult` to `aggregateBottlenecks()`
  - [x] 2.4: Pass real throughput data to `detectEmergingRisks()` for pattern analysis

- [x] Task 3: Populate real trend values (AC: #3)
  - [x] 3.1: Update `packages/web/src/lib/risk-aggregation.ts` — change `trend` field from hardcoded `"stable"` to derive from throughput slope data when available
  - [x] 3.2: Update `packages/web/src/lib/bottleneck-aggregation.ts` — expand trend derivation beyond the 2 existing cases to use all available `columnTrends` data
  - [x] 3.3: Add optional `throughputData` to `RiskAggregationInput` and `BottleneckAggregationInput` to pass trend context

- [x] Task 4: Add emerging risk display to risk dashboard (AC: #1, #2)
  - [x] 4.1: Update `packages/web/src/components/RiskScorePanel.tsx` — add emerging risks section below the score card
  - [x] 4.2: Create inline `EmergingRiskCard` component — renders pattern, trajectory icon, cause, and suggested action with distinct "emerging" styling
  - [x] 4.3: Update `/api/risk/score` response to include `emergingRisks` array when detected

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Create `packages/web/src/lib/__tests__/emerging-risk-detection.test.ts` — unit tests for pattern detection logic
  - [x] 5.2: Update `packages/web/src/app/api/risk/score/route.test.ts` — add tests for real data wiring and emerging risk response
  - [x] 5.3: Update `packages/web/src/components/__tests__/RiskScorePanel.test.tsx` — add tests for emerging risk display

- [x] Task 6: Update sprint-status.yaml
  - [x] 6.1: Verify all tests pass
  - [x] 6.2: Update `56-4-emerging-risk-detection` status

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
1. **Configurable risk alerts (Story 56.5)**
   - Status: Deferred — Requires alerting infrastructure
   - Requires: Threshold configuration, notification channels
   - Epic: Story 56.5 / Epic 56
   - Current: Emerging risks are displayed but no proactive notifications sent
2. **Risk trend history persistence (FR-E3-5)**
   - Status: Deferred — Requires historical score storage
   - Requires: Time-series persistence for risk scores (JSONL or similar)
   - Epic: Future story
   - Current: Emerging risks use real-time throughput data only, no historical score comparison
3. **Machine learning pattern detection**
   - Status: Deferred — Requires ML model or statistical library
   - Requires: Anomaly detection model, training data
   - Epic: Future enhancement
   - Current: Pattern detection uses threshold-based heuristics, not ML
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`
- `aggregateRiskFactors(input)` from `@/lib/risk-aggregation` — EXISTING: returns `RiskDashboardResponse`
- `aggregateBottlenecks(input)` from `@/lib/bottleneck-aggregation` — EXISTING: returns `BottleneckDashboardResponse`
- `calculateRiskScore(input)` from `@/lib/risk-score` — EXISTING: returns `RiskScoreResult`
- `computeSprintHealth(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `SprintHealthResult`
- `computeCycleTime(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `CycleTimeStats`
- `computeThroughput(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `ThroughputResult`
- `computeTeamWorkload(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `TeamWorkloadResult`
- `computeStoryAging(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `StoryAgingResult`
- `computeAgentUtilization(sessions, registry, config)` from `@composio/ao-core` — EXISTING: returns utilization array
- `getCapacityStatus(workloadMap, config, agentProjectMap)` from `@composio/ao-core` — EXISTING: per-agent capacity warnings

**Feature Flags:**
- None required — all data sources already exist in the codebase

## Dependency Review

No new external dependencies required. This story uses existing tracker-bmad functions (`computeThroughput`, `computeCycleTime`, `computeTeamWorkload`, `computeStoryAging`) and existing core functions (`computeAgentUtilization`, `getCapacityStatus`).

## Dev Notes

### Architecture Context

This is **Story 4 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is in the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Stories 56-1, 56-2, 56-3 (ALL DONE) context:**
- 56-1 created `risk-aggregation.ts` with `aggregateRiskFactors()` — produces `RiskFactor[]` with severity scores
- 56-2 created `bottleneck-aggregation.ts` with `aggregateBottlenecks()` — produces `BottleneckItem[]` with impact scores
- 56-3 created `risk-score.ts` with `calculateRiskScore()` + `calculatePortfolioScore()` — composite scoring
- 56-3 created `/api/risk/score` route with `RiskScorePanel` component
- All three stories deferred emerging risk detection to this story (56-4)
- The `/risk` page renders: `<RiskScorePanel>` → `<RiskDashboard>` → `<BottleneckDashboard>` sequentially

### What Already Exists (Do NOT Reinvent)

#### Risk Aggregation (risk-aggregation.ts — 249 lines)
- `RiskFactor { id, type, severity, severityLabel, trend, affectedProjects, contributingFactors, affectedStories, suggestedAction }`
- `RiskTrend = "improving" | "stable" | "worsening"` — **currently always "stable"** (this story populates real values)
- `RiskAggregationInput { projectId, projectName, indicators, stuckStories, wipColumns, capacityResults, agentUtilizations, sprintHealthScore }`
- Five risk factor types: `high-risk-stories`, `resource-bottleneck`, `velocity-anomaly`, `blocking-pattern`, `scope-creep`
- Helper: `getSeverityLabel(score)`: 76+=critical, 51+=high, 26+=medium, below=low

#### Bottleneck Aggregation (bottleneck-aggregation.ts — 508 lines)
- `BottleneckItem { id, type, severity, severityLabel, impact, trend, ... }` — trend mostly "stable" except 2 cases using throughput slope
- `BottleneckAggregationInput` accepts: `sprintHealth`, `cycleTime`, `throughput`, `teamWorkload`, `storyAging`, `capacityResults`, `conflicts`
- 10 bottleneck types including `bottleneck-trend` and `throughput-drop`
- Impact scoring: `storiesAffected * 10 + delayDays * 5 + severityNum * 0.3`, capped at 100

#### Risk Score (risk-score.ts — 194 lines)
- `RiskScoreResult { projectId, score, severityLabel, contributors, factorCount, bottleneckCount, lastUpdated }`
- `calculateRiskScore(input)`: weighted sum of risk factors + bottlenecks + sprint health, normalized by constant 520
- `calculatePortfolioScore(projectScores)`: average of individual scores
- Scoring weights: critical=1.5, high=1.0, medium=0.6, low=0.3

#### API Route (/api/risk/score/route.ts — 210 lines)
- `computeSprintHealthScore(health)`: starts at 100, subtracts 15/critical, 5/warning, 10/stuck story
- `buildCapacityResults(allSessions, projectId, config)`: per-agent capacity status
- `computeProjectScore(...)`: calls `aggregateRiskFactors()` → `aggregateBottlenecks()` → `calculateRiskScore()`
- **CRITICAL GAP**: Lines 95-100 pass **empty stubs** for cycleTime, throughput, teamWorkload, storyAging, and conflicts to `aggregateBottlenecks()`. This story wires in real data.

#### Throughput Data (tracker-bmad/throughput.ts)
- `ThroughputResult { dailyThroughput, weeklyThroughput, leadTimes, columnTrends, bottleneckTrend, flowEfficiency, ... }`
- `ColumnTrend { column, weeklyAvgMs: number[], trend: string, slope: number }` — **this is the richest existing time-series data**
- `dailyThroughput: Array<{ date, count, points }>` — daily completion counts
- `weeklyThroughput: Array<{ weekStart, count, points }>` — weekly aggregates
- Slope computed via simple linear regression: `slope > 0.05` = increasing, `< -0.05` = decreasing

#### Sprint Health (tracker-bmad/sprint-health.ts)
- `SprintHealthResult { overall, indicators: HealthIndicator[], stuckStories, wipColumns }`
- 4 indicator types: stuck-stories, wip-alert, throughput-drop, bottleneck
- Throughput drop: compares 7-day vs 4-week average (Critical: <40%, Warning: <70%)

### What This Story Actually Does

1. **Emerging risk detection module** (`emerging-risk-detection.ts`): Pure computation that analyzes time-series patterns from throughput data to detect risks that are developing but not yet critical. Uses threshold-based heuristics on throughput trends, velocity drops, and capacity trajectories.

2. **Wire real data into route**: Replace the empty stubs in `/api/risk/score/route.ts` with actual calls to `computeCycleTime()`, `computeThroughput()`, `computeTeamWorkload()`, and `computeStoryAging()` from tracker-bmad. This enables bottleneck aggregation to use real trend data.

3. **Populate real trend values**: Update `risk-aggregation.ts` and `bottleneck-aggregation.ts` to derive `trend` fields from actual throughput slope data instead of hardcoding `"stable"`.

4. **Emerging risk display**: Add emerging risks to `RiskScorePanel` with distinct styling, pattern details, and trajectory indicators.

### Critical Design Decisions

1. **Threshold-based heuristics, not ML** — Use simple threshold comparisons on throughput time-series data (slopes, ratios) rather than introducing ML/statistical libraries. Keeps the implementation lightweight, testable, and consistent with existing patterns.

2. **Aggregate from existing computations** — The module takes already-computed `ThroughputResult`, `SprintHealthResult`, and capacity data as inputs. It does NOT re-read raw history files. This follows the established pure-computation pattern.

3. **No new persistence** — Emerging risks are detected fresh each time. No JSONL/file storage of historical risk scores in this story. Deferred to a future story. The throughput time-series data already exists in the tracker plugin's output.

4. **"Emerging" as a status overlay** — Emerging risks are a separate category displayed alongside (not replacing) current risk factors and bottlenecks. They don't affect the composite risk score directly.

5. **Pattern types map to existing data** — Each pattern type corresponds to an existing data source:
   - `velocity-drop` → `weeklyThroughput` recent vs baseline comparison
   - `throughput-decline` → `columnTrends[].slope` positive values (increasing dwell time)
   - `capacity-trend` → agent utilization trending toward capacity thresholds
   - `blocker-accumulation` → sprint health indicators showing increasing blocker count
   - `aging-acceleration` → story aging data showing stories aging faster than baseline

### Emerging Risk Detection Strategy

```typescript
interface EmergingRisk {
  id: string;                        // project-prefixed, e.g., "myproject-emerging-velocity-drop"
  type: EmergingRiskPattern;
  title: string;                     // human-readable description
  status: "emerging";                // always "emerging"
  severity: number;                  // 0-100, how severe if it materializes
  trajectory: RiskTrend;             // "improving" | "stable" | "worsening"
  pattern: string;                   // description of the detected pattern
  detectedAt: string;                // ISO timestamp
  cause: string;                     // suggested root cause
  suggestedAction: string;           // what to do about it
  projectId: string;
  contributingFactors: string[];     // related risk factor/bottleneck IDs
}

type EmergingRiskPattern =
  | "velocity-drop"
  | "blocker-accumulation"
  | "capacity-trend"
  | "throughput-decline"
  | "aging-acceleration";

interface EmergingRiskInput {
  projectId: string;
  throughput: ThroughputResult;       // from computeThroughput()
  sprintHealth: SprintHealthResult;   // from computeSprintHealth()
  agentUtilizations: AgentUtilRaw[];  // from computeAgentUtilization()
  riskFactors: RiskFactor[];          // from aggregateRiskFactors()
}
```

**Detection rules:**

| Pattern | Trigger | Severity |
|---------|---------|----------|
| `velocity-drop` | Recent 2-week throughput < 60% of 4-week baseline | 70 if <40%, 50 if <60%, 30 if <75% |
| `throughput-decline` | Any column's slope > 0 (increasing dwell time) | 40 + min(60, slope * 100) |
| `capacity-trend` | Agents approaching capacity (>70% utilization and rising) | Based on how close to 100% |
| `blocker-accumulation` | >3 stuck stories AND throughput-drop indicator present | 60 + 5 per additional stuck story |
| `aging-acceleration` | Stories aging > P90 threshold AND aging count increasing week-over-week | 50 + 10 per aging story above baseline |

### Component Layout

```
┌──────────────────────────────────────────────────────────┐
│ Risk Dashboard                                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Project Risk Score: 72 (HIGH)              [▼]  │    │ ← existing from 56-3
│  │  5 risk factors · 3 bottlenecks                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ⚡ Emerging Risks (2)                           │    │ ← NEW from 56-4
│  │  ┌────────────────────────────────────────────┐  │    │
│  │  │ ▼ Velocity dropping (trajectory: worsening)│  │    │
│  │  │ 2-week avg 40% of 4-week baseline          │  │    │
│  │  │ Cause: Throughput decline in "review" col   │  │    │
│  │  │ Action: Check review bottleneck, add agents │  │    │
│  │  └────────────────────────────────────────────┘  │    │
│  │  ┌────────────────────────────────────────────┐  │    │
│  │  │ ▲ Capacity trending to limit (trajectory:   │  │    │
│  │  │   worsening)                                │  │    │
│  │  │ Agent "claude-1" at 78% and rising          │  │    │
│  │  │ Action: Consider adding agent or rebalancing│  │    │
│  │  └────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │ ← existing from 56-1
│  │Stuck│ │ WIP │ │Aging│ │Ovld │ │Confl│  ← risk     │
│  │  4  │ │  2  │ │  7  │ │  3  │ │  1  │    factors  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│  ...existing bottlenecks...                             │ ← existing from 56-2
└──────────────────────────────────────────────────────────┘
```

### API Response Addition

```json
GET /api/risk/score?project=my-project&breakdown=true
{
  "projectId": "my-project",
  "projectName": "My Project",
  "score": 72,
  "severityLabel": "high",
  "factorCount": 5,
  "bottleneckCount": 3,
  "emergingRisks": [
    {
      "id": "myproject-emerging-velocity-drop",
      "type": "velocity-drop",
      "title": "Velocity dropping — 2-week throughput at 40% of baseline",
      "status": "emerging",
      "severity": 70,
      "trajectory": "worsening",
      "pattern": "2-week average (3.5 stories/week) vs 4-week baseline (8.8 stories/week)",
      "detectedAt": "2026-04-07T12:00:00Z",
      "cause": "Throughput decline detected in 'review' column (dwell time increasing)",
      "suggestedAction": "Investigate review bottleneck, consider adding review capacity",
      "projectId": "my-project",
      "contributingFactors": ["myproject-bn-column-review"]
    }
  ],
  "contributors": [...],
  "lastUpdated": "2026-04-07T12:00:00Z"
}
```

### Integration with Stories 56-1, 56-2, 56-3 (MUST Follow)

These are verified patterns from completed stories. The dev agent MUST follow these to avoid regressions:

1. **Package import resolution**: `@composio/ao-core` only exports `"."` and `"./types"` in package.json. Subpath imports like `@composio/ao-core/agent-utilization` or `@composio/ao-core/capacity-check` fail in Vite/test resolution. Import from top-level `@composio/ao-core` only.

2. **Package import resolution (tracker-bmad)**: `@composio/ao-plugin-tracker-bmad` also uses top-level exports. Functions like `computeThroughput`, `computeCycleTime`, etc. must be imported from the package root, not subpaths.

3. **Mock pattern for tests**: When mocking `@composio/ao-core` in vitest, use single top-level mock:
   ```typescript
   vi.mock("@composio/ao-core", () => ({
     getCapacityStatus: vi.fn(() => new Map()),
     computeAgentUtilization: vi.fn(() => []),
     runConflictDetection: vi.fn(() => ({ conflicts: [], scanDurationMs: 1 })),
   }));
   ```
   When mocking `@composio/ao-plugin-tracker-bmad`:
   ```typescript
   vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
     computeSprintHealth: vi.fn(() => EMPTY_HEALTH),
     computeCycleTime: vi.fn(() => ({ bottleneckColumn: null, averageColumnDwells: [], completedCount: 0 })),
     computeThroughput: vi.fn(() => ({ dailyThroughput: [], weeklyThroughput: [], columnTrends: [], bottleneckTrend: null, leadTimes: [], averageLeadTimeMs: 0, medianLeadTimeMs: 0, averageCycleTimeMs: 0, medianCycleTimeMs: 0, flowEfficiency: 0 })),
     computeTeamWorkload: vi.fn(() => ({ overloaded: [], unassigned: [], members: [], overloadThreshold: 0 })),
     computeStoryAging: vi.fn(() => ({ agingStories: [] })),
   }));
   ```
   Do NOT use `importOriginal` with subpath type imports — ESLint `consistent-type-imports` rule rejects the pattern.

4. **Severity label helper**: Stories 56-1 through 56-3 established `getSeverityLabel(score)` with thresholds: 76+=critical, 51+=high, 26+=medium, below=low. Use this same function. Each module has its own copy — the emerging risk module should have its own too.

5. **Component structure**: Export inline sub-components (like `RiskFactorCard`, `BottleneckCard`, `RiskScoreCard`) from the main component file for testability. Don't create separate files for small card components. Export `EmergingRiskCard` inline from `RiskScorePanel.tsx`.

6. **Test async patterns**: Use `act()` from `@testing-library/react` for resolving pending promises in loading state tests. Use `waitFor` for data loading assertions.

7. **CSS conventions**: Use CSS variables (`var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-bg-surface)`, etc.), pixel-based text sizes (`text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`), border radius `rounded-[6px]` for cards, `rounded-[5px]` for inner elements.

8. **Route pattern**: API routes for risk use `/api/risk/` prefix. The score route is at `/api/risk/score`.

9. **Pure computation pattern**: Aggregation modules are pure synchronous functions. No I/O, no side effects, no external service calls. The API route collects data and passes it in. `emerging-risk-detection.ts` MUST follow this pattern.

10. **Bottleneck IDs are project-prefixed**: All IDs are prefixed with `${project}-` to prevent cross-project key collisions. Emerging risk IDs should follow: `${projectId}-emerging-${pattern-type}`.

11. **Empty fallback pattern**: The route uses `EMPTY_HEALTH` constant for non-bmad projects. Use similar empty fallbacks for throughput, cycleTime, teamWorkload, storyAging when `isBmad` is false.

### Files to Modify

#### `packages/web/src/app/api/risk/score/route.ts` (MODIFY)
The key change is in `computeProjectScore()`. Replace:
```typescript
cycleTime: { bottleneckColumn: null, averageColumnDwells: [], completedCount: 0 },
throughput: { bottleneckTrend: null, columnTrends: [] },
teamWorkload: { overloaded: [], unassigned: [], members: [], overloadThreshold: 0 },
storyAging: { agingStories: [] },
```
With real data from tracker functions. Add parameters to `computeProjectScore()` for throughput, cycleTime, teamWorkload, storyAging, or pass them through a larger context object.

Also add emerging risk detection call after score computation and include `emergingRisks` in response.

#### `packages/web/src/lib/risk-aggregation.ts` (MODIFY)
- Add optional `throughputData?: ThroughputResult` to `RiskAggregationInput`
- Use throughput slope to derive `trend` values instead of hardcoding `"stable"`
- For velocity-anomaly factors: if throughput weekly slope is negative → "worsening", positive → "improving"
- For resource-bottleneck factors: if capacity trending up → "worsening"

#### `packages/web/src/lib/bottleneck-aggregation.ts` (MODIFY)
- Expand trend derivation to use all `columnTrends` data (currently only 2 of 10 types get real trends)
- For column-bottleneck: use throughput column slope
- For throughput-drop: derive from throughput trend
- For aging-stories: derive from story aging trends
- For capacity-bottleneck: derive from utilization trajectory

#### `packages/web/src/components/RiskScorePanel.tsx` (MODIFY)
- Add `emergingRisks` to the fetch response type
- Add `EmergingRiskCard` inline component with emerging-risk styling
- Render emerging risks section below the score card, above the contributors breakdown

### Testing Strategy

**Unit tests (emerging-risk-detection.test.ts):**
- No emerging risks when throughput is healthy
- Velocity drop detected when recent throughput drops below threshold
- Throughput decline detected from positive column slopes
- Capacity trend detected from high utilization
- Blocker accumulation detected from stuck stories + throughput drop
- Aging acceleration detected from aging stories pattern
- Multiple emerging risks can be detected simultaneously
- Emerging risk severity is correctly calculated
- Project-prefixed IDs prevent cross-project collisions

**API route tests (route.test.ts additions):**
- Emerging risks included in response when patterns detected
- Real throughput data wired through (no empty stubs)
- Non-bmad projects return empty throughput/cycleTime gracefully
- Emerging risks empty when no patterns detected

**Component tests (RiskScorePanel.test.tsx additions):**
- Emerging risks section rendered when data present
- EmergingRiskCard shows pattern, trajectory, cause
- Empty state when no emerging risks

### NFRs
- **NFR-E3-1:** Risk analysis refreshes within 5 seconds — emerging risk detection is O(n) on already-computed throughput data
- **NFR-E3-2:** Dashboard supports up to 100 concurrent risk items — emerging risks add ~5-10 more items max
- **NFR-P1:** Dashboard loads within 2 seconds — additional tracker calls add ~200ms per project

### Pre-existing Types (Use These, Do NOT Modify)
- `RiskFactor`, `RiskSummary`, `RiskDashboardResponse`, `RiskFactorType`, `RiskSeverityLabel`, `RiskTrend` — from `risk-aggregation.ts`
- `BottleneckItem`, `BottleneckImpact`, `BottleneckSummary`, `BottleneckDashboardResponse`, `BottleneckType`, `BottleneckTrend` — from `bottleneck-aggregation.ts`
- `RiskScoreResult`, `RiskScoreContributor`, `PortfolioRiskResult` — from `risk-score.ts`
- `SprintHealthResult`, `HealthIndicator`, `CycleTimeStats`, `ThroughputResult`, `TeamWorkloadResult`, `StoryAgingResult`, `ColumnTrend` — from `@composio/ao-plugin-tracker-bmad`
- `CapacityRaw`, `AgentUtilRaw` — from `risk-aggregation.ts`

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use CSS variables for theming
- `"use client"` directive on components

### References
- [Source: epics-cycle-10.md#Story 56.4] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E3-5] — "The dashboard highlights emerging risks based on pattern detection"
- [Source: prd-cycle-10.md#NFR-E3-1, NFR-E3-2] — Performance NFRs
- [Source: packages/web/src/lib/risk-aggregation.ts] — Risk factor aggregation (trend field to populate)
- [Source: packages/web/src/lib/bottleneck-aggregation.ts] — Bottleneck aggregation (trend field to populate)
- [Source: packages/web/src/lib/risk-score.ts] — Composite risk scoring
- [Source: packages/web/src/app/api/risk/score/route.ts] — API route (empty stubs to replace)
- [Source: packages/plugins/tracker-bmad/src/throughput.ts] — Throughput data with ColumnTrend time-series
- [Source: packages/plugins/tracker-bmad/src/sprint-health.ts] — Sprint health indicators
- [Source: packages/web/src/components/RiskScorePanel.tsx] — Component to extend
- [Source: packages/web/src/app/risk/page.tsx] — Risk page integration point
- [Source: _bmad-output/implementation-artifacts/56-1-risk-dashboard-overview.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/56-2-bottleneck-identification.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/56-3-risk-score-calculation.md] — Previous story (done)

## Dev Agent Record
### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 79 tests pass across 5 test files
- Route wires real throughput data to `aggregateRiskFactors()` via `throughputData` field
- Route wires real data to `aggregateBottlenecks()` replacing empty stubs
- Route includes `emergingRisks` in both single-project and portfolio responses
- EmergingRiskCard component uses yellow theme with trajectory icons (▲/▼/●)
- Pre-existing bug fixed: agent-overload bottleneck item was missing `affectedProjects` and `affectedStories` fields
- Non-bmad projects gracefully fall back to empty data constants

### File List

- `packages/web/src/lib/emerging-risk-detection.ts` — NEW: Pure computation module for detecting emerging risks from throughput patterns
- `packages/web/src/lib/__tests__/emerging-risk-detection.test.ts` — NEW: 16 unit tests for pattern detection
- `packages/web/src/app/api/risk/score/route.ts` — MODIFIED: Wires real tracker data, calls detectEmergingRisks, includes emergingRisks in response
- `packages/web/src/app/api/risk/score/route.test.ts` — MODIFIED: Added emerging risk mocks and 2 new test cases
- `packages/web/src/lib/risk-aggregation.ts` — MODIFIED: Added ThroughputDataContext, deriveTrend() helper, real trend values
- `packages/web/src/lib/bottleneck-aggregation.ts` — MODIFIED: Added deriveBottleneckTrend() helper, real trend values, fixed agent-overload bug
- `packages/web/src/components/RiskScorePanel.tsx` — MODIFIED: Added EmergingRiskCard, EmergingRisk interface, trajectory helpers
- `packages/web/src/components/__tests__/RiskScorePanel.test.tsx` — MODIFIED: Added 4 emerging risk test cases
