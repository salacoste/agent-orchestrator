# Story 59.3: Auto-Install OMC in Worktrees

Status: done

## Story

As a developer spawning an agent session,
I want the orchestrator to verify that the session enhancement provider was correctly installed in my worktree,
so that my session has a reliable OMC environment (notepad, project memory, state directories) rather than silently proceeding with a broken installation.

## Acceptance Criteria

1. **AC1 — `verifyInstallation()` function**: A new exported function `verifyInstallation(worktreePath: string, providerName: string): Promise<InstallationResult>` is defined in a new module `packages/core/src/provider-verify.ts`. `InstallationResult` is `{ verified: boolean; missing: string[] }`.
2. **AC2 — OMC-specific verification**: For the OMC provider, `verifyInstallation` checks that the following artifacts exist after `install()` completes:
   - `.omc/` directory exists
   - `.omc/state/` directory exists
   - `.omc/project-memory.json` file exists (valid JSON)
   - `.omc/notepad.md` file exists (if `configure()` has been called)
3. **AC3 — Raw provider skip**: When `activeProvider.name === "raw"`, verification is skipped entirely (raw provider has no filesystem artifacts).
3. **AC4 — Integration into spawn flow**: After `activeProvider.install()` succeeds (line ~551 in session-manager.ts), the spawn flow calls `verifyInstallation()` and checks the result. If `verified === false`:
   - Log a warning listing the missing artifacts
   - Fall back to raw provider (set `activeProvider = rawProvider`)
   - Continue session spawn without blocking
5. **AC5 — Post-configure verification**: After `activeProvider.configure()` succeeds (line ~666), a second verification checks that `.omc/notepad.md` now exists. If not, log warning but do NOT fall back (session is already past the install phase).
6. **AC6 — Non-blocking behavior**: Verification failures never block session spawn. All verification is wrapped in try/catch — if verification itself throws (e.g., permission error), log warning and continue with current provider.
7. **AC7 — Provider-agnostic interface**: The `InstallationResult` type and `verifyInstallation()` function are provider-agnostic. The function uses the provider name to determine which artifacts to check. For unknown providers, it performs a basic check (`.omc/` directory exists).
8. **AC8 — Unit tests**: Comprehensive vitest tests covering:
   - `verifyInstallation()` returns `{ verified: true, missing: [] }` for valid OMC install
   - `verifyInstallation()` returns `{ verified: false, missing: [...] }` for partial install
   - `verifyInstallation()` returns `{ verified: true, missing: [] }` for raw provider (skip)
   - Verification failure triggers fallback to raw provider in spawn flow
   - Post-configure verification logs warning on missing notepad
   - Verification exception is caught and logged without blocking
   - Unknown provider falls back to basic `.omc/` check

## Tasks / Subtasks

