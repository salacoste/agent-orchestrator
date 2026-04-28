# Epic 58 Retrospective: Provider Abstraction & Model Routing

**Epic**: 58 - Provider Abstraction & Model Routing
**Cycle**: 11
**Stories**: 58-1 through 58-6 (6 stories)
**Date**: 2026-04-29
**Status**: Done (4 done, 2 in review)
**Agent Models**: Claude Sonnet 4.6 (58-1), Claude Opus 4.6 (58-2 through 58-6)

## Epic Summary

Epic 58 introduced the SessionEnhancementProvider abstraction layer and model routing infrastructure, enabling the orchestrator to select cost-efficient AI models based on story complexity. The core value proposition: route simple tasks (explore, lint, search) to cheaper models (haiku) while reserving expensive models (opus) for complex tasks (architecture, debugging), targeting 50-70% cost reduction.

The implementation followed a clean layering pattern across six stories:

1. **Interface Foundation (58-1)**: Added `"provider"` as the 8th plugin slot, defined the `SessionEnhancementProvider` interface with five lifecycle methods (`install`, `configure`, `enhance`, `teardown`, `healthCheck`), implemented `RawProvider` as the no-op default, and integrated provider calls into the session spawn/kill flow with graceful degradation.

2. **Configuration Plumbing (58-2)**: Fixed the `extractPluginConfig()` no-op stub to actually pass config to provider plugins. Added `ModelTier` type (`"low" | "medium" | "high"`), `ModelTierMapping`, `DEFAULT_MODEL_TIERS` constant, per-project tier override cascade, startup provider validation, and the `ao providers` CLI command.

3. **Real Provider (58-3)**: Implemented `OMCProvider` -- the first non-trivial provider. Creates `.omc/` directory structures (state, plans, logs, notepad, project-memory), generates `omc.jsonc` config with agent models and routing tier mappings, injects OMC metadata into sessions via `enhance()`, and cleans up via `teardown()`.

4. **Model Routing Logic (58-4)**: Created `ModelRoutingService` with keyword-based story complexity classification (LOW: "explore"/"search"/"lint", HIGH: "architect"/"debug"/"fix"), auto-escalation after 2 consecutive failures at the same tier, and integration into the spawn flow to set `AgentLaunchConfig.model` with session metadata tracking (`ao:modelTier`, `ao:model`).

5. **Usage Tracking (58-5)**: Built `ModelUsageAggregator` with in-memory store + JSONL persistence, capturing model tier, token counts, and estimated cost per session on completion/failure. Provides aggregation queries by session, story, project, and sprint with a `getSummary()` breakdown by tier.

6. **Reliability (58-6)**: Implemented `ProviderHealthMonitor` with periodic health polling feeding into the existing `CircuitBreakerManager`, automatic fallback to `RawProvider` when the circuit breaker trips OPEN, health check rule integration with the existing `HealthCheckRulesEngine`, and `ao:providerFallback` session metadata tracking.

## Story Delivery

| Story | Title | Status | Tests Added | Agent Model | Notes |
|-------|-------|--------|-------------|-------------|-------|
| 58-1 | SessionEnhancementProvider Interface | done | 18 | Sonnet 4.6 | 8th plugin slot, RawProvider, spawn integration |
| 58-2 | Provider Configuration & Discovery | done | 19 | Opus 4.6 | extractPluginConfig fix, model tiers, CLI providers cmd |
| 58-3 | OMC Provider Implementation | review | 16 | Opus 4.6 | .omc/ directories, omc.jsonc, metadata injection |
| 58-4 | Model Routing Service | done | 25 | Opus 4.6 | Keyword heuristics, auto-escalation, spawn integration |
| 58-5 | Model Usage Tracking | review | 28 | Opus 4.6 | JSONL persistence, completion handler integration |
| 58-6 | Provider Health & Graceful Degradation | done | 27 | Opus 4.6 | Circuit breaker integration, health polling, fallback |

**Total new tests**: 133 across core and plugin packages
**Regressions**: 0 across all packages
**Code review issues found and fixed**: 30+ (across 4 stories with review notes)
**New plugin packages**: 1 (`@composio/ao-plugin-provider-omc`)
**New CLI commands**: 1 (`ao providers`)

## Party Mode

### R2d2 (Optimist)

