# Story 1.1: Sprint Plan CLI & Data Model Foundation

Status: done

## Story

As a Product Manager,
I want to generate a sprint execution plan from sprint-status.yaml showing stories by status, priority, and dependencies,
so that I can see what's ready to work on and in what order.

## Acceptance Criteria

1. `ao plan` parses sprint-status.yaml and displays a summary line (total stories, by-status breakdown) plus actionable stories sorted by priority — progressive disclosure pattern
2. `ao plan --full` shows all stories grouped by epic and status (including blocked/waiting)
3. Stories grouped by epic prefix (e.g., `1-*` = Epic 1) with epic-level ordering
4. Missing sprint-status.yaml → error message + exit code 1
5. Malformed YAML → error message + exit code 1
6. Command completes within 500ms for YAML-fallback path (NFR-P8) — tracker-backed projects may have different latency due to remote API calls
7. Sprint data model types established in core/src/types.ts for use by Stories 1.2-1.5

## Tasks / Subtasks

- [x] Task 1: Extend `ao plan` to support sprint-status.yaml fallback (AC: #1, #4, #5)
  - [x] 1.1 Modify `plan.ts` to detect when no tracker plugin is configured and fall back to reading sprint-status.yaml directly
  - [x] 1.2 Read sprint-status.yaml using yaml parser directly (flat format: `Record<string, string>`) — avoided `readSprintStatus()` from tracker-bmad due to type mismatch with flat format (SprintStatusEntry vs string values)
  - [x] 1.3 Resolve sprint-status.yaml path from project config (`project.path + storyDir/sprint-status.yaml`) with storyDir fallback to `_bmad-output/implementation-artifacts`
  - [x] 1.4 Handle file-not-found with clear error: file path + suggestion to run `ao sprint-planning`
  - [x] 1.5 Handle malformed YAML with try/catch on `yaml.parse()` and user-friendly error

- [x] Task 2: Implement progressive disclosure output (AC: #1, #2)
  - [x] 2.1 Default `ao plan`: summary line + "READY TO START" table (stories with backlog/ready-for-dev status)
  - [x] 2.2 `ao plan --full`: all stories grouped by epic with epic header labels
  - [x] 2.3 Use existing `header()`, `getStoryStatusEmoji()`, `getStoryStatusColor()`, `padCol()` from `cli/src/lib/format.ts`
  - [x] 2.4 Table format: Story ID (padCol 48) | Emoji + Status (color-coded) — following UX1 htop patterns
  - [x] 2.5 Add footer: "Run 'ao plan --full' for all stories grouped by epic" and "Run 'ao spawn --story <id>' to start an agent"

- [x] Task 3: Implement epic grouping and actionable story detection (AC: #3)
  - [x] 3.1 Parse epic membership from story ID prefix (e.g., `1-1` → Epic 1, `6-3` → Epic 6) using regex `(\d+)-(\d+)-[\w-]+`
  - [x] 3.2 Group stories by epic in `--full` view with epic header labels (e.g., "Epic 1 (3 stories):")
  - [x] 3.3 Compute actionable stories: status is `backlog` or `ready-for-dev` (no cross-story dependency resolution — deferred to Story 1.3/1.4)
  - [x] 3.4 Sort actionable stories by epic order (numeric), then by story number within epic

- [x] Task 4: Establish sprint data model types (AC: #7)
  - [x] 4.1 Reviewed existing types in `core/src/types.ts`: `StoryStatus` (line 1800), `StoryState` (line 1809), `AgentAssignment` (line ~1230) — all confirmed present
  - [x] 4.2 Verified `SprintPlanView`, `SprintSummary`, `ActionableStory` did NOT exist — added new types only
  - [x] 4.3 Added `SprintPlanView`, `SprintSummary`, `ActionableStory` with CLI view model documentation comment
  - [x] 4.4 Exported from `core/src/index.ts` barrel export alongside existing `StoryState`, `SetResult`, `BatchResult`

- [x] Task 5: Write tests (AC: #1-#6)
  - [x] 5.1 Created new test file `cli/__tests__/commands/plan-yaml-fallback.test.ts` (8 tests) + updated existing `plan.test.ts` (1 test updated for new fallback behavior)
  - [x] 5.2 Test: valid sprint-status.yaml → correct summary output with story count and status breakdown
  - [x] 5.3 Test: missing file → error message containing path + exit code 1
  - [x] 5.4 Test: malformed YAML → "Failed to parse" error + exit code 1
  - [x] 5.5 Test: `--full` flag → shows all stories grouped by Epic 1, Epic 2, Epic 6
  - [x] 5.6 Test: empty development_status (only epic keys) → "No stories found" info message
  - [x] 5.7 Created committed fixture `cli/__tests__/fixtures/sprint-status-plan-view.yaml` with 7 stories across 3 epics in mixed statuses
  - [x] 5.8 Performance: verified <500ms execution via elapsed time assertion

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
- [x] `loadConfig()` from `@composio/ao-core` — verified exists in `core/src/config.ts:372`
- [x] `readSprintStatus()` from `@composio/ao-plugin-tracker-bmad` — verified exists but NOT used (flat format type mismatch; used direct YAML parsing instead)
- [x] `resolveProject()` from `cli/src/lib/resolve-project.ts:8` — verified exists, used
- [x] `header()`, `getStoryStatusEmoji()`, `getStoryStatusColor()`, `padCol()` from `cli/src/lib/format.ts` — verified exist, all used
- [x] `StoryStatus` type from `core/src/types.ts:1800` — verified exists, used
- [x] `StoryState` interface from `core/src/types.ts:1809` — verified exists (not directly used in plan.ts but available)

**Feature Flags:**
- [x] None needed — all required interfaces exist

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. All needed libraries are already approved:
- `yaml` (2.8.2, ISC) — approved in previous cycle Story 2-5
- `chalk` (5.x, MIT) — existing CLI dependency
- `commander` (11.x, MIT) — existing CLI framework
- `zod` (3.25.76, MIT) — approved in previous cycle Story 2-1-1

## CLI Integration Testing (if applicable)

- [ ] Create CLI integration test in `packages/cli/__tests__/integration/`
- [ ] Test CLI argument parsing (all flags and options)
- [ ] Test CLI output formatting (stdout)
- [ ] Test CLI error handling (stderr and exit codes)
- [ ] Test with real config files (use `createTempEnv` helper)
- [ ] Test CLI → Core service integration paths

**CLI Test Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../integration/helpers/cli-test.js";
import { createTempEnv } from "../integration/helpers/temp-env.js";

describe("ao plan", () => {
  it("should display sprint summary from sprint-status.yaml", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["plan"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Sprint Plan");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Critical: Do NOT Reinvent — Reuse Existing Code

The codebase already has substantial sprint planning infrastructure from the previous cycle. This story EXTENDS it, not replaces it.

**Existing code to REUSE (not rewrite):**

| Module | Location | What It Does | How to Reuse |
|--------|----------|-------------|-------------|
| Sprint status reader | `plugins/tracker-bmad/src/sprint-status-reader.ts` | Parses sprint-status.yaml, returns typed `SprintStatus` | Import and call `readSprintStatus()` — already handles edge cases |
| Dependency graph | `plugins/tracker-bmad/src/dependencies.ts` | Builds dependency graph, detects circular deps | Import `computeDependencyGraph()` |
| Planning algorithm | `plugins/tracker-bmad/src/planning.ts` | Computes recommended stories, capacity | Import `computeSprintPlan()` for tracker-backed projects |
| Sprint-plan CLI | `cli/src/commands/sprint-plan.ts` | Pure YAML plan display (no tracker) | Reference patterns but extend `plan.ts` instead |
| Format utilities | `cli/src/lib/format.ts` | `header()`, status emojis, colors, column padding | Import directly |
| Resolve project | `cli/src/lib/resolve-project.ts` | Resolves project from config + CLI arg | Import `resolveProject()` |

**Existing types in `core/src/types.ts` (DO NOT DUPLICATE):**
- `StoryStatus` (line ~1800): `"backlog" | "ready-for-dev" | "in-progress" | "review" | "done" | "blocked"`
- `StoryState` (line ~1809): `{ id, status, title, description, acceptanceCriteria, dependencies, assignedAgent, version, updatedAt }`
- `AgentAssignment` (line ~1230): `{ agentId, storyId, assignedAt, status, contextHash }`

**Existing types in `plugins/tracker-bmad/src/sprint-status-reader.ts`:**
- `SprintStatus`: `{ development_status: Record<string, SprintStatusEntry>, ... }`
- `SprintStatusEntry`: `{ status, epic?, points?, assignedSession?, ... }`
- `PlannableStory`: `{ id, title, epic, isBlocked, blockers, points?, priority? }`
- `SprintPlanningResult`: `{ backlogStories, recommended, sprintConfig, capacity, loadStatus, hasPoints }`

### Implementation Strategy

**Approach:** Modify `plan.ts` to have a two-path strategy:
1. If project has tracker plugin configured → use existing `computeSprintPlan()` (current behavior, no change)
2. If no tracker plugin → fall back to reading sprint-status.yaml directly using `readSprintStatus()` from tracker-bmad

**Why extend `plan.ts` instead of `sprint-plan.ts`?**
- `plan.ts` already has project resolution, config loading, error handling patterns
- `sprint-plan.ts` reads from CWD only (not project-aware)
- Keeping one unified `ao plan` command is better UX than two commands

**New types to add in `core/src/types.ts` (ONLY if not already present):**
```typescript
// CLI view models — presentation-layer types for `ao plan` output.
// These are NOT domain types. Domain types live in tracker-bmad
// (PlannableStory, SprintPlanningResult). These are lightweight
// projections for CLI rendering only.
export interface SprintPlanView {
  projectName: string;
  summary: SprintSummary;
  actionable: ActionableStory[];
  blocked: ActionableStory[];
  inProgress: ActionableStory[];
  done: ActionableStory[];
  epicGroups: Record<string, ActionableStory[]>; // grouped by epic prefix
}

export interface SprintSummary {
  totalStories: number;
  byStatus: Record<StoryStatus, number>;
  completionPercentage: number;
}

export interface ActionableStory {
  id: string;
  title: string;
  status: StoryStatus;
  dependencies: string[];
  isBlocked: boolean;
  blockingReason?: string;
}
```

### CLI Output Format (UX1 Patterns)

**Default `ao plan` output:**
```
Sprint Plan: agent-orchestrator
Summary: 45 stories | Done: 0 | In Progress: 0 | Ready: 5 | Backlog: 40

READY TO START:
  Story    Title                                          Status
  1-1      Sprint Plan CLI & Data Model Foundation        🟡 backlog
  6-1      Artifact Scanner & Phase Computation Engine    🟡 backlog

IN PROGRESS: None

Run 'ao plan --full' for complete dependency graph
Run 'ao spawn --story <id>' to start an agent
```

**Colors:** 🟢 done, 🟡 ready/backlog, 🔴 blocked, ⚪ in-progress

### Testing Strategy

- Follow `vi.hoisted()` mock pattern from existing `plan.test.ts`
- Mock `@composio/ao-core` loadConfig to return test project config
- Mock `readSprintStatus` to return controlled test data
- Create a committed fixture snapshot of sprint-status.yaml in test fixtures dir — do NOT reference the living `_bmad-output/` file
- Capture `console.log` via spy for output validation
- Test error paths: missing file, malformed YAML, no tracker + no YAML

### Known Tech Debt: CLI-to-Plugin Coupling

Importing `readSprintStatus()` from `@composio/ao-plugin-tracker-bmad` into `@composio/ao-cli` creates a direct dependency from the CLI package to a specific plugin. This is **accepted tech debt** — the same pattern exists in the current `ao sprint-plan` command. A future story could extract the sprint-status reader into `@composio/ao-core` to eliminate this coupling, but it is not in scope here.

### Project Structure Notes

- Alignment with unified project structure: all changes in `packages/cli/src/commands/` and `packages/core/src/types.ts`
- No new files created except possibly a small utility in `cli/src/lib/` if needed
- Import paths use `.js` extension (ESM requirement)
- `node:` prefix for built-in modules

### Limitations (Deferred Items)

1. **Cross-story dependency resolution**
   - Status: Deferred — sprint-status.yaml has no per-story dependency fields
   - Requires: Dependency data source (story files or epics.md parsing)
   - Epic: Story 1.3 (Agent Story Status Tracking) or Story 1.4 (Resume Blocked Stories)
   - Current: Stories are grouped by epic prefix and sorted by story number; no cross-story blocking detection

2. **Circular dependency detection**
   - Status: Deferred — depends on cross-story dependency resolution above
   - Requires: Dependency graph data
   - Epic: Story 1.3 or 1.4
   - Current: Not implemented; AC #3 scoped to epic grouping only

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — AR3 (Agent Coordinator), AR6 (CLI Commands)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR1, FR3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX1 (CLI Visual Patterns)]
- [Source: packages/plugins/tracker-bmad/src/sprint-status-reader.ts — SprintStatus types]
- [Source: packages/plugins/tracker-bmad/src/planning.ts — computeSprintPlan]
- [Source: packages/plugins/tracker-bmad/src/dependencies.ts — dependency graph]
- [Source: packages/cli/src/commands/plan.ts — existing ao plan command]
- [Source: packages/cli/src/commands/sprint-plan.ts — existing ao sprint-plan command]
- [Source: packages/cli/src/lib/format.ts — CLI formatting utilities]
- [Source: packages/core/src/types.ts — StoryStatus, StoryState, AgentAssignment]
- [Source: _bmad-output/project-context.md — coding rules 71-86, 189-218]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — clean implementation with no debugging needed.

### Completion Notes List

- Implemented two-path strategy in `plan.ts`: Path 1 (tracker plugin via `computeSprintPlan`) preserved unchanged; Path 2 (YAML fallback) added with `parseSprintStatusYaml()` function
- Added `--full` flag for epic-grouped view alongside existing `--json` and `--accept` flags
- Used direct YAML parsing instead of `readSprintStatus()` from tracker-bmad — the sprint-status.yaml uses flat `key: string` format but `readSprintStatus()` expects `Record<string, SprintStatusEntry>` objects. This avoids the CLI-to-plugin coupling AND the type mismatch
- Story title generation uses `storyKeyToTitle()` which converts kebab-case IDs to Title Case (e.g., "1-2-user-auth" → "User Auth")
- Epic grouping parses the numeric prefix from story IDs using regex — no external dependency data needed
- All 509 CLI tests pass (13 new + 1 updated + 495 existing unchanged)
- Typecheck clean, lint clean (0 errors)

### Change Log

- 2026-03-15: Implemented Story 1.1 — Sprint Plan CLI & Data Model Foundation
- 2026-03-15: Code review fixes — 8 issues fixed (3 HIGH, 3 MEDIUM, 2 LOW):
  - H1: Added type validation for `development_status` (reject non-mapping values)
  - H2: Added `StoryStatus` validation with warning for unknown values (defaults to `backlog`)
  - H3: Added `review` field to `SprintPlanView` and "IN REVIEW" section to default view
  - M1: `--accept` flag now errors with helpful message in YAML fallback path
  - M2: Added blocked/review/validation tests (5 new tests) and fixture with blocked story
  - M3: Moved `startTime` to Path 2 only (no dead code in Path 1)
  - L1: Extracted `COLUMN_WIDTH = 48` constant
  - L2: Added empty-slug guard to `storyKeyToTitle()`

### File List

**New files:**
- `packages/cli/__tests__/commands/plan-yaml-fallback.test.ts` — 13 tests for YAML fallback path
- `packages/cli/__tests__/fixtures/sprint-status-plan-view.yaml` — committed test fixture (8 stories, 3 epics)

**Modified files:**
- `packages/core/src/types.ts` — Added `SprintPlanView` (with `review` field), `SprintSummary`, `ActionableStory` interfaces
- `packages/core/src/index.ts` — Added barrel exports for new types
- `packages/cli/src/commands/plan.ts` — Added YAML fallback path, `--full` flag, progressive disclosure output, epic grouping, input validation, review/blocked sections
- `packages/cli/__tests__/commands/plan.test.ts` — Updated "handles non-bmad tracker" test to match new fallback behavior
