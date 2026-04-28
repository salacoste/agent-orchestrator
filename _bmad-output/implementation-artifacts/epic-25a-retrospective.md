# Epic 25a Retrospective — API Backend Wiring

**Date**: 2026-04-29
**Epic**: 25a — API Backend Wiring
**Status**: Complete (all 3 stories done)
**Source**: Cycle 5

## Epic Summary

Epic 25a wired the API backend layer that connects the web dashboard's recovery and recommendation features to real server-side logic. Story 25a-1 delivered three agent recovery endpoints (`ping`, `restart`, `reassign`) that power the recovery buttons in the AgentSessionCard component. Story 25a-2 added JSONL-based persistence for recommendation feedback, ensuring accept/dismiss decisions survive page reloads. Story 25a-3 unified the output shape of the legacy 7-rule recommendation engine with the state-machine engine by adding `reasoning` and `blockers` fields to every rule output. Together these stories bridge the gap between the pure logic modules shipped in earlier epics and the user-facing dashboard behavior.

## Story Delivery

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| 25a-1 | Agent Recovery API Endpoints | Done | 3 new route files: `ping/route.ts`, `restart/route.ts`, `reassign/route.ts`. POST endpoints with 404/500 error handling |
| 25a-2 | JSONL Recommendation Feedback Persistence | Done | New `feedback/route.ts` (GET + POST) + modified `recommendation-feedback.ts` with fire-and-forget API persistence. Missing file/dir handled gracefully |
| 25a-3 | State-Machine Recommendation Full Integration | Done | Modified all 6 legacy rules in `recommendation-engine.ts` to include `reasoning` + `blockers`. Updated test assertions. 994 web tests passing |

**Total new files**: 4 (3 recovery routes + 1 feedback route)
**Total modified files**: 2 (recommendation-feedback.ts, recommendation-engine.ts + its test)
**External dependencies added**: 0
**Build/test status**: Green (994 web tests pass)

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 25a is the kind of wiring work that is unglamorous but essential. The recovery buttons in AgentSessionCard were decorative until now. With the ping/restart/reassign endpoints in place, the dashboard has real agent control. The JSONL feedback persistence is equally important — recommendations that lose their state on reload erode trust. Users need to know their accept/dismiss choices stick. The state-machine output unification (25a-3) ensures the reasoning display always has data to show, regardless of which engine produced the recommendation. Three small stories, three concrete user-facing improvements.

**Nova (Architect):** Two architectural patterns are worth highlighting. First, the route structure for agent recovery follows Next.js App Router conventions correctly: `app/api/agent/[id]/ping/route.ts` with dynamic segment parameters. This is idiomatic and means the endpoints are deployable without additional routing configuration. Second, the JSONL persistence choice for recommendation feedback is consistent with the project's "flat files, no database" philosophy. JSONL is append-only, human-readable, and does not require a migration strategy. The fire-and-forget pattern in the client module (`recordFeedback()` POSTs to API without awaiting) is the right trade-off: UI responsiveness is preserved, and a failed write is logged rather than blocking the user.

The output shape unification in 25a-3 is a good defensive move. By ensuring both the legacy rule engine and the state-machine engine produce `{ action, confidence, reasoning, blockers }`, downstream consumers (the recommendation display components) do not need to branch on engine type. This eliminates an entire class of "works with engine A, breaks with engine B" bugs.

**Blaze (Dev):** Each story touched a clean, bounded surface. Story 25a-1 created 3 new files with zero modifications to existing code. Story 25a-2 created 1 new file and modified 1 existing module. Story 25a-3 modified 2 files (engine + test). No cross-story dependencies, no shared mutable state, no merge conflicts. This is the ideal dependency graph for parallel or sequential execution — either order works.

The error handling in the recovery endpoints is consistent: unknown agents return 404, runtime errors return 500. No special cases, no half-measures. The `reassign` endpoint killing the agent and returning the story to the queue is the correct semantics — reassignment means "this agent is wrong for this story," not "pause this agent."

**Pax (QA):** Story 25a-3's acceptance criteria included a concrete test count: "994 web tests pass." This is the gold standard for integration stories — a measurable, binary pass/fail criterion that proves nothing regressed. The updated test assertions for the new `reasoning` and `blockers` fields validate the output shape contract without over-specifying the content.

The JSONL feedback endpoint's graceful handling of missing directory/file (AC#4) is a defensive detail that prevents runtime crashes in fresh environments. Worth noting as a pattern to follow for all file-based persistence stories.

---

### What Could Be Improved

**R2d2 (Project Lead):** The recovery endpoints are functional but incomplete. As the Cycle 5 retrospective noted, `restart` "doesn't actually respawn." The endpoint kills the session and returns confirmation, but full SessionManager integration (kill + respawn with context preservation) is deeper work that was deferred. The ping endpoint checks liveness, but there is no retry policy or exponential backoff for agents that are slow to respond. These are not blockers for the current cycle, but the recovery story is not finished.

