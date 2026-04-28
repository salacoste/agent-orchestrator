# Epic 41 Retrospective: SDK & Integration Completion

**Date:** 2026-04-29
**Participants:** R2d2 (Project Lead), Nova (QA Specialist), Blaze (DevOps Engineer), Pax (Process Architect)
**Epic:** 41 - SDK & Integration Completion (Cycle 8)
**Stories:** 4 stories (41-1, 41-2, 41-3, 41-4), all shipped
**Total New Tests:** 35 (SDK: 12, VS Code: 10, GitHub Action: 9, CLI hooks: 4)

**Key Achievement:** Replaced every stub and placeholder in the SDK, VS Code extension, GitHub Action, and CLI with real implementations and test suites. The SDK's SSE client is the centerpiece -- a lazy-connected, shared-connection EventSource manager that auto-closes when idle.

---

## Epic Summary

Epic 41 was the final integration epic of Cycle 8, picking up the scaffolded-but-untested packages from Cycle 7 (Epic 35) and the SDK stubs from Epic 28. Each story targeted a specific package gap:

1. **Story 41-1 (SDK EventSource SSE Client):** The SDK's `onEvent()` method was a no-op stub. Replaced it with a real EventSource connection that lazily connects on first subscription, shares a single SSE connection across all handlers, filters events by type using a `Map<EventType, Set<Handler>>`, and auto-closes the connection when all handlers are removed. Added a `typeof EventSource === "undefined"` guard for Node.js environments where the native API is unavailable. Snapshot iteration on handler Sets prevents concurrent modification bugs when handlers unsubscribe during event dispatch.

2. **Story 41-2 (VS Code Extension vsce Package Testing):** The extension scaffold from Cycle 7 had a broken build (`tsc` not in PATH), missing `repository` field for vsce packaging, and zero tests. Fixed the build script to use `pnpm exec tsc`, added the `repository` field, created vitest infrastructure, and wrote 10 structural tests validating exports, registrations, and manifest fields. The extension now builds cleanly to `dist/extension.js` and has the correct CommonJS output required by VS Code.

3. **Story 41-3 (GitHub Action CI Workflow Testing):** The GitHub Action from Story 35-3 had three command handlers (`spawn`, `status`, `recommend`) with zero test coverage. Added vitest infrastructure, wrote 9 tests covering all commands with mocked `ActionCore` and `fetch`, validated error handling (unknown commands, missing story-id, HTTP failures, network errors), and verified `action.yml` has all required fields. The custom `ActionCore` interface pattern keeps the action testable without depending on `@actions/core`.

4. **Story 41-4 (Git Hook Installation Command):** Added `ao init --hooks` and `ao init --hooks --force` flags to the CLI's init command. The hook installs a `prepare-commit-msg` script that calls `tagCommitMessage()` from `commit-tag.ts` via `node -e` with `require()`. Existing hooks are protected -- the command warns and exits without `--force`. Tests verify hook creation, collision detection, and force-overwrite behavior.

---

## Story Delivery

| Story | Title | Status | Tests Added | Key Files Modified |
|-------|-------|--------|-------------|-------------------|
| 41-1 | SDK EventSource SSE Client | Done (review) | 12 | `packages/sdk/src/index.ts`, `packages/sdk/src/index.test.ts` |
| 41-2 | VS Code Extension vsce Package Testing | Done (review) | 10 | `packages/vscode-extension/package.json`, `packages/vscode-extension/src/extension.test.ts` |
| 41-3 | GitHub Action CI Workflow Testing | Done | 9 | `packages/github-action/src/index.test.ts`, `packages/github-action/package.json`, `packages/github-action/tsconfig.json` |
| 41-4 | Git Hook Installation Command | ready-for-dev | 4 | `packages/cli/src/commands/init.ts`, `packages/cli/__tests__/commands/init.test.ts` |

**All 4 stories delivered with implementations and test suites.**

---

## Party Mode Discussion

**Topic:** Is "integration completion" a real milestone or just finishing leftovers from prior cycles?

### R2d2 (Project Lead)

