# Story 61.4: Auto-Retry on Verification Failure

Status: done

## Story

As a project lead using verification gates,
I want the system to automatically retry stories that fail verification by spawning a new agent session with the error context injected,
so that transient failures (flaky tests, timing issues) are self-healed without human intervention.

## Acceptance Criteria

1. **AC#1 — Retry Configuration**: New `retry` section in `VerificationConfig` with Zod schema: `enabled: boolean` (default: true), `maxAttempts: number` (default: 2, max: 5), `backoffMs: number` (default: 5000). Existing configs without `retry` continue to work (backward compatible)
2. **AC#2 — Retry Trigger**: When verification fails (result.passed === false) and `retry.enabled !== false` and retry count < `maxAttempts`, the system automatically triggers a retry by logging a `verification.retry_scheduled` audit event and setting story status to `"in-progress"` (re-queue for agent assignment)
3. **AC#3 — Error Context Injection**: When retrying, the verification failure context (failed check commands, their stderr output, exit codes) is written to the session's `.omc/notepad.md` Working Memory section so the next agent session has the error details
4. **AC#4 — Retry Counter**: Each retry increments a `verification_retry_count` tracked in session metadata. The count is included in the `verification.retry_scheduled` and `verification.retry_exhausted` audit events
5. **AC#5 — Exhaustion Handling**: When retry count reaches `maxAttempts`, the system logs a `verification.retry_exhausted` audit event and sets the story status per `onFailure` config ("review" or "blocked") — no more retries
6. **AC#6 — Retry History**: `loadVerificationRetryHistory()` function returns all retry attempts for a story: `VerificationRetryAttempt[]` with `{ attempt, ranAt, result: VerificationResult }`. API route `GET /api/sprint/[project]/story/[id]/verification/retries` exposes this
7. **AC#7 — Non-Fatal Retry**: Retry scheduling failures (notepad write errors, metadata errors) never crash the completion handler. Log warning and proceed with `onFailure` status
8. **AC#8 — Event Publishing**: On retry scheduled → `verification.retry_scheduled` audit event. On retry exhausted → `verification.retry_exhausted` audit event. Both include `attempt`, `maxAttempts`, `failedChecks` summary
9. **AC#9 — Skip on Manual Block**: If `onFailure: "block"`, do NOT auto-retry (blocking means human review required). Only auto-retry when `onFailure: "review"`
10. **AC#10 — Test Coverage**: Unit tests for retry logic, retry history storage, API route tests, completion handler integration test verifying retry trigger and exhaustion

## Tasks / Subtasks

