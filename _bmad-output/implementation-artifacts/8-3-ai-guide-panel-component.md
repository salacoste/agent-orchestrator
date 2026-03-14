# Story 8.3: AI Guide Panel Component

Status: done

## Story

As a dashboard user,
I want an AI Guide panel that displays the current recommendation with its observation and implication,
so that I can understand what to do next in my BMAD workflow.

## Acceptance Criteria

1. **Given** the API returns a non-null recommendation
   **When** the WorkflowAIGuide component renders
   **Then** it displays the observation and implication text, visually distinguished, with the recommendation tier indicated

2. **Given** the API returns a null recommendation (all phases complete or no artifacts)
   **When** the component renders
   **Then** it displays an appropriate message (e.g., "All phases complete" or contextual empty state)

3. **Given** the component renders
   **When** inspected for accessibility
   **Then** it uses semantic HTML (e.g., `<section>`, `<p>`), has appropriate ARIA labels, and is keyboard-navigable

4. **Given** the recommendation data is loading or unavailable
   **When** the component renders
   **Then** it shows a loading skeleton or retains the previous recommendation gracefully

## Tasks / Subtasks

- [x] Task 1: Enhance WorkflowAIGuide component to display tier indicator (AC: 1)
  - [x] Add visual tier badge/indicator (Tier 1 = high priority, Tier 2 = informational)
  - [x] Add phase badge showing which phase the recommendation targets
  - [x] Ensure observation and implication are visually distinguished (already done — observation is primary text, implication is secondary)
  - [x] Follow existing component patterns from WorkflowPhaseBar.tsx

- [x] Task 2: Improve null/empty state handling (AC: 2)
  - [x] Replace generic "No recommendations at this time" with contextual message
  - [x] Show completion message (e.g., "All workflow phases have artifacts") for the all-complete state
  - [x] Use a distinct visual treatment for the empty state (e.g., muted icon + text)

- [x] Task 3: Accessibility compliance (AC: 3)
  - [x] Verify semantic HTML: `<section>` with aria-label (already present)
  - [x] Add sr-only text describing tier and phase context for screen readers
  - [x] Ensure all visual indicators have text alternatives (not color-only)
  - [x] Add `<h2>` heading (already present — "AI Guide")
  - [x] Verify focus-visible rings on any interactive elements (if any)

- [x] Task 4: Write component unit tests (AC: 1-4, NFR-T3)
  - [x] Test: renders observation and implication text from recommendation
  - [x] Test: displays tier indicator with correct value (1 or 2)
  - [x] Test: displays phase badge with correct phase name
  - [x] Test: renders empty/completion state when recommendation is null
  - [x] Test: has aria-label on section element
  - [x] Test: has semantic h2 heading
  - [x] Test: has sr-only descriptive text for accessibility
  - [x] Test: section renders correctly with both tier 1 and tier 2 recommendations

- [x] Task 5: Verify lint, typecheck, and all tests pass (AC: all)
  - [x] Run `pnpm lint` from project root — clean
  - [x] Run `pnpm typecheck` from project root — clean
  - [x] Run `pnpm test` — all 496 tests pass
  - [x] Verify no regressions in existing workflow tests

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items — all ACs fully met
- [x] File List includes all changed files

## Interface Validation

- [x] This story does NOT modify any `@composio/ao-core` interfaces
- [x] This story does NOT modify `recommendation-engine.ts` or `types.ts` (UI-only story)
- [x] Import boundaries preserved: component imports only from `@/lib/workflow/types.js`

**Methods Used:**
- [x] `Recommendation` type from `@/lib/workflow/types.js` — component prop type
- [x] `PHASE_LABELS` constant from `@/lib/workflow/types.js` — phase display labels

**Feature Flags:**
- [x] None required — UI-only story, no runtime behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story modifies only a React component and adds tests using existing vitest + @testing-library/react infrastructure. Zero new entries in package.json (NFR-P6).

## Dev Notes

### CRITICAL: Existing Component

**The WorkflowAIGuide component already exists** at `packages/web/src/components/WorkflowAIGuide.tsx`. It was built as a placeholder in Story 7-4 (page shell). This story is an **enhancement pass**, NOT a from-scratch implementation.

**Current component** (33 lines):
- Receives `recommendation: Recommendation | null` as props
- Renders observation (primary text) and implication (secondary text) when non-null
- Shows "No recommendations at this time." when null
- Has `aria-label="AI-guided recommendations"` on section
- Has h2 "AI Guide" heading
- **Missing**: tier indicator, phase badge, contextual empty state, sr-only text, tests

### What Needs to Be Added

