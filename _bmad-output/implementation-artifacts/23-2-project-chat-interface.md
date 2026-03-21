# Story 23.2: Project Chat Interface

Status: done

## Story
As a **PM**, I want a chat interface where I can ask questions about my project, So that I get answers without navigating multiple screens.

## Acceptance Criteria
1. Chat sidebar panel in dashboard (not separate page)
2. "What's blocking sprint progress?" → specific, data-backed answers from project state
3. Maintains conversation history within session

## Tasks
- [ ] Task 1: Create ChatPanel sidebar component
- [ ] Task 2: Create API endpoint that feeds project context to LLM
- [ ] Task 3: Stream responses via SSE
- [ ] Task 4: Write tests + validate

## Dev Notes
### Depends on: Story 23.1 (project context aggregator)
### Requires: LLM API integration (Claude API or configured agent)

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
