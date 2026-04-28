# Epic 28 Retrospective -- SDK & Headless Mode

**Date**: 2026-04-29
**Epic**: 28 -- SDK & Headless Mode
**Status**: Complete (all 4 stories done)
**Source**: Cycle 5 (epics-cycle-5.md)
**Depends on**: Epic 25a (stable API)

## Epic Summary

Epic 28 delivered the public SDK layer for Agent Orchestrator: a defined type surface separating public from internal APIs, a `createOrchestrator()` client factory with fetch-based HTTP calls and SSE event subscriptions, headless daemon configuration types for CI/CD use, and a README with API reference and three integration examples (Slack bot, GitHub Action, CLI script). The SDK was initially built in `packages/web/src/lib/workflow/sdk-types.ts` as a shared module, then properly extracted into `packages/sdk/` as a standalone workspace package during Cycle 7 (Epic 34), where it received full EventSource-based SSE integration (Story 41.1), 15 unit tests, and an integration test suite.

The story files are notably terse -- each records only `sdk-types.ts` and its test as output files. This reflects the original delivery model where the four stories built incrementally into a single shared module. The real SDK package (`packages/sdk/`) came later when the codebase matured enough to warrant a proper standalone workspace.

## Story Delivery

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| 28-1 | SDK Public API Surface | Done | Defined `OrchestratorSDKConfig`, `SDKEventType`, `SDKEvent`, `SDKSpawnConfig`, `SDKRecommendation` types. Established public/internal boundary |
| 28-2 | SDK Client Implementation | Done | `createOrchestratorSDK()` factory with `spawn()`, `kill()`, `recommend()`, `onEvent()`, `listSessions()`, `disconnect()`. Initially stub-based (fetch calls, SSE stub). Full SSE wired in Story 41.1 |
| 28-3 | Headless Daemon Mode | Done | `HeadlessDaemonConfig` type with `port`, `enableSSE`, `healthChecks`, `logLevel`. Configuration surface for daemon mode -- actual CLI `ao daemon start` deferred |
| 28-4 | SDK Documentation & Examples | Done | README with quickstart, full API reference, 3 examples (Slack bot, GitHub Action, CLI script). README lives in `packages/sdk/README.md` |

