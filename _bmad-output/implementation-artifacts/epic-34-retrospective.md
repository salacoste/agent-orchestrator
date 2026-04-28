# Epic 34 Retrospective -- SDK Package & Production Wiring

**Date**: 2026-04-29
**Epic**: 34 -- SDK Package & Production Wiring
**Status**: Done (all 3 stories marked done)
**Source**: Cycle 7

## Epic Summary

Epic 34 created the `@composio/ao-sdk` workspace package -- a standalone TypeScript SDK that lets developers interact with Agent Orchestrator programmatically. The SDK provides a single entry point (`createOrchestrator()`) that returns a client capable of spawning agents, killing sessions, getting workflow recommendations, subscribing to real-time events via SSE, and listing active sessions.

The epic had three stories, each building on the previous: first the package scaffold with the core client implementation (34-1), then integration tests verifying API endpoint correctness with mocked fetch (34-2), and finally a comprehensive README with quickstart, API reference, and three usage examples (34-3). All three stories were completed cleanly with zero regressions.

The SDK is notable for being the only package in the monorepo with zero production dependencies -- it relies entirely on the browser/node `fetch` API and `EventSource` for SSE. The implementation is ~240 lines of TypeScript including full JSDoc, type exports, SSE lifecycle management (lazy connect, auto-reconnect, auto-close when no handlers remain), and AbortController-based request timeouts.

## Story Delivery

| Story | Title | Status | Files | Notes |
|-------|-------|--------|-------|-------|
| 34-1 | Create packages/sdk Workspace Package | Done | `package.json`, `tsconfig.json`, `tsconfig.build.json`, `src/index.ts` | Full SDK client with types, factory function, fetch wrapper, SSE subscription. Zero production deps. |
| 34-2 | SDK Integration Tests | Done | `src/integration.test.ts` | 10 integration tests across 6 describe blocks: spawn, kill, recommend, listSessions, auth, error handling. Uses mocked global fetch. |
| 34-3 | SDK README & Quickstart | Done | `README.md` | Quickstart, full API reference for all 7 methods/config, 3 examples (Slack bot, GitHub Action, CLI script). MIT license. |

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- vision, outcomes, quality
- Nova (Architect) -- architecture, design patterns
- Blaze (Dev) -- implementation, pain points
- Pax (QA) -- testing, quality gates

---

### What Went Well

**R2d2:** This is how a small epic should execute -- tight scope, clean delivery, complete artifacts. Three stories, three clear deliverables, each building on the last. The SDK went from "does not exist" to "production-quality, publish-ready package" in a single epic with no rework. The zero-dependency design is exactly right for an SDK: fewer transitive deps means fewer version conflicts for consumers. The README is genuinely useful -- the Slack bot, GitHub Action, and CLI script examples show real integration patterns, not toy code.

**Nova:** The architecture of `createOrchestrator()` is clean. The closure-based factory pattern keeps all state private -- `baseUrl`, `timeout`, the `EventSource` instance, and the handler map are all encapsulated. The `fetchJSON<T>` helper with AbortController timeout is the right pattern: every outbound request has a bounded lifetime, the timer is always cleared in `finally`, and the generic return type preserves type safety at each call site. The SSE lifecycle management deserves specific praise: lazy connection on first `onEvent()` call, auto-reconnect on error (close + null the reference so `ensureSSE()` re-establishes), and auto-close when all handlers unsubscribe (`maybeCloseSSE()`). This is a leak-free design.

**Blaze:** The build configuration is solid. The separate `tsconfig.build.json` that excludes test files from the dist output is a pattern more packages should follow. Target ES2022 with ES2022 modules means the SDK ships as native ESM with no downleveling -- correct for a modern Node.js SDK. The `declaration: true` + `declarationMap: true` settings give consumers full IntelliSense with source mapping. The `files: ["dist"]` in package.json ensures only compiled output gets published. No sourcemaps leak, no test files leak.

