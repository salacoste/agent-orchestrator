# Story 1.3: Agent-Story Status Tracking & Completion Detection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to see which agent is working on which story and get automatic status updates when agents complete or get blocked,
so that I have real-time visibility into agent progress without manual checking.

## Acceptance Criteria

1. `ao status` shows agent-story mapping table (agent ID, story ID, agent status, runtime duration) — sourced from `AgentRegistry` assignments, merged with existing session info
2. `ao status --story <id>` shows detailed story status with assigned agent info, sprint-status.yaml state, and dependency status
3. Agent completion detected via process exit code (0 = done, non-zero = failed) — wired through `AgentCompletionDetector` → `CompletionHandler` → `AgentRegistry.updateStatus()` + `updateSprintStatus()` for story-spawned sessions
4. Blocked detection via configurable inactivity threshold (default per agent type: claude-code 10m, codex 5m, aider 15m) — wired through `BlockedAgentDetector` → `AgentRegistry.updateStatus("blocked")` for story-spawned sessions
5. Status updates written to session metadata files for persistence across CLI invocations (via `updateMetadata()`)
6. Integrates with existing `agent-completion-detector.ts` and `blocked-agent-detector.ts` — extends, does not duplicate

## Tasks / Subtasks

- [x] Task 1: Enhance `ao status` with agent-story mapping (AC: #1)
  - [x] 1.1 Import `getAgentRegistry` from `@composio/ao-core` in `packages/cli/src/commands/status.ts`
  - [x] 1.2 After gathering session info, look up each session's agent assignment via `registry.getByAgent(session.id)` — if assignment exists, enrich `SessionInfo` with `storyId`, `agentStatus`, and `assignedAt`
  - [x] 1.3 Add `storyId` and `agentStatus` columns to the status table — insert between "Branch" and "PR" columns: `Story` (12 chars) and `AgentSt` (8 chars)
  - [x] 1.4 Show story assignment row: story ID in magenta, agent status color-coded (active=green, blocked=red, idle=yellow, completed=dim)
  - [x] 1.5 Include `storyId` and `agentStatus` in JSON output (`--json` flag)

- [x] Task 2: Add `--story <id>` filter to `ao status` (AC: #2)
  - [x] 2.1 Add `--story <id>` option to the `status` command in `registerStatus()`
  - [x] 2.2 When `--story` is provided, filter sessions to only those assigned to the given story (via `registry.findActiveByStory(storyId)`)
  - [x] 2.3 Show detailed story view: story status from sprint-status.yaml, assigned agent info (ID, status, duration), dependency status (resolved/unresolved deps from sprint-status.yaml `dependencies` section)
  - [x] 2.4 If no agent is assigned to the story, show story status from sprint-status.yaml with "(no agent assigned)" message
  - [x] 2.5 Reuse `readSprintStatus()` pattern from `packages/cli/src/lib/story-context.ts` for YAML loading

- [x] Task 3: Wire completion detection for story-spawned sessions (AC: #3, #5)
  - [x] 3.1 In `packages/cli/src/commands/spawn.ts` `spawnWithStory()`: after spawn + registry registration, call `completionDetector.monitor(sessionId)` to start polling — create detector via `createAgentCompletionDetector({ runtime, registry })`
  - [x] 3.2 Register completion handler via `detector.onCompletion()` using `createCompletionHandler()` from `packages/core/src/completion-handlers.ts` — this already handles: registry removal, `updateSprintStatus()` to "done", audit trail logging, dependent story unblocking
  - [x] 3.3 Register failure handler via `detector.onFailure()` using `createFailureHandler()` from `packages/core/src/completion-handlers.ts` — this already handles: registry removal, `updateSprintStatus()` to "blocked", metadata update with exit code/signal/reason, notification
  - [x] 3.4 Pass the runtime plugin (resolved from config) to `createAgentCompletionDetector()` — added `getRuntime()` to `packages/cli/src/lib/plugins.ts`
  - [x] 3.5 Update session metadata with `agentStatus: "active"` after spawn via `updateMetadata(sessionsDir, sessionId, { storyId, agentStatus: "active" })`

- [x] Task 4: Wire blocked detection for story-spawned sessions (AC: #4, #5)
  - [x] 4.1 In the spawn flow, after starting completion monitoring, also initialize blocked detection: `createBlockedAgentDetector({ eventBus, registry, sessionManager })` with `startDetection()` — uses in-memory EventBus for CLI-lifetime event dispatch
  - [x] 4.2 Call `blockedDetector.trackActivity(sessionId)` to register initial activity timestamp
  - [x] 4.3 Subscribe to `agent.blocked` events on the event bus — when received for a story-spawned agent, call `registry.updateStatus(agentId, "blocked")` and `updateMetadata(sessionsDir, agentId, { agentStatus: "blocked" })`
  - [x] 4.4 Subscribe to `agent.resumed` events — when received, call `registry.updateStatus(agentId, "active")` and update metadata accordingly
  - [x] 4.5 Ensure blocked detector respects agent-type-specific timeouts (claude-code: 10m, codex: 5m, aider: 15m) — these are already configured as defaults in `blocked-agent-detector.ts`

- [x] Task 5: Handle lifecycle edge cases (AC: #3, #4, #6)
  - [x] 5.1 Completion detector detects process exit via `runtime.isAlive()` polling and fires completion/failure handlers accordingly
  - [x] 5.2 On completion event, `createCompletionHandler` removes agent from registry and updates sprint status
  - [x] 5.3 On failure event with `reason: "timed_out"`, `createFailureHandler` updates status to "blocked" via `updateSprintStatus()`
  - [x] 5.4 Cleanup on process exit: SIGINT handler calls `cleanup()` which unmonitors completion detector and closes blocked detector + event bus
  - [x] 5.5 Detection wiring is wrapped in try-catch — if setup fails, spawn still succeeds (graceful degradation per dev notes)

- [x] Task 6: Write tests (AC: #1-#6)
  - [x] 6.1 Create `packages/cli/__tests__/commands/status-story.test.ts` — tests for `ao status` agent-story mapping display
  - [x] 6.2 Test: `ao status` shows story column with agent-story assignments from registry
  - [x] 6.3 Test: `ao status --story 1-2-foo` filters to specific story with detailed view
  - [x] 6.4 Test: `ao status --story 1-2-foo` with no agent assigned shows story info only
  - [x] 6.5 Test: `ao status --json` includes storyId and agentStatus in output
  - [x] 6.6 Create `packages/core/src/__tests__/completion-wiring.test.ts` — tests for completion detection wiring (11 tests)
  - [x] 6.7 Test: completion handler updates sprint status to "done" and removes agent from registry
  - [x] 6.8 Test: failure handler updates sprint status to "blocked" and removes agent from registry
  - [x] 6.9 Test: blocked detection publishes agent.blocked event after inactivity timeout
  - [x] 6.10 Test: agent resume after blocked detection publishes agent.resumed event
  - [x] 6.11 Tests use mock runtime (no tmux dependency in CI)

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

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `AgentRegistry.getByAgent(agentId)` — get assignment by agent ID [Source: packages/core/src/types.ts:1260] — used in status.ts:91, spawn.ts wireDetection via handlers
- [x] `AgentRegistry.findActiveByStory(storyId)` — find active agent for a story [Source: packages/core/src/types.ts:1270] — used in spawn.ts:275 conflict detection
- [x] `AgentRegistry.updateStatus(agentId, status)` — update agent status [Source: packages/core/src/types.ts:1283] — used in spawn.ts:417,421 event subscriber
- [x] `AgentRegistry.register(assignment)` — register new assignment [Source: packages/core/src/types.ts:1275] — used in spawn.ts:327
- [x] `AgentRegistry.remove(agentId)` — remove agent assignment [Source: packages/core/src/types.ts:1288] — used via createCompletionHandler/createFailureHandler
- [x] `AgentCompletionDetector.monitor(agentId)` — start monitoring [Source: packages/core/src/agent-completion-detector.ts:80] — used in spawn.ts:397
- [x] `AgentCompletionDetector.unmonitor(agentId)` — stop monitoring [Source: packages/core/src/agent-completion-detector.ts:109] — used in spawn.ts:432 cleanup
- [x] `AgentCompletionDetector.onCompletion(handler)` — register completion handler [Source: packages/core/src/agent-completion-detector.ts:122] — used in spawn.ts:372,389
- [x] `AgentCompletionDetector.onFailure(handler)` — register failure handler [Source: packages/core/src/agent-completion-detector.ts:126] — used in spawn.ts:384,397
- [x] `BlockedAgentDetector.trackActivity(agentId)` — register initial activity [Source: packages/core/src/blocked-agent-detector.ts] — used in spawn.ts:408
- [x] `BlockedAgentDetector.startDetection()` — begin periodic checks [Source: packages/core/src/blocked-agent-detector.ts] — used in spawn.ts:409
- [ ] `BlockedAgentDetector.getAgentStatus(agentId)` — get blocked status — NOT USED (status is read from registry instead)
- [x] `Runtime.isAlive(handle)` — check if session is alive [Source: packages/core/src/types.ts] — used internally by AgentCompletionDetector polling
- [ ] `Runtime.getExitCode()` — get process exit code — NOT USED (deferred, see Limitations #2)
- [x] `updateMetadata(sessionsDir, sessionId, fields)` — persist status to flat file [Source: packages/core/src/metadata.ts] — used in spawn.ts:318,418,422
- [x] `updateSprintStatus(projectPath, storyId, newStatus)` — update sprint-status.yaml [Source: packages/core/src/completion-handlers.ts:80] — used via createCompletionHandler/createFailureHandler
- [x] `createCompletionHandler(registry, projectPath, configPath, auditDir, notifier?, overrideSessionsDir?)` — factory [Source: packages/core/src/completion-handlers.ts:248] — used in spawn.ts:373
- [x] `createFailureHandler(registry, projectPath, configPath, auditDir, notifier?, overrideSessionsDir?)` — factory [Source: packages/core/src/completion-handlers.ts:292] — used in spawn.ts:384
- [x] `createAgentCompletionDetector(deps)` — factory [Source: packages/core/src/agent-completion-detector.ts:51] — used in spawn.ts:367
- [x] `createBlockedAgentDetector(deps)` — factory [Source: packages/core/src/blocked-agent-detector.ts:52] — used in spawn.ts:402

**Feature Flags:**
- [x] None required — all interface methods exist. `getExitCode()` and `getAgentStatus()` exist but are not used in this story (deferred)

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. This story uses only existing packages:
- `yaml` (already approved) — for sprint-status.yaml parsing
- All other code is in `@composio/ao-core` and `@composio/ao-cli`

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

describe("ao status --story", () => {
  it("should display story-specific status", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["status", "--story", "1-2-test"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1-2-test");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story wires together existing infrastructure components that were built in the previous planning cycle but are not yet connected for story-spawned sessions. The key integration points are:

1. **`ao status` enhancement** — The current `status.ts` shows sessions with branch/PR/CI/review/activity but has no awareness of agent-story assignments from `AgentRegistry`. This story adds `storyId` and `agentStatus` columns by looking up each session in the registry, and adds `--story <id>` filtering.

2. **Completion detection wiring** — `AgentCompletionDetector` exists and polls `runtime.isAlive()` to detect process exit. `createCompletionHandler()` exists and handles sprint-status update + audit trail + dependency unblocking. What's missing: the spawn flow doesn't call `detector.monitor(sessionId)` after spawning a story-aware agent.

3. **Blocked detection wiring** — `BlockedAgentDetector` exists with agent-type-specific timeouts. It publishes `agent.blocked`/`agent.resumed` events on the event bus. What's missing: the spawn flow doesn't initialize blocked detection for story-spawned sessions, and the events don't update `AgentRegistry` status.

4. **Metadata persistence** — Story 1.2 already stores `storyId` in session metadata via `updateMetadata()`. This story adds `agentStatus` to metadata so CLI invocations can read agent status without needing a running service.

### Key Implementation Constraints

- **No long-running daemon**: The CLI is not a persistent process. Completion/blocked detection must work in the context of the spawn process lifetime. If the CLI exits, detection stops. This is acceptable for MVP — a future story (Epic 2: Real-Time Sprint State Sync) will add persistent event-driven monitoring.
- **Story 1.2 deferred item**: "Future stories (1.3, 1.4) need to distinguish 'user prompt' from 'story context' for status tracking and resume operations." This story should use `storyContext` presence (set during spawn) as the indicator that a session is story-spawned.
- **Event bus dependency**: `BlockedAgentDetector` requires an `EventBus` instance. If no event bus is configured, blocked detection should degrade gracefully (log warning, skip).

### Project Structure Notes

- `packages/cli/src/commands/status.ts` — Primary file to modify (add columns, add --story filter)
- `packages/cli/src/commands/spawn.ts` — Wire completion/blocked detection after story spawn
- `packages/core/src/agent-completion-detector.ts` — Existing, used as-is via `createAgentCompletionDetector()`
- `packages/core/src/blocked-agent-detector.ts` — Existing, used as-is via `createBlockedAgentDetector()`
- `packages/core/src/completion-handlers.ts` — Existing, used as-is via `createCompletionHandler()`/`createFailureHandler()`
- `packages/core/src/agent-registry.ts` — Existing, already used in spawn.ts via `getAgentRegistry()`
- `packages/core/src/metadata.ts` — `updateMetadata()` for persisting `agentStatus`
- `packages/core/src/types.ts` — All interfaces already defined (AgentCompletionDetector, BlockedAgentDetector, AgentRegistry, etc.)

### Cross-Story Dependencies

- **Story 1.2 (done)**: Provided `--story` flag, agent registry integration, storyId in metadata — this story builds directly on it
- **Story 1.4 (backlog)**: Resume blocked stories — will consume the blocked status this story writes
- **Story 1.5 (backlog)**: Multi-agent assignment — will use the agent-story mapping table this story displays
- **Epic 2 (backlog)**: Real-time sprint state sync — will replace CLI-lifetime detection with persistent event-driven monitoring

### References

- [Source: packages/core/src/types.ts] — AgentStatus, CompletionEvent, FailureEvent, BlockedAgentStatus, AgentRegistry, AgentCompletionDetector, BlockedAgentDetector interfaces
- [Source: packages/core/src/agent-completion-detector.ts] — Completion detection via isAlive() polling, AgentMonitor class
- [Source: packages/core/src/blocked-agent-detector.ts] — Inactivity threshold detection, agent-type-specific timeouts
- [Source: packages/core/src/completion-handlers.ts] — createCompletionHandler(), createFailureHandler(), updateSprintStatus(), logAuditEvent()
- [Source: packages/core/src/agent-registry.ts] — register(), updateStatus(), findActiveByStory(), getByAgent()
- [Source: packages/core/src/metadata.ts] — updateMetadata() signature
- [Source: packages/cli/src/commands/status.ts] — Current ao status implementation (SessionInfo, gatherSessionInfo, printTableHeader, printSessionRow)
- [Source: packages/cli/src/commands/spawn.ts] — spawnWithStory() function where detection wiring needs to be added
- [Source: _bmad-output/planning-artifacts/epics.md] — Epic 1 Story 1.3 definition, ACs, requirements (FR5, FR6, FR33)
- [Source: _bmad-output/planning-artifacts/architecture.md] — Agent lifecycle state machine, completion detection pattern, event bus integration

### Limitations (Deferred Items)

1. CLI-lifetime detection only
   - Status: Acceptable for MVP
   - Requires: Persistent daemon or event-driven monitoring
   - Epic: Epic 2 (Real-Time Sprint State Sync)
   - Current: Detection runs only while `ao spawn --story` process is alive. Ctrl+C detaches monitoring but agent continues in background.

2. Exit code detection not used for completion vs failure distinction
   - Status: Deferred - Requires runtime plugin enhancement
   - Requires: `getExitCode()` integration in `AgentMonitor.handleExit()`
   - Epic: Story 1.4 or Epic 4
   - Current: `AgentCompletionDetector` assumes clean exit (exit code 0) when session dies. The failure handler is only called on timeout.

3. Kill/termination cleanup
   - Status: Deferred - Requires lifecycle manager integration
   - Requires: Subscription to `ao kill` events to call `unmonitor()` on detectors
   - Epic: Story 1.4 (Resume Blocked Stories)
   - Current: Cleanup only happens via SIGINT handler on the spawn process.

4. ~~Completion handler log capture uses wrong sessions directory~~ — FIXED in code review
   - Resolution: Added `overrideSessionsDir` optional parameter to `createCompletionHandler` and `createFailureHandler`. Spawn.ts now passes the pre-computed `sessionsDir`.

5. ~~No error isolation between completion handler callbacks~~ — FIXED in code review
   - Resolution: Added try-catch per handler in `AgentCompletionDetectorImpl.handleCompletion()` and `handleFailure()`. One handler throwing no longer prevents subsequent handlers from running.

## Dev Agent Record

### Agent Model Used
claude-opus-4-6

### Debug Log References

### Completion Notes List
- Tasks 1-2: `ao status` enhanced with Story/AgentSt columns and `--story <id>` detail view
- Tasks 3-4: Completion and blocked detection wired in `spawnWithStory()` via `wireDetection()`
- Task 5: Lifecycle edge cases handled — graceful degradation, SIGINT cleanup, try-catch wrapping
- Task 6: 20 tests total — 9 in status-story.test.ts, 11 in completion-wiring.test.ts
- Interface fix: Added `updateStatus()` to `AgentRegistry` interface in types.ts
- New utility: `getRuntime()` added to plugins.ts for resolving runtime plugins
- New utility: `createInMemoryEventBus()` added to spawn.ts for CLI-lifetime event dispatch
- Code review fix: Added `cleanedUp` guard to prevent double invocation of `cleanup()` (SIGINT + completion handler race)
- Code review fix: Added `overrideSessionsDir` param to `createCompletionHandler`/`createFailureHandler` to fix sessionsDir hash mismatch
- Code review fix: Added try-catch error isolation in `handleCompletion`/`handleFailure` in `agent-completion-detector.ts`
- Code review fix: Removed stale `.bak` file (`agent-completion-detector.ts.bak`)
- Code review fix: Completed Interface Validation checklist (20 methods validated)

### File List
- `packages/cli/src/commands/status.ts` — Added Story/AgentSt columns, `--story <id>` detail view, `printStoryDetail()`, `agentStatusIcon()`
- `packages/cli/src/commands/spawn.ts` — Added `wireDetection()` for completion/blocked monitoring, `createInMemoryEventBus()`, SIGINT cleanup
- `packages/cli/src/lib/plugins.ts` — Added `getRuntime()` function with tmux/process runtime plugin imports
- `packages/core/src/types.ts` — Added `updateStatus(agentId, status)` to `AgentRegistry` interface
- `packages/core/src/__tests__/blocked-agent-detector.test.ts` — Added `updateStatus` to mock registry
- `packages/core/src/__tests__/completion-wiring.test.ts` — New test file (11 tests for completion/blocked wiring)
- `packages/cli/__tests__/commands/status-story.test.ts` — New test file (9 tests for status story display)
- `packages/core/src/completion-handlers.ts` — Added `overrideSessionsDir` optional param to `createCompletionHandler`/`createFailureHandler`
- `packages/core/src/agent-completion-detector.ts` — Added try-catch error isolation in `handleCompletion`/`handleFailure`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated story 1-3 status to review