1. **Tier indicator**: Visual badge showing "Tier 1" or "Tier 2" — use color coding: Tier 1 = `--color-status-attention` (yellow/amber), Tier 2 = `--color-accent` (blue)
2. **Phase badge**: Small label showing which phase the recommendation targets (e.g., "analysis", "planning")
3. **Contextual null state**: Instead of generic "No recommendations", show something like "All workflow phases have artifacts. No action needed."
4. **Accessibility sr-only text**: Screen reader context for tier and phase
5. **Unit tests**: Following WorkflowPhaseBar.test.tsx patterns

### Architecture Compliance (CRITICAL)

**WD-6 Component Architecture:**
- Props-only interface: receives `recommendation | null`
- No internal fetching or state management
- Renders nothing or completion message when `recommendation: null`
- Unit testable in isolation with mock data
- Component prefixed with "Workflow"

**WD-4 API Contract (frozen):**
```typescript
interface Recommendation {
  tier: 1 | 2;
  observation: string;
  implication: string;
  phase: Phase;
}
```

**Component Layout (WD-6):**
```
WorkflowDashboard (CSS Grid)
├── PhaseBar (full width, md:col-span-3)
├── AIGuide (2/3 width, md:col-span-2)     ← THIS STORY
├── LastActivity (1/3 width)
├── ArtifactInventory (2/3 width, md:col-span-2)
└── AgentsPanel (1/3 width)
```

**NFRs:**
- NFR-A1: WCAG 2.1 AA compliance
- NFR-A2: Semantic markup (no div-soup)
- NFR-A3: Color independence (labels + icons + color, never color alone)
- NFR-A5: Screen reader support (ARIA labels with descriptive state information)
- NFR-A6: Focus visibility (visible focus indicators on interactive elements)
- NFR-M1: Component isolation (renderable/testable independently with mock data)
- NFR-P5: Bundle size <50KB total for all Workflow components
- NFR-T3: Component test coverage >70%

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `WorkflowAIGuide.tsx` | `@/lib/workflow/types.js` | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `WorkflowAIGuide.test.tsx` | `../WorkflowAIGuide`, `@/lib/workflow/types.js`, vitest, @testing-library/react | `@composio/ao-core`, Sprint Board, tracker-bmad |

### UI Styling Patterns (from existing components)

**Section container:**
```
rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full
```

**Section heading:**
```
text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3
```

**Primary text (observation):**
```
text-[13px] text-[var(--color-text-primary)]
```

**Secondary text (implication):**
```
text-[12px] text-[var(--color-text-secondary)]
```

**CSS Custom Properties available:**
- `--color-bg-base`: #0d1117
- `--color-bg-surface`: rgba(22, 27, 34, 0.8)
- `--color-text-primary`: #e6edf3
- `--color-text-secondary`: #7d8590
- `--color-text-muted`: #484f58
- `--color-border-default`: rgba(48, 54, 61, 1)
- `--color-accent`: #58a6ff (blue — use for Tier 2)
- `--color-status-success`: #3fb950
- `--color-status-error`: #f85149
- `--color-status-attention`: #d29922 (amber — use for Tier 1)

### Testing Patterns (from WorkflowPhaseBar.test.tsx)

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAIGuide } from "../WorkflowAIGuide";
import type { Recommendation, Phase } from "@/lib/workflow/types.js";

