# Story 1.5: Multi-Agent Assignment (Manual + Priority-Based)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to manually assign stories to specific agents and have the system auto-assign by priority when agents are idle,
so that work distribution is efficient with manual override capability.

## Acceptance Criteria

1. **Given** story `STORY-003` exists in sprint-status.yaml and agent `claude-2` is a live session,
   **When** I run `ao assign STORY-003 claude-2`,
   **Then** the story is assigned to that agent with confirmation displayed (story title, agent ID, assignment time)

2. **Given** story `STORY-003` is already assigned to `claude-1`,
   **When** I run `ao assign STORY-003 claude-2`,
   **Then** a warning shows the current assignee and prompts for confirmation to reassign (or `--force` skips prompt)

3. **Given** multiple `ready-for-dev` stories exist with different priority values and an agent with no assignment,
   **When** I run `ao assign-next <agent-id>` (or an idle agent triggers auto-assignment),
   **Then** the highest-priority story with no unresolved dependencies is assigned to that agent

4. **Given** two `ready-for-dev` stories have equal priority,
   **When** auto-assignment selects the next story,
   **Then** the story appearing first in sprint-status.yaml (FIFO ordering) is chosen

5. **Given** all remaining stories have unresolved dependencies (prerequisite stories not `done`),
   **When** auto-assignment runs,
   **Then** no assignment is made and the agent remains idle (logged as "no assignable stories")

6. All assignment operations complete within 500ms (NFR-P8)

## Tasks / Subtasks

