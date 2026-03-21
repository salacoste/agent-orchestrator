# Story 25a.3: State-Machine Recommendation Full Integration

Status: done

## Story
As a **developer**, I want all recommendation consumers to have reasoning/blockers data, So that the reasoning display always works.

## Acceptance Criteria
1. Legacy 7-rule engine now includes reasoning + blockers in every rule output
2. Both SM and legacy engines produce identical output shape
3. Existing recommendation tests updated for new fields
4. 994 web tests pass

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6 (1M context)
### File List
- `packages/web/src/lib/workflow/recommendation-engine.ts` — MODIFIED (added reasoning+blockers to all 6 legacy rules)
- `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` — MODIFIED (updated output shape test)