**Pax:** The 10 integration tests cover the right surface area for an HTTP client SDK: each method gets at least one test verifying the correct HTTP method, path, and body serialization. The auth tests verify both the positive case (API key present = Authorization header sent) and negative case (no API key = no Authorization header). The error handling test verifies the SDK throws on HTTP errors with the status code in the message. The `mockJsonResponse` helper and `beforeEach`/`afterEach` vi.stubGlobal pattern keep tests readable. The SDK is a pure HTTP client, so mocking fetch at the global level is the correct testing strategy -- no need for a real server.

### What Could Be Improved

**R2d2:** The SDK has no unit tests separate from the integration tests. Story 34-1 mentioned "5 unit + 10 integration" in the Cycle 7 retro summary, but the codebase only has `integration.test.ts` with 10 tests. If unit tests were planned for the type definitions, factory function validation (e.g., baseUrl trailing slash stripping), or config defaults, they were not shipped. This is minor -- the integration tests effectively cover the factory logic -- but the discrepancy between what the cycle retro reported and what exists is worth noting.

**Nova:** The SSE implementation uses a comment in the code referencing "Story 41.1" -- `// SSE Event Subscription (Story 41.1)` at line 133 of `index.ts`. This suggests SSE was added or expanded in a later story, but Epic 34 is where the feature shipped. The cross-story reference is confusing for anyone reading the code later. Additionally, the `onEvent()` handler catches errors silently (`catch { }` with no logging) which is correct for production robustness but makes debugging handler bugs during development harder. A debug-mode log option would help.

**Blaze:** The `kill()` method hits `/api/agent/:id/reassign` which is semantically a "reassign" endpoint, not a "kill" endpoint. The SDK method name says "kill" but the HTTP call says "reassign." This works because the server-side route handles agent termination and story reassignment as a combined operation, but the naming mismatch could confuse SDK consumers who inspect network traffic. Also, there is no retry logic in `fetchJSON`. For an SDK that consumers will rely on in CI pipelines and long-running bots, transient network failures (5xx, connection reset) would benefit from at least one automatic retry with backoff.

**Pax:** The integration tests do not test the SSE subscription (`onEvent`/`disconnect`). The SSE code path is ~50 lines of non-trivial logic: lazy connection, handler registration, handler snapshot iteration, error recovery, auto-close. None of this has test coverage. The tests also do not test the `disconnect()` method's cleanup behavior. For a "production-ready" SDK, the SSE lifecycle is undertested. The `fetchJSON` timeout behavior (AbortController + setTimeout) is also untested -- the tests mock fetch globally but never verify that the timeout mechanism works.

### Key Decisions

1. **SDK as separate workspace package with independent versioning.** The SDK lives at `packages/sdk/` as `@composio/ao-sdk`, not embedded in `packages/core/` or `packages/web/`. This allows independent npm publishing, independent semver, and a separate dependency tree. Consumers install only the SDK, not the entire orchestrator.

2. **Zero production dependencies.** The SDK depends only on the `fetch` API (available in Node 18+ and all modern browsers) and `EventSource` (native in browsers, available via `eventsource` polyfill in Node). No axios, no node-fetch, no SSE client library. This is the correct trade-off for an SDK -- minimize the dependency surface.

3. **Closure-based client with lazy SSE connection.** Rather than creating a class, `createOrchestrator()` returns an object literal with methods closing over private state. The SSE `EventSource` is not created until the first `onEvent()` call, and it auto-closes when all handlers are removed. This avoids holding open connections that nobody is listening to.

4. **ES2022 target, ESM-only output.** The SDK ships as native ESM (`"type": "module"`, `"module": "ES2022"` in tsconfig). No CommonJS fallback. This is a forward-looking choice that matches the orchestrator's ESM-first convention and avoids dual-package complexity.

