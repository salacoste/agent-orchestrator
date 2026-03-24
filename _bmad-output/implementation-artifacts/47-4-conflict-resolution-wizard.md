# Story 47.4: Conflict Resolution Wizard — AI Merge Suggestion

Status: done

## Story

As a developer facing a merge conflict between agents,
I want an AI-assisted resolution suggestion,
so that I can resolve conflicts faster.

## Acceptance Criteria

1. `analyzeConflict(base, versionA, versionB)` produces a 3-way diff summary
2. If API key available, `suggestMerge()` generates AI-suggested resolution
3. Without API key, returns diff only (no AI suggestion)
4. Resolution options: accept suggestion, choose A, choose B
5. Conflict analyzer is a pure function (testable)
6. Tests verify diff analysis, resolution options, and no-key fallback

## Tasks / Subtasks

- [ ] Task 1: Create conflict analyzer (AC: #1, #5)
  - [ ] 1.1: Create `packages/core/src/conflict-wizard.ts`
  - [ ] 1.2: `analyzeConflict(base, versionA, versionB)` → diff summary
  - [ ] 1.3: Compute: lines added/removed per version, overlap regions
  - [ ] 1.4: Return `ConflictAnalysis` with sections changed by each agent
- [ ] Task 2: Create merge suggestion interface (AC: #2, #3, #4)
  - [ ] 2.1: `MergeResolution` type: accept-ai | choose-a | choose-b | custom
  - [ ] 2.2: `suggestMerge(analysis, apiKey?)` → suggestion or null (no key)
  - [ ] 2.3: Without API key, returns null (graceful degradation)
- [ ] Task 3: Write tests (AC: #6)
  - [ ] 3.1: Test diff analysis with overlapping changes
  - [ ] 3.2: Test resolution option types
  - [ ] 3.3: Test no-key returns null suggestion
  - [ ] 3.4: Test identical versions produce no-conflict result

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
conflict-wizard.ts (pure — no I/O except optional AI call)
  ├── analyzeConflict(base, versionA, versionB) → ConflictAnalysis
  ├── suggestMerge(analysis, apiKey?) → MergeSuggestion | null
  └── Types: ConflictAnalysis, MergeSuggestion, ResolutionOption
```

### Interfaces

```typescript
interface ConflictAnalysis {
  hasConflict: boolean;
  baseLines: number;
  linesChangedA: number;
  linesChangedB: number;
  overlapping: boolean;  // Both agents changed the same lines
  summary: string;
}

type ResolutionOption = "accept-ai" | "choose-a" | "choose-b" | "custom";

interface MergeSuggestion {
  merged: string;         // AI-suggested merged content
  explanation: string;    // Why this merge was chosen
  confidence: number;     // 0-1
}
```

### Diff Analysis (No External Deps)

Simple line-by-line comparison:
- Split base/A/B by newlines
- Compare A-vs-base and B-vs-base
- Overlap = both changed the same line index

### AI Suggestion (Optional)

The `suggestMerge` function signature accepts `apiKey` but the actual LLM call is a stub that returns null. Real AI integration would be a future enhancement. This story focuses on the analysis and resolution structure.

### Anti-Patterns

- Do NOT add Anthropic SDK as dependency — stub the AI call
- Do NOT block on AI response — return null immediately when no key

### Files to Create

1. `packages/core/src/conflict-wizard.ts` (new)
2. `packages/core/src/__tests__/conflict-wizard.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.4] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
