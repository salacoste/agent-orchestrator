# Story 1.4: Resume Blocked Stories

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to resume a blocked story after resolving the blocking issue,
so that work continues without re-spawning from scratch.

## Acceptance Criteria

1. `ao resume STORY-005` clears blocked status, re-adds to in-memory queue with priority boost (+10) — resumed agent registered with `priority` field on `AgentAssignment`, sprint status updated from "blocked" to "in-progress"
2. Non-blocked story → error message + `process.exit(1)` (currently returns with exit code 0 — must be fixed)
3. Resume count incremented, previous agent context preserved — via `registry.incrementRetry()` and `formatResumeContext()` (both already work, verify integration)
4. Confirmation displayed with story title and blocking reason that was cleared — show `failureReason` from previous agent's metadata (failed/crashed/timed_out/disconnected) alongside story title and retry count
5. Completes within 500ms (NFR-P8) — refers to the status update + registry operations, not the full spawn cycle

## Tasks / Subtasks

- [x] Task 1: Wire completion/blocked detection for resumed sessions (AC: #1)
  - [x] 1.1 Extract `wireDetection()` from `packages/cli/src/commands/spawn.ts` into a shared utility at `packages/cli/src/lib/wire-detection.ts` — the function currently lives as a private function in spawn.ts (line 355) and needs to be importable by resume.ts. Keep the original call site in spawn.ts working by importing from the new location.
  - [x] 1.2 In `packages/cli/src/commands/resume.ts` `resumeStory()`: after session spawn + registry registration (line 499), call `wireDetection()` with the same parameters as spawn.ts — pass `config`, `projectId`, `session.id`, `sessionsDir`, `project.path`, `registry`. Wrap in try-catch for graceful degradation (same pattern as spawn.ts line 340-348).
  - [x] 1.3 The `storyDir` parameter to `wireDetection()` should be `project.path` (the project root), NOT a subdirectory — this was a bug fixed in Story 1.3 via `overrideSessionsDir`. For resume, the project path comes from `config.projects[projectId].path`.

- [x] Task 2: Add priority field to AgentAssignment (AC: #1)
  - [x] 2.1 Add optional `priority` field to `AgentAssignment` interface in `packages/core/src/types.ts` at line 1242 — `priority?: number;` with JSDoc: "Priority for assignment queue. Higher = more priority. Resumed stories get +10 boost."
  - [x] 2.2 In `packages/cli/src/commands/resume.ts`: when calling `registry.register()` (line 490), add `priority: 10` to the assignment object. This prepares for Story 1.5 (multi-agent auto-assignment) which will sort by priority.
  - [x] 2.3 In `packages/core/src/agent-registry.ts`: ensure `register()` persists the `priority` field to metadata via `updateMetadata()`. Check if the field is already forwarded — if not, add it to the metadata write.
  - [x] 2.4 In `packages/cli/src/commands/spawn.ts` `spawnWithStory()`: when registering fresh spawns, set `priority: 0` (default) so all assignments have the field.

- [x] Task 3: Fix non-blocked story error handling (AC: #2)
  - [x] 3.1 In `resume.ts` line 330-338: change the non-blocked story handler to call `process.exit(1)` instead of `return`. Currently uses `spinner.info()` + `console.log()` + `return` — must be `spinner.fail()` + `console.error()` + `process.exit(1)` per AC.
  - [x] 3.2 Update the error message to be clearer: `"Cannot resume: story ${storyId} is not blocked (current status: ${storyStatus}). Only blocked stories can be resumed."` — output to stderr via `console.error()`.

- [x] Task 4: Enhance confirmation display with blocking reason (AC: #4)
  - [x] 4.1 After loading `previousMetadata` (line 380-384): extract `failureReason` from metadata. Map to human-readable text using `formatFailureReason()` from `packages/core/src/completion-handlers.ts` (line 374).
  - [x] 4.2 In the confirmation display block (lines 461-472): add a line showing the blocking reason: `"Reason:  ${chalk.red(formattedReason)}"` between "Previous:" and "New agent:".
  - [x] 4.3 After successful spawn, in the final summary block (lines 524-534): add a clear "Cleared:" line showing what blocking status was resolved: `"✓ Cleared: ${formattedReason} → now in-progress"`.

- [x] Task 5: Kill cleanup integration (deferred from Story 1.3)
  - [x] 5.1 In `packages/core/src/session-manager.ts` `kill()` method: after destroying runtime and archiving metadata, check if the killed session has a story assignment via `registry.getByAgent(sessionId)`. If it does, update sprint-status.yaml to "blocked" (unless story is already "done") and log a `story_blocked` audit event.
  - [x] 5.2 Store `failureReason: "disconnected"` in metadata via `updateMetadata()` before archiving — this preserves the reason for the `ao resume` command to display.
  - [x] 5.3 Call `registry.remove(sessionId)` to clean up the assignment.
  - [x] 5.4 This only applies when the killed session has a story assignment. Sessions without story assignments (regular `ao spawn` without `--story`) should continue to work exactly as before.

- [x] Task 6: Write tests (AC: #1-#5)
  - [x] 6.1 Create `packages/cli/__tests__/commands/resume.test.ts` — unit tests for resume command behavior
  - [x] 6.2 Test: resume wires detection for new session (mock wireDetection, verify it's called after spawn)
  - [x] 6.3 Test: resume sets priority=10 on the new assignment in registry
  - [x] 6.4 Test: non-blocked story returns exit code 1 (mock process.exit, verify called with 1)
  - [x] 6.5 Test: confirmation display includes blocking reason from previous metadata
  - [x] 6.6 Test: story not found returns exit code 1
  - [x] 6.7 Test: no previous assignment returns exit code 1
  - [x] 6.8 Create `packages/core/src/__tests__/kill-story-cleanup.test.ts` — tests for kill cleanup integration
  - [x] 6.9 Test: killing a story-assigned session updates sprint status to "blocked"
  - [x] 6.10 Test: killing a story-assigned session stores disconnected reason in metadata
  - [x] 6.11 Test: killing a non-story session does NOT touch sprint status
  - [x] 6.12 Test: killing a session whose story is already "done" does NOT change it to "blocked"

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
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [ ] `AgentRegistry.register(assignment)` — register new assignment with priority field [Source: packages/core/src/types.ts:1254]
- [ ] `AgentRegistry.getByAgent(agentId)` — look up assignment for kill cleanup [Source: packages/core/src/types.ts:1260]
- [ ] `AgentRegistry.getByStory(storyId)` — find previous assignment for resume [Source: packages/core/src/types.ts:1266]
- [ ] `AgentRegistry.getRetryCount(storyId)` — get retry count for display [Source: packages/core/src/types.ts:1302]
- [ ] `AgentRegistry.incrementRetry(storyId, newAgentId)` — track retry history [Source: packages/core/src/types.ts:1308]
- [ ] `AgentRegistry.getRetryHistory(storyId)` — display previous attempts [Source: packages/core/src/types.ts:1314]
- [ ] `AgentRegistry.remove(agentId)` — cleanup on kill [Source: packages/core/src/types.ts:1288]
- [ ] `AgentRegistry.updateStatus(agentId, status)` — update agent status [Source: packages/core/src/types.ts:1283]
- [ ] `AgentRegistry.reload()` — refresh from disk before lookups [Source: packages/core/src/types.ts:1299]
- [ ] `updateSprintStatus(projectPath, storyId, status)` — update sprint-status.yaml [Source: packages/core/src/completion-handlers.ts:80]
- [ ] `logAuditEvent(auditDir, event)` — write to JSONL audit trail [Source: packages/core/src/completion-handlers.ts:33]
- [ ] `readMetadata(dataDir, sessionId)` — read previous session's crash details [Source: packages/core/src/metadata.ts]
- [ ] `updateMetadata(dataDir, sessionId, updates)` — persist disconnected reason [Source: packages/core/src/metadata.ts]
- [ ] `formatFailureReason(reason)` — human-readable reason text [Source: packages/core/src/completion-handlers.ts:374]
- [ ] `createAgentCompletionDetector(deps)` — via wireDetection utility [Source: packages/core/src/agent-completion-detector.ts:51]
- [ ] `createBlockedAgentDetector(deps)` — via wireDetection utility [Source: packages/core/src/blocked-agent-detector.ts]
- [ ] `createCompletionHandler(...)` — via wireDetection utility [Source: packages/core/src/completion-handlers.ts:248]
- [ ] `createFailureHandler(...)` — via wireDetection utility [Source: packages/core/src/completion-handlers.ts:294]
- [ ] `SessionManager.kill(sessionId)` — session destruction with story cleanup [Source: packages/core/src/session-manager.ts]
- [ ] `SessionManager.spawn(config)` — spawn new session for resume [Source: packages/core/src/session-manager.ts]

**Feature Flags:**
- [ ] None expected — all interface methods exist from previous cycles and Story 1.3

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. This story uses only existing packages:
- `yaml` (already approved) — for sprint-status.yaml parsing
- `chalk`, `ora`, `commander` (already in CLI) — for CLI output
- All core functionality from `@composio/ao-core` and `@composio/ao-cli`

## CLI Integration Testing (if applicable)

**For stories that add or modify CLI commands:**

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

describe("ao resume", () => {
  it("should error for non-blocked story", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["resume", "1-2-test"], { cwd: env.cwd });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not blocked");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story enhances the existing `ao resume` command with three integrations deferred from Story 1.3, plus two bug fixes:

1. **Detection wiring for resumed sessions** — The `wireDetection()` function from `spawn.ts` (added in Story 1.3) monitors agent sessions for completion/blocked events. Currently only `spawnWithStory()` calls it. Resumed sessions must get the same monitoring. Extract `wireDetection()` to a shared utility so both spawn and resume can use it.

2. **Priority boost** — Add `priority` field to `AgentAssignment` interface. Default 0 for fresh spawns, +10 for resumes. Story 1.5 will use this for auto-assignment sorting. For now it's tracked but not consumed.

3. **Kill cleanup** — When `ao kill` destroys a session that has a story assignment, the story should be marked "blocked" in sprint-status.yaml and the assignment cleaned up. This was deferred from Story 1.3 (Limitation #3).

4. **Non-blocked error code fix** — `resume.ts` currently returns exit code 0 when the story isn't blocked. Must exit with code 1 per AC.

5. **Blocking reason display** — Show the `failureReason` (failed/crashed/timed_out/disconnected) in the resume confirmation output.

### Key Implementation Constraints

- **`wireDetection()` is CLI-lifetime** — Detection only runs while the CLI process is alive. If user Ctrl+C's, monitoring stops but the agent continues. This is the same limitation as Story 1.3 — persistent monitoring is deferred to Epic 2.
- **Priority field is passive** — Adding `priority` to `AgentAssignment` is forward-looking. No code consumes it yet. Story 1.5 (multi-agent assignment) will add priority-based auto-assignment.
- **Kill cleanup scope** — Only applies to sessions with story assignments. Regular `ao spawn` sessions (without `--story`) are unaffected. The kill function in `session-manager.ts` needs to be given access to the registry and sprint-status update functions.
- **`session-manager.ts` kill() modification** — The kill method currently destroys runtime, workspace, and archives metadata. Adding story status update requires passing optional dependencies (registry, project path, audit dir). Use an optional callback or config parameter to avoid coupling core to CLI concerns.

### Existing Code to Reuse (DO NOT REINVENT)

- `wireDetection()` in `packages/cli/src/commands/spawn.ts:355` — Extract, don't rewrite. Contains completion detector + blocked detector + event bus + SIGINT handler + cleanup guard.
- `formatFailureReason()` in `packages/core/src/completion-handlers.ts:374` — Maps reason enum to human-readable text.
- `createCompletionHandler()`/`createFailureHandler()` — Factory functions with `overrideSessionsDir` parameter (added in Story 1.3 code review).
- `createInMemoryEventBus()` in `packages/cli/src/commands/spawn.ts` — In-memory event bus for CLI-lifetime detection. Also needs to be extracted if used by wireDetection.
- `getRuntime()` in `packages/cli/src/lib/plugins.ts` — Resolves runtime plugin (added in Story 1.3).
- `retryWithBackoff()` in `resume.ts:235` — Already used for sprint status updates.

### Anti-Patterns to Avoid

- **Do NOT duplicate `wireDetection()`** — Extract it to `packages/cli/src/lib/wire-detection.ts`. Import from both spawn.ts and resume.ts.
- **Do NOT make `session-manager.ts` depend on CLI code** — The kill cleanup should use an event/callback pattern, not import CLI-specific modules.
- **Do NOT add Redis or persistent queue** — Priority is an in-memory field on `AgentAssignment`. The Redis-backed queue is deferred to Epic 2.
- **Do NOT change the resume context format** — `formatResumeContext()` in `resume-context.ts` already works correctly. Only the CLI output (confirmation display) needs enhancement.
- **Do NOT modify `AgentCompletionDetector` internals** — Story 1.3 already added error isolation. This story only wires it up for resumed sessions.

### Project Structure Notes

Files to modify:
- `packages/cli/src/commands/resume.ts` — Add wireDetection call, fix exit code, enhance display
- `packages/cli/src/commands/spawn.ts` — Extract wireDetection() and createInMemoryEventBus() to shared utility
- `packages/cli/src/lib/wire-detection.ts` — NEW: Shared wireDetection utility
- `packages/core/src/types.ts` — Add `priority?: number` to `AgentAssignment`
- `packages/core/src/session-manager.ts` — Add optional story cleanup on kill
- `packages/core/src/agent-registry.ts` — Persist priority field in metadata

Files to create:
- `packages/cli/__tests__/commands/resume.test.ts` — Resume command tests
- `packages/core/src/__tests__/kill-story-cleanup.test.ts` — Kill cleanup tests

### Cross-Story Dependencies

- **Story 1.3 (done)**: Provided `wireDetection()`, `createInMemoryEventBus()`, `getRuntime()`, completion/blocked handler factories with `overrideSessionsDir`, error isolation in handler dispatch, cleanup guard. This story builds directly on it.
- **Story 1.5 (backlog)**: Multi-agent assignment — will consume the `priority` field added in this story for priority-based auto-assignment sorting.
- **Epic 2 (backlog)**: Real-time sprint state sync — will replace CLI-lifetime detection with persistent event-driven monitoring.

### References

- [Source: packages/cli/src/commands/resume.ts] — Existing resume implementation (585 lines)
- [Source: packages/cli/src/commands/spawn.ts:355-455] — wireDetection() function to extract
- [Source: packages/cli/src/lib/resume-context.ts] — Resume context formatter (DO NOT modify)
- [Source: packages/core/src/types.ts:1232-1243] — AgentAssignment interface (add priority field)
- [Source: packages/core/src/completion-handlers.ts:374-382] — formatFailureReason() for display
- [Source: packages/core/src/session-manager.ts] — kill() method for story cleanup integration
- [Source: packages/core/src/agent-registry.ts] — register(), getByAgent(), remove() for kill cleanup
- [Source: _bmad-output/planning-artifacts/epics.md:451-467] — Epic 1 Story 1.4 definition
- [Source: _bmad-output/implementation-artifacts/1-3-agent-story-status-tracking-completion-detection.md:240-258] — Deferred items resolved by this story (items #2, #3)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**Modified:**
- `packages/cli/src/commands/resume.ts` — wireDetection call, priority=10, exit code fix, blocking reason display
- `packages/cli/src/commands/spawn.ts` — Extract wireDetection to shared lib, priority=0 for fresh spawns
- `packages/core/src/types.ts` — Added `priority?: number` to AgentAssignment interface
- `packages/core/src/session-manager.ts` — Kill cleanup: story status → blocked, disconnected metadata, audit log, registry.remove()
- `packages/core/src/agent-registry.ts` — Persist priority field in metadata read/write
- `packages/cli/__tests__/commands/resume.test.ts` — 12 new tests (source-scanning + behavioral)

**New:**
- `packages/cli/src/lib/wire-detection.ts` — Shared wireDetection + createInMemoryEventBus utility
- `packages/core/src/__tests__/kill-story-cleanup.test.ts` — 4 kill cleanup integration tests
