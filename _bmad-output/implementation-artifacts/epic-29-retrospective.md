# Epic 29 Retrospective -- Accessibility & Inclusive Design

**Date**: 2026-04-29
**Epic**: 29 -- Accessibility & Inclusive Design
**Status**: Complete (all 4 stories done)
**Source**: Cycle 6 (epics-cycle-6.md)
**FRs covered**: Brainstorm #151 (Screen Reader), #153 (High Contrast), #154 (Reduced Motion), WCAG Audit

## Epic Summary

Epic 29 delivered the accessibility foundation for the Agent Orchestrator dashboard. Four stories produced a single consolidated module (`accessibility.ts`) containing screen reader status helpers with natural language descriptions, a high contrast shape system mapping status values to distinct geometric symbols, reduced motion detection via `prefers-reduced-motion` media query, and WCAG AA compliance validators for ARIA attributes. All four stories shipped as pure functions with zero external dependencies and zero framework coupling -- the module provides utilities that any dashboard component can consume without importing React, Next.js, or CSS framework specifics.

The module follows the established "pure logic first, UI integration second" pattern from earlier cycles. Components import `getAgentStatusDescription()` for aria-label generation, `getStatusShape()` for high contrast rendering, `getAnimationClass()` for motion-aware styling, and `validateAriaAttributes()` for runtime compliance checking. The WCAG contrast ratio constant (`4.5:1` for AA) is exported for use in theme validation.

## Story Delivery

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| 29-1 | Screen Reader-First Agent Status | Done | `getAgentStatusDescription()` generates natural language status (e.g., "Agent agent-3, working on story 1-5, status blocked, for 45 minutes"). `getStatusChangeAnnouncement()` produces live region text for aria-live containers. Handles null storyId gracefully. |
| 29-2 | High Contrast Mode | Done | `STATUS_SHAPES` maps 5 statuses to geometric shapes: circle=working, square=blocked, triangle=completed, diamond=idle, cross=error. Each entry includes a screen reader label. `getStatusShape()` returns fallback circle for unknown statuses. |
| 29-3 | Reduced Motion Toggle | Done | `prefersReducedMotion()` reads `window.matchMedia("(prefers-reduced-motion: reduce)")`. SSR-safe (returns false when `window` is undefined). `getAnimationClass()` swaps CSS class based on preference. |
| 29-4 | Accessibility Audit & WCAG Compliance | Done | `WCAG_AA_CONTRAST_RATIO = 4.5` constant for theme validation. `validateAriaAttributes()` checks interactive elements for required aria-label or aria-labelledby. Returns `{ valid, issues[] }` result object. |

**Total new tests**: 12 (screen reader: 3, high contrast: 3, reduced motion: 2, WCAG: 4)
**New modules**: 1 (`accessibility.ts`)
**External dependencies added**: 0
**Lines of production code**: ~89

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Accessibility is one of those domains where doing it late means doing it twice. Epic 29 was placed in Cycle 6, which is later than ideal, but the pure-module approach meant the utilities landed as self-contained functions that any component can adopt incrementally. The screen reader descriptions from Story 29-1 are the highest-value delivery -- a visually impaired developer running `aria-live="polite"` regions with `getStatusChangeAnnouncement()` will hear "Agent agent-2 changed from working to blocked" without any component-level effort. That is the correct abstraction level.

The high contrast shape system (Story 29-2) addresses the core insight from brainstorm #153: status should never be conveyed by color alone. The mapping of circle/square/triangle/diamond/cross to working/blocked/completed/idle/error is intuitive and matches established dashboard conventions. The fallback to a generic circle for unknown statuses prevents rendering gaps when new statuses are added to the tracker.

**Nova (Architect):** The module has zero coupling to React, Next.js, or any CSS framework. `getAnimationClass()` returns a string, not a className binding. `getAgentStatusDescription()` returns a string, not a JSX element. This means the utilities work in server-side rendering, client-side rendering, CLI output, and even test reporters. The SSR guard in `prefersReducedMotion()` (`typeof window === "undefined"`) is a single line that prevents the most common SSR crash pattern in Next.js App Router.

The `validateAriaAttributes()` function uses a plain object input (`{ role, ariaLabel, ariaLabelledBy }`) rather than a DOM element reference. This makes it testable without a DOM and composable with any rendering framework. The function returns a structured result (`{ valid, issues }`) rather than throwing, which allows progressive validation in dev mode without breaking production rendering.

The `STATUS_SHAPES` constant is exported directly, allowing components to iterate over all shapes (for legends) or look up individual shapes. The inclusion of a `label` alongside the `shape` character means high contrast mode does not create a new accessibility problem for screen reader users who encounter the shape characters.