**Total files produced (Cycle 5)**: 2 (`sdk-types.ts`, `sdk-types.test.ts`)
**Total files produced (post-Cycle 5 SDK extraction)**: 7+ (index.ts, index.test.ts, integration.test.ts, README.md, package.json, tsconfig files, dist output)
**Total tests (Cycle 5)**: 5 (sdk-types.test.ts)
**Total tests (post-extraction)**: 15 (index.test.ts with full SSE coverage)
**External dependencies added**: 0 (uses native `fetch` and `EventSource`)
**Code reviews**: Covered as part of Cycle 5 review cadence

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 28 established the contract before the implementation -- which is exactly how an SDK should be built. Story 28.1 defined the types first (`OrchestratorSDKConfig`, `SDKEventType`, `SDKEvent`), then 28.2 built the client against those types. This type-first approach meant the README (28.4) could be written with confidence that the API surface was stable. The three examples in the README -- Slack bot, GitHub Action, CLI script -- directly addressed the three integration personas from the brainstorming session (#83, #85) and gave consumers a working mental model before writing a line of code.

The fact that the SDK uses zero external dependencies is a strong signal. `fetch()` and `EventSource` are built into every modern runtime. No axios, no SSE library, no SDK bloat. This keeps the package lightweight and deployable anywhere Node 20+ runs.

**Nova (Architect):** The `AgentOrchestratorSDK` interface in `sdk-types.ts` (later renamed `AgentOrchestrator` in the extracted package) is the cleanest contract in the codebase. Six methods, each with a single responsibility:

- `spawn()` -- create a session
- `kill()` -- terminate a session
- `recommend()` -- query workflow state
- `onEvent()` -- subscribe to real-time events
- `listSessions()` -- introspect fleet
- `disconnect()` -- cleanup

The `onEvent()` return-an-unsubscribe-function pattern is idiomatic TypeScript and avoids the callback-hell of `removeEventListener` with stored references. The lazy SSE connection (created on first `onEvent()` call, closed when all handlers are removed) is resource-efficient for scripts that only need the HTTP methods.

The `HeadlessDaemonConfig` type (Story 28.3) is correctly minimal: `port`, `enableSSE`, `healthChecks`, `logLevel`. It describes configuration, not behavior. The actual daemon implementation was correctly deferred -- a config type costs nothing to define and everything to build prematurely.

**Blaze (Dev):** Incremental delivery across four stories into a single file (`sdk-types.ts`) was pragmatic. Rather than creating a `packages/sdk/` workspace on day one with empty directories, we built the types and client inline in the web package where the workflow engine already lived. When Cycle 7's Epic 34 extracted it into a proper workspace, the code was battle-tested and the API surface was stable. This "build inline, extract later" pattern avoided premature package scaffolding.

The `fetchJSON<T>()` helper in the extracted SDK is a clean abstraction: abort controller for timeouts, authorization header injection, error throwing on non-2xx responses. Fifteen lines that handle the full HTTP lifecycle. The SSE handler in `index.ts` correctly snapshots handlers before iteration (`for (const handler of [...typeHandlers])`) to avoid concurrent modification if a handler unsubscribes during dispatch.

**Pax (QA):** The test evolution tells the story. Cycle 5 shipped 5 basic tests: "returns all required methods," "onEvent returns unsubscribe," "strips trailing slash," "config accepts optional fields," "disconnect is callable." These are smoke tests -- they verify shape, not behavior. When Epic 41.1 added full SSE integration, the test suite expanded to 15 tests covering: EventSource creation, event filtering by type, shared EventSource across handlers, unsubscribe removing handlers, EventSource closing when all handlers removed, `disconnect()` closing and clearing, handler error isolation, and graceful fallback when EventSource is unavailable. This is the correct progression: shape tests first, behavioral tests when the real integration lands.

---

### What Could Be Improved

**R2d2 (Project Lead):** The story files are too sparse. Each story records only two files (`sdk-types.ts` and `sdk-types.test.ts`) with no acceptance criteria verification, no implementation notes, and no traceability to which story added which types or methods. When four stories build into the same file, the story-level record should document what each story contributed. As it stands, there is no way to distinguish 28-1's output from 28-4's output from the story files alone.

Also, Story 28.3 (Headless Daemon Mode) is a type definition, not a daemon. The acceptance criteria said "all orchestration features work via CLI + API" and "`ao daemon start` CLI command," but the delivery was a `HeadlessDaemonConfig` interface. The actual daemon CLI command was never built. The story should have been scoped as "headless daemon configuration types" rather than "headless daemon mode" to avoid the expectation gap.

**Nova (Architect):** The SDK's `kill()` method calls `/api/agent/:sessionId/reassign` (POST), which reassigns the agent's story to the queue -- it does not actually kill the session. The naming is misleading. `kill()` implies termination; `reassign()` implies workload redistribution. These are different operations with different side effects. A proper SDK should expose both: `kill(sessionId)` for termination and `reassign(sessionId)` for returning the story to the queue.

The `recommend()` method depends on the `/api/workflow/:projectId` endpoint, which returns a `{ recommendation: ... }` envelope. But the recommendation engine's output schema (phase, observation, implication, reasoning) is defined in the web package, not in the SDK package. If the recommendation schema changes, the SDK types will silently diverge. The SDK should own its own types and map from the API response, not import from web.

**Blaze (Dev):** The initial delivery had `onEvent()` as a pure stub that returned a no-op unsubscribe. The comment said "SSE subscription -- stub, requires EventSource integration." This is fine as a placeholder, but the story was marked "done" with no indication that SSE was deferred. If a consumer tried to use `onEvent()` between Cycle 5 and Cycle 7, they would get silent failures -- events would never arrive, no error thrown, no warning logged. The stub should have thrown or logged a warning.

The `apiKey` field in `OrchestratorConfig` is accepted but never used in the initial implementation. The extracted SDK does inject it as a `Bearer` header, but the original `createOrchestratorSDK()` in `sdk-types.ts` silently ignored it. Accepting a security parameter and not using it is worse than not accepting it at all -- it gives a false sense of authentication.

**Pax (QA):** Five tests for four stories is thin. The initial test suite verified that methods exist and are callable, but never tested actual HTTP behavior. The `spawn()`, `kill()`, `recommend()`, and `listSessions()` methods all call `fetch()`, but no test verified that `fetch` was called with the correct URL, method, headers, or body. The test for "strips trailing slash" only checks that the SDK was "created without error" -- it does not verify the slash was actually stripped or that requests use the correct base URL. The behavioral test coverage only arrived with Epic 41.1's SSE tests and the integration test suite.

---

### Key Decisions

1. **Type-first SDK development.** Story 28.1 defined all types before any implementation. This meant 28.2, 28.3, and 28.4 could all build against a stable contract. The types became the source of truth for the API surface, and the README could be generated from the types themselves.

2. **Build inline, extract later.** The SDK was built in `packages/web/src/lib/workflow/sdk-types.ts` rather than creating a new workspace package on day one. This avoided premature scaffolding and let the types mature alongside the workflow engine. When Epic 34 extracted it into `packages/sdk/`, the API surface was proven.

3. **Zero external dependencies.** The SDK uses native `fetch()` for HTTP and native `EventSource` for SSE. No axios, no socket.io, no SSE wrapper library. This keeps the SDK lightweight (no node_modules bloat) and compatible with any modern JavaScript runtime (Node 20+, Deno, Bun, browsers).

4. **Lazy SSE connection.** The EventSource is created on the first `onEvent()` call, not at SDK construction time. This means scripts that only use HTTP methods (`spawn`, `kill`, `recommend`, `listSessions`) never open an SSE connection. The connection is also automatically closed when all event handlers are unsubscribed, preventing resource leaks in short-lived scripts.

5. **Headless daemon as configuration, not implementation.** Story 28.3 defined the `HeadlessDaemonConfig` type but did not build the `ao daemon start` CLI command. This was the correct call -- the daemon requires CLI infrastructure, process management, and signal handling that would have bloated the scope. The config type is a 15-line commitment; the daemon implementation would have been a 200+ line effort.

---

### Lessons Learned

1. **Four stories building into one file need explicit per-story documentation.** The story files for 28-1 through 28-4 are identical -- they all list the same two files. When multiple stories contribute incrementally to a single artifact, the story record must document what changed. Without this, retrospective analysis requires reading the git log rather than the story files.

2. **Marking stubs as "done" is a communication risk.** The SSE `onEvent()` stub returned a no-op unsubscribe and silently swallowed events. A consumer testing the SDK between Cycle 5 and Cycle 7 would believe events were broken. Stubs should either throw ("not implemented") or log a warning ("SSE not connected") to make their incompleteness discoverable.

3. **SDK method names should match their actual behavior.** `kill()` calling `/reassign` is a semantic mismatch. If the method reassigns rather than terminates, it should be called `reassign()`. Or, the SDK should expose both operations. Naming is API design, and API design is forever.

4. **The type-first approach worked well and should be repeated.** Defining the public interface before the implementation forced clear thinking about what the SDK should expose. It also meant documentation could be written against stable types rather than chasing a moving target.

5. **SDK types should be owned by the SDK package, not imported from other packages.** The recommendation schema lives in the web package. If the web package's types change, the SDK consumers get runtime surprises with no compile-time warning. The SDK package should define its own types and map from API responses.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Rename `kill()` to `reassign()` or add a separate `terminate()` method for actual session termination | Dev | HIGH |
| 2 | Move recommendation types (`phase`, `observation`, `implication`, `reasoning`) into `packages/sdk/src/` so the SDK owns its own type contracts | Dev | HIGH |
| 3 | Implement `ao daemon start` CLI command using `HeadlessDaemonConfig` -- currently only the config type exists | Dev | MEDIUM |
| 4 | Add HTTP behavioral tests to SDK -- verify `fetch` is called with correct URL, method, headers, and body for each method | QA | MEDIUM |
| 5 | Add `apiKey` injection to remaining HTTP methods (only `fetchJSON` uses it in the extracted package; verify all paths) | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4 |
| Stories fully functional at delivery | 2 (28-1 types, 28-2 client with HTTP methods) |
| Stories config-only (deferred implementation) | 1 (28-3 daemon) |
| Stories documentation-only | 1 (28-4 README) |
| Total files produced (Cycle 5) | 2 |
| Total files produced (post-extraction) | 7+ |
| Total tests (Cycle 5) | 5 (smoke tests) |
| Total tests (post-extraction) | 15 (SSE behavioral) |
| External dependencies added | 0 |
| New modules | 1 (sdk-types.ts, later extracted to packages/sdk/) |
| Deferred items | 1 (daemon CLI implementation) |
| Epic duration | Part of Cycle 5 (1 session) |
