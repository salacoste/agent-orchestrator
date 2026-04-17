# Story 58.5: Model Usage Tracking

Status: review

## Story

As a project manager,
I want model tier and token usage tracked per session with aggregation by story, project, and sprint,
so that I can monitor costs and verify the 50-70% savings from model routing.

## Acceptance Criteria

1. **AC1 — ModelUsageEvent type**: A new type `ModelUsageEvent` is defined in `types.ts` with fields: `sessionId`, `storyId`, `projectId`, `modelTier` (ModelTier), `model` (string), `inputTokens` (number), `outputTokens` (number), `estimatedCostUsd` (number), `timestamp` (string ISO). This event is logged to the existing JSONL audit trail via `logAuditEvent()`.
2. **AC2 — Usage capture on session completion**: The completion handler in `completion-handlers.ts` captures usage data from `session.agentInfo?.cost` (CostEstimate) and `session.metadata["ao:modelTier"]` / `session.metadata["ao:model"]`, then logs a `model_usage` audit event alongside the existing `agent_completed` event.
3. **AC3 — Usage capture on session failure**: The failure handler similarly captures usage data and logs a `model_usage` audit event alongside the existing `agent_failed` event. If cost data is unavailable (agent crashed before reporting), the event is logged with `inputTokens: 0`, `outputTokens: 0`, `estimatedCostUsd: 0` (not skipped).
4. **AC4 — ModelUsageAggregator module**: A new module `packages/core/src/model-usage.ts` exports `ModelUsageAggregator` with methods:
   - `recordUsage(event: ModelUsageEvent)` — appends to in-memory store
   - `getBySession(sessionId)` — returns usage for one session
   - `getByStory(storyId)` — aggregates all sessions for a story
   - `getByProject(projectId)` — aggregates all sessions for a project
   - `getBySprint(projectPath)` — reads sprint-status.yaml, aggregates all stories in sprint
   - `getSummary()` — returns `{ totalTokens, totalCost, byTier: Record<ModelTier, { tokens, cost, sessions }> }`
   Results are returned as `UsageAggregate { totalInputTokens, totalOutputTokens, totalCostUsd, sessionCount }`.
5. **AC5 — JSONL persistence**: `ModelUsageAggregator.recordUsage()` also appends the event to a dedicated JSONL file at `{sessionsDir}/audit/model-usage.jsonl`. On startup, the aggregator loads events from this file to restore state. The file is append-only (no updates/deletes).
6. **AC6 — Integration with completion flow**: The session completion handler is modified to:
   - Read `session.metadata["ao:modelTier"]` and `session.metadata["ao:model"]` (set by 58-4 routing)
   - Read `session.agentInfo?.cost` (CostEstimate from agent plugin)
   - Create a `ModelUsageEvent` with all fields populated
   - Call `modelUsageAggregator.recordUsage(event)`
   - Also call `logAuditEvent()` with `event_type: "model_usage"` for the audit trail
7. **AC7 — Export and singleton**: The aggregator is exported from `packages/core/src/index.ts` as both a factory (`createModelUsageAggregator`) and a singleton (`modelUsageAggregator`). The singleton is used by completion handlers.
8. **AC8 — Unit tests**: Comprehensive vitest tests covering:
   - `ModelUsageEvent` type construction
   - `recordUsage()` stores and aggregates correctly
   - `getBySession()`, `getByStory()`, `getByProject()` return correct aggregates
   - `getBySprint()` reads sprint-status.yaml and aggregates across stories
   - `getSummary()` returns correct totals by tier
   - JSONL file write on recordUsage
   - JSONL file load on startup (restore from disk)
   - Missing cost data logs zero-values (not skipped)
   - Completion handler integration: event logged with correct fields

## Tasks / Subtasks