**Blaze (Dev):** Four stories consolidated into one file with clear section headers. Each section has separator comments matching the story number, making it trivial to trace code back to stories. The implementation is straightforward: string concatenation, a constant map, a media query check, and a field validator. No clever abstractions, no over-engineering.

The test file mirrors the section structure: one `describe` block per story, named after the story number. The reduced motion tests mock `window.matchMedia` with `vi.fn()` correctly. The high contrast test iterates `STATUS_SHAPES` entries to verify every shape has a label -- this is a good pattern that will catch regressions if someone adds a shape without a label.

**Pax (QA):** 12 tests across 4 describe blocks is reasonable for the scope. The screen reader tests cover the happy path (full description), null story omission, and status change announcement. The high contrast tests verify shape definitions, fallback behavior, and label presence for all entries. The reduced motion tests cover both preference states (on/off). The WCAG tests cover the contrast ratio constant, missing aria-label detection, valid aria-label acceptance, and non-button pass-through.

The `getAgentStatusDescription` test for null storyId is a good edge case. The fallback shape test for unknown status is another. The `validateAriaAttributes` test verifying that `aria-labelledby` also passes (not just `aria-label`) is important for flexibility.

---

### What Could Be Improved

**R2d2 (Project Lead):** Epic 29 should have been in Cycle 4, not Cycle 6. Accessibility built from the start is cheaper than retrofitted. Every component created in Cycles 4-5 (agent status cards, sprint panels, recommendation widgets, collaboration panels) now needs to be updated to use these utilities. The `validateAriaAttributes()` function exists, but no component calls it yet. The shapes exist, but no dashboard card renders them. We built the tools without applying them.

Also, Story 29-4's acceptance criteria said "zero critical or serious violations" from an axe-core audit. The delivery was a field validator that checks for `aria-label` on buttons. That is not an axe-core audit. The cycle-6 retrospective correctly flagged this: "No integration with real accessibility testing tools." The WCAG story should have included a test runner integration or at minimum a CI step.

**Nova (Architect):** The `validateAriaAttributes()` function checks exactly one rule: buttons need aria-label or aria-labelledby. WCAG 2.1 AA has dozens of rules. The function is extensible (new `if` blocks can be added), but it is not a real audit tool and should not be marketed as one. A more honest approach would be to export a `runAccessibilityChecks(element)` function that delegates to axe-core in the browser and falls back to the built-in checks in Node/test environments.

The `prefersReducedMotion()` function reads the system preference once. It does not subscribe to changes. If a user toggles reduced motion in their OS settings while the dashboard is open, `getAnimationClass()` will return the stale value until the next render that calls `prefersReducedMotion()`. A proper implementation would use `addEventListener("change", ...)` on the MediaQueryList. For a server-rendered Next.js app, this means the client-side hydration needs to re-check on mount.

The `STATUS_SHAPES` map has 5 entries. The orchestrator's agent status model (from `types.ts`) has more states than these 5. Any status not in the map gets a fallback circle, which defeats the purpose of distinct shapes for high contrast mode. The map should be derived from the canonical status type, not hand-maintained.

**Blaze (Dev):** The module uses `window.matchMedia` directly. In the test file, this is mocked per-test with `vi.fn().mockReturnValue(...)`. This works but means each test must set up its own mock -- there is no shared mock or helper. If `prefersReducedMotion()` is called from multiple components, each component's test will need to repeat this mock. A `useReducedMotion()` hook or context provider would centralize the media query handling and reduce mock overhead.

