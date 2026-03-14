# Story 9.1: Artifact Inventory Panel

Status: done

## Story

As a dashboard user,
I want to view an inventory of all generated BMAD documents showing filename, phase, document type, file path, and modification timestamp,
so that I have a complete picture of what artifacts exist in my project.

## Acceptance Criteria

1. **Given** a project with multiple artifacts across phases (e.g., brief in analysis, PRD in planning, architecture in solutioning)
   **When** the WorkflowArtifactInventory component renders
   **Then** it displays each artifact with filename, associated phase, document type, file path, and modification timestamp

2. **Given** the artifact list includes unrecognized files (not matching any ARTIFACT_RULES pattern)
   **When** the component renders
   **Then** unrecognized artifacts appear with a null phase, visible but visually distinguished from categorized artifacts (e.g., muted styling, "Uncategorized" label)

3. **Given** no artifacts exist in `_bmad-output/`
   **When** the component renders
   **Then** it displays an empty state message ("No artifacts generated yet.")

4. **Given** the component renders with artifacts
   **When** inspected for accessibility
   **Then** it uses semantic table markup with proper column headers, ARIA labels, sr-only text for screen readers, and is keyboard-navigable

5. **Given** artifact data is loading or unavailable
   **When** the component renders
   **Then** it shows graceful empty state without crashing (loading skeleton handled at parent WorkflowDashboard level per WD-7 LKG pattern)

## Tasks / Subtasks

- [x] Task 1: Enhance artifact display to show all 5 fields (AC: 1, 2)
  - [x] Convert from `<ul>`/`<li>` list to semantic `<table>` with column headers for tabular data
  - [x] Add columns: Filename (primary), Type, Phase, Path, Modified
  - [x] Display phase using `PHASE_LABELS[artifact.phase]` for human-readable labels (import from types.ts)
  - [x] Display path as truncated relative path (use `text-ellipsis overflow-hidden` for long paths)
  - [x] Display modifiedAt as compact date string (e.g., "Mar 14" for current year, "Mar 14, 2025" for older) — use inline helper, NO external library
  - [x] Style uncategorized artifacts (phase === null) with muted text and "—" placeholder for phase column

- [x] Task 2: Accessibility compliance (AC: 4)
  - [x] Add `<thead>` with `<th>` column headers (sr-only or visible depending on design)
  - [x] Add sr-only text per row: "{filename}, {type} artifact in {phase} phase, modified {date}"
  - [x] Mark decorative/duplicate visible cells `aria-hidden="true"` since sr-only provides full context
  - [x] Verify `<section>` has `aria-label="Artifact inventory"` (already present)
  - [x] Verify `<h2>` heading "Artifacts" (already present)
  - [x] Ensure table headers use `scope="col"` for proper screen reader association

- [x] Task 3: Write component unit tests (AC: 1-5, NFR-T3)
  - [x] Test: renders all 5 fields for each artifact (filename, phase, type, path, modifiedAt)
  - [x] Test: renders phase labels using PHASE_LABELS (e.g., "Analysis", "Planning")
  - [x] Test: renders uncategorized artifacts with null phase (muted styling, "—" or "Uncategorized")
  - [x] Test: renders empty state message when artifacts array is empty
  - [x] Test: renders correct number of rows for multiple artifacts
  - [x] Test: has aria-label on section element
  - [x] Test: has semantic h2 heading with "Artifacts" text
  - [x] Test: has sr-only text with complete artifact description for screen readers
  - [x] Test: uses semantic table markup (table, thead, tbody, th, tr, td)
  - [x] Test: renders a single artifact correctly with all fields
  - [x] Test: formats modification timestamp correctly
  - [x] Test: handles mixed categorized and uncategorized artifacts

- [x] Task 4: Verify lint, typecheck, and all tests pass (AC: all)
  - [x] Run `pnpm lint` from project root — clean
  - [x] Run `pnpm typecheck` from project root — clean
  - [x] Run `pnpm test` — all tests pass
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
- [x] This story does NOT modify `scan-artifacts.ts`, `artifact-rules.ts`, or `types.ts` (UI-only story)
- [x] Import boundaries preserved: component imports only from `@/lib/workflow/types.js`