This is the best-layered epic in the entire project. Each story built cleanly on the previous one with zero rework: 58-1 defined the interface, 58-2 wired config, 58-3 implemented a real provider, 58-4 added routing intelligence, 58-5 built observability, 58-6 hardened reliability. The dependency chain was explicit and correct from the start -- every story's "Architecture Context" section documented what previous stories delivered, and no story had to revisit a prior story's decisions.

The provider abstraction is a textbook example of the dependency inversion principle. The orchestrator knows about `SessionEnhancementProvider` but nothing about OMC, model tiers, or health monitoring. All of those are implementation details behind the interface. The graceful degradation pattern -- health check fails, fall back to RawProvider, log warning, continue -- is applied consistently across every integration point.

### Nova (Realist)

The epic delivered its core value proposition: a working model routing pipeline from story classification through model selection to usage tracking. However, the keyword heuristic classifier is extremely naive. "Explore" maps to LOW, but exploration tasks are often the most critical work in a sprint -- they determine what the rest of the team does. "Fix" maps to HIGH, but many fixes are trivial (typo, config value). The classifier has no understanding of story scope, file count, or acceptance criteria complexity. The 50-70% cost savings target is aspirational rather than measured -- there is no baseline to compare against since usage tracking was implemented in the same epic.

Stories 58-3 and 58-5 are both in "review" status, not "done". This means the OMC provider implementation and usage tracking have not been through final validation. The `enhance()` method on OMCProvider is implemented but not called by session-manager -- it was deferred to Epic 59 (story 59-5). The model routing service uses `activeProvider.name !== "raw"` to gate routing, which means routing is active for ANY non-raw provider, not just OMC.

### Blaze (Critic)

The `extractPluginConfig()` function was a no-op stub that existed since the plugin registry was created. It took Story 58-2 specifically to fix it for the provider slot, but it is still a stub for all other slots. This is a latent defect that was papered over rather than properly addressed. If any future plugin slot needs config passthrough, it will hit the same problem.

The `model-routing.ts` module lives in core alongside the orchestrator's most critical spawn logic. The failure counter is an in-memory `Map<string, { tier, count }>` that is lost on process restart. For an orchestrator designed to run long-lived sessions, this means a restart resets all escalation state -- a flaky provider will get exactly 2 more chances to fail after every orchestrator restart, potentially burning through expensive opus sessions repeatedly.

The OMCProvider's `install()` method creates directories synchronously during spawn, adding filesystem I/O to the critical path of session creation. If the worktree is on a slow filesystem or network mount, this directly impacts session spawn latency. The idempotency guarantee (`mkdir(..., { recursive: true })`) is correct but means every install call performs 5 mkdir + 2 writeFile operations regardless of whether the directory already exists.

### Pax (Process Coach)

Story file quality was consistently high across all six stories. The "Architecture Context" section in each story clearly documented what previous stories implemented and what the current story adds. The "Key Design Decisions" sections contained actual decisions with rationale, not just restatements of requirements. The "Anti-Patterns to Avoid" sections were specific and enforced -- I see no evidence that any story violated its own anti-patterns.

The code review process was thorough and iterative. Story 58-5 had two rounds of code review: the initial review found 9 issues (3 HIGH), and a second review found 8 more (2 HIGH). All 17 issues were fixed. This demonstrates the value of multi-pass review, but also suggests the first implementation pass was not careful enough -- H1 in the initial review was "getBySprint() was a stub returning empty aggregate," which should have been caught by the developer, not the reviewer.

The escalation between stories was handled well. Story 58-4's code review caught an escalation-vs-heuristic conflict where `resolveTier()` could downgrade a HIGH-heuristic story to MEDIUM through escalation. The fix used `max(escalatedTier, heuristicTier)` to ensure escalation only moves upward. This is the kind of logic bug that requires careful thinking about state machines, and the review process caught it.

## What Went Well

1. **Clean dependency chain**: Stories 58-1 through 58-6 formed a strict linear dependency with zero rework. No story had to modify a previous story's implementation. Each story's "Architecture Context" section correctly described the state left by previous stories, and no assumptions were violated.

2. **Graceful degradation as a first-class concern**: From 58-1's "provider failures MUST NOT prevent sessions from spawning" to 58-6's circuit breaker fallback, the system is designed to always produce a working session. The RawProvider is always available as the escape hatch. The `ao:providerFallback` metadata enables tracking how often degradation occurs.

