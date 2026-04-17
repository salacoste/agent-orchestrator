# Story 56.3: Risk Score Calculation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **each story, sprint, and project to have a calculated risk score**,
so that **I can identify and prioritize high-risk items**.

## Acceptance Criteria

1. **Given** the system has computed risk factors and bottlenecks
   **When** I view any project in the risk dashboard
   **Then** I see a composite risk score (0-100) for that project
   **And** the score reflects the combined severity of risk factors and bottlenecks
   **And** the score updates when underlying factors change

2. **Given** a risk score is displayed
   **When** I click on the score
   **Then** I see a breakdown of contributing factors with their individual scores
   **And** I can see which factors contribute the most to the overall score

3. **Given** risk scores exist for multiple projects
   **When** I view the portfolio or risk dashboard
   **Then** projects and sprints are sortable by risk score
   **And** I can identify the highest-risk items at a glance

## Tasks / Subtasks

- [x] Task 1: Create risk score calculation module (AC: #1, #2)
  - [x] 1.1: Create `packages/web/src/lib/risk-score.ts` — pure computation module that calculates composite risk scores from risk factors and bottleneck data
  - [x] 1.2: Define `RiskScoreResult`, `RiskScoreBreakdown`, `RiskContributor` types
  - [x] 1.3: Implement `calculateRiskScore()` — combines risk factor severities and bottleneck impact scores into a single 0-100 composite score
  - [x] 1.4: Implement `getTopContributors()` — returns the top N factors contributing to the score with weights

- [x] Task 2: Create risk score API endpoint (AC: #1, #2, #3)
  - [x] 2.1: Create `packages/web/src/app/api/risk/score/route.ts` — GET endpoint returning risk scores per project and optionally per sprint
  - [x] 2.2: Accept `?project=` query param for per-project score, or return all projects when omitted
  - [x] 2.3: Accept `?breakdown=true` query param to include contributing factor details
  - [x] 2.4: Reuse data collection pattern from `/api/risk/dashboard` and `/api/risk/bottleneck` routes

- [x] Task 3: Create RiskScoreCard component (AC: #1, #2)
  - [x] 3.1: Create inline `RiskScoreCard` component inside a new `RiskScorePanel.tsx` — shows composite score as a gauge/badge with severity coloring
  - [x] 3.2: Click handler expands to show contributing factors breakdown
  - [x] 3.3: Export `RiskScoreCard` for testing

- [x] Task 4: Integrate RiskScorePanel into existing pages (AC: #3)
  - [x] 4.1: Add `RiskScorePanel` to the `/risk` page as a section alongside RiskDashboard and BottleneckDashboard
  - [x] 4.2: Add risk score badges to project cards if the portfolio page renders them

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Create `packages/web/src/lib/__tests__/risk-score.test.ts` — unit tests for score calculation logic
  - [x] 5.2: Create `packages/web/src/app/api/risk/score/route.test.ts` — API route tests
  - [x] 5.3: Create `packages/web/src/components/__tests__/RiskScorePanel.test.tsx` — component rendering tests

- [x] Task 6: Update sprint-status.yaml
  - [x] 6.1: Verify all tests pass
  - [x] 6.2: Update `56-3-risk-score-calculation` status

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
   - Requires: Velocity trend tracking, pattern detection model
   - Epic: Story 56.4 / Epic 56
   - Current: Risk scores are snapshot-based, no predictive element
2. **Configurable risk alerts (Story 56.5)**
   - Status: Deferred — Requires alerting infrastructure
   - Requires: Threshold configuration, notification channels
   - Epic: Story 56.5 / Epic 56
   - Current: No alerting when scores exceed thresholds
3. **Risk trend over time (FR-E3-5)**
   - Status: Deferred — Requires historical score storage
   - Requires: Time-series persistence for risk scores
   - Epic: Future story
   - Current: Scores are computed on-demand with no history
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
- `aggregateRiskFactors(input)` from `@/lib/risk-aggregation` — EXISTING: returns `RiskDashboardResponse { riskFactors, summary, lastUpdated }`
- `aggregateBottlenecks(input)` from `@/lib/bottleneck-aggregation` — EXISTING: returns `BottleneckDashboardResponse { bottlenecks, summary, lastUpdated }`
- `computeSprintHealth(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `SprintHealthResult { overall, indicators, stuckStories, wipColumns }`
- `getCapacityStatus(workloadMap, config, agentProjectMap)` from `@composio/ao-core` — EXISTING: per-agent capacity warnings
- `runConflictDetection(config)` from `@composio/ao-core` — EXISTING: cross-project conflict detection
- `computeCycleTime(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `CycleTimeStats`
- `computeThroughput(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `ThroughputResult`
- `computeTeamWorkload(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `TeamWorkloadResult`
- `computeStoryAging(project)` from `@composio/ao-plugin-tracker-bmad` — EXISTING: returns `StoryAgingResult`

**Feature Flags:**
- None required — all data sources already exist in the codebase

## Dependency Review

No new external dependencies required. This story aggregates data from existing modules (`risk-aggregation`, `bottleneck-aggregation`) and existing tracker-bmad/core functions.

## Dev Notes

### Architecture Context

This is **Story 3 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is in the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Story 56-1 (DONE) and 56-2 (DONE) context:**
- 56-1 created `risk-aggregation.ts` with `aggregateRiskFactors()` — produces `RiskFactor[]` with individual severity scores (0-100) per factor
- 56-2 created `bottleneck-aggregation.ts` with `aggregateBottlenecks()` — produces `BottleneckItem[]` with impact scores per bottleneck
- Both are **pure computation modules** — no I/O, no side effects
- Both share identical `getSeverityLabel()` and `mapHealthSeverity()` helpers
- The `/risk` page renders both `<RiskDashboard>` and `<BottleneckDashboard>` sequentially
- API routes follow `/api/risk/` prefix pattern

**What this story adds:** A composite risk score that **combines** the outputs of both aggregation modules into a single 0-100 score per project (and optionally per sprint). This score is the "roll-up" that lets PMs compare projects at a glance.

### What Already Exists (Do NOT Reinvent)

#### Risk Factors (risk-aggregation.ts)
- `RiskFactor { id, type, severity (0-100), severityLabel, trend, affectedProjects, contributingFactors, affectedStories, suggestedAction }`
- `RiskSummary { critical, high, medium, low, total }`
- `aggregateRiskFactors(input): RiskDashboardResponse` — pure function
- Severity helpers: `getSeverityLabel(score)`, `mapHealthSeverity()`
- Five risk factor types: `high-risk-stories`, `resource-bottleneck`, `velocity-anomaly`, `blocking-pattern`, `scope-creep`

#### Bottlenecks (bottleneck-aggregation.ts)
- `BottleneckItem { id, type, severity (0-100), severityLabel, impact: { storiesAffected, estimatedDelayDays, impactScore }, trend, affectedProjects, affectedStories, contributingFactors, suggestedAction }`
- `BottleneckSummary { stuckStories, wipViolations, agingStories, overloadedAgents, resourceConflicts, totalBottlenecks }`
- `aggregateBottlenecks(input): BottleneckDashboardResponse` — pure function
- Impact scoring: `storiesAffected * 10 + delayDays * 5 + severityNum * 0.3`, capped at 100
- Ten bottleneck types: `column-bottleneck`, `stuck-stories`, `wip-violation`, `throughput-drop`, `agent-overload`, `capacity-bottleneck`, `resource-conflict`, `unassigned-stories`, `aging-stories`, `bottleneck-trend`

#### Sprint Health Score (computed in route)
- Inline in `/api/risk/dashboard/route.ts` (lines 79-86): starts at 100, subtracts per indicator/stuck story, clamped to [0, 100]

#### API Routes
- `GET /api/risk/dashboard?project=xxx` → `RiskDashboardResponse`
- `GET /api/risk/bottleneck?project=xxx` → `BottleneckDashboardResponse`

### What This Story Actually Does

1. **Risk score calculation module** (`risk-score.ts`): Pure computation that takes `RiskFactor[]` and `BottleneckItem[]` as inputs and produces a composite `RiskScoreResult` with:
   - Overall risk score (0-100)
   - Breakdown by category (risk factors vs bottlenecks)
   - Top contributing factors with their individual scores and weight percentages
   - Severity label derived from the score

2. **Risk score API endpoint** (`/api/risk/score`): GET endpoint that calls existing aggregation modules, then passes their outputs to the score calculator. Returns `RiskScoreResult` with optional `?breakdown=true` for contributor details.

3. **RiskScorePanel component**: Renders the composite score as a prominent badge/card with severity coloring. Click expands to show top contributing factors.

4. **Integration**: Add `RiskScorePanel` as a section at the top of the `/risk` page, before the existing `RiskDashboard` and `BottleneckDashboard`.

### Critical Design Decisions

1. **Aggregate from aggregators, don't re-query** — The score module takes the already-computed `RiskFactor[]` and `BottleneckItem[]` as inputs. It does NOT directly call tracker-bmad functions. The API route gathers data via existing aggregation modules and passes results to the score calculator.

2. **Weighted composite formula** — The risk score should reflect both the number and severity of issues:
   - Each risk factor's severity contributes proportionally
   - Each bottleneck's impact score contributes proportionally
   - Critical-severity items should weigh more than low-severity items
   - Suggested formula: `score = min(100, sum(factor.severity * weight for factor) / maxPossibleScore * 100)`
   - Alternatively: weighted average where critical=1.0 weight, high=0.7, medium=0.4, low=0.2

3. **Score range 0-100** — Consistent with existing severity scales. Same `getSeverityLabel()` thresholds: 76+=critical, 51+=high, 26+=medium, below=low.

4. **No new dependencies** — Uses only existing modules and React patterns.

5. **Pure computation** — `calculateRiskScore()` is a pure function like the existing aggregation modules. No I/O, no side effects. Takes structured input, returns structured output.

6. **Contributor breakdown** — The score should be explainable. When a user clicks the score, they see which factors contribute what percentage. This means the calculation must track per-factor contribution, not just produce a final number.

### Risk Score Calculation Strategy

```typescript
interface RiskScoreInput {
  riskFactors: RiskFactor[];
  bottlenecks: BottleneckItem[];
  sprintHealthScore?: number; // optional, 0-100
}

interface RiskScoreContributor {
  id: string;
  title: string;
  type: "risk-factor" | "bottleneck" | "sprint-health";
  score: number;          // this item's individual score
  weight: number;         // how much this item contributes (0-1)
  contributionPercent: number; // % of total score this represents
}

interface RiskScoreResult {
  projectId: string;
  score: number;                    // 0-100 composite
  severityLabel: RiskSeverityLabel;
  contributors: RiskScoreContributor[];
  factorCount: number;
  bottleneckCount: number;
  lastUpdated: string;
}
```

**Scoring approach:**
- Collect all individual severity scores from `riskFactors[].severity` and `bottlenecks[].impact.impactScore`
- Apply severity-based weighting: critical(76+) gets weight 1.5, high(51-75) gets weight 1.0, medium(26-50) gets weight 0.6, low(0-25) gets weight 0.3
- If `sprintHealthScore` is provided, add `(100 - sprintHealthScore) * 0.5` as a factor (inverted — lower health = higher risk)
- Normalize weighted sum to 0-100 range
- Cap at 100

### Component Layout

```
┌──────────────────────────────────────────────────────────┐
│ Risk Dashboard                                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Project Risk Score: 72 (HIGH)              [▼]  │    │
│  │  5 risk factors · 3 bottlenecks                  │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ (expanded) Top Contributors:                      │    │
│  │  ■ Review bottleneck (impact: 87) — 32%          │    │
│  │  ■ 4 stuck stories (severity: 80) — 24%          │    │
│  │  ■ Agent overload (impact: 60) — 18%             │    │
│  │  ■ Sprint health 42/100 — 15%                    │    │
│  │  ■ WIP violation (severity: 50) — 11%            │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│  │Stuck│ │ WIP │ │Aging│ │Ovld │ │Confl│  ← Existing  │
│  │  4  │ │  2  │ │  7  │ │  3  │ │  1  │    summary   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│  ...existing risk factors and bottlenecks...            │
└──────────────────────────────────────────────────────────┘
```

### API Response Shape

```json
GET /api/risk/score?project=my-project&breakdown=true
{
  "projectId": "my-project",
  "projectName": "My Project",
  "score": 72,
  "severityLabel": "high",
  "factorCount": 5,
  "bottleneckCount": 3,
  "contributors": [
    {
      "id": "my-project-bn-column-review",
      "title": "\"review\" is a flow bottleneck (3.2x next column)",
      "type": "bottleneck",
      "score": 87,
      "weight": 1.5,
      "contributionPercent": 32
    },
    {
      "id": "indicator-stuck-stories",
      "title": "3 stories stuck > 48h",
      "type": "risk-factor",
      "score": 80,
      "weight": 1.5,
      "contributionPercent": 24
    }
  ],
  "lastUpdated": "2026-04-07T12:00:00Z"
}
```

For multi-project (no `?project=` param):

```json
GET /api/risk/score
{
  "scores": [
    { "projectId": "project-a", "projectName": "Project A", "score": 72, "severityLabel": "high", "factorCount": 5, "bottleneckCount": 3 },
    { "projectId": "project-b", "projectName": "Project B", "score": 25, "severityLabel": "low", "factorCount": 1, "bottleneckCount": 0 }
  ],
  "portfolioScore": 48,
  "portfolioSeverityLabel": "medium",
  "lastUpdated": "2026-04-07T12:00:00Z"
}
```

### Integration with Story 56-1 and 56-2 (DONE — Key Learnings)

Both 56-1 and 56-2 are complete. Here's what was actually implemented and how this story integrates:

**Implementation Facts (from 56-1 and 56-2):**
- Risk Dashboard is at `/risk` route (`packages/web/src/app/risk/page.tsx`) — renders `<RiskDashboard>` then `<BottleneckDashboard>` with `space-y-8`
- Both components are **flat lists** — NO tabs. Sections render sequentially
- `RiskDashboard.tsx` exports `RiskFactorCard` inline for testing (316 lines)
- `BottleneckDashboard.tsx` exports `BottleneckCard` and `SummaryCard` inline for testing (367 lines)
- Aggregation modules: `risk-aggregation.ts` (249 lines), `bottleneck-aggregation.ts` (508 lines)
- API routes: `/api/risk/dashboard`, `/api/risk/bottleneck` — both accept `?project=` param
- `@composio/ao-core` only exports `"."` and `"./types"` in package.json — subpath imports like `@composio/ao-core/capacity-check` fail in Vite/test. Must import from top-level
- Component patterns: CSS variables (`var(--color-text-primary)`, etc.), text sizes `text-[10px]`/`text-[11px]`/`text-[12px]`/`text-[13px]`, border radius `rounded-[6px]`/`rounded-[5px]`, `"use client"` directive
- Test patterns: `vi.mock("@composio/ao-core", () => ({ ... }))` for top-level mock, `act()` from `@testing-library/react` for async state, `waitFor` for data loading

**Integration approach:** Add `RiskScorePanel` as a section at the TOP of the `/risk` page, before the existing `RiskDashboard` and `BottleneckDashboard`. The page becomes:

```
// packages/web/src/app/risk/page.tsx (after 56-3)
<main className="mx-auto max-w-7xl px-8 py-6">
  <RiskScorePanel projects={projects} />       {/* NEW — top of page */}
  <RiskDashboard projects={projects} />         {/* existing from 56-1 */}
  <BottleneckDashboard projects={projects} />   {/* existing from 56-2 */}
</main>
```

### Testing Strategy

**Unit tests (risk-score.test.ts):**
- Score calculation from empty inputs returns 0
- Score calculation from single critical risk factor returns high score
- Score reflects combined risk factors and bottlenecks
- Severity weighting produces expected results
- Sprint health score contributes when below threshold
- Top contributors are correctly ranked by contribution %
- Multi-project scores are computed independently
- Score capped at 100 for extreme inputs

**API route tests (route.test.ts):**
- Returns 200 with score for valid project
- Returns 404 for unknown project
- Returns breakdown when `?breakdown=true`
- Returns all project scores when no project param
- Handles projects with no risk data (returns 0 score)
- Portfolio score is computed correctly

**Component tests (RiskScorePanel.test.tsx):**
- Renders score badge with correct severity styling
- Shows factor and bottleneck counts
- Click expands contributor breakdown
- Empty state when no risk data
- Multiple project scores rendered correctly

### NFRs
- **NFR-E3-1:** Risk analysis refreshes within 5 seconds — score calculation is O(n) on already-computed data
- **NFR-E3-2:** Dashboard supports up to 100 concurrent risk items — client-side rendering, no server limit
- **NFR-P1:** Dashboard loads within 2 seconds — lightweight calculation on cached data
- **NFR-P4:** API endpoint responds within 500ms (p95) — aggregation + score calculation

### Pre-existing Types (Use These, Do NOT Modify)
- `RiskFactor`, `RiskSummary`, `RiskDashboardResponse`, `RiskFactorType`, `RiskSeverityLabel`, `RiskTrend` — from `risk-aggregation.ts`
- `BottleneckItem`, `BottleneckImpact`, `BottleneckSummary`, `BottleneckDashboardResponse`, `BottleneckType` — from `bottleneck-aggregation.ts`
- `HealthIndicatorRaw`, `CapacityRaw`, `AgentUtilRaw`, `RiskAggregationInput` — from `risk-aggregation.ts`
- `SprintHealthRaw`, `CycleTimeRaw`, `ThroughputRaw`, `TeamWorkloadRaw`, `StoryAgingRaw`, `BottleneckAggregationInput` — from `bottleneck-aggregation.ts`
- `SprintHealthResult`, `CycleTimeStats`, `ThroughputResult`, `TeamWorkloadResult`, `StoryAgingResult` — from `@composio/ao-plugin-tracker-bmad`

### Learnings from Stories 56-1 and 56-2 (MUST Follow)

These are verified patterns from completed stories. The dev agent MUST follow these to avoid regressions:

1. **Package import resolution**: `@composio/ao-core` only exports `"."` and `"./types"` in package.json. Subpath imports like `@composio/ao-core/agent-utilization` or `@composio/ao-core/capacity-check` fail in Vite/test resolution. Import from top-level `@composio/ao-core` only.

2. **Mock pattern for tests**: When mocking `@composio/ao-core` in vitest, use single top-level mock:
   ```typescript
   vi.mock("@composio/ao-core", () => ({
     getCapacityStatus: vi.fn(() => new Map()),
     runConflictDetection: vi.fn(() => ({ conflicts: [], scanDurationMs: 1 })),
   }));
   ```
   Do NOT use `importOriginal` with subpath type imports — ESLint `consistent-type-imports` rule rejects the pattern.

3. **Severity label helper**: 56-1 and 56-2 established `getSeverityLabel(score)` with thresholds: 76+=critical, 51+=high, 26+=medium, below=low. Use this same function for score severity labels. Both modules have their own copy — the score module should have its own too (don't import from either to avoid circular deps).

4. **Component structure**: Export inline sub-components (like `RiskFactorCard`, `BottleneckCard`) from the main component file for testability. Don't create separate files for small card components.

5. **Test async patterns**: Use `act()` from `@testing-library/react` for resolving pending promises in loading state tests. Use `waitFor` for data loading assertions.

6. **CSS conventions**: Use CSS variables (`var(--color-text-primary)`, etc.), pixel-based text sizes (`text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`), border radius `rounded-[6px]` for cards.

7. **Route pattern**: API routes for risk use `/api/risk/` prefix. Follow this pattern for `/api/risk/score`.

8. **Pure computation pattern**: Aggregation modules are pure synchronous functions. No I/O, no side effects, no external service calls. The API route collects data and passes it in.

9. **Data collection in route**: The route handler in `/api/risk/bottleneck/route.ts` shows the canonical pattern for collecting data from tracker-bmad and ao-core. Reuse this pattern. Key points:
   - Get `config` and `sessionManager` from `getServices()`
   - Loop over `projectIds`
   - Check `isBmad` before calling tracker functions
   - Run `runConflictDetection(config)` ONCE outside the loop (cross-project)
   - Filter conflicts per-project inside the loop

10. **Bottleneck IDs are project-prefixed**: After the code review in 56-2, all bottleneck IDs are prefixed with `${project}-` to prevent cross-project key collisions. Follow this pattern.

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

### References
- [Source: epics-cycle-10.md#Story 56.3] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E3-2] — "Each risk is scored (0-100) based on impact and probability"
- [Source: prd-cycle-10.md#FR-E3-3] — "Users can drill down into each risk for detailed analysis and contributing factors"
- [Source: prd-cycle-10.md#NFR-E3-1, NFR-E3-2] — Performance NFRs
- [Source: packages/web/src/lib/risk-aggregation.ts] — Risk factor aggregation with severity scoring
- [Source: packages/web/src/lib/bottleneck-aggregation.ts] — Bottleneck aggregation with impact scoring
- [Source: packages/web/src/app/api/risk/dashboard/route.ts] — Risk dashboard API route (data collection pattern)
- [Source: packages/web/src/app/api/risk/bottleneck/route.ts] — Bottleneck API route (data collection pattern)
- [Source: packages/web/src/components/RiskDashboard.tsx] — Risk dashboard component pattern
- [Source: packages/web/src/components/BottleneckDashboard.tsx] — Bottleneck dashboard component pattern
- [Source: packages/web/src/app/risk/page.tsx] — Risk page integration point
- [Source: _bmad-output/implementation-artifacts/56-1-risk-dashboard-overview.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/56-2-bottleneck-identification.md] — Previous story (done)

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Initial route.ts had corrupted imports (duplicate + missing comma) — fixed by rewriting import section
- RiskScorePanel.test.tsx had duplicate @testing-library/react import — merged into single import
- RiskScoreCard initially missing projectName rendering — added conditional projectName display

### Completion Notes List
1. Task 1 (risk-score.ts): Pure computation module with `calculateRiskScore()`, `calculatePortfolioScore()`, `getTopContributors()`. 12 tests passing.
2. Task 2 (API route): GET /api/risk/score with `?project=` and `?breakdown=true` params. Single-project and portfolio modes. 9 tests passing.
3. Task 3 (Component): `RiskScorePanel` fetches portfolio scores, `RiskScoreCard` renders with severity styling and expandable contributor breakdown. 8 tests passing.
4. Task 4 (Integration): Added RiskScorePanel as top section on /risk page.
5. Task 5 (Tests): 29 total tests passing across 3 test files.
6. Task 6 (Sprint status): Updated.

### Limitations (Deferred Items)
1. **Emerging risk detection (Story 56.4)**
   - Status: Deferred — Requires time-series pattern analysis
   - Requires: Velocity trend tracking, pattern detection model
   - Epic: Story 56.4 / Epic 56
   - Current: Risk scores are snapshot-based, no predictive element
2. **Configurable risk alerts (Story 56.5)**
   - Status: Deferred — Requires alerting infrastructure
   - Requires: Threshold configuration, notification channels
   - Epic: Story 56.5 / Epic 56
   - Current: No alerting when scores exceed thresholds
3. **Risk trend over time (FR-E3-5)**
   - Status: Deferred — Requires historical score storage
   - Requires: Time-series persistence for risk scores
   - Epic: Future story
   - Current: Scores are computed on-demand with no history

### File List
- `packages/web/src/lib/risk-score.ts` (NEW) — composite risk score calculation module
- `packages/web/src/lib/__tests__/risk-score.test.ts` (NEW) — 12 unit tests
- `packages/web/src/app/api/risk/score/route.ts` (NEW) — GET /api/risk/score endpoint
- `packages/web/src/app/api/risk/score/route.test.ts` (NEW) — 9 API route tests
- `packages/web/src/components/RiskScorePanel.tsx` (NEW) — RiskScorePanel + RiskScoreCard components
- `packages/web/src/components/__tests__/RiskScorePanel.test.tsx` (NEW) — 8 component tests
- `packages/web/src/app/risk/page.tsx` (MODIFIED) — added RiskScorePanel integration
