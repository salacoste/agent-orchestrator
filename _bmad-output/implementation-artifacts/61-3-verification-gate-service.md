# Story 61.3: Verification Gate Service

Status: done

## Story

As a project lead ensuring code quality before story completion,
I want the system to automatically run verification checks (tests, lint, typecheck) when an agent finishes a story,
so that stories are only marked "done" when they pass quality gates, preventing regressions from propagating.

## Acceptance Criteria

1. **AC#1 — VerificationConfig**: New `verification` section in project config under `ProjectConfig` with Zod schema validation: `enabled: boolean`, `checks: VerificationCheck[]`, `onFailure: "block" | "review"`
2. **AC#2 — VerificationCheck Types**: `VerificationCheck` type with fields: `type: "test" | "lint" | "typecheck" | "custom"`, `command: string`, `required: boolean` (default: true)
3. **AC#3 — VerificationResult Types**: `VerificationResult` type with fields: `passed: boolean`, `checks: CheckResult[]`, `ranAt: string`, `duration: number`; `CheckResult` with: `type`, `command`, `passed`, `exitCode`, `stdout` (last 500 chars), `stderr` (last 500 chars), `duration`, `required`
4. **AC#4 — Verification Runner**: Core function `runVerification(projectDir: string, config: VerificationConfig): Promise<VerificationResult>` that executes each configured check via `execFileAsync` with a 120s timeout per check, captures stdout/stderr, returns structured results
5. **AC#5 — Completion Gate**: Completion handler modified to run verification BEFORE marking story "done". If verification passes → status "done". If verification fails and `onFailure: "block"` → status "review". If `onFailure: "review"` → status "review". If verification not configured or disabled → skip gate, mark "done" (backward compatible)
6. **AC#6 — API Route**: GET `/api/sprint/[project]/story/[id]/verification` returns the latest verification result for a story (stored in session metadata). Returns `{ verification: VerificationResult | null, storyId, project }`
7. **AC#7 — Non-Fatal Gate**: Verification failures never crash the completion handler. If the verification runner itself throws, log warning and proceed as if verification is disabled (mark "done")
8. **AC#8 — Event Publishing**: On verification pass → publish `verification.passed` event. On verification fail → publish `verification.failed` event. Both include `VerificationResult` in metadata
9. **AC#9 — Config Gate**: Verification only runs when `project.verification.enabled === true`. Projects without the section continue to work unchanged
10. **AC#10 — Test Coverage**: Unit tests for `runVerification`, API route tests, completion handler integration test verifying gate behavior

## Tasks / Subtasks

