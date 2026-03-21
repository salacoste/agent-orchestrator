# Story 23.1: Project Context Aggregator

Status: done

## Story
As a **developer**, I want the system to aggregate artifact graph, event log, and sprint state into coherent context, So that the conversational interface has complete project knowledge.

## Acceptance Criteria
1. Produces structured summary: phase, artifacts, sprint status, agent states, recent events
2. Summary fits within <8K tokens
3. Updates incrementally as state changes

## Tasks
- [ ] Task 1: Aggregate data from artifact graph + sprint status + agent registry
- [ ] Task 2: Format as structured context document
- [ ] Task 3: Implement token-budget-aware truncation
- [ ] Task 4: Write tests + validate

## Dev Notes
### Consumes: artifact graph (Story 16.4), sprint-status.yaml, session manager data

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
