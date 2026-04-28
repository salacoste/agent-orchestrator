# Epic 36 Retrospective -- Collaboration Production Features

**Date**: 2026-04-29
**Epic**: 36 -- Collaboration Production Features
**Status**: Done (all 3 stories marked done)
**Source**: Cycle 7 (10 retro action items from Cycles 4-6)
**FRs**: Retro items 5 (Annotation UI), 6 (Role-Based Ownership), 7 (Handoff Protocol)
**Depends on**: Epic 33 (spec-only types from Cycle 6)

## Epic Summary

Epic 36 was the first attempt to wire the collaboration types from Epic 33 into user-facing production features: an annotation UI component for in-context commenting on artifacts, a role-based agent ownership display for fleet accountability, and a handoff protocol enabling follow-the-sun development. All three stories were marked done in Cycle 7, but the delivery was lean -- story files contain only a status marker with no implementation details, no test counts, and no file lists.

The Cycle 7 retrospective explicitly identified the gap: "Epics 36-37 were spec-only -- shared annotations, role-based ownership, handoff protocol, and DX lint rules were marked done with story specs but no implementation code." The actual production implementations landed in Cycle 8:

- **Epic 39** (Stories 39.1, 39.2): SSE broadcasting for real-time collaboration events and JSONL persistence. This is the transport and persistence layer that makes annotations and ownership changes visible to other users.
- **Epic 42** (Stories 42.1, 42.2, 42.3): Detailed `ready-for-dev` specs with full task breakdowns, interface definitions, file lists, and architecture constraints. Story 42.3 additionally delivered the `handoff.ts` module with `createHandoff()`, `serializeHandoff()`, and `deserializeHandoff()`.

Epic 36's contribution was the initial story definitions that became the 42.x specs. It served as a planning bridge between the type-only work of Epic 33 and the full implementations of Epics 39 and 42.

## Story Delivery

| Story | Title | Status | Actual Delivery |
|-------|-------|--------|-----------------|
| 36-1 | Shared Annotation UI Component | Done | Story definition only. Detailed spec created in Story 42.1 with `ArtifactAnnotation` component design, `addAnnotation()`/`getAnnotations()` functions, and test plan. Annotations now in `collaboration.ts`, broadcasting via 39.1, persistence via 39.2. |
| 36-2 | Role-Based Agent Ownership UI | Done | Story definition only. Detailed spec created in Story 42.2 with `AgentOwner` interface, `OwnerBadge` component design, `assignOwner()`/`removeOwner()`/`getAgentsByOwner()` functions. Ownership store now in `collaboration.ts`. |
| 36-3 | Handoff Protocol Implementation | Done | Story definition only. Detailed spec created in Story 42.3 with `HandoffBundle` interface. Full implementation in `packages/web/src/lib/workflow/handoff.ts` with `createHandoff()`, `applyHandoff()`, `serializeHandoff()`, `deserializeHandoff()`. |

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- vision, outcomes, quality
- Nova (Architect) -- architecture, design patterns
- Blaze (Dev) -- implementation, pain points
- Pax (QA) -- testing, quality gates

---

### What Went Well

**R2d2:** Epic 36 correctly identified the three collaboration features that needed production wiring -- annotations, ownership, and handoffs. The story definitions from 36-1 through 36-3 became the seeds for the 42.x specs, which were thorough and implementation-ready. The Epic 36 stories also defined the right acceptance criteria: click-to-annotate on artifacts, owner avatars on fleet cards, handoff button packaging agent state. Those ACs survived intact through two additional cycles and guided the real implementations.

**Nova:** The three stories map cleanly to the collaboration module's architecture. Annotations extend the existing decision-log pattern (another item type stored alongside presence, claims, and decisions). Ownership adds a new Map keyed by agentId with broadcasting on changes. Handoffs are a read operation -- snapshot the collaboration state into a serializable bundle. Each feature fits the established module-level-state + broadcasting + JSONL persistence pattern without requiring architectural changes.

**Blaze:** The fact that 42.3 (handoff) was implemented as a pure module (`handoff.ts`) separate from the main `collaboration.ts` shows good separation of concerns. Handoff reads from collaboration state but doesn't modify it. The `serializeHandoff()` / `deserializeHandoff()` pattern for JSON transfer is simple and testable. This module structure was implied by the 36-3 story definition even though the story itself didn't specify it.

**Pax:** The acceptance criteria from Epic 36 are testable: "a comment input appears inline," "each agent shows its owner's avatar and name," "system captures agent states, pending decisions, context summary." These are concrete, observable behaviors. The 42.x specs built on these ACs with explicit test subtasks (annotation store CRUD, OwnerBadge rendering, handoff creation and serialization).

---

### What Could Be Improved

**R2d2:** The same problem as Epic 33: stories marked "done" without meeting acceptance criteria. Story 36-1 says "I click the annotation icon, a comment input appears inline, submitted comments are stored and visible to other users." None of that was working after Cycle 7. The Cycle 7 retro caught this ("Epics 36-37 were spec-only"), but marking stories done when they are definitions, not implementations, creates a false sense of progress. This happened in consecutive cycles (33 and 36) for the same collaboration feature set.

