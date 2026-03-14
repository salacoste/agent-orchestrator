# Story 8.4: Agent Manifest Parser and Agents Panel

Status: done

## Story

As a dashboard user,
I want to see a list of available BMAD agents with their display name, title, icon, and role description,
so that I understand who the BMAD agent team is and what each agent does.

## Acceptance Criteria

1. **Given** a project with `_bmad/_config/agent-manifest.csv` present
   **When** the agents data is loaded
   **Then** the CSV is parsed correctly, including quoted fields containing commas, returning agent display name, title, icon, and role description

2. **Given** the parsed agent data
   **When** the WorkflowAgentsPanel component renders
   **Then** it displays each agent as a card/row with icon, display name, title, and role description

3. **Given** the agent manifest file is not found
   **When** the component renders
   **Then** it displays an appropriate empty state (e.g., "No agent manifest found") without errors

4. **Given** the agent manifest CSV contains malformed rows
   **When** the parser encounters them
   **Then** it skips invalid rows and renders what's available, logging no user-visible errors

5. **Given** the component renders
   **When** inspected for accessibility
   **Then** it uses semantic list markup, ARIA labels, and is keyboard-navigable

## Tasks / Subtasks

- [x] Task 1: Enhance WorkflowAgentsPanel to display all agent fields (AC: 2)
  - [x] Add title display below displayName for each agent
  - [x] Add role description (truncated or full) for each agent
  - [x] Apply consistent styling with other Workflow panels (text sizes, colors, spacing)
  - [x] Ensure panel works within 1/3 width grid constraint

- [x] Task 2: Improve empty/null state handling (AC: 3)
  - [x] Contextual empty state message (consistent with WorkflowAIGuide pattern)
  - [x] Distinguish between `null` (no manifest file) and empty array (file exists but no valid agents)

- [x] Task 3: Accessibility compliance (AC: 5)
  - [x] Verify semantic HTML: `<section>` with aria-label, `<h2>` heading (already present)
  - [x] Add sr-only text for each agent describing icon meaning for screen readers
  - [x] Ensure `aria-hidden="true"` on decorative icon spans
  - [x] Verify focus-visible rings on any interactive elements (if any)
  - [x] Verify list semantics (`<ul>`, `<li>`) for agent roster

- [x] Task 4: Write component unit tests (AC: 1-5, NFR-T3)
  - [x] Test: renders agent displayName, title, and role from agents array
  - [x] Test: renders icon for each agent
  - [x] Test: renders empty state message when agents is null
  - [x] Test: renders empty state when agents is empty array
  - [x] Test: does not render agent cards when null
  - [x] Test: has aria-label on section element
  - [x] Test: has semantic h2 heading
  - [x] Test: has sr-only text for agent icons (accessibility)
  - [x] Test: has aria-hidden on icon spans
  - [x] Test: renders correct number of list items for multiple agents

- [x] Task 5: Verify lint, typecheck, and all tests pass (AC: all)
  - [x] Run `pnpm lint` from project root — clean
  - [x] Run `pnpm typecheck` from project root — clean
  - [x] Run `pnpm test` — all tests pass (2 pre-existing failures in conflicts.test.ts unrelated)
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
- [x] This story does NOT modify `parse-agents.ts` or `types.ts` (UI-only story — parser and types already complete)
- [x] Import boundaries preserved: component imports only from `@/lib/workflow/types.js`

**Methods Used:**
- [x] `AgentInfo` type from `@/lib/workflow/types.js` — component prop type
- [x] No new types or interfaces needed — `AgentInfo` already frozen in WD-4

**Feature Flags:**
- [x] None required — UI-only story, no runtime behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story modifies only a React component and adds tests using existing vitest + @testing-library/react infrastructure. Zero new entries in package.json (NFR-P6).

## Dev Notes

### CRITICAL: Existing Components and Infrastructure

**The following already exist and are COMPLETE — do NOT rewrite or modify:**

1. **`packages/web/src/lib/workflow/parse-agents.ts`** (70 lines) — CSV parser with quoted-field handling. Fully tested with 11 unit tests. Extracts `name`, `displayName`, `title`, `icon`, `role` from `_bmad/_config/agent-manifest.csv`.

2. **`packages/web/src/lib/workflow/types.ts`** — `AgentInfo` interface already defined:
```typescript
export interface AgentInfo {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  role: string;
}
```

