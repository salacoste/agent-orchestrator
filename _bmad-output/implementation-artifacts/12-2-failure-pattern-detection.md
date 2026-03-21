# Story 12.2: Failure Pattern Detection

Status: done

## Story

As a Tech Lead,
I want the system to identify recurring failure patterns across agent sessions,
so that I can address systemic issues before they cause more failures.

## Acceptance Criteria

1. **Detect patterns with 3+ occurrences** — Same errorCategory appearing 3+ times = pattern (AC1)
2. **Pattern includes metadata** — category, count, affectedStories, lastOccurrence, suggestedAction (AC2)
3. **Sorted by count descending** — Most frequent pattern first (AC3)
4. **<200ms for 1000 records** — Performance requirement (AC4)

## Tasks / Subtasks

- [x] Task 1: Create detectPatterns function (AC: 1-4)
  - [x]1.1 Create `packages/core/src/learning-patterns.ts`
  - [x]1.2 `detectPatterns(learnings: SessionLearning[]): FailurePattern[]`
  - [x]1.3 Group by errorCategory, count occurrences, filter 3+
  - [x]1.4 Include affectedStories, lastOccurrence, suggestedAction
  - [x]1.5 Sort by count descending
  - [x]1.6 Export from index.ts

- [x] Task 2: Tests (AC: 1-4)
  - [x]2.1 Detects pattern with 3+ same errors
  - [x]2.2 Ignores categories with <3 occurrences
  - [x]2.3 Sorts by count descending
  - [x]2.4 Returns empty for no failures

## Dev Notes

### FailurePattern interface
```typescript
export interface FailurePattern {
  category: string;
  occurrenceCount: number;
  affectedStories: string[];
  lastOccurrence: string;
  suggestedAction: string;
}
```

### References
- [Source: packages/core/src/session-learning.ts] — SessionLearning type
- [Source: packages/core/src/learning-store.ts] — LearningStore.list()

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6
### Completion Notes List
- Created `learning-patterns.ts` with `detectPatterns()` — groups errors by category, filters 3+, sorts desc
- `FailurePattern` interface: category, occurrenceCount, affectedStories, lastOccurrence, suggestedAction
- `suggestAction()` maps error categories to human-readable recommendations
- 7 new tests: detection, threshold, sorting, no failures, empty, dedup, lastOccurrence
- Core suite hits **1400 tests** milestone! 0 failures
### Change Log
- 2026-03-18: Story 12.2 — detectPatterns() + FailurePattern + 7 tests
### File List
**New files:**
- `packages/core/src/learning-patterns.ts`
- `packages/core/src/__tests__/learning-patterns.test.ts`
**Modified:**
- `packages/core/src/index.ts` — exported detectPatterns, FailurePattern
