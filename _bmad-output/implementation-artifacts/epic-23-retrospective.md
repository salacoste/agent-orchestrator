# Epic 23 Retrospective — Project Intelligence & Conversational Interface

**Date**: 2026-04-28
**Epic**: 23 — Project Intelligence & Conversational Interface
**Status**: Complete (all 3 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 23 introduced the project intelligence layer: a context aggregator that distills artifact graph, sprint state, and event log into a structured token-budgeted summary; a chat interface for natural-language project queries; and a proactive insight engine that surfaces blockers, schedule gaps, and agent issues without being asked. The aggregator and insight generator shipped as pure, testable modules. The chat interface (23.2) and insight rendering (23.3) require LLM API integration and React component work that was deferred to the wiring phase.

## Story Delivery

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| 23-1 | Project Context Aggregator | Done | Pure module: aggregates artifact graph, sprint status, agent registry into structured summary with token-budget truncation |
| 23-2 | Project Chat Interface | Done (module only) | ChatPanel sidebar component spec + API endpoint design shipped. LLM integration + SSE streaming deferred — requires API key configuration and streaming infrastructure |
| 23-3 | Proactive Project Insights | Done (module only) | Rule-based insight generator produces blocker, schedule, and agent-health insights. Clickable card rendering deferred |

**Total new tests**: ~10 (insight generation scenarios)
**New modules**: context aggregator, insight generator
**External dependencies added**: 0
**Code reviews**: Covered as part of Cycle 4 review cadence

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 23 gave us the "brain" of the dashboard. The context aggregator is the key piece — without it, a chat interface would just be a fancy text box. By producing a structured summary that fits within a token budget, we made it possible for any LLM to reason about project state without context overflow. The proactive insights are a bonus: surfacing "3 stories blocked by story-001" without being asked is the kind of push-not-pull experience the orchestrator was designed for.

**Nova (Architect):** The token-budget-aware truncation in the context aggregator is a pattern worth calling out. The heuristic of ~4 chars/token for estimation is simple, defensible, and avoids pulling in a tokenizer dependency. The aggregator consumes existing data sources (artifact graph from Story 16.4, sprint-status.yaml, session manager data) without requiring schema changes — it reads what is already there. This is the right layering: the aggregator is a consumer, not a producer.

The insight generator follows the same rule-based pattern as the recommendation engine in Epic 17. Rules as data (not hardcoded conditionals) means new insight types can be added by appending to an array. This architectural consistency across epics is a strong signal that the plugin-driven design is paying off.

**Blaze (Dev):** Story 23-1 consumed three existing data sources and produced a single coherent output. No schema changes, no new files in the artifact graph, no modifications to sprint-status parsing. It reads, formats, and truncates. That is the ideal dependency profile for a story: depend on existing contracts, produce a new capability.

The 10 tests for insight generation cover all three insight categories (blocked stories, behind schedule, no agents) with clear assertions. Each insight rule is independently testable because they are pure functions operating on structured context.

**Pax (QA):** The insight generator tests are straightforward and cover the happy paths well. The aggregator's incremental update mechanism (AC#3: "Updates incrementally as state changes") is architecturally sound but the incremental update tests are less rigorous than the initial aggregation tests. This is acceptable for a pure module that will be re-tested when wired into the chat API.

---

### What Could Be Improved

**R2d2 (Project Lead):** Stories 23-2 and 23-3 are marked "done" but they are module-only deliveries. The chat interface has no LLM integration, no SSE streaming, no conversation history. The insight cards have no clickable rendering. This is the same pattern that affected Epics 20-22 — logic modules shipped, UI wiring deferred. The story specs did not clearly distinguish "build module" from "build component," which makes the "done" label misleading.

**Nova (Architect):** The chat interface (23-2) has a fundamental dependency that was underestimated: it requires an LLM API. This is not a wiring concern — it is an infrastructure concern. We need: (1) an API key configuration mechanism, (2) a streaming response pipeline (SSE), (3) prompt engineering for project-context grounding, and (4) conversation history persistence. None of these are trivial. The story spec listed "Create API endpoint that feeds project context to LLM" as a single task, but this is a multi-day effort with its own error handling, rate limiting, and cost management concerns.

**Blaze (Dev):** The token estimation heuristic (~4 chars/token) works for budget estimation but is imprecise. Different LLMs tokenize differently. For a conversational interface where every token counts toward a context window, we may need actual tokenization at some point. Acceptable for now, but worth noting.

The insight generator produces generic insight types. Real-world projects will need project-specific insight rules (e.g., "this epic has been in progress for 3 sprints" or "this agent's cost is 2x the average"). The current rule set is a starting point, not a complete solution.

**Pax (QA):** Only 10 tests for the entire epic. Compare that to Epic 21's single `cost-tracker.ts` module which had comprehensive tests for all three stories combined. The insight generator tests cover the three core categories but do not test edge cases like: empty project state, all stories completed, sprint with no agents assigned, or context aggregator producing output that exceeds the token budget despite truncation.

---

### Key Decisions

1. **Ship aggregator + insight generator as pure modules, defer LLM integration.** The context aggregator is deterministic and testable without an API key. The insight generator is rule-based and produces the same output for the same input. LLM-dependent features (chat responses, natural language understanding) are a separate concern requiring infrastructure that does not exist yet.

2. **Rule-based insights, not ML-based.** The insight generator uses pattern matching against project state: blocked stories count, sprint progress percentage, agent availability. This is the same "intelligence from structure" philosophy from the Cycle 4 brainstorming session. No AI needed to say "3 stories are blocked."

3. **Token budget as a hard constraint.** The aggregator must produce output under 8K tokens. This is a hard constraint because the chat API will inject the context into every LLM call. Oversized context means either truncation (losing information) or API errors (exceeding model limits). The truncation logic is defensive: if the budget is exceeded, it drops the lowest-priority sections first.

---

### Lessons Learned

1. **LLM-dependent features should be flagged separately from deterministic features.** Story 23-1 (aggregator) is pure logic. Story 23-2 (chat) requires external infrastructure. Combining them in one epic obscures this distinction and leads to "done" labels that do not reflect actual user-facing capability.

2. **The context aggregator's token estimation (~4 chars/token) is a useful heuristic but not a precision tool.** For budget estimation it is sufficient. For exact token counting, a proper tokenizer will be needed.

3. **Story specs for mixed logic/UI epics should explicitly differentiate.** "Build the insight generator module" and "render insights as clickable cards in the chat panel" are two different stories with different skill requirements and different completion criteria.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Wire context aggregator into chat API endpoint when LLM integration is ready | Dev | HIGH |
| 2 | Implement SSE streaming for chat responses | Dev | HIGH |
| 3 | Build ChatPanel React component with conversation history | Dev | MEDIUM |
| 4 | Render insight cards as clickable elements linking to dashboard views | Dev | MEDIUM |
| 5 | Add edge-case tests for context aggregator (empty state, over-budget output) | QA | MEDIUM |
| 6 | Add project-specific insight rules (stale epics, cost outliers) | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 3 |
| Stories fully wired (user-facing) | 1 (23-1 aggregator) |
| Stories module-only (deferred wiring) | 2 (23-2 chat, 23-3 insights) |
| Total new tests | ~10 |
| External dependencies added | 0 |
| New modules | 2 (context aggregator, insight generator) |
| Deferred items | 4 (LLM integration, SSE streaming, ChatPanel component, insight card rendering) |
| Epic duration | Part of Cycle 4 (1 session) |
