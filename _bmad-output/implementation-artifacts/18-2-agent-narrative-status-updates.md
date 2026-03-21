# Story 18.2: Agent Narrative Status Updates

Status: done

## Story

As a **tech lead**,
I want agents to emit narrative status updates alongside enum states,
So that I understand what agents are actually doing.

## Acceptance Criteria

1. **AC1: Narrative field added to session metadata**
   - **Given** the existing SessionMetadata with enum-only status
   - **When** narrative support is added
   - **Then** a `narrative` field stores human-readable description (e.g., "Implementing auth endpoint. Working on test suite.")
   - **And** the existing `summary` metadata field is repurposed or `narrative` is added alongside

2. **AC2: Narratives displayed in agent session cards**
   - **Given** an agent session with a narrative
   - **When** the dashboard renders the AgentSessionCard
   - **Then** the narrative text appears below the status enum
   - **And** narratives supplement (not replace) the existing status enum display

3. **AC3: Backward compatible**
   - **Given** sessions without narrative data
   - **When** displayed
   - **Then** only the enum status shows (no errors, no empty narrative section)

## Tasks / Subtasks

- [ ] Task 1: Extend session metadata with narrative field
  - [ ] 1.1: Add `narrative` to SessionMetadata fields in types.ts (or reuse existing `summary`)
  - [ ] 1.2: Add narrative to metadata read/write in metadata.ts
- [ ] Task 2: Display narrative in AgentSessionCard
  - [ ] 2.1: Render narrative text below status in AgentSessionCard.tsx
  - [ ] 2.2: Handle missing narrative gracefully
- [ ] Task 3: Write tests
- [ ] Task 4: Validate (`pnpm test`, `pnpm build`)

## Dev Notes

### Key Insight: `summary` field already exists in metadata but is unused
Reuse `summary` field as the narrative carrier. No schema change needed — just populate and display it.

### Source Files
- `packages/core/src/types.ts` — SessionMetadata (summary field exists)
- `packages/core/src/metadata.ts` — read/write functions
- `packages/web/src/components/AgentSessionCard.tsx` — UI display

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