**Methods Used:**
- [x] `ClassifiedArtifact` type from `@/lib/workflow/types.js` — component prop type
- [x] `PHASE_LABELS` constant from `@/lib/workflow/types.js` — phase display labels
- [x] `Phase` type from `@/lib/workflow/types.js` — for type-safe phase key access

**Feature Flags:**
- [x] None required — UI-only story, no runtime behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story modifies only a React component and adds tests using existing vitest + @testing-library/react infrastructure. Zero new entries in package.json (NFR-P6).

## Dev Notes

### CRITICAL: Existing Component

**The WorkflowArtifactInventory component already exists** at `packages/web/src/components/WorkflowArtifactInventory.tsx`. It was built as a placeholder in Story 7-4 (page shell). This story is an **enhancement pass**, NOT a from-scratch implementation.

**Current component** (34 lines):
- Receives `artifacts: ClassifiedArtifact[]` as props (NOT nullable — always an array per WD-4)
- Renders filename and type for each artifact in a `<ul>`/`<li>` list
- Shows "No artifacts generated yet." when empty
- Has `aria-label="Artifact inventory"` on section
- Has h2 "Artifacts" heading
- **Missing**: phase display, file path, modifiedAt timestamp, uncategorized distinction, sr-only text, tests

### What Needs to Be Added

1. **Table layout**: Convert from list to semantic `<table>` — artifact data is inherently tabular with 5+ columns. Use `<thead>`/`<tbody>`/`<th>`/`<td>` for proper semantics.
2. **Phase column**: Display `PHASE_LABELS[artifact.phase]` (e.g., "Analysis", "Planning"). For null phase, show "—" or "Uncategorized" in muted text.
3. **Path column**: Show relative path (e.g., `_bmad-output/planning-artifacts/prd-workflow-dashboard.md`). Truncate with `text-ellipsis` for long paths.
4. **Modified timestamp**: Format ISO 8601 string to compact date. Use a simple inline helper — NO external libraries. Example: `formatDate("2026-03-14T10:30:00Z")` → `"Mar 14"` (same year) or `"Mar 14, 2025"` (different year).
5. **Uncategorized styling**: Artifacts with `phase === null` should use muted text styling to visually distinguish them from categorized artifacts (FR11).
6. **Accessibility**: sr-only text per row, aria-hidden on duplicate visible cells, table headers with `scope="col"`.
7. **Unit tests**: Following WorkflowAgentsPanel.test.tsx patterns.

### Architecture Compliance (CRITICAL)

**WD-6 Component Architecture:**
- Props-only interface: receives `artifacts: ClassifiedArtifact[]`
- No internal fetching or state management
- Renders empty state when artifacts array is empty
- Unit testable in isolation with mock data
- Component prefixed with "Workflow"

**WD-4 API Contract (frozen):**
```typescript
interface ClassifiedArtifact extends ScannedFile {
  phase: Phase | null;   // null for uncategorized artifacts
  type: string;          // e.g., "PRD", "Architecture", "Story Spec", "Uncategorized"
}

interface ScannedFile {
  filename: string;      // e.g., "prd-workflow-dashboard.md"
  path: string;          // relative path from project root
  modifiedAt: string;    // ISO 8601 timestamp
}
```

**Important**: `artifacts` is `ClassifiedArtifact[]` (NOT nullable). The API always returns an array (empty if no artifacts). This differs from `agents: AgentInfo[] | null` which CAN be null.

**WD-2 Artifact Classification:**
- Categorized artifacts: phase is one of `"analysis" | "planning" | "solutioning" | "implementation"`
- Uncategorized artifacts: `phase === null`, `type === "Uncategorized"` — visible in inventory but NOT counted toward phase completion (FR11)
- Implementation files that don't match rules default to `{ phase: "implementation", type: "Story Spec" }`

**Component Layout (WD-6):**
```
WorkflowDashboard (CSS Grid)
├── PhaseBar (full width, md:col-span-3)
├── AIGuide (2/3 width, md:col-span-2)
├── LastActivity (1/3 width)
├── ArtifactInventory (2/3 width, md:col-span-2)  ← THIS STORY
└── AgentsPanel (1/3 width)
```

The ArtifactInventory panel occupies 2/3 width (md:col-span-2), giving it enough horizontal space for a 5-column table layout.