3. **`packages/web/src/app/api/workflow/[project]/route.ts`** (lines 83-94) — Already reads agent manifest, calls `parseAgentManifest()`, and returns `agents: AgentInfo[] | null` in `WorkflowResponse`.

4. **`packages/web/src/lib/workflow/__tests__/parse-agents.test.ts`** (11 tests) — Comprehensive parser tests covering quoted fields, malformed rows, empty inputs, trimming.

5. **`packages/web/src/components/WorkflowDashboard.tsx`** (line 28) — Already wires `<WorkflowAgentsPanel agents={data.agents} />` in the grid layout.

### What This Story Actually Does

This is an **enhancement pass** on the existing placeholder `WorkflowAgentsPanel.tsx` (34 lines). Like Story 8-3 enhanced the AIGuide placeholder, this story:

1. **Adds title and role display** — Currently only shows icon + displayName
2. **Improves accessibility** — sr-only text for icons, aria-hidden on decorative spans
3. **Enhances empty state** — Contextual messaging
4. **Creates component tests** — `WorkflowAgentsPanel.test.tsx` (none exist yet)

### Current Component (34 lines)

```typescript
// packages/web/src/components/WorkflowAgentsPanel.tsx
import type { AgentInfo } from "@/lib/workflow/types.js";

interface WorkflowAgentsPanelProps {
  agents: AgentInfo[] | null;
}

export function WorkflowAgentsPanel({ agents }: WorkflowAgentsPanelProps) {
  return (
    <section aria-label="BMAD agents" className="rounded-[6px] border ...">
      <h2 className="text-[11px] font-semibold ...">Agents</h2>
      {agents && agents.length > 0 ? (
        <ul className="space-y-2">
          {agents.map((agent) => (
            <li key={agent.name} className="flex items-center gap-2">
              <span className="text-[14px]" aria-hidden="true">{agent.icon}</span>
              <span className="text-[12px] text-[var(--color-text-secondary)]">{agent.displayName}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">No agent manifest found.</p>
      )}
    </section>
  );
}
```

**Missing**: title display, role description, sr-only text, enhanced empty state, tests.

### What Needs to Be Added

1. **Title display**: Show agent title (e.g., "Business Analyst") below or next to the displayName — use secondary text styling
2. **Role description**: Show role text in muted/smaller text — use `text-[11px] text-[var(--color-text-muted)]`
3. **Accessibility sr-only text**: For each agent, sr-only text describing the icon (e.g., "📊 icon for Analyst agent") so screen readers get context beyond the emoji
4. **Contextual empty state**: Distinguish null (no manifest) from empty array (no valid agents)
5. **Unit tests**: Following WorkflowAIGuide.test.tsx patterns

### Architecture Compliance (CRITICAL)

**WD-6 Component Architecture:**
- Props-only interface: receives `agents: AgentInfo[] | null`
- No internal fetching or state management
- Renders empty state when `agents: null` or empty array
- Unit testable in isolation with mock data
- Component prefixed with "Workflow"

**WD-4 API Contract (frozen):**
```typescript
interface AgentInfo {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  role: string;
}
```

**WD-8 File Scanning:**
- Agent manifest at `_bmad/_config/agent-manifest.csv` — already scanned by API route
- This story does NOT touch scanning or parsing — only the UI component

**Component Layout (WD-6):**
```
WorkflowDashboard (CSS Grid)
├── PhaseBar (full width, md:col-span-3)
├── AIGuide (2/3 width, md:col-span-2)
├── LastActivity (1/3 width)
├── ArtifactInventory (2/3 width, md:col-span-2)
└── AgentsPanel (1/3 width)     ← THIS STORY
```

**NFRs:**
- NFR-A1: WCAG 2.1 AA compliance
- NFR-A2: Semantic markup (no div-soup) — use `<ul>`, `<li>`, `<section>`, `<h2>`
- NFR-A3: Color independence (labels + icons + text, never color alone)
- NFR-A5: Screen reader support (ARIA labels with descriptive state information)
- NFR-A6: Focus visibility (visible focus indicators on interactive elements)
- NFR-M1: Component isolation (renderable/testable independently with mock data)
- NFR-P5: Bundle size <50KB total for all Workflow components
- NFR-T3: Component test coverage >70%

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `WorkflowAgentsPanel.tsx` | `@/lib/workflow/types.js` | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `WorkflowAgentsPanel.test.tsx` | `../WorkflowAgentsPanel`, `@/lib/workflow/types.js`, vitest, @testing-library/react | `@composio/ao-core`, Sprint Board, tracker-bmad |

