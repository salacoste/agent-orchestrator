# Story 62.13: Model Routing

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Model Routing page documenting the model routing service, tier classification, auto-escalation, usage tracking, provider health, and all configuration options,
so that I can understand how agents are matched to optimal models and how to configure model routing for my projects.

## Acceptance Criteria

1. Page documents the model routing service: 3 tiers (`low`, `medium`, `high`), default mapping (`haiku`, `sonnet`, `opus`) — sourced from `packages/core/src/types.ts` lines 1005, 1011-1015
2. Keyword classification rules documented: 11 LOW keywords, 9 HIGH keywords, matching logic — sourced from `packages/core/src/model-routing.ts` lines 20-44
3. Auto-escalation documented: triggers after `>= 2` consecutive failures on same tier, escalation order `low → medium → high` — sourced from `packages/core/src/model-routing.ts` lines 98-102, 131
4. Resolution cascade shown as ASCII diagram: explicit → heuristic → escalation → config default → `"medium"` — sourced from `packages/core/src/model-routing.ts` lines 119-149
5. ModelUsageAggregator documented: 6 methods, JSONL storage (`model-usage.jsonl`), 3 secondary indexes — sourced from `packages/core/src/model-usage.ts` lines 24-39, 106-109
6. ModelUsageEvent interface documented with 9-field table — sourced from `packages/core/src/types.ts` lines 1018-1028
7. UsageAggregate interface documented with 4-field table — sourced from `packages/core/src/types.ts` lines 1031-1036
8. SessionEnhancementProvider interface documented: 5 methods — sourced from `packages/core/src/types.ts` lines 1515-1552
9. Provider health monitoring documented: circuit breaker (3 states: closed/open/half-open), health check flow, defaults (failureThreshold=3, openDurationMs=60000, healthCheckIntervalMs=30000) — sourced from `packages/core/src/provider-health.ts` lines 78-101, `packages/core/src/circuit-breaker.ts` lines 17-23
10. Complete SessionEnhancementConfig documented: 6 fields with defaults — sourced from `packages/core/src/config.ts` lines 104-117, `packages/core/src/types.ts` lines 1038-1052
11. YAML configuration examples: basic model tiers, with provider health, with agent mappings — sourced from `packages/core/src/config.ts` lines 104-117
12. CLI command documented: `ao providers [--json]` — sourced from `packages/cli/src/commands/providers.ts`
13. Dashboard cost API documented: `GET /api/costs/breakdown` with 5 dimensions — sourced from `packages/web/src/app/api/costs/breakdown/route.ts`
14. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 7)
15. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
16. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
17. Links to related pages: Verification Gate (62-12), Configuration (62-5), Memory & Learning (62-11)
18. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #14, #17, #18)
  - [x] Front matter: title: Model Routing, nav_order: 7, parent: Core Concepts, description
  - [x] One-paragraph intro explaining model routing as tier-based model selection
  - [x] TL;DR callout: 3 tiers, keyword classification, auto-escalation, provider health, opt-in per-project
  - [x] No hero-style font classes

