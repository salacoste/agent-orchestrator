# Epic 43 Retrospective: Autonomous Pipeline

**Date:** 2026-04-29
**Epic:** 43 — Autonomous Pipeline
**Cycle:** 9 (Autonomy, Scale & Frontier)
**Stories:** 8 (43-1 through 43-8)
**Status:** Done

---

## Epic Summary

Epic 43 was the largest single epic in Cycle 9, delivering 8 stories that transform the agent-orchestrator from a manually-driven system into one capable of autonomous operation. The core idea: "push, not pull" applied to the orchestrator itself. Instead of humans triggering every agent spawn, the system monitors story completions, manages a priority queue, enforces WIP limits, detects problems (infinite loops, scope creep), and adapts to temporal constraints (business hours, deadline pressure).

The stories were designed with an explicit build order: 43-3 (spawn queue) first because everything else depends on it, then 43-1 (autopilot) as the orchestration brain, followed by the four independent detection/forecasting modules (43-2, 43-5, 43-6, 43-7), then 43-4 (priority upgrade) which layers onto the queue, and finally 43-8 (deadline pressure) which composes with the sprint clock. This dependency chain was honored during execution and proved correct.

The architectural throughline is the "pure function + event-driven integration" pattern. Six of the eight stories produce pure modules (forecast computation, loop detection, scope creep checking, business hours evaluation, deadline pressure assessment, priority scoring) that take data in and return results out with zero side effects. The remaining two (spawn queue, autopilot) are stateful services that wire the pure modules into the event bus and session lifecycle. This split kept testing straightforward and compositional.

**Production code:** 952 lines across 7 new files in `packages/core/src/`.
**Test code:** 985 lines across 7 new test files in `packages/core/src/__tests__/`.
**API routes:** 4 new endpoint groups (autopilot status/mode, sprint/queue, sprint/forecast, agent scope/loop status).
**Config additions:** `autopilot`, `maxConcurrentAgents`, `loopDetectionThreshold`, `businessHours`, `defaultStoryDurationMs`.

---

## Story Delivery

| Story | Title | Status | Outcome |
|-------|-------|--------|---------|
| 43-1 | Autopilot Mode | done | 219-line engine (`autopilot.ts`) with three modes (off/supervised/autonomous). Subscribes to story completions, reads sprint-status.yaml for next backlog story, enqueues via SpawnQueue. Supervised mode sends notification with 5-min timeout that queues (not auto-approves). Dashboard API routes + AutopilotPanel component. |
| 43-2 | Sprint Forecaster | done | 141-line pure function module (`sprint-forecaster.ts`). Domain-matched sampling from learning store. P50/P80/P95 percentile estimates. Confidence levels (high/medium/low/insufficient) based on sample count. Cold start fallback with configurable `defaultStoryDurationMs`. |
| 43-3 | WIP Limits & Spawn Queue | done | 170-line in-memory queue (`spawn-queue.ts`). All spawns route through `enqueue()`. Sequential one-at-a-time processing prevents race conditions. Auto-dequeue on session completion via event subscription. Unlimited mode when `maxConcurrentAgents` not configured. |
| 43-4 | Priority Queue Upgrade | done | Upgraded `spawn-queue.ts` from FIFO to priority-based selection. Unblocked dependencies get +100 boost. Story order from sprint-status gives base priority. Stable sort preserves FIFO for equal priorities. `shift()` replaced with priority-aware `processNext()`. |
| 43-5 | Infinite Loop Detector | done | 96-line pure module (`loop-detector.ts`). Tracks restart/resume counts per `agentId:storyId` pair via `Map<string, number>`. Returns `loop-detected` status when count exceeds configurable threshold (default: 3). 429 response blocks further restarts, notification sent. Manual `reset()` for recovery. |
| 43-6 | Scope Creep Detector | done | 118-line pure module (`scope-creep-detector.ts`). Computes historical averages for tokens-per-story and files-per-story from learning store. Compares running agent metrics against threshold * average (default: 2x). Warning includes agent ID, story, current vs average, suggested action. |
| 43-7 | Business Hours Awareness | done | 90-line pure function (`business-hours.ts`). `isWithinBusinessHours(config, now?)` checks against configurable start/end times and timezone. Handles overnight hours (start > end, e.g., 22:00-06:00). Optional config defaults to 24/7. Only gates autopilot spawns, not manual spawns. |
| 43-8 | Deadline Pressure Adaptation | done | 118-line pure function (`deadline-pressure.ts`). Detects pressure as two-axis condition: <20% time remaining with >30% stories undone (moderate), <10% with >50% undone (critical). Returns level + recommendations. Configurable thresholds. Pure numerical computation, no side effects. |