- [x] Task 1: Add retry types to types.ts (AC: #1, #4, #6)
  - [x] Add `VerificationRetryConfig` interface: `{ enabled?: boolean; maxAttempts?: number; backoffMs?: number }`
  - [x] Add `verification_retry_count` and `verification_retry_history` to the metadata tracking concept
  - [x] Add `VerificationRetryAttempt` interface: `{ attempt: number; ranAt: string; result: VerificationResult }`
  - [x] Add `retry?: VerificationRetryConfig` field to `VerificationConfig` interface
- [x] Task 2: Add retry Zod schema to config.ts (AC: #1)
  - [x] Add `VerificationRetryConfigSchema` with `enabled` (default: true), `maxAttempts` (default: 2, max: 5), `backoffMs` (default: 5000)
  - [x] Add `retry: VerificationRetryConfigSchema.optional()` to `VerificationConfigSchema`
- [x] Task 3: Add retry logic to verification-gate.ts (AC: #2, #3, #4, #5, #7, #8)
  - [x] Add `scheduleVerificationRetry()` function: checks retry config, current retry count, onFailure mode; if eligible → return `{ shouldRetry: true, backoffMs }`; caller handles writing error context and status update
  - [x] Add `writeRetryContextToNotepad()`: appends failed check details to `.omc/notepad.md` Working Memory section in the session worktree
  - [x] Add `loadVerificationRetryHistory()`: reads all retry attempts from session metadata
  - [x] Add `storeVerificationRetryAttempt()`: appends a retry attempt to the history array in metadata
  - [x] Export new functions from `packages/core/src/index.ts`
- [x] Task 4: Integrate retry into completion handler (AC: #2, #5, #9)
  - [x] In `createCompletionHandler()`, after verification fails: call `scheduleVerificationRetry()` to determine if retry should happen
  - [x] If retry scheduled → set `finalStatus = "in-progress"` instead of "review"/"blocked", log `verification.retry_scheduled` audit event
  - [x] If retry exhausted or blocked → set `finalStatus` per `onFailure` config, log `verification.retry_exhausted` audit event
  - [x] If `onFailure: "block"` → skip retry entirely (AC#9)
  - [x] Wrap retry logic in try/catch — non-fatal (AC#7)
- [x] Task 5: Create retry API route (AC: #6)
  - [x] Create `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.ts`
  - [x] GET handler: resolve project, find session for story, load retry history from metadata
  - [x] Return `{ retries: VerificationRetryAttempt[], storyId, project, maxAttempts }`
  - [x] Return 200 with `{ retries: [] }` if no retries stored
  - [x] Set `Cache-Control: no-cache`
- [x] Task 6: Write tests (AC: #10)
  - [x] Core retry tests: `packages/core/src/__tests__/verification-retry.test.ts`
    - [x] `scheduleVerificationRetry` — returns shouldRetry when under max attempts
    - [x] `scheduleVerificationRetry` — returns exhausted when at max attempts
    - [x] `scheduleVerificationRetry` — skips retry when onFailure is "block"
    - [x] `scheduleVerificationRetry` — skips retry when retry.enabled is false
    - [x] `scheduleVerificationRetry` — uses defaults when retry config omitted
    - [x] `storeVerificationRetryAttempt` — appends to history array
    - [x] `storeVerificationRetryAttempt` — silently handles read failure
    - [x] `storeVerificationRetryAttempt` — silently handles update failure
    - [x] `loadVerificationRetryHistory` — returns empty array when no history
    - [x] `loadVerificationRetryHistory` — returns all attempts in order
    - [x] `loadVerificationRetryHistory` — returns empty array for malformed JSON
    - [x] `writeRetryContextToNotepad` — writes failed check details to notepad
    - [x] `writeRetryContextToNotepad` — handles missing worktree gracefully
    - [x] `writeRetryContextToNotepad` — omits Passing Checks when all fail
    - [x] `writeRetryContextToNotepad` — silently handles write failure
    - [x] `scheduleVerificationRetry` — returns custom backoffMs when configured
    - [x] `scheduleVerificationRetry` — uses preloadedRetryCount to skip metadata read
    - [x] `scheduleVerificationRetry` — respects preloadedRetryCount for limit check
  - [x] API route tests: `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.test.ts`
    - [x] GET: returns retry history when available
    - [x] GET: returns empty array when no retries
    - [x] GET: returns 404 for unknown project
    - [x] GET: sets no-cache headers
  - [x] Completion handler integration: `packages/core/src/__tests__/completion-handler-retry.test.ts`
    - [x] Triggers retry when verification fails (under max attempts)
    - [x] Sets "in-progress" status on retry
    - [x] Logs verification.retry_scheduled audit event
    - [x] Does NOT retry when onFailure is "block"
    - [x] Sets "review" status when retries exhausted

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
- `runVerification(projectDir, config)` — from `verification-gate.ts` (Story 61-3) — runs checks
- `storeVerificationResult(sessionsDir, sessionId, result)` — from `verification-gate.ts` — stores result
- `loadVerificationResult(sessionsDir, sessionId)` — from `verification-gate.ts` — loads result
- `readMetadataRaw(sessionsDir, sessionId)` — from `metadata.ts` — reads session metadata
- `updateMetadata(sessionsDir, sessionId, data)` — from `metadata.ts` — writes session metadata
- `logAuditEvent(auditDir, event)` — from `completion-handlers.ts` — writes JSONL audit log
- `registry.getRetryCount(storyId)` — from `AgentRegistry` — existing retry count tracking
- `existsSync`, `appendFileSync`, `readFileSync` — from `node:fs` — notepad read/write

**Feature Flags:**
- `project.verification.enabled` — master gate for verification (from 61-3)
- `project.verification.retry.enabled` — gate for auto-retry (default: true when verification enabled)

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dev Notes

### Architecture Overview

This story extends the verification gate from 61-3 with automatic retry logic. When verification fails, instead of immediately marking the story as "review" or "blocked", the system can re-queue the story for another attempt by setting its status back to "in-progress" and injecting the failure context into the session notepad.

**Key design decisions:**
1. **Retry vs. re-spawn**: The retry sets the story back to "in-progress" and relies on the existing agent assignment system (`assign-next`) or autopilot to pick it up. We do NOT directly spawn a new agent — that's the orchestrator's job.
2. **Error context via notepad**: The `.omc/notepad.md` Working Memory section is the standard mechanism for passing context between sessions (established in Epic 59). We write the failed check details there so the next agent sees what went wrong.
3. **No retry when blocking**: If `onFailure: "block"`, it means the project requires human review. No auto-retry in this case.
4. **Non-fatal**: Same principle as 61-3 — retry scheduling failures never crash the completion handler.

### Data Flow (Verification Failure Path)

```
Verification runs → result.passed === false
    ↓
Check retry config:
  - retry.enabled !== false? (default: true)
  - onFailure !== "block"? (skip retry for block mode)
  - verification_retry_count < maxAttempts? (default: 2)
    ↓
If retry eligible:
  1. Load retry count from session metadata
  2. Increment retry count
  3. Store retry attempt in history array
  4. Write error context to .omc/notepad.md Working Memory
  5. Set finalStatus = "in-progress"
  6. Log verification.retry_scheduled audit event
    ↓
If retry exhausted (count >= maxAttempts):
  1. Log verification.retry_exhausted audit event
  2. Set finalStatus = onFailure config ("review" or "blocked")
    ↓
If onFailure === "block":
  Skip retry entirely → set finalStatus = "blocked"
    ↓
updateSprintStatus(projectPath, storyId, finalStatus)
```

### Retry History Storage

Retry attempts are stored as a JSON array in session metadata:

```
verification_retry_count: "2"
verification_retry_history: "[{\"attempt\":1,\"ranAt\":\"...\",\"result\":{...}},{\"attempt\":2,\"ranAt\":\"...\",\"result\":{...}}]"
```

This follows the existing metadata pattern (flat key=value files) established in 61-3 for `verification_result`.

### Notepad Error Context Format

When retrying, the following is appended to `.omc/notepad.md` after the Working Memory section:

```markdown
## Verification Retry Context (Attempt N)

The previous verification run failed. Fix these issues:

### Failed Checks:
- **test** (`pnpm test`): exit code 1
  stderr: (last 300 chars of stderr)
- **lint** (`pnpm lint`): exit code 1
  stderr: (last 300 chars of stderr)

### Passing Checks:
- **typecheck** (`pnpm typecheck`): passed

Focus on fixing the failed checks above.
```

### Config Schema Extension

Adding to the existing `VerificationConfigSchema`:

```typescript
const VerificationRetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).max(5).default(2),
  backoffMs: z.number().int().min(0).default(5000),
});

// Added to VerificationConfigSchema:
retry: VerificationRetryConfigSchema.optional(),
```

Example config:

```yaml
verification:
  enabled: true
  checks:
    - type: test
      command: "pnpm test"
      required: true
    - type: lint
      command: "pnpm lint"
      required: true
  onFailure: review
  retry:
    enabled: true
    maxAttempts: 3
    backoffMs: 10000
```

### Integration with Completion Handler

The completion handler from 61-3 already has the verification gate. We extend it:

```typescript
// Current (61-3):
if (!result.passed) {
  finalStatus = verification.onFailure === "block" ? "blocked" : "review";
}

// New (61-4):
if (!result.passed) {
  const retryOutcome = await scheduleVerificationRetry(
    sessionsDir, event.agentId as SessionId,
    rawMeta?.["worktree"], result,
    verification, auditDir, event.storyId
  );
  if (retryOutcome.shouldRetry) {
    finalStatus = "in-progress";
  } else {
    finalStatus = verification.onFailure === "block" ? "blocked" : "review";
  }
}
```

### API Route Pattern

The retries endpoint follows the same pattern as the verification route from 61-3:

```
GET /api/sprint/[project]/story/[id]/verification/retries
  → Resolve project config
  → Find session for story (active or completed)
  → Load retry history from session metadata
  → Return { retries: VerificationRetryAttempt[], storyId, project, maxAttempts }
```

### Critical Patterns to Follow

- **NO `.js` extensions in web imports**: Web package convention is bare imports like `@/lib/services`
- **Non-fatal retry**: Same principle as verification gate — retry failures never crash the handler
- **Metadata storage**: Use existing `readMetadataRaw`/`updateMetadata` pattern (same as 61-3)
- **Notepad writes**: Use `appendFileSync` with `mkdirSync({ recursive: true })` for the `.omc/` directory
- **Audit events**: Use `logAuditEvent()` for `verification.retry_scheduled` / `verification.retry_exhausted`
- **Test patterns**: Use `vi.hoisted()` for mock references in `vi.mock()` factories
- **Config defaults**: Use Zod `.default()` for all retry config values (backward compatible)

### Testing Patterns

- Use `vi.hoisted()` for mock functions referenced in `vi.mock()` factories (lesson from 61-3)
- Mock `readMetadataRaw`/`updateMetadata` for retry history tests
- Mock `appendFileSync`/`existsSync` for notepad write tests
- Observe audit events through `mockWriteFileSync` (same pattern as completion-handler-verification.test.ts)
- Test both retry-eligible and retry-exhausted paths
- Test `onFailure: "block"` skips retry entirely

### Previous Story Intelligence (61-3)

**Key learnings from verification gate implementation:**
- `vi.hoisted()` is required for mock functions used inside `vi.mock()` factories
- `loadConfig()` should be cached and reused (was initially called twice)
- `registry.getByStory()` only tracks active assignments — completed stories return null
- Audit events are observable through mocked `writeFileSync` calls
- `onFailure: "block"` → `"blocked"` status; `onFailure: "review"` → `"review"` status
- Verification errors never crash the completion pipeline (try/catch around entire gate)

### Project Structure Notes

**New files:**
- `packages/core/src/__tests__/verification-retry.test.ts` — core retry logic tests
- `packages/core/src/__tests__/completion-handler-retry.test.ts` — retry integration tests
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.ts` — API route
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.test.ts` — route tests

**Modified files:**
- `packages/core/src/types.ts` — add VerificationRetryConfig, VerificationRetryAttempt types
- `packages/core/src/config.ts` — add VerificationRetryConfigSchema
- `packages/core/src/verification-gate.ts` — add retry functions (scheduleVerificationRetry, writeRetryContextToNotepad, storeVerificationRetryAttempt, loadVerificationRetryHistory)
- `packages/core/src/completion-handlers.ts` — integrate retry into verification failure path
- `packages/core/src/index.ts` — export new retry functions

### References

- [Source: packages/core/src/verification-gate.ts] — existing verification runner and storage (Story 61-3)
- [Source: packages/core/src/completion-handlers.ts:407-439] — verification gate in completion handler
- [Source: packages/core/src/completion-handlers.ts:421] — `onFailure` status determination — where retry logic inserts
- [Source: packages/core/src/types.ts:1192-1242] — VerificationCheck, CheckResult, VerificationResult, VerificationConfig types
- [Source: packages/core/src/config.ts:119-129] — VerificationCheckSchema, VerificationConfigSchema
- [Source: packages/core/src/metadata.ts] — readMetadataRaw, updateMetadata patterns
- [Source: packages/core/src/types.ts:1848-1865] — AgentRegistry.getRetryCount/incrementRetry — existing retry tracking
- [Source: _bmad-output/implementation-artifacts/61-3-verification-gate-service.md] — previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Implemented auto-retry verification failure feature with 6 tasks across types, config, verification-gate, completion handler, API route, and tests
- `scheduleVerificationRetry` returns `{ shouldRetry, backoffMs }` with optional `preloadedRetryCount` to avoid redundant metadata reads
- `backoffMs` is surfaced in return value and included in `verification.retry_scheduled` audit events for observability
- All retry scheduling is wrapped in try/catch — non-fatal by design
- Code review found 10 issues (2 HIGH, 4 MEDIUM, 4 LOW), all fixed:
  - H1: `backoffMs` was unused → now returned from `scheduleVerificationRetry` and logged in audit events
  - H2: Empty Dev Agent Record → filled in
  - M1: `scheduleVerificationRetry` had 5 params (3 unused) → reduced to 3 + optional 4th
  - M2: `retry_exhausted` audit event missing `checks_failed` → added
  - M3: Audit `attempt` field re-read metadata → uses pre-computed `attemptNum`
  - M4: Test fix files not in File List → added below
  - L1/L2: `loadConfig`/`readMetadataRaw` outside try/catch → moved inside with null safety
  - L3: Duplicate metadata reads → `preloadedRetryCount` param avoids double read
  - L4: API route missing `maxAttempts` → added to response
- 5 pre-existing test files fixed (had invalid YAML config strings causing ZodError)
- All 2603 core tests + 2774 web tests passing
- Code review round 2 found 5 issues (1 HIGH, 2 MEDIUM, 2 LOW), all fixed:
  - H1: `VerificationRetryConfig` and `VerificationRetryAttempt` types not exported from index.ts → added `export type`
  - M1: `retry_exhausted` audit event used `attemptNum` (next attempt number) instead of `currentRetryCount` (last attempted) → fixed to use `currentRetryCount`
  - M2: Dead `newStatus` field in `scheduleVerificationRetry` return → removed from function and all tests
  - L1: Notepad creation used `appendFileSync` instead of `writeFileSync` for new file → fixed
  - L2: Extra blank line from leading empty string in notepad content array → removed

### File List

**New files:**
- `packages/core/src/__tests__/verification-retry.test.ts` — core retry logic tests (27 tests)
- `packages/core/src/__tests__/completion-handler-retry.test.ts` — retry integration tests (5 tests)
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.ts` — retry API route
- `packages/web/src/app/api/sprint/[project]/story/[id]/verification/retries/route.test.ts` — route tests (6 tests)

**Modified files:**
- `packages/core/src/types.ts` — added VerificationRetryConfig, VerificationRetryAttempt types
- `packages/core/src/config.ts` — added VerificationRetryConfigSchema
- `packages/core/src/verification-gate.ts` — added retry functions with backoffMs and preloadedRetryCount
- `packages/core/src/completion-handlers.ts` — integrated retry with pre-loaded count, backoffMs in audit
- `packages/core/src/index.ts` — exported new retry functions

**Pre-existing test fixes (not part of story scope):**
- `packages/core/src/__tests__/completion-handler-verification.test.ts` — added retry mocks
- `packages/core/src/__tests__/completion-wiring.test.ts` — fixed invalid YAML config
- `packages/core/src/__tests__/completion-events.test.ts` — fixed invalid YAML config
- `packages/core/src/__tests__/completion-model-usage.test.ts` — fixed invalid YAML config
- `packages/core/__tests__/completion-handlers.test.ts` — added config mock