- [x] Task 2: Write "How Model Routing Works" section (AC: #1, #4, #16)
  - [x] ASCII diagram showing resolution cascade under 60 chars wide
  - [x] Step-by-step walkthrough of the resolveTier priority cascade (lines 119-149)
  - [x] Explain: 3 tiers, default mapping, tier-to-model resolution
  - [x] Source: model-routing.ts, session-manager.ts

- [x] Task 3: Write "Tier Classification" section (AC: #2)
  - [x] Inline code list of 11 LOW keywords — model-routing.ts:20-31
  - [x] Inline code list of 9 HIGH keywords — model-routing.ts:34-43
  - [x] Explain: keywords matched from story key segments, LOW checked first, unmatched falls through
  - [x] Source: model-routing.ts:86-96

- [x] Task 4: Write "Auto-Escalation" section (AC: #3)
  - [x] Explain: triggers when sessionId has count >= 2 failures on same tier
  - [x] Escalation order: low → medium → high (already at high = no escalation)
  - [x] recordFailure behavior: same tier = increment, different tier = reset to 1
  - [x] In-memory only (cleared on process restart)
  - [x] Source: model-routing.ts:98-108, 131, 157-166

- [x] Task 5: Write "Usage Tracking" section (AC: #5, #6, #7)
  - [x] ModelUsageEvent field table (9 fields) — types.ts:1018-1028
  - [x] UsageAggregate field table (4 fields) — types.ts:1031-1036
  - [x] ModelUsageAggregator 6 methods — model-usage.ts:27-39
  - [x] Storage: append-only JSONL at {sessionsDir}/audit/model-usage.jsonl
  - [x] 3 secondary indexes: session, story, project
  - [x] Source: model-usage.ts, types.ts

- [x] Task 6: Write "Provider Interface" section (AC: #8)
  - [x] SessionEnhancementProvider methods table (name + 5 methods) — types.ts:1515-1552
  - [x] StoryContext 7 fields — types.ts:1309-1324
  - [x] Explain: provider lifecycle (install → configure → enhance → teardown)
  - [x] Source: types.ts

- [x] Task 7: Write "Provider Health" section (AC: #9)
  - [x] Circuit breaker 3 states: closed → open → half-open → closed
  - [x] Health check flow: call provider.healthCheck() → recordSuccess/recordFailure
  - [x] Defaults: failureThreshold=3, openDurationMs=60000, healthCheckIntervalMs=30000
  - [x] ProviderHealthStatus 4 fields — provider-health.ts:38-47
  - [x] Source: provider-health.ts, circuit-breaker.ts

- [x] Task 8: Write "Cost Dashboard" section (AC: #13)
  - [x] GET /api/costs/breakdown with 5 dimensions: session, story, project, sprint, summary
  - [x] CostBreakdownPanel: tier display labels (Haiku/Sonnet/Opus), polling every 30s
  - [x] Source: costs/breakdown/route.ts, CostBreakdownPanel.tsx, useCostData.ts

- [x] Task 9: Write "CLI" section (AC: #12)
  - [x] `ao providers [--json]` — lists registered and active providers
  - [x] Output: table with Name, Version, Description, plus Active Configuration
  - [x] Source: commands/providers.ts

- [x] Task 10: Write "Configuration" section (AC: #10, #11)
  - [x] SessionEnhancementConfig field table: 6 fields with defaults — config.ts:104-117
  - [x] YAML example: basic model tiers
  - [x] YAML example: with provider health
  - [x] YAML example: per-project override with agent mappings and model tiers
  - [x] Tier resolution cascade: project → global → built-in defaults
  - [x] Source: config.ts, types.ts, session-manager.ts:182-191

- [x] Task 11: Write navigation and next steps (AC: #14, #15, #17)
  - [x] Link to Verification Gate (../verification-gate/) — Story 62-12
  - [x] Link to Configuration (../../getting-started/configuration/) — Story 62-5
  - [x] Link to Memory & Learning (../memory-learning/) — Story 62-11
  - [x] Front matter verified: title, nav_order, parent, description

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Not applicable** — This story modifies a single Jekyll markdown page. No TypeScript interfaces.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Design Decisions

- **3 tiers, not arbitrary**: The system defines exactly 3 model tiers: `low`, `medium`, `high`. This is not configurable — the tiers are fixed. What IS configurable is the model name each tier maps to (default: haiku/sonnet/opus).
- **Keyword heuristic is story-key-based**: Classification matches keywords from the story key segments (split by `-` and `_`), not from story content or description. This is a simple but effective heuristic.
- **Auto-escalation is in-memory**: Failure records are stored in a `Map<string, FailureRecord>` that clears on process restart. This is intentional — persistent failure tracking would be over-engineering.
- **Resolution cascade has 6 levels**: The full cascade is: (1) explicit override → (2) keyword heuristic computed → (3) auto-escalation if failures >= 2 → (4) if heuristic matched, use it → (5) config default → (6) fallback "medium". This needs to be documented as a priority stack, not a simple if/else.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.
- **Front matter title vs H1**: Must match. Both should be "Model Routing".
- **Provider health is separate from routing**: Provider health monitoring (circuit breaker) is independent of model routing. Both are documented because they're part of the same session enhancement system, but they serve different purposes.
- **resolveModelTiers cascade**: `project.sessionEnhancement?.modelTiers ?? config.sessionEnhancement?.modelTiers ?? DEFAULT_MODEL_TIERS` — project overrides global, global overrides defaults.

### Previous Story Learnings (62-7 through 62-12)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide — verified with `wc -m` after every edit
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest
- Count enum values, step counts, field counts precisely against source code — these are the #1 source of High/Medium severity review findings
- **Title consistency**: Front matter `title` must match H1 heading. Caught in 62-9 review.
- **Type accuracy**: Use precise TypeScript union types in tables, not loose `string` approximations. Caught in 62-10 review, 62-12 review.
- **Capture flow accuracy**: Verify the actual outcomes assigned by functions, not just what the type allows. Caught in 62-11 review.
- **Filter accuracy**: When documenting filters, verify the actual pipeline behavior, not just one layer. Caught in 62-11 review.
- **YAML config accuracy**: Verify config key names against Zod schemas, not assumptions. `agents:` vs `agentMappings:` error caught in 62-12 review.
- **Config field defaults**: Verify "default" claims against schema `.default()` calls. If no `.default()`, the field is required, not defaulted. Caught in 62-12 review (`enabled` has no default).
- **YAML examples need `path`**: All project config YAML examples must include the required `path` field. Caught in 62-12 review.

### Source Files for Model Routing Content

- **packages/core/src/model-routing.ts** (~180 lines) — Core service: LOW_TIER_KEYWORDS (line 20), HIGH_TIER_KEYWORDS (line 32), FailureRecord (line 47), ResolveTierOptions (line 53), ModelRoutingService (line 68), classifyStoryComplexity (line 86), escalationTier (line 98), resolveTier (line 119), recordFailure (line 157), resetFailures (line 171), createModelRoutingService (line 174), modelRoutingService singleton (line 180)
- **packages/core/src/model-usage.ts** (~230 lines) — Usage tracking: MODEL_USAGE_FILENAME (line 24), VALID_TIERS (line 25), ModelUsageAggregator interface (line 27), validateModelTier (line 60), JSONL storage (line 106), getSummary (line 216), createModelUsageAggregator (line 240), bootstrapModelUsageAggregator (line 253), modelUsageAggregator singleton (line 265)
- **packages/core/src/types.ts** — ModelTier (line 1005), ModelTierMapping (line 1008), DEFAULT_MODEL_TIERS (line 1011-1015), ModelUsageEvent (line 1018-1028), UsageAggregate (line 1031-1036), SessionEnhancementConfig (line 1038-1052), ProviderHealthConfig (line 1054-1062), SessionSpawnConfig.modelTier (line 208), StoryContext (line 1309-1324), ProviderConfig (line 1303), ProviderHealth (line 1480-1487), InstallationResult (line 1490-1495), SessionEnhancementProvider (line 1515-1552)
- **packages/core/src/config.ts** — ProviderHealthConfigSchema (lines 87-91), HookProfileSchema (lines 93-97), AgentMappingSchema (lines 99-102), SessionEnhancementConfigSchema (lines 104-117), ProjectConfigSchema.sessionEnhancement (line 178), OrchestratorConfigSchema.sessionEnhancement (line 277)
- **packages/core/src/provider-health.ts** (~215 lines) — ProviderHealthMonitorConfig (line 28), ProviderHealthStatus (line 38), ProviderHealthMonitor (line 50), health check flow (lines 78-101), bootstrapProviderHealth (line 156), createProviderHealthRule (line 184)
- **packages/core/src/circuit-breaker.ts** — CircuitBreakerState (line 23): "closed" | "open" | "half-open", DEFAULT_FAILURE_THRESHOLD=5 (line 17), DEFAULT_OPEN_DURATION_MS=30000 (line 20)
- **packages/core/src/session-manager.ts** — resolveModelTiers cascade (lines 182-191)
- **packages/core/src/service-registry.ts** — registerProviderHealthMonitor (line 117), getProviderHealthMonitor (line 121), registerModelUsageAggregator (line 128), getModelUsageAggregator (line 132), clearServiceRegistry (line 143)
- **packages/core/src/index.ts** — Model routing exports (lines 62-67), session manager exports (lines 58-59), model usage exports (lines 111-122), provider health exports (lines 125-133)
- **packages/cli/src/commands/providers.ts** (~90 lines) — collectProvidersData (line 14), registerProviders (line 78), ao providers command (line 80)
- **packages/web/src/app/api/costs/breakdown/route.ts** — GET /api/costs/breakdown, 5 dimensions (line 19), registry-first pattern (lines 23-25)
- **packages/web/src/components/CostBreakdownPanel.tsx** — Tier labels: low→Haiku, medium→Sonnet, high→Opus (lines 21-25), tier colors (lines 15-19)
- **packages/web/src/hooks/useCostData.ts** — POLL_INTERVAL_MS=30000 (line 6), useCostData hook

### Key Model Routing Facts (verified against source)

**3 model tiers:** `low`, `medium`, `high` — types.ts:1005

**Default tier mapping:** `{ low: "haiku", medium: "sonnet", high: "opus" }` — types.ts:1011-1015

**11 LOW_TIER_KEYWORDS:** "explore", "search", "format", "lint", "find", "list", "scan", "audit", "check", "validate", "verify" — model-routing.ts:20-31

**9 HIGH_TIER_KEYWORDS:** "architect", "design", "debug", "debugger", "fix", "investigate", "troubleshoot", "refactor", "migrate" — model-routing.ts:34-43

**resolveTier priority cascade (6 levels):**
1. Explicit override (explicitTier) — absolute precedence
2. Keyword heuristics computed (stored for comparison)
3. Auto-escalation: if sessionId has count >= 2 failures, escalate one tier up
4. If heuristic matched a keyword, use it
5. Config default (defaultTier from provider config)
6. Fallback: "medium"

**Escalation order:** low → medium → high. Returns null if already at high. — model-routing.ts:98-102

**Auto-escalation trigger:** count >= 2 failures on same tier — model-routing.ts:131

**recordFailure behavior:** same tier = increment, different tier or new session = reset to 1 — model-routing.ts:157-166

**ModelUsageEvent fields (9):** sessionId, storyId, projectId, modelTier, model, inputTokens, outputTokens, estimatedCostUsd, timestamp — types.ts:1018-1028

**UsageAggregate fields (4):** totalInputTokens, totalOutputTokens, totalCostUsd, sessionCount — types.ts:1031-1036

**ModelUsageAggregator methods (6):** recordUsage, getBySession, getByStory, getByProject, getBySprint, getSummary — model-usage.ts:27-39

**SessionEnhancementProvider:** name (readonly) + 5 methods (install, configure, enhance, teardown, healthCheck) — types.ts:1515-1552

**StoryContext fields (7):** storyId, storyTitle, acceptanceCriteria, relevantFiles, dependencies, storyType, agents — types.ts:1309-1324

**SessionEnhancementConfig fields (6):** provider (default "raw"), config?, modelTiers?, health?, hookProfile?, agentMappings? — config.ts:104-117

**ProviderHealthConfig fields (3):** healthCheckIntervalMs (default 30000), failureThreshold (default 3), openDurationMs (default 60000) — config.ts:87-91

**Circuit breaker states (3):** "closed", "open", "half-open" — circuit-breaker.ts:23

**Provider health defaults:** failureThreshold=3, openDurationMs=60000, healthCheckIntervalMs=30000 — provider-health.ts:160-164

**Cost API dimensions (5):** "session", "story", "project", "sprint", "summary" — costs/breakdown/route.ts:19

**Cost panel tier labels:** low → "Haiku", medium → "Sonnet", high → "Opus" — CostBreakdownPanel.tsx:21-25

**Cost poll interval:** 30000ms — useCostData.ts:6

**resolveModelTiers cascade:** project.sessionEnhancement?.modelTiers ?? config.sessionEnhancement?.modelTiers ?? DEFAULT_MODEL_TIERS — session-manager.ts:182-191

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for type fields, tier mappings, config options
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for config examples
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../verification-gate/` → `docs/core-concepts/verification-gate.md` (exists, updated in Story 62-12)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)
- `../memory-learning/` → `docs/core-concepts/memory-learning.md` (exists, updated in Story 62-11)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/model-routing.md`.

### References

- [Source: packages/core/src/model-routing.ts — resolveTier, classifyStoryComplexity, auto-escalation]
- [Source: packages/core/src/model-usage.ts — ModelUsageAggregator, JSONL storage, secondary indexes]
- [Source: packages/core/src/types.ts — ModelTier, ModelTierMapping, DEFAULT_MODEL_TIERS, ModelUsageEvent, UsageAggregate, SessionEnhancementProvider, SessionEnhancementConfig, ProviderHealthConfig]
- [Source: packages/core/src/config.ts — SessionEnhancementConfigSchema, ProviderHealthConfigSchema]
- [Source: packages/core/src/provider-health.ts — ProviderHealthMonitor, health check flow, bootstrapProviderHealth]
- [Source: packages/core/src/circuit-breaker.ts — CircuitBreakerState, defaults]
- [Source: packages/core/src/session-manager.ts — resolveModelTiers cascade]
- [Source: packages/cli/src/commands/providers.ts — ao providers command]
- [Source: packages/web/src/app/api/costs/breakdown/route.ts — cost breakdown API]
- [Source: packages/web/src/components/CostBreakdownPanel.tsx — cost dashboard panel]
- [Source: Story 62-12 — Previous story learnings (YAML config accuracy, config field defaults, type accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during analysis.

### Completion Notes List

- All 18 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars display width (max: 53 chars)
- 3 model tiers documented: low (haiku), medium (sonnet), high (opus) — types.ts:1005, 1011-1015
- 11 LOW keywords documented: explore, search, format, lint, find, list, scan, audit, check, validate, verify — model-routing.ts:20-31
- 9 HIGH keywords documented: architect, design, debug, debugger, fix, investigate, troubleshoot, refactor, migrate — model-routing.ts:34-43
- Resolution cascade diagram: 6-level priority stack (explicit → heuristic compute → escalation → heuristic → config default → fallback)
- Auto-escalation documented: triggers at >= 2 failures, same tier increment, different tier reset — model-routing.ts:131, 157-166
- ModelUsageEvent 9 fields documented from types.ts:1018-1028 (including timestamp)
- UsageAggregate 4 fields documented from types.ts:1031-1036
- ModelUsageAggregator 6 methods documented from model-usage.ts:27-39
- SessionEnhancementProvider interface: name (readonly) + 5 methods — types.ts:1515-1552
- StoryContext 7 fields documented — types.ts:1309-1324
- Circuit breaker 3 states documented: closed → open → half-open — circuit-breaker.ts:23
- Provider health defaults: healthCheckIntervalMs=30000, failureThreshold=3, openDurationMs=60000 — config.ts:87-91
- ProviderHealthStatus 4 fields documented — provider-health.ts:38-47 (added during code review)
- Cost API 5 dimensions documented — costs/breakdown/route.ts
- CLI `ao providers [--json]` documented
- 3 YAML configuration examples: basic tiers, with provider health, per-project override
- SessionEnhancementConfig 6-field table with defaults
- Tier resolution cascade: project → global → built-in defaults
- No hero-style font classes used on interior page
- Front matter title matches H1 heading (both "Model Routing")
- 3 navigation links verified against existing sibling pages
- `pnpm test` passes (only pre-existing provider-omc test failure unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-22 | Created story artifact from epic and source analysis | Claude Sonnet 4 |
| 2026-04-22 | Rewrote model-routing.md from placeholder to full production page | Claude Sonnet 4 |
| 2026-04-22 | Code review: fixed 1M+4L issues (added ProviderHealthStatus table, getSummary return shape, getBySprint async, health field link, circuit breaker defaults note) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4
**Outcome:** Approved with fixes

**Source Verifications (25 checks):**
1. ✓ 3 model tiers: low, medium, high — types.ts:1005
2. ✓ Default tier mapping: { low: "haiku", medium: "sonnet", high: "opus" } — types.ts:1011-1015
3. ✓ 11 LOW keywords — model-routing.ts:20-32
4. ✓ 9 HIGH keywords — model-routing.ts:34-44
5. ✓ LOW checked before HIGH — model-routing.ts:88-95
6. ✓ Story key split on [-_] — model-routing.ts:87
7. ✓ resolveTier 6-level cascade — model-routing.ts:119-149
8. ✓ Auto-escalation at count >= 2 — model-routing.ts:131
9. ✓ Escalation order: low→medium→high, null if already high — model-routing.ts:98-102
10. ✓ recordFailure: same tier increment, different tier reset to 1 — model-routing.ts:157-166
11. ✓ resetFailures clears Map entry — model-routing.ts:173-175
12. ✓ ModelUsageEvent 9 fields — types.ts:1018-1028
13. ✓ UsageAggregate 4 fields — types.ts:1031-1036
14. ✓ ModelUsageAggregator 6 methods — model-usage.ts:27-39
15. ✓ JSONL storage at {sessionsDir}/audit/model-usage.jsonl — model-usage.ts:24, 102
16. ✓ 3 secondary indexes (session, story, project) — model-usage.ts:106-109
17. ✓ SessionEnhancementProvider: name + 5 methods — types.ts:1515-1552
18. ✓ StoryContext 7 fields — types.ts:1309-1324
19. ✓ storyType union: 5 values — types.ts:1427
20. ✓ Circuit breaker 3 states — circuit-breaker.ts:23
21. ✓ ProviderHealthConfig defaults: 30000, 3, 60000 — config.ts:87-91
22. ✓ Cost API 5 dimensions with correct params — route.ts:18-19
23. ✓ CostBreakdownPanel tier labels: Haiku/Sonnet/Opus — CostBreakdownPanel.tsx:21-25
24. ✓ Poll interval: 30000ms — useCostData.ts:6
25. ✓ resolveModelTiers cascade: project > global > DEFAULT_MODEL_TIERS — session-manager.ts:186-190

**Findings (5):**
- [M1] Task 7 subtask "ProviderHealthStatus 4 fields" marked [x] but not in page — FIXED (added ProviderHealthStatus table)
- [L1] getSummary() return shape differs from UsageAggregate — FIXED (added return type note to method table)
- [L2] Circuit breaker diagram uses config defaults without clarification — FIXED (added note about config override of raw circuit breaker defaults)
- [L3] SessionEnhancementConfig table says "(see defaults)" without linking — FIXED (added anchor link to Provider Health Defaults)
- [L4] getBySprint is async but not indicated — FIXED (added "(async)" to method table)

### File List

- `docs/core-concepts/model-routing.md` — rewritten from placeholder to full production page (~355 lines)