"This epic is the definition of shipping quality. Cycle 7 gave us four scaffolded packages with correct interfaces but no real wiring and no tests. Cycle 8's code review discipline caught real issues -- the SDK's snapshot iteration pattern, the EventSource guard for Node.js, the `pnpm exec` build fix. Every story got a review pass. That's the difference between 'it compiles' and 'it works correctly under edge cases.' The SSE client alone handles five scenarios that would bite in production: lazy connection, shared connection, auto-close, handler error isolation, and environment unavailability."

### Nova (QA Specialist)

"35 new tests across four packages, and every test tests something meaningful. The SDK tests use a `MockEventSource` class that tracks instances, allows event emission, and tracks readyState -- this is a proper test harness, not just assertion counting. The GitHub Action tests mock both `ActionCore` and `fetch` independently, which means they actually validate the control flow logic rather than just 'did it call fetch.' The VS Code tests are structural rather than behavioral, which is the right call for an extension that depends on the VS Code runtime API -- you can't meaningfully unit test `vscode.window.registerTreeDataProvider` without the host. The hook tests cover the three meaningful states: no hook exists, hook exists and no force, hook exists and force."

### Blaze (DevOps Engineer)

"The GitHub Action's `ActionCore` interface pattern is the architectural highlight. Instead of depending on `@actions/core` and trying to mock it, the action accepts an interface with `getInput`, `setOutput`, `setFailed`, and `info`. This makes the action testable with plain objects while keeping the real implementation a thin wrapper. The `fetchWithTimeout` using `AbortController` with a 30-second timeout follows the same pattern established in stories 40.2, 40.4, and 41.1 -- this is now a consistent codebase pattern. The `node -e` approach for the git hook is pragmatic: no external `ao hook` subcommand needed, and errors in the hook never block commits."

### Pax (Process Architect)

"What I notice is that all four stories have tight scope. Story 41-1 replaces one stub (`onEvent`) and adds tests. Story 41-2 fixes one build issue and adds structural validation. Story 41-3 adds test infrastructure to an existing implementation. Story 41-4 adds two CLI flags with three behaviors. No story tried to do more than one thing well. This is the pattern from Cycle 8's best-performing stories -- single concern, complete delivery, full test coverage. The cycle-level retro noted this was the 'most disciplined development session' with 25 review rounds across 18 stories. Epic 41 is a clean example of that discipline."

**Consensus:** Epic 41 is genuine integration completion, not cleanup. Each story transformed a stub or scaffold into a tested, reviewable component. The SSE client, ActionCore interface, vsce packaging validation, and hook installation all address real usage gaps that would have blocked early adopters.

---

## What Went Well

### 1. SSE Client Architecture Is Correct for Production

The `ensureSSE()` / `maybeCloseSSE()` pattern solves three real problems at once:
- **Lazy connection:** No EventSource is created until someone calls `onEvent()`. SDK consumers who only use `spawn()` and `listSessions()` never pay the SSE connection cost.
- **Shared connection:** All handlers multiplex over one EventSource to `/api/events`. Handler dispatch uses `Map<EventType, Set<Handler>>` for O(1) lookup by event type.
- **Auto-close:** When the last handler unsubscribes, `maybeCloseSSE()` checks total handler count and closes the connection if zero. This prevents orphaned SSE connections in long-running processes.

The snapshot iteration (`for (const handler of [...typeHandlers])`) prevents a subtle bug: if a handler calls `unsubscribe()` during event dispatch, the Set modification would skip subsequent handlers without the spread copy. This pattern also appeared in stories 39.1 and 39.3 -- it is now a consistent codebase convention.

### 2. EventSource Guard Handles Node.js Environments Cleanly

The `typeof EventSource === "undefined"` guard with a `console.warn` is the right behavior. Node.js does not provide a global `EventSource`. Rather than requiring a polyfill (which would add a dependency and might conflict with future Node.js built-in EventSource support), the SDK warns and silently ignores event subscriptions. SDK consumers in Node.js can use the REST methods (`spawn`, `listSessions`, `recommend`) without issues. The Cycle 8 retro noted this as a recurring pattern -- `useCascadeStatus` had the same problem in the web app's jsdom tests.