- [x] Task 1: Define ModelUsageEvent and UsageAggregate types (AC: #1, #4)
  - [x] 1.1 Add `ModelUsageEvent` interface to `packages/core/src/types.ts`
  - [x] 1.2 Add `UsageAggregate` interface to `packages/core/src/types.ts`
  - [x] 1.3 Export both from `packages/core/src/index.ts`

- [x] Task 2: Create ModelUsageAggregator module (AC: #4, #5)
  - [x] 2.1 Create `packages/core/src/model-usage.ts`
  - [x] 2.2 Implement in-memory store: `Map<string, ModelUsageEvent[]>`
  - [x] 2.3 Implement `recordUsage(event)` — append to store + write to JSONL
  - [x] 2.4 Implement `getBySession(sessionId)` — filter by sessionId, return aggregate
  - [x] 2.5 Implement `getByStory(storyId)` — filter by storyId, return aggregate
  - [x] 2.6 Implement `getByProject(projectId)` — filter by projectId, return aggregate
  - [x] 2.7 Implement `getBySprint(projectPath)` — read sprint-status, aggregate all stories
  - [x] 2.8 Implement `getSummary()` — total + breakdown by tier
  - [x] 2.9 Implement JSONL persistence: append to `model-usage.jsonl`
  - [x] 2.10 Implement startup load: read `model-usage.jsonl` into in-memory store
  - [x] 2.11 Export `createModelUsageAggregator()` factory and `modelUsageAggregator` singleton

- [x] Task 3: Integrate into completion handlers (AC: #2, #3, #6)
  - [x] 3.1 Import `modelUsageAggregator` in `completion-handlers.ts`
  - [x] 3.2 In `handleCompletion()`, extract `ao:modelTier`, `ao:model`, `agentInfo.cost` from session
  - [x] 3.3 Create `ModelUsageEvent` and call `recordUsage()`
  - [x] 3.4 Also log `logAuditEvent()` with `event_type: "model_usage"`
  - [x] 3.5 In `handleFailure()`, extract same fields (with zero-fallback for missing cost)
  - [x] 3.6 Create `ModelUsageEvent` and call `recordUsage()` + `logAuditEvent()`

- [x] Task 4: Export from index.ts (AC: #7)
  - [x] 4.1 Export `createModelUsageAggregator`, `modelUsageAggregator` from `index.ts`
  - [x] 4.2 Export `ModelUsageAggregator` type from `index.ts`

- [x] Task 5: Unit tests (AC: #8)
  - [x] 5.1 Create `packages/core/src/__tests__/model-usage.test.ts`
  - [x] 5.2 Test `recordUsage()` stores event correctly
  - [x] 5.3 Test `getBySession()` returns correct aggregate
  - [x] 5.4 Test `getByStory()` aggregates across sessions
  - [x] 5.5 Test `getByProject()` aggregates across sessions
  - [x] 5.6 Test `getBySprint()` reads sprint-status and aggregates
  - [x] 5.7 Test `getSummary()` returns correct totals and tier breakdown
  - [x] 5.8 Test JSONL file write on `recordUsage()`
  - [x] 5.9 Test JSONL file load on startup
  - [x] 5.10 Test missing cost data logs zero-values
  - [x] 5.11 Test factory isolation (independent state per instance)

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

Real-time cost streaming (updating dashboard as tokens are consumed mid-session) is a future enhancement (requires agent plugin support for streaming token counts).
Historical cost-complexity feedback loop (learning from past sessions to improve routing) is deferred.
Per-model pricing configuration (configurable $/token per model) is a future enhancement — current implementation uses flat estimates from `CostEstimate`.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `logAuditEvent(auditDir, event)` — existing in completion-handlers.ts, used for `model_usage` events
- [x] `session.agentInfo?.cost` — existing CostEstimate on Session interface
- [x] `session.metadata["ao:modelTier"]` / `session.metadata["ao:model"]` — set by 58-4 spawn flow
- [x] `readSprintData(projectPath)` — existing in assignment-service.ts for sprint aggregation

**Feature Flags:**
- Model usage tracking is active when model routing is active (provider !== "raw"). When raw provider is used, no routing metadata exists and usage events log with `modelTier: "medium"`, `model: "unknown"`.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only `node:fs/promises` (appendFile) and existing types.

## Dev Notes

### Architecture Context

This story builds the usage tracking layer on top of the model routing service from 58-4.

**What 58-4 implemented:**
- `ModelRoutingService` — runtime routing logic (resolveTier, tierToModel, failure tracking)
- Session metadata: `ao:modelTier` and `ao:model` stored on each spawned session
- `AgentLaunchConfig.model` set from routing result

**What 58-5 adds (THIS STORY):**
- `ModelUsageEvent` — structured event capturing tier + tokens + cost per session
- `ModelUsageAggregator` — in-memory + JSONL persistence with query methods
- Completion/failure handler integration — capture usage data when sessions end

### Data Flow

```
Session Spawn (58-4)
  → metadata["ao:modelTier"] = "low"
  → metadata["ao:model"] = "haiku"
  → Agent runs...
  → session.agentInfo.cost = { inputTokens: 50k, outputTokens: 12k, estimatedCostUsd: 0.15 }

Session Completion (58-5)
  → Read metadata + agentInfo.cost
  → Create ModelUsageEvent
  → recordUsage() → in-memory store + model-usage.jsonl
  → logAuditEvent() → agent-lifecycle.jsonl

Dashboard/API (Epic 60 — 60-5, 60-6)
  → modelUsageAggregator.getByProject("my-project")
  → modelUsageAggregator.getSummary()
```

### Key Design Decisions

1. **Dual persistence (in-memory + JSONL)**: In-memory store provides fast aggregation queries. JSONL provides durability across restarts. On startup, the aggregator loads from JSONL. This mirrors the existing audit trail pattern in completion-handlers.ts.

2. **Append-only JSONL**: Events are never updated or deleted. This makes the file safe for concurrent appends and simplifies the implementation. If re-aggregation is needed, the full file is re-read.

3. **Zero-value fallback for missing cost**: When an agent crashes before reporting cost, we still log a `model_usage` event with zero values. This ensures every session has a usage record, which simplifies aggregation queries (no null checks needed).

4. **Aggregator lives in core**: Like model routing, usage tracking is orchestrator-level logic. The aggregator is a core module consumed by completion handlers and (later) dashboard API routes.

5. **Completion handler is the capture point**: Usage data is captured when sessions end (completion or failure), not during spawning. At spawn time, no usage data exists yet. The agent reports cost through `getSessionInfo()` which is called during session enrichment.

6. **getBySprint reads sprint-status.yaml**: To aggregate usage across a sprint, the aggregator needs to know which stories are in the sprint. It reads `sprint-status.yaml` (already parsed by `readSprintData()` in assignment-service.ts) to get the story list, then aggregates events for those stories.

### File Change Impact

| File | Change | Why |
|------|--------|-----|
| `packages/core/src/model-usage.ts` | NEW | ModelUsageAggregator implementation |
| `packages/core/src/types.ts` | MODIFY | Add ModelUsageEvent and UsageAggregate interfaces |
| `packages/core/src/completion-handlers.ts` | MODIFY | Capture usage data in handleCompletion and handleFailure |
| `packages/core/src/index.ts` | MODIFY | Export model-usage module |
| `packages/core/src/__tests__/model-usage.test.ts` | NEW | Unit tests |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { appendFile } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { ModelUsageEvent, UsageAggregate } from "./types.js"`

### TypeScript Conventions (MUST follow)

- ESM modules — `"type": "module"` in package.json
- Strict mode — `"strict": true` in tsconfig
- No `any` — use `unknown` + type guards
- No non-null assertions (`!`) — use guards
- Semicolons, double quotes, 2-space indent (enforced by Prettier)

### Testing Standards

- **Framework**: vitest
- **Location**: `src/__tests__/*.test.ts` co-located with source
- **Assertion style**: `expect(x).toBe(y)` — no `expect(true).toBe(true)`
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in package
- **File fixtures**: Use `os.tmpdir()` for JSONL test files, clean up in afterEach

### Anti-Patterns to Avoid

- **DO NOT** implement real-time token streaming — capture only on session end
- **DO NOT** add per-token pricing configuration — use flat CostEstimate values
- **DO NOT** modify the agent plugin interface — cost comes from existing `getSessionInfo()`
- **DO NOT** implement cost-complexity feedback loop — that's a future enhancement
- **DO NOT** create a database — JSONL append-only is the persistence strategy
- **DO NOT** break completion handler error handling — usage tracking must never block completion
- **DO NOT** use a database dependency — flat JSONL file only

### Limitations (Deferred Items)

1. **Real-time cost streaming**
   - Status: Deferred - Future enhancement
   - Requires: Agent plugin support for streaming token counts
   - Current: Cost captured only on session completion/failure

2. **Per-model pricing configuration**
   - Status: Deferred - Future enhancement
   - Requires: Config schema for $/token per model
   - Current: Uses flat `estimatedCostUsd` from agent plugin

3. **Historical cost-complexity feedback loop**
   - Status: Deferred - Future enhancement
   - Requires: Correlation engine between cost and story complexity
   - Current: No automated feedback from usage data to routing

4. **Dashboard API routes for usage data**
   - Status: Deferred - Epic 60 stories 60-5 and 60-6
   - Requires: Next.js API routes consuming ModelUsageAggregator
   - Current: Aggregator module only, no HTTP endpoints

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 58, Story 58-5 definition, FR-P2-5]
- [Source: `_bmad-output/implementation-artifacts/58-4-model-routing-service.md` — model routing, session metadata fields]
- [Source: `packages/core/src/types.ts:412-415` — CostEstimate interface]
- [Source: `packages/core/src/types.ts:404-410` — SessionInfo with cost field]
- [Source: `packages/core/src/completion-handlers.ts:38-62` — logAuditEvent() signature]
- [Source: `packages/core/src/completion-handlers.ts:363-370` — agent_completed audit event]
- [Source: `packages/core/src/completion-handlers.ts:455-464` — agent_failed audit event]
- [Source: `packages/core/src/assignment-service.ts:67-96` — readSprintData() for sprint parsing]
- [Source: `packages/core/src/model-routing.ts` — ModelTier type and routing service]
- [Source: `packages/core/src/session-manager.ts:606-618` — spawn flow routing (sets ao:modelTier, ao:model)]
- [Source: `packages/core/src/session-manager.ts:665-682` — session metadata with routing fields]
- [Source: `CLAUDE.md` — TypeScript conventions, shell command security]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No external debug logs. ESLint hooks caught: unused `content` variable in dead code block (removed), non-null assertions on `sessionsDir` (replaced with guard checks and path derivation), duplicate imports in completion-handlers.ts (merged into existing import statements).

### Completion Notes List

- All 8 acceptance criteria met across 5 implementation tasks
- 28 tests total: 24 unit tests + 4 integration tests
- No new external dependencies — uses only `node:fs/promises` and existing types
- Completion handler integration: reads session metadata (`ao:modelTier`, `ao:model`, `cost`) and logs ModelUsageEvent on both completion and failure
- JSONL persistence: append-only `model-usage.jsonl` in `{sessionsDir}/audit/` directory
- Zero-value fallback: when cost data is unavailable (agent crashed before reporting), event is logged with zeros
- Full regression suite: 2322+ tests pass across core package, zero failures from this story

### Code Review Fixes

Adversarial code review found 9 issues (3 HIGH, 4 MEDIUM, 2 LOW) in initial implementation, then a second review found 8 more issues (2 HIGH, 3 MEDIUM, 3 LOW). All fixed:

**Initial Review (9 issues):**
- H1: `getBySprint()` was a stub returning empty aggregate — now reads sprint-status.yaml and aggregates matching stories via `readSprintStoryIds()`
- H2: Completion/failure handlers used unsafe `as ModelTier` cast — now uses `validateModelTier()` with safe fallback to "medium"
- H3: JSONL startup load was async fire-and-forget (race condition) — changed to synchronous `readFileSync` on construction
- M1: ~50 lines of duplicated usage tracking code in completion/failure handlers — extracted `captureModelUsage()` helper
- M2: `recordUsage()` called `mkdirSync` on every invocation — replaced with lazy `ensureAuditDir()` with `dirCreated` flag
- M3: `getByStory()`/`getByProject()` were O(n) scans — added `storyIndex` and `projectIndex` Maps for O(1) lookups
- M4: Path used string concatenation instead of `dirname()` — now uses `import { dirname, join } from "node:path"`
- L1: `getSummary()` didn't guard against invalid `modelTier` values — now skips events with invalid tiers
- L2: `waitForFile` test helper only checked file existence, not content — now waits for non-empty content

**Second Review (8 issues):**
- H1: No integration test for `captureModelUsage` in completion/failure handlers — created `completion-model-usage.test.ts` with 4 tests
- H2: No way to register a persistent aggregator for CLI use — added `bootstrapModelUsageAggregator()` and `registerModelUsageAggregator()`/`getModelUsageAggregator()` in service registry
- M1: `readSprintStoryIds` included epic and retrospective keys — added `isStoryKey()` filter
- M2: `getBySprint` used sync `readFileSync` (blocking event loop) — converted to async with `readFile` from `node:fs/promises`
- M3: `captureModelUsage` used singleton directly, ignoring registered aggregator — now resolves via `getModelUsageAggregator() ?? modelUsageAggregator`
- L1: `ModelUsageAggregator` type exported from `types.js` instead of co-located module — re-exported from `model-usage.js`
- L2: Missing exports in `index.ts` for `bootstrapModelUsageAggregator`, registry functions, co-exported types — added
- L3: `makeEvent()` test helper used `...overrides` spread — replaced with explicit field assignments via optional parameters

### File List

- `packages/core/src/model-usage.ts` — NEW: ModelUsageAggregator implementation (factory, in-memory store with secondary indexes, JSONL persistence with sync startup load, aggregation queries, validateModelTier, bootstrapModelUsageAggregator, type re-exports)
- `packages/core/src/__tests__/model-usage.test.ts` — NEW: 24 unit tests (expanded after two code reviews)
- `packages/core/src/__tests__/completion-model-usage.test.ts` — NEW: 4 integration tests for captureModelUsage in completion/failure handlers
- `packages/core/src/types.ts` — MODIFIED: Added ModelUsageEvent and UsageAggregate interfaces
- `packages/core/src/completion-handlers.ts` — MODIFIED: Extracted captureModelUsage() helper with DI via service registry, added model usage tracking in handleCompletion and handleFailure with validateModelTier
- `packages/core/src/service-registry.ts` — MODIFIED: Added registerModelUsageAggregator()/getModelUsageAggregator()
- `packages/core/src/index.ts` — MODIFIED: Export model-usage module with bootstrapModelUsageAggregator, registry functions, co-exported types
