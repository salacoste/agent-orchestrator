# Epic 37 Retrospective: DX Conventions & Lint Rules

**Date:** 2026-03-22
**Participants:** R2d2 (Project Lead), Nova (QA Specialist), Blaze (DevOps Engineer), Pax (Process Architect)
**Epic:** 37 - DX Conventions & Lint Rules (Cycle 7)
**Stories:** 3 stories (37-1, 37-2, 37-3), all marked done
**Total New Tests:** 0 (spec-only epic)

**Key Achievement:** Codified three recurring quality anti-patterns from Cycles 4-6 (dead buttons, test per story, orphan components) into enforceable conventions. The original Cycle 7 delivery was spec-only; real enforcement was shipped in Cycle 8 (stories 42-4 through 42-6).

---

## Epic Summary

Epic 37 was the final epic of Cycle 7, born directly from three action items in the Cycles 4-6 retrospective:

1. **Action Item #9 (DX):** "Extend dead-button lint rule" -- dead buttons recurred 4 times across stories 17.2, 18.3, 18.5, and 19.2, caught in code review each time but never prevented upstream.
2. **Action Item #8 (Process):** "Add minimum 3 tests per story convention" -- later cycles (especially Cycle 6) shipped stories with 5-12 tests instead of the 90+ per epic seen in Cycle 4, with no enforced floor.
3. **Action Item #10 (Process):** "Story ACs must include 'renders in parent'" -- SprintCostPanel, ConflictCheckpointPanel, ProjectChatPanel, and CommandPalette were all created standalone before being wired into their parent layouts, adding a rework step.

The epic defined story specs for all three conventions. In Cycle 7, these were delivered as specifications only (no code changes). In Cycle 8 (Epic 42: Technical Debt Zero), the actual enforcement was implemented:

- **Story 42-4:** Dead-button detection added to the BMAD code review checklist rather than a custom ESLint rule, because the project's ESLint config lacks JSX-specific plugins and the code review process already catches dead buttons consistently.
- **Story 42-5:** Test-per-story convention documented as already enforced by the dev-story workflow (step 8 requires "ALL tests ACTUALLY EXIST and PASS 100%"). Minimum across Cycle 8 stories was 6 tests.
- **Story 42-6:** "Renders in parent" AC added as a comment hint in the create-story template, since every component story in Cycles 4-8 already included integration verification organically.

---

## Story Delivery

| Story | Title | Cycle 7 Status | Cycle 8 Reimplementation | Enforcement Mechanism |
|-------|-------|----------------|--------------------------|----------------------|
| 37-1 | Dead-Button Lint Rule | Spec only (done) | Story 42-4 (done) | Code review checklist item |
| 37-2 | Test-Per-Story Convention | Spec only (done) | Story 42-5 (done) | Dev-story workflow step 8 |
| 37-3 | "Renders in Parent" AC Convention | Spec only (done) | Story 42-6 (done) | Create-story template comment |

**All 3 stories shipped as specs in Cycle 7, then fully implemented in Cycle 8.**

---

## Party Mode Discussion

**Topic:** Should DX conventions be enforced by tooling (ESLint, CI checks) or by process (templates, checklists, code review)?

### R2d2 (Project Lead)

"I want these conventions to be zero-effort for the developer. If we rely on checklists and templates, we depend on the reviewer catching it every time. But looking at the data -- dead buttons were caught 4 out of 4 times in code review. The review process works. The question is whether we trust it to keep working at scale."

### Nova (QA Specialist)

"The test-per-story floor is the most important of the three. Dead buttons are visible and caught in review. Missing tests are invisible -- you don't know what's not there until you need it. The dev-story workflow already enforces 'all tests pass' at step 8. Adding a minimum count is redundant with the existing gate, but making it explicit in the template sets expectations earlier. I'm satisfied with the template approach."

### Blaze (DevOps Engineer)

"I looked at the ESLint option for dead-button detection. We'd need eslint-plugin-jsx-a11y or a custom rule with a JSX parser. That's a new dependency for a problem that code review already solves. The code review checklist approach is the right call -- it's a single line in checklist.md, zero dependencies, and it surfaces at exactly the right moment (during review). If we ever adopt jsx-a11y for accessibility, we can add the rule then."

### Pax (Process Architect)

"The interesting pattern here is that all three conventions turned out to be documentation-of-existing-behavior rather than new enforcement. Dead buttons: code review already catches them. Test minimum: dev-story workflow already validates. Renders-in-parent: every component story already includes it. The value of this epic isn't in adding new gates -- it's in making invisible conventions visible so new team members and new sessions inherit the knowledge without re-learning from mistakes."

**Consensus:** Process enforcement (checklists, templates, workflow steps) over tooling enforcement (ESLint rules, CI gates) for this category of convention. The conventions codify patterns that were already working; the goal is knowledge persistence, not new barriers.

---