**NFRs:**
- NFR-A1: WCAG 2.1 AA compliance
- NFR-A2: Semantic markup (no div-soup) — use `<table>`, `<thead>`, `<th>`, `<tbody>`, `<tr>`, `<td>`
- NFR-A3: Color independence (labels + text, never color alone)
- NFR-A5: Screen reader support (ARIA labels with descriptive state information)
- NFR-A6: Focus visibility (visible focus indicators on interactive elements)
- NFR-M1: Component isolation (renderable/testable independently with mock data)
- NFR-M2: Artifact rules updatable without logic changes (ARTIFACT_RULES constant)
- NFR-P5: Bundle size <50KB total for all Workflow components
- NFR-P6: Zero new dependencies
- NFR-T3: Component test coverage >70%

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `WorkflowArtifactInventory.tsx` | `@/lib/workflow/types.js` | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `WorkflowArtifactInventory.test.tsx` | `../WorkflowArtifactInventory`, `@/lib/workflow/types.js`, vitest, @testing-library/react | `@composio/ao-core`, Sprint Board, tracker-bmad |

### UI Styling Patterns (from existing components)

**Section container:**
```
rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full
```

**Section heading:**
```
text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3
```

**Table styling guidance:**
- Table headers: `text-[11px] text-[var(--color-text-muted)] font-medium uppercase` (similar to section heading but not bold)
- Primary text (filename): `text-[13px] text-[var(--color-text-primary)]`
- Secondary text (type, phase): `text-[11px] text-[var(--color-text-secondary)]`
- Muted text (path, uncategorized): `text-[11px] text-[var(--color-text-muted)]`
- Timestamp: `text-[11px] text-[var(--color-text-muted)]`
- Table rows: no visible borders, use spacing for separation. `border-b border-[var(--color-border-default)]` only if needed.
- Uncategorized row: entire row uses muted styling `opacity-60` or `text-[var(--color-text-muted)]`

**CSS Custom Properties available:**
- `--color-bg-base`: #0d1117
- `--color-bg-surface`: rgba(22, 27, 34, 0.8)
- `--color-text-primary`: #e6edf3
- `--color-text-secondary`: #7d8590
- `--color-text-muted`: #484f58
- `--color-border-default`: rgba(48, 54, 61, 1)
- `--color-accent`: #58a6ff (blue)
- `--color-status-success`: #3fb950

### Date Formatting Helper

Use a simple inline helper function within the component file — NO external library:

```typescript
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}
```

This produces compact dates like "Mar 14" (same year) or "Mar 14, 2025" (different year). Keep it simple — this is a read-only display component.

### Testing Patterns (from WorkflowAgentsPanel.test.tsx)

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowArtifactInventory } from "../WorkflowArtifactInventory";
import type { ClassifiedArtifact } from "@/lib/workflow/types.js";

// Helper to create test artifacts
function makeArtifact(
  filename: string,
  type: string,
  phase: "analysis" | "planning" | "solutioning" | "implementation" | null,
  path: string,
  modifiedAt: string,
): ClassifiedArtifact {
  return { filename, type, phase, path, modifiedAt };
}

