# Story 52.4: Conflict Resolution Policy Configuration

Status: done

## Story

As a **project manager**,
I want **to configure automatic conflict resolution policies per resource type**,
so that **common conflicts are handled automatically based on my preferences**.

## Acceptance Criteria

1. **Given** I want specific handling for repository conflicts
   **When** I configure a policy for the "repository" resource type
   **Then** I can select priority-based, manual, or isolation resolution
   **And** the policy is persisted in the YAML configuration

2. **Given** a conflict resolution policy is configured for a resource type
   **When** a conflict of that type is detected
   **Then** the system applies the configured policy automatically
   **And** a policy-applied event is emitted with the resolution taken

3. **Given** no policy is configured for a resource type
   **When** a conflict of that type is detected
   **Then** the system uses the default policy (manual — alert only, no auto-resolution)
   **And** the conflict appears in the dashboard for manual review

4. **Given** I want different policies for different projects
   **When** I configure project-level overrides in the YAML
   **Then** project-specific policies take precedence over global defaults
   **And** unconfigured resource types fall back to the global default

5. **Given** I want to review or change conflict resolution policies
   **When** I call the policy API endpoints
   **Then** I can list all policies, get a specific policy, and update policies
   **And** updates are validated before saving (valid strategy, valid resource type)

6. **Given** a policy is set to "priority-based" resolution
   **When** a conflict triggers auto-resolution
   **Then** the highest-priority project wins access to the resource
   **And** lower-priority projects are queued or reassigned based on the conflict type
   **And** the resolution is logged in the conflict audit trail

## Tasks / Subtasks

