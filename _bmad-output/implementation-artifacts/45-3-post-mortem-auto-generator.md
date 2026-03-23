# Story 45.3: Post-Mortem Auto-Generator

Status: review

## Story

As a team lead after a failed sprint or story,
I want an automatically generated post-mortem analysis,
so that I can understand failure patterns without manually investigating.

## Acceptance Criteria

1. `GET /api/sprint/postmortem` returns a structured post-mortem report
2. Report includes: timeline of failures, error categories, affected files, pattern analysis
3. Pattern analysis reuses compound-learning from Story 39.4 (detectPatterns, analyzeFailures)
4. Report includes actionable recommendations based on failure patterns
5. If no failures exist, returns "No failures to analyze" message
6. Post-mortem generator is a pure function (testable without side effects)
7. Tests verify report structure, pattern analysis, empty state, and API response

## Tasks / Subtasks

- [x] Task 1: Create post-mortem generator (pure function) (AC: #2, #4, #6)
  - [x] 1.1: Create `packages/core/src/postmortem-generator.ts`
  - [x] 1.2: Accept `SessionLearning[]`, filter to failed/blocked/abandoned
  - [x] 1.3: Produce PostMortemReport: summary, timeline, errorBreakdown, affectedFiles, recommendations, markdown
  - [x] 1.4: Reuse `detectPatterns()` for recommendations, fallback to generic if below threshold
- [x] Task 2: Create post-mortem API route (AC: #1, #5)
  - [x] 2.1: Create `packages/web/src/app/api/sprint/postmortem/route.ts`
  - [x] 2.2: Query LearningStore for failed/blocked/abandoned sessions
  - [x] 2.3: Call generatePostMortem with combined sessions
  - [x] 2.4: Return JSON report (hasFailures=false when no failures)
- [x] Task 3: Write tests (AC: #7)
  - [x] 3.1: 12 generator tests: summary, timeline, error grouping, files, recommendations, markdown
  - [x] 3.2: Empty input and all-successful sessions return no-failures
  - [x] 3.3: Error categories sorted by count descending with affected stories
  - [x] 3.4: Pattern-based and fallback recommendations both tested
  - [x] 3.5: 4 route tests: structure, empty store, missing store, service failure

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

### Architecture — Pure Generator + API Route

Same pattern as Story 44.7 (digest): pure function takes data, returns report. API route does the wiring.

```
postmortem-generator.ts (pure — no I/O)
  ├── Input: SessionLearning[] (failed/blocked only)
  ├── Uses: detectPatterns() from learning-patterns.ts
  └── Output: PostMortemReport { summary, timeline, errorCategories, affectedFiles, recommendations }

API route (wiring)
  └── Query LearningStore → filter failed → call generator → return JSON
```

### PostMortemReport Interface

```typescript
interface PostMortemReport {
  title: string;
  generatedAt: string;
  summary: {
    totalFailures: number;
    totalBlocked: number;
    uniqueStories: number;
    timeRange: { earliest: string; latest: string } | null;
  };
  timeline: Array<{
    timestamp: string;
    storyId: string;
    agentId: string;
    outcome: string;
    errorCategories: string[];
  }>;
  errorBreakdown: Array<{
    category: string;
    count: number;
    affectedStories: string[];
  }>;
  affectedFiles: string[];
  recommendations: string[];
  markdown: string;
}
```

### Existing Code to Reuse (DO NOT DUPLICATE)

1. **`detectPatterns(learnings)`** from `packages/core/src/learning-patterns.ts` — returns `FailurePattern[]` with `category`, `occurrenceCount`, `affectedStories`, `suggestedAction`
2. **`LearningStore.query({ outcome: "failed" })`** — returns failed sessions from JSONL store
3. **`SessionLearning` interface** from `packages/core/src/types.ts:1432-1459` — has `errorCategories`, `filesModified`, `outcome`, `storyId`, `agentId`
4. **`analyzeFailures()`** from `packages/web/src/lib/workflow/compound-learning.ts` — error category breakdown

### LearningStore Query Pattern

```typescript
// Get all failures (failed + blocked + abandoned)
const failures = [
  ...store.query({ outcome: "failed" }),
  ...store.query({ outcome: "blocked" }),
  ...store.query({ outcome: "abandoned" }),
];
```

### API Route Pattern

Follow `packages/web/src/app/api/sprint/digest/route.ts`:
- Use `getServices()` for config and services
- Try/catch with 500 error response
- Return `NextResponse.json(report)`

### Recommendations Logic

Use `detectPatterns()` results. Each `FailurePattern` has a `suggestedAction` field. If no patterns detected, fall back to generic recommendations based on error categories.

### Anti-Patterns to Avoid

- Do NOT import `compound-learning.ts` functions — use `detectPatterns` from core (the web lib is a consumer, not the source)
- Do NOT read learning JSONL files directly — use the LearningStore service
- Do NOT add UI components — this story is backend-only (a future story can add a dashboard panel)
- Do NOT filter by time range — analyze all available failures (caller can pre-filter if needed)

### Previous Story Intelligence (45.2)

- Pure function + API route pattern is well-established (digest, time-travel)
- `getServices()` provides `sessionManager` and config — LearningStore may need explicit import from service registry
- API route tests mock `getServices()` and external modules via `vi.mock()`

### Files to Create

1. `packages/core/src/postmortem-generator.ts` (new)
2. `packages/core/src/__tests__/postmortem-generator.test.ts` (new)
3. `packages/web/src/app/api/sprint/postmortem/route.ts` (new)
4. `packages/web/src/app/api/sprint/postmortem/route.test.ts` (new)

### Files to Modify

None — all new files.

### References

- [Source: packages/core/src/learning-store.ts] — JSONL store with query interface
- [Source: packages/core/src/learning-patterns.ts] — detectPatterns, FailurePattern
- [Source: packages/core/src/session-learning.ts] — outcome capture, error categorization
- [Source: packages/core/src/types.ts:1432-1459] — SessionLearning interface
- [Source: packages/web/src/app/api/sprint/digest/route.ts] — API route pattern
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.3] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure generatePostMortem() filters non-successful sessions, builds timeline/error breakdown/recommendations
- Reuses detectPatterns() from learning-patterns.ts for pattern-based recommendations
- Fallback recommendations when below pattern threshold (single failures)
- Error breakdown sorted by count descending with affected story lists
- API route queries LearningStore for 3 outcome types, handles null/missing store gracefully
- Exported from @composio/ao-core index: generatePostMortem, PostMortemReport
- 16 new tests (12 generator + 4 route), zero regressions

### File List

- packages/core/src/postmortem-generator.ts (new)
- packages/core/src/__tests__/postmortem-generator.test.ts (new)
- packages/core/src/index.ts (modified — export generatePostMortem)
- packages/web/src/app/api/sprint/postmortem/route.ts (new)
- packages/web/src/app/api/sprint/postmortem/route.test.ts (new)