5. **Type exports co-located with implementation.** All types (`OrchestratorConfig`, `EventType`, `OrchestratorEvent`, `EventHandler`, `SpawnConfig`, `Recommendation`, `SessionInfo`, `AgentOrchestrator`) are exported from `index.ts` alongside the factory function. No separate `types.ts` file. For an SDK package with a small type surface, co-location keeps imports simple: `import { createOrchestrator, type SessionInfo } from "@composio/ao-sdk"`.

### Lessons Learned

1. **Small epics with tight story boundaries execute cleanly.** Epic 34 is one of the cleanest epics in the project: 3 stories, each with a single clear deliverable, each building on the previous. No scope creep, no deferred features, no "types only" gaps. The pattern of scaffold -> test -> document works well for library packages and should be reused.

2. **Zero-dependency SDK design is achievable for modern runtimes.** The `fetch` API is stable in Node 18+ and all modern browsers. `EventSource` is native in browsers and trivially polyfilled in Node. For an HTTP client SDK, zero deps is realistic and ideal. Future SDK packages should start from the same position and only add deps when a genuine capability gap is proven.

3. **SSE lifecycle management needs dedicated test coverage.** The lazy-connect, auto-reconnect, auto-close pattern in the SDK is the most complex code in the package (~50 lines with multiple state transitions). It has zero test coverage. The lesson: when a feature's implementation spans multiple state transitions and error paths, it deserves its own describe block, even if other parts of the SDK are well-tested.

4. **The `fetchJSON` pattern with AbortController timeout is reusable.** The combination of `AbortController`, `setTimeout`, and a `finally` cleanup block is a clean pattern for bounded HTTP requests. This could be extracted to a shared utility for the GitHub Action plugin and other packages that make HTTP calls, but only when there is a second consumer -- not prematurely.

5. **Integration tests with global fetch mocking are the right level for HTTP clients.** The `vi.stubGlobal("fetch", mockFetch)` pattern in `beforeEach` with `vi.restoreAllMocks()` in `afterEach` is simple, deterministic, and fast. No test server, no port allocation, no async setup. Each test sets up the mock response, calls the SDK method, and asserts the fetch call args. This pattern should be the default for any SDK or API client package.

---

## Action Items

| # | Action Item | Priority | Status |
|---|------------|----------|--------|
| 1 | Add SSE lifecycle tests (lazy connect, handler registration, auto-reconnect on error, auto-close on last unsubscribe, disconnect cleanup) | High | Not started |
| 2 | Add `fetchJSON` timeout test (verify AbortController fires after `timeoutMs`) | Medium | Not started |
| 3 | Consider adding retry logic for transient failures (5xx, ECONNRESET) to `fetchJSON` | Medium | Not started |
| 4 | Reconcile `kill()` method name with `/api/agent/:id/reassign` endpoint (either rename method or add JSDoc explaining the semantic) | Low | Not started |
| 5 | Remove or update the "Story 41.1" comment in SSE section to reference the correct origin | Low | Not started |
| 6 | Add debug-mode option for handler error logging in SSE dispatch | Low | Not started |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 3 (all done) |
| Stories meeting full ACs | 3 |
| New package | 1 (`@composio/ao-sdk`) |
| Source files | 1 (`src/index.ts`, ~240 lines) |
| Types exported | 8 (config, event, handler, spawn, recommendation, session, client interface, event type union) |
| SDK methods | 5 (spawn, kill, recommend, onEvent, listSessions) + disconnect |
| Integration tests | 10 (6 describe blocks) |
| Production dependencies | 0 |
| Dev dependencies | 2 (typescript, vitest) |
| README sections | 5 (install, quickstart, API reference, 3 examples, license) |
| Build status | Green |
| Regressions | 0 |

---

R2d2 (Project Lead): "Epic 34 is the model small epic. Three stories, each one done when it says it is done, zero rework, zero deferred items, publish-ready output. The SDK is lean, typed, tested, and documented. Every future library package in this project should follow this pattern."
