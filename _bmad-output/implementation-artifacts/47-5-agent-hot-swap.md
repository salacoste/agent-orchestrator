# Story 47.5: Agent Hot-Swap — Replace Running Agent

Status: done

## Story

As a team lead who wants to switch agent types mid-story,
I want to replace a running agent while preserving its work context,
so that I can switch from a fast agent to a careful one without losing progress.

## Acceptance Criteria

1. `buildSwapContext(session)` gathers context from current agent (summary, files, decisions)
2. `SwapPlan` includes: stop current agent, preserve branch/worktree, spawn new agent with context
3. Swap plan is a pure data structure (no execution — execution is handled by orchestrator)
4. Context handoff includes: previous agent summary, files modified, domain tags
5. Tests verify context gathering, plan structure, and handoff data

## Tasks / Subtasks

- [ ] Task 1: Create hot-swap module (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create `packages/core/src/agent-hot-swap.ts`
  - [ ] 1.2: `SwapContext`: previousSummary, filesModified, domainTags, branchName
  - [ ] 1.3: `SwapPlan`: stopAgent, spawnAgent, context, auditEntry
  - [ ] 1.4: `buildSwapPlan(sessionId, newAgentType, context)` → SwapPlan
- [ ] Task 2: Write tests (AC: #5)
  - [ ] 2.1: Test swap plan includes all required fields
  - [ ] 2.2: Test context handoff data
  - [ ] 2.3: Test plan preserves branch/worktree info

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
agent-hot-swap.ts (pure — no I/O)
  ├── SwapContext: { previousSummary, filesModified, domainTags, branchName }
  ├── SwapPlan: { stopSessionId, newAgentType, context, projectId, storyId }
  └── buildSwapPlan(sessionId, newAgentType, context) → SwapPlan
```

### Key Design

- **Declarative plan only** — no execution (orchestrator handles stop/spawn)
- Context is a data handoff — new agent receives previous agent's learnings
- Branch and worktree preserved — new agent continues on same code state

### Files to Create

1. `packages/core/src/agent-hot-swap.ts` (new)
2. `packages/core/src/__tests__/agent-hot-swap.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.5] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