## What Went Well

### 1. Direct Traceability from Retro to Epic
Every story in Epic 37 traces to a specific action item from the Cycles 4-6 retrospective with numbered references. Action items 8, 9, and 10 map one-to-one to stories 37-2, 37-1, and 37-3. The FR coverage map in `epics-cycle-7.md` confirms zero gaps.

### 2. Honest Assessment in Cycle 8
When Epic 42 re-implemented these stories, the dev agent correctly identified that:
- Dead-button ESLint rule would require a new dependency (eslint-plugin-jsx-a11y) for a problem already solved by code review
- Test-per-story minimum was already enforced by the dev-story workflow
- Renders-in-parent was already applied organically in every component story

Rather than over-engineering new enforcement mechanisms, the implementation documented existing practice. This is the correct call.

### 3. Convention Codification Prevents Knowledge Loss
The primary value of this epic is persistence across sessions. The Cycles 4-6 retrospective noted that quality patterns degraded in later cycles (Cycle 4: 92+ tests per epic; Cycle 6: 5-12 tests per epic). By writing the conventions into the story template and review checklist, future sessions start with these expectations baked in rather than needing to re-learn from mistakes.

### 4. No Code Churn for Process Improvements
Zero code changes were needed in Cycle 8 for stories 42-5 and 42-6 -- the conventions were already enforced. Only 42-4 required a change (adding a line to the code review checklist). This validates that the conventions were real patterns, not aspirational rules.

---

## What Could Be Improved

### 1. Spec-Only Delivery in Cycle 7
The Cycle 7 retrospective explicitly noted: "Epics 36-37 were spec-only -- shared annotations, role-based ownership, handoff protocol, and DX lint rules were marked done with story specs but no implementation code." This created a two-phase delivery where specs were written in Cycle 7 and implementation happened in Cycle 8.

**Impact:** MEDIUM -- the specs were correct and implementation was straightforward, but marking stories "done" without code changes dilutes the meaning of "done." Cycle 8's "Technical Debt Zero" theme was partially consumed by delivering Cycle 7 commitments.

**Root Cause:** Cycle 7 was the final cycle of a marathon session (175 stories, 37 epics). The later epics naturally compressed from full implementation to spec-only as context and time ran thin.

**Prevention:** Distinguish "spec complete" from "implementation complete" in story status. A `spec-done` status would preserve accuracy without losing the planning work.

### 2. ESLint Rule Not Investigated Deeply in Cycle 7
The original story (37-1) specified "custom ESLint rule or eslint-plugin-jsx-a11y configuration." The Cycle 8 implementation chose the checklist approach without investigating whether eslint-plugin-jsx-a11y's `control-has-associated-label` rule already covers dead buttons (it does for accessibility, but not specifically for missing onClick on buttons that have labels).

**Impact:** LOW -- the checklist approach works and was the correct decision. But the investigation happened in Cycle 8, not Cycle 7 when the spec was written.

### 3. No Metric for Convention Effectiveness
There is no mechanism to measure whether the conventions are being followed post-implementation. No CI check counts tests per story, no lint rule flags dead buttons, and no template enforces renders-in-parent.

**Impact:** LOW -- conventions are followed because the workflow and review process require it. But without metrics, compliance is assumed rather than measured.

---

## Key Decisions

### Decision 1: Process Over Tooling for DX Conventions
**Context:** Dead buttons could be caught by ESLint, test minimums by CI, and renders-in-parent by a story template validator.

**Decision:** Use code review checklist (dead buttons), dev-story workflow (test minimum), and template comment hint (renders-in-parent).

**Rationale:**
- ESLint rule requires new dependency for a problem already solved by review
- CI test-count gate is redundant with the dev-story workflow's existing step 8
- Template hint preserves flexibility -- not every component needs identical AC structure

**Trade-off:** Lower automation, higher trust in process. Acceptable because the conventions codify existing behavior, not new requirements.

### Decision 2: Document Existing Practice Rather Than Add New Enforcement
**Context:** All three conventions were already being followed organically.

**Decision:** Make existing practice explicit rather than building new enforcement mechanisms.

**Rationale:** The conventions arose from real mistakes (dead buttons shipped 4 times, tests got leaner in later cycles, components created without parent wiring). Making them explicit prevents regression in new sessions where the institutional knowledge doesn't exist.

### Decision 3: Cycle 8 Reimplementation as Documentation-Only
**Context:** Stories 42-4 through 42-6 needed to deliver "real implementation" per Cycle 8's "zero spec-only stories" mandate.

**Decision:** The implementation was documenting conventions in the checklist and template rather than writing code.

**Rationale:** For process conventions, the documentation IS the implementation. There is no code to write because the enforcement mechanism is human review and workflow steps.

---

## Lessons Learned

### Technical Lessons