3. **Reusing existing infrastructure**: Story 58-6 reused `CircuitBreakerManager`, `HealthCheckRulesEngine`, and `CustomHealthCheckRule` instead of building new monitoring infrastructure. Story 58-4 reused `resolveModelTiers()` from session-manager. This restraint kept the epic's scope tight and avoided duplicate abstractions.

4. **Code review depth**: Reviews caught real logic bugs, not style issues. The escalation-vs-heuristic conflict in 58-4, the `getBySprint()` stub in 58-5, the substring matching false positive ("fix" matching "prefix") in 58-4, the JSONL async race condition in 58-5 -- these are all correctness issues that would have caused subtle runtime failures.

5. **Test coverage growth**: 133 new tests across 6 stories, with zero regressions. Each story tested its acceptance criteria, edge cases, error paths, and factory isolation. The completion handler integration tests in 58-5 verified that `captureModelUsage()` correctly extracts metadata from sessions in both completion and failure paths.

6. **Zero external dependencies**: The entire epic added no new npm dependencies. Model routing uses keyword matching, usage tracking uses `node:fs/promises` for JSONL, health monitoring uses the existing circuit breaker. This is notable for an epic that introduces significant new functionality.

## What Could Be Improved

1. **Keyword heuristic classifier is too naive**: The complexity classifier uses a fixed list of keywords with no understanding of scope, file count, acceptance criteria, or codebase context. "Explore" stories are often the most critical work in a sprint but get routed to the cheapest model. The classifier should consider story metadata beyond the title/ID.

2. **No cost baseline or savings measurement**: The epic's goal was "50-70% cost reduction" but there is no baseline measurement of pre-routing costs. Usage tracking (58-5) was implemented in the same epic, so there is no "before" data. The actual savings percentage is unknown and unverifiable.

3. **Stories 58-3 and 58-5 stuck in review**: Two of six stories are marked "review" rather than "done". The OMC provider and usage tracking have not been through final validation. This is a process gap -- either they should have been validated and marked done, or blockers should be documented.

4. **In-memory failure counters reset on restart**: The `ModelRoutingService` failure counter is an in-memory Map. After an orchestrator restart, all escalation state is lost. A flaky provider will get 2 more chances after every restart, potentially burning through expensive opus sessions in a loop.

5. **`enhance()` is implemented but never called**: OMCProvider's `enhance()` method injects session metadata (agents, execution mode, configured flag) but session-manager never calls it. This was deferred to Story 59-5. Until then, the metadata injection code exists but is dead code.

6. **extractPluginConfig() still a stub for non-provider slots**: Story 58-2 fixed the function for the provider slot, but it returns `undefined` for all other slots. If future plugin slots need config passthrough, they will hit the same stub. The fix was targeted, not systemic.

## Key Decisions

1. **New plugin slot rather than extending Agent**: Session enhancement is orthogonal to the agent adapter -- a provider works across any agent type (Claude, Codex, Aider). Using a new `"provider"` slot keeps the two concerns cleanly separated. The trade-off is one more abstraction layer in the spawn flow.

2. **Keyword heuristics over ML classification**: Deterministic, fast (<1ms), zero dependencies, testable. The trade-off is low accuracy for stories that don't match keyword patterns (most stories default to MEDIUM). Future enhancement: ML-based classification using story metadata.

3. **Routing gated by provider selection**: Model routing activates ONLY when `sessionEnhancement.provider !== "raw"`. When raw, the existing `project.agentConfig?.model` behavior is unchanged. This ensures backward compatibility and lets teams opt into routing incrementally.

4. **Dual persistence for usage tracking**: In-memory store for fast aggregation queries, JSONL append-only file for durability across restarts. On startup, the aggregator loads from JSONL. This mirrors the existing audit trail pattern and avoids adding a database dependency.

5. **Fallback at spawn time only, not mid-session**: When the circuit breaker is OPEN, only NEW sessions fall back to RawProvider. Already-running sessions continue with their assigned provider. Mid-session provider switching would require session state migration and is too complex for the current architecture.

6. **Zero-value fallback for missing cost data**: When an agent crashes before reporting cost data, the usage event is still logged with `inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0`. This ensures every session has a usage record and simplifies aggregation queries (no null checks).

## Lessons Learned

1. **The "Architecture Context" section is the most valuable story metadata**: Every story in this epic had a section documenting what previous stories implemented and what the current story adds. This eliminated context-switching overhead and prevented incorrect assumptions about prior state. This practice should be mandatory for all sequential epics.

