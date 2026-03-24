# Story 47.3: NLU Orchestration — Natural Language Commands

Status: done

## Story

As a user who prefers talking to clicking,
I want to type natural language commands in the dashboard,
so that I can orchestrate agents conversationally.

## Acceptance Criteria

1. Pattern matching (not LLM) parses common commands: spawn, kill, status, resume, list
2. Each parsed command maps to a CLI/API action with extracted parameters
3. Ambiguous input returns 2-3 suggested interpretations
4. Unrecognized commands return fallback suggestion
5. NLU parser is a pure function (testable without side effects)
6. Tests verify intent parsing, parameter extraction, ambiguity, and fallback

## Tasks / Subtasks

- [ ] Task 1: Create NLU intent parser (AC: #1, #2, #5)
  - [ ] 1.1: Create `packages/core/src/nlu-parser.ts`
  - [ ] 1.2: Define `Intent` type with action, parameters, confidence
  - [ ] 1.3: Pattern-based parsing for: spawn, kill, status, resume, list, show
  - [ ] 1.4: Extract parameters: story ID, agent ID, project name from input
- [ ] Task 2: Handle ambiguity and fallback (AC: #3, #4)
  - [ ] 2.1: Return multiple intents when ambiguous (sorted by confidence)
  - [ ] 2.2: Return fallback intent for unrecognized input
- [ ] Task 3: Write tests (AC: #6)
  - [ ] 3.1: Test each command type parses correctly
  - [ ] 3.2: Test parameter extraction
  - [ ] 3.3: Test ambiguous input returns multiple suggestions
  - [ ] 3.4: Test fallback for unknown commands

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
nlu-parser.ts (pure — no I/O, no LLM)
  ├── Intent: { action, params, confidence, description }
  ├── parseCommand(input) → Intent[]
  └── Pattern rules: keyword + context extraction
```

### Intent Interface

```typescript
interface NLUIntent {
  action: "spawn" | "kill" | "status" | "resume" | "list" | "show" | "fallback";
  params: Record<string, string>;  // { storyId?, agentId?, projectId? }
  confidence: number;              // 0-1
  description: string;             // Human-readable: "Spawn agent for story auth"
}
```

### Pattern Rules

```
"spawn.*(?:for|on)?\s+(\S+)" → { action: "spawn", params: { storyId: $1 } }
"kill\s+(\S+)"                → { action: "kill", params: { agentId: $1 } }
"status"                      → { action: "status", params: {} }
"resume\s+(\S+)"              → { action: "resume", params: { agentId: $1 } }
"(?:list|show)\s+(\w+)"       → { action: "list", params: { type: $1 } }
"blocked"                     → { action: "show", params: { filter: "blocked" } }
```

### Anti-Patterns

- Do NOT use LLM for parsing — pattern matching only (per AC)
- Do NOT add UI integration — parser only (command palette wiring is separate)

### Files to Create

1. `packages/core/src/nlu-parser.ts` (new)
2. `packages/core/src/__tests__/nlu-parser.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.3] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
