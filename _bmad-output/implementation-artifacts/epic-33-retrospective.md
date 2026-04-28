# Epic 33 Retrospective -- Multi-User Collaboration v2

**Date**: 2026-04-29
**Epic**: 33 -- Multi-User Collaboration v2
**Status**: Done (all 4 stories marked done)
**Source**: Cycle 6 (deferred features from Cycle 5 MVP)
**FRs**: Brainstorm #113 (Shared Annotations), #114 (Role-Based Ownership), #116 (Handoff Protocol)

## Epic Summary

Epic 33 was positioned as the "deferred collaboration features" from the Cycle 5 MVP -- shared annotations on artifacts, role-based agent ownership, handoff protocol for follow-the-sun development, and an integration test tying them together. All four stories were marked done in Cycle 6. However, as the Cycles 4-5-6 retrospective explicitly noted, "Epic 33 implementation is types/interfaces only -- actual shared annotation, role-based ownership, handoff protocol need real platform work."

What shipped in Cycle 6 were TypeScript interfaces and pure-function stubs in `packages/core/src/collaboration-service.ts`: `StoryDependency`, `HandoffRecord`, `FileConflict`, `CollabGraphEntry` types, plus `getReadyStories()`, `buildHandoffContext()`, `detectFileConflicts()`, and `buildCollabGraph()` functions. These are foundational building blocks, but they are not the user-facing features described in the story acceptance criteria.

The actual collaboration platform work landed in later cycles:
- **Epic 36** (Cycle 7): First attempt at annotation UI, ownership UI, and handoff implementation -- stories marked done but remain lean.
- **Epic 39** (Cycle 8): SSE broadcasting for real-time collaboration updates and JSONL persistence -- fully implemented with 12+9 tests, integrated into the SSE event route and file-based persistence layer.
- **Epic 42** (Cycle 8): Detailed specs for annotation UI component, role-based ownership UI, and handoff protocol -- created as `ready-for-dev` specs with full task breakdowns. Handoff module (`packages/web/src/lib/workflow/handoff.ts`) was implemented here with `createHandoff()`, `serializeHandoff()`, `deserializeHandoff()`.

The collaboration module in `packages/web/src/lib/workflow/collaboration.ts` now contains the full stack: team presence (Story 27.1), review claims (Story 27.2), decision log (Story 27.3), shared annotations (Story 42.1), agent ownership (Story 42.2), and change broadcasting (Story 39.1). Epic 33 contributed the type definitions and dependency-aware scheduling logic that these later stories built upon.

## Story Delivery

| Story | Title | Status | Actual Delivery |
|-------|-------|--------|-----------------|
| 33-1 | Shared Annotations on Artifacts | Done | Types only. Annotation UI + store implemented in Stories 42.1, 39.1, 39.2. `Annotation` interface, `addAnnotation()`, `getAnnotations()` now in collaboration.ts. |
| 33-2 | Role-Based Agent Ownership | Done | Types only. Ownership store + `OwnerBadge` component spec created in Story 42.2. `AgentOwner` interface, `assignOwner()`, `removeOwner()`, `getAgentsByOwner()` now in collaboration.ts. |
| 33-3 | Handoff Protocol | Done | Types only. `HandoffRecord` type in core; full `HandoffBundle` + `createHandoff()`/`serializeHandoff()`/`deserializeHandoff()` implemented in Story 42.3 (handoff.ts). |
| 33-4 | Collaboration Integration Test | Done | Core-level tests for dependency scheduling, context sharing, file conflict detection, and collab graph (15 tests in `collaboration-service.test.ts`). No end-to-end multi-user integration test covering presence + claims + annotations + handoffs together. |

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- vision, outcomes, quality
- Nova (Architect) -- architecture, design patterns
- Blaze (Dev) -- implementation, pain points
- Pax (QA) -- testing, quality gates

---

### What Went Well

**R2d2:** The type-first approach gave later cycles a clean foundation. The `StoryDependency`, `HandoffRecord`, `FileConflict`, and `CollabGraphEntry` interfaces in `collaboration-service.ts` have stable, well-defined shapes. When Epic 39 and 42 came along to build the real platform, the type contracts were already settled -- no renegotiation of data models. The `getReadyStories()` function with its dependency-chain resolution (diamond dependencies, empty deps, partial completion) has real test coverage with edge cases.

