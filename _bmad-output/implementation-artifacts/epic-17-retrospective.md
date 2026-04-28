# Epic 17 Retrospective — Workflow Dashboard Experience

**Date**: 2026-04-28
**Epic**: 17 — Workflow Dashboard Experience
**Status**: Complete (all 5 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 17 delivered the user-facing workflow dashboard experience: visual position awareness ("You Are Here"), one-click next-step recommendations, a deterministic recommendation engine derived from state machine graph traversal, phase readiness scoring with specific gap listings, and transparent reasoning display for every recommendation. Together, these stories transformed the workflow dashboard from a passive data display into an active guide that tells PMs exactly where they are, what to do next, and why.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 17-1 | "You Are Here" Phase Pipeline Component | Done |
| 17-2 | "Next Step" Recommendation Launcher | Done |
| 17-3 | Deterministic Recommendation Engine | Done |
| 17-4 | Phase Readiness Scoring | Done |
| 17-5 | Recommendation Reasoning Display | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — vision, outcomes, quality
- Nova (Architect) — architecture, design patterns
- Blaze (Dev) — implementation, pain points
- Pax (QA) — testing, quality gates

---

### What Went Well

**R2d2:** The visual storytelling arc is strong. Story 17-1's "You Are Here" badge with `animate-pulse` and progress-filled connectors delivered high visual impact with minimal CSS changes — exactly the kind of enhancement that makes the dashboard immediately useful to a PM scanning the page. The `connectorColor()` function is a clean piece of pure logic: done-to-done and done-to-active connectors get the success color, everything else stays muted.

**Nova:** The architectural progression is exactly right. Story 17-3 is the keystone: instead of bolting an AI layer onto recommendations, we built a deterministic engine that traverses the state machine from Epic 16. `getStateMachineRecommendation()` takes artifacts and a state machine, finds the active phase, calls `getTransitionReadiness()`, and returns a recommendation from the first unsatisfied guard. Same input always produces the same output. No AI, no ambiguity, no flakiness. This is the graph-traversal insight from the brainstorming session made real.

**Blaze:** The action mapping pattern from 17-2 is elegant. `RECOMMENDATION_ACTIONS` is a `Record<Phase, { label, description }>` constant that maps each phase to an imperative-verb CTA label: "Create Brief", "Create PRD", "Design Architecture", "Start Sprint". This makes the CTA button data-driven rather than hardcoded conditionals. The `getRecommendationAction()` function is exported for testability, and the tests use `it.each` to cover all 4 phases cleanly.

**Pax:** Test discipline held up well. Story 17-1 added 6 new/updated tests (25 total for WorkflowPhaseBar, up from 19). Story 17-2 added 7 new tests plus updated 1 for aria-hidden count changes, reaching 24 total AI Guide tests. The build stayed green at 885 tests after 17-1 and 893 tests after 17-2. The `<details>/<summary>` pattern chosen for 17-5's reasoning display is brilliant from a QA perspective — zero JavaScript for expand/collapse, built-in keyboard accessibility, and no external dependencies.

**Nova:** The backward compatibility approach in 17-4 deserves mention. The WorkflowResponse contract was frozen (WD-4), so readiness data was added as an optional field: `readiness?: TransitionReadiness[]`. This maintains the existing contract while enabling new functionality. Consumers that don't request readiness are unaffected.

**R2d2:** The progressive disclosure pattern in 17-5 is exactly right. Reasoning is collapsed by default — you see just the recommendation text. Click "Show reasoning" and you get the full guard checklist with pass/fail indicators. This respects the PM's attention: detail on demand, not detail by default.

### What Could Be Improved

**Blaze:** The dead button problem in 17-2. The CTA button was rendered with a label and styling but initially had no `onClick` handler. A green button that does nothing when clicked actively damages user trust. This was caught in code review and fixed with scroll-to-phase-bar behavior, but it should never have reached review. This same pattern recurred in Epics 18 and 19 (3 total occurrences across the cycle).

**Nova:** Navigation and dropdown were deferred in 17-2. The button is CTA-ready but clicking it currently just scrolls. Full router integration for navigating to the relevant workflow section, and a dropdown for multiple available transitions, both need state machine and router integration that wasn't available at implementation time. This is technical debt that should be tracked.

**Pax:** Stories 17-3, 17-4, and 17-5 lack completed Dev Agent Records — the `agent_model_name_version`, debug log, completion notes, and file list sections are still templated. This makes it harder to audit exactly what was changed. Stories 17-1 and 17-2 have thorough records; the later stories should match that standard.

**Blaze:** The `WorkflowResponse` frozen contract constraint (WD-4) forced an optional field approach for readiness. While backward compatible, it means consumers must check for the field's existence before using it. A separate endpoint or response type could have been cleaner, but the optional field was the pragmatic choice given the constraint.

**R2d2:** Visual browser validation was deferred in 17-1 (Task 5.3) due to no dev server in CI. All the visual enhancements — the badge, pulse animation, connector colors — were only verified through unit tests and build checks, not actual browser rendering. This is a gap that should be closed when the dev server is available.

### Key Decisions

1. **Keep old 7-rule engine alongside new state-machine engine** (Story 17-3): Rather than replacing the existing `getRecommendation()` function (487 lines of tests), `getStateMachineRecommendation()` was added alongside it. Fallback chain: try state machine first, fall back to legacy. Zero test breakage, incremental migration path.

2. **Data-driven action mapping via constants** (Story 17-2): CTA button labels come from `RECOMMENDATION_ACTIONS` constant, not inline conditionals. This is the same "rules as data" pattern used in the recommendation engine and anti-pattern rules (Epic 18). Consistent architecture across the codebase.

3. **`<details>/<summary>` for reasoning display** (Story 17-5): Native HTML elements provide expand/collapse with zero JavaScript, built-in keyboard accessibility, and no external dependencies. Progressive disclosure without React state management overhead.

4. **Optional field for frozen API contract** (Story 17-4): Readiness added as `readiness?: TransitionReadiness[]` to maintain backward compatibility with WD-4 frozen contract. Pragmatic choice over a separate endpoint.

5. **Enhance, don't rebuild** (Story 17-1): The existing `WorkflowPhaseBar` component was modified in place rather than rebuilt. New visual elements (badge, connector colors, pulse) were layered onto the existing structure, preserving all 23 original tests and accessibility features.

### Lessons Learned

1. **Every button MUST have an onClick handler or be disabled.** Dead buttons damage user trust and recurred 3 times across the cycle (17-2, 18-3, 18-5). Consider adding an ESLint rule or code review checklist item to catch this.

2. **Frozen API contracts need optional fields for extension, not breaking changes.** The WD-4 constraint forced a disciplined approach to API evolution. When extending frozen types, optional fields with runtime guards are the correct pattern.

3. **Deterministic recommendation engines built on graph traversal outperform rule-based systems.** The state machine approach in 17-3 produces recommendations that are testable, reproducible, and explainable. The same input always yields the same output. This is a foundational pattern for any "intelligent" system that needs to be reliable.

4. **Progressive disclosure using native HTML elements is superior to JavaScript-driven solutions.** The `<details>/<summary>` pattern in 17-5 eliminated the need for React state, event handlers, and accessibility ARIA attributes for expand/collapse. Less code, fewer bugs, better accessibility.

5. **Data-driven constants enable clean testability.** `RECOMMENDATION_ACTIONS` and `getRecommendationAction()` are separate from the component, enabling `it.each` test coverage across all phases without rendering the full component.

6. **Enhancement stories should specify "modify existing" explicitly.** Story 17-1's dev notes correctly stated "CRITICAL: This is a MODIFICATION of an existing, well-tested component" with explicit "What NOT to Touch" guidance. This prevented over-scoping and preserved existing test coverage.

---

## Action Items

| # | Action Item | Priority |
|---|------------|----------|
| 1 | Wire CTA button onClick to actual navigation (router integration) | High |
| 2 | Add dropdown for multiple available transitions in recommendation launcher | Medium |
| 3 | Complete Dev Agent Records for stories 17-3, 17-4, 17-5 (file lists, completion notes) | Medium |
| 4 | Conduct visual browser validation for phase bar enhancements (badge, pulse, connectors) | Medium |
| 5 | Add ESLint rule: all `<button>` elements require onClick or disabled prop | High |
| 6 | Integrate state-machine recommendation engine as primary, legacy as fallback in API route | High |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5 |
| Stories deferred/partial | 0 (2 sub-tasks deferred: navigation, dropdown in 17-2) |
| New tests added | ~18 (6 in 17-1, 8 in 17-2, plus tests in 17-3/17-4/17-5) |
| Build status | Green throughout |
| Regressions | 0 |
| Components modified | 2 (WorkflowPhaseBar, WorkflowAIGuide) |
| New functions/modules | 3 (getStateMachineRecommendation, getRecommendationAction, readiness display) |
| Accessibility features added | aria-current="step", sr-only "you are here", details/summary keyboard nav |
| Deferred items | 2 (button navigation, transition dropdown — both need router/SM integration) |
