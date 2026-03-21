# Story 18.3: Structured Help Request Protocol

Status: done

## Story

As a **developer**,
I want agents to raise formal help requests with structured choices when stuck,
So that I get clear decision points instead of vague "blocked" states.

## Acceptance Criteria

1. **AC1: HelpRequest type defined**
   - **Given** the core types system
   - **When** help request support is added
   - **Then** `HelpRequest` interface exists with: question, options (A/B/C), context per option
   - **And** stored in session metadata as structured JSON

2. **AC2: Dashboard surfaces help requests prominently**
   - **Given** an agent session with a pending help request
   - **When** the dashboard displays the session
   - **Then** the help request shows prominently with clickable option buttons
   - **And** clicking an option records the choice

3. **AC3: Human choice passed back to agent context**
   - **Given** a human selects an option
   - **When** the agent is resumed
   - **Then** the selected option is included in the resume context

## Tasks / Subtasks

- [ ] Task 1: Define HelpRequest type in core types.ts
- [ ] Task 2: Add helpRequest field to session metadata
- [ ] Task 3: Display help request in AgentSessionCard with option buttons
- [ ] Task 4: Record choice and pass to resume context
- [ ] Task 5: Write tests
- [ ] Task 6: Validate

## Dev Notes

### Key Insight: `blockReason` field already exists in AgentSessionCard UI but is always undefined
The UI scaffolding is partially ready. Story 18.3 populates it with structured data.

### Source Files
- `packages/core/src/types.ts` — add HelpRequest interface
- `packages/core/src/metadata.ts` — store helpRequest in metadata
- `packages/web/src/components/AgentSessionCard.tsx` — render help request UI
- `packages/cli/src/commands/resume.ts` — pass choice to agent

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
