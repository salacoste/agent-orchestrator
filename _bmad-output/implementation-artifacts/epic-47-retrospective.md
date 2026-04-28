# Epic 47 Retrospective — Agent Autonomy v2

**Date**: 2026-04-29
**Epic**: 47 — Agent Autonomy v2
**Status**: Complete (all 6 stories done)
**Source**: epics-cycle-9.md (Phase 2, depends on Epic 46a)
**Cycle**: 9

## Epic Summary

Epic 47 delivered the second generation of agent autonomy: the negotiation, sandboxing, and intelligence layer that lets agents operate independently with guardrails. Six stories produced six new core modules -- all pure functions, zero external dependencies, 717 lines of implementation code, and 91 tests. The epic covers the full autonomy stack from permission enforcement (sandbox) through inter-agent communication (negotiation) to predictive intelligence (pre-flight check).

Every module follows the same architectural contract: pure functions, no I/O, no external dependencies, exported from `packages/core/src/index.ts`. This consistency was deliberate -- it keeps each module independently testable and lets the orchestrator wire them together at runtime.

## Story Delivery

| Story | Title | Tests | Implementation (loc) | Status |
|-------|-------|-------|---------------------|--------|
| 47-1 | Agent Collaboration — Direct Negotiation | 15 | 101 | Done |
| 47-2 | Agent Sandbox — Permission Boundaries | 19 | 110 | Done |
| 47-3 | NLU Orchestration — Natural Language Commands | 17 | 167 | Done |
| 47-4 | Conflict Resolution Wizard — AI Merge Suggestion | 15 | 114 | Done |
| 47-5 | Agent Hot-Swap — Replace Running Agent | 11 | 83 | Done |
| 47-6 | Pre-Flight Check — Agent Success Prediction | 14 | 142 | Done |

**Total new tests**: 91
**Total implementation lines**: 717 (6 modules)
**External dependencies added**: 0
**Modules created**: agent-negotiation.ts, agent-sandbox.ts, nlu-parser.ts, conflict-wizard.ts, agent-hot-swap.ts, pre-flight-check.ts

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 47 completed the autonomy stack that Cycle 9 promised. Each story is a self-contained capability that composes with the others: the sandbox enforces boundaries, negotiation lets agents coordinate within those boundaries, the conflict wizard handles what negotiation can't resolve, hot-swap lets humans intervene without losing progress, the NLU parser gives humans a conversational interface to trigger it all, and pre-flight check predicts whether it will work before you even start. The composability is what matters -- no story exists in isolation.

**Nova (Architect):** Three design decisions paid off consistently across the epic:

1. **Pure functions everywhere.** Every module exports pure functions that take data in and return data out. `evaluateNegotiation()`, `checkAccess()`, `parseCommand()`, `analyzeConflict()`, `buildSwapPlan()`, `preFlightCheck()` -- all deterministic, all testable without mocking. The orchestrator owns I/O and state; these modules own logic. This separation is what makes the plugin architecture work.

2. **Graceful degradation as a first-class pattern.** The conflict wizard returns `null` when no API key is present (47-4). The pre-flight check returns an optimistic 80% default when no historical data exists (47-6). The sandbox allows all access when no config is provided (47-2). Each module has a sensible "do nothing harmful" default that keeps the system running even when the feature isn't configured.

3. **The declarative plan pattern from hot-swap.** `buildSwapPlan()` returns data, not behavior. The orchestrator reads the plan and decides whether and how to execute it. This is the same pattern as the negotiation record and the conflict analysis -- describe what happened or what should happen, let the runtime decide. This pattern should be adopted more broadly.

**Blaze (Dev):** The glob-to-regex converter in agent-sandbox.ts (47-2) is worth calling out. It handles `**`, `*`, and `?` without pulling in a dependency like micromatch or minimatch. The placeholder-based replacement (`<<GLOBSTAR>>`, `<<QUESTION>>`) avoids the ordering problem where `**` gets partially consumed by the `*` replacement. It also guards against invalid regex with a never-matching fallback `/(?!)/`. Clean, self-contained, no footguns.

The NLU parser's dedup-by-action logic (47-3) was similarly elegant -- matching multiple rules against the same input and keeping only the highest-confidence match per unique action+params key prevents duplicate intents from polluting the results.

**Pax (QA):** 91 tests across 6 modules. Test counts per module: 47-2 (sandbox) has the most at 19, covering glob patterns, path traversal normalization, deny-overrides-allow, empty config, and empty path edge cases. 47-5 (hot-swap) has the fewest at 11, which makes sense -- it's the simplest module (two pure functions, no branching). Every test file has real assertions with no `TODO` or `FIXME` markers. Test code totals 912 lines across the six test files, exceeding the 717 lines of implementation.

---

### What Could Be Improved

**R2d2 (Project Lead):** The negotiation protocol (47-1) defines message types and decision logic but doesn't actually wire into the message bus. The `NEGOTIATION_CHANNEL` constant exists, `createNegotiationRequest()` produces payloads, but nothing subscribes or publishes. This is by design ("protocol only" per the story scope), but it means the negotiation story is a data structure, not a working system. The wiring needs a future story.

