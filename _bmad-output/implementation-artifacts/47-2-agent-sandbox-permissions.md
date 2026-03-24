# Story 47.2: Agent Sandbox — Permission Boundaries

Status: done

## Story

As a security administrator,
I want per-story permission boundaries for agents,
so that an agent working on a UI story can't modify database schemas.

## Acceptance Criteria

1. Sandbox config with `allowedPaths` and `deniedPaths` (glob patterns)
2. `checkAccess(filePath, sandbox)` returns allowed/denied with reason
3. Default sandbox: allow all (opt-in restriction)
4. Configurable per project, overridable per story
5. Sandbox checker is a pure function
6. Tests verify glob matching, deny overrides allow, default allow-all

## Tasks / Subtasks

- [ ] Task 1: Create sandbox checker (AC: #1, #2, #3, #5)
  - [ ] 1.1: Create `packages/core/src/agent-sandbox.ts`
  - [ ] 1.2: `SandboxConfig`: allowedPaths, deniedPaths (glob arrays)
  - [ ] 1.3: `checkAccess(filePath, config)` → { allowed, reason }
  - [ ] 1.4: Deny takes priority over allow (explicit deny wins)
  - [ ] 1.5: Empty config = allow all
- [ ] Task 2: Write tests (AC: #6)
  - [ ] 2.1: Test allowed paths match
  - [ ] 2.2: Test denied paths block
  - [ ] 2.3: Test deny overrides allow
  - [ ] 2.4: Test default allow-all
  - [ ] 2.5: Test glob patterns

## Task Completion Validation

- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
agent-sandbox.ts (pure — no I/O)
  ├── SandboxConfig: { allowedPaths: string[], deniedPaths: string[] }
  ├── AccessResult: { allowed: boolean, reason: string }
  └── checkAccess(filePath, config?) → AccessResult
```

### Glob Matching

Use simple glob matching without external dependencies:
```typescript
// Convert glob to regex: "src/components/**" → /^src\/components\/.*$/
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  return new RegExp(`^${withWildcards}$`);
}
```

### Priority Rules

1. If `deniedPaths` matches → DENIED (always wins)
2. If `allowedPaths` is empty → ALLOWED (no restrictions)
3. If `allowedPaths` matches → ALLOWED
4. If `allowedPaths` is non-empty and doesn't match → DENIED

### Files to Create

1. `packages/core/src/agent-sandbox.ts` (new)
2. `packages/core/src/__tests__/agent-sandbox.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` — export

### References

- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 47.2] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