### UI Styling Patterns (from existing components)

**Section container:**
```
rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full
```

**Section heading:**
```
text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3
```

**Primary text (displayName):**
```
text-[13px] text-[var(--color-text-primary)]
```

**Secondary text (title):**
```
text-[12px] text-[var(--color-text-secondary)]
```

**Muted text (role description):**
```
text-[11px] text-[var(--color-text-muted)]
```

**CSS Custom Properties available:**
- `--color-bg-base`: #0d1117
- `--color-bg-surface`: rgba(22, 27, 34, 0.8)
- `--color-text-primary`: #e6edf3
- `--color-text-secondary`: #7d8590
- `--color-text-muted`: #484f58
- `--color-border-default`: rgba(48, 54, 61, 1)
- `--color-accent`: #58a6ff (blue)
- `--color-status-success`: #3fb950

### Testing Patterns (from WorkflowAIGuide.test.tsx)

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAgentsPanel } from "../WorkflowAgentsPanel";
import type { AgentInfo } from "@/lib/workflow/types.js";

// Helper to create test agents
function makeAgent(
  name: string,
  displayName: string,
  title: string,
  icon: string,
  role: string,
): AgentInfo {
  return { name, displayName, title, icon, role };
}
```

**Test patterns to follow:**
- Use `render()` + `screen.getByText()` / `screen.getByRole()` for assertions
- Test section `aria-label` with `screen.getByRole("region", { name: "..." })`
- Test heading with `screen.getByRole("heading", { level: 2 })`
- Test sr-only text with `screen.getByText("...")` (sr-only text is still in DOM)
- Group tests in `describe` blocks: "agent rendering", "accessibility", "empty state"

### Previous Story Intelligence

**From Story 8-3 (AI Guide Panel Component — done):**
- Component pattern: section + aria-label + h2 + content + sr-only
- `tierStyles()` consolidation pattern — combine related helpers
- Null state uses contextual message, not generic
- `aria-hidden="true"` on decorative badge spans
- sr-only text pattern: descriptive text for screen readers
- `it.each` for parameterized tests (better failure reporting than forEach)
- AC4 loading state handled at parent level per WD-7 — documented with comment, no test needed
- CSS styling: container, heading, primary/secondary text patterns established
- Combined `import { Type, type Interface }` to avoid ESLint duplicate import error

**From Story 8-2 (Recommendation Engine Tests — done):**
- Implication content assertions added to all rule tests
- First-match-wins test rewritten to be meaningful (not duplicate)
- Real assertions required — no `expect(true).toBe(true)` allowed

**From Story 8-1 (Recommendation Engine — done):**
- `as Phase` casts removed — TypeScript infers correctly
- WD-3 contextual prefixes in observations

**From Story 7-5 (Phase Bar Component — done):**
- WorkflowPhaseBar.test.tsx is the canonical test pattern for Workflow components
- Component pattern: section + aria-label + h2 + content + sr-only
- Empty state: same section wrapper with fallback message

### Sample Agent Data (from actual _bmad/_config/agent-manifest.csv)

The manifest contains ~10 agents. Example entries:

| name | displayName | title | icon | role |
|------|-------------|-------|------|------|
| analyst | Mary | Business Analyst | 📊 | Strategic Business Analyst + Requirements Expert |
| architect | Winston | Architect | 🏗️ | System Architect |
| dev | Amelia | Developer Agent | 💻 | Senior Software Engineer |
| pm | John | Product Manager | 📋 | Product Manager |
| qa | Quinn | QA Engineer | 🧪 | Quality Assurance Engineer |
| sm | Bob | Scrum Master | 🏃 | Agile Scrum Master |
| bmad-master | — | Master Task Executor | 🧙 | Master Task Executor |

Icons are emoji strings (not CSS classes or image URLs). The icon field renders directly as text content.

### Project Structure Notes

**Files to modify:**
```
packages/web/src/
├── components/
│   └── WorkflowAgentsPanel.tsx          # MODIFY: Add title, role, sr-only text, enhanced empty state
```

**Files to create:**
```
packages/web/src/
├── components/
│   └── __tests__/
│       └── WorkflowAgentsPanel.test.tsx  # CREATE: Unit tests (follow WorkflowAIGuide.test.tsx patterns)
```

**Files to read (not modify):**
```
packages/web/src/
├── components/
│   ├── WorkflowAIGuide.tsx              # READ: Component pattern reference (enhanced in 8-3)
│   ├── __tests__/
│   │   ├── WorkflowAIGuide.test.tsx     # READ: Test pattern reference (13 tests)
│   │   └── WorkflowPhaseBar.test.tsx    # READ: Test pattern reference (canonical)
│   └── WorkflowDashboard.tsx            # READ: How AgentsPanel is wired (receives agents prop)
├── lib/
│   └── workflow/
│       ├── types.ts                     # READ: AgentInfo type
│       └── parse-agents.ts             # READ: Parser output shape (for understanding data)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 2.4 Agent Manifest Parser and Agents Panel]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-4 API Contract, WD-5 Agent Discovery, WD-6 Component Architecture, WD-8 File Scanning, WD-G2 CSV Parsing]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR13, FR14, FR15, NFR-A1-A6, NFR-M1, NFR-P5, NFR-P6, NFR-T3]
- [Source: packages/web/src/components/WorkflowAgentsPanel.tsx — Current placeholder (34 lines)]
- [Source: packages/web/src/lib/workflow/parse-agents.ts — CSV parser (70 lines, fully tested)]
- [Source: packages/web/src/lib/workflow/types.ts — AgentInfo interface (frozen)]
- [Source: packages/web/src/lib/workflow/__tests__/parse-agents.test.ts — Parser tests (11 tests)]
- [Source: packages/web/src/components/WorkflowAIGuide.tsx — Component pattern reference]
- [Source: packages/web/src/components/__tests__/WorkflowAIGuide.test.tsx — Test pattern reference]
- [Source: _bmad-output/implementation-artifacts/8-3-ai-guide-panel-component.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean execution, no debugging required.

### Completion Notes List

1. **Task 1 — Display All Fields**: Enhanced each agent list item to show displayName (primary text, 13px) and title (muted text, 11px) below the icon. Changed layout from `items-center` to `items-start` for proper vertical alignment with multi-line content. Added `min-w-0` wrapper div and `shrink-0` on icon for proper flex behavior within 1/3 width constraint.

2. **Task 2 — Empty State**: Distinguished null (no manifest file → "No agent manifest found.") from empty array (file exists but no valid agents → "No agents configured in manifest.") using ternary on `agents === null`.

3. **Task 3 — Accessibility**: Added sr-only text per agent with format "{displayName}, {title}. {role}" for screen readers. Icon spans retain `aria-hidden="true"`. Display text spans (displayName, title, role) marked `aria-hidden="true"` since sr-only provides the accessible name. Semantic `<ul>`/`<li>` markup preserved. No interactive elements in current design, so no focus-ring changes needed.

4. **Task 4 — Unit Tests**: 14 tests across 3 describe blocks: agent rendering (6 tests), empty state (3 tests), accessibility (5 tests). All use real assertions with `@testing-library/react`. Tests cover: displayName, title, icon, role rendering, list item count, single agent, null state message, empty array message, no list when null, aria-label, h2 heading, sr-only text with role, aria-hidden on icons (4 per agent), semantic list markup.

5. **Task 5 — CI Green**: `pnpm lint` clean, `pnpm typecheck` clean, 496 tests passing (14 WorkflowAgentsPanel tests). Zero regressions.

6. **Code Review Fixes** (4 issues fixed):
   - **C1 (CRITICAL)**: Added `agent.role` rendering as `<p>` element with `text-[11px] text-[var(--color-text-secondary)]` styling — AC2 required role display but it was missing
   - **L1**: Fixed aria-hidden assertion from `toBeGreaterThanOrEqual(1)` to `toHaveLength(4)` — icon + displayName + title + role = 4 aria-hidden elements per agent
   - **L2**: Updated sr-only text from `"{displayName}, {title}"` to `"{displayName}, {title}. {role}"` for complete screen reader context
   - **L3**: Added "renders role description for each agent" test for explicit role rendering coverage

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/components/WorkflowAgentsPanel.tsx` | Modified | Added title display, role display, sr-only text with role, aria-hidden on display text, contextual null/empty state, layout improvements |
| `packages/web/src/components/__tests__/WorkflowAgentsPanel.test.tsx` | Created | 14 unit tests covering rendering (including role), empty state, accessibility |
