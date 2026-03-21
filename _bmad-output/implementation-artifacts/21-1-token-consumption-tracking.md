# Story 21.1: Token Consumption Tracking

Status: done

## Story
As a **tech lead**, I want real-time token consumption per agent, story, and sprint, So that I can monitor AI costs.

## Acceptance Criteria
1. Dashboard shows tokens used per active agent, cumulative per story, total per sprint
2. Burn rate (tokens/minute) and projected sprint cost displayed
3. Flags runaway agents consuming >3x average

## Tasks
- [ ] Task 1: Define token tracking data model
- [ ] Task 2: Capture token usage from agent sessions
- [ ] Task 3: Display cost dashboard component
- [ ] Task 4: Implement runaway agent detection
- [ ] Task 5: Write tests + validate

## Dev Notes
### Source Files
- `packages/core/src/` — token tracking service
- `packages/web/src/components/` — cost dashboard panel

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