The `getAgentStatusDescription()` function concatenates strings with commas. There is no localization support. The status descriptions will always be in English. For a project that targets international developers (and has i18n mentioned in brainstorm #175), the description builder should accept a locale or use a translation function.

**Pax (QA):** No test for the SSR guard in `prefersReducedMotion()`. The function has a `typeof window === "undefined"` check, but the test file only tests the browser path (with mocked `window.matchMedia`). A test that verifies the function returns `false` when `window` is undefined would confirm the SSR safety.

No test for `validateAriaAttributes()` with both `ariaLabel` and `ariaLabelledBy` present simultaneously. The `if` condition checks `!element.ariaLabel && !element.ariaLabelledBy`, which correctly passes when either is present, but there is no test for the "both present" case.

No integration tests. The acceptance criteria for 29-1 says "live regions announce state changes automatically" and 29-4 says "all interactive elements are keyboard-navigable." Neither of these can be verified with unit tests alone. They require component-level integration tests with a DOM, or E2E tests with Playwright. The cycle-6 retrospective flagged the lack of axe-core integration, which would cover both of these.

---

### Key Decisions

1. **Single consolidated module for all four stories.** All accessibility utilities ship in `accessibility.ts`. Rationale: the four concerns share the same domain (making the dashboard usable by all), the same consumers (dashboard components), and the same testing approach (pure functions). Section-per-story comments provide adequate organization without file proliferation.

2. **Pure functions, not React hooks or components.** The module exports functions and constants, not hooks or JSX. This is a deliberate architectural choice: the utilities work in any rendering context (server, client, CLI, test), and components can wrap them in hooks or context providers as needed without the module dictating the integration pattern.

3. **System preference detection, not user profile settings.** `prefersReducedMotion()` reads the OS-level `prefers-reduced-motion` media query rather than implementing a user preference toggle in the app. This is the web platform convention and avoids building a preference storage system that would need persistence, cross-device sync, and a settings UI.

4. **Shape-based status encoding, not pattern-based.** The acceptance criteria mentioned "shapes: squares=blocked, circles=running, triangles=completed" and "pattern/shape alternatives." The implementation uses Unicode geometric characters (circle, square, triangle, diamond, cross) rather than SVG patterns or CSS backgrounds. Unicode shapes are simpler, render instantly, and work in terminal output as well as browsers.

5. **Runtime ARIA validator, not build-time lint rule.** `validateAriaAttributes()` runs at component render time (or in tests), not as a linter or build plugin. This means it can validate dynamic props that static analysis cannot trace, but it also means violations are only caught when the code path executes. A complementary ESLint rule for `aria-label` on `<button>` elements would catch more cases earlier.

---

### Lessons Learned

1. **Accessibility belongs in Cycle 1, not Cycle 6.** Retrofitting accessibility utilities after 20+ components are built means every component needs an update pass. Building the utilities first means components use them from creation. The shape system, screen reader helpers, and motion detection should have been in the foundational modules alongside types.ts.

2. **Acceptance criteria that require real tools should not be marked done by proxies.** Story 29-4's AC said "zero critical or serious violations from axe-core or similar." The delivery was a manual field validator. The story was marked done. This creates a compliance gap: the project claims WCAG 2.1 AA compliance based on a single-rule validator. Future accessibility stories should require the actual tool integration as part of the AC, or the AC should be scoped to match the delivery.

3. **Pure accessibility utilities are necessary but not sufficient.** The module provides the building blocks, but no component uses them yet. An "apply accessibility to all dashboard components" story (or epic) is needed to bridge the gap between "utilities exist" and "dashboard is accessible." Without that bridge story, Epic 29 is a library, not a feature.

4. **The Unicode shape approach is elegant but has font dependency risks.** The geometric characters (circle, square, triangle, diamond, cross) render correctly in all modern browsers and most terminal fonts. But custom fonts or font-subsetting could drop these characters. The fallback approach (returning a circle for unknown statuses) mitigates this partially. SVG shapes would be more robust but add complexity.

5. **Media query detection without change subscription creates stale state.** The `prefersReducedMotion()` function is stateless -- it re-reads the media query on every call. This is correct for server-side rendering (no subscription needed) and for components that re-render frequently. But for components that render once and stay mounted (like a dashboard layout), a stale cached value could persist. The fix is straightforward (wrap in a hook with `addEventListener`), but it needs to happen at the integration layer, not in this module.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Apply accessibility utilities to all existing dashboard components (aria-labels, shape indicators, motion classes) | Dev | HIGH |
| 2 | Add axe-core integration for automated WCAG 2.1 AA audit in CI | Dev | HIGH |
| 3 | Derive STATUS_SHAPES from canonical agent status types to prevent map drift | Dev | MEDIUM |
| 4 | Add `useReducedMotion()` React hook with MediaQueryList change listener for client-side reactivity | Dev | MEDIUM |
| 5 | Add Playwright E2E tests verifying keyboard navigation and screen reader announcements | QA | MEDIUM |
| 6 | Add SSR guard test for `prefersReducedMotion()` (verify returns false when window undefined) | QA | LOW |
| 7 | Consider localization support in `getAgentStatusDescription()` for international users | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 4 |
| Stories completed | 4 (100%) |
| Production files created | 1 (`accessibility.ts`) |
| Test files created | 1 (`accessibility.test.ts`) |
| Total new tests | 12 |
| External dependencies added | 0 |
| Lines of production code | ~89 |
| Regressions | 0 |
| Deferred items | 2 (axe-core integration, component application pass) |
| Epic duration | Part of Cycle 6 (1 session) |
| Build status | Green |