**Delivery rate:** 8/8 stories completed (100%).
**Dependency-ordered delivery:** 43-3 -> 43-1 -> [43-2, 43-5, 43-6] -> 43-4 -> [43-7, 43-8] (as planned).

---

## Party Mode Discussion

**Participants:** R2d2 (Orchestrator), Nova (Architect), Blaze (Executor), Pax (QA)

### R2d2 (Orchestrator)

This is the epic I have been waiting for since Cycle 1. The original design doc says "push, not pull" -- but for 42 epics, that push was always a human pushing buttons. Epic 43 finally makes the orchestrator itself the pusher. You set `autopilot: autonomous`, walk away, and get a notification when the sprint is done or something goes wrong.

The build order was critical. We had a wrong start early on where I considered doing autopilot (43-1) before the spawn queue (43-3). That would have left autopilot calling `sessionManager.spawn()` directly, which defeats the entire WIP-limiting architecture. Party mode caught that: Nova pointed out the dependency chain, and we resequenced to 43-3 first. The result is that every spawn -- manual, autopilot, or auto-dequeued -- goes through exactly one code path: `SpawnQueue.enqueue()`. That is a single choke point for concurrency control, priority ordering, and business hours gating.

The supervised mode timeout decision was a party-mode debate. The original brainstorm said "5-min timeout auto-approves." Blaze and I argued that auto-approve on timeout defeats the purpose of supervised mode -- if the human did not respond in 5 minutes, they are probably away, so queue it and let them deal with it when they come back. Pax agreed from a safety perspective. We changed it to: timeout queues, not approves. This is the right default for an orchestration system that manages real code changes.

### Nova (Architect)

The architectural pattern that emerged from Epic 43 is what I would call "pure core + impure shell." Six of eight stories produce modules with zero I/O, zero side effects, and fully deterministic output given the same inputs. The two stateful services (spawn queue, autopilot) form the shell that reads from the event bus, calls into the pure modules, and writes to sprint-status.yaml.

```
Event Bus (story.completed, session.finished)
  |
  v
SpawnQueue (43-3) <-- priority scoring (43-4)
  |                        ^ business hours gate (43-7)
  |                        ^ deadline pressure input (43-8)
  v
Autopilot (43-1)
  |
  +-- reads sprint-status.yaml for next backlog story
  +-- enqueues via SpawnQueue.enqueue()
  +-- sends notifications via NotificationService

Pure modules (no I/O):
  - SprintForecaster (43-2): backlog + learnings -> percentiles
  - LoopDetector (43-5): restart events -> isLooping boolean
  - ScopeCreepDetector (43-6): session metrics + averages -> warning
  - BusinessHours (43-7): config + time -> boolean
  - DeadlinePressure (43-8): time/completion ratios -> level + recommendations
```

This architecture is testable, composable, and extensible. If we want to add a new autonomous behavior in Cycle 10 (e.g., auto-prioritization based on cost, or auto-scope-negotiation), it slots in as a new pure module with a thin integration layer in autopilot.ts.

One concern: the in-memory queue is rebuilt from sprint-status.yaml on startup. For a system that manages code changes, losing the queue state on restart is acceptable -- the sprint-status.yaml is the durable truth, and any queued spawns that were not started simply get re-discovered on the next autopilot cycle. But if we ever add time-sensitive scheduling (e.g., "spawn this at 2pm"), we would need a persistent queue. Not a problem today, but worth noting for Cycle 10.

### Blaze (Executor)