- [x] Task 1: Define InstallationResult type (AC: #1)
  - [x] 1.1 Add `InstallationResult` interface to `packages/core/src/types.ts` — `{ verified: boolean; missing: string[] }`
  - [x] 1.2 Export `InstallationResult` from `packages/core/src/index.ts`

- [x] Task 2: Create provider-verify module (AC: #1, #2, #3, #7)
  - [x] 2.1 Create `packages/core/src/provider-verify.ts`
  - [x] 2.2 Implement `verifyInstallation(worktreePath, providerName)` — dispatches to provider-specific checks
  - [x] 2.3 Implement `verifyOmcInstallation(worktreePath)` — checks `.omc/`, `.omc/state/`, `.omc/project-memory.json`
  - [x] 2.4 Implement `verifyBasicInstallation(worktreePath)` — checks `.omc/` directory for unknown providers
  - [x] 2.5 Implement `verifyOmcConfigure(worktreePath)` — checks `.omc/notepad.md` exists post-configure
  - [x] 2.6 Export all functions from `provider-verify.ts`
  - [x] 2.7 Add exports to `packages/core/src/index.ts`

- [x] Task 3: Integrate into session-manager spawn flow (AC: #4, #5, #6)
  - [x] 3.1 After `activeProvider.install()` succeeds (~line 563), call `verifyInstallation()`
  - [x] 3.2 If verification fails, log warning with missing artifacts, fall back to raw provider
  - [x] 3.3 After `activeProvider.configure()` succeeds (~line 678), call `verifyOmcConfigure()`
  - [x] 3.4 If post-configure verification fails, log warning but do NOT fall back
  - [x] 3.5 Wrap all verification in try/catch — verification failure must never block spawn

- [x] Task 4: Unit tests (AC: #8)
  - [x] 4.1 Create `packages/core/src/__tests__/provider-verify.test.ts`
  - [x] 4.2 Test `verifyInstallation()` returns verified:true for valid OMC install
  - [x] 4.3 Test `verifyInstallation()` returns verified:false for partial install with missing artifacts listed
  - [x] 4.4 Test `verifyInstallation()` skips verification for raw provider
  - [x] 4.5 Test unknown provider falls back to basic `.omc/` check
  - [x] 4.6 Test `verifyOmcConfigure()` returns verified:true when notepad.md exists
  - [x] 4.7 Test `verifyOmcConfigure()` returns verified:false when notepad.md missing
  - [x] 4.8 Test verification exception is caught and returns verified:false
  - [x] 4.9 Test session-manager integration: failed verification triggers raw fallback

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

CLAUDE.md merge verification is deferred to Story 59-4.
Story-type hook verification is deferred to Story 59-5.
Agent mapping verification is deferred to Story 59-6.

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
- [x] `SessionEnhancementProvider.install()` — existing interface, called in spawn() (~line 551)
- [x] `SessionEnhancementProvider.configure()` — existing interface, called in spawn() (~line 666)
- [x] `existsSync` from `node:fs` — for checking directory/file existence
- [x] `readFile` from `node:fs/promises` — for validating JSON content in project-memory.json

**Feature Flags:**
- Verification is only called for non-raw providers. Raw provider sessions skip verification entirely.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only `node:fs` and `node:fs/promises`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 16 unit tests passing
- No new external dependencies
- Pre-existing typecheck/lint failures in unrelated files (resource-conflict.test.ts, degraded-mode.ts)
- Verification is non-blocking: all calls wrapped in try/catch
- Post-install failure triggers raw fallback; post-configure failure only logs

### File List

| File | Change |
|------|--------|
| `packages/core/src/provider-verify.ts` | NEW — verifyInstallation, verifyOmcInstallation, verifyOmcConfigure, verifyBasicInstallation |
| `packages/core/src/types.ts` | MODIFY — Added InstallationResult interface after ProviderHealth |
| `packages/core/src/index.ts` | MODIFY — Export provider-verify module and InstallationResult type |
| `packages/core/src/session-manager.ts` | MODIFY — Add verification after install() and configure() calls |
| `packages/core/src/__tests__/provider-verify.test.ts` | NEW — 16 unit tests for verification functions |
| `_bmad-output/implementation-artifacts/59-3-auto-install-omc-worktrees.md` | MODIFY — This story file (tasks marked complete) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-3 status (already in-progress) |

## Dev Notes

### Architecture Context

This story builds the **installation verification** layer for the OMC provider. While `provider.install()` is already called in `session-manager.ts` spawn flow (lines 505-563), there is currently ZERO post-install verification. If `install()` returns successfully but filesystem artifacts are missing (e.g., race condition, disk full, permission error), the session proceeds with a broken OMC environment.

**What Story 58-3 built (foundation):**
- `OMCProvider.install()` — creates `.omc/`, `.omc/state/`, `.omc/plans/`, `.omc/logs/`, `.omc/project-memory.json`
- `OMCProvider.configure()` — creates `.omc/notepad.md` via `createNotepad()` and `.claude/omc.jsonc`

**What Story 59-1 added:**
- `createNotepad()` extracted to `packages/core/src/notepad.ts`
- Story context enrichment in session-manager spawn flow
- OMC provider delegates notepad creation to shared `createNotepad()`

**What Story 59-2 added:**
- Compaction survival hooks (`HookRegistry`, `notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact`)
- Hook registry initialized in spawn flow for non-raw providers
- `runPreCompactHooks`/`runPostCompactHooks` methods on SessionManager

**What 59-3 adds (THIS STORY):**
- `verifyInstallation()` — post-install filesystem verification
- `InstallationResult` type — structured verification result with missing artifact list
- Integration into session-manager spawn flow — verification after `install()` and after `configure()`
- Graceful fallback to raw provider when verification fails

### Current Install Flow in session-manager.ts

```
spawn() flow (lines 505-678):
  → resolveProvider(project)           // get configured provider
  → circuit breaker check              // fall back to raw if breaker OPEN
  → healthCheck()                      // pre-install health check
  → activeProvider.install()           // create .omc/ directories + project-memory.json
  ← NO VERIFICATION HERE               ← THIS IS THE GAP THIS STORY FILLS
  → buildPrompt()                      // generate session prompt
  → enrich storyContext from artifact  // best-effort
  → activeProvider.configure()         // create notepad.md + omc.jsonc
  ← NO VERIFICATION HERE EITHER        ← THIS IS ALSO A GAP
  → hook registry setup                // compaction survival hooks (59-2)
  → runtime.create()                   // launch agent
```

### Key Design Decisions

1. **Verification is a separate module, not a provider method**: Adding `verify()` to the `SessionEnhancementProvider` interface would require updating all providers. Instead, verification is a standalone function that knows what artifacts each provider should produce. This follows the "adapter" pattern — verification adapts to each provider's known artifacts.

2. **Verification returns structured result, not boolean**: `InstallationResult` includes `missing: string[]` so that warning messages can tell the operator exactly what's wrong. A simple boolean would require a second check to diagnose.

3. **Two verification points**: Post-install (after `.omc/` setup) and post-configure (after notepad creation). Different points check different artifacts. Post-install failure triggers raw fallback. Post-configure failure only logs — the session is already committed.

4. **Provider name determines verification strategy**: `"omc"` gets full artifact check. `"raw"` gets skipped entirely. Unknown providers get basic `.omc/` check (defensive).

5. **Non-blocking verification**: Verification that throws (permissions, I/O errors) returns `{ verified: false, missing: [] }` rather than propagating. Session spawn must always succeed.

### File Change Impact

| File | Change | Why |
|------|--------|-----|
| `packages/core/src/provider-verify.ts` | NEW | verifyInstallation, verifyOmcInstallation, verifyOmcConfigure |
| `packages/core/src/types.ts` | MODIFY | Add InstallationResult interface |
| `packages/core/src/index.ts` | MODIFY | Export provider-verify module and InstallationResult type |
| `packages/core/src/session-manager.ts` | MODIFY | Call verifyInstallation after install, verifyOmcConfigure after configure |
| `packages/core/src/__tests__/provider-verify.test.ts` | NEW | Unit tests for verification functions |
| `_bmad-output/implementation-artifacts/59-3-auto-install-omc-worktrees.md` | NEW — This story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-3 status updated |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { existsSync } from "node:fs"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { InstallationResult } from "./types.js"`

### TypeScript Conventions (MUST follow)

- ESM modules — `"type": "module"` in package.json
- Strict mode — `"strict": true` in tsconfig
- No `any` — use `unknown` + type guards
- No non-null assertions (`!`) — use guards
- Semicolons, double quotes, 2-space indent (enforced by Prettier)

### Testing Standards

- **Framework**: vitest
- **Location**: `src/__tests__/*.test.ts` co-located with source
- **Assertion style**: `expect(x).toBe(y)` — no `expect(true).toBe(true)`
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in package
- **File fixtures**: Use `os.tmpdir()` for test files, clean up in afterEach

### Anti-Patterns to Avoid

- **DO NOT** add a `verify()` method to the `SessionEnhancementProvider` interface — that's a breaking change for all providers
- **DO NOT** implement CLAUDE.md merge verification — that's Story 59-4
- **DO NOT** implement story-type hook profiles — that's Story 59-5
- **DO NOT** make verification blocking — session spawn must always succeed
- **DO NOT** add external dependencies — use only `node:fs`/`node:fs/promises`

### Limitations (Deferred Items)

1. **CLAUDE.md merge verification**
   - Status: Deferred — Story 59-4
   - Requires: CLAUDE.md merge logic and content validation
   - Current: No verification of CLAUDE.md content after merge

2. **Story-type hook verification**
   - Status: Deferred — Story 59-5
   - Requires: Hook profile configuration per story type
   - Current: Only default hooks are verified (not per-story customization)

3. **Provider-specific verification extensibility**
   - Status: Deferred — would require interface change
   - Requires: `verify()` method on SessionEnhancementProvider interface
   - Current: Verification logic is provider-name-based in a standalone module

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 59, Story 59-3 definition, FR-S2-1]
- [Source: `packages/core/src/types.ts:1300-1337` — SessionEnhancementProvider interface]
- [Source: `packages/core/src/session-manager.ts:505-563` — Provider install flow in spawn()]
- [Source: `packages/core/src/session-manager.ts:606-678` — Provider configure flow in spawn()]
- [Source: `packages/plugins/provider-omc/src/index.ts:93-103` — OMCProvider.install() implementation]
- [Source: `packages/plugins/provider-omc/src/index.ts:148` — OMCProvider.configure() creates notepad]
- [Source: `packages/core/src/notepad.ts` — createNotepad, readNotepad, writeNotepadSection]
- [Source: `_bmad-output/implementation-artifacts/59-2-compaction-survival-hooks.md` — Previous story]
- [Source: `_bmad-output/implementation-artifacts/59-1-notepad-creation-story-context.md` — Story 59-1 learnings]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, shell command security]

### Previous Story Intelligence (59-1, 59-2)

**Key learnings from 59-1 and 59-2 that impact this story:**

1. **Atomic writes are critical**: The notepad module uses temp-file-then-rename for all writes. Verification should not modify files — only read/check.

2. **`.omc/` directory already exists by install time**: Story 59-1 ensured `.omc/` is created in both `createNotepad()` and `writeNotepadSection()`. Story 58-3's OMCProvider.install() also creates it. Verification can safely assume the directory may or may not exist.

3. **Best-effort enrichment pattern**: Story context enrichment in session-manager wraps in try/catch so failures never block spawn. Verification MUST follow the same pattern.

4. **ESLint caught unused imports**: The 59-1 code review fixed an unused `mkdirSync` import. Be careful to only import what's used.

5. **Hook registry wraps in try/catch**: Story 59-2's hook registry initialization follows the best-effort pattern. Verification should do the same.

6. **Session-manager.ts uses `existsSync` from sync imports**: The file already imports `existsSync` from `node:fs` (line 14). Verification can use this existing import.

7. **Monkey-patch pattern for spawn/kill**: Story 59-2 wrapped spawn/kill to manage hook registries. Verification changes go directly into the spawn function body, not as wrappers.
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-3 status updated |
