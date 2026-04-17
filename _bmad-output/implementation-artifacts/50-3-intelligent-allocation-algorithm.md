# Story 50.3: Intelligent Allocation Algorithm

Status: done

## Story

As a **project manager**,
I want **the system to intelligently allocate shared agents based on multiple factors**,
So that **the highest-priority work gets resources first without manual intervention**.

## Acceptance Criteria

1. **Given** multiple stories are ready and shared agents are available
   **When** the allocation algorithm runs
   **Then** it considers project priority, story urgency, agent affinity/specialization, and current workload
   **And** produces a ranked list of (story, agent, score) allocations

2. **Given** a story has high urgency and a project has high priority
   **When** the allocation algorithm scores candidates
   **Then** the combined urgency+priority weight produces a higher score than low urgency+priority stories
   **And** the weighting is configurable via `SharedPoolConfig.allocationWeights`

3. **Given** an agent has past success with similar stories (high affinity score)
   **When** the allocation algorithm compares agents for a story
   **Then** the agent with higher affinity receives a higher allocation score
   **And** the affinity score is computed using the existing `scoreAffinity` from `assignment-scorer.ts`

4. **Given** an agent already has active assignments
   **When** the allocation algorithm considers workload
   **Then** agents with fewer active assignments score higher (workload balancing)
   **And** agents at max capacity (per `maxConcurrent`) are excluded from consideration

5. **Given** an agent is reserved for a specific project (Story 50.2)
   **When** the allocation algorithm runs across projects
   **Then** reserved agents are only considered for their owning project's stories
   **And** reserved agents are excluded from cross-project allocation

6. **Given** the allocation algorithm runs with 100 agents across 50 projects
   **When** a typical allocation request is made
   **Then** the allocation decision completes within 500ms

## Tasks / Subtasks

