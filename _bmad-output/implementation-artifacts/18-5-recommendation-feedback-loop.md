# Story 18.5: Recommendation Feedback Loop

Status: done

## Story

As a **PM**,
I want the system to track which recommendations I accept vs dismiss,
So that suggestions improve over time.

## Acceptance Criteria

1. **AC1: Accept/dismiss actions on recommendations**
   - **Given** a recommendation displayed in the AI Guide panel
   - **When** I interact with it
   - **Then** I can accept (follow the suggestion) or dismiss (skip it)

2. **AC2: Decisions logged persistently**
   - **Given** an accept or dismiss action
   - **When** the decision is recorded
   - **Then** it's stored in a JSONL file with: recommendation type, phase, action, timestamp

3. **AC3: Frequently-dismissed types deprioritized**
   - **Given** accumulated feedback data
   - **When** recommendations are generated
   - **Then** types dismissed >3 times in a row have their tier lowered or are suppressed

4. **AC4: Functions independently of Cycle 3 learning store**
   - **Given** the feedback system
   - **When** deployed without Cycle 3 features
   - **Then** it works standalone using its own JSONL storage

## Tasks / Subtasks

- [ ] Task 1: Add accept/dismiss buttons to WorkflowAIGuide
  - [ ] 1.1: Small icon buttons (✓ accept, ✗ dismiss) on recommendation panel
  - [ ] 1.2: Record action via API endpoint
- [ ] Task 2: Create feedback storage
  - [ ] 2.1: JSONL file at `_bmad-output/.recommendation-feedback.jsonl`
  - [ ] 2.2: API endpoint to record feedback
- [ ] Task 3: Integrate feedback into recommendation scoring
  - [ ] 3.1: Read feedback history when generating recommendations
  - [ ] 3.2: Deprioritize frequently-dismissed recommendation types
- [ ] Task 4: Write tests
- [ ] Task 5: Validate

## Dev Notes

### Key Design: Own JSONL, not shared with learning store
Per AC4 and FR-WF-30, this system is independent. Uses `_bmad-output/.recommendation-feedback.jsonl`.

### Source Files
- `packages/web/src/components/WorkflowAIGuide.tsx` — add accept/dismiss buttons
- `packages/web/src/app/api/workflow/` — new feedback endpoint
- `packages/web/src/lib/workflow/` — feedback storage + scoring integration

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