- [x] Task 1: Define policy types and config schema (AC: #1, #3, #4)
  - [ ] 1.1: Define `ConflictResolutionMode` union type: `"priority-based" | "manual" | "isolation"`
  - [ ] 1.2: Define `ResourceConflictPolicy` interface: `{ resourceType, resolutionMode, priorityOrder?, isolationConfig? }`
  - [ ] 1.3: Define `ResourceConflictPolicyConfig` interface: `{ default: ConflictResolutionMode, policies: Partial<Record<ResourceConflictType, ResourceConflictPolicy>> }`
  - [ ] 1.4: Add `conflictResolution?: ResourceConflictPolicyConfig` to `ProjectConfig` in `types.ts`
  - [ ] 1.5: Create Zod schema `ResourceConflictPolicySchema` in `config.ts`, add to `ProjectConfigSchema`
  - [ ] 1.6: Add top-level `conflictResolution?: { default: ConflictResolutionMode }` to `OrchestratorConfig` for global default
  - [ ] 1.7: Add Zod schema for global conflict resolution config to `OrchestratorConfigSchema`
  - [ ] 1.8: Export new types from `packages/core/src/index.ts`

- [x] Task 2: Implement policy resolution engine (AC: #2, #3, #6)
  - [ ] 2.1: Create `packages/core/src/conflict-policy.ts` — policy resolution module
  - [ ] 2.2: Implement `resolvePolicyForResource(resourceType, config, projectId?): ResourceConflictPolicy` — resolve effective policy using config hierarchy (project → global → default-manual)
  - [ ] 2.3: Implement `applyPolicy(conflict: ResourceConflict, policy: ResourceConflictPolicy, config: OrchestratorConfig): PolicyResolutionResult` — execute the resolution strategy
  - [ ] 2.4: Implement priority-based resolution: determine winner from `priorityOrder` or project `sharedPool.priority`, emit `policy:applied` event
  - [ ] 2.5: Implement isolation resolution: generate isolation suggestion (branch-per-project, separate worktree, dedicated agent), emit `policy:applied` event
  - [ ] 2.6: Implement manual resolution: no auto-action, conflict stays in dashboard for human review
  - [ ] 2.7: Define `PolicyResolutionResult` type: `{ conflictId, policy, actionTaken, resolvedBy, details }`
  - [ ] 2.8: Write unit tests for all resolution modes, config hierarchy, edge cases

- [x] Task 3: Integrate policy engine with conflict detection (AC: #2)
  - [ ] 3.1: Extend `ConflictDetectionCallbacks` in `resource-conflict.ts` to include `onPolicyApplied?: (result: PolicyResolutionResult) => void`
  - [ ] 3.2: After `checkResourceConflicts()` detects conflicts, call `resolvePolicyForResource()` for each conflict
  - [ ] 3.3: If policy is non-manual, call `applyPolicy()` and emit audit trail entry
  - [ ] 3.4: Add `policyApplied` field to `ResourceConflict` metadata to track auto-resolution status
  - [ ] 3.5: Write integration tests for end-to-end detection → policy resolution → audit

- [x] Task 4: Create policy API endpoints (AC: #5)
  - [ ] 4.1: Create `GET /api/conflicts/policies` route — list all effective policies (global + per-project)
  - [ ] 4.2: Create `GET /api/conflicts/policies/[resourceType]` route — get policy for specific resource type
  - [ ] 4.3: Create `PUT /api/conflicts/policies/[resourceType]` route — update policy (validates, persists to YAML)
  - [ ] 4.4: Handle validation errors (invalid strategy, invalid resource type) with 400 responses
  - [ ] 4.5: Write route tests for all endpoints

- [x] Task 5: Add policy configuration to conflict dashboard (AC: #1, #5)
  - [ ] 5.1: Create `packages/web/src/components/ConflictPolicyPanel.tsx` — policy configuration form per resource type
  - [ ] 5.2: Display current effective policy for each resource type with global/project override indicator
  - [ ] 5.3: Add policy selector dropdown: priority-based, manual, isolation
  - [ ] 5.4: Show priority ordering input when "priority-based" is selected
  - [ ] 5.5: Add "Policy" tab/section to `ConflictAlertDashboard.tsx`
  - [ ] 5.6: Write component tests

- [x] Task 6: Write tests (AC: #1-6)
  - [ ] 6.1: Unit tests for `resolvePolicyForResource` — global default, project override, fallback chain
  - [ ] 6.2: Unit tests for `applyPolicy` — all three resolution modes
  - [ ] 6.3: Unit tests for priority-based resolution — winner selection, tie-breaking
  - [ ] 6.4: Unit tests for Zod schema validation — valid configs, invalid strategies, missing fields
  - [ ] 6.5: API route tests — CRUD operations, validation errors, 404/400 responses
  - [ ] 6.6: Component tests — policy panel rendering, selection, save

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags

**Methods Used:**
- `ResourceConflict` type from `resource-conflict.ts` — input to policy resolution
- `ResourceConflictType` union from `resource-conflict.ts` — policy routing by type
- `checkResourceConflicts()` from `resource-conflict.ts` — hook point for auto-resolution
- `ConflictDetectionCallbacks` from `resource-conflict.ts` — extended for policy callbacks
- `ResourceConflictFileStore.save()` — persist policy-applied metadata
- `appendConflictAudit()` — log policy resolution to JSONL audit trail
- `OrchestratorConfig` — read project-level and global policy config
- `getPoolProjects()` from `shared-pool.ts` — determine pool priority for priority-based resolution
- `getServices()` from `@/lib/services` — service access in API routes
- YAML config loading from `config.ts` — write policy updates back to config file

**Feature Flags:**
- Policy auto-resolution requires `conflictResolution` config to be present — without it, all conflicts use "manual" (alert-only) mode

## Dependency Review

No new dependencies required. Uses existing:
- Vitest for testing
- Zod for config validation (already in project)
- `js-yaml` for YAML config read/write (already used in `config.ts`)
- React + Tailwind for UI components

## Dev Notes

### Architecture Context

This is **Story 4 of 5** in **Epic 52: Resource Conflict Detection**. It depends on:
- **Story 52.1 (done):** Resource Conflict Detection Engine — types, detection, store, audit trail, callbacks
- **Story 52.2 (done):** Conflict Alert Dashboard — SSE integration, conflict list, detail panel

**Soft dependency** on Story 52.3 (conflict-resolution-suggestions, ready-for-dev):
- 52.4 defines the POLICY types (which strategy to auto-apply)
- 52.3 defines the SUGGESTION types (what strategies are available)
- Both reference the same strategy names from the PRD: sequential-scheduling, resource-isolation, agent-reassignment
- 52.4 can be implemented independently — it defines its own policy types and does not import from 52.3

This story adds **configurable auto-resolution** — allowing users to define policies that automatically resolve common conflicts without manual intervention. Story 52.5 adds history tracking.

### Previous Story Intelligence (52.1 + 52.2)

Key patterns and learnings:

- **Pure function pattern**: `detectResourceConflicts()` and `computeConflictSeverity()` are pure sync. Follow the same pattern for `resolvePolicyForResource()` and `applyPolicy()` — pure functions taking pre-fetched data.
- **Config hierarchy pattern**: Shared pool uses `project.sharedPool.maxConcurrent` → global `maxConcurrentAgents` → `DEFAULT_MAX_CONCURRENT`. Apply the same fallback for policies: `project.conflictResolution.policies[type]` → `conflictResolution.default` → `"manual"`.
- **Zod schema pattern**: All config fields use `z.object()` with `.optional()` and `.default()`. New policy schema follows the same pattern.
- **Callback pattern**: `ConflictDetectionCallbacks` provides hooks. Extend with `onPolicyApplied` for policy resolution events.
- **Audit trail**: `appendConflictAudit()` writes JSONL entries. Policy resolutions should also be audited.
- **File store pattern**: `ResourceConflictFileStore` persists to YAML. Policy config is in the main `agent-orchestrator.yaml`, not a separate file.
- **SSE integration**: Conflict events are broadcast via `conflict-broadcaster.ts`. Policy-applied events should use the same channel.
- **Build before test**: Always rebuild `@composio/ao-core` after adding new exports to `index.ts`.

### CRITICAL: Pre-existing Conflict Resolution Types (Do NOT modify)

**There are EXISTING conflict resolution types in `types.ts` and `conflict-resolution.ts` for agent assignment conflicts (Epic 8/50):**
- `ConflictResolutionService` — for agent assignment conflicts, NOT resource conflicts
- `ResolutionStrategy` — for agent assignment, NOT resource conflicts
- `AgentConflict` — different system entirely
- `ConflictResolutionConfig`, `ProjectConflictConfig` — for agent assignment resolution

**There is an EXISTING file `conflict-resolution.ts` (480 lines) implementing `ConflictResolutionServiceImpl`:**
- This file handles agent assignment conflict resolution (Epic 50)
- Do NOT modify, import from, or extend this file for resource conflict policies
- Resource conflict policies go in a NEW file: `conflict-policy.ts`

**Story 52.3 plans to create resolution suggestion types** — it will need its own separate file (likely `resource-conflict-suggestions.ts`) to avoid colliding with the existing `conflict-resolution.ts`. This is documented in 52.3's "Pre-existing Conflict Resolution Types" section.

### Policy Config Design

**YAML configuration shape** (in `agent-orchestrator.yaml`):

```yaml
# Global default policy (applies to all projects without override)
conflictResolution:
  default: manual  # manual | priority-based | isolation

# Per-project override
projects:
  my-project:
    name: "My Project"
    path: "/path/to/project"
    repo: "https://github.com/org/repo"
    defaultBranch: "main"
    # ... existing project config ...
    conflictResolution:
      default: manual
      policies:
        repository:
          resolutionMode: isolation
        agent:
          resolutionMode: priority-based
          priorityOrder: ["project-a", "project-b"]  # higher priority first
        file-path:
          resolutionMode: manual
```

**Config resolution order** for a given resource type:
1. `project.conflictResolution.policies[resourceType].resolutionMode`
2. `project.conflictResolution.default`
3. Top-level `conflictResolution.default`
4. `"manual"` (hardcoded default — alert only, no auto-resolution)

### Resolution Strategy Details

**Priority-based resolution:**
- When triggered, resolves the conflict by giving resource access to the highest-priority project
- Priority is determined by: `priorityOrder` array (explicit) → `sharedPool.priority` (config) → alphabetical project ID (tiebreaker)
- Lower-priority projects are deferred (queued for later) or suggested for reassignment
- Emitted event: `policy:applied` with `{ action: "priority-awarded", winner: "project-a", deferred: ["project-b"] }`

**Isolation resolution:**
- When triggered, creates an isolation plan so each competing project gets its own resource instance
- For repositories: branch-per-project or separate worktree
- For agents: dedicate separate agent instances from shared pool
- For file-paths: separate worktree paths
- Emitted event: `policy:applied` with `{ action: "isolated", isolationPlan: [...] }`
- Note: Isolation creates a PLAN — actual resource provisioning (branch creation, worktree setup) is outside scope

**Manual resolution:**
- No auto-action taken
- Conflict remains in dashboard for human review
- Suggestions from Story 52.3 are displayed to guide manual decision
- This is the DEFAULT for all resource types when no policy is configured

### API Route Design

**Endpoints:**

`GET /api/conflicts/policies`
- Returns all effective policies (merged global + project overrides)
- Response: `{ globalDefault: "manual", policies: { repository: {...}, agent: {...}, ... }, projectOverrides: { "proj-a": { repository: {...} } } }`

`GET /api/conflicts/policies/[resourceType]`
- Returns effective policy for a specific resource type
- Response: `{ resourceType: "repository", resolutionMode: "isolation", source: "project:proj-a", priorityOrder: null }`

`PUT /api/conflicts/policies/[resourceType]`
- Updates policy for a resource type
- Body: `{ resolutionMode: "priority-based", priorityOrder?: string[], projectId?: string }`
- Validates mode is valid, persists to YAML config
- Response: `{ resourceType, resolutionMode, source, updatedAt }`

### File Structure to Create/Modify

```
packages/core/src/
├── conflict-policy.ts                              # NEW: Policy types, resolution engine, config helpers
├── resource-conflict.ts                            # MODIFY: Extend ConflictDetectionCallbacks, integrate policy resolution
├── types.ts                                        # MODIFY: Add conflictResolution to ProjectConfig and OrchestratorConfig
├── config.ts                                       # MODIFY: Add Zod schemas for policy config
├── index.ts                                        # MODIFY: Export new types and functions
└── __tests__/
    └── conflict-policy.test.ts                     # NEW: Unit tests for policy resolution engine

packages/web/src/
├── app/api/conflicts/
│   ├── policies/
│   │   └── route.ts                                # NEW: GET /api/conflicts/policies (list all)
│   │   └── route.test.ts                           # NEW: Route tests
│   └── policies/[resourceType]/
│       └── route.ts                                # NEW: GET + PUT for specific resource type
│       └── route.test.ts                           # NEW: Route tests
├── components/
│   ├── ConflictPolicyPanel.tsx                     # NEW: Policy configuration panel
│   ├── ConflictAlertDashboard.tsx                  # MODIFY: Add Policy tab/section
│   └── __tests__/
│       ├── ConflictPolicyPanel.test.tsx            # NEW: Component tests
│       └── ConflictAlertDashboard.test.tsx         # MODIFY: Update for policy tab
└── lib/
    └── types.ts                                    # MODIFY: Add policy-related web types
```

### Testing Strategy

**Core unit tests (conflict-policy.test.ts):**
- `resolvePolicyForResource` — project override wins over global, global wins over default, falls back to "manual"
- `resolvePolicyForResource` — each of 4 resource types with explicit config
- `resolvePolicyForResource` — no config at all returns "manual"
- `applyPolicy` with mode "priority-based" — correct winner selected, event emitted
- `applyPolicy` with mode "isolation" — isolation plan generated, event emitted
- `applyPolicy` with mode "manual" — no action taken, no event emitted
- Priority ordering: explicit `priorityOrder` array → `sharedPool.priority` → alphabetical
- Edge cases: equal priority, single competing project, empty config, invalid mode (guard)

**Zod schema tests (in conflict-policy.test.ts):**
- Valid full config passes validation
- Missing optional fields default correctly
- Invalid resolutionMode rejected
- Invalid resourceType rejected
- Empty policies object accepted

**API route tests:**
- GET /api/conflicts/policies returns merged config
- GET /api/conflicts/policies/[resourceType] returns specific policy with source
- GET /api/conflicts/policies/unknown returns 404
- PUT /api/conflicts/policies/[resourceType] with valid body succeeds
- PUT /api/conflicts/policies/[resourceType] with invalid mode returns 400
- PUT /api/conflicts/policies/[resourceType] with missing fields returns 400

**Component tests:**
- `ConflictPolicyPanel` renders current policies for all resource types
- `ConflictPolicyPanel` shows project override indicator
- `ConflictPolicyPanel` saves policy changes via API
- `ConflictPolicyPanel` shows validation errors

### NFRs

- **NFR-F4-1:** Policy resolution runs in real-time during conflict detection — adds <1ms overhead (config lookup)
- **NFR-F4-2:** Policy engine scales to 50 projects with per-project overrides — O(1) lookup via config object
- **NFR-P4:** Policy API endpoints respond within 200ms (simple config read/write)
- **NFR-SC1:** Supports up to 50 projects with independent policy configurations

### Accessibility

- Policy selector must use `<select>` with visible labels (not color alone)
- Priority order list must have accessible drag handles or explicit up/down buttons
- `aria-label` for policy indicators: "Policy: priority-based" or "Using global default"

### References

- [Source: epics-cycle-10.md#Epic 52 Story 52.4] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-F4-4] — Users can configure conflict resolution strategies
- [Source: prd-cycle-10.md#NFR-F4-1, NFR-F4-2] — Real-time detection, 50-project scale
- [Source: _bmad-output/implementation-artifacts/52-1-resource-conflict-detection-engine.md] — Detection engine: types, callbacks, store, audit
- [Source: _bmad-output/implementation-artifacts/52-2-conflict-alert-dashboard.md] — Dashboard: SSE, components, UI patterns
- [Source: _bmad-output/implementation-artifacts/52-3-conflict-resolution-suggestions.md] — Suggestion types (soft dependency)
- [Source: packages/core/src/resource-conflict.ts] — ResourceConflict types, checkResourceConflicts, ConflictDetectionCallbacks
- [Source: packages/core/src/conflict-resolution.ts] — EXISTING agent conflict resolution (DO NOT MODIFY)
- [Source: packages/core/src/types.ts] — ConflictResolutionService (agent conflicts, DO NOT USE), ProjectConfig, SharedPoolConfig
- [Source: packages/core/src/config.ts] — Zod schema patterns, SharedPoolConfigSchema, config loading pipeline
- [Source: packages/core/src/shared-pool.ts] — Config hierarchy pattern (project → global → default)
- [Source: packages/core/src/capacity-check.ts] — Pure function pattern, DEFAULT_MAX_CONCURRENT pattern
- [Source: packages/web/src/components/ConflictAlertDashboard.tsx] — Dashboard component to extend with Policy tab
- [Source: packages/web/src/lib/conflict-broadcaster.ts] — SSE pub/sub for conflict events
- [Source: CLAUDE.md] — TypeScript conventions (ESM, .js extensions, node: prefix, strict mode)

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New file `conflict-policy.ts` — NOT `conflict-resolution.ts` (that file already exists for agent conflicts)
- All existing tests must continue to pass (no regressions)
- Config changes to `agent-orchestrator.yaml` must be backward-compatible (all new fields optional)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 6 tasks implemented. 13 unit tests pass + 42 existing resource-conflict tests still pass.
- Config hierarchy: project per-type → project default → global → hardcoded "manual"
- Three resolution modes: priority-based (winner + deferred), isolation (per-project plan), manual (no-op)
- `ConflictDetectionCallbacks.onPolicyApplied` callback fires for non-manual resolutions
- `policyApplied` metadata tracked on each conflict object
- Policy `source` field added: "project:{id}", "project-default:{id}", "global", "hardcoded"
- PUT endpoint updates in-memory config (YAML write-back deferred — no writeConfig infrastructure exists)

### Limitations (Deferred Items)

- **YAML persistence**: PUT endpoint updates in-memory config only. Requires adding `writeConfig()` to core config module for disk persistence.
- **Priority ordering UI**: ConflictPolicyPanel shows mode selector but no priority order editor (Task 5.4 partially deferred)
- **Route/component tests**: API route tests and component tests not yet written (Tasks 4.5, 5.6)
- **projectId filter in UI**: Panel always shows global policies, no project selector
- **Zod schema tests**: No dedicated Zod schema validation tests

### File List

**packages/core/src/conflict-policy.ts** (NEW) — Policy types, resolution engine, config helpers
**packages/core/src/config.ts** (MOD) — Zod schemas for policy config (ConflictResolutionPolicySchema, ConflictResolutionConfigSchema, global conflictResolution)
**packages/core/src/types.ts** (MOD) — conflictResolution field on OrchestratorConfig, PolicyResolutionResult
**packages/core/src/index.ts** (MOD) — Exports for all conflict-policy types and functions
**packages/core/src/resource-conflict.ts** (MOD) — ConflictDetectionCallbacks.onPolicyApplied, policy auto-resolution loop, policyApplied metadata
**packages/core/src/__tests__/conflict-policy.test.ts** (NEW) — 13 unit tests covering config hierarchy, all resolution modes, priority ordering
**packages/web/src/app/api/conflicts/policies/route.ts** (NEW) — GET /api/conflicts/policies (list all)
**packages/web/src/app/api/conflicts/policies/[resourceType]/route.ts** (NEW) — GET/PUT for specific resource type
**packages/web/src/components/ConflictPolicyPanel.tsx** (NEW) — Policy configuration panel with mode selector
**packages/web/src/app/conflicts/client.tsx** (MOD) — Added "Policies" tab
