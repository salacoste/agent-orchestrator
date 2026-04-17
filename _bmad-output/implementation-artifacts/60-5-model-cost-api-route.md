# Story 60.5: Model Cost API Route

Status: done

## Story

As a developer using the dashboard,
I want an API route that aggregates model tier usage data from the core ModelUsageAggregator,
so that I can retrieve cost breakdowns by session, story, project, and sprint dimensions.

## Acceptance Criteria

1. **AC1 — GET `/api/costs/breakdown` route**: A new Next.js API route at `packages/web/src/app/api/costs/breakdown/route.ts` that:
   - Exports `dynamic = "force-dynamic"`
   - Returns a JSON response with model cost breakdowns
   - Supports query parameters: `?dimension=session&sessionId=abc`, `?dimension=story&storyId=abc`, `?dimension=project&projectId=abc`, `?dimension=sprint&projectPath=/path`, `?dimension=summary`
   - Defaults to `dimension=summary` when no dimension parameter is provided

2. **AC2 — Summary dimension**: When `dimension=summary` (default), returns:
   - `totalTokens`: total input + output tokens across all events
   - `totalCost`: total estimated cost in USD
   - `byTier`: per-tier breakdown `{ low: { tokens, cost, sessions }, medium: { tokens, cost, sessions }, high: { tokens, cost, sessions } }`
   - Shape matches `ModelUsageAggregator.getSummary()` exactly

3. **AC3 — Session dimension**: When `dimension=session&sessionId=abc`, returns:
   - `sessionId`: the requested session ID
   - `usage`: `{ totalInputTokens, totalOutputTokens, totalCostUsd, sessionCount }`
   - Shape matches `UsageAggregate` from `@composio/ao-core`
   - Returns empty aggregate (zeros) when session has no usage data

4. **AC4 — Story dimension**: When `dimension=story&storyId=abc`, returns:
   - `storyId`: the requested story ID
   - `usage`: `UsageAggregate` shape
   - Returns empty aggregate when story has no usage data

5. **AC5 — Project dimension**: When `dimension=project&projectId=abc`, returns:
   - `projectId`: the requested project ID
   - `usage`: `UsageAggregate` shape
   - Returns empty aggregate when project has no usage data

6. **AC6 — Sprint dimension**: When `dimension=sprint&projectPath=/path`, returns:
   - `projectPath`: the requested project path
   - `usage`: `UsageAggregate` shape
   - Returns empty aggregate when no sprint data found

7. **AC7 — Error handling**: The route handles errors gracefully:
   - Missing required parameter for a dimension (e.g., `dimension=session` without `sessionId`): returns 400 with `{ error: "Missing required parameter: sessionId" }`
   - Invalid dimension value: returns 400 with `{ error: "Invalid dimension. Must be one of: session, story, project, sprint, summary" }`
   - Internal errors: returns 500 with `{ error: "Internal server error" }`

8. **AC8 — Aggregator access**: The route accesses the `ModelUsageAggregator` via:
   - Import `getModelUsageAggregator` from `@composio/ao-core` (checks service registry first)
   - Fallback to the in-memory `modelUsageAggregator` singleton from `@composio/ao-core` if registry returns undefined
   - This dual-source pattern matches how other services are accessed in the web layer

9. **AC9 — Unit tests**: Comprehensive vitest tests covering:
   - Summary dimension returns correct shape
   - Session dimension returns usage for known session
   - Session dimension returns empty aggregate for unknown session
   - Story dimension returns usage for known story
   - Project dimension returns usage for known project
   - Sprint dimension returns usage for known sprint
   - Missing required parameter returns 400
   - Invalid dimension returns 400
   - Internal error returns 500

10. **AC10 — No new dependencies**: Uses only existing dependencies (Next.js, vitest, @composio/ao-core).

## Tasks / Subtasks

