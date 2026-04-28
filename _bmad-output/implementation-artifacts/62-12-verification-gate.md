# Story 62.12: Verification Gate

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Verification Gate page documenting the verification gate service, auto-retry logic, persistent execution mode, 3-layer fallback flow, and all configuration options,
so that I can understand how quality checks run before story completion and how to configure verification for my projects.

## Acceptance Criteria

1. Page documents the verification gate service: `runVerification()` runs configured checks, `storeVerificationResult()` persists results — sourced from `packages/core/src/verification-gate.ts` lines 42-133
2. 3 verification check types documented: `test`, `lint`, `typecheck`, `custom` — sourced from `packages/core/src/types.ts` line 1193
3. CheckResult and VerificationResult interfaces documented with field tables — sourced from `packages/core/src/types.ts` lines 1203-1232
4. 3-layer fallback flow shown as ASCII diagram: verify → auto-retry → persistent re-queue → final status — sourced from `packages/core/src/completion-handlers.ts` lines 415-522
5. Auto-retry logic documented: `scheduleVerificationRetry()`, configurable maxAttempts (default 2, max 5), backoffMs (default 5000) — sourced from `packages/core/src/verification-gate.ts` lines 288-318
6. VerificationRetryAttempt and retry history documented — sourced from `packages/core/src/types.ts` lines 1245-1252
7. Persistent execution mode documented: `schedulePersistentRequeue()`, only activates when `executionMode === "persistent"`, persistentMaxRetries (default 5) — sourced from `packages/core/src/verification-gate.ts` lines 378-405
8. onFailure behavior documented: `"block"` sets status to blocked, `"review"` (default) sets status to review — sourced from `packages/core/src/verification-gate.ts` line 296, `completion-handlers.ts` lines 491-503
9. Complete VerificationConfig interface documented: enabled, checks, onFailure, retry, persistent — sourced from `packages/core/src/types.ts` lines 1255-1275
10. Custom configuration section with YAML examples — sourced from `packages/core/src/config.ts` lines 119-142, 179
11. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 6)
12. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
13. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
14. Links to related pages: Sessions (62-7), Configuration (62-5), Stories & Sprints (62-8)
15. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #11, #14, #15)
  - [x] Front matter: title: Verification Gate, nav_order: 6, parent: Core Concepts, description
  - [x] One-paragraph intro explaining verification gate as opt-in quality check system
  - [x] TL;DR callout: 3-layer fallback, 4 check types, auto-retry, persistent execution, opt-in per-project
  - [x] No hero-style font classes