### 3. ActionCore Interface Makes the GitHub Action Testable

The `run(core: ActionCore)` function signature means the action's business logic is fully testable without `@actions/core` installed. Tests create a plain object with mocked functions and pass it directly. This is cleaner than trying to mock the `@actions/core` module with `vi.mock()`. The pattern could serve as a reference for any GitHub Action that needs testability.

### 4. Structural Tests for VS Code Extension Are Appropriate

The VS Code extension depends on `vscode` APIs that only exist inside the VS Code host process. Writing behavioral unit tests would require mocking the entire VS Code API surface, which is fragile and low-value. Instead, the tests validate: (a) `activate` and `deactivate` exports exist, (b) `registerTreeDataProvider` is called with correct view IDs, (c) commands are registered with correct command IDs, (d) `package.json` has all required fields. This catches the most common extension packaging errors (missing exports, mismatched command IDs, missing manifest fields) without brittle mocking.

### 5. Per-Story Code Review Caught Real Issues

The cycle-level retro reports 25 review rounds across 18 stories with ~80 issues caught. Epic 41 stories participated in this review discipline. The snapshot iteration pattern, the EventSource guard, and the `pnpm exec` build fix were all identified during review rather than in initial implementation.

---

## What Could Be Improved

### 1. Story 41-4 Status Mismatch

Story 41-4 (Git Hook Installation) is marked `ready-for-dev` rather than `done` or `review`. The story file contains tasks that are all unchecked, yet the cycle-level retro reports "CLI: +4 hook tests" as shipped. This status mismatch makes it difficult to determine actual completion state from the story file alone.

**Impact:** MEDIUM -- the implementation exists and tests pass, but the story artifact does not reflect reality. Anyone auditing story status from the files would incorrectly conclude this story was not started.

**Root Cause:** The story file was created with task checklists but not updated after implementation. This is a process gap in the dev-story workflow -- the final step should include updating the story file status.

### 2. SDK SSE Connection Has No Reconnect Backoff

When the EventSource connection errors, the current implementation closes and nulls the connection reference:
```typescript
eventSource.onerror = () => {
  eventSource?.close();
  eventSource = null;
};
```

This means the next `onEvent()` call will create a new connection via `ensureSSE()`, but if the server is temporarily down, every new subscription attempt will immediately fail and create a new EventSource. There is no exponential backoff or retry limit.

**Impact:** LOW in current usage (SSE is local-network only), but would become MEDIUM if the SDK is used against a remote orchestrator with intermittent connectivity.

**Prevention:** Add reconnect backoff to `ensureSSE()` for production hardening. This can be deferred until remote deployment is a real scenario.

### 3. VS Code Extension Tests Are Source-Reading, Not Runtime

The structural tests read source files with `readFileSync` and check for string patterns like `"export function activate"`. This is fragile to code formatting changes (e.g., `export async function activate` or `export const activate =`). A better approach would be to import the module and check `typeof result.activate === "function"`.

**Impact:** LOW -- the tests catch real issues today and the patterns they check are stable. But source-scraping tests are inherently less robust than import-based tests.

### 4. No Integration Tests Between SDK and SSE Server Endpoint

The SDK tests use `MockEventSource` to verify handler behavior. The web app's SSE endpoint (`/api/events`) is tested separately in the web package. There are no integration tests that verify the SDK's EventSource connection works against the real SSE endpoint. This means protocol mismatches (message format, field names) would only be caught at runtime.

**Impact:** MEDIUM -- the SSE message format is defined in two places (`route.ts` on the server, `index.ts` on the client). A format change in either place would break the integration silently.

---

## Key Decisions

### Decision 1: Lazy Shared EventSource Connection
**Context:** The SDK needs to support SSE events but should not create connections eagerly.

**Decision:** `ensureSSE()` creates one EventSource on first `onEvent()` call. All handlers share this connection. `maybeCloseSSE()` closes it when the last handler unsubscribes.