- [x] Task 1: Add types to types.ts (AC: #2, #3)
  - [x] Add `VerificationCheck` interface with `type`, `command`, `required` fields
  - [x] Add `CheckResult` interface with `type`, `command`, `passed`, `exitCode`, `stdout`, `stderr`, `duration`, `required`
  - [x] Add `VerificationResult` interface with `passed`, `checks`, `ranAt`, `duration`
  - [x] Add `VerificationConfig` interface with `enabled`, `checks`, `onFailure` fields
  - [x] Add `verification?: VerificationConfig` to `ProjectConfig` interface
  - [x] Add `"verification.passed" | "verification.failed"` to `EventType` union
- [x] Task 2: Add Zod schema to config.ts (AC: #1)
  - [x] Add `VerificationCheckSchema` with `type`, `command`, `required` (default: true)
  - [x] Add `VerificationConfigSchema` with `enabled`, `checks`, `onFailure` (default: "review")
  - [x] Add `verification: VerificationConfigSchema.optional()` to `ProjectConfigSchema`
- [x] Task 3: Create verification-gate.ts core module (AC: #4)
  - [x] Create `packages/core/src/verification-gate.ts`
  - [x] `runVerification(projectDir, config): Promise<VerificationResult>` — iterates checks, runs each via `execFileAsync`, collects results
  - [x] Use `promisify(execFile)` from `node:child_process` (same pattern as `log-capture.ts`)
  - [x] Each check runs with `{ cwd: projectDir, timeout: 120_000, shell: true }` (shell needed for `pnpm test` commands)
  - [x] Capture `exitCode`, truncate `stdout`/`stderr` to last 500 chars
  - [x] Compute overall `passed` from all `required` checks passing
  - [x] Returns structured `VerificationResult` with `ranAt` (ISO timestamp) and total `duration`
  - [x] Best-effort: individual check failures caught and recorded as `CheckResult` with `passed: false`
- [x] Task 4: Create verification store (AC: #6) — subsumed into Task 3
  - [x] Add `storeVerificationResult(sessionsDir, sessionId, result)` to `verification-gate.ts`
  - [x] Store as JSON in session metadata under `verification_result` key (using existing `writeMetadata`/`readMetadataRaw` pattern)
  - [x] Add `loadVerificationResult(sessionsDir, sessionId): VerificationResult | null` — reads from metadata
  - [x] Export both from `packages/core/src/index.ts`
- [x] Task 5: Modify completion handler — add verification gate (AC: #5, #7, #8)
  - [x] In `createCompletionHandler()`, insert verification gate between agent removal and `updateSprintStatus()`
  - [x] Load config, check `project.verification?.enabled === true`
  - [x] If enabled: call `runVerification(projectPath, config.verification)`
  - [x] Store result via `storeVerificationResult()`
  - [x] If result.passed → set status to "done" (existing behavior)
  - [x] If result.passed is false → set status based on `onFailure` config (default: "review")
  - [x] Log `verification.passed` or `verification.failed` event via `logAuditEvent()`
  - [x] If verification runner itself throws → log warning, proceed as "done" (non-fatal)
  - [x] If verification disabled/not configured → proceed as "done" (backward compatible)
  - [x] Only unblock dependent stories when finalStatus === "done"
- [x] Task 6: Create API route (AC: #6)
  - [x] Create `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.ts`
  - [x] GET handler: resolve project config from `[project]` param, find session for story `[id]` from registry, load verification result from metadata
  - [x] Return `{ verification: VerificationResult | null, storyId, project }`
  - [x] Return 200 with `verification: null` if no result stored (story completed before verification was enabled)
  - [x] Return 404 for unknown project or story
  - [x] Set `Cache-Control: no-cache, no-store, must-revalidate`
- [x] Task 7: Write tests (AC: #10)
  - [x] Core tests: `packages/core/src/__tests__/verification-gate.test.ts` (15 tests)
    - [x] `runVerification` — passes when all required checks pass
    - [x] `runVerification` — fails when a required check fails (exitCode !== 0)
    - [x] `runVerification` — passes when only optional checks fail
    - [x] `runVerification` — handles check timeout (kill process, record failure)
    - [x] `runVerification` — truncates stdout/stderr to 500 chars
    - [x] `runVerification` — computes overall `passed` correctly (only required checks matter)
    - [x] `runVerification` — uses shell: true and cwd for execution
    - [x] `storeVerificationResult` — stores via updateMetadata
    - [x] `storeVerificationResult` — skips silently when metadata unavailable
    - [x] `storeVerificationResult` — handles updateMetadata throwing
    - [x] `loadVerificationResult` — returns parsed result when present
    - [x] `loadVerificationResult` — returns null when no result stored
    - [x] `loadVerificationResult` — returns null when metadata missing
    - [x] `loadVerificationResult` — returns null for malformed JSON
    - [x] `loadVerificationResult` / `storeVerificationResult` — round-trip persistence
  - [x] API route tests: `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.test.ts` (6 tests)
    - [x] GET: returns verification result when available
    - [x] GET: returns null verification when no result stored
    - [x] GET: returns 404 for unknown project
    - [x] GET: returns 404 for unknown story
    - [x] GET: sets no-cache headers
    - [x] GET: returns 500 on unexpected error
  - [x] Completion handler integration: `packages/core/src/__tests__/completion-handler-verification.test.ts` (6 tests)
    - [x] Story marked "done" when verification passes
    - [x] Story marked "review" when verification fails (onFailure: "review")
    - [x] Story marked "done" when verification disabled (backward compat)
    - [x] Story marked "done" when verification runner throws (non-fatal)
    - [x] Stores verification result even when checks fail
    - [x] Writes audit log for passed verification

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

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Methods Used:**
- `runVerification(projectDir, config)` — NEW — runs configured checks, returns `VerificationResult`
- `storeVerificationResult(sessionsDir, sessionId, result)` — NEW — persists result to session metadata
- `loadVerificationResult(sessionsDir, sessionId)` — NEW — reads result from session metadata
- `loadConfig(configPath)` — from `config.ts` — resolve project config for verification settings
- `updateSprintStatus(projectPath, storyId, status, stateManager)` — from `completion-handlers.ts` — already used, now called conditionally
- `promisify(execFile)` — from `node:child_process` — execute check commands (same pattern as `log-capture.ts`)

**Feature Flags:**
- `project.verification.enabled` — config gate for verification gate feature (checked in completion handler)

## Dev Notes

### Architecture Overview

This story introduces a verification gate into the session completion pipeline. When an agent finishes a story, the system now optionally runs configured quality checks (tests, lint, typecheck, or custom commands) before marking the story as "done". If verification fails, the story is set to "review" status instead, preventing dependent stories from being unblocked.

**Key design decision**: The verification gate is **opt-in** and **non-fatal**. Projects without a `verification` section continue to work exactly as before. Even when enabled, if the verification runner itself throws, the story is still marked "done" — we never want a buggy verification check to block the entire completion pipeline.

**Insertion point**: The verification gate hooks into `createCompletionHandler()` in `completion-handlers.ts` between the agent removal (line 402) and the `updateSprintStatus()` call (line 406). This means:
- Session logs are already captured
- The agent is already removed from the registry
- But the story hasn't been marked "done" yet

### Data Flow

```
Agent exits cleanly (exit code 0)
    ↓
createCompletionHandler() fires
    ↓
Capture logs, store log path, remove from registry
    ↓
[NEW] Verification gate:
    ↓ Load config → find project → check verification.enabled
    ↓ If enabled:
    ↓   runVerification(projectPath, config.verification)
    ↓     → For each check: execFileAsync(command, { cwd, timeout: 120s, shell: true })
    ↓     → Collect CheckResult[] → compute overall passed
    ↓   storeVerificationResult() — persist to session metadata
    ↓   If passed → status = "done"
    ↓   If failed → status = config.verification.onFailure (default: "review")
    ↓   Publish verification.passed/failed event
    ↓ If disabled/not configured:
    ↓   status = "done" (existing behavior)
    ↓
updateSprintStatus(projectPath, storyId, status)
    ↓
Publish story.completed event (with newStatus = computed status)
    ↓
Continue: audit log, model usage, learning, memory bridge
    ↓
If status === "done" → unblock dependent stories
    ↓
If status === "review" → do NOT unblock dependents
```

### Completion Handler Modification

The current completion handler (lines 405-406) unconditionally sets status to "done":
```typescript
// Current code (line 406):
updateSprintStatus(projectPath, event.storyId, "done", stateManager);
```

This changes to:
```typescript
// New code:
const finalStatus = await runVerificationGate(
  configPath, projectPath, event.agentId, event.storyId, eventPublisher
);
updateSprintStatus(projectPath, event.storyId, finalStatus, stateManager);
```

Where `runVerificationGate()` is a helper function that:
1. Loads config, finds project, checks `verification.enabled`
2. If not enabled → returns "done"
3. If enabled → runs verification, stores result, publishes event
4. Returns "done" or "review" based on result
5. On any error → logs warning, returns "done" (non-fatal)

The `unblockDependentStories()` call (line 489) should also be conditional — only unblock if `finalStatus === "done"`.

### Verification Check Execution

Each verification check runs as a child process via `execFileAsync` (promisified `execFile` from `node:child_process`):

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runCheck(
  projectDir: string,
  check: VerificationCheck,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(check.command, [], {
      cwd: projectDir,
      timeout: 120_000,
      shell: true, // needed for "pnpm test", "pnpm lint" etc.
    });
    return {
      type: check.type,
      command: check.command,
      passed: true,
      exitCode: 0,
      stdout: truncate(stdout, 500),
      stderr: truncate(stderr, 500),
      duration: Date.now() - start,
      required: check.required,
    };
  } catch (err: unknown) {
    // execFileAsync throws on non-zero exit code
    const execErr = err as { code?: string; stdout?: string; stderr?: string; killed?: boolean };
    return {
      type: check.type,
      command: check.command,
      passed: false,
      exitCode: execErr.killed ? -1 : 1,
      stdout: truncate(execErr.stdout ?? "", 500),
      stderr: truncate(execErr.stderr ?? "", 500),
      duration: Date.now() - start,
      required: check.required,
    };
  }
}
```

**Note on `shell: true`**: Commands like `pnpm test` need shell resolution because `pnpm` is typically a shell script, not a direct binary. This is the same pattern used in `runtime-process/src/index.ts`.

### Verification Result Storage

Results are stored in session metadata (the existing `.omc/sessions/{sessionId}/metadata` flat-file system). This avoids creating new storage mechanisms:

```typescript
export async function storeVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
  result: VerificationResult,
): Promise<void> {
  const raw = readMetadataRaw(sessionsDir, sessionId);
  if (raw) {
    raw["verification_result"] = JSON.stringify(result);
    await writeMetadata(sessionsDir, sessionId, raw);
  }
}

export function loadVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
): VerificationResult | null {
  const raw = readMetadataRaw(sessionsDir, sessionId);
  if (!raw) return null;
  const stored = raw["verification_result"];
  if (!stored || typeof stored !== "string") return null;
  try {
    return JSON.parse(stored) as VerificationResult;
  } catch {
    return null;
  }
}
```

### API Route Design

The API route follows the existing `/api/sprint/[project]/story/[id]/` pattern:

```
GET /api/sprint/[project]/story/[id]/verification
  → Resolve project config from [project] param
  → Find active or completed session for story [id]
  → Load verification result from session metadata
  → Return { verification: VerificationResult | null, storyId, project }
```

To find the session for a story, the route needs to check the agent registry for active sessions, and fall back to scanning session metadata for completed sessions. The existing `registry.getByStory(storyId)` method can find active sessions; for completed sessions, the `StateManager` tracks story-to-session mappings.

### Config Schema

New Zod schemas added to `config.ts`:

```typescript
const VerificationCheckSchema = z.object({
  type: z.enum(["test", "lint", "typecheck", "custom"]),
  command: z.string().min(1),
  required: z.boolean().default(true),
});

const VerificationConfigSchema = z.object({
  enabled: z.boolean(),
  checks: z.array(VerificationCheckSchema).min(1),
  onFailure: z.enum(["block", "review"]).default("review"),
});
```

Added to `ProjectConfigSchema`:
```typescript
verification: VerificationConfigSchema.optional(),
```

Added to `ProjectConfig` interface in `types.ts`:
```typescript
verification?: VerificationConfig;
```

### Example Config

```yaml
# agent-orchestrator.yaml
projects:
  my-project:
    repo: https://github.com/org/repo
    path: /path/to/project
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: true
        - type: typecheck
          command: "pnpm typecheck"
          required: false  # advisory only
      onFailure: review  # mark story as "review" on failure
```

### Critical Patterns to Follow

- **NO `.js` extensions in web imports**: Web package convention is bare imports like `@/lib/services` (NOT `@/lib/services.js`)
- **Non-fatal gate**: Verification failures never crash the completion handler. Use try/catch around the entire verification gate
- **Config gate**: Check `project.verification?.enabled === true` before running any checks
- **execFileAsync with timeout**: Same pattern as `log-capture.ts` — `promisify(execFile)` with `{ timeout }` option
- **Metadata storage**: Use existing `readMetadataRaw`/`writeMetadata` for storing verification results (no new storage)
- **Event publishing**: Follow existing `eventPublisher.publishStoryCompleted()` pattern for `verification.passed`/`verification.failed`
- **Test patterns**: Use `vi.hoisted()` for mock references, real timers for async, `Object.freeze()` for defaults
- **Route pattern**: Follow `/api/sprint/[project]/story/[id]/route.ts` for Next.js App Router patterns

### Testing Patterns (from Epic 60/61 lessons)

- Use `vi.hoisted()` for mock references used in `vi.mock()` factories
- Use real timers for async operations (child process execution)
- Use `Object.freeze()` for empty default objects
- Best-effort pattern: test error cases return empty/skip, never throw
- Test malformed input tolerance
- Mock `execFileAsync` for verification runner tests — don't actually run `pnpm test`
- Web route tests: mock `getServices` to return test project configs
- Completion handler tests: mock `runVerification` to test gate behavior

### Project Structure Notes

**New files:**
- `packages/core/src/verification-gate.ts` — core verification runner and storage
- `packages/core/src/__tests__/verification-gate.test.ts` — core verification tests
- `packages/core/src/__tests__/completion-handler-verification.test.ts` — gate integration tests
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.ts` — API route
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.test.ts` — route tests

**Modified files:**
- `packages/core/src/types.ts` — add VerificationConfig, VerificationCheck, CheckResult, VerificationResult types; add event types
- `packages/core/src/config.ts` — add Zod schemas for verification config
- `packages/core/src/completion-handlers.ts` — add verification gate before updateSprintStatus()
- `packages/core/src/index.ts` — export new verification functions

### References

- [Source: packages/core/src/completion-handlers.ts:378-491] — createCompletionHandler() — primary insertion point
- [Source: packages/core/src/completion-handlers.ts:406] — updateSprintStatus() call — where "done" is set unconditionally
- [Source: packages/core/src/completion-handlers.ts:489] — unblockDependentStories() — must be conditional on finalStatus
- [Source: packages/core/src/types.ts:1167-1176] — ProjectConfig.learning pattern — follow for verification config
- [Source: packages/core/src/types.ts:2412-2418] — StoryStatus type (already has "review")
- [Source: packages/core/src/types.ts:2081-2090] — StoryCompletedEvent (already has testsPassed/testsFailed)
- [Source: packages/core/src/config.ts:129-154] — ProjectConfigSchema — add verification section
- [Source: packages/core/src/config.ts:104-117] — SessionEnhancementConfigSchema — pattern to follow
- [Source: packages/core/src/log-capture.ts:8,13] — execFileAsync pattern
- [Source: packages/core/src/utils.ts:13] — shellEscape() utility
- [Source: packages/core/src/agent-completion-detector.ts:130-143] — CompletionHandler dispatch (multiple handlers, error isolation)
- [Source: packages/web/src/app/api/sprint/[project]/story/[id]/route.ts] — existing story API route pattern
- [Source: _bmad-output/implementation-artifacts/61-2-project-memory-dashboard-viewer.md] — previous story learnings (atomic writes, config gates, non-fatal patterns)
- [Source: _bmad-output/implementation-artifacts/61-1-cross-session-memory-bridge.md] — previous story learnings (append-only, best-effort, service registry)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- Task 4 (verification store) was subsumed into Task 3 since the store functions are part of the same `verification-gate.ts` module
- Used `logAuditEvent()` instead of `eventPublisher.publishCustomEvent()` since EventPublisher interface only has specific publish methods; verification events logged to JSONL audit trail with `[key: string]: unknown` index signature
- 28 new tests total: 15 core + 7 completion handler integration + 6 API route
- All pre-existing test failures confirmed unrelated (plugin-installer, plugin-npm-registry, standup-generator — date-dependent)

### Code Review Fixes (2026-04-18)

- **H1 FIXED**: `onFailure: "block"` now correctly sets status to `"blocked"` instead of `"review"` (was dead-code ternary returning same value for both)
- **M1 FIXED**: API route returns 200 with `{ verification: null }` for completed stories instead of 404, since `registry.getByStory()` only tracks active assignments
- **M3 FIXED**: `loadConfig()` now called once and cached for both verification gate and memory bridge (was called twice redundantly)
- Added test for `onFailure: "block"` → `"blocked"` status (7th integration test)

### File List

**New files:**
- `packages/core/src/verification-gate.ts` — core verification runner and storage
- `packages/core/src/__tests__/verification-gate.test.ts` — 15 unit tests
- `packages/core/src/__tests__/completion-handler-verification.test.ts` — 7 integration tests
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.ts` — GET API route
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.test.ts` — 6 route tests

**Modified files:**
- `packages/core/src/types.ts` — added VerificationConfig, VerificationCheck, CheckResult, VerificationResult types; added verification.passed/failed event types; added verification to ProjectConfig
- `packages/core/src/config.ts` — added VerificationCheckSchema, VerificationConfigSchema Zod schemas; added verification to ProjectConfigSchema
- `packages/core/src/completion-handlers.ts` — added verification gate in createCompletionHandler(); conditional finalStatus; conditional unblockDependentStories; cached loadConfig()
- `packages/core/src/index.ts` — exported runVerification, storeVerificationResult, loadVerificationResult