const sampleArtifacts: ClassifiedArtifact[] = [
  makeArtifact("product-brief.md", "Product Brief", "analysis", "_bmad-output/planning-artifacts/product-brief.md", "2026-03-10T10:00:00Z"),
  makeArtifact("prd-workflow-dashboard.md", "PRD", "planning", "_bmad-output/planning-artifacts/prd-workflow-dashboard.md", "2026-03-11T14:30:00Z"),
  makeArtifact("architecture.md", "Architecture", "solutioning", "_bmad-output/planning-artifacts/architecture.md", "2026-03-12T09:15:00Z"),
  makeArtifact("sprint-status.yaml", "Sprint Plan", "implementation", "_bmad-output/implementation-artifacts/sprint-status.yaml", "2026-03-14T08:00:00Z"),
];
```

**Test patterns to follow:**
- Use `render()` + `screen.getByText()` / `screen.getByRole()` for assertions
- Test section `aria-label` with `screen.getByRole("region", { name: "Artifact inventory" })`
- Test heading with `screen.getByRole("heading", { level: 2 })`
- Test sr-only text with `screen.getByText("...")` (sr-only text is still in DOM)
- Test table structure with `screen.getByRole("table")`, `screen.getAllByRole("row")`, `screen.getAllByRole("columnheader")`
- Group tests in `describe` blocks: "artifact rendering", "accessibility", "empty state"

### Previous Story Intelligence

**From Story 8-4 (Agent Manifest Parser and Agents Panel — done):**
- Component pattern: section + aria-label + h2 + content + sr-only
- `aria-hidden="true"` on decorative/duplicate display elements
- sr-only text pattern: descriptive text combining all fields for screen readers
- Contextual empty state with specific messaging
- `min-w-0` wrapper for flex overflow control
- Code review caught missing `role` field rendering — ALWAYS verify ALL fields from AC are rendered
- 4 aria-hidden elements per agent (icon + displayName + title + role)
- Test: verify exact aria-hidden count with `toHaveLength(n)`

**From Story 8-3 (AI Guide Panel Component — done):**
- `tierStyles()` consolidation pattern — combine related helpers into single function
- `it.each` for parameterized tests (better failure reporting than forEach)
- AC5 loading state handled at parent level per WD-7 — documented with comment, no test needed
- Combined `import { Type, type Interface }` to avoid ESLint duplicate import error
- CSS styling: container, heading, primary/secondary text patterns established

**From Story 7-5 (Phase Bar Component — done):**
- WorkflowPhaseBar.test.tsx is the canonical test pattern for Workflow components
- Empty state: same section wrapper with fallback message

**CRITICAL LESSON from Story 8-4 code review:** The dev agent marked Task 1 subtask "Add role description" as `[x]` but NEVER implemented role rendering. The code review caught this as a CRITICAL issue. For THIS story, the dev agent MUST verify that ALL 5 fields (filename, phase, type, path, modifiedAt) are actually rendered in the DOM — not just claimed as done.

### Sample Artifact Data (from real project)

The real `_bmad-output/` directory contains artifacts like:

| filename | type | phase | path |
|----------|------|-------|------|
| product-brief-ao.md | Product Brief | analysis | _bmad-output/planning-artifacts/product-brief-ao.md |
| prd-workflow-dashboard.md | PRD | planning | _bmad-output/planning-artifacts/prd-workflow-dashboard.md |
| architecture.md | Architecture | solutioning | _bmad-output/planning-artifacts/architecture.md |
| epics-workflow-dashboard.md | Epics & Stories | solutioning | _bmad-output/planning-artifacts/epics-workflow-dashboard.md |
| sprint-status.yaml | Sprint Plan | implementation | _bmad-output/implementation-artifacts/sprint-status.yaml |
| 8-4-agent-manifest-parser-and-agents-panel.md | Story Spec | implementation | _bmad-output/implementation-artifacts/8-4-agent-manifest-parser-and-agents-panel.md |

Uncategorized files (phase === null) would be any `.md` files in `planning-artifacts/` that don't match any ARTIFACT_RULES pattern.

### Project Structure Notes

**Files to modify:**
```
packages/web/src/
├── components/
│   └── WorkflowArtifactInventory.tsx     # MODIFY: Convert to table, add all 5 fields, uncategorized styling, accessibility
```

**Files to create:**
```
packages/web/src/
├── components/
│   └── __tests__/
│       └── WorkflowArtifactInventory.test.tsx  # CREATE: Unit tests (follow WorkflowAgentsPanel.test.tsx patterns)
```

**Files to read (not modify):**
```
packages/web/src/
├── components/
│   ├── WorkflowAgentsPanel.tsx            # READ: Component pattern reference (enhanced in 8-4)
│   ├── __tests__/
│   │   ├── WorkflowAgentsPanel.test.tsx   # READ: Test pattern reference (14 tests)
│   │   ├── WorkflowAIGuide.test.tsx       # READ: Test pattern reference (13 tests)
│   │   └── WorkflowPhaseBar.test.tsx      # READ: Test pattern reference (canonical)
│   └── WorkflowDashboard.tsx              # READ: How ArtifactInventory is wired (receives artifacts prop)
├── lib/
│   └── workflow/
│       ├── types.ts                       # READ: ClassifiedArtifact, Phase, PHASE_LABELS types
│       ├── artifact-rules.ts              # READ: ARTIFACT_RULES constant (what types exist)
│       └── scan-artifacts.ts              # READ: How artifacts are discovered and classified
```

### References

- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 3.1 Artifact Inventory Panel]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-2 Artifact Mapping, WD-4 API Contract, WD-6 Component Architecture, WD-8 File Scanning]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR9, FR11, NFR-A1-A6, NFR-M1, NFR-M2, NFR-P5, NFR-P6, NFR-T3]
- [Source: packages/web/src/components/WorkflowArtifactInventory.tsx — Current placeholder (34 lines)]
- [Source: packages/web/src/lib/workflow/types.ts — ClassifiedArtifact, ScannedFile, Phase, PHASE_LABELS (frozen)]
- [Source: packages/web/src/lib/workflow/artifact-rules.ts — ARTIFACT_RULES constant]
- [Source: packages/web/src/lib/workflow/scan-artifacts.ts — scanAllArtifacts(), buildPhasePresence()]
- [Source: packages/web/src/components/WorkflowAgentsPanel.tsx — Component pattern reference]
- [Source: packages/web/src/components/__tests__/WorkflowAgentsPanel.test.tsx — Test pattern reference]
- [Source: _bmad-output/implementation-artifacts/8-4-agent-manifest-parser-and-agents-panel.md — Previous story intelligence]
- [Source: _bmad-output/implementation-artifacts/8-3-ai-guide-panel-component.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean execution, no debugging required.

### Completion Notes List

1. **Task 1 — Table Layout & All 5 Fields**: Converted `<ul>`/`<li>` list to semantic `<table>` with 5 columns: Name, Type, Phase, Path, Modified. Added `formatDate()` helper for compact date display (same year: "Mar 14", different year: "Mar 14, 2025"). Added `phaseLabel()` helper using `PHASE_LABELS` for human-readable phase labels. Uncategorized artifacts (phase === null) show "—" for phase and get `opacity-60` on the entire row. Path column truncated with `max-w-[200px] truncate`.

2. **Task 2 — Accessibility**: Added `<thead>` with `<th scope="col">` column headers. Added sr-only `<td>` per row with descriptive text: "{filename}, {type} artifact in {phase} phase, modified {date}" (or "uncategorized" for null phase). All 5 visible `<td>` elements marked `aria-hidden="true"`. Section `aria-label="Artifact inventory"` and `<h2>` heading "Artifacts" preserved from placeholder.

3. **Task 3 — Unit Tests**: 20 tests across 3 describe blocks: artifact rendering (11 tests), empty state (2 tests), accessibility (7 tests). All use real assertions with `@testing-library/react`. Tests cover: filename, type, phase labels, path, timestamps (same year and different year), row count, single artifact, uncategorized "—" label, uncategorized opacity styling, mixed categorized/uncategorized, empty state message, no table when empty, aria-label, h2 heading, semantic table + columnheaders, scope="col" on th, sr-only text for categorized, sr-only text for uncategorized, aria-hidden count per row.

4. **Task 4 — CI Green**: `pnpm lint` clean, `pnpm typecheck` clean, 496 tests passing (20 WorkflowArtifactInventory tests). Zero regressions.

5. **Code Review Fixes** (1 MEDIUM, 4 LOW):
   - **M1 (MEDIUM)**: Fixed column count mismatch — sr-only was a 6th `<td>` with no header. Moved sr-only content to `<span class="sr-only">` inside first `<td>`, moved `aria-hidden` from first `<td>` to the filename `<span>` inside it. Now 5 `<td>` matches 5 `<th>`.
   - **L1 (LOW)**: Added AC5 loading state comment documenting parent handles loading.
   - **L2 (LOW)**: Added `modifiedAt` assertion to "single artifact with all fields" test.
   - **L3 (LOW)**: Tightened timestamp test from loose regex to exact `getByText` assertions per date.
   - **L4 (LOW)**: Added `thead`/`tbody` existence checks to "semantic table markup" test.
   - Updated aria-hidden test to expect 4 `td[aria-hidden]` + 1 `span[aria-hidden]` (matches M1 DOM change).

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/components/WorkflowArtifactInventory.tsx` | Modified | Converted list to semantic table with 5 columns, formatDate/phaseLabel helpers, uncategorized styling, sr-only accessibility text, aria-hidden on visible cells |
| `packages/web/src/components/__tests__/WorkflowArtifactInventory.test.tsx` | Created | 20 unit tests covering rendering (11), empty state (2), accessibility (7) |