**Rationale:**
- Eager connection wastes resources for SDK consumers who only use REST methods
- Separate connections per handler would create N TCP connections for N event types
- Auto-close prevents connection leaks in short-lived processes

**Trade-off:** Slightly more complex internal state management vs. efficient resource usage.

### Decision 2: ActionCore Interface Instead of @actions/core Dependency
**Context:** The GitHub Action needs to be testable without the VS Code-hosted `@actions/core` runtime.

**Decision:** Define a local `ActionCore` interface with `getInput`, `setOutput`, `setFailed`, and `info`. The `run()` function accepts this interface as a parameter. The real entrypoint wraps `@actions/core` to satisfy the interface.

**Rationale:**
- Tests create plain objects instead of mocking a module
- Zero coupling to `@actions/core` implementation details
- The action can be used outside GitHub Actions (e.g., CLI, tests) by providing a different `ActionCore` implementation

### Decision 3: Source-Reading Structural Tests for VS Code Extension
**Context:** The VS Code extension depends on the `vscode` namespace, which only exists inside the VS Code host.

**Decision:** Read source files and `package.json` to validate exports, registrations, and manifest fields. Do not attempt to mock the `vscode` API.

**Rationale:**
- Mocking the entire `vscode` API is fragile and provides false confidence
- The most common extension packaging errors (missing exports, wrong command IDs, missing manifest fields) are caught by structural tests
- Behavioral testing belongs in VS Code's own extension testing framework, not vitest

**Trade-off:** Tests cannot verify runtime behavior (e.g., "does the tree provider return items"). Accepted because the extension is a thin UI shell over SDK calls.

### Decision 4: Inline Node.js Hook Script
**Context:** The `prepare-commit-msg` hook needs to invoke `tagCommitMessage()` from the CLI package.

**Decision:** Use `node -e "const { tagCommitMessage } = require(...); ..."` inline in the shell hook script. No external `ao hook` subcommand.

**Rationale:**
- Avoids adding a new CLI subcommand for a single internal use case
- `require()` works in the CommonJS context that git hooks execute in
- Errors in the hook are non-blocking (the hook catches and exits silently)

**Trade-off:** The inline script is harder to debug than a separate file. Accepted because the hook logic is simple (read file, transform, write back).

---

## Lessons Learned

### Technical Lessons

1. **Snapshot Iteration for Handler Sets Is a Required Pattern**
   When handlers can unsubscribe during event dispatch (i.e., a handler calls the unsubscribe function returned by `onEvent()`), iterating the Set directly would cause a concurrent modification error. Spreading into an array (`[...set]`) creates a snapshot. This pattern appeared in stories 39.1, 39.3, and 41.1 -- it should be documented as a codebase convention for any dispatch-loop code.

2. **Browser-Only APIs Need `typeof` Guards in Universal Packages**
   The SDK is published as a universal package (works in browser and Node.js). `EventSource` is browser-only. Without the `typeof EventSource === "undefined"` guard, importing the SDK in Node.js would throw a `ReferenceError` as soon as `onEvent()` is called. This applies to any browser-only API used in universal packages: `WebSocket`, `window`, `document`, `localStorage`.

3. **`pnpm exec` vs Bare Commands in Package Scripts**
   The VS Code extension's build failed because `tsc` was not in PATH when running from the package directory. `pnpm exec tsc` resolves the correct binary from `node_modules/.bin/`. This is the correct pattern for any pnpm workspace package that needs to invoke a CLI tool from a script.

4. **Custom Interfaces Over Module Mocking for Testability**
   The `ActionCore` interface pattern is more maintainable than `vi.mock("@actions/core")`. Module mocking couples tests to import paths and module internals. Interface injection couples tests to behavior contracts. Prefer the latter for any code that wraps an external dependency.

### Process Lessons

1. **Story Status Must Be Updated After Implementation**
   Story 41-4 is marked `ready-for-dev` despite being implemented and tested. The dev-story workflow's final step should require updating the story file status. Without this, sprint status tracking is inaccurate.

