# Story 45.6: Confidence Indicators — Per-File Agent Certainty

Status: review

## Story

As a code reviewer,
I want to see which files the agent was most/least confident about,
so that I can focus my review on uncertain areas.

## Acceptance Criteria

1. Each modified file shows a confidence indicator (high/medium/low)
2. Confidence computed from: retry count, error count, file count (as proxy for complexity)
3. Files sorted by confidence (lowest first — "review these first")
4. `GET /api/agent/{id}/confidence` returns per-file confidence data
5. Confidence calculator is a pure function (testable without side effects)
6. Tests verify confidence scoring, sorting, and API response

## Tasks / Subtasks

- [x] Task 1: Create confidence calculator (pure function) (AC: #1, #2, #5)
  - [x] 1.1: Create `packages/core/src/confidence-calculator.ts`
  - [x] 1.2: Accept ConfidenceInput: retryCount, errorCategories, filesModified, durationMs
  - [x] 1.3: Score: 100 base, -20/retry, -15/error cat, -5 for >10 files. Thresholds: high≥70, med≥40, low<40
  - [x] 1.4: Return sorted array (alphabetical, all same session-level confidence)
- [x] Task 2: Create confidence API route (AC: #3, #4)
  - [x] 2.1: Create `packages/web/src/app/api/agent/[id]/confidence/route.ts`
  - [x] 2.2: Query learningStore for most recent session by agentId
  - [x] 2.3: Validate agent ID regex, return sorted confidence results
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: 8 score tests: clean, retries, errors, complexity, combined, clamp
  - [x] 3.2: 3 level threshold tests: high, medium, low
  - [x] 3.3: 7 calculateConfidence tests: empty, clean, medium, low, sort, shared score, reasons
  - [x] 3.4: 4 route tests: success, empty, invalid ID, service failure

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
- [x] Deferred: per-file granularity documented in Limitations
- [x] File List includes all changed files

## Dev Notes

### Architecture — Pure Calculator + API Route

Same established pattern.

```
confidence-calculator.ts (pure — no I/O)
  ├── Input: SessionLearning (retryCount, errorCategories, filesModified, durationMs)
  └── Output: FileConfidence[] sorted lowest-first

API route (wiring)
  └── LearningStore query → calculator → JSON
```

### Confidence Scoring Algorithm

Since we don't have per-file retry/error data (SessionLearning tracks session-level totals), the confidence is computed per-session and distributed across files:

```typescript
interface FileConfidence {
  file: string;
  confidence: "high" | "medium" | "low";
  score: number;  // 0-100, higher = more confident
  reasons: string[];  // Why this confidence level
}

// Score computation:
// Base score: 100
// -20 per retry (retryCount)
// -15 per error category
// -5 if many files modified (>10 files = complexity signal)
// Clamp to 0-100

// Thresholds:
// score >= 70 → high
// score >= 40 → medium
// score < 40 → low
```

All files in a session share the same confidence score (session-level data). Files are sorted alphabetically within the same confidence level.

### Data Source

```typescript
// From LearningStore
const learning = learningStore.query({ agentId });
// Use most recent completed session's data:
// - retryCount: number of retries
// - errorCategories: error types encountered
// - filesModified: file paths
// - durationMs: session duration
```

### Anti-Patterns to Avoid

- Do NOT try to compute per-file retries — SessionLearning only has session-level data
- Do NOT add UI components — backend only
- Do NOT create new data structures in learning store — work with existing SessionLearning
- Do NOT use file size for scoring — we don't have file size data in SessionLearning

### Previous Story Intelligence (45.5)

- Pure function + API route pattern (5th time)
- LearningStore.query({ agentId }) for session data
- Route tests mock getServices() + learningStore

### Files to Create

1. `packages/core/src/confidence-calculator.ts` (new)
2. `packages/core/src/__tests__/confidence-calculator.test.ts` (new)
3. `packages/web/src/app/api/agent/[id]/confidence/route.ts` (new)
4. `packages/web/src/app/api/agent/[id]/confidence/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export calculateConfidence)

### References

- [Source: packages/core/src/types.ts:1432-1459] — SessionLearning interface
- [Source: packages/core/src/learning-store.ts] — query method with agentId filter
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.6] — requirements

### Limitations (Deferred Items)

1. **Per-file granularity**
   - Status: Deferred — SessionLearning only tracks session-level retries/errors
   - Current: All files in a session share the same confidence score
   - Future: Per-file retry tracking would require changes to session-learning capture

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure calculateConfidence() with 3 penalty factors: retries (-20), errors (-15), complexity (-5)
- computeConfidenceScore() returns 0-100 score with human-readable reasons
- scoreToLevel() maps to high/medium/low at 70/40 thresholds
- API route validates agent ID with regex, queries most recent learning entry
- All files share session-level score (per-file tracking deferred)
- Exported: calculateConfidence, FileConfidence, ConfidenceInput, ConfidenceLevel
- 22 new tests (18 calculator + 4 route), zero regressions

### File List

- packages/core/src/confidence-calculator.ts (new)
- packages/core/src/__tests__/confidence-calculator.test.ts (new)
- packages/core/src/index.ts (modified — export calculateConfidence)
- packages/web/src/app/api/agent/[id]/confidence/route.ts (new)
- packages/web/src/app/api/agent/[id]/confidence/route.test.ts (new)
