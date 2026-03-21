# Story 21.3: Sprint Clock Countdown

Status: done

## Story
As a **PM**, I want a visual countdown showing sprint time remaining vs estimated remaining work, So that I instantly see if we're on track.

## Acceptance Criteria
1. Shows: "Sprint ends in 2d 14h. Remaining work: 3d 2h. STATUS: BEHIND by 12h"
2. Color-coded: green (on track), amber (tight), red (behind)
3. Updates in real-time as stories complete

## Tasks
- [ ] Task 1: Parse sprint dates from sprint-status.yaml
- [ ] Task 2: Estimate remaining work from story count + velocity
- [ ] Task 3: Create SprintClock component with time-vs-work gap
- [ ] Task 4: Write tests + validate

## Dev Notes
### Source Files
- `packages/web/src/components/` — SprintClock component
- Sprint dates from sprint-status.yaml metadata

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