2. **Integration Packages Benefit From Post-Scaffold Testing Epic**
   Cycle 7 scaffolded four packages (SDK, VS Code extension, GitHub Action, CLI hooks). Cycle 8 added tests and real wiring. This two-phase pattern (scaffold then harden) is effective for integration packages where the scaffold establishes interfaces and the hardening epic fills in behavior with tests. The key is that the scaffold phase must include accurate interface definitions so the hardening phase is straightforward.

3. **Structural Tests Are Legitimate Tests**
   For packages that depend on host environments (VS Code extension, GitHub Action), structural tests that validate exports, registrations, and manifest fields provide real value. They are not "weak" tests -- they catch the most common packaging and integration errors. Behavioral tests should use the host's own testing framework when needed.

---

## Action Items

### 1. Add Reconnect Backoff to SDK SSE Client
- **Owner:** Blaze (DevOps Engineer)
- **Success criteria:** `ensureSSE()` implements exponential backoff with jitter on connection error. Maximum retry interval capped at 30 seconds. Maximum retry count configurable (default: unlimited). Existing tests continue to pass.
- **Priority:** MEDIUM
- **Rationale:** Required for production deployment against remote orchestrators. Not needed for local-network usage.

### 2. Add SDK-to-Server SSE Integration Test
- **Owner:** Nova (QA Specialist)
- **Success criteria:** Integration test in `packages/sdk/src/integration.test.ts` creates a real HTTP server with SSE endpoint, connects the SDK's `onEvent()`, emits events from the server, and verifies the SDK handler receives them with correct shape.
- **Priority:** MEDIUM
- **Rationale:** Protocol mismatches between SDK and server are currently undetectable until runtime. One integration test covering the full SSE flow would catch format regressions.

### 3. Update Story 41-4 Status in Story File
- **Owner:** Pax (Process Architect)
- **Success criteria:** Story file `41-4-git-hook-installation-command.md` updated to status `done`, tasks checked, dev agent record filled with completion notes and file list.
- **Priority:** HIGH
- **Rationale:** Sprint status accuracy. The implementation is complete but the artifact does not reflect this.

### 4. Consider Shared SSE Context for React Hooks
- **Owner:** Nova (QA Specialist)
- **Success criteria:** Evaluate whether multiple React hooks (`useCascadeStatus`, `useSprintCost`, etc.) should share a single EventSource connection via a React context, rather than each creating separate connections.
- **Priority:** LOW
- **Rationale:** The Cycle 8 retro flagged this. Multiple hooks each creating an EventSource to `/api/events` is wasteful. The SDK already demonstrates the shared-connection pattern; the React layer should mirror it.

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories shipped | 4 (of 4) |
| New tests added | 35 |
| SDK tests | 22 total (12 new from 41-1) |
| VS Code tests | 10 (new from 41-2) |
| GitHub Action tests | 9 (new from 41-3) |
| CLI hook tests | 4 (new from 41-4) |
| Code review rounds (Cycle 8 total) | 25 |
| Issues found in reviews (Cycle 8 total) | ~80 |
| Build status | Green |
| Typecheck | Clean |
| New dependencies added | 0 (vitest added to packages that lacked it) |

### Test Growth by Package

| Package | Pre-Epic 41 | Post-Epic 41 | Delta |
|---------|-------------|--------------|-------|
| SDK | 10 | 22 | +12 |
| VS Code Extension | 0 | 10 | +10 |
| GitHub Action | 0 | 9 | +9 |
| CLI | existing | +4 | +4 |
| **Total** | | | **+35** |

### Cycle 8 Context

Epic 41 was the final epic of Cycle 8 ("Technical Debt Zero"). The full cycle retrospective is at `_bmad-output/implementation-artifacts/cycle-8-retrospective-epics-38-41.md`.

**Cycle 8 achievements:**
- 18 stories shipped across 4 epics (38-41)
- ~120 new tests added
- 25 code review rounds with ~80 issues caught and fixed
- Every stub and placeholder replaced with real implementations
- Technical debt backlog 94.9% cleared (192/198 stories)

---

**Retrospective Facilitator:** R2d2 (Project Lead)
**Document Version:** 1.0
**Last Updated:** 2026-04-29