2. **Code review catches logic bugs that tests miss**: Tests verified individual method behavior, but code review caught state machine errors (escalation direction), boundary matching bugs (substring false positives), race conditions (async JSONL startup load), and architectural gaps (stub methods that return empty results). The combination of tests + adversarial review is essential.

3. **Multi-pass code review finds what single-pass misses**: Story 58-5 underwent two review rounds. The first found 9 issues including a stub method and async race condition. The second found 8 more including missing integration tests and unsafe type casts. The second pass caught issues introduced by the first pass's fixes.

4. **In-memory state needs explicit documentation**: The failure counter Map in model routing is lost on restart. This was documented as a deliberate decision, but it is the kind of trade-off that should be surfaced to users, not just developers. The sprint-status.yaml should track which features have persistent vs ephemeral state.

5. **Config passthrough stubs are latent defects**: The `extractPluginConfig()` function was a no-op stub that existed across multiple epics. It worked because no slot needed config until now. When adding a new feature that depends on infrastructure, audit the infrastructure first rather than assuming it works.

6. **Provider.prepare vs provider.install naming matters**: The `install()` method name suggests package installation, but it actually prepares the worktree directory structure. This caused confusion in story reviews about whether OMCProvider should install the OMC npm package (it should not -- that is Story 59-3). A name like `prepare()` or `setup()` would be clearer.

## Action Items

| # | Action Item | Owner | Priority | Story/Source |
|---|------------|-------|----------|--------------|
| 1 | Validate and close Stories 58-3 and 58-5 (move from review to done) | Dev | high | Stories 58-3, 58-5 |
| 2 | Wire `enhance()` call into session-manager spawn flow (currently dead code) | Dev | high | Story 58-3, deferred to 59-5 |
| 3 | Improve complexity classifier: consider file count, acceptance criteria, story scope | Dev | medium | Story 58-4 limitation |
| 4 | Establish pre-routing cost baseline for savings measurement | Dev | medium | Epic 58 goal |
| 5 | Persist failure counters to JSONL (survive restarts) | Dev | medium | Story 58-4 limitation |
| 6 | Implement dashboard API routes for model usage data (Epic 60 stories 60-5, 60-6) | Dev | medium | Story 58-5 deferred |
| 7 | Add per-project circuit breaker isolation (currently single global breaker) | Dev | low | Story 58-6 deferred |
| 8 | Add per-model pricing configuration (configurable $/token per model) | Dev | low | Story 58-5 deferred |
| 9 | Fix `extractPluginConfig()` for all plugin slots, not just provider | Dev | low | Story 58-2 finding |
| 10 | Implement historical cost-complexity feedback loop (learn from past sessions) | Dev | low | Stories 58-4, 58-5 deferred |

## Metrics

| Metric | Value |
|--------|-------|
| **Stories completed** | 6 / 6 (100% delivered, 4 done + 2 review) |
| **Total new tests** | 133 (18 + 19 + 16 + 25 + 28 + 27) |
| **Test regressions** | 0 |
| **Stories with code review** | 6 / 6 (100%) |
| **Code review rounds** | 8 total (6 initial + 2 second-pass for 58-5) |
| **Code review issues found** | ~30+ (HIGH: ~8, MEDIUM: ~14, LOW: ~10) |
| **Code review issues fixed** | 100% |
| **New external dependencies** | 0 |
| **New plugin packages** | 1 (`@composio/ao-plugin-provider-omc`) |
| **New CLI commands** | 1 (`ao providers`) |
| **New source files created** | 10 (2 plugin packages, 4 core modules, 4 test files) |
| **Modified core files** | ~12 (types.ts, config.ts, session-manager.ts, plugin-registry.ts, index.ts, service-registry.ts, assignment-service.ts, completion-handlers.ts, and test files) |
| **Plugin slot added** | 1 (`"provider"` -- 8th slot) |
| **Provider methods defined** | 5 (`install`, `configure`, `enhance`, `teardown`, `healthCheck`) |
| **Model routing tiers** | 3 (LOW: haiku, MEDIUM: sonnet, HIGH: opus) |
| **Keyword heuristics** | 10 LOW + 9 HIGH = 19 keywords |
| **Deferred items tracked** | ~15 across all stories |
| **Lines of code added (estimate)** | ~2,500-3,000 (production + tests) |
| **Cost savings target** | 50-70% (not yet measured) |
