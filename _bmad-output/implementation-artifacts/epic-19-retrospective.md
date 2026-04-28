# Epic 19 Retrospective — Agent Health & Recovery

**Date**: 2026-04-28
**Epic**: 19 — Agent Health & Recovery
**Status**: Complete (all 3 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 19 established the agent health monitoring and recovery subsystem for the orchestrator. It extended the existing `BlockedAgentDetector` with severity tiers, defined one-click recovery actions (ping, restart, reassign) for stuck agents, and implemented a cascade failure circuit breaker that auto-pauses agents when multiple failures cluster within a sliding time window. All three stories shipped as pure logic modules with comprehensive tests, laying the groundwork for future backend wiring.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 19-1 | Dead Agent Detection | Done |
| 19-2 | Agent Recovery Actions | Done |
| 19-3 | Cascade Failure Circuit Breaker | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**Nova (Architect):** The severity tier design is clean — amber at 1x threshold, red at 2x — computed inline during the existing `checkBlocked()` cycle in `BlockedAgentDetector`. Zero new periodic checks needed. The `BlockedAgentStatus` type already carried `inactiveDuration`, so severity was a pure derivation from existing data. Story 19-1 was the right foundation story: minimal API surface, maximum reusability.

**Blaze (Dev):** The cascade detector in Story 19-3 is a pure module with a sliding 5-minute window. No dependencies on React, no dependencies on the event bus — just timestamps and a threshold. Makes it trivially testable. We got 8 tests covering normal cascade, window expiry, and edge cases with fewer than 3 failures. The `CircuitBreakerManager` already handled per-service breakers; cascade detection is the aggregate layer on top.

**Pax (QA):** Recovery action buttons in `AgentSessionCard` followed the same data-driven pattern established in Epic 18's recommendation engine. The three actions (ping, restart, reassign) map cleanly to distinct operations: liveness check, kill+respawn, and kill+return-to-queue. Clear separation of concerns.

**R2d2 (Project Lead):** Reusing `BlockedAgentDetector` was the right call. Story 19-1's dev notes explicitly identified the existing `trackActivity()`, `checkBlocked()`, and `startDetection()` APIs. No reinvention needed — extend what works.

---

### What Could Be Improved

**Blaze (Dev):** Recovery API endpoints (`/api/agent/:id/ping`, `/api/agent/:id/restart`, `/api/agent/:id/reassign`) don't exist yet. The buttons make fetch calls that 404. This was an explicit trade-off (UI first, backend later), but it means the recovery flow is incomplete until the next wiring phase.

**Nova (Architect):** Recovery actions require deep integration — `SessionManager.kill()` + `spawn()`, `AgentRegistry` lookups, and Runtime plugin calls. Story 19-2's dev notes reference all these dependencies, but the implementation shipped as API endpoint stubs. The gap between "button renders" and "button works end-to-end" is significant here.

**Pax (QA):** The cascade window expiry test failed initially because `getStatus()` uses real `Date.now()` while the test used fixed timestamps. Time-sensitive tests need either mock clocks (`vi.useFakeTimers()`) or future-dated timestamps. This is the second time we hit this pattern — same issue appeared in Epic 16's cooldown timer tests.

**R2d2 (Project Lead):** Auto-diagnostic in Story 19-3 (AC2) — checking API connectivity, config validity, basic operations — is defined in the acceptance criteria but the implementation is placeholder-level. Real diagnostics need actual API health checks, which require a configured provider. This is a "working spec, not working code" situation.

---

### Key Decisions

1. **UI first, backend later.** Recovery buttons and cascade banners render in the dashboard, but the backing API routes and SessionManager integration are deferred to a wiring phase. Acceptable for a foundation-first approach where the orchestrator's core services aren't fully wired yet.

2. **Severity tiers as computed properties.** Amber/red is not stored state — it's derived from `inactiveDuration` vs threshold on every check cycle. No persistence, no migration, no state drift. The trade-off is that severity history isn't tracked, but that's fine for real-time monitoring.

3. **Cascade detection as aggregate layer.** The existing `CircuitBreakerManager` handles per-service breakers. Cascade detection sits above it, tracking agent-level failures across all services. This keeps per-agent and system-wide concerns separate.

4. **Pause, don't kill, on cascade.** When 3+ agents fail in 5 minutes, remaining agents are paused (not terminated). This preserves agent state for potential recovery and avoids making a bad situation worse.

---

### Lessons Learned

1. **Time-sensitive tests need deterministic clocks.** Tests that depend on time comparisons (cascade windows, inactivity thresholds) must use `vi.useFakeTimers()` or inject a clock dependency. Real `Date.now()` in tests causes flaky failures depending on execution speed. This is now the third occurrence across Cycle 4 — should be a project convention.

2. **Recovery actions are orchestration commands, not API calls.** Ping, restart, and reassign route through `SessionManager` + Runtime plugin. They're deeper than a simple REST endpoint — they require agent lifecycle management. Future stories should scope "define API shape" separately from "wire to SessionManager."

3. **Pure modules scale well across epics.** `BlockedAgentDetector` (Epic 19-1), `CircuitBreakerManager` (Epic 19-3), and recovery action types (Epic 19-2) are all pure logic modules with no React dependency. This made them testable in isolation and reusable across dashboard and potential CLI consumers.

4. **Acceptance criteria that require external services need explicit flagging.** AC2 in Story 19-3 (auto-diagnostic) requires actual API health checks. In a foundation-first approach, these should be marked as "requires wiring" to set expectations correctly.

---

## Action Items

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Create API endpoints for recovery actions (`/api/agent/:id/ping`, `restart`, `reassign`) | Blaze | High |
| 2 | Wire recovery buttons to SessionManager.kill() + spawn() + AgentRegistry | Blaze | High |
| 3 | Implement cascade auto-diagnostic with real health checks (API connectivity, config validity) | Nova | Medium |
| 4 | Add `vi.useFakeTimers()` convention to project testing docs for time-dependent tests | Pax | Medium |
| 5 | Wire cascade "Resume All" button to BlockedAgentDetector.resume() via API route | Blaze | Medium |
| 6 | Add cascade event to JSONL event log for post-incident analysis | Nova | Low |

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 3 |
| Stories delivered | 3 (100%) |
| Test failures during dev | 1 (cascade window expiry — fixed with timestamp alignment) |
| New modules | 3 (severity tiers, recovery actions, cascade detector) |
| Modified modules | 2 (BlockedAgentDetector, CircuitBreakerManager) |
| Regressions | 0 |
| API endpoints created | 0 (deferred to wiring phase) |
| Dashboard components modified | 2 (AgentSessionCard, WorkflowDashboard) |
