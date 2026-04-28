# Epic 16 Retrospective — Workflow Data Foundation

**Date**: 2026-04-28
**Epic**: 16 — Workflow Data Foundation
**Status**: Complete (all 6 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 16 established the data foundation for BMAD workflow orchestration, delivering a layered architecture where artifact types (16.1) feed into a state machine model (16.2) configurable via YAML (16.3), backed by an artifact dependency graph (16.4) with real-time SSE event propagation (16.5), all wired together with zero-config defaults (16.6). The result is a deterministic "what's next" engine that computes workflow recommendations from project artifact state rather than hardcoded logic -- the core insight being that recommendation intelligence emerges from graph traversal on a state machine, not from AI.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 16-1 | Artifact Type Definition | Done |
| 16-2 | Workflow State Machine Model | Done |
| 16-3 | YAML Workflow Configuration | Done |
| 16-4 | Artifact Scanner Service | Done |
| 16-5 | Workflow Event Types & SSE Integration | Done |
| 16-6 | Zero-Config Default Workflow | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — vision, outcomes, quality
- Nova (Architect) — architecture, design patterns
- Blaze (Dev) — implementation, pain points
- Pax (QA) — testing, quality gates

---

### What Went Well

**R2d2 (Project Lead):** The layered dependency story sequence was spot on. 16.1 defined types, 16.2 built the state machine, 16.3 made it configurable, 16.4 added the graph, 16.5 wired events, and 16.6 connected everything end-to-end. Every story was additive with zero regressions across ~2,873 tests. The zero-config integration test in 16.6 was the payoff -- proving the full pipeline (scan -> graph -> state machine -> recommendations) works without any configuration.

**Nova (Architect):** Two architectural decisions paid off massively. First, transitions-as-data (the `BMAD_TRANSITIONS` constant array in 16.2) instead of switch/case logic made YAML customization trivial in 16.3. Second, pure functions everywhere -- `evaluateGuards`, `getAvailableTransitions`, `getTransitionReadiness` have zero I/O and zero side effects, which means they're testable in isolation and composable in the pipeline. The `artifactTypeGuard()` factory pattern (checking `ClassifiedArtifact.type` against a string) was elegant -- 4 lines of code that made both hardcoded and YAML-configured guards work identically.

**Blaze (Dev):** Story 16.6 was the cleanest integration story I've worked on -- all tests passed first try because the underlying modules (16.1-16.5) were solid. The 14 integration tests in `zero-config.test.ts` cover empty project, partial artifacts (PRD+arch), and full project scenarios, verifying phase inference, readiness scoring, and recommendations all produce correct results. The `createStateMachineFromConfig(DEFAULT_WORKFLOW_CONFIG)` round-trip equivalence test (7 artifact combos x 4 phases) gave high confidence that YAML config and hardcoded paths are identical.

**Pax (QA):** Test discipline was excellent. 16.1 added cross-package sync tests (`core-type-sync.test.ts`) to prevent silent drift between core and web type definitions. 16.2 delivered 36 exhaustive tests including the guard-rules sync verification that catches mismatches between state machine guard strings and artifact-rules.ts type values. 16.4 added 21 tests with mocked file I/O (no real filesystem in fast tests). 16.5 added 7 tests for phase transition detection and event structure. 16.6's 14 end-to-end tests prove the full pipeline. Total new tests for the epic: ~80+, zero regressions.

### What Could Be Improved

**R2d2 (Project Lead):** The web-core type duplication from 16.1 is an accepted trade-off that still bothers me. Next.js bundles `node:fs` from core's module graph when you try to re-export types from `@composio/ao-core` in the web package. The "keep in sync" comment pattern works, but it's a maintenance burden. The sync test helps, but ideally we'd fix the root cause -- core's barrel export pulls in plugin-loader which pulls in `node:fs`.

**Nova (Architect):** The deferred items add up. 16.4 deferred incremental graph updates to 16.5. 16.5 deferred per-artifact SSE events (watcher doesn't report which file changed) and EventPublisher Redis bridge methods. 16.6 deferred wiring state machine readiness into the API `WorkflowResponse` (frozen WD-4 interface). None of these are blockers, but they represent unfinished seams. The API response contract (WD-4) is the biggest one -- the state machine data exists but isn't exposed to dashboard consumers yet.

**Blaze (Dev):** The `vi.mock` shared reference pattern for `readFile` in 16.4 tests was painful. vitest's mock factory creates a new `vi.fn()` that doesn't match the test's `vi.mocked()` reference. The workaround (declare shared `mockReadFileFn = vi.fn()` before `vi.mock`, use same ref in factory and tests) is not obvious and required debugging a silent `TypeError` that got swallowed by the error handler. I lost time to this. Also, ESLint caught `import()` type annotations in tests for 16.2 -- had to use top-level imports instead.

**Pax (QA):** The `.js` vs extensionless imports issue surfaced here even though it was caught later in 17.4. Web package uses extensionless imports (Next.js webpack), core uses `.js` (ESM). When Story 16.3 added factory functions that cross this boundary, it created a latent build failure risk. This should have been caught earlier in the epic. The `artifactTypeGuard()` function in 16.2 was private initially, requiring a decision in 16.3 to export it -- better to design for reuse from the start.

### Key Decisions

1. **Types duplicated (not re-exported) in web from core** (16.1) -- Next.js bundles `node:fs` from core's module graph, preventing clean re-exports. Core is canonical, web mirrors with sync comment. Sync test prevents drift.

2. **Transitions as data, not logic** (16.2) -- `BMAD_TRANSITIONS` is a constant array of objects, not a switch/case function. This made YAML configuration (16.3) trivial to implement -- just parse the config and construct the same data structure.

3. **Linear happy path only for default workflow** (16.2) -- Only 3 transitions (analysis->planning->solutioning->implementation), no skip paths. Non-linear routes can be added via YAML config in 16.3, but defaults should be simple.

4. **Guard artifactType is a free-form string, not an enum** (16.3) -- Matches against `ClassifiedArtifact.type` at runtime. Allows custom artifact types in YAML config without code changes.

5. **Strict Zod validation for workflow config (no `.passthrough()`)** (16.3) -- Typos in YAML should fail loudly ("gaurd" vs "guard"), not silently pass.

6. **Graph builder extends scanner, doesn't replace it** (16.4) -- `scanAllArtifacts()` stays unchanged. Graph builder takes scanner output as input and adds dependency edges from frontmatter `inputDocuments` fields.

7. **Phase transition events only, not per-artifact events** (16.5) -- The existing watcher doesn't report which file changed, so per-artifact SSE events were deferred. Phase transitions are computed by comparing before/after state after each file change.

8. **Backward-compatible SSE: "workflow-change" emitted first, then typed events** (16.5) -- Existing consumers continue working. New typed events are additive.

### Lessons Learned

1. **Always build core before web when modifying shared types.** The dependency order matters because web imports from core's built output. This was discovered during 16.1 and applied consistently through 16.6.

2. **Web package imports MUST be extensionless (Next.js webpack).** Core uses `.js` extensions for ESM compliance, but web uses Next.js webpack which resolves extensions automatically. Mixing the two causes build failures.

3. **Foundation epics should be scoped to 1 sprint max.** Epic 16 was exactly right at 6 stories, each building on the previous. The layered architecture (types -> state machine -> config -> graph -> events -> integration) maps cleanly to story dependencies.

4. **Design for reuse from the start.** `artifactTypeGuard()` was private in 16.2, then needed public in 16.3. The export was clean, but the private-to-public transition could have been avoided by thinking ahead about the factory pattern.

5. **Frozen API contracts (like WD-4 WorkflowResponse) need a plan for extension.** Story 16.6 couldn't add state machine readiness data to the existing response. Optional fields or a new endpoint should be the designated extension mechanism.

6. **vi.mock shared reference pattern: declare the mock function at module scope, use same reference in mock factory and tests.** This prevents the "mock doesn't match" problem when mocking `node:fs` in vitest.

7. **Silent error swallowing (the scanner pattern) hides bugs during development.** The graph builder's `try/catch` with empty catch made a `TypeError` invisible during 16.4 development. A temporary `DEBUG_GRAPH` env var helped diagnose it. Consider logging at debug level instead of complete silence.

8. **Round-trip equivalence tests are high-value for config-driven systems.** The test in 16.3 proving `createStateMachineFromConfig(DEFAULT_WORKFLOW_CONFIG)` matches hardcoded `BMAD_TRANSITIONS` across all 7 artifact combos x 4 phases caught a potential config-to-code drift early.

---

## Action Items

| # | Action Item | Priority |
|---|------------|----------|
| 1 | Wire state machine readiness data into API response (extend WorkflowResponse or create new endpoint) | High |
| 2 | Extend workflow-watcher.ts to report changed filename in callback (enables per-artifact SSE events) | Medium |
| 3 | Fix core barrel export to avoid pulling `node:fs` into web via type re-exports | Medium |
| 4 | Add ESLint rule: `no-node-imports-in-client-components` (prevented two incidents across epics) | Medium |
| 5 | Implement incremental graph updates (deferred from 16.4 Task 4) | Low |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 |
| New tests added | ~80+ |
| Total tests at completion | 2,873 |
| Regressions | 0 |
| Key files created | `state-machine.ts`, `artifact-graph.ts`, `core-type-sync.test.ts`, `state-machine.test.ts`, `artifact-graph.test.ts`, `workflow-events.test.ts`, `zero-config.test.ts` |
| Key files modified | `types.ts` (core), `types.ts` (web), `config.ts`, `route.ts` (events), `agent-orchestrator.yaml.example` |
| Deferred items | 4 (incremental graph, per-artifact SSE, EventPublisher bridge, API response wiring) |