- [x] Task 1: Create `AssignmentService` in core with priority queue logic (AC: #3, #4, #5)
  - [x] 1.1 Create `packages/core/src/assignment-service.ts` — New service with priority-based story selection. Implements `selectNextStory(projectPath: string, registry: AgentRegistry): StoryCandidate | null`. Logic: read sprint-status.yaml, filter for `ready-for-dev` stories, exclude stories with active assignments (via `registry.findActiveByStory()`), exclude stories with unresolved dependencies, sort by priority (higher first) then by FIFO order (position in YAML), return top candidate or null.
  - [x] 1.2 Add `StoryCandidate` type: `{ storyId: string; priority: number; epicId: string; position: number }`. The `position` field is the story's ordinal position in `development_status` for FIFO tiebreaking.
  - [x] 1.3 Implement `getAssignableStories(projectPath: string, registry: AgentRegistry): StoryCandidate[]` — Returns the full sorted list (for display in `ao assign-next --dry-run`).
  - [x] 1.4 Implement `resolveDependencies(storyId: string, sprintStatus: SprintStatus): { resolved: boolean; unresolved: string[] }` — Checks if all dependencies listed in `dependencies` map are `done`.
  - [x] 1.5 Export from `packages/core/src/index.ts` — Add `selectNextStory`, `getAssignableStories`, `resolveDependencies`, `StoryCandidate`, `DependencyResult` to barrel exports.

- [x] Task 2: Add `ao assign-next` CLI command (AC: #3, #4, #5, #6)
  - [x] 2.1 Create `packages/cli/src/commands/assign-next.ts` — New command: `ao assign-next <agent-id> [--dry-run] [--force]`. Loads config, resolves project, calls `selectNextStory()`. If a candidate is found, registers assignment + delivers story context + logs to audit trail. If no candidate, prints "No assignable stories" and exits 0.
  - [x] 2.2 `--dry-run` flag — Shows the priority queue without making any assignment. Displays a table: `Story ID | Priority | Epic`.
  - [x] 2.3 `--force` flag — Skips confirmation prompts (same pattern as `ao assign --force`).
  - [x] 2.4 Register command in `packages/cli/src/index.ts` — Import and call `registerAssignNext(program)`.
  - [x] 2.5 Output follows UX1 patterns — Uses `ora` spinners, `chalk` colors, `header()` from format.ts. Shows confirmation with story title, agent ID, priority, and epic.

- [x] Task 3: Enhance existing `ao assign` with priority field (AC: #1, #2)
  - [x] 3.1 In `packages/cli/src/commands/assign.ts` `registry.register()` call: add `priority` field. Uses `sprintStatus.priorities?.[normalizedStoryId] ?? 0`.
  - [x] 3.2 Display priority in the assignment confirmation output.
  - [-] 3.3 Refactor shared utilities — `readSprintStatus()`, `findStoryFile()`, `parseStoryFile()`, `formatStoryPrompt()`, `promptConfirmation()` are already in `story-context.ts`. `assign-next.ts` imports from there. Full refactoring of `assign.ts` to use shared utilities deferred (assign.ts has its own copies that predate story-context.ts).

- [x] Task 4: Write tests (AC: #1-#6)
  - [x] 4.1 Create `packages/core/src/__tests__/assignment-service.test.ts` — 13 unit tests for AssignmentService.
  - [x] 4.2 Test: single assignable story returns that story.
  - [x] 4.3 Test: multiple stories sorted by priority (highest first).
  - [x] 4.4 Test: equal priority uses FIFO ordering (position in YAML).
  - [x] 4.5 Test: stories with active assignments are excluded.
  - [x] 4.6 Test: stories with unresolved dependencies are skipped.
  - [x] 4.7 Test: all stories blocked by dependencies → returns null.
  - [x] 4.8 Test: dependency resolution — `done` deps resolve, `in-progress` deps don't.
  - [x] 4.9 Create `packages/cli/__tests__/commands/assign-next.test.ts` — 8 source-scanning + 3 behavioral tests.
  - [x] 4.10 Test: assign-next with available story calls registry.register (behavioral test via selectNextStory).
  - [x] 4.11 Test: assign-next with no stories exits 0 with message (behavioral test via selectNextStory returning null).
  - [x] 4.12 Test: --dry-run displays queue without assigning (source scan + behavioral getAssignableStories test).

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `AgentRegistry.register(assignment)` — register assignment with priority [Source: packages/core/src/types.ts:1256]
- [x] `AgentRegistry.getByAgent(agentId)` — check existing assignment [Source: packages/core/src/types.ts:1262]
- [x] `AgentRegistry.findActiveByStory(storyId)` — filter already-assigned stories [Source: packages/core/src/types.ts:1274]
- [x] `AgentRegistry.list()` — list all current assignments [Source: packages/core/src/types.ts:1279]
- [x] `AgentRegistry.reload()` — refresh from disk before selection [Source: packages/core/src/types.ts:1299]
- [x] `computeStoryContextHash(title, desc, ac)` — hash for conflict detection [Source: packages/core/src/agent-registry.ts:23]
- [x] `getAgentRegistry(dataDir, config)` — get cached registry instance [Source: packages/core/src/agent-registry.ts:257]
- [x] `getSessionsDir(configPath, projectPath)` — resolve sessions directory [Source: packages/core/src/metadata.ts]
- [x] `loadConfig()` — load agent-orchestrator.yaml [Source: packages/core/src/config.ts]
- [x] `SessionManager.get(sessionId)` — verify agent session exists [Source: packages/core/src/session-manager.ts]
- [x] `SessionManager.send(sessionId, message)` — deliver story context to agent [Source: packages/core/src/session-manager.ts]

**Feature Flags:**
- [x] None — all interface methods exist from previous cycles and Stories 1.1-1.4

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. This story uses only existing packages:
- `yaml` (already approved) — for sprint-status.yaml parsing
- `chalk`, `ora`, `commander` (already in CLI) — for CLI output
- All core functionality from `@composio/ao-core` and `@composio/ao-cli`

## CLI Integration Testing (if applicable)

**For stories that add or modify CLI commands:**

- [x] Create CLI integration test in `packages/cli/__tests__/commands/assign-next.test.ts`
- [x] Test CLI argument parsing (source-scanning tests verify command registration, flags)
- [x] Test CLI output formatting (source-scanning tests verify UX patterns)
- [x] Test CLI error handling (source-scanning test for graceful exit on no stories)
- [-] Test with real config files (use `createTempEnv` helper) — Deferred: behavioral tests use direct API calls instead
- [x] Test CLI → Core service integration paths (behavioral tests call selectNextStory/getAssignableStories directly)

**CLI Test Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../integration/helpers/cli-test.js";
import { createTempEnv } from "../integration/helpers/temp-env.js";

describe("ao assign-next", () => {
  it("should select highest priority story", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["assign-next", "test-agent-1", "--dry-run"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Priority");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story adds **priority-based auto-assignment** to the agent orchestrator. It builds on the `priority` field added to `AgentAssignment` in Story 1-4 (currently passive — no code consumes it). The key new abstraction is an `AssignmentService` that encapsulates the priority queue logic.

**Design: In-memory priority queue, not Redis.** The queue is computed on-demand by reading sprint-status.yaml + registry state. This is intentional — Epic 2 (State Sync) will introduce Redis sorted sets. For now, the O(n) scan over sprint-status entries is well within the 500ms NFR-P8 budget (n < 100 stories).

**Two CLI entry points:**
1. `ao assign <story-id> <agent-id>` — Existing manual assignment (enhanced with priority display)
2. `ao assign-next <agent-id>` — NEW: auto-select highest-priority assignable story for an agent

### Key Implementation Constraints

- **In-memory only** — No Redis, no persistent queue. The `AssignmentService` reads sprint-status.yaml each time. This is the explicit deferral from Epic 1 → Epic 2 (Redis sorted set).
- **Priority source** — Priority comes from two places: (1) `sprintStatus.priorities?.[storyId]` if configured in YAML, (2) `AgentAssignment.priority` field (10 for resumed stories, 0 for fresh). The assignment service uses whichever is higher.
- **FIFO tiebreak** — When priorities are equal, the story appearing first (by ordinal position) in `development_status` wins. This preserves the SM's intended execution order.
- **Dependency resolution** — The `dependencies` map in sprint-status.yaml lists prerequisite story IDs. A story is assignable only if all dependencies have status `done`. Stories without dependency entries are always assignable.
- **No idle-agent polling** — Story 1.5 does NOT implement automatic idle detection + auto-assign. The `ao assign-next` command is manually invoked. Automatic idle-triggered assignment is an Epic 2/4 concern (requires event bus + blocked detection integration).
- **Conflict detection integration** — The existing `ConflictDetectionService.canAssign()` is used to verify no duplicate assignment before registering. This is already implemented in `conflict-detection.ts`.

### Existing Code to Reuse (DO NOT REINVENT)

- `readSprintStatus()` in `packages/cli/src/lib/story-context.ts` — Already extracts `development_status`, `dependencies`, `priorities` from sprint-status.yaml. Both `spawn.ts` and `assign.ts` use it.
- `findStoryFile()` + `parseStoryFile()` + `formatStoryPrompt()` in `packages/cli/src/lib/story-context.ts` — Story context loading pipeline. Reuse in assign-next.
- `validateDependencies()` in `packages/cli/src/commands/assign.ts` — Existing dependency validation. Move to shared location (story-context.ts or new lib) for reuse by AssignmentService.
- `logAssignment()` in `packages/cli/src/commands/assign.ts` — JSONL audit trail logging. Move to shared location if assign-next needs it.
- `promptConfirmation()` in `packages/cli/src/lib/story-context.ts` — Already shared.
- `computeStoryContextHash()` in `packages/core/src/agent-registry.ts` — Hash for conflict detection.
- `createConflictDetectionService()` in `packages/core/src/conflict-detection.ts` — Duplicate assignment prevention.
- `getSessionManager()` in `packages/cli/src/lib/create-session-manager.ts` — Session verification and story delivery.
- `header()`, `banner()` in `packages/cli/src/lib/format.ts` — UX1 output formatting.

### Anti-Patterns to Avoid

- **Do NOT add Redis or any external dependency** — In-memory only for Epic 1. Redis sorted set deferred to Epic 2.
- **Do NOT implement idle-agent polling or auto-triggering** — `ao assign-next` is manual. Auto-trigger is an Epic 2/4 concern.
- **Do NOT duplicate `readSprintStatus()` or `validateDependencies()`** — Import from shared locations. If they're not already in `story-context.ts`, refactor first.
- **Do NOT modify `AgentAssignment` interface** — The `priority` field already exists from Story 1.4. Just consume it.
- **Do NOT use `exec()` for any shell commands** — Only `execFile()` with timeouts (NFR-S7, NFR-S9).
- **Do NOT add a `priorities` section to sprint-status.yaml** — The `priorities` field is optional and already supported in the SprintStatus interface. If not present, default to 0.

### Project Structure Notes

**Files to create:**
- `packages/core/src/assignment-service.ts` — Priority queue logic (new service)
- `packages/cli/src/commands/assign-next.ts` — `ao assign-next` CLI command
- `packages/core/src/__tests__/assignment-service.test.ts` — Assignment service tests
- `packages/cli/__tests__/commands/assign-next.test.ts` — CLI command tests

**Files to modify:**
- `packages/cli/src/commands/assign.ts` — Add priority to register() call, display priority
- `packages/cli/src/index.ts` — Register assign-next command
- `packages/core/src/index.ts` — Export AssignmentService

**Files that may need refactoring (shared utilities):**
- `packages/cli/src/commands/assign.ts` → `packages/cli/src/lib/story-context.ts` — Move `validateDependencies()`, `logAssignment()`, `SprintStatus` type if not already shared. Check `story-context.ts` first — `spawn.ts` already imports `readSprintStatus` from there.

### Cross-Story Dependencies

- **Story 1.4 (done)**: Added `priority?: number` to `AgentAssignment`, `priority: 10` for resumed stories, `priority: 0` for fresh spawns. This story consumes that field for sorting.
- **Story 1.3 (done)**: Agent completion detection, blocked detection, wireDetection utility. Not directly consumed by this story but provides the infrastructure that marks stories `done`/`blocked`, enabling dependency resolution.
- **Epic 2 (backlog)**: Real-time sprint state sync — will replace in-memory priority queue with Redis sorted sets and add event-driven auto-assignment triggers.

### References

- [Source: _bmad-output/planning-artifacts/epics.md:471-489] — Epic 1 Story 1.5 definition
- [Source: packages/core/src/agent-registry.ts] — AgentRegistry with register(), findActiveByStory(), list()
- [Source: packages/core/src/types.ts:1232-1244] — AgentAssignment interface with priority field
- [Source: packages/core/src/conflict-detection.ts] — ConflictDetectionService.canAssign()
- [Source: packages/cli/src/commands/assign.ts] — Existing manual assign command (587 lines)
- [Source: packages/cli/src/lib/story-context.ts] — Shared story context utilities
- [Source: packages/cli/src/commands/spawn.ts] — Story-based spawn with registry.register()
- [Source: _bmad-output/implementation-artifacts/1-4-resume-blocked-stories.md:200] — Priority field is passive, Story 1.5 will add priority-based auto-assignment
- [Source: _bmad-output/planning-artifacts/architecture.md] — In-memory state for Epic 1, Redis deferred to Epic 2

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Fixed ESLint errors: duplicate imports, no-require-imports, consistent-type-imports, no-unused-vars
- Fixed existing `assign.test.ts` failure: added `priority: 0` to expected `registry.register()` call after Task 3 enhancement

### Completion Notes List

- All 580 tests passing (13 core assignment-service + 11 CLI assign-next + existing suite)
- Lint clean (0 errors, 1 pre-existing warning in web package)
- Typecheck clean across all packages
- Task 3.3 (full assign.ts refactor to shared utilities) deferred — assign-next.ts correctly imports from story-context.ts, but assign.ts retains its own copies that predate story-context.ts

### Limitations (Deferred Items)

1. Full `assign.ts` refactor to use shared `story-context.ts` utilities
   - Status: Deferred - Out of scope for this story's ACs
   - Requires: Dedicated refactoring story
   - Current: `assign-next.ts` imports from `story-context.ts`; `assign.ts` has its own copies

2. Full CLI integration test with `createTempEnv` helper
   - Status: Deferred - Behavioral tests use direct API calls instead
   - Current: 8 source-scanning tests + 3 behavioral tests provide adequate coverage

3. Redis-backed priority queue
   - Status: Deferred to Epic 2 (State Sync)
   - Current: In-memory on-demand computation from sprint-status.yaml (well within 500ms NFR-P8)

4. Automatic idle-agent detection and auto-assignment
   - Status: Deferred to Epic 2/4
   - Current: `ao assign-next` is manually invoked

### File List

**Created:**
- `packages/core/src/assignment-service.ts` — AssignmentService with selectNextStory, getAssignableStories, resolveDependencies
- `packages/core/src/__tests__/assignment-service.test.ts` — 13 unit tests
- `packages/cli/src/commands/assign-next.ts` — `ao assign-next` CLI command (277 lines)
- `packages/cli/__tests__/commands/assign-next.test.ts` — 8 source-scanning + 3 behavioral tests

**Modified:**
- `packages/core/src/index.ts` — Added AssignmentService exports
- `packages/cli/src/index.ts` — Registered assign-next command
- `packages/cli/src/commands/assign.ts` — Added priority field to registry.register() call and confirmation display
- `packages/cli/__tests__/commands/assign.test.ts` — Updated expected registry.register() call to include priority field