// Helper to create test recommendations
function makeRecommendation(
  tier: 1 | 2,
  observation: string,
  implication: string,
  phase: Phase,
): Recommendation {
  return { tier, observation, implication, phase };
}
```

**Test patterns to follow:**
- Use `render()` + `screen.getByText()` / `screen.getByRole()` for assertions
- Test section `aria-label` with `screen.getByRole("region", { name: "..." })`
- Test heading with `screen.getByRole("heading", { level: 2 })`
- Test sr-only with `screen.getByText("...")` (sr-only text is still in DOM)
- Group tests in `describe` blocks: "recommendation rendering", "accessibility", "empty state"

### Previous Story Intelligence

**From Story 8-2 (Recommendation Engine Tests — done):**
- All 19 tests pass with real assertions
- Recommendation shape validated: `{ tier, observation, implication, phase }`
- Context voice verified: no imperative verbs in observations/implications
- Tier boundaries: R1-R3 = tier 1, R4-R6 = tier 2
- Phase per rule: R1/R2→"analysis", R3→"planning", R4/R5→"solutioning", R6→"implementation"

**From Story 8-1 (Recommendation Engine — done):**
- `as Phase` casts removed — TypeScript infers correctly
- WD-3 contextual prefixes in observations (e.g., "PRD present. Architecture spec not found")
- `hasType()` substring false-positive limitation documented (deferred)
- Observation text for each rule documented in story Dev Notes

**From Story 7-5 (Phase Bar Component — done):**
- WorkflowPhaseBar.test.tsx is the canonical test pattern for Workflow components
- Component pattern: section + aria-label + h2 + content + sr-only
- CSS class patterns: section container, heading, text sizes, color variables
- Empty state pattern: same section wrapper with fallback message

**From Story 7-4 (Page Shell — done):**
- WorkflowAIGuide.tsx already created as placeholder
- WorkflowDashboard.tsx passes `data.recommendation` to AIGuide
- CSS Grid layout: `md:col-span-2` for AIGuide (2/3 width)

### Current Observation Text (for UI display reference)

| Rule | Tier | Phase | Observation |
|------|------|-------|-------------|
| R1 | 1 | analysis | "No BMAD artifacts detected in this project" |
| R2 | 1 | analysis | "No product brief found" |
| R3 | 1 | planning | "Product brief present. No PRD found" |
| R4 | 2 | solutioning | "PRD present. Architecture spec not found" |
| R5 | 2 | solutioning | "Architecture spec present. No epic or story files found" |
| R6 | 2 | implementation | "All solutioning artifacts present. Implementation phase active" |
| R7 | — | — | returns `null` |

### Project Structure Notes

**Files to modify:**
```
packages/web/src/
├── components/
│   └── WorkflowAIGuide.tsx          # MODIFY: Add tier indicator, phase badge, enhanced null state, sr-only text
```

**Files to create:**
```
packages/web/src/
├── components/
│   └── __tests__/
│       └── WorkflowAIGuide.test.tsx  # CREATE: Unit tests (follow WorkflowPhaseBar.test.tsx patterns)
```

**Files to read (not modify):**
```
packages/web/src/
├── components/
│   ├── WorkflowPhaseBar.tsx          # READ: Component pattern reference
│   ├── __tests__/
│   │   └── WorkflowPhaseBar.test.tsx # READ: Test pattern reference
│   └── WorkflowDashboard.tsx         # READ: How AIGuide is wired (receives recommendation prop)
├── lib/
│   └── workflow/
│       ├── types.ts                  # READ: Recommendation, Phase types
│       └── recommendation-engine.ts  # READ: What recommendation values look like
```

### References

- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 2.3 AI Guide Panel Component]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-3 Recommendation Engine, WD-6 Component Architecture]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR6, NFR-A1-A6, NFR-M1, NFR-T3]
- [Source: packages/web/src/components/WorkflowAIGuide.tsx — Current placeholder (33 lines)]
- [Source: packages/web/src/components/WorkflowPhaseBar.tsx — Component pattern reference (73 lines)]
- [Source: packages/web/src/components/__tests__/WorkflowPhaseBar.test.tsx — Test pattern reference (198 lines)]
- [Source: packages/web/src/lib/workflow/types.ts — Recommendation, Phase types]
- [Source: packages/web/src/lib/workflow/recommendation-engine.ts — Rule chain (156 lines)]
- [Source: _bmad-output/implementation-artifacts/8-1-recommendation-engine.md — Previous story intelligence]
- [Source: _bmad-output/implementation-artifacts/8-2-recommendation-engine-tests.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean execution, no debugging required.

### Completion Notes List

1. **Task 1 — Tier & Phase Badges**: Added `tierColor()` and `tierBorderColor()` helpers. Tier 1 uses `--color-status-attention` (amber), Tier 2 uses `--color-accent` (blue). Phase badge displays `PHASE_LABELS[recommendation.phase]` with muted border styling.

2. **Task 2 — Null State**: Replaced generic "No recommendations at this time" with contextual "All workflow phases have artifacts. No action needed." message using secondary text styling.

3. **Task 3 — Accessibility**: Added sr-only text "Tier {n} recommendation for {Phase} phase" for screen readers. Tier and phase badge spans marked `aria-hidden="true"`. Text labels ensure NFR-A3 (color independence) — "Tier 1"/"Tier 2" text, not just colored dots.

4. **Task 4 — Unit Tests**: 13 tests across 3 describe blocks: recommendation rendering (5), empty state (2), accessibility (6). All use real assertions with `@testing-library/react`.

5. **Task 5 — CI Green**: `pnpm lint` clean, `pnpm typecheck` clean, 496 tests passing, zero regressions.

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/components/WorkflowAIGuide.tsx` | Modified | Added tier badge, phase badge, sr-only text, contextual null state. Imports `PHASE_LABELS` from types. |
| `packages/web/src/components/__tests__/WorkflowAIGuide.test.tsx` | Created | 13 unit tests covering rendering, empty state, accessibility (aria-label, heading, sr-only, aria-hidden, NFR-A3) |