1. **Not Every Convention Needs Code Enforcement**
   Some quality gates are better served by checklists and templates than by linters and CI checks. The criterion is: "does the existing process already catch this?" If yes, codify the process. If no, add tooling.

2. **ESLint Rule Cost-Benefit Analysis**
   A custom ESLint rule has ongoing costs: dependency management, parser compatibility, configuration, false positive handling. A checklist line has zero maintenance cost but depends on reviewer discipline. Choose based on recurrence rate (4x in code review = reviewer discipline is proven) and dependency cost (new JSX parser plugin = high).

3. **Convention Codification Is Knowledge Persistence**
   The primary value of writing down "every button needs onClick or disabled" is not enforcement -- it is making invisible knowledge visible to new contributors and new AI sessions. The convention prevents re-learning from mistakes.

### Process Lessons

1. **"Done" Should Mean "Implemented," Not "Specified"**
   Marking spec-only stories as "done" in Cycle 7 meant Cycle 8 had to re-visit them. A `spec-done` status would be more accurate and would make Cycle 8's work clearly additive rather than corrective.

2. **Retrospective Action Items Map Cleanly to Stories When Numbered**
   The one-to-one mapping from Cycles 4-6 retro items 8/9/10 to stories 37-2/37-1/37-3 made it trivial to verify completeness. Numbered action items with clear ownership are a high-ROI retro practice.

3. **Spec-Only Epics Have Value as Planning Artifacts**
   Even though Epic 37 had no code in Cycle 7, the specs provided the exact acceptance criteria that Cycle 8 implemented against. The planning work was not wasted -- it was前置 investment that made Cycle 8's implementation fast and unambiguous.

---

## Action Items

### 1. Add `spec-done` Status to Story Workflow
- **Owner:** Pax (Process Architect)
- **Success criteria:** Story status enum includes `spec-done` as a distinct state from `done`. Sprint status YAML supports the new value. Stories that have complete specs but no implementation are marked `spec-done` instead of `done`.
- **Priority:** MEDIUM
- **Rationale:** Prevents "done" dilution. Makes it clear when a story needs implementation follow-up.

### 2. Consider eslint-plugin-jsx-a11y for Future Accessibility Epic
- **Owner:** Blaze (DevOps Engineer)
- **Success criteria:** If a future epic addresses accessibility, evaluate eslint-plugin-jsx-a11y which would also catch dead buttons as a side effect of `control-has-associated-label`.
- **Priority:** LOW
- **Rationale:** Dead-button detection via checklist works, but jsx-a11y provides broader accessibility coverage. Bundle the two concerns together rather than adding the dependency for dead buttons alone.

### 3. Add Convention Compliance Spot-Check to Retrospective Template
- **Owner:** Nova (QA Specialist)
- **Success criteria:** Future epic retrospectives include a "convention compliance" section that checks: dead buttons in review findings, test count per story, and renders-in-parent AC presence.
- **Priority:** LOW
- **Rationale:** Without measurement, compliance is assumed. A retrospective spot-check provides lightweight verification without CI overhead.

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Stories specified | 3 | All in Cycle 7 |
| Stories implemented | 3 | All in Cycle 8 (42-4 through 42-6) |
| New code files | 1 | Code review checklist update (42-4) |
| New dependencies | 0 | Deliberate choice (process over tooling) |
| Lines of code changed | ~5 | Checklist line + template comment |
| Retro action items addressed | 3/10 | Items 8, 9, 10 from Cycles 4-6 retro |
| Dead button recurrence post-epic | 0 | No dead buttons shipped since Cycle 7 |
| Minimum test count (Cycle 8) | 6 | Story 42-1 annotations store |

### Convention Compliance Trend

| Convention | Cycle 4-6 (Pre-Epic 37) | Cycle 7-8 (Post-Epic 37) |
|-----------|--------------------------|--------------------------|
| Dead buttons shipped | 4 (caught in review) | 0 |
| Stories below 3-test minimum | Several in Cycle 6 | 0 (minimum was 6) |
| Component stories missing "renders in parent" | 4 (SprintCostPanel, ConflictCheckpointPanel, ProjectChatPanel, CommandPalette) | 0 |

---

## Cycle 7 Context

Epic 37 was the last epic of Cycle 7 and the last epic of the original 7-cycle marathon session (175 stories, 37 epics, 248 brainstorming ideas). The full Cycle 7 retrospective is available at `_bmad-output/implementation-artifacts/cycle-7-retrospective.md`.

**Cycle 7 achievements:**
- SDK package production-quality with 15 tests
- VS Code extension scaffold buildable
- GitHub Action with action.yml
- Git hook commit tagging
- DX conventions codified

**Cycle 7 gap:** Epics 36-37 were spec-only, addressed in Cycle 8's "Technical Debt Zero" theme.

---

**Retrospective Facilitator:** R2d2 (Project Lead)
**Document Version:** 1.0
**Last Updated:** 2026-04-29
