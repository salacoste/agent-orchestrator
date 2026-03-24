# Story 46b.4: Agent Isolation Levels

Status: done

## Story

As a security-conscious team,
I want to configure isolation levels for agent sessions,
so that sensitive projects get stronger sandboxing.

## Acceptance Criteria

1. `isolation: shared | isolated | quarantined` configurable per project
2. "shared" is default (current behavior — shared worktree directory)
3. "isolated" gives agent its own worktree with no cross-project access
4. "quarantined" adds: no git push, read-only shared resources
5. `GET /api/agent/{id}` includes isolation level in response
6. Isolation level resolver is a pure function
7. Tests verify config schema, level resolution, and API response

## Tasks / Subtasks

- [ ] Task 1: Create isolation level types and resolver (AC: #1, #2, #6)
  - [ ] 1.1: Create `packages/core/src/isolation-levels.ts`
  - [ ] 1.2: Define `IsolationLevel` type and `IsolationPolicy` interface
  - [ ] 1.3: `resolveIsolation(projectConfig)` returns policy for the project
  - [ ] 1.4: Default to "shared" when not configured
- [ ] Task 2: Add config schema (AC: #1)
  - [ ] 2.1: Add `isolation` field to project config schema
- [ ] Task 3: Create isolation policy details (AC: #3, #4)
  - [ ] 3.1: Define permissions for each level: shared, isolated, quarantined
  - [ ] 3.2: Policy includes: ownWorktree, gitPushAllowed, networkAccess, crossProjectAccess
- [ ] Task 4: Write tests (AC: #7)
  - [ ] 4.1: Test config schema accepts valid isolation levels
  - [ ] 4.2: Test resolveIsolation with each level
  - [ ] 4.3: Test default is "shared"
  - [ ] 4.4: Test policy permissions for each level

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
isolation-levels.ts (pure — no I/O)
  ├── IsolationLevel = "shared" | "isolated" | "quarantined"
  ├── IsolationPolicy = { ownWorktree, gitPushAllowed, networkAccess, crossProjectAccess }
  └── resolveIsolation(projectConfig) → IsolationPolicy
```

### IsolationPolicy

```typescript
interface IsolationPolicy {
  level: IsolationLevel;
  ownWorktree: boolean;        // isolated, quarantined: true
  gitPushAllowed: boolean;     // quarantined: false
  networkAccess: boolean;      // quarantined: false
  crossProjectAccess: boolean; // shared: true, others: false
}
```

| Level | ownWorktree | gitPush | network | crossProject |
|-------|-------------|---------|---------|--------------|
| shared | false | true | true | true |
| isolated | true | true | true | false |
| quarantined | true | false | false | false |

### Config Schema

Add to ProjectConfigSchema:
```typescript
isolation: z.enum(["shared", "isolated", "quarantined"]).default("shared"),
```

### Anti-Patterns

- Do NOT enforce isolation at runtime — this story defines policy, enforcement is future
- Do NOT modify workspace plugins — policy is declarative only

### Files to Create

1. `packages/core/src/isolation-levels.ts` (new)
2. `packages/core/src/__tests__/isolation-levels.test.ts` (new)

### Files to Modify

1. `packages/core/src/config.ts` — add isolation to project schema
2. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 46b.4] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