- [x] Task 1: Create API route (AC: #1-#8)
  - [x] 1.1 Create `packages/web/src/app/api/costs/breakdown/route.ts`
  - [x] 1.2 Implement dimension-based routing with query parameter parsing
  - [x] 1.3 Implement summary dimension (default)
  - [x] 1.4 Implement session dimension with sessionId parameter
  - [x] 1.5 Implement story dimension with storyId parameter
  - [x] 1.6 Implement project dimension with projectId parameter
  - [x] 1.7 Implement sprint dimension with projectPath parameter
  - [x] 1.8 Implement error handling (missing params, invalid dimension, internal errors)
  - [x] 1.9 Implement aggregator access with registry + singleton fallback

- [x] Task 2: Unit tests (AC: #9)
  - [x] 2.1 Create `packages/web/src/app/api/costs/breakdown/route.test.ts`
  - [x] 2.2 Test summary dimension
  - [x] 2.3 Test session dimension (found + not found)
  - [x] 2.4 Test story dimension
  - [x] 2.5 Test project dimension
  - [x] 2.6 Test sprint dimension
  - [x] 2.7 Test error cases (400 missing params, 400 invalid dimension, 500 internal)

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

SSE streaming endpoint for real-time cost updates deferred. The REST endpoint provides snapshot data. An SSE endpoint (`/api/costs/breakdown/stream`) can be added later following the same pattern as timeline/notepad streams if real-time cost monitoring is needed.

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
- [x] `ModelUsageAggregator.getSummary()` — returns `{ totalTokens, totalCost, byTier }` from `@composio/ao-core`
- [x] `ModelUsageAggregator.getBySession(sessionId)` — returns `UsageAggregate`
- [x] `ModelUsageAggregator.getByStory(storyId)` — returns `UsageAggregate`
- [x] `ModelUsageAggregator.getByProject(projectId)` — returns `UsageAggregate`
- [x] `ModelUsageAggregator.getBySprint(projectPath)` — returns `Promise<UsageAggregate>`
- [x] `getModelUsageAggregator()` — returns `ModelUsageAggregator | undefined` from service registry
- [x] `modelUsageAggregator` — in-memory singleton from `@composio/ao-core`

**Feature Flags:**
- None. All methods exist and are exported from `@composio/ao-core`.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing `@composio/ao-core` exports.

## Dev Notes

### Architecture Context

This story is the fifth in Epic 60 (Dashboard Intelligence). It creates the API backend for model cost data that Story 60-6 (Model Cost Dashboard Panel) will consume. The data source is the `ModelUsageAggregator` from core, which was built in Story 58-5 and populated during session completion/failure by `completion-handlers.ts`.

### Data Flow

```
Session Completion → captureModelUsage() → ModelUsageAggregator.recordUsage()
                                                    ↓
                          ModelUsageAggregator JSONL ({sessionsDir}/audit/model-usage.jsonl)
                                                    ↓
                          GET /api/costs/breakdown?dimension=X
                                                    ↓
                          Story 60-6: Model Cost Dashboard Panel (consumer)
```

### Key Design Decision — Aggregator Access Pattern

The web services layer (`packages/web/src/lib/services.ts`) does NOT initialize a `ModelUsageAggregator`. The CLI bootstraps the persistent aggregator during app startup and registers it in the service registry. The web dashboard runs in a separate Next.js process.

**Access strategy:**
1. First try `getModelUsageAggregator()` from the service registry — returns the persistent instance if the web server shares process space with the CLI
2. Fallback to the in-memory `modelUsageAggregator` singleton — always available but empty unless events were recorded in-process
3. The route should always work (never throw due to missing aggregator), returning empty aggregates when no data is available

This matches the "best-effort" pattern used by other dashboard API routes (notepad, timeline).

### Route Design — Dimension-Based Query

Rather than creating 5 separate routes (`/costs/session/[id]`, `/costs/story/[id]`, etc.), this uses a single `/api/costs/breakdown` endpoint with a `dimension` query parameter. This is simpler to test, maintain, and extend.

### ModelUsageAggregator API Reference

```typescript
interface ModelUsageAggregator {
  recordUsage(event: ModelUsageEvent): void;
  getBySession(sessionId: string): UsageAggregate;
  getByStory(storyId: string): UsageAggregate;
  getByProject(projectId: string): UsageAggregate;
  getBySprint(projectPath: string): Promise<UsageAggregate>;  // ASYNC — reads sprint-status.yaml
  getSummary(): {
    totalTokens: number;
    totalCost: number;
    byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
  };
}
```

### Type Reference (from @composio/ao-core)

```typescript
type ModelTier = "low" | "medium" | "high";

interface UsageAggregate {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  sessionCount: number;
}

interface ModelUsageEvent {
  sessionId: string;
  storyId: string;
  projectId: string;
  modelTier: ModelTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
}
```

### Response Shapes

**Summary (default):**
```json
{
  "dimension": "summary",
  "totalTokens": 150000,
  "totalCost": 0.45,
  "byTier": {
    "low": { "tokens": 10000, "cost": 0.01, "sessions": 2 },
    "medium": { "tokens": 100000, "cost": 0.30, "sessions": 5 },
    "high": { "tokens": 40000, "cost": 0.14, "sessions": 1 }
  }
}
```

**Per-dimension (session, story, project, sprint):**
```json
{
  "dimension": "session",
  "sessionId": "abc-123",
  "usage": {
    "totalInputTokens": 50000,
    "totalOutputTokens": 10000,
    "totalCostUsd": 0.15,
    "sessionCount": 1
  }
}
```

### Testing Standards

- **Framework**: vitest + standard Request/Response mocking
- **Pattern**: Follow `packages/web/src/app/api/sprint/cost/route.test.ts` pattern
- **Mock**: Mock `getModelUsageAggregator` and `modelUsageAggregator` from `@composio/ao-core` using `vi.hoisted()` + `vi.mock()`
- **No `expect(true).toBe(true)`** — all assertions must verify real behavior
- **Run command**: `npx vitest run` in packages/web

### Import Conventions (MUST follow)

- **Package imports**: `import { getModelUsageAggregator, modelUsageAggregator } from "@composio/ao-core"` — NO `.js` extension
- **Local imports**: `import { getServices } from "@/lib/services"` — NO `.js` extension
- **Next.js imports**: `import { NextResponse } from "next/server"` — standard

### Anti-Patterns to Avoid

- **DO NOT** add the aggregator to the `Services` interface — it's accessed via the service registry, not the web services singleton
- **DO NOT** create 5 separate route files — use the dimension query parameter pattern
- **DO NOT** throw when aggregator is unavailable — return empty aggregates
- **DO NOT** forget `export const dynamic = "force-dynamic"` — prevents Next.js caching
- **DO NOT** use `.js` extensions in local `@/lib/*.js` imports — the web package convention is extensionless
- **DO NOT** forget that `getBySprint()` is async — all other methods are synchronous

### Limitations (Deferred Items)

1. **SSE streaming for cost updates**
   - Status: Deferred — initial implementation is REST-only (snapshot)
   - Requires: ReadableStream SSE endpoint following timeline/notepad stream pattern
   - Current: Single GET endpoint returns snapshot data

2. **Date-range filtering**
   - Status: Deferred — aggregator doesn't support time-based queries yet
   - Requires: Adding date-range index to aggregator or filtering in-memory
   - Current: Returns all-time data for each dimension

### Previous Story Intelligence (60-4)

**Key learnings from 60-4 that impact this story:**

1. **`vi.hoisted()` for mock references**: Required when mock instances are referenced in `vi.mock()` factory functions. Use this pattern for mocking `getModelUsageAggregator`.

2. **Best-effort pattern**: Missing data returns empty results (200), not errors. The route should handle missing aggregator gracefully.

3. **No `vi.useFakeTimers()` for SSE tests**: Not relevant for this REST-only route, but worth noting if SSE is added later.

4. **Code review lesson — render all data fields**: 60-4 review caught `entry.file` and `entry.agentType` not being displayed. For this API route, ensure all aggregator response fields are surfaced in the JSON response.

### Previous Story Intelligence (60-3)

1. **`export const dynamic = "force-dynamic"`**: Required on all dashboard API routes to prevent Next.js caching.

2. **Next.js 15 async params**: `{ params }: { params: Promise<{ id: string }> }` — use `const { id } = await params` pattern for dynamic segments.

3. **Query parameter access**: `request.nextUrl.searchParams` for reading query params.

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-5 definition, FR-D3-1, FR-D3-2]
- [Source: `packages/core/src/model-usage.ts` — `ModelUsageAggregator` interface with all aggregation methods]
- [Source: `packages/core/src/types.ts:1001-1033` — `ModelTier`, `ModelUsageEvent`, `UsageAggregate`, `CostEstimate` types]
- [Source: `packages/core/src/service-registry.ts:127-135` — `registerModelUsageAggregator`, `getModelUsageAggregator`]
- [Source: `packages/core/src/index.ts:112-125` — Core exports for aggregator access]
- [Source: `packages/web/src/app/api/sprint/cost/route.ts` — Existing sprint cost route pattern]
- [Source: `packages/web/src/app/api/session/[id]/timeline/route.ts` — Recent API route pattern reference]
- [Source: `packages/web/src/lib/services.ts` — Web services initialization (no aggregator init)]
- [Source: `packages/web/src/app/api/sprint/cost/route.test.ts` — Cost route test pattern reference]
- [Source: `packages/core/src/completion-handlers.ts` — Where `captureModelUsage()` populates the aggregator]
- [Source: `_bmad-output/implementation-artifacts/60-4-agent-activity-timeline-component.md` — Previous story with learnings]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

1. **ESLint: duplicate imports** — Initially had separate `import type` and `import` from `@composio/ao-core`. Merged into single import with inline `type` keyword per `no-duplicate-imports` rule.

### Completion Notes List

1. All 10 ACs implemented and verified with 14 tests.
2. Route uses dimension-based query parameter pattern (`?dimension=X&param=Y`) — single endpoint for 5 aggregation modes.
3. Aggregator access uses registry-first (`getModelUsageAggregator()`) with singleton fallback (`modelUsageAggregator`).
4. Error handling: 400 for missing params and invalid dimensions, 500 for internal errors with console.error logging.
5. `getBySprint()` is the only async aggregation method — handled correctly with `await`.
6. Test counts: Web 2625 passed (14 new), 0 regressions.
7. Post-review fixes applied (see Senior Developer Review below).

## Senior Developer Review

### Review Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| H1 | HIGH | Switch statement missing exhaustive return after switch block | Fixed |
| M1 | MEDIUM | No empty-aggregate tests for story, project, sprint dimensions | Fixed |
| M2 | MEDIUM | No test for aggregator resolution failure (getModelUsageAggregator throws) | Fixed |
| M3 | MEDIUM | Sprint async test didn't verify totalOutputTokens (stronger async verification) | Fixed |
| L1 | LOW | VALID_DIMENSIONS array → Set for O(1) lookup | Fixed |
| L2 | LOW | Missing Cache-Control headers on success responses (inconsistent with /api/sprint/cost) | Fixed |

### Fixes Applied

**H1 — Exhaustive switch guard**: Added return-after-switch with 500 "Unhandled dimension" as exhaustiveness guard. Prevents silent undefined return if a new dimension is added to the Set but not the switch.

**M1 — Empty aggregate tests**: Added 3 new tests: "returns empty aggregate for unknown story", "returns empty aggregate for unknown project", "returns empty aggregate for sprint with no data". AC9 now fully covered for all dimensions.

**M2 — Aggregator resolution failure test**: Added test "returns 500 when aggregator resolution throws" — verifies that `getModelUsageAggregator()` throwing is caught by the outer try/catch and returns 500.

**M3 — Stronger sprint async verification**: Added `totalOutputTokens` assertion to sprint test to verify the resolved promise data is fully surfaced.

**L1 — Set for VALID_DIMENSIONS**: Changed from `readonly string[]` to `Set<string>`, using `.has()` instead of `.includes()`.

**L2 — Cache-Control headers**: Added `NO_CACHE_HEADERS` constant (`no-cache, no-store, must-revalidate`) applied to all success responses. Matches existing `/api/sprint/cost` pattern.

### Post-Review Test Results

Web: 18 tests passed (4 new), 0 regressions.

### File List

**New files (1 source + 1 test = 2):**
- `packages/web/src/app/api/costs/breakdown/route.ts` — Model cost breakdown API route
- `packages/web/src/app/api/costs/breakdown/route.test.ts` — Route tests (18 tests)