The most interesting implementation challenge was the spawn queue's sequential processing guarantee. Story 43-3 required that queued spawns execute one at a time with no race conditions. The naive approach would be a mutex or lock, but in TypeScript/Node.js that is overengineering. Instead, the queue uses a simple `processing` flag that is checked in `processNext()`. If processing is already underway, the next `processNext()` call returns immediately. When the current spawn completes, it clears the flag and calls `processNext()` again. This serializes all spawns through a single execution lane without any locking primitives.

The priority upgrade (43-4) was cleaner than expected. Rather than maintaining a sorted data structure (which complicates insertion), the queue stores entries in insertion order and selects the highest-priority entry at dequeue time. For the expected queue sizes (typically 0-10 entries), a linear scan is faster and simpler than a heap. The `insertionOrder` counter ensures stable sorting: when two entries have the same priority, the one enqueued first wins. This is exactly the behavior specified in AC #4.

Business hours (43-7) had a subtle edge case: overnight hours where `start > end` (e.g., 22:00-06:00). The comparison logic needs to handle both directions: if start < end, check `now >= start && now < end`. If start > end, check `now >= start || now < end` (spans midnight). The test for this case (3.4 in the story) was specifically written to catch it. The `now?` parameter makes the function testable without mocking the system clock.

### Pax (QA)

Test coverage for Epic 43 is the densest of any epic in the project: 985 lines of tests for 952 lines of production code, a 1.03:1 ratio. This is because the pure-function architecture makes testing straightforward -- every test sets up inputs, calls the function, and asserts outputs. No mocking frameworks, no database fixtures, no HTTP clients.

Breakdown by story:
- `spawn-queue.test.ts`: 236 lines -- covers enqueue under/over limit, auto-dequeue, sequential processing, priority ordering, stable sort, unlimited mode, API state
- `autopilot.test.ts`: 221 lines -- covers all three modes, story discovery, queue integration, supervised timeout, no-next-story pause, mode change
- `scope-creep-detector.test.ts`: 145 lines -- covers average computation, threshold detection, custom multiplier, empty learning store
- `sprint-forecaster.test.ts`: 130 lines -- covers percentile computation, domain matching, cold start, confidence boundaries, P50 < P80 < P95 invariant
- `deadline-pressure.test.ts`: 98 lines -- covers moderate/critical thresholds, healthy margins, custom thresholds, recommendations by level
- `loop-detector.test.ts`: 93 lines -- covers threshold triggering, below-threshold pass-through, reset, independent agent tracking
- `business-hours.test.ts`: 62 lines -- covers within/outside hours, no-config 24/7, overnight span, timezone handling

The P50 < P80 < P95 invariant test in the forecaster suite is worth highlighting. It is not just testing that the function returns numbers -- it is testing a mathematical property that must hold for any valid input. Property-based tests like this catch edge cases that example-based tests miss.

One gap: there is no integration test that exercises the full autonomous pipeline (autopilot detects completion -> finds next story -> checks business hours -> enqueues via spawn queue -> queue checks WIP limit -> spawns agent -> loop detector tracks restarts). This end-to-end path is the most valuable integration scenario and it relies on the interaction of four separate modules.

---

## What Went Well

1. **Build order respected dependencies correctly.** The explicit dependency chain (43-3 -> 43-1 -> parallel -> 43-4 -> parallel) was identified in planning and honored during execution. No story had to wait for an unimplemented dependency, and no story needed rework because a dependency changed its interface.

2. **Pure function pattern at scale.** Six of eight stories are pure modules with zero I/O. This made implementation fast (no async complexity, no service wiring), testing straightforward (setup inputs, call function, assert outputs), and composition natural (autopilot calls into multiple pure modules). The 1.03:1 test-to-code ratio is a direct consequence.

3. **Single spawn choke point.** Every spawn -- whether triggered manually, by autopilot, or by auto-dequeue -- goes through `SpawnQueue.enqueue()`. This single code path enforces WIP limits, priority ordering, and sequential processing. Adding business hours gating (43-7) was a two-line change to the autopilot's pre-enqueue check because the queue itself did not need to know about hours.

4. **Supervised mode timeout decision.** Party mode changed the timeout behavior from "auto-approve" to "queue." This is the safer default for a system that manages code changes. An unattended auto-approve could spawn agents that make breaking changes while no one is watching. Queueing preserves the intent (keep the sprint moving) without the risk.