**Nova:** The separation between core types and web-level collaboration state was the right call. `packages/core/src/collaboration-service.ts` handles dependency scheduling -- a concern that belongs at the orchestration layer. `packages/web/src/lib/workflow/collaboration.ts` handles the dashboard collaboration state -- presence, claims, decisions, annotations, ownership. These are different abstraction levels and keeping them separate avoided coupling the orchestration engine to the web UI. The `CollaborationEvent` discriminated union (added in 39.1) cleanly models the 5 event types with a `type` discriminant.

**Blaze:** The `detectFileConflicts()` function is genuinely useful -- it takes a `Map<string, SessionLearning>` and does an N-squared comparison of `filesModified` arrays across agents, returning `FileConflict[]` objects with both agent IDs and story IDs. This is the advisory locking primitive the system needs to prevent two agents from silently clobbering the same file. The O(n^2) complexity is fine for the fleet sizes we run (typically 3-7 agents).

**Pax:** The 15 tests in `collaboration-service.test.ts` cover the right edge cases: diamond dependencies, empty dependency lists, single-agent no-conflict scenarios, empty file lists producing "no files tracked" context strings. The `buildCollabGraph()` tests verify that status transitions work correctly: completed deps produce "active", unmet deps produce "waiting", no assigned agent produces "blocked".

### What Could Be Improved

**R2d2:** The biggest issue is the gap between story acceptance criteria and what was actually delivered. Story 33-1 says "I can leave a comment tied to a specific section" and "other team members see annotations in real-time." What shipped were types. Story 33-2 says "dashboard shows: R2d2's agents: stories 1-1, 1-3 (2 running)." What shipped were types. Marking these as "done" without meeting the acceptance criteria is misleading. The Cycles 4-5-6 retro caught this, but it should have been caught at story completion time.

**Nova:** The `HandoffRecord` type in `collaboration-service.ts` and the `HandoffBundle` type in `handoff.ts` have different shapes. The core-level `HandoffRecord` is a per-story completion record (`fromStoryId`, `filesModified`, `completedAt`). The web-level `HandoffBundle` is a full state snapshot (`sender`, `recipient`, `decisions`, `claims`, `annotations`, `owners`). These serve different purposes but share the "handoff" name, which could confuse future developers. A clearer naming distinction would help.

**Blaze:** Story 33-4 was supposed to be an end-to-end integration test covering "2 users, team presence, claim review, annotate artifact, handoff." What exists is unit tests for dependency scheduling. The acceptance criteria explicitly state "all features work together without conflicts" -- this was never tested. The collaboration module's `_resetCollaboration()` function exists for test isolation, which is good infrastructure, but no test actually simulates the multi-user workflow the story describes.

**Pax:** The collaboration module in `collaboration.ts` uses module-level mutable state (Maps, arrays). This is the established pattern and works fine for a single-server dashboard. But it means the integration test from 33-4 would need to simulate multiple "users" calling functions in sequence, not concurrent HTTP requests to different server instances. The in-memory design makes true multi-user integration testing difficult without mocking.

### Key Decisions

1. **Type-first delivery in Cycle 6, platform delivery in later cycles**: Epic 33 defined interfaces and pure functions. Epic 36 attempted UI components. Epics 39 and 42 delivered the real platform (broadcasting, persistence, handoff serialization). This phased approach worked because the types were stable, but it required 3 additional cycles to close the gap.

2. **Core types separate from web collaboration module**: `packages/core/src/collaboration-service.ts` handles orchestration concerns (dependency scheduling, conflict detection). `packages/web/src/lib/workflow/collaboration.ts` handles dashboard concerns (presence, claims, annotations, ownership). Different layers, different responsibilities.

3. **Annotations reuse collaboration broadcasting infrastructure**: Rather than building a separate annotation persistence system, Story 42.1 added `addAnnotation()`/`getAnnotations()` to the existing collaboration module, broadcasting `CollaborationEvent` with `type: "annotation"`. This leveraged the 39.1 subscriber system and 39.2 JSONL persistence for free.

4. **Handoff as serializable snapshot, not incremental**: The `HandoffBundle` in `handoff.ts` captures the full collaboration state at a point in time (all decisions, claims, annotations, owners). This is simpler than an incremental event-sourcing approach and sufficient for the follow-the-sun use case where one person hands off to another.

