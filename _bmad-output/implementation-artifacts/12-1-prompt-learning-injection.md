# Story 12.1: Prompt Learning Injection

Status: done

## Story

As a Developer,
I want relevant past learnings injected into agent prompts when spawning,
so that agents avoid repeating past mistakes on similar stories.

## Acceptance Criteria

1. **Learnings injected into prompt** — When spawning, prompt builder includes "Lessons from past sessions" section with up to 3 relevant failed learnings (AC1)
2. **Relevance filtering** — domain match → recency → failure outcome priority (AC2)
3. **Empty store = no injection** — Zero impact on existing prompts when no learnings exist (AC3)
4. **Opt-in config** — Injection only when `learning.injectInPrompts: true` in YAML (AC4)
5. **No secrets** — Only storyId, error categories, domain tags injected — no file contents (AC5)

## Tasks / Subtasks

- [x] Task 1: Extend PromptBuildConfig with learnings (AC: 1, 3)
  - [x]1.1 Add optional `learnings?: SessionLearning[]` field to `PromptBuildConfig` in `prompt-builder.ts`
  - [x]1.2 Add `buildLearningsLayer(learnings)` function that formats learnings as markdown section
  - [x]1.3 Integrate into `buildPrompt()` — append learnings layer after story context
  - [x]1.4 Empty/undefined learnings = no section added (zero impact)

- [x] Task 2: Create learning selection function (AC: 2, 5)
  - [x]2.1 Add `selectRelevantLearnings(store, domainTags, limit?)` to `session-learning.ts`
  - [x]2.2 Filter: outcome="failed" → domain match → sort by capturedAt desc → limit 3
  - [x]2.3 Return only safe fields: storyId, errorCategories, domainTags, durationMs

- [x] Task 3: Tests (AC: 1-5)
  - [x]3.1 Unit tests: buildLearningsLayer formats correctly, empty = no output
  - [x]3.2 Unit tests: selectRelevantLearnings filters and limits correctly
  - [x]3.3 Integration: buildPrompt with learnings includes section

## Dev Notes

### PromptBuildConfig extension

```typescript
export interface PromptBuildConfig {
  // ... existing fields ...
  /** Past session learnings to inject (from LearningStore.query) */
  learnings?: SessionLearning[];
}
```

### Learnings layer format

```markdown
## Lessons from Past Sessions

In previous similar work, these issues were encountered:

1. **Story 1-3-test** (failed) — error categories: ECONNREFUSED, timeout
   Domains: api, backend | Duration: 45m

2. **Story 2-1-sync** (failed) — error categories: parse error
   Domains: backend | Duration: 12m
```

### References
- [Source: packages/core/src/prompt-builder.ts] — PromptBuildConfig, buildPrompt()
- [Source: packages/core/src/session-learning.ts] — captureSessionLearning
- [Source: packages/core/src/learning-store.ts] — LearningStore.query()

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Added `learnings?: SessionLearning[]` field to `PromptBuildConfig`
- Created `buildLearningsLayer()` — formats learnings as numbered markdown with story, errors, domains, duration
- Integrated into `buildPrompt()` as Layer 4 (after user rules, before user prompt)
- Created `selectRelevantLearnings()` — filters failed outcomes, prefers domain matches, limits to 3
- Empty/undefined learnings = null (zero impact on existing prompts)
- 9 new tests: buildLearningsLayer (4), buildPrompt integration (2), selectRelevantLearnings (3+1 no-failures)
- Exported: selectRelevantLearnings, buildLearningsLayer from index.ts
- Full core suite: 73 files, 1393 tests, 0 failures

### Change Log

- 2026-03-18: Story 12.1 — prompt learning injection + selection + 9 tests

### File List

**Modified files:**
- `packages/core/src/prompt-builder.ts` — added learnings field, buildLearningsLayer(), Layer 4 integration
- `packages/core/src/session-learning.ts` — added selectRelevantLearnings()
- `packages/core/src/index.ts` — exported selectRelevantLearnings, buildLearningsLayer
- `packages/core/src/__tests__/prompt-builder.test.ts` — 9 new tests