5. **In-memory queue with durable truth.** The decision to make the queue in-memory with sprint-status.yaml as the durable source of truth avoided adding a new persistence mechanism. On restart, the autopilot re-discovers what needs doing from sprint-status, not from a separate queue file. This aligns with the project's "stateless orchestrator" design principle.

6. **Story 43-4 as a targeted upgrade.** The priority queue upgrade was scoped to modifying `spawn-queue.ts` only -- no new files, no new config, no new API routes. It replaced `shift()` with priority-based selection and added the `computeSpawnPriority` function. Two files changed (implementation + tests), ~50 lines added. This is the right way to layer functionality onto an existing module.

---

## What Could Be Improved

1. **No integration test for the autonomous pipeline.** The most important behavioral scenario -- "story completes, autopilot picks next story, queue enforces WIP, agent spawns, loop detector tracks it" -- is only tested in isolated unit tests. The interaction between autopilot, spawn queue, loop detector, and business hours is untested at the integration level. This is the highest-risk gap.

2. **Story status fields still say "ready-for-dev."** All 8 story files have `Status: ready-for-dev` in their headers despite being marked "done" in sprint-status.yaml. The Dev Agent Record sections (agent model, completion notes, file list) are empty in every story. This makes it hard to trace implementation details from the story files themselves.

3. **Autopilot reads sprint-status.yaml synchronously via `readFile`.** The autopilot engine reads the YAML file on every story completion event to find the next backlog story. For a file that changes infrequently, this is acceptable. But if the sprint has 50+ stories and completions happen rapidly, the YAML parse could become a hot path. A cached/read-through approach would be more robust.

4. **Scope creep detector depends on learning store having meaningful data.** With fewer than 5 historical sessions, the detector falls back to zero averages, which means it effectively disables itself. The cold-start problem is documented in the confidence levels, but the scope creep detector has no configurable default baseline (unlike the forecaster which has `defaultStoryDurationMs`). A `defaultTokensPerStory` config option would improve cold-start behavior.

5. **Business hours is a gate, not a scheduling mechanism.** When autopilot encounters an out-of-hours spawn, it simply does not enqueue. There is no "queue until business hours" behavior -- the story is effectively skipped until the next autopilot cycle. This means if the last story completes at 6:01 PM, the next one does not start until the next story completion event triggers the autopilot again. A deferred scheduling mechanism would be more autonomous.

6. **Deadline pressure produces recommendations but no automated action.** Story 43-8 computes pressure levels and returns string recommendations like "skip optional reviews" and "parallelize more." These are display-only. For a truly autonomous pipeline, the pressure level could influence autopilot behavior directly (e.g., suppress scope creep warnings under critical pressure, increase WIP limits temporarily).

---

## Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Three autopilot modes (off/supervised/autonomous) | Graduated trust model: teams adopt autonomy incrementally | More modes to test; supervised mode's timeout behavior is nuanced |
| All spawns through SpawnQueue.enqueue() | Single choke point for WIP, priority, and sequential processing | Adds one layer of indirection to manual spawns |
| Supervised timeout queues, does not auto-approve | Safer default: unattended approval could spawn agents that make breaking changes | Sprint velocity slightly lower under supervised mode if humans are slow to respond |
| In-memory queue, sprint-status.yaml is durable truth | Aligns with "stateless orchestrator" principle; no new persistence file | Queue state lost on restart; acceptable because sprint-status.yaml is the source of truth |
| Sequential one-at-a-time spawn processing | Prevents race conditions in agent creation; simpler than locking | Slightly slower burst startup; acceptable for typical queue sizes (0-10) |
| Priority selection by linear scan, not heap | Queue size is small (0-10); linear scan is simpler and faster for small N | Would need rethinking if queue grows to 50+ entries |
| Pure functions for detection/forecasting modules | Zero I/O, fully testable, composable; no mocking needed | Requires thin integration layer in autopilot/queue to wire side effects |
| Domain-matched sampling in forecaster | Historical accuracy: similar stories have similar durations | Falls back to global average if no domain match; learning store must accumulate tagged sessions |
| Business hours gates autopilot only, not manual spawns | Humans should be able to override time restrictions when they choose | Manual spawns are unrestricted even during off-hours; intentional design choice |
| Deadline pressure returns recommendations, not actions | Keeps human in the loop for high-stakes decisions (scope cuts, review skipping) | Requires human to act on recommendations; less fully autonomous |