5. **No real-time transport layer in Epic 33**: The acceptance criteria mention "other team members see annotations in real-time," but no WebSocket or SSE transport was built in Cycle 6. This was deferred to Epic 39 (Story 39.1), which added SSE broadcasting via the existing `/api/events` route.

### Lessons Learned

1. **Story "done" must mean acceptance criteria met, not types defined.** Epic 33's stories were marked done with type definitions and pure functions, but the ACs described user-facing features (clicking to annotate, seeing "R2d2's agents: stories 1-1, 1-3", packaging agent context for handoff). The Cycles 4-5-6 retro correctly identified this gap. Action: distinguish "spec + types" stories from "full implementation" stories in planning, and do not mark the former as done.

2. **Deferred features from earlier cycles carry design debt.** Epic 33 was explicitly "deferred from Cycle 5 MVP." When features are deferred, the ACs and implementation scope need re-evaluation -- the Cycle 5 ACs may not match the Cycle 6 technical context. The ACs for 33-1 through 33-3 describe a fully wired dashboard, but Cycle 6 was already leaner than Cycle 4 (the retro noted decreasing spec depth and test counts in later cycles).

3. **Type-first development works when types are genuinely consumed.** The `StoryDependency`, `FileConflict`, and `CollabGraphEntry` types from `collaboration-service.ts` are used by tests and could be consumed by a CLI command or API route. This is valuable. The pattern breaks down when types are defined but nothing imports them -- always verify that types have at least one consumer.

4. **Phased delivery across cycles needs a tracking mechanism.** Epic 33 (types) -> Epic 36 (first UI attempt) -> Epic 39 (broadcasting + persistence) -> Epic 42 (spec + handoff implementation) is a 4-cycle arc. Without a cross-epic dependency tracker, it is easy to lose sight of what "done" means for the original feature request.

5. **The collaboration module's pure-function, module-level-state pattern is a good foundation.** `collaboration.ts` grew from 3 sections (presence, claims, decisions) to 6 (annotations, ownership, broadcasting) plus a reset function, all in one file. The pattern is simple, testable, and extensible. Each new section follows the same structure: interface definition, module-level Map/array, CRUD functions, notify calls, reset cleanup.

---

## Action Items

| # | Action Item | Priority | Status |
|---|------------|----------|--------|
| 1 | Write the missing end-to-end integration test from Story 33-4 (2 users, presence, claims, annotations, handoff) | High | Not started |
| 2 | Reconcile `HandoffRecord` (core) vs `HandoffBundle` (web) naming to prevent confusion | Medium | Not started |
| 3 | Implement `ArtifactAnnotation` React component from Story 42.1 spec | Medium | Spec ready |
| 4 | Implement `OwnerBadge` React component from Story 42.2 spec | Medium | Spec ready |
| 5 | Verify all types from `collaboration-service.ts` have at least one consumer | Low | Not started |
| 6 | Add "spec-only" vs "full implementation" label to story templates | Process | Not started |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4 (all marked done) |
| Stories meeting full ACs | 0 (types/interfaces only; platform work deferred to Epics 36, 39, 42) |
| New types defined | 4 (`StoryDependency`, `HandoffRecord`, `FileConflict`, `CollabGraphEntry`) |
| New pure functions | 4 (`getReadyStories`, `buildHandoffContext`, `detectFileConflicts`, `buildCollabGraph`) |
| Tests in core collaboration service | 15 |
| Follow-up epics required | 3 (Epic 36: UI attempt, Epic 39: broadcasting + persistence, Epic 42: full specs) |
| Tests added in follow-up stories | ~30 (12 broadcasting + 9 store + annotations + ownership + handoff) |
| Total collaboration module sections | 6 (presence, claims, decisions, annotations, ownership, broadcasting) |
| Build status | Green throughout |
| Regressions | 0 |

---

R2d2 (Project Lead): "Epic 33 is the clearest case study in the project for why 'types done' is not 'feature done.' The types and scheduling logic are solid and became the foundation for everything that followed. But we should have labeled these stories as 'spec + types' and kept them in a different status until the platform work shipped. The lessons here apply to every future epic that defers implementation."
