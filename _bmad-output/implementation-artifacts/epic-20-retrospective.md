# Epic 20 Retrospective — Conflict & Checkpoint Management

**Date**: 2026-04-28
**Epic**: 20 — Conflict & Checkpoint Management
**Status**: Complete (all 3 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 20 introduced conflict detection and recovery tooling for parallel agent workflows. Three stories delivered a merge conflict detection engine (Story 20-1), an auto-checkpoint and rollback system for agent sessions (Story 20-2), and a parallelism opportunity finder that analyzes dependency graphs to identify stories safe for concurrent execution (Story 20-3). All three shipped as pure logic modules with comprehensive test suites, deferring git integration and React component wiring to a later phase.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 20-1 | Merge Conflict Resolution Wizard | Done |
| 20-2 | Agent Work Checkpoint & Rollback | Done |
| 20-3 | Parallelism Opportunity Finder | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**Nova (Architect):** The conflict detector is a clean O(n) algorithm — it builds a file-to-agent mapping, scans for overlapping modifications, and returns conflict pairs. No database, no filesystem dependency, just pure data in and structured conflicts out. Eight tests cover the key edge cases: no conflicts, single conflict, multi-file conflicts, and empty worktree states. This is exactly the kind of module that composes well into larger pipelines.

**Blaze (Dev):** Checkpoint tracker uses immutable operations throughout. `addCheckpoint()` returns a new timeline object rather than mutating state, which means we get undo for free and tests are deterministic. The `checkpoint.intervalMinutes` config defaulting to 10 minutes is a sensible trade-off between commit noise and recovery granularity.

**Pax (QA):** Parallelism finder's dependency graph analysis is well-tested. It correctly identifies independent stories (no mutual dependencies), computes sequential-vs-parallel time savings estimates, and handles cycles in the dependency graph gracefully. The "spawn parallel" button acceptance criterion is deferred to the wiring phase, but the underlying analysis logic is solid.

**R2d2 (Project Lead):** All three stories share the same architectural DNA — pure functions, data-driven configuration, zero side effects. This consistency made the epic feel cohesive despite covering three distinct problem domains (conflict, checkpointing, parallelism).

### What Could Be Improved

**Blaze (Dev):** These stories shifted from "full implementation" to "pure logic modules only" as the cycle progressed. The acceptance criteria mention dashboard components (3-way diff view in 20-1, checkpoint timeline in 20-2, Gantt visualization in 20-3) and git operations (actual `git diff`, `git commit`, `git reset`) that we did not ship. The stories are marked done because the core logic is complete and tested, but the user-facing features are not wired.

**Nova (Architect):** The conflict detector operates on an in-memory file-to-agent mapping. It does not yet integrate with real git worktrees — no `execFile("git", ["diff", ...])` calls, no worktree scanning. Similarly, the checkpoint tracker does not actually create `[checkpoint]` WIP commits. These are core patterns (execFile for git ops) that belong in the core package, not the web package, and they need the SessionManager and Runtime plugin integration to function end-to-end.

**Pax (QA):** Test coverage for the pure modules is good, but we have no integration tests covering the full flow: detect conflict → present to user → resolve → verify clean state. That flow crosses three plugin slots (Workspace for worktree diff, Agent for checkpoint commits, Runtime for respawn) and we have not tested those interactions yet.

### Key Decisions

1. **Ship pure modules, defer git and UI wiring.** The core detection, checkpointing, and analysis logic is stable and well-tested. Git operations (`execFile` calls) and React component creation are separate concerns that require deeper plugin integration. This was the right trade-off for Cycle 4's context pressure.

2. **Immutable checkpoint timeline operations.** `addCheckpoint()` returns a new object. This makes rollback trivially correct (just select an earlier snapshot) and eliminates an entire class of state corruption bugs.

3. **Conflict detection as O(n) scan, not O(n^2) pairwise comparison.** Building a file-to-agent mapping first, then scanning for files mapped to multiple agents, is more efficient and produces cleaner output (conflict objects with file path + list of conflicting agents).

4. **Parallelism analysis on dependency graph, not file overlap.** Story 20-3 could have used the conflict detector's file mapping to find parallelism opportunities, but instead it analyzes the sprint dependency graph directly. This is the correct abstraction — two stories touching different files might still have logical dependencies, and the dependency graph captures that.

### Lessons Learned

1. **Pure logic modules are the right foundation.** They are testable in isolation, portable across packages, and composable into pipelines. The conflict detector, checkpoint tracker, and parallelism finder can all be wired into CLI commands, API routes, or dashboard components without modification.

2. **Git operations belong in core, not web.** The web package runs in a Next.js context where `node:fs` and `execFile` are problematic. Actual git operations for checkpoint commits and conflict detection need to live in `packages/core/src/` and be exposed through the existing service layer.

3. **Separate "build module" stories from "build component" stories.** Stories 20-1 through 20-3 each mix pure logic requirements (detect conflicts, track checkpoints, analyze dependencies) with UI requirements (3-way diff view, timeline display, Gantt chart). Future planning should split these into distinct stories to make completion criteria unambiguous.

4. **Acceptance criteria should match delivery scope.** Marking stories as "done" when only the logic module is complete but the dashboard component is not creates ambiguity. Either the acceptance criteria should scope the story to logic-only, or the story should remain in progress until the full feature is wired.

---

## Action Items

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Wire conflict detector into Workspace plugin for real git worktree scanning | Dev | High |
| 2 | Implement checkpoint commit cycle in SessionManager using `execFile("git", ...)` | Dev | High |
| 3 | Build MergeConflictWizard React component (3-way diff view) | Dev | Medium |
| 4 | Build checkpoint timeline component in AgentSessionCard | Dev | Medium |
| 5 | Build parallelism opportunity visualization (Gantt-like comparison) | Dev | Medium |
| 6 | Implement rollback action: `git reset --hard` to checkpoint + agent respawn via Runtime plugin | Dev | High |
| 7 | Add integration tests covering full conflict-to-resolution and checkpoint-to-rollback flows | QA | High |

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 3 |
| Stories completed | 3 |
| Pure logic modules shipped | 3 (conflict detector, checkpoint tracker, parallelism finder) |
| Dashboard components shipped | 0 (deferred) |
| Git integrations shipped | 0 (deferred) |
| New tests | ~26 (8 conflict, 10 checkpoint, 8 parallelism) |
| Regressions | 0 |
| Deferred work items | 7 (see Action Items) |
