# Story 45.4: ROI Calculator — Agent Value Proof

Status: review

## Story

As a team lead justifying AI agent usage,
I want to see the return on investment for agent sessions,
so that I can prove value to stakeholders.

## Acceptance Criteria

1. `GET /api/sprint/roi` returns ROI calculation with total token cost ($), human-hours saved, cost per story, efficiency ratio
2. Human-hours estimate uses configurable rate (default: 4 hours per story)
3. Calculation is transparent: "X stories × $Y tokens vs X stories × Z human-hours × $W/hour"
4. ROI calculator is a pure function (testable without side effects)
5. Token-to-USD conversion uses configurable price per 1M tokens
6. Tests verify ROI calculation, empty state, and API response

## Tasks / Subtasks

- [x] Task 1: Create ROI calculator (pure function) (AC: #1, #3, #4, #5)
  - [x] 1.1: Create `packages/core/src/roi-calculator.ts`
  - [x] 1.2: Accept storiesCompleted, totalTokens, Partial<ROIConfig>
  - [x] 1.3: Compute totalCostUsd, humanHoursSaved, costPerStory, efficiencyRatio with rounding
  - [x] 1.4: Transparent breakdown: "N stories. Agent cost: $X (NK tokens × $Y/1M). Human equiv: $Z."
- [x] Task 2: Create ROI API route (AC: #1, #2)
  - [x] 2.1: Create `packages/web/src/app/api/sprint/roi/route.ts`
  - [x] 2.2: Aggregate tokens from session.agentInfo.cost.{inputTokens, outputTokens}
  - [x] 2.3: Query param overrides: hoursPerStory, hourlyRate, pricePerMillionTokens
  - [x] 2.4: Return JSON ROI report
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: 9 calculator tests: default rates, custom rates, rounding, breakdown, defaults
  - [x] 3.2: Zero stories and zero tokens return empty ROI
  - [x] 3.3: Custom rates (hoursPerStory, hourlyRate, pricePerMillionTokens) affect output
  - [x] 3.4: Breakdown string contains all transparent values
  - [x] 3.5: 4 route tests: structure, query overrides, empty sessions, service failure

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

### Architecture — Pure Calculator + API Route

Same pattern as digest (44.7) and post-mortem (45.3).

```
roi-calculator.ts (pure — no I/O)
  ├── Input: { storiesCompleted, totalTokens, config rates }
  └── Output: ROIReport { totalCostUsd, humanHoursSaved, costPerStory, efficiencyRatio, breakdown }

API route (wiring)
  └── Session manager → aggregate tokens → call calculator → return JSON
```

### ROIReport Interface

```typescript
interface ROIConfig {
  hoursPerStory: number;         // Default: 4
  hourlyRate: number;            // Default: 75 ($/hour)
  pricePerMillionTokens: number; // Default: 15 (Claude Sonnet pricing)
}

interface ROIReport {
  storiesCompleted: number;
  totalTokens: number;
  totalCostUsd: number;          // tokens × pricePerMillionTokens / 1_000_000
  humanHoursSaved: number;       // storiesCompleted × hoursPerStory
  humanCostEquivalent: number;   // humanHoursSaved × hourlyRate
  costPerStory: number;          // totalCostUsd / storiesCompleted
  efficiencyRatio: number;       // humanCostEquivalent / totalCostUsd (higher = better ROI)
  breakdown: string;             // Human-readable transparent calculation
}
```

### Token-to-USD Conversion

```
totalCostUsd = totalTokens × pricePerMillionTokens / 1_000_000
```

Default price: $15/1M tokens (Claude Sonnet approximate). Configurable via API query params or future config field.

### Data Source — Session Manager

From existing `/api/sprint/cost` pattern:
```typescript
const sessions = sessionManager.list();
let totalTokens = 0;
let storiesCompleted = 0;
for (const s of sessions) {
  const cost = s.agentInfo?.cost;
  if (cost) totalTokens += cost.inputTokens + cost.outputTokens;
  if (s.status === "completed") storiesCompleted++;
}
```

### Transparent Breakdown String

Format for stakeholders:
```
"12 stories completed. Agent cost: $4.50 (300K tokens × $15/1M).
Human equivalent: $3,600 (12 stories × 4h × $75/h).
ROI: 800x efficiency — agents cost 0.13% of human equivalent."
```

### Anti-Patterns to Avoid

- Do NOT hardcode pricing — use configurable defaults with override params
- Do NOT add config schema changes — use query params for rate overrides (keeps it simple)
- Do NOT add UI components — backend only (future story for dashboard panel)
- Do NOT divide by zero — guard when storiesCompleted === 0 or totalTokens === 0

### Previous Story Intelligence (45.3)

- Pure generator + API route pattern is well-established
- `getServices()` provides `sessionManager` for session data
- Route tests mock `getServices()` and external modules

### Files to Create

1. `packages/core/src/roi-calculator.ts` (new)
2. `packages/core/src/__tests__/roi-calculator.test.ts` (new)
3. `packages/web/src/app/api/sprint/roi/route.ts` (new)
4. `packages/web/src/app/api/sprint/roi/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export calculateROI)

### References

- [Source: packages/web/src/lib/workflow/cost-tracker.ts] — TokenUsage, SprintCostSummary
- [Source: packages/web/src/app/api/sprint/cost/route.ts] — session cost aggregation pattern
- [Source: packages/core/src/types.ts:398-413] — CostEstimate, AgentSessionInfo
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.4] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure calculateROI(storiesCompleted, totalTokens, config) with configurable rates
- Default: $15/1M tokens, 4h/story, $75/h — all overridable via Partial<ROIConfig>
- Transparent breakdown string for stakeholder reporting with token count, rates, percentages
- USD and ratio values rounded to 2 and 1 decimal places respectively
- API route aggregates inputTokens + outputTokens from all sessions via sessionManager.list()
- Query param overrides for all 3 rates (parseFloat with fallback to undefined)
- Exported from @composio/ao-core: calculateROI, DEFAULT_ROI_CONFIG, ROIReport, ROIConfig
- 13 new tests (9 calculator + 4 route), zero regressions

### File List

- packages/core/src/roi-calculator.ts (new)
- packages/core/src/__tests__/roi-calculator.test.ts (new)
- packages/core/src/index.ts (modified — export calculateROI)
- packages/web/src/app/api/sprint/roi/route.ts (new)
- packages/web/src/app/api/sprint/roi/route.test.ts (new)
