# Story 25a.2: JSONL Recommendation Feedback Persistence

Status: done

## Story
As a **PM**, I want recommendation feedback persisted to disk, So that accept/dismiss decisions survive page reloads.

## Acceptance Criteria
1. POST /api/workflow/feedback appends entry to _bmad-output/.recommendation-feedback.jsonl
2. GET /api/workflow/feedback reads all entries from JSONL file
3. recordFeedback() in client module also POSTs to API (fire-and-forget)
4. Missing directory/file handled gracefully

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6 (1M context)
### File List
- `packages/web/src/app/api/workflow/feedback/route.ts` — CREATED (GET + POST)
- `packages/web/src/lib/workflow/recommendation-feedback.ts` — MODIFIED (added API persistence)