- [x] Task 2: Write "How Verification Works" section (AC: #1, #4, #13)
  - [x] ASCII diagram showing 3-layer fallback flow (verify → retry → persist → final) under 60 chars wide
  - [x] Step-by-step walkthrough of the completion handler verification flow (lines 415-522)
  - [x] Explain: opt-in, non-fatal, never blocks completion pipeline on internal errors
  - [x] Source: verification-gate.ts, completion-handlers.ts

- [x] Task 3: Write "Verification Checks" section (AC: #2, #3)
  - [x] Table of 4 check types: test, lint, typecheck, custom — types.ts:1193
  - [x] CheckResult field table (8 fields) — types.ts:1203-1218
  - [x] VerificationResult field table (4 fields) — types.ts:1223-1232
  - [x] Explain required vs optional checks
  - [x] Source: types.ts:1193-1232, verification-gate.ts:42-84

- [x] Task 4: Write "Auto-Retry" section (AC: #5, #6)
  - [x] Explain scheduleVerificationRetry() logic: enabled check, attempt count, backoff
  - [x] Default values: maxAttempts=2 (max 5), backoffMs=5000
  - [x] VerificationRetryAttempt fields (3 fields) — types.ts:1245-1252
  - [x] VerificationRetryConfig fields (3 fields) — types.ts:1235-1243
  - [x] writeRetryContextToNotepad() — verification-gate.ts:217-286
  - [x] Source: verification-gate.ts:288-318, types.ts:1235-1252

- [x] Task 5: Write "Persistent Execution" section (AC: #7)
  - [x] Explain: only activates when executionMode === "persistent" AND onFailure !== "block"
  - [x] schedulePersistentRequeue() — verification-gate.ts:378-405
  - [x] PersistentConfig fields (2 fields) — types.ts:1269-1275
  - [x] Default: persistentMaxRetries=5, persistentMaxExtensions=3
  - [x] Execution mode timeout multipliers: standard=1.0, persistent=3.0, lightweight=0.5
  - [x] Source: verification-gate.ts:320-405, session-timeout.ts:21-34, types.ts:1269-1275

- [x] Task 6: Write "Failure Behavior" section (AC: #8)
  - [x] onFailure: "block" → status "blocked", "review" (default) → status "review"
  - [x] Explain: block mode requires human intervention, review mode auto-notifies
  - [x] Audit events emitted: verification.passed, verification.failed, verification.retry_scheduled, verification.persistent_requeue, verification.retry_exhausted
  - [x] Source: completion-handlers.ts:491-522

- [x] Task 7: Write "Verification Configuration" section (AC: #9, #10)
  - [x] VerificationConfig field table: enabled, checks, onFailure, retry, persistent — types.ts:1255-1267
  - [x] YAML example with full verification config including checks and retry
  - [x] YAML example showing persistent execution config
  - [x] Explain: opt-in (enabled: true required), configured per-project
  - [x] Source: config.ts:119-142, 179, types.ts:1255-1275

- [x] Task 8: Write navigation and next steps (AC: #11, #12, #14)
  - [x] Link to Sessions (../sessions/) — Story 62-7
  - [x] Link to Configuration (../../getting-started/configuration/) — Story 62-5
  - [x] Link to Stories & Sprints (../stories-sprints/) — Story 62-8
  - [x] Front matter verified: title, nav_order, parent, description

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Not applicable** — This story modifies a single Jekyll markdown page. No TypeScript interfaces.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Design Decisions

- **3-layer fallback, not 2**: The epic says "3-layer fallback (verify→retry→persist)". Source confirms 3 distinct layers: (1) run verification checks, (2) auto-retry on failure with backoff, (3) persistent re-queue when retries exhausted. All 3 must be documented with the fallback logic.
- **Verification gate is opt-in**: `verification.enabled` defaults to false (no verification runs). Must document this clearly.
- **Non-fatal by design**: Verification errors never break the completion pipeline. If the verification runner throws, the story is still marked done. This is critical behavior to document.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.
- **Front matter title vs H1**: Must match. Both should be "Verification Gate".
- **CheckResult has 8 fields**: Count precisely from types.ts:1203-1218: type, command, passed, exitCode, stdout, stderr, duration, required.
- **VerificationResult has 4 fields**: types.ts:1223-1232: passed, checks, ranAt, duration.

### Previous Story Learnings (62-7 through 62-11)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide — verified with `wc -m` after every edit
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest
- Count enum values, step counts, field counts precisely against source code — these are the #1 source of High/Medium severity review findings
- **Title consistency**: Front matter `title` must match H1 heading. Caught in 62-9 review.
- **Type accuracy**: Use precise TypeScript union types in tables, not loose `string` approximations. Caught in 62-10 review.
- **Capture flow accuracy**: Verify the actual outcomes assigned by functions, not just what the type allows. Caught in 62-11 review (captureSessionLearning never assigns "blocked").
- **Filter accuracy**: When documenting filters, verify the actual pipeline behavior, not just one layer. Caught in 62-11 review (selectRelevantLearnings only passes "failed", not "failed and blocked").

### Source Files for Verification Gate Content

- **packages/core/src/verification-gate.ts** (405 lines) — Core service: runCheck() (line 42), runVerification() (line 86), storeVerificationResult() (line 114), loadVerificationResult() (line 135), getVerificationRetryCount() (line 157), storeVerificationRetryAttempt() (line 173), loadVerificationRetryHistory() (line 195), writeRetryContextToNotepad() (line 217), scheduleVerificationRetry() (line 288), getExecutionMode() (line 328), getPersistentRequeueCount() (line 343), storePersistentRequeueAttempt() (line 358), schedulePersistentRequeue() (line 378)
- **packages/core/src/completion-handlers.ts** (756 lines) — Verification integration in completion handler: verification flow (lines 415-522), retry logic (lines 434-466), persistent re-queue (lines 468-490), exhausted fallback (lines 491-503), audit events (lines 509, 459, 485, 495)
- **packages/core/src/types.ts** — VerificationCheck (line 1193), CheckResult (lines 1203-1218), VerificationResult (lines 1223-1232), VerificationRetryConfig (lines 1235-1243), VerificationRetryAttempt (lines 1245-1252), VerificationConfig (lines 1255-1267), PersistentConfig (lines 1269-1275), EventType verification events (lines 819-821), AgentMapping executionMode (line 1448), BlockedAgentDetectorConfig (lines 2044-2048)
- **packages/core/src/config.ts** — VerificationCheckSchema (lines 119-123), VerificationRetryConfigSchema (lines 125-129), VerificationConfigSchema (lines 131-142), ProjectConfigSchema verification field (line 179), AgentMappingSchema executionMode (lines 99-102)
- **packages/core/src/session-timeout.ts** (67 lines) — EXECUTION_MODE_TIMEOUT_MULTIPLIERS (lines 21-28), MIN_TIMEOUT=60000 (line 31), MAX_TIMEOUT=3600000 (line 34), resolveSessionTimeout() (line 48)
- **packages/core/src/session-state.ts** (127 lines) — readSessionState reads persistent_requeue_count (line 116)
- **packages/core/src/index.ts** (1123 lines) — Verification gate exports (lines 1104-1123)

### Key Verification Gate Facts (verified against source)

**4 check types:** test, lint, typecheck, custom — types.ts:1193

**CheckResult fields (8):** type, command, passed, exitCode, stdout, stderr, duration, required — types.ts:1203-1218

**VerificationResult fields (4):** passed, checks, ranAt, duration — types.ts:1223-1232

**VerificationRetryConfig fields (3):** enabled (default true), maxAttempts (default 2, max 5), backoffMs (default 5000) — types.ts:1235-1243

**VerificationRetryAttempt fields (3):** attempt (1-based), ranAt (ISO), result (VerificationResult) — types.ts:1245-1252

**VerificationConfig fields (5):** enabled (boolean), checks (VerificationCheck[]), onFailure ("block" | "review", default "review"), retry (VerificationRetryConfig?), persistent (PersistentConfig?) — types.ts:1255-1267

**PersistentConfig fields (2):** persistentMaxRetries (default 5), persistentMaxExtensions (default 3) — types.ts:1269-1275

**3-layer fallback:**
1. Run verification → if all pass, done
2. If fail → scheduleVerificationRetry → if under maxAttempts, retry with backoff
3. If retries exhausted AND executionMode === "persistent" → schedulePersistentRequeue
4. All exhausted → status based on onFailure ("blocked" or "review")

**Non-fatal:** Verification errors never break completion pipeline — completion-handlers.ts:518-522

**Opt-in:** verification.enabled must be true — types.ts:1256

**Default onFailure:** "review" — config.ts:139

**Persistent execution gate:** Only activates when `ao:executionMode === "persistent"` AND `onFailure !== "block"` — verification-gate.ts:386-388

**Execution mode timeout multipliers:** standard=1.0, persistent=3.0, lightweight=0.5 — session-timeout.ts:21-28

**5 audit events:** verification.passed, verification.failed, verification.retry_scheduled, verification.persistent_requeue, verification.retry_exhausted — completion-handlers.ts

**Metadata keys:**
- `verification_result` (JSON string of VerificationResult)
- `verification_retry_count` (stringified integer)
- `verification_retry_history` (JSON string of VerificationRetryAttempt[])
- `ao:executionMode` (string: "standard" | "persistent" | "lightweight")
- `persistent_requeue_count` (stringified integer)

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for type fields, check types, config options
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for config examples
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../sessions/` → `docs/core-concepts/sessions.md` (exists, updated in Story 62-7)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)
- `../stories-sprints/` → `docs/core-concepts/stories-sprints.md` (exists, updated in Story 62-8)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/verification-gate.md`.

### References

- [Source: packages/core/src/verification-gate.ts — runVerification, storeVerificationResult, scheduleVerificationRetry, schedulePersistentRequeue]
- [Source: packages/core/src/completion-handlers.ts — verification flow in completion handler, retry/persistent integration]
- [Source: packages/core/src/types.ts — VerificationCheck, CheckResult, VerificationResult, VerificationConfig, PersistentConfig]
- [Source: packages/core/src/config.ts — VerificationConfigSchema, VerificationCheckSchema, VerificationRetryConfigSchema]
- [Source: packages/core/src/session-timeout.ts — execution mode timeout multipliers]
- [Source: Story 62-11 — Previous story learnings (filter accuracy, capture flow accuracy, type precision)]
- [Source: Story 62-10 — Previous story learnings (type accuracy in tables, diagram widths)]
- [Source: Story 62-7 — Previous story learnings (diagram width, callouts, source accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 15 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars display width (max: 50 chars)
- 4 check types documented: test, lint, typecheck, custom — types.ts:1193
- CheckResult 8 fields documented from types.ts:1203-1218
- VerificationResult 4 fields documented from types.ts:1223-1232
- 3-layer fallback flow diagram: verify → auto-retry → persistent re-queue → final status
- Auto-retry with VerificationRetryConfig (3 fields) and VerificationRetryAttempt (3 fields)
- Persistent execution with PersistentConfig (2 fields) and execution mode timeout multipliers
- onFailure behavior: "block" → blocked, "review" → review
- 5 audit events documented: verification.passed, failed, retry_scheduled, retry_exhausted, persistent_requeue
- 3 YAML configuration examples: basic, with retry, with persistent execution
- VerificationConfig 5-field table with defaults
- No hero-style font classes used on interior page
- Front matter title matches H1 heading (both "Verification Gate")
- 3 navigation links verified against existing sibling pages
- `pnpm test` passes (only pre-existing standup-generator date sensitivity failure unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-22 | Created story artifact from epic and source analysis | Claude Sonnet 4 |
| 2026-04-22 | Rewrote verification-gate.md from placeholder to full production page | Claude Sonnet 4 |
| 2026-04-22 | Code review: fixed 3M+1L issues (CheckResult type accuracy, YAML agentMappings key/structure, enabled default, missing path) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4
**Outcome:** Approved with fixes

**Source Verifications (20 checks):**
1. ✓ 4 check types: test, lint, typecheck, custom — types.ts:1193-1195
2. ✓ CheckResult 8 fields — types.ts:1203-1219
3. ✓ VerificationResult 4 fields — types.ts:1223-1231
4. ✓ VerificationRetryConfig 3 fields — types.ts:1235-1241
5. ✓ VerificationRetryAttempt 3 fields — types.ts:1245-1251
6. ✓ VerificationConfig 5 fields — types.ts:1255-1265
7. ✓ PersistentConfig 2 fields — types.ts:1269-1273
8. ✓ MAX_OUTPUT_CHARS = 500 — verification-gate.ts:31
9. ✓ Default retry.enabled: true (via !== false check) — verification-gate.ts:303
10. ✓ Default retry.maxAttempts: 2 — verification-gate.ts:308, config.ts:127
11. ✓ Max retry.maxAttempts: 5 — config.ts:127
12. ✓ Default retry.backoffMs: 5000 — verification-gate.ts:294, config.ts:128
13. ✓ Default persistentMaxRetries: 5 — config.ts:138
14. ✓ Default persistentMaxExtensions: 3 — config.ts:139
15. ✓ Default onFailure: "review" — config.ts:134
16. ✓ Execution mode timeouts: standard=1.0, persistent=3.0, lightweight=0.5 — session-timeout.ts:24-27
17. ✓ 5 audit events — completion-handlers.ts:459,485,495,509
18. ✓ Non-fatal: catch at line 518-522, finalStatus initialized as "done" — completion-handlers.ts:417,518-522
19. ✓ Persistent gate: executionMode !== "persistent" (line 386), onFailure === "block" (line 391) — verification-gate.ts:386,391
20. ✓ Opt-in: verification?.enabled check — completion-handlers.ts:431

**Findings (4):**
- [M1] CheckResult.type showed `string` instead of union type — FIXED
- [M2] YAML "With Persistent Execution" used `agents:` (wrong key/array format) instead of `agentMappings:` record format — FIXED
- [M3] VerificationConfig.enabled default showed `false` but field is required with no default — FIXED to "Required"
- [L1] All YAML examples missing required `path` field — FIXED

### File List

- `docs/core-concepts/verification-gate.md` — rewritten from placeholder to full production page (~240 lines)
