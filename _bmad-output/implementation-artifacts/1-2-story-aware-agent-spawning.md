# Story 1.2: Story-Aware Agent Spawning

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Product Manager,
I want to spawn an agent with story context from sprint-status.yaml via `ao spawn --story`,
so that agents begin work with full acceptance criteria without manual setup.

## Acceptance Criteria

1. `ao spawn --story <id>` reads story from sprint-status.yaml, locates the story file, and passes context (title, description, ACs) via the prompt builder — integrating with the existing 3-layer prompt architecture
2. Optional `--agent <name>` flag to select specific agent plugin (e.g., `claude-code`, `codex`) — already exists on `ao spawn`, ensure it works with `--story`
3. Unresolved dependencies (stories this one depends on that are not `done`) → warning message listing blockers + confirmation prompt before proceeding
4. Spawn completes within 10s (NFR-P4), uses existing Runtime plugin — no new runtime dependencies
5. Agent-story assignment tracked via `AgentRegistry` (in-memory + flat metadata files, no Redis) — includes context hash for conflict detection
6. Works with `runtime-process` plugin in tests (no tmux dependency in CI)
7. Conflict detection via existing `ConflictDetectionService` — warn if another agent is already assigned to the same story

## Tasks / Subtasks

- [x] Task 1: Add `--story <id>` flag to `ao spawn` command (AC: #1, #2)
  - [x] 1.1 Add `--story <id>` option to `registerSpawn()` in `packages/cli/src/commands/spawn.ts` — note: `spawn.ts` has an existing optional `[issue]` argument; when `--story` is provided, it takes precedence over `[issue]` and the storyId is used as `issueId` for branch naming. If both `--story` and `[issue]` are provided, `--story` wins.
  - [x] 1.2 When `--story` is provided, read sprint-status.yaml from project path (reuse pattern from `spawn-story.ts:readSprintStatus()`)
  - [x] 1.3 Find and parse story file using `findStoryFile()` + `parseStoryFile()` patterns from `spawn-story.ts`
  - [x] 1.4 Pass story context to session manager via `storyContext` field (compose story prompt with `formatStoryPrompt()`) — routed through prompt builder Layer 2 (not `prompt` field)
  - [x] 1.5 Ensure `--agent` override works when `--story` is also specified
  - [x] 1.6 Pass `storyId` in `SessionSpawnConfig.issueId` so branch naming uses the story ID

- [x] Task 2: Integrate story context with prompt builder (AC: #1)
  - [x] 2.1 Add `storyContext?: string` field to `PromptBuildConfig` in `packages/core/src/prompt-builder.ts`
  - [x] 2.2 Add "## Story Context" section to Layer 2 (`buildConfigLayer`) when `storyContext` is present — renders title, description, ACs, epic, and dependencies
  - [x] 2.3 Update `buildPrompt()` to return non-null when `storyContext` is provided (triggers Layer 1+2)
  - [x] 2.4 Update session manager `spawn()` to pass `storyContext` field through to `buildPrompt()` if present in spawn config

- [x] Task 3: Add dependency warning + confirmation prompt (AC: #3)
  - [x] 3.1 When `--story` is used, check sprint-status.yaml `dependencies` section (if it exists) for story's deps
  - [x] 3.2 Cross-reference dependency statuses — any dep not in `done` status is "unresolved"
  - [x] 3.3 If unresolved deps found, display warning with list of blocking stories and their statuses
  - [x] 3.4 Prompt user for confirmation (`[y/N]`) before proceeding — respect `--force` flag to skip
  - [x] 3.5 If no `dependencies` section in sprint-status.yaml, skip silently (no deps to check)

- [x] Task 4: Agent registry integration + conflict detection (AC: #5, #7)
  - [x] 4.1 After successful spawn, register agent-story assignment via `AgentRegistry.register()` (reuse pattern from `spawn-story.ts:604-616`)
  - [x] 4.2 Before spawn, check for conflicts via `ConflictDetectionService.canAssign()` — warn if story already has active agent
  - [x] 4.3 Store `storyId` in session metadata (flat file) for lifecycle tracking
  - [x] 4.4 Compute context hash via `computeStoryContextHash()` for conflict detection

- [x] Task 5: Write tests with `runtime-process` plugin (AC: #4, #6)
  - [x] 5.1 Create `packages/cli/__tests__/commands/spawn-story-flag.test.ts` — unit tests for `--story` flag on `ao spawn`
  - [x] 5.2 Mock `@composio/ao-core` loadConfig, session manager, agent registry
  - [x] 5.3 Test: `ao spawn <project> --story 1-2-foo` reads sprint-status.yaml and spawns with story prompt
  - [x] 5.4 Test: `ao spawn <project> --story 1-2-foo --agent codex` passes agent override
  - [x] 5.5 Test: `--story` with missing sprint-status.yaml → error message + exit code 1
  - [x] 5.6 Test: `--story` with missing story file → error message + exit code 1
  - [x] 5.7 Test: `--story` with story not found in sprint-status.yaml → error message with available stories
  - [x] 5.8 Test: conflict detection warns when story already assigned
  - [x] 5.9 Test: dependency warning when unresolved deps exist (tested via --force flag bypass)
  - [x] 5.10 Create test fixture: sprint-status.yaml with stories and dependencies in `__tests__/fixtures/`

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
- [x] `buildPrompt()` from `@composio/ao-core` — verified exists in `core/src/prompt-builder.ts:148`
- [x] `PromptBuildConfig` interface — verified exists in `core/src/prompt-builder.ts:46`
- [x] `SessionSpawnConfig` interface — verified exists in `core/src/types.ts:192`
- [x] `getAgentRegistry()` from `@composio/ao-core` — verified exists in `core/src/agent-registry.ts`
- [x] `computeStoryContextHash()` from `@composio/ao-core` — verified exists in `core/src/agent-registry.ts`
- [x] `AgentRegistry.register()` — verified exists in `core/src/agent-registry.ts`
- [x] `AgentRegistry.findActiveByStory()` — verified exists in `core/src/agent-registry.ts`
- [x] `createConflictDetectionService()` from `@composio/ao-core` — verified exists
- [x] `ConflictDetectionService.canAssign()` — verified exists
- [x] `getSessionsDir()` from `@composio/ao-core` — verified exists in `core/src/paths.ts`
- [x] `resolveProject()` from `cli/src/lib/resolve-project.ts` — verified exists, used in Story 1.1
- [x] `header()` from `cli/src/lib/format.ts` — verified exists, used in Story 1.1

**Feature Flags:**
- [x] None needed — all required interfaces exist

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. All needed libraries are already approved:
- `yaml` (2.8.2, ISC) — approved in previous cycle Story 2-5
- `chalk` (5.x, MIT) — existing CLI dependency
- `commander` (11.x, MIT) — existing CLI framework
- `ora` (8.x, MIT) — existing CLI spinner dependency

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

describe("ao spawn --story", () => {
  it("should spawn agent with story context", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["spawn", "myproject", "--story", "1-2-foo"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Session");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Critical: `ao spawn-story` Already Exists — REUSE, Don't Reinvent

The codebase already has a fully functional `ao spawn-story` command at `packages/cli/src/commands/spawn-story.ts` (661 lines) that implements ~80% of this story's requirements. **Do NOT rewrite this from scratch.**

**What `spawn-story.ts` already does:**

| Feature | Location | Status |
|---------|----------|--------|
| Read sprint-status.yaml | `readSprintStatus()` (line 82) | Uses CWD, needs project.path |
| Find story file by ID | `findStoryFile()` (line 115) | Direct + prefix match |
| Parse story file | `parseStoryFile()` (line 134) | Extracts title, desc, ACs |
| Format story prompt | `formatStoryPrompt()` (line 202) | Markdown prompt with sections |
| Conflict detection | Lines 396-530 | Full ConflictDetectionService + resolution |
| Agent registry | Lines 604-616 | register() + computeStoryContextHash() |
| Agent readiness check | `waitForAgentReady()` (line 242) | 10s timeout poll |
| tmux check | `checkTmuxWithTimeout()` (line 66) | 30s timeout execFile |
| Epic ID extraction | `extractEpicId()` (line 106) | "1-2-cli" → "epic-1" |
| Confirmation prompt | `promptConfirmation()` (line 277) | CLI `[y/N]` prompt |
| Project auto-detect | `getProjectId()` (line 262) | Detect project from CWD |
| Duration formatting | `formatDuration()` (line 50) | "2m ago" display |
| Duplicate detection | Via ConflictDetectionService | Prevents same story on two agents |

**What's MISSING from `spawn-story.ts` (gaps this story fills):**

| Gap | Detail | Resolution |
|-----|--------|------------|
| Command UX | Standalone `ao spawn-story --story <id>` | Add `--story` to `ao spawn` |
| Prompt builder integration | Story context as raw prompt string | Route through `buildPrompt()` Layer 2 |
| Dependency warnings | No unresolved-dep detection | Check sprint-status deps section |
| Runtime-process tests | tmux-only validation | Mock runtime in tests |
| Project path | Uses `process.cwd()` for sprint-status | Use `project.path` from config |

### Implementation Strategy

**Approach:** Add `--story <id>` option to `ao spawn` that reuses helper functions from `spawn-story.ts`, but integrates properly with the existing spawn pipeline.

**Two options for code reuse:**
1. **Extract helpers** from `spawn-story.ts` into `cli/src/lib/story-context.ts` and import in both commands
2. **Import directly** from `spawn-story.ts` by exporting the helper functions

**Recommended: Option 1** (extract helpers). This prevents circular deps and keeps `spawn-story.ts` as the existing standalone command (no breaking changes).

**Helpers to extract to `cli/src/lib/story-context.ts`:**
- `readSprintStatus(projectPath: string)` — read and parse sprint-status.yaml from project path
- `findStoryFile(storyId: string, storyLocation: string)` — find story .md file
- `parseStoryFile(filePath: string, storyId: string)` — extract title, description, ACs
- `formatStoryPrompt(story: StoryContext)` — compose markdown prompt
- `extractEpicId(storyId: string)` — extract epic ID from story ID (e.g., "1-2-cli" → "epic-1"), populates `StoryContext.epic`
- `promptConfirmation(message: string)` — CLI confirmation prompt (`[y/N]`), used by Task 3.4 for dep warning
- `getProjectId(cwd: string)` — auto-detect project ID from working directory (useful for `--story` without explicit project)
- `formatDuration(ms: number)` — format elapsed time display (e.g., "2m ago"), used in conflict detection output
- `StoryContext` interface — id, title, status, description, acceptanceCriteria, deps, priority, epic
- `SprintStatus` interface — project, development_status, dependencies, priorities

**Why a dedicated `storyContext` field instead of reusing `prompt`:**
The existing `spawn-story.ts` (line 596-600) passes story context via the `prompt` field to session manager. This story introduces a separate `storyContext` field on `SessionSpawnConfig` and `PromptBuildConfig` because: (1) `prompt` is for user-supplied free text; mixing it with structured story data loses the separation between user intent and story metadata. (2) The prompt builder's Layer 2 (`buildConfigLayer`) can render story context in a consistent format alongside project context and issue details, rather than dumping it into the user prompt layer. (3) Future stories (1.3, 1.4) need to distinguish "user prompt" from "story context" for status tracking and resume operations.

**Prompt builder enhancement:**
```typescript
// In PromptBuildConfig, add:
storyContext?: string;  // Pre-formatted story context

// In buildConfigLayer(), add after issueContext:
if (storyContext) {
  lines.push(`\n## Story Context`);
  lines.push(storyContext);
}

// In buildPrompt(), update hasSomething check:
const hasStory = Boolean(config.storyContext);
if (!hasIssue && !hasRules && !hasUserPrompt && !hasStory) {
  return null;
}
```

**Session manager enhancement:**
```typescript
// In SessionSpawnConfig, add:
storyContext?: string;  // Forwarded to prompt builder

// In spawn(), pass to buildPrompt:
const composedPrompt = buildPrompt({
  project,
  projectId: spawnConfig.projectId,
  issueId: spawnConfig.issueId,
  issueContext,
  storyContext: spawnConfig.storyContext,
  userPrompt: spawnConfig.prompt,
});
```

### Existing Code to REUSE (not rewrite)

All helpers from `spawn-story.ts` are listed in the table above under "What `spawn-story.ts` already does" — extract those to `lib/story-context.ts`. Additional modules to import directly:

| Module | Location | How to Reuse |
|--------|----------|-------------|
| Agent registry | `core/src/agent-registry.ts` | Import `getAgentRegistry()`, `computeStoryContextHash()` |
| Prompt builder | `core/src/prompt-builder.ts` | Extend `PromptBuildConfig` + `buildConfigLayer()` |
| Session manager | `core/src/session-manager.ts` | Extend `SessionSpawnConfig` (defined in `types.ts:192`) |
| Format utilities | `cli/src/lib/format.ts` | Import `header()` |
| Resolve project | `cli/src/lib/resolve-project.ts` | Import `resolveProject()` |

### Sprint Status YAML Path Resolution

The existing `spawn-story.ts` reads sprint-status.yaml from `process.cwd()` (line 354). This story should use the project path from config instead:

```typescript
const storyDir = typeof project.tracker?.["storyDir"] === "string"
  ? project.tracker["storyDir"]
  : "_bmad-output/implementation-artifacts";
const sprintStatusPath = join(project.path, storyDir, "sprint-status.yaml");
```

This pattern was established in Story 1.1 (`plan.ts:399-402`).

### Testing Strategy

- Follow `vi.hoisted()` mock pattern from `plan.test.ts` and `plan-yaml-fallback.test.ts`
- Mock `@composio/ao-core` loadConfig, getAgentRegistry, getSessionsDir, createConflictDetectionService
- Mock session manager's `spawn()` to return a fake session (avoid tmux dependency)
- Create committed fixtures in `__tests__/fixtures/`:
  - `sprint-status-spawn.yaml` — sprint status with stories and dependencies
  - `1-2-test-story.md` — story file with title, description, ACs for test parsing
- Test error paths: missing file, missing story, conflict detected, unresolved deps
- Test happy path: `--story` flag correctly reads context and passes to spawn

### Key Patterns from Story 1.1 Code Review

Applied learnings from Story 1.1's code review:
- **Validate external data** — type-check sprint-status.yaml fields (H1/H2 from Story 1.1)
- **Use constants** — column widths, valid status sets
- **Test edge cases** — blocked/review status, unknown status values, empty data
- **No dead code** — don't compute `startTime` unless actually checking performance
- **Guard empty slugs** — `storyKeyToTitle()` pattern for empty slug fallback

### Project Structure Notes

- All CLI changes in `packages/cli/src/commands/` and `packages/cli/src/lib/`
- Core changes in `packages/core/src/prompt-builder.ts` and `packages/core/src/types.ts`
- New helper file: `packages/cli/src/lib/story-context.ts`
- Import paths use `.js` extension (ESM requirement)
- `node:` prefix for built-in modules

### Limitations (Deferred Items)

1. **Sprint-status.yaml dependency section**
   - Status: Deferred — most sprint-status.yaml files don't have a `dependencies` section
   - Requires: Sprint planning to generate dependency data (from epics.md or story files)
   - Epic: Story 2.3 (Dependency Resolution & Story Unblocking)
   - Current: If `dependencies` section exists, it's used; if not, dep check is silently skipped

2. **Deprecation of `ao spawn-story`**
   - Status: Deferred — `ao spawn-story` continues to work as standalone command
   - Requires: User migration and documentation update
   - Epic: Could be a tech debt story in a future cycle
   - Current: Both `ao spawn --story` and `ao spawn-story --story` will work

3. **Story-to-issue mapping**
   - Status: Deferred — no automatic mapping between story IDs and tracker issue IDs
   - Requires: Tracker plugin method to resolve story → issue
   - Epic: Story 1.3 (Agent Story Status Tracking)
   - Current: `--story` and `--issue` are separate flags; story uses `storyId` as `issueId` for branch naming

4. **Event Bus integration for agent-story assignment events**
   - Status: Deferred — architecture (AR1, AR3) envisions `agent.assigned` and `story.assigned` events published to the event bus when an agent spawns with a story
   - Requires: Event Bus infrastructure (Epic 2: Real-Time Sprint State Sync)
   - Epic: Story 2.2 (Story Lifecycle Event Types & Publishing)
   - Current: Agent registry is updated directly via flat files; no events are published. Dashboard and `ao fleet` poll the registry instead of receiving real-time events. Do NOT implement event publishing in this story — Epic 2 owns the event bus.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — AR3 (Agent Coordinator), AR6 (CLI Commands)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR1, FR3, FR4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX1 (CLI Visual Patterns), agent spawn flow]
- [Source: packages/cli/src/commands/spawn-story.ts — existing spawn-story command (661 lines)]
- [Source: packages/cli/src/commands/spawn.ts — existing ao spawn command]
- [Source: packages/core/src/session-manager.ts — SessionManager.spawn() at line 317]
- [Source: packages/core/src/prompt-builder.ts — 3-layer prompt architecture]
- [Source: packages/core/src/agent-registry.ts — AgentRegistry, computeStoryContextHash()]
- [Source: packages/core/src/types.ts — SessionSpawnConfig (line 192), AgentLaunchConfig (line 357)]
- [Source: packages/plugins/runtime-tmux/src/index.ts — Runtime.create() environment passing]
- [Source: packages/plugins/agent-claude-code/src/index.ts — Agent.getLaunchCommand()]
- [Source: _bmad-output/implementation-artifacts/1-1-sprint-plan-cli-data-model-foundation.md — Previous story learnings]
- [Source: _bmad-output/project-context.md — coding rules 88-92 (shell security), 113-115 (singletons), 210-217 (vitest mocking)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- **Task 1 (--story flag):** Added `--story <id>` and `--force` options to `registerSpawn()`. Implemented `spawnWithStory()` flow that reads sprint-status.yaml, parses story file, checks dependencies, detects conflicts, displays summary, spawns agent, and registers assignment. `--story` takes precedence over `[issue]` argument. Story ID normalized by stripping `story-` prefix.
- **Task 2 (prompt builder):** Added `storyContext?: string` to `PromptBuildConfig` and `SessionSpawnConfig`. Story context rendered as `## Story Context` section in Layer 2 after `## Issue Details`. Session manager forwards `storyContext` from spawn config to prompt builder.
- **Task 3 (dependency warnings):** Checks `dependencies` section of sprint-status.yaml. Unresolved deps (status != "done") trigger warning with list of blockers. User prompted for confirmation; `--force` flag bypasses. Missing `dependencies` section silently skipped.
- **Task 4 (registry + conflicts):** After spawn, registers agent-story assignment via `AgentRegistry.register()` with agentId, storyId, status, and contextHash. Before spawn, checks `ConflictDetectionService.canAssign()` and warns if another agent is active on the same story. `storyId` written to session metadata via `updateMetadata()` for lifecycle tracking.
- **Task 5 (tests):** 16 tests in `spawn-story-flag.test.ts` covering AC#1 (story prompt), AC#2 (agent override), missing sprint-status, story not found, missing story file, AC#5 (registry), Task 1.6 (issueId), prefix normalization, summary display, precedence, AC#3 dependency warning, AC#7 conflict detection (2 tests), input validation, backward compatibility (2 tests). 22 tests in `story-context.test.ts` covering all extracted helper functions. 4 new tests in `prompt-builder.test.ts` for storyContext integration.
- **Code review fixes:** (H1) Added dependency warning test, (H2) Added `storyId` metadata via `updateMetadata()`, (M1) Added storyId format validation to prevent path traversal, (M2) Fixed parameter reassignment — `rawStoryId` param + `const storyId`, (M4) Fixed available stories count using filtered array length.
- **All 1050 core + 547 CLI tests passing. Lint clean, typecheck clean.**

### File List

**New files:**
- `packages/cli/src/lib/story-context.ts` — Extracted helper functions (readSprintStatus, findStoryFile, parseStoryFile, formatStoryPrompt, extractEpicId, formatDuration, promptConfirmation) and interfaces (SprintStatus, StoryContext) for reuse across spawn commands
- `packages/cli/__tests__/lib/story-context.test.ts` — 22 unit tests for all story-context helpers
- `packages/cli/__tests__/commands/spawn-story-flag.test.ts` — 16 tests for `ao spawn --story` flag (includes dependency warning + input validation)
- `packages/cli/__tests__/fixtures/sprint-status-spawn.yaml` — Test fixture: sprint status with stories and dependencies
- `packages/cli/__tests__/fixtures/1-2-test-story.md` — Test fixture: minimal story file for parsing tests

**Modified files:**
- `packages/cli/src/commands/spawn.ts` — Added `--story <id>` and `--force` flags, `spawnWithStory()` flow, `resolveStoryDir()` helper, imports for story-context helpers, agent registry, conflict detection
- `packages/core/src/types.ts` — Added `storyContext?: string` to `SessionSpawnConfig` interface
- `packages/core/src/prompt-builder.ts` — Added `storyContext?: string` to `PromptBuildConfig`, `## Story Context` section in Layer 2, `hasStory` check in null-return logic
- `packages/core/src/session-manager.ts` — Updated `buildPrompt()` call to pass `storyContext` from spawn config
- `packages/core/src/__tests__/prompt-builder.test.ts` — 4 new tests for storyContext integration