**Nova:** Epic 36 had no dependency on the collaboration broadcasting infrastructure (SSE, JSONL persistence) that was built in Epic 39. The ACs for 36-1 explicitly say "submitted comments are stored and visible to other users" -- this requires real-time transport and persistence, which didn't exist in Cycle 7. The story definitions should have been blocked on Epic 39 or the ACs should have been scoped to local-only storage as an MVP.

**Blaze:** The story files for 36-1, 36-2, and 36-3 contain only `# Story: {title}` and `Status: done`. No implementation notes, no file lists, no test counts, no dev agent records. Compare this to the 42.x specs which have full task breakdowns, architecture constraints, file-to-create lists, and test plans. The 36.x files are placeholder artifacts, not engineering records. This makes it impossible to audit what was actually delivered.

**Pax:** Zero tests traceable to Epic 36. The 15 tests in `collaboration-service.test.ts` belong to Epic 33. The ~30 collaboration tests (broadcasting, store, annotations, ownership, handoff) belong to Epics 39 and 42. Epic 36 has no test artifacts of its own. For a cycle that was supposed to deliver production features, this is a significant gap.

---

### Key Decisions

1. **Story definitions as planning artifacts, not implementation milestones.** Epic 36's primary output was story definitions that seeded the Epic 42 specs. This was an implicit decision -- the stories were created and marked done as definitions rather than implementations. The explicit acknowledgment came later in the Cycle 7 retrospective.

2. **No scoping of ACs to available infrastructure.** The ACs describe fully wired features (real-time visibility, stored comments, handoff packages) that required SSE broadcasting and JSONL persistence from Epic 39. Acceptance criteria should be scoped to the infrastructure available in the current cycle or explicitly blocked on dependencies.

3. **Re-derivation rather than dependency tracking.** Epic 36 did not reference Epic 33's type definitions as a prerequisite, nor Epic 39's broadcasting infrastructure as a blocker. The stories were created fresh in Cycle 7 without cross-epic dependency notation. This is a process gap -- the planning pipeline should track which stories build on prior epic outputs.

4. **Cycle 8 as the true completion cycle.** The collaboration production features were actually delivered across Epics 39 (transport + persistence) and 42 (specs + handoff module). Epic 36 served as a planning placeholder that ensured the feature set was tracked in the sprint status.

---

### Lessons Learned

1. **"Spec-only" stories need a distinct status.** Stories that produce definitions or specs but not running code should have a status like "spec-done" rather than "done." The project encountered this pattern repeatedly (Epics 31, 33, 36, 37) and the Cycle 7 retro identified it each time. A two-tier status would make sprint velocity metrics more accurate and prevent false confidence.

2. **Acceptance criteria must match infrastructure reality.** ACs that describe real-time features ("other team members see annotations in real-time") are misleading when no transport layer exists. Either scope the ACs to what is buildable in the current cycle or make the infrastructure dependency explicit in the story definition.

3. **Story files should capture what was actually delivered.** Empty story files with just `Status: done` provide no audit trail. At minimum, the file should list: what was created, what was deferred, and why the story is marked done. The 42.x story files demonstrate the right format -- task breakdowns, file lists, architecture constraints, and test plans.

4. **Cross-cycle feature arcs need a tracking label.** The collaboration feature went through Epic 33 (types) -> Epic 36 (definitions) -> Epic 39 (infrastructure) -> Epic 42 (implementation). This 4-cycle arc for a single feature set is difficult to track without a cross-epic label or tag. A `feature:collaboration` tag on all related stories would make it easier to assess true feature completion.

5. **Lean story definitions are acceptable as planning milestones if labeled as such.** Epic 36's story definitions were useful -- they identified the three features, wrote acceptance criteria, and mapped them to retro action items. The problem is not the definitions themselves but the mismatch between the "done" status and what was delivered. Planning milestones are valuable; they just need honest labeling.

---

## Action Items

| # | Action Item | Priority | Status |
|---|------------|----------|--------|
| 1 | Implement `ArtifactAnnotation` React component per 42.1 spec | High | Spec ready in 42-1 |
| 2 | Implement `OwnerBadge` React component per 42.2 spec | High | Spec ready in 42-2 |
| 3 | Complete `handoff.ts` test suite per 42.3 spec | High | Module exists in 42-3 |
| 4 | Add "spec-only" vs "full implementation" distinction to story workflow | Process | Not started |
| 5 | Add cross-epic feature tags to sprint status tracking | Process | Not started |
| 6 | Scope ACs to available infrastructure before marking stories done | Process | Not started |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 3 (all marked done as definitions) |
| Stories meeting full ACs | 0 (UI components, transport, persistence not built in this epic) |
| New tests added | 0 |
| New modules created | 0 |
| New types defined | 0 (types from Epic 33) |
| Story files with implementation details | 0 of 3 |
| Follow-up epics required | 2 (Epic 39: infrastructure, Epic 42: specs + handoff) |
| Cycles from definition to implementation | 2 (Cycle 7 definitions -> Cycle 8 delivery) |
| Build status | Green throughout |
| Regressions | 0 |

---

R2d2 (Project Lead): "Epic 36 is the second iteration of the 'types done is not feature done' pattern, following Epic 33. The difference is that by Cycle 7, the team recognized the pattern explicitly in the retrospective. The story definitions were useful planning artifacts -- they identified the right features with the right acceptance criteria. But the 'done' status was premature. The honest assessment is that Epic 36 was a planning epic that ensured collaboration features stayed on the roadmap. The actual production work landed in Epics 39 and 42."
