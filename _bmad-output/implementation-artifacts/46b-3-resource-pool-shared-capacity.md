# Story 46b.3: Resource Pool — Shared Agent Capacity

Status: done

## Story

As a team running multiple projects,
I want shared agent capacity across projects with per-project limits,
so that one project can't starve others of resources.

## Acceptance Criteria

1. `resourcePool` config: `{ total: N, projects: { projectId: limit } }`
2. When a project's running agents reach its limit, new spawns are queued
3. `GET /api/resources` returns pool state with per-project usage
4. If no resourcePool configured, behavior is unchanged (unlimited)
5. Resource pool manager is testable without side effects
6. Tests verify limits, queuing, pool state API, and unlimited fallback

## Tasks / Subtasks

- [ ] Task 1: Create resource pool manager (AC: #1, #2, #4, #5)
  - [ ] 1.1: Create `packages/core/src/resource-pool.ts`
  - [ ] 1.2: `canSpawn(projectId)` checks per-project and total limits
  - [ ] 1.3: `acquire(projectId)` reserves a slot, `release(projectId)` frees it
  - [ ] 1.4: `getState()` returns per-project usage and totals
  - [ ] 1.5: When no config, all checks return true (unlimited)
- [ ] Task 2: Add config schema (AC: #1)
  - [ ] 2.1: Add `resourcePool` optional object to config schema
- [ ] Task 3: Create resources API route (AC: #3)
  - [ ] 3.1: Create `GET /api/resources` returning pool state
- [ ] Task 4: Write tests (AC: #6)
  - [ ] 4.1: Test per-project limits
  - [ ] 4.2: Test total pool limit
  - [ ] 4.3: Test acquire/release flow
  - [ ] 4.4: Test unlimited when no config
  - [ ] 4.5: Test API route

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[x]` = 100% complete

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture

```
resource-pool.ts (core)
  ├── createResourcePool(config?) → ResourcePool
  ├── canSpawn(projectId) → boolean
  ├── acquire(projectId) → boolean (reserves slot)
  ├── release(projectId) → void (frees slot)
  └── getState() → PoolState

API route
  └── GET /api/resources → pool state JSON
```

### Interfaces

```typescript
interface ResourcePoolConfig {
  total: number;
  projects: Record<string, number>;  // projectId → max agents
}

interface PoolState {
  total: { used: number; max: number | null };
  projects: Record<string, { used: number; max: number | null }>;
}
```

### Config Schema

```typescript
resourcePool: z.object({
  total: z.number().int().positive(),
  projects: z.record(z.number().int().positive()),
}).optional(),
```

### Integration with Spawn Queue (Story 43.3)

The resource pool is checked BEFORE enqueuing a spawn. If `canSpawn()` returns false, the spawn is queued (existing mechanism). The pool doesn't manage the queue — it only manages capacity slots.

### Files to Create

1. `packages/core/src/resource-pool.ts` (new)
2. `packages/core/src/__tests__/resource-pool.test.ts` (new)
3. `packages/web/src/app/api/resources/route.ts` (new)
4. `packages/web/src/app/api/resources/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/config.ts` — add resourcePool schema
2. `packages/core/src/index.ts` — export

### References

- [Source: packages/core/src/spawn-queue.ts] — existing queue mechanism
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 46b.3] — requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
