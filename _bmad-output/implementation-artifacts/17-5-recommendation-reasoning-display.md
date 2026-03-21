# Story 17.5: Recommendation Reasoning Display

Status: done

## Story

As a **PM**,
I want every recommendation to show its reasoning,
So that I understand and trust the system's suggestions.

## Acceptance Criteria

1. **AC1: Reasoning displayed below recommendation**
   - **Given** a recommendation with reasoning data (from Story 17.3)
   - **When** I view the AI Guide panel
   - **Then** I see the reasoning: a list of conditions checked with pass/fail indicators

2. **AC2: Pass/fail checklist format**
   - **Given** a recommendation with satisfied and unsatisfied guards
   - **When** reasoning is displayed
   - **Then** each guard shows: checkmark (✅) for satisfied, cross (❌) for unsatisfied
   - **And** guard description is human-readable

3. **AC3: Expandable reasoning (progressive disclosure)**
   - **Given** the reasoning section
   - **When** the user first sees the recommendation
   - **Then** reasoning is collapsed by default (showing only the recommendation text)
   - **And** clicking "Show reasoning" expands to reveal the full guard checklist

4. **AC4: Accessible reasoning display**
   - **Given** the reasoning section
   - **When** accessed by screen reader
   - **Then** pass/fail status is announced (not just color-coded)
   - **And** the expand/collapse is keyboard accessible

## Tasks / Subtasks

- [ ] Task 1: Add reasoning display to WorkflowAIGuide (AC: #1, #2)
  - [ ] 1.1: Render reasoning section when `recommendation.blockers` or `recommendation.reasoning` exists
  - [ ] 1.2: Show each guard with pass/fail icon + description
  - [ ] 1.3: Style: green checkmarks for satisfied, red crosses for unsatisfied

- [ ] Task 2: Add expand/collapse behavior (AC: #3)
  - [ ] 2.1: Default collapsed — "Show reasoning" link/button
  - [ ] 2.2: On click, expand to reveal guard checklist
  - [ ] 2.3: Use React state (no external libraries)

- [ ] Task 3: Accessibility (AC: #4)
  - [ ] 3.1: Add `aria-expanded` to toggle button
  - [ ] 3.2: Use `aria-controls` linking button to reasoning section
  - [ ] 3.3: Pass/fail icons have sr-only text ("satisfied"/"not satisfied")

- [ ] Task 4: Write tests
  - [ ] 4.1: Test reasoning renders when blockers present
  - [ ] 4.2: Test reasoning hidden when no blockers
  - [ ] 4.3: Test expand/collapse toggle
  - [ ] 4.4: Test accessibility attributes

- [ ] Task 5: Validate
  - [ ] 5.1: `pnpm test` — all pass
  - [ ] 5.2: `pnpm build` — succeeds

## Dev Notes

### Depends on Story 17.3

Story 17.3 adds `reasoning` and `blockers` fields to the `Recommendation` type. Story 17.5 RENDERS those fields. If 17.3 isn't done first, use mock data for development.

### Component Enhancement Pattern

```tsx
// In WorkflowAIGuide.tsx — after the recommendation text
{recommendation.blockers && recommendation.blockers.length > 0 && (
  <details className="mt-3">
    <summary className="text-[11px] text-[var(--color-text-muted)] cursor-pointer">
      Show reasoning ({recommendation.blockers.length} checks)
    </summary>
    <ul className="mt-2 space-y-1">
      {recommendation.blockers.map(b => (
        <li key={b.guardId} className="text-[11px] flex items-center gap-1.5">
          <span aria-hidden="true">{b.satisfied ? "✅" : "❌"}</span>
          <span className="sr-only">{b.satisfied ? "Satisfied" : "Not satisfied"}:</span>
          {b.description}
        </li>
      ))}
    </ul>
  </details>
)}
```

Using `<details>/<summary>` gives us expand/collapse with ZERO JavaScript and built-in keyboard accessibility.

### Source Tree Components to Touch

| File | Action |
|------|--------|
| `packages/web/src/components/WorkflowAIGuide.tsx` | MODIFY — add reasoning section |
| `packages/web/src/components/__tests__/WorkflowAIGuide.test.tsx` | ADD reasoning tests |

### References

- [Source: packages/web/src/components/WorkflowAIGuide.tsx] — Component to enhance
- [Source: packages/web/src/lib/workflow/types.ts] — Recommendation type (extended in 17.3)
- [Source: epics-cycle-3-4.md#Epic 6b, Story 6b.5] — Requirements

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