- [x] Task 1: Define allocation types and config extensions (AC: #1, #2)
  - [x] 1.1: Add `UrgencyLevel` type to `packages/core/src/types.ts` (`"critical" | "high" | "normal" | "low"`)
  - [x] 1.2: Add `urgency?: UrgencyLevel` to `StoryState` interface
  - [x] 1.3: Add `urgency?: UrgencyLevel` to `StoryCandidate` interface in `assignment-service.ts`
  - [x] 1.4: Add `priority?: number` to `SharedPoolConfig` (project-level pool priority, default 0)
  - [x] 1.5: Add `allocationWeights?: AllocationWeights` to `SharedPoolConfig`
  - [x] 1.6: Define `AllocationWeights` interface in `types.ts` with optional weight factors (urgency, priority, affinity, workload)
  - [x] 1.7: Add Zod schema for new fields in `packages/core/src/config.ts`
  - [x] 1.8: Define `AllocationRequest`, `AllocationCandidate`, `AllocationDecision` types in new `pool-allocation.ts`

- [x] Task 2: Implement allocation scoring functions (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `packages/core/src/pool-allocation.ts` with pure allocation functions
  - [x] 2.2: Implement `computeUrgencyScore(urgency)` — maps urgency level to 0-1 score
  - [x] 2.3: Implement `computePriorityScore(projectPriority)` — normalizes project priority to 0-1
  - [x] 2.4: Implement `computeWorkloadScore(activeAssignments, maxConcurrent)` — inverse load score
  - [x] 2.5: Implement `computeAllocationScore(candidate, weights, affinityScore, workloadScore)` — weighted sum of all factors
  - [x] 2.6: Define default weights: `{ urgency: 0.3, priority: 0.3, affinity: 0.25, workload: 0.15 }`

- [x] Task 3: Implement main allocation algorithm (AC: #1, #5, #6)
  - [x] 3.1: Implement `allocateAgents(request: AllocationRequest): AllocationDecision[]` — the main entry point
  - [x] 3.2: Filter agents by pool eligibility using `canReceiveAgents` and `getAvailablePoolAgents`
  - [x] 3.3: Exclude reserved agents from cross-project allocation using `isAgentReserved`/`getReservedAgents`
  - [x] 3.4: Exclude agents at max capacity (honor `maxConcurrent`)
  - [x] 3.5: Score each (story, agent) pair using `computeAllocationScore`
  - [x] 3.6: Sort by score descending, break ties by story priority then FIFO position
  - [x] 3.7: Return ranked `AllocationDecision[]` with scores and factor breakdowns

- [x] Task 4: Integrate with existing systems (AC: #3, #5)
  - [x] 4.1: Accept pre-computed affinity scores via `AllocationRequest.affinityScores` Map (caller invokes `scoreAffinity` externally — keeps allocation algorithm pure)
  - [x] 4.2: Accept cross-project stories via `AllocationRequest.stories` (caller fetches stories externally — keeps allocation algorithm pure)
  - [x] 4.3: Use `getPoolProjects` to discover pool-enabled projects (resolvePoolMemberships not needed — getPoolProjects is sufficient)
  - [x] 4.4: Export new functions and types from `packages/core/src/index.ts`

- [x] Task 5: Write tests (AC: #1-6)
  - [x] 5.1: Create `packages/core/src/__tests__/pool-allocation.test.ts`
  - [x] 5.2: Unit tests for `computeUrgencyScore`, `computePriorityScore`, `computeWorkloadScore`
  - [x] 5.3: Unit test for `computeAllocationScore` with known inputs/outputs
  - [x] 5.4: Integration test: `allocateAgents` with multiple stories and agents
  - [x] 5.5: Test: reserved agents excluded from cross-project allocation
  - [x] 5.6: Test: agents at max capacity excluded
  - [x] 5.7: Test: allocation respects project eligibility
  - [x] 5.8: Performance test: allocation completes within 500ms for 100 agents across 50 projects
  - [x] 5.9: Zod schema validation tests for new config fields
  - [x] 5.10: Edge cases: no available agents, no stories, all agents reserved, tied scores

## Task Completion Validation

- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no `expect(true).toBe(true)`)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags

**Methods Used:**
- `canReceiveAgents` — Check cross-project agent eligibility (from shared-pool.ts)
- `getAvailablePoolAgents` — Get non-reserved agents (from shared-pool.ts)
- `getReservedAgents` — Get reserved agents for a project (from shared-pool.ts)
- `isAgentReserved` — Check if agent is reserved (from shared-pool.ts)
- `resolvePoolMemberships` — Resolve pool memberships (from shared-pool.ts)
- `getPoolProjects` — Get pool-enabled projects (from shared-pool.ts)
- `scoreAffinity` — Score agent-story affinity (from assignment-scorer.ts)
- `AffinityScore` — Affinity score type (from assignment-scorer.ts)
- `StoryCandidate` — Story candidate type (from assignment-service.ts)
- `SprintStatusData.priorities` — Story priority data (from assignment-service.ts)

**Feature Flags:**
- None expected — Allocation algorithm is a pure function module, no runtime state changes

## Dependency Review

No new dependencies required. Uses existing:
- Zod for schema validation
- Vitest for testing
- Existing `shared-pool.ts` pool utilities
- Existing `assignment-scorer.ts` affinity scoring
- Existing `assignment-service.ts` story fetching patterns

## Dev Notes

### Architecture Context

This is **Story 3 of 6** in **Epic 50: Shared Agent Pool**. It depends on:
- **Story 50.1 (done):** Shared Pool Configuration — types, schema, pool utilities
- **Story 50.2 (review):** Agent Reservation — reservation functions, config validation

This story creates the **allocation algorithm** — the core decision engine that ranks (story, agent) pairs across projects. Later stories (50.4-50.6) build on this for cross-project assignment execution, utilization tracking, and over-allocation prevention.

### Previous Story Intelligence (50.2: Agent Reservation)

- `SharedPoolConfig` now has 4 fields: `enabled`, `eligibleProjects`, `maxConcurrent`, `reservedAgents`
- 8 utility functions in `shared-pool.ts`: `resolvePoolMemberships`, `validatePoolReferences`, `getEligibleProjects`, `getPoolProjects`, `canReceiveAgents`, `isAgentReserved`, `getReservedAgents`, `getAvailablePoolAgents`
- `canReceiveAgents` accepts optional `agentId` parameter for agent-level checks
- `getAvailablePoolAgents(sourceProjectId, targetProjectId, knownAgents, config)` filters out reserved agents
- `validatePoolReferences` warns on disabled pools with reservedAgents
- 52 core pool tests pass (31 original + 21 reservation), 1555 web tests pass
- All exported from `@composio/ao-core`

### Key Design Decisions

**Pure function architecture:** The allocation algorithm is a set of pure functions — no side effects, no state mutation, no database calls. Input: config + runtime context. Output: ranked allocation decisions. This makes it fully testable and deterministic.

**Scoring formula:** Weighted sum of four factors:
```
allocationScore = (urgencyWeight * urgencyScore) +
                  (priorityWeight * priorityScore) +
                  (affinityWeight * affinityScore) +
                  (workloadWeight * workloadScore)
```

Default weights: `urgency: 0.3, priority: 0.3, affinity: 0.25, workload: 0.15`

**Factor scoring (each 0-1):**
- `urgencyScore`: Maps `"critical"→1.0, "high"→0.75, "normal"→0.5, "low"→0.25, undefined→0.5`
- `priorityScore`: `Math.min(projectPriority / maxPriority, 1)` or `0.5` if undefined
- `affinityScore`: Reuses `scoreAffinity()` from `assignment-scorer.ts` (already 0-1). Falls back to `0.5` when no learning history exists.
- `workloadScore`: `1 - (activeAssignments / maxConcurrent)` or `1 - (activeAssignments / DEFAULT_MAX)` when no max configured

**New file: `pool-allocation.ts`:**
The allocation module is separate from `shared-pool.ts` to maintain single responsibility. `shared-pool.ts` handles pool membership/config; `pool-allocation.ts` handles the allocation decision algorithm.

**Config extension — `allocationWeights`:**
```yaml
projects:
  backend-api:
    sharedPool:
      enabled: true
      eligibleProjects: ["mobile-app", "web-frontend"]
      maxConcurrent: 3
      reservedAgents: ["critical-api-agent"]
      priority: 10  # Higher priority = prefer this project's stories
      allocationWeights:
        urgency: 0.3
        priority: 0.3
        affinity: 0.25
        workload: 0.15
```

**Zod schema extensions:**
```typescript
// On SharedPoolConfigSchema:
priority: z.number().int().min(0).optional(),
allocationWeights: z.object({
  urgency: z.number().min(0).max(1).optional(),
  priority: z.number().min(0).max(1).optional(),
  affinity: z.number().min(0).max(1).optional(),
  workload: z.number().min(0).max(1).optional(),
}).optional(),
```

**Urgency on stories:**
`UrgencyLevel = "critical" | "high" | "normal" | "low"` added to `StoryState.urgency` and `StoryCandidate.urgency`. This is optional — stories without urgency default to `"normal"` (score 0.5).

**New types:**
```typescript
export interface AllocationWeights {
  urgency?: number;    // default 0.3
  priority?: number;   // default 0.3
  affinity?: number;   // default 0.25
  workload?: number;   // default 0.15
}

export interface AllocationRequest {
  config: OrchestratorConfig;
  stories: StoryCandidate[];            // Ready stories across all pool projects
  agentWorkload: Map<string, number>;   // agentId → active assignment count
  learningHistory?: SessionLearning[];  // For affinity scoring (optional)
}

export interface AllocationCandidate {
  storyId: string;
  agentId: string;
  projectId: string;
  score: number;
  factors: {
    urgency: number;
    priority: number;
    affinity: number;
    workload: number;
  };
}

export type AllocationDecision = AllocationCandidate;
```

**Performance strategy (NFR-F2-1: <500ms):**
- Pure computation, no I/O
- O(S × A) where S = stories, A = agents — worst case 100 stories × 100 agents = 10,000 score computations
- Each score computation: 4 multiplications + 1 addition ≈ nanoseconds
- Affinity lookup: O(1) via pre-built Map from `SessionLearning[]`
- Pool eligibility: O(1) per (agent, project) via `canReceiveAgents`
- Total expected: <50ms for max scale (100 agents, 50 projects)

**Integration with existing systems:**
- `scoreAffinity` from `assignment-scorer.ts` — reuse for the affinity factor
- `canReceiveAgents`, `getAvailablePoolAgents`, `isAgentReserved` — filter eligible agents
- `resolvePoolMemberships`, `getPoolProjects` — discover pool-enabled projects
- `StoryCandidate` from `assignment-service.ts` — story input format
- `SprintStatusData.priorities` — story priority values

### File Structure to Modify

```
packages/core/src/
├── types.ts                        # MODIFY: Add UrgencyLevel, AllocationWeights, urgency to StoryState
├── config.ts                       # MODIFY: Add priority, allocationWeights to SharedPoolConfigSchema
├── shared-pool.ts                  # NO CHANGE (read-only dependency)
├── pool-allocation.ts              # CREATE: Allocation algorithm (pure functions)
├── assignment-service.ts           # MODIFY: Add urgency to StoryCandidate
├── index.ts                        # MODIFY: Export new allocation functions and types
└── __tests__/
    ├── pool-allocation.test.ts     # CREATE: Unit + integration tests for allocation
    ├── shared-pool.test.ts         # NO CHANGE (existing tests still pass)
    └── config.test.ts or shared-pool.test.ts  # MODIFY: Add Zod tests for new fields

packages/web/                        # NO CHANGE in this story (allocation is core-only)
```

### Testing Strategy

**Core tests (pool-allocation.test.ts):**
- `computeUrgencyScore` — maps each urgency level to expected score
- `computeUrgencyScore` — defaults to 0.5 for undefined
- `computePriorityScore` — normalizes with known max
- `computePriorityScore` — defaults to 0.5 when no priorities set
- `computeWorkloadScore` — returns 1.0 for idle agent
- `computeWorkloadScore` — returns lower score for loaded agent
- `computeWorkloadScore` — returns 0 for agent at max capacity
- `computeAllocationScore` — known inputs produce expected weighted sum
- `computeAllocationScore` — uses default weights when none configured
- `allocateAgents` — returns ranked decisions sorted by score
- `allocateAgents` — excludes reserved agents from cross-project
- `allocateAgents` — excludes agents at maxConcurrent capacity
- `allocateAgents` — respects pool eligibility (canReceiveAgents)
- `allocateAgents` — breaks ties by story priority then FIFO
- `allocateAgents` — handles no available agents (returns empty)
- `allocateAgents` — handles no stories (returns empty)
- `allocateAgents` — handles all agents reserved (returns empty)
- `allocateAgents` — handles no learning history (affinity defaults to 0.5)
- Performance: 100 agents × 50 projects × 100 stories completes within 500ms

**Zod schema tests:**
- Valid config with priority parses correctly
- Valid config with allocationWeights parses correctly
- priority is optional
- allocationWeights is optional
- Negative priority fails validation
- allocationWeights values outside 0-1 fail validation
- urgency on StoryCandidate is optional

### NFRs

- **NFR-F2-1:** Allocation decision completes within 500ms — pure computation, O(S×A), expected <50ms at max scale
- **NFR-F2-2:** Shared pool supports up to 100 agents across 50 projects — no additional data structures needed, Map-based lookups
- **NFR-I2:** Allocation integrates with existing single-project flows (projects without sharedPool are unaffected)

### Accessibility

- No UI changes in this story (core algorithm only)
- Story 50.4 will add UI for viewing allocation decisions

### References

- [Source: epics-cycle-10.md#Epic 50 Story 50.3] — Requirements
- [Source: prd-cycle-10.md#FR-F2-2] — Intelligent allocation requirements
- [Source: prd-cycle-10.md#NFR-F2-1] — 500ms allocation decision
- [Source: prd-cycle-10.md#NFR-F2-2] — 100 agents, 50 projects
- [Source: packages/core/src/types.ts:968-978] — SharedPoolConfig interface
- [Source: packages/core/src/types.ts:2032-2045] — StoryState interface
- [Source: packages/core/src/assignment-scorer.ts:14-21] — AffinityScore type
- [Source: packages/core/src/assignment-scorer.ts:61-123] — scoreAffinity function
- [Source: packages/core/src/assignment-service.ts:24-33] — StoryCandidate type
- [Source: packages/core/src/assignment-service.ts:49-56] — SprintStatusData type
- [Source: packages/core/src/shared-pool.ts] — Pool utility functions (8 exported)
- [Source: packages/core/src/config.ts:61-66] — SharedPoolConfigSchema
- [Source: packages/core/src/index.ts] — Package exports
- [Source: Story 50.2 completion notes] — Previous story intelligence

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Zod for validation, `satisfies` for type checking
- Co-located test files in `__tests__/`
- Pure functions with no side effects
- All existing tests must continue to pass (no regressions)
- New module `pool-allocation.ts` follows same pattern as `shared-pool.ts`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 5 tasks (35 subtasks) completed — types, config extensions, scoring functions, main algorithm, integration, and tests
- Pure function architecture: no side effects, no state mutation, fully deterministic
- Weighted scoring with configurable weights (default: urgency=0.3, priority=0.3, affinity=0.25, workload=0.15)
- Same-project agents bypass pool eligibility check; cross-project uses `getAvailablePoolAgents` + `canReceiveAgents`
- Reserved agents excluded from cross-project allocation but allowed on own project's stories
- Greedy deduplication: each story gets at most one agent, each agent gets at most one story
- Affinity provided via pre-computed `Map<string, number>` (key: `agentId:storyId`) — falls back to neutral 0.5
- NFR-F2-1: 19ms for 100 agents x 50 projects (well under 500ms target)
- 43 tests across 7+ describe blocks; all 1877 core tests pass
- No new dependencies required

**Code Review Fixes Applied (2026-03-28):**
- ✅ Fixed: `computeWorkloadScore` now clamps negative `activeAssignments` to 0 (was returning >1 scores)
- ✅ Fixed: Sort tiebreaking uses pre-built `storyById` Map instead of O(S) `stories.find()` per comparison
- ✅ Fixed: Documented weights resolution behavior (first pool project's custom weights used)
- ✅ Fixed: Removed dead else block with misleading comment about reservation checks
- ✅ Fixed: Updated task 4.1/4.3 descriptions to match actual implementation (pre-computed affinity map, only `getPoolProjects` used)
- ✅ Fixed: Test helper uses actual `SharedPoolConfig` type instead of inline recreation (compile-time safety)
- ✅ Fixed: Documented `AllocationStory.position` constraints (0-based ordinal)
- ✅ Added: 3 new tests (negative workload guard, multi-source allocation, non-pool project story)

### File List

- `packages/core/src/types.ts` — MODIFY: Added `UrgencyLevel`, `AllocationWeights`, `urgency` to `StoryState`, `priority`/`allocationWeights` to `SharedPoolConfig`
- `packages/core/src/config.ts` — MODIFY: Extended `SharedPoolConfigSchema` with `priority` and `allocationWeights` Zod fields
- `packages/core/src/assignment-service.ts` — MODIFY: Added `urgency?: UrgencyLevel` to `StoryCandidate`
- `packages/core/src/pool-allocation.ts` — CREATE: Allocation algorithm — pure scoring functions + main `allocateAgents`
- `packages/core/src/__tests__/pool-allocation.test.ts` — CREATE: 43 tests — scoring units, integration, performance, Zod schema
- `packages/core/src/index.ts` — MODIFY: Export new allocation functions and types
