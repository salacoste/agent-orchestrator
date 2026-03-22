# Story 42.1: Shared Annotation UI Component

Status: ready-for-dev

## Story

As a team member reviewing artifacts in the dashboard,
I want to add inline annotations (comments) to artifacts,
so that team feedback is captured directly in the workflow view.

## Acceptance Criteria

1. An `ArtifactAnnotation` component renders an annotation input when clicked
2. Annotations include author, text, timestamp, and artifact reference
3. Annotations are stored via the collaboration module's decision log (reusing existing infrastructure)
4. Existing annotations are displayed inline with the artifact
5. Tests verify annotation creation, display, and storage integration

## Tasks / Subtasks

- [ ] Task 1: Create annotation data types and store (AC: #2, #3)
  - [ ] 1.1: Define `Annotation` interface in collaboration module
  - [ ] 1.2: Add `addAnnotation()` and `getAnnotations(artifactId)` functions
  - [ ] 1.3: Annotations persisted via collaboration broadcasting (reuses 39.1/39.2)
- [ ] Task 2: Create ArtifactAnnotation React component (AC: #1, #4)
  - [ ] 2.1: Component shows "Add comment" button that expands to text input
  - [ ] 2.2: Submit creates annotation via `addAnnotation()`
  - [ ] 2.3: Display existing annotations inline with author + timestamp
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test annotation store functions (add, get, filter by artifact)
  - [ ] 3.2: Test component renders annotations and input
  - [ ] 3.3: Test submit creates annotation

## Dev Notes

### Architecture Constraints

- **Reuse collaboration module** — annotations are a specialization of decisions. Store in collaboration.ts alongside existing presence/claims/decisions.
- **Client component** — annotation UI is interactive ("use client")
- **No new API routes needed** — annotations stored in-memory + JSONL via existing 39.1/39.2 infrastructure

### Files to Create/Modify

1. `packages/web/src/lib/workflow/collaboration.ts` (modify — add annotation functions)
2. `packages/web/src/components/ArtifactAnnotation.tsx` (new — React component)
3. `packages/web/src/lib/workflow/__tests__/collaboration-annotations.test.ts` (new)
4. `packages/web/src/components/__tests__/ArtifactAnnotation.test.tsx` (new)

### References

- [Source: packages/web/src/lib/workflow/collaboration.ts] — existing collaboration module
- [Source: _bmad-output/planning-artifacts/epics-cycle-8.md#Story-42.1] — epic spec

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