**Nova (Architect):** The JSONL feedback file path is hardcoded to `_bmad-output/.recommendation-feedback.jsonl`. This couples the web API to a specific directory structure. If the output directory is configurable (which it should be for different deployment environments), the feedback path should derive from configuration rather than being baked into the route handler. The current approach works for single-machine development but will need parameterization for production.

The fire-and-forget pattern in `recordFeedback()` has no retry mechanism. A failed POST is silently dropped. For a feedback persistence feature, this means users could dismiss a recommendation, see it disappear, and have it reappear on reload because the write failed. The graceful degradation is acceptable for now, but a retry queue or at minimum a console warning would improve debuggability.

**Blaze (Dev):** The three recovery endpoints share common error handling logic (404 for unknown agents, 500 for errors) but each route file duplicates the pattern. A shared `withAgentValidation()` wrapper or middleware function would reduce boilerplate and ensure consistency if the error contract changes. The duplication is small (3 files), so this is a low-priority refactor, but worth noting.

The state-machine integration (25a-3) modified all 6 legacy rules to add reasoning and blockers. The implementation is straightforward — each rule now returns `{ reasoning: "...", blockers: [] }` alongside existing fields. However, the reasoning strings are static, not dynamically generated from rule context. A rule like "story has no assigned agent" always returns the same reasoning text regardless of which agent was previously assigned or why it was removed. Dynamic reasoning would be more actionable.

**Pax (QA):** No dedicated test files were created for Stories 25a-1 and 25a-2. The recovery endpoints and feedback API route have no unit or integration tests beyond what might exist in the broader web test suite. Given that these are API routes with concrete error behavior (404/500), they are eminently testable with Next.js route handler testing utilities. The lack of targeted tests means error paths (unknown agent, missing file, malformed JSONL) are unverified in automated testing.

---

### Key Decisions

1. **JSONL over database for feedback persistence.** Consistent with the project's stateless-orchestrator philosophy. JSONL is append-only, human-readable, requires no migration, and is trivially inspectable. The trade-off: no query capabilities, no concurrent write safety (acceptable for single-user dashboard), and file growth over time (rotation strategy needed eventually).

2. **Fire-and-forget client-side persistence.** The `recordFeedback()` function POSTs to the API without awaiting the response. This preserves UI responsiveness at the cost of potential silent data loss. Accepted because feedback is non-critical data (recommendation dismissals, not financial transactions).

3. **Unified output shape across recommendation engines.** Both the legacy 7-rule engine and the state-machine engine now produce `{ action, confidence, reasoning, blockers }`. This eliminates downstream branching and ensures the reasoning display always has data. The trade-off: legacy rules now carry fields they did not originally need, slightly increasing output size.

4. **Recovery endpoints as API routes, not service methods.** The ping/restart/reassign logic lives in Next.js API route handlers rather than in a shared service module. This keeps the implementation close to the HTTP contract but makes it harder to reuse recovery logic from other contexts (e.g., the CLI or programmatic SDK access).

---

### Lessons Learned

1. **API wiring stories should specify test expectations explicitly.** Story 25a-3 included "994 web tests pass" as an acceptance criterion — this was the only story with a concrete test count. Stories 25a-1 and 25a-2 had no test expectations. Specifying "N new tests" or "existing test suite passes" makes completion unambiguous.

2. **Fire-and-forget patterns need observability.** Silent failures in background POSTs are invisible to users and developers. Even a console warning or a logged error count would make debugging easier. Future fire-and-forget implementations should include a failure logging mechanism.

3. **Shared error handling patterns should be extracted early.** Three route files with identical 404/500 logic is a sign that a shared utility is needed. Extracting it early (2 files) is cheaper than extracting it late (N files across M epics).

4. **Static reasoning strings are a starting point, not an end state.** The legacy rules' reasoning fields are static strings. They communicate what the rule detected but not why it matters in this specific context. Future iterations should parameterize reasoning with context-specific details.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Implement full restart: kill session + respawn with preserved context (SessionManager integration) | Dev | HIGH |
| 2 | Add retry queue or failure logging for fire-and-forget feedback POSTs | Dev | MEDIUM |
| 3 | Parameterize JSONL feedback file path via configuration instead of hardcoding | Dev | MEDIUM |
| 4 | Extract shared `withAgentValidation()` wrapper for recovery endpoint error handling | Dev | LOW |
| 5 | Add unit tests for recovery API routes (ping, restart, reassign) covering 404/500 paths | QA | MEDIUM |
| 6 | Add unit tests for feedback API route (GET, POST, missing file/dir scenarios) | QA | MEDIUM |
| 7 | Parameterize reasoning strings in legacy rules with context-specific details | Dev | LOW |
| 8 | Add JSONL file rotation strategy for feedback persistence to prevent unbounded growth | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 3 |
| Stories fully wired (user-facing) | 3 |
| New API endpoints | 4 (ping, restart, reassign, feedback) |
| New files created | 4 |
| Files modified | 2 |
| External dependencies added | 0 |
| Web tests passing | 994 |
| Regressions | 0 |
| Build status | Green |
| Deferred items | 1 (full restart with respawn) |
