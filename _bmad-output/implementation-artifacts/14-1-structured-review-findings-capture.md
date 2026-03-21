# Story 14.1: Structured Review Findings Capture

Status: ready-for-dev

## Story

As a Developer,
I want code review findings captured in structured format,
so that review data feeds into the learning system.

## Acceptance Criteria

1. **Findings stored in JSONL** — Each finding appended to `review-findings.jsonl` with storyId, agentId, severity, category, description, file, resolution (AC1)
2. **Session learning updated** — `reviewFindingsCount` and `reviewSeverities` added to learning record on capture (AC2)
3. **ReviewFinding type defined** — Exported from @composio/ao-core (AC3)

## Tasks / Subtasks

- [ ] Task 1: Define ReviewFinding type + store (AC: 1, 3)
  - [ ] 1.1 Add `ReviewFinding` interface to types.ts
  - [ ] 1.2 Create `review-findings-store.ts` — JSONL append with `store()`, `list()`, `query()`, `start()`
  - [ ] 1.3 Export from index.ts

- [ ] Task 2: Tests (AC: 1-3)
  - [ ] 2.1 Store appends to JSONL
  - [ ] 2.2 Query by storyId, agentId, severity
  - [ ] 2.3 Type shape validation

## Dev Notes

### ReviewFinding interface
```typescript
export interface ReviewFinding {
  findingId: string;
  storyId: string;
  agentId: string;
  severity: "high" | "medium" | "low";
  category: string;        // "type-safety", "input-guard", "test-quality", etc.
  description: string;
  file?: string;
  resolution: "fixed" | "accepted" | "deferred";
  capturedAt: string;
}
```

### Follow LearningStore pattern

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Completion Notes List
### Change Log
### File List