Similarly, the AI merge suggestion in 47-4 is a stub that returns a placeholder. The `suggestMerge()` function signature accepts an API key but always returns a zero-confidence response. The conflict analysis (3-way diff) works, but the AI-assisted resolution doesn't. This was scoped correctly ("stub the AI call") but the stub has been carried forward through multiple retrospectives without a follow-up story to implement it.

**Nova (Architect):** The NLU parser (47-3) uses ordered regex rules, which works for the six command types defined but doesn't scale well. Adding new command types requires appending to the `RULES` array and getting the ordering right relative to existing rules. A trie-based or tokenized approach would be more maintainable for 20+ command types. That said, for the current scope of 8 rules, the regex approach is appropriate and the 1000-character input guard prevents catastrophic backtracking.

The pre-flight check's "sort by `capturedAt` string comparison" (47-6) is fragile. ISO 8601 strings sort lexicographically correctly, but only if all entries actually use ISO 8601. If any `capturedAt` field is an empty string, a non-standard date format, or undefined, the sort order is undefined. The `?? ""` fallback handles undefined but not malformed dates.

**Blaze (Dev):** The hot-swap module (47-5) is the thinnest of the six at 83 lines and 11 tests. `buildSwapPlan()` is essentially a constructor that stamps fields onto an object. `buildHandoffPrompt()` is a string template. The real complexity -- stopping the current agent, preserving filesystem state, spawning the new agent with context -- lives in the orchestrator and isn't tested through this module. The module is correct but its value is mostly in defining the types (`SwapContext`, `SwapPlan`) rather than providing logic.

**Pax (QA):** No edge-case tests for Unicode or special characters in file paths across the sandbox and negotiation modules. What happens when a conflict file path contains spaces, unicode characters, or null bytes? The sandbox normalizes paths via `resolve()` but the test suite only uses ASCII paths. Similarly, the NLU parser tests don't exercise Unicode input -- "spawn agent for story avec accents" might not match the `\S+` pattern as expected since `\S` is ASCII-only in some regex engines.

---

### Key Decisions

| Decision | Rationale | Story |
|----------|-----------|-------|
| Pure functions only, no I/O | Keeps modules testable without mocking; orchestrator owns state | All |
| Pattern matching (not LLM) for NLU | Deterministic, fast, no API key required, testable | 47-3 |
| Deny-always-wins priority in sandbox | Security-first: explicit deny can never be overridden by allow | 47-2 |
| Declarative swap plan (no execution) | Orchestrator decides whether/how to execute; module just describes | 47-5 |
| AI merge suggestion as stub | Avoids adding Anthropic SDK dependency; analysis works without AI | 47-4 |
| Advisory-only pre-flight check | Never blocks spawning; only provides risk assessment | 47-6 |
| Custom glob-to-regex (no deps) | Avoids micromatch/minimatch dependency for a constrained use case | 47-2 |
| 2-minute default negotiation timeout | Configurable but provides a sane default; prevents indefinite waiting | 47-1 |

---

### Lessons Learned

1. **Pure function modules compose naturally.** Because every module takes data in and returns data out, they can be tested independently, composed in any order, and replaced without side effects. This is the strongest architectural pattern in the codebase and Epic 47 leaned into it heavily.

2. **Graceful degradation prevents cascading failures.** Six modules, six "do nothing harmful" defaults. The system works at every level of configuration -- from "nothing configured" (full permissiveness) to "fully locked down" (sandbox + negotiation + pre-flight). This is why zero-configuration works.

3. **Type-first design for inter-module contracts.** `NegotiationRequest`, `SandboxConfig`, `NLUIntent`, `ConflictAnalysis`, `SwapPlan`, `PreFlightResult` -- each module defines its data shapes as exported interfaces. Other modules and the orchestrator import these types directly, creating compile-time contracts between components. TypeScript enforces what would otherwise be runtime errors.

4. **Stub early, implement later, but track the stubs.** The `suggestMerge()` stub and the unwired negotiation bus are correct scoping decisions, but they accumulate as "works but not really" features. A stub registry would help track which features need follow-up.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Wire negotiation protocol to message bus -- subscribe/publish on `agent.negotiation` channel | Dev | HIGH |
| 2 | Implement real AI merge suggestion in conflict-wizard -- replace `suggestMerge()` stub | Dev | MEDIUM |
| 3 | Add Unicode/special-character path tests to sandbox and negotiation test suites | QA | MEDIUM |
| 4 | Validate `capturedAt` date format in pre-flight check before string sort | Dev | LOW |
| 5 | Consider trie-based NLU parser when command count exceeds 15 rules | Dev | LOW |

---

### Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Negotiation bus wiring (subscribe/publish) | Future story | 47-1 |
| AI merge suggestion implementation | Future story | 47-4 |
| NLU parser command palette UI wiring | Future story | 47-3 |
| Sandbox config in agent-orchestrator.yaml schema | Future story | 47-2 |
| Pre-flight check CLI integration (`ao spawn --preflight`) | Future story | 47-6 |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 / 6 |
| New core modules | 6 |
| Total implementation lines | 717 |
| Total test lines | 912 |
| Total test cases | 91 |
| External dependencies added | 0 |
| External dependencies used | 1 (`node:path` in sandbox) |
| Files modified per story | 2 (implementation + test) + 1 (index.ts export) |
| Average module size | 120 lines |
| Largest module | nlu-parser.ts (167 lines) |
| Smallest module | agent-hot-swap.ts (83 lines) |
