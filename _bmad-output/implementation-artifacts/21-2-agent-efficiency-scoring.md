# Story 21.2: Agent Efficiency Scoring

Status: done

## Story
As a **tech lead**, I want efficiency scores per agent (tokens per story point), So that I can optimize agent configuration.

## Acceptance Criteria
1. Score = tokens consumed / story points delivered, ranked in dashboard
2. Identifies patterns: "Stories in packages/core/ cost 2x more tokens"
3. Data available for assignment optimization (feeds into Epic 2 smart assignment)

## Tasks
- [ ] Task 1: Compute efficiency score from token + story point data
- [ ] Task 2: Display agent ranking in dashboard
- [ ] Task 3: Identify cost patterns by codebase area
- [ ] Task 4: Write tests + validate

## Dev Notes
### Depends on: Story 21.1 (token tracking data)

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
