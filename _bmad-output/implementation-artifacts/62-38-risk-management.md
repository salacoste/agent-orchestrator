# Story 62.38: Risk Management

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Risk Management documentation page that documents the risk score computation system, risk factor aggregation with severity model, emerging risk pattern detection, bottleneck identification across 10 types, utilization metrics with time-series tracking, optimization engine with 5 analyzers and 4 objectives, alert configuration with SSE real-time updates, and the complete risk API surface,
so that I can understand how composite risk scores are calculated (0-100, weighted sum), how risk factors are aggregated from sprint health/capacity/utilization data, how emerging risks are detected via 5 pattern detectors, how bottlenecks are identified from 8 data sources, how optimization suggestions are generated and ranked with learning feedback, how alerts are evaluated against configurable thresholds and broadcast via SSE, and how each component connects to backend APIs and core engine modules.

## Acceptance Criteria

1. **Risk Management page** (`docs/web-dashboard/risk-management.md`) documents an "Overview" section describing the risk page at `/risk` as a server component with 5 stacked panels (RiskScorePanel, RiskDashboard, BottleneckDashboard, UtilizationMetricsPanel, OptimizationPanel), `force-dynamic` rendering, and project list data loading — sourced from `packages/web/src/app/risk/page.tsx`
2. **Risk Management page** documents a "Risk Score" section describing `RiskScorePanel` with portfolio mode (average of all project scores), per-project score cards with expandable emerging risks and top contributors, `calculateRiskScore()` weighted formula using `SEVERITY_WEIGHTS` (critical=1.5, high=1.0, medium=0.6, low=0.3) normalized by 150, `calculatePortfolioScore()` mean average, `RiskScoreCard` expandable sections, `EmergingRiskCard` with trajectory icon and color, and `RiskAlertBanner` integration — sourced from `packages/web/src/components/RiskScorePanel.tsx`, `packages/web/src/lib/risk-score.ts`
3. **Risk Management page** documents a "Risk Factor Aggregation" section describing `aggregateRiskFactors()` with 5 factor types (high-risk-stories, resource-bottleneck, velocity-anomaly, blocking-pattern, scope-creep), severity model (>=76 critical, >=51 high, >=26 medium, else low), agent overutilization threshold (>90%), underutilization threshold (<30% while active), sprint health risk threshold (<60), trend derivation from throughput slope (+/-0.05), and `RiskDashboard` with 4-column summary grid, project filter, expandable factor cards, 30-second auto-refresh — sourced from `packages/web/src/components/RiskDashboard.tsx`, `packages/web/src/lib/risk-aggregation.ts`
4. **Risk Management page** documents an "Emerging Risk Detection" section describing `detectEmergingRisks()` with 5 pattern detectors (velocity-drop ratio<0.75, throughput-decline slope>0.05, capacity-trend utilization>70%, blocker-accumulation stuckStories>=3, aging-acceleration), each with severity ranges, trajectory classification (worsening/improving/stable), and EmergingRisk shape (13 fields) — sourced from `packages/web/src/lib/emerging-risk-detection.ts`
5. **Risk Management page** documents a "Bottleneck Analysis" section describing `aggregateBottlenecks()` with 10 bottleneck types (column-bottleneck, stuck-stories, wip-violation, throughput-drop, agent-overload, capacity-bottleneck, resource-conflict, unassigned-stories, aging-stories, bottleneck-trend), 8 data source inputs (sprint health, cycle time, throughput, team workload, story aging, capacity, conflicts), impact score formula (storiesAffected×10 + delayDays×5 + severityNum×0.3), column bottleneck detection (ratio >=2x), stuck story thresholds (48h warning, 96h critical), `BottleneckDashboard` with 5-column summary, expandable cards, 30-second auto-refresh — sourced from `packages/web/src/components/BottleneckDashboard.tsx`, `packages/web/src/lib/bottleneck-aggregation.ts`
6. **Risk Management page** documents a "Utilization Metrics" section describing `UtilizationMetricsPanel` with portfolio mode (4-column metric grid + project cards) and single-project mode (agent rows with utilization bars), time window selector (1h/24h/7d), thresholds (overutilized>90%, underutilized<30%), `UtilizationTimeSeries` with rolling averages (1h/24h/7d), `computeRollingAverage()` arithmetic mean, `computeTrend()` half-comparison with 5pp delta, `buildProjectSummary()` and `buildPortfolioOverview()` aggregation, 30-second auto-refresh, and in-memory `globalThis._aoUtilizationHistory` singleton — sourced from `packages/web/src/components/UtilizationMetricsPanel.tsx`, `packages/web/src/lib/utilization-snapshot.ts`, `packages/web/src/lib/utilization-history.ts`, `packages/web/src/lib/utilization-metrics-types.ts`
7. **Risk Management page** documents an "Optimization Engine" section describing 5 analyzers (agent-rebalancing cross-project pairs, wip-adjustment severity>=40, priority-reorder stuck/aging stories, capacity-scaling at/near capacity, underutilized-detection <30%), ranking formula (daysSaved×2 + riskReduction×1.5 + |utilDelta|×1 + confidence×0.1), 5 categories with badge colors, confidence ranges, `OptimizationPanel` with objective selector (baseline + 4 objectives), category filter chips, impact analysis toggle, accept/dismiss actions — sourced from `packages/web/src/components/OptimizationPanel.tsx`, `packages/web/src/lib/optimization-engine.ts`, `packages/web/src/lib/underutilized-analyzer.ts`
8. **Risk Management page** documents an "Objective Scenarios" section describing 4 objectives (minimize-time, maximize-throughput, balance-workload, reduce-blocking) with per-objective rank weights and boost/suppress categories from `OBJECTIVE_RANK_WEIGHTS` and `OBJECTIVE_ANALYZER_PRIORITY`, `ObjectiveComparisonPanel` for side-by-side comparison, `BeforeAfterComparison` with inverted flag for risk score, and `ImpactDetail` with completion/velocity/risk/utilization projections — sourced from `packages/web/src/lib/optimization-scenario.ts`, `packages/web/src/components/OptimizationPanel.tsx`
9. **Risk Management page** documents an "Optimization Learning" section describing `OptimizationFeedback` recording (max 1000 entries), `computeCategoryAcceptanceRates()`, `computeLearningWeights()` mapping acceptance rate to multiplier (boost max 1.5, penalty max 0.5, min samples 3), `applyLearningWeights()` priority multiplication, PATCH endpoint for accept/dismiss, DELETE endpoint for reset, and `VELOCITY_UTILIZATION_RATIO=0.8` for impact analysis — sourced from `packages/web/src/lib/optimization-feedback.ts`, `packages/web/src/lib/optimization-learning.ts`, `packages/web/src/lib/optimization-impact.ts`
10. **Risk Management page** documents a "Risk Alerts" section describing `RiskAlertBanner` with severity styling (critical=red, high=yellow, medium=raised), icon mapping (score-threshold=triangle, emerging-risk=microscope), acknowledge button, `useRiskAlertSSE` hook subscribing to `/api/events` for `risk-alert` event type, `DEFAULT_RISK_ALERT_CONFIG` with 3 default thresholds (score>=76 critical, score>=51 high, emerging-risk>=60), `evaluateRiskAlerts()` per-project threshold resolution with project override fallback, alert ID deduplication, and `globalThis._aoRiskAlertBroadcaster` singleton pub/sub — sourced from `packages/web/src/components/RiskAlertBanner.tsx`, `packages/web/src/hooks/useRiskAlertSSE.ts`, `packages/web/src/lib/risk-alert-broadcaster.ts`, `packages/web/src/lib/risk-alert-evaluation.ts`, `packages/web/src/lib/risk-alert-types.ts`
11. **Risk Management page** documents an "Alert Configuration" section describing `RiskAlertConfig` with enabled flag, default thresholds array, project overrides record, `GET /api/risk/alerts/config` returning full config, `PUT /api/risk/alerts/config` with partial merge and validation (minScore 0-100, enabled boolean), in-memory config singleton via `getAlertConfig()/updateAlertConfig()`, and `GET/PATCH /api/risk/alerts` for listing and acknowledging — sourced from `packages/web/src/lib/risk-alert-config.ts`, `packages/web/src/app/api/risk/alerts/route.ts`, `packages/web/src/app/api/risk/alerts/config/route.ts`
12. **Risk Management page** documents an "API Routes" section listing all 7 endpoint groups: `GET /api/risk/dashboard`, `GET /api/risk/score`, `GET /api/risk/bottleneck`, `GET /api/risk/utilization`, `GET/PATCH/DELETE /api/risk/optimization`, `GET/PATCH /api/risk/alerts`, `GET/PUT /api/risk/alerts/config` — with method, purpose, query params, body shape, validation rules, and response shapes
13. **Risk Management page** documents a "Key Types" section listing: `RiskFactor` (10 fields), `RiskFactorType` (5 values), `RiskSeverityLabel` (4 values), `RiskTrend` (3 values), `RiskScoreResult` (7 fields), `PortfolioRiskResult` (4 fields), `RiskScoreContributor` (6 fields), `EmergingRisk` (12 fields), `EmergingRiskPattern` (5 values), `BottleneckItem` (11 fields), `BottleneckType` (10 values), `BottleneckImpact` (3 fields), `BottleneckSummary` (6 fields), `OptimizationSuggestion` (9 fields), `OptimizationCategory` (5 values), `OptimizationObjective` (4 values), `ImpactAnalysis` (5 fields), `UtilizationSnapshot` (9 fields), `ProjectUtilizationSummary` (7 fields), `RiskAlert` (9 fields), `RiskAlertConfig` (3 fields), `RiskAlertThreshold` (4 fields) — sourced from type files in `packages/web/src/lib/`
14. **Page uses correct Just the Docs front matter**: `title: Risk Management`, `nav_order: 6`, `parent: Web Dashboard`, `description` field
15. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
16. **Cross-links** verified: parent link to Web Dashboard index, sibling links to other Web Dashboard child pages, Risk API (62.47), Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Risk Management page (AC: #1-16)
  - [x] Replace stub content in docs/web-dashboard/risk-management.md
  - [x] Write front matter (title, nav_order: 6, parent: Web Dashboard, description)
  - [x] Write "Overview" section — server component, 5 panels, data loading (AC #1)
  - [x] Write "Risk Score" section — composite formula, weights, portfolio mode, cards, emerging risks (AC #2)
  - [x] Write "Risk Factor Aggregation" section — 5 types, severity model, thresholds, dashboard UI (AC #3)
  - [x] Write "Emerging Risk Detection" section — 5 pattern detectors, thresholds, trajectory (AC #4)
  - [x] Write "Bottleneck Analysis" section — 10 types, 8 sources, impact formula, dashboard UI (AC #5)
  - [x] Write "Utilization Metrics" section — portfolio/project modes, time windows, rolling averages, history (AC #6)
  - [x] Write "Optimization Engine" section — 5 analyzers, ranking formula, categories, UI panel (AC #7)
  - [x] Write "Objective Scenarios" section — 4 objectives, weights, boost/suppress, comparison panel (AC #8)
  - [x] Write "Optimization Learning" section — feedback, acceptance rates, weights, impact analysis (AC #9)
  - [x] Write "Risk Alerts" section — SSE, banner, evaluation, broadcaster singleton (AC #10)
  - [x] Write "Alert Configuration" section — config types, endpoints, validation (AC #11)
  - [x] Write "API Routes" section — 7 endpoint groups with method/purpose/params/validation/response (AC #12)
  - [x] Write "Key Types" section — all risk-related types with field counts (AC #13)
  - [x] Write "Next Steps" cross-links section (AC #16)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All 18 subtasks checked off
- `docs/web-dashboard/risk-management.md` exists with comprehensive content
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages

## Source Files

### Page Routes (Server Components)
- `packages/web/src/app/risk/page.tsx` — risk page (server component)

### Components
- `packages/web/src/components/RiskScorePanel.tsx` — portfolio risk score cards + alert banner
- `packages/web/src/components/RiskDashboard.tsx` — risk factor dashboard with expandable cards
- `packages/web/src/components/BottleneckDashboard.tsx` — bottleneck analysis with expandable cards
- `packages/web/src/components/UtilizationMetricsPanel.tsx` — utilization metrics with time series
- `packages/web/src/components/OptimizationPanel.tsx` — optimization suggestions + objective comparison
- `packages/web/src/components/RiskAlertBanner.tsx` — alert banner with acknowledge

### API Routes
- `packages/web/src/app/api/risk/dashboard/route.ts` — GET risk factors + summary
- `packages/web/src/app/api/risk/score/route.ts` — GET composite risk score
- `packages/web/src/app/api/risk/bottleneck/route.ts` — GET bottleneck analysis
- `packages/web/src/app/api/risk/utilization/route.ts` — GET utilization metrics
- `packages/web/src/app/api/risk/optimization/route.ts` — GET/PATCH/DELETE optimization
- `packages/web/src/app/api/risk/alerts/route.ts` — GET/PATCH alerts
- `packages/web/src/app/api/risk/alerts/config/route.ts` — GET/PUT alert config

### Core Engine (Web Lib)
- `packages/web/src/lib/risk-aggregation.ts` — risk factor aggregation, severity model
- `packages/web/src/lib/risk-score.ts` — composite risk score calculation
- `packages/web/src/lib/emerging-risk-detection.ts` — 5 emerging risk pattern detectors
- `packages/web/src/lib/bottleneck-aggregation.ts` — bottleneck identification from 8 sources
- `packages/web/src/lib/optimization-engine.ts` — 5 analyzers + ranking
- `packages/web/src/lib/underutilized-analyzer.ts` — underutilized agent detection
- `packages/web/src/lib/optimization-scenario.ts` — objective-based re-ranking
- `packages/web/src/lib/optimization-feedback.ts` — feedback recording (in-memory)
- `packages/web/src/lib/optimization-learning.ts` — acceptance rate → category weights
- `packages/web/src/lib/optimization-impact.ts` — before/after impact analysis
- `packages/web/src/lib/risk-alert-types.ts` — alert config and state types
- `packages/web/src/lib/risk-alert-evaluation.ts` — alert threshold evaluation
- `packages/web/src/lib/risk-alert-broadcaster.ts` — pub/sub, cache, acknowledge
- `packages/web/src/lib/risk-alert-config.ts` — in-memory config singleton
- `packages/web/src/lib/risk-alert-sse-constants.ts` — SSE event type constant
- `packages/web/src/lib/utilization-snapshot.ts` — snapshot collection, time series, summaries
- `packages/web/src/lib/utilization-history.ts` — in-memory history store
- `packages/web/src/lib/utilization-metrics-types.ts` — utilization types and thresholds
- `packages/web/src/lib/optimization-types.ts` — optimization types and constants

### Core Engine (packages/core)
- `packages/core/src/agent-utilization.ts` — computeAgentUtilization(), computeProjectUtilization()
- `packages/core/src/capacity-check.ts` — checkCapacity(), getCapacityStatus(), NEAR_CAPACITY_THRESHOLD=80

### Hooks
- `packages/web/src/hooks/useRiskAlertSSE.ts` — SSE subscription for risk alerts

### Tests (API Routes)
- `packages/web/src/app/api/risk/dashboard/route.test.ts`
- `packages/web/src/app/api/risk/score/route.test.ts`
- `packages/web/src/app/api/risk/bottleneck/route.test.ts`
- `packages/web/src/app/api/risk/optimization/route.test.ts`

### Tests (Components)
- `packages/web/src/components/__tests__/RiskAlertBanner.test.tsx`
- `packages/web/src/components/__tests__/RiskDashboard.test.tsx`
- `packages/web/src/components/__tests__/RiskFactorCard.test.tsx`
- `packages/web/src/components/__tests__/RiskScorePanel.test.tsx`
- `packages/web/src/components/__tests__/BottleneckDashboard.test.tsx`
- `packages/web/src/components/__tests__/OptimizationPanel.test.tsx`
- `packages/web/src/components/__tests__/UtilizationMetricsPanel.test.tsx`

### Tests (Lib)
- `packages/web/src/lib/__tests__/risk-aggregation.test.ts`
- `packages/web/src/lib/__tests__/risk-score.test.ts`
- `packages/web/src/lib/__tests__/risk-alert-evaluation.test.ts`
- `packages/web/src/lib/__tests__/emerging-risk-detection.test.ts`
- `packages/web/src/lib/__tests__/bottleneck-aggregation.test.ts`
- `packages/web/src/lib/__tests__/optimization-engine.test.ts`
- `packages/web/src/lib/__tests__/optimization-scenario.test.ts`
- `packages/web/src/lib/__tests__/optimization-feedback.test.ts`
- `packages/web/src/lib/__tests__/optimization-learning.test.ts`
- `packages/web/src/lib/__tests__/optimization-impact.test.ts`
- `packages/web/src/lib/__tests__/utilization-snapshot.test.ts`
- `packages/web/src/lib/__tests__/utilization-history.test.ts`

## Change Log

- 2026-04-25: Story created from sprint backlog
- 2026-04-25: Wrote comprehensive risk-management.md documentation covering all 16 ACs
- 2026-04-25: Adversarial code review — all constants verified against source (severity weights, thresholds, formulas, API routes, objective categories). 3 issues fixed: AC #13 field counts for EmergingRisk (13→12), BottleneckItem (10→11), OptimizationSuggestion (8→9); added missing BottleneckSeverityLabel, BottleneckTrend, EstimatedImpact to doc Supporting Types table

## Dev Notes

### Architecture Patterns (from Stories 62-36 and 62-37 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Web Dashboard index, sibling links, related advanced topics and API docs
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files; annotate forward references with *(upcoming)*
- Adversarial code review should verify exact constants, thresholds, and type shapes against source code

### Source Tree Components

- 6 UI components under `packages/web/src/components/` (RiskScorePanel, RiskDashboard, BottleneckDashboard, UtilizationMetricsPanel, OptimizationPanel, RiskAlertBanner)
- 1 page route under `packages/web/src/app/risk/`
- 7 API route files under `packages/web/src/app/api/risk/`
- 19 web lib modules under `packages/web/src/lib/` (risk-*, bottleneck-*, optimization-*, utilization-*)
- 2 core engine modules under `packages/core/src/` (agent-utilization.ts, capacity-check.ts)
- 1 hook under `packages/web/src/hooks/useRiskAlertSSE.ts`

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all type field counts match actual TypeScript interfaces
- Verify API endpoint parameters and response shapes match route implementations
- Confirm severity thresholds match `risk-aggregation.ts` (>=76 critical, >=51 high, >=26 medium)
- Validate risk score formula weights match `risk-score.ts` (critical=1.5, high=1.0, medium=0.6, low=0.3)
- Verify optimization ranking formula matches `optimization-engine.ts`
- Confirm emerging risk detection thresholds match `emerging-risk-detection.ts`
- Check bottleneck impact score formula matches `bottleneck-aggregation.ts`

### Project Structure Notes

- Doc file location: `docs/web-dashboard/risk-management.md`
- Nav order: 6 (after Conflict Resolution at nav_order: 5)
- Sibling pages: index.md (0), portfolio-view.md (1), sprint-board.md (2), session-detail.md (3), scenario-comparison.md (4), conflict-resolution.md (5)

### Key Constants to Verify

- Risk severity labels: >=76 critical, >=51 high, >=26 medium, else low
- SEVERITY_WEIGHTS: critical=1.5, high=1.0, medium=0.6, low=0.3
- NORMALIZATION_CONSTANT: 150
- SPRINT_HEALTH_THRESHOLD: 60
- Agent overutilization: >90%, underutilization: <30%
- Stuck story thresholds: 48h warning, 96h critical
- Impact score weights: SEVERITY_WEIGHT=10, DELAY_WEIGHT=5
- Optimization ranking: daysSaved×2 + riskReduction×1.5 + |utilDelta|×1 + confidence×0.1
- Learning bounds: boost max 1.5, penalty max 0.5, min samples 3
- Alert defaults: score>=76 critical, score>=51 high, emerging-risk>=60
- Near capacity threshold: 80
- VELOCITY_UTILIZATION_RATIO: 0.8

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.38]
- [Source: packages/web/src/app/risk/page.tsx]
- [Source: packages/web/src/components/RiskScorePanel.tsx]
- [Source: packages/web/src/components/RiskDashboard.tsx]
- [Source: packages/web/src/components/BottleneckDashboard.tsx]
- [Source: packages/web/src/components/UtilizationMetricsPanel.tsx]
- [Source: packages/web/src/components/OptimizationPanel.tsx]
- [Source: packages/web/src/components/RiskAlertBanner.tsx]
- [Source: packages/web/src/lib/risk-aggregation.ts]
- [Source: packages/web/src/lib/risk-score.ts]
- [Source: packages/web/src/lib/emerging-risk-detection.ts]
- [Source: packages/web/src/lib/bottleneck-aggregation.ts]
- [Source: packages/web/src/lib/optimization-engine.ts]
- [Source: packages/web/src/lib/optimization-types.ts]
- [Source: packages/web/src/lib/risk-alert-types.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes

- Wrote `docs/web-dashboard/risk-management.md` replacing 9-line stub with comprehensive documentation (~350 lines)
- All 16 acceptance criteria covered across 14 documentation sections
- Documented 1 page route, 7 API endpoint groups, 6 components, 19 web lib modules, 2 core modules, 1 hook
- Front matter includes `description` field (was missing from stub)
- Cross-links: 8 of 9 resolve to existing files; `docs/api/conflicts-risk.md` is a forward reference to story 62-47 (backlog), annotated *(upcoming)*
- No hero font classes used
- Source analysis from 4 parallel subagents provided exhaustive API/component/type/engine coverage
- All constants verified against source code: severity thresholds (76/51/26), weights (1.5/1.0/0.6/0.3), normalization (150), stuck story durations (48h/96h), impact formula, optimization ranking formula, learning bounds, alert defaults

### File List

- `docs/web-dashboard/risk-management.md` — replaced stub with comprehensive documentation
