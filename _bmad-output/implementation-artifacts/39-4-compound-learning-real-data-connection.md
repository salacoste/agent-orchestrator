# Story 39.4: Compound Learning Real Data Connection

Status: review

## Story

As a team lead viewing the Learning Insights dashboard panel,
I want the learning API to return real patterns and failure analysis from the JSONL learning store,
so that the compound learning system provides actionable insights instead of empty data.

## Acceptance Criteria

1. GET /api/learning returns real data from the core LearningStore when available
2. `detectCrossSprintPatterns()` is called with real `errorCategories` from stored learnings
3. `analyzeFailures()` is called with real error+file data from stored learnings
4. Response includes `totalSessions`, `successRate`, `failureRate`, `topPatterns`, `recentLearnings`
5. Falls back gracefully to empty data when learning store is not initialized
6. Tests verify both real-data and fallback paths

## Tasks / Subtasks

- [x] Task 1: Initialize LearningStore in web services (AC: #1, #5)
  - [x] 1.1: Add `createLearningStore` + `registerLearningStore` to services.ts
  - [x] 1.2: Compute path from `getSessionsDir` + "learnings.jsonl"
  - [x] 1.3: Call `store.start()` with non-fatal error handling
- [x] Task 2: Wire /api/learning route to real data (AC: #1, #2, #3, #4)
  - [x] 2.1: Import `getLearningStore` from core
  - [x] 2.2: Query all learnings via `store.list()`
  - [x] 2.3: Compute rates from outcome counts
  - [x] 2.4: Call `detectCrossSprintPatterns()` with aggregated errorCategories
  - [x] 2.5: Call `analyzeFailures()` with error+file data → failureBreakdown
  - [x] 2.6: Return last 10 learnings sorted newest first
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: Test real data path with mocked learning store (rates, patterns, breakdown)
  - [x] 3.2: Test fallback when store not available + empty store
  - [x] 3.3: Test correct rate calculations (50% success, 25% failure)
  - [x] 3.4: Test pattern detection (3x import-error → pattern)
  - [x] 3.5: Test recent learnings limited to 10, newest first

## Dev Notes

### Architecture Constraints

- **Core LearningStore** — `createLearningStore({ learningsPath })` from `@composio/ao-core`. Needs `start()` called to load from disk.
- **Service registry** — `registerLearningStore(store)` makes it available via `getLearningStore()` globally.
- **Web services.ts** — currently only initializes `SessionManager`. Need to add LearningStore initialization.
- **SessionLearning interface** — has `outcome`, `errorCategories`, `filesModified`, `domainTags`, `capturedAt`.

### Implementation Approach

**services.ts changes:**
```typescript
import { createLearningStore, registerLearningStore, getSessionsDir } from "@composio/ao-core";
// In initServices():
const firstProject = Object.values(config.projects)[0];
if (firstProject) {
  const sessionsDir = getSessionsDir(config.configPath, firstProject.path);
  const store = createLearningStore({ learningsPath: join(sessionsDir, "learnings.jsonl") });
  await store.start();
  registerLearningStore(store);
}
```

**learning/route.ts changes:**
```typescript
import { getLearningStore } from "@composio/ao-core";
import { detectCrossSprintPatterns, analyzeFailures } from "@/lib/workflow/compound-learning";
// Query store, compute stats, call analysis functions
```

### Files to Create/Modify

1. `packages/web/src/lib/services.ts` (modify — add LearningStore init)
2. `packages/web/src/app/api/learning/route.ts` (modify — wire to real data)
3. `packages/web/src/app/api/learning/route.test.ts` (new — tests)

### References

- [Source: packages/core/src/learning-store.ts] — LearningStore implementation
- [Source: packages/core/src/types.ts#SessionLearning] — learning record interface
- [Source: packages/web/src/lib/workflow/compound-learning.ts] — analysis functions
- [Source: packages/web/src/lib/services.ts] — web services singleton

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Initialized LearningStore in services.ts from first project's sessionsDir
- Rewrote /api/learning route: real stats, patterns, failure breakdown, recent learnings
- Wired detectCrossSprintPatterns() and analyzeFailures() from compound-learning module
- Graceful fallback to empty data when store unavailable (WD-FR31 pattern)
- 7 tests covering all ACs
- All 1,146 web tests pass, typecheck clean

### File List

- packages/web/src/lib/services.ts (modified — LearningStore initialization)
- packages/web/src/app/api/learning/route.ts (rewritten — real data from store)
- packages/web/src/app/api/learning/route.test.ts (new — 7 tests)