---

## Lessons Learned

1. **The "pure core + impure shell" pattern scales well for orchestration systems.** By keeping business logic (priority scoring, pressure detection, loop detection) in pure functions and limiting stateful code to two modules (queue, autopilot), the system is easy to reason about, test, and extend. New autonomous behaviors slot in as pure modules with minimal wiring.

2. **Single choke point for critical operations prevents entire classes of bugs.** Having every spawn go through `SpawnQueue.enqueue()` means WIP limits, priority ordering, and sequential processing are enforced universally. There is no way to bypass the queue accidentally. This is the "funnel pattern" -- converge all paths through a single validated code path.

3. **Configurable thresholds with sensible defaults are essential for autonomous systems.** Every detection module (loop detector, scope creep, deadline pressure, business hours) has configurable thresholds. This is not over-engineering -- it is necessary because "3 restarts is a loop" or "2x average is scope creep" are heuristics that vary by team, project, and agent model. The defaults work for the initial deployment; the configurability allows tuning without code changes.

4. **Dependency ordering in story planning pays dividends.** The explicit build order (43-3 before 43-1 before 43-4) prevented the most common integration mistake: building the consumer before the dependency. The party-mode discussion that established this order took 10 minutes and saved at least one rework cycle.

5. **Test-to-code ratio above 1.0 is achievable and valuable for pure functions.** When modules have zero I/O, tests are compact (no setup/teardown, no mocking) and can cover edge cases densely. The 985 lines of tests for 952 lines of production code gave confidence that threshold boundaries, priority ties, and percentile invariants are correct.

---

## Action Items

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 1 | Add integration test for full autonomous pipeline (autopilot -> queue -> spawn -> loop detection cycle) | Pax | high |
| 2 | Update story file statuses from "ready-for-dev" to "done" and fill Dev Agent Record sections for all 8 stories | Blaze | medium |
| 3 | Add cached sprint-status.yaml read-through in autopilot to avoid re-parsing on every completion event | Nova | medium |
| 4 | Add `defaultTokensPerStory` config option to scope creep detector for cold-start baseline | Blaze | low |
| 5 | Design deferred scheduling for business hours (queue spawns with "next business hours" timestamp instead of skipping) | Nova | low |
| 6 | Consider wiring deadline pressure level into autopilot behavior (suppress non-critical warnings under critical pressure) | R2d2 | low |
| 7 | Evaluate priority heap for spawn queue if queue size consistently exceeds 20 entries in production | Nova | low |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 8 |
| Stories shipped | 8 |
| Delivery rate | 100% |
| Production code (new files) | 952 lines across 7 files |
| Test code (new files) | 985 lines across 7 files |
| Test-to-code ratio | 1.03:1 |
| API routes added | 4 endpoint groups (autopilot, queue, forecast, agent scope/loop) |
| Config additions | 5 new config options |
| Pure function modules | 6 of 8 stories |
| Stateful service modules | 2 of 8 stories (spawn queue, autopilot) |
| Build order violations | 0 |
| Stories requiring rework | 0 |
| Epic completion | Done |
| Cycle 9 epic position | Largest epic in Cycle 9 (8 of 43 stories) |

---

## Dependency Graph

The realized dependency structure, which matched the planned build order:

```
43-3 (Spawn Queue)         [foundation]
  |
  +--> 43-1 (Autopilot)    [depends on queue]
  |     |
  |     +--> 43-7 (Business Hours)  [gates autopilot]
  |
  +--> 43-4 (Priority Queue)        [upgrades queue]

43-2 (Sprint Forecaster)   [independent]
43-5 (Loop Detector)       [independent]
43-6 (Scope Creep)         [independent]
43-8 (Deadline Pressure)   [independent, composes with sprint clock]
```

All four independent modules (43-2, 43-5, 43-6, 43-8) could be developed in parallel after the queue and autopilot were in place. The actual execution followed this ordering with no blocking issues.
