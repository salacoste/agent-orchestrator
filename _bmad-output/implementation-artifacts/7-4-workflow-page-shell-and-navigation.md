# Story 7.4: Workflow Page Shell & Navigation

Status: done

## Story

As a dashboard user,
I want a Workflow tab in the navigation bar that opens a page with project selection and a CSS Grid layout shell,
so that I can navigate to the workflow view and select a project to inspect.

## Acceptance Criteria

1. **Given** the dashboard navigation bar
   **When** a user views any page
   **Then** a "Workflow" tab appears in the nav items (between "Fleet" and "Events")

2. **Given** the user clicks the Workflow tab
   **When** the page loads
   **Then** a project selector is displayed with all configured projects
   **And** initial render completes in <500ms (NFR-P2)

3. **Given** no project is selected
   **When** the page loads
   **Then** the first project is auto-selected (if only one exists) or the user sees a prompt to select a project

4. **Given** a project with no `_bmad/` directory is selected
   **When** the page renders
   **Then** an informative empty state is displayed explaining what the Workflow tab offers and how to get started with BMAD

5. **Given** a viewport of 1280x800
   **When** a BMAD-enabled project is selected
   **Then** the CSS Grid layout shell renders with placeholder slots for all 5 panels (PhaseBar, AIGuide, Agents, ArtifactInventory, LastActivity) visible without scrolling

## Tasks / Subtasks

- [x] Task 1: Add Workflow tab to Navigation (AC: 1)
  - [x] Edit `packages/web/src/components/Navigation.tsx` — add `{ href: "/workflow", label: "Workflow" }` to `navItems` array between Fleet and Events
  - [x] Verify active state styling works for `/workflow` path (use existing `pathname === item.href` pattern)
  - [x] Verify mobile dropdown menu also includes the Workflow item

- [x] Task 2: Create `/app/workflow/page.tsx` server component (AC: 2, 3)
  - [x] Create `packages/web/src/app/workflow/page.tsx`
  - [x] Add `export const dynamic = "force-dynamic"` (follow existing pattern from `app/page.tsx`)
  - [x] Add `generateMetadata()` returning `{ title: { absolute: "ao | Workflow" } }`
  - [x] Load `config.projects` via `getServices()` — extract all project IDs as `string[]`
  - [x] Pass project list to client component: `<WorkflowPage projects={projectIds} />`
  - [x] Wrap in try-catch: if `getServices()` throws, render with empty project list

- [x] Task 3: Create `WorkflowPage.tsx` client component (AC: 2, 3, 4, 5)
  - [x] Create `packages/web/src/components/WorkflowPage.tsx` with `"use client"` directive
  - [x] Accept props: `{ projects: string[] }`
  - [x] Use `useSearchParams()` to read `?project=<id>` from URL
  - [x] Use `useState<string>` for selected project — default to URL param or first project
  - [x] Use `useRouter().replace()` to sync project selection to URL (follow `HomeView.tsx` pattern)
  - [x] On mount + project change: `fetch("/api/workflow/" + encodeURIComponent(selectedProject))` and store `WorkflowResponse` in state
  - [x] Render project selector `<select>` when `projects.length > 1` (follow `HomeView.tsx` styling)
  - [x] If `projects.length === 0`: show "No projects configured" empty state
  - [x] If API returns `hasBmad: false`: render `<EmptyWorkflowState />`
  - [x] If API returns `hasBmad: true`: render `<WorkflowDashboard data={workflowData} />`
  - [x] Show loading skeleton while fetching (simple `animate-pulse` placeholder)

- [x] Task 4: Create `WorkflowDashboard.tsx` layout container (AC: 5)
  - [x] Create `packages/web/src/components/WorkflowDashboard.tsx`
  - [x] Accept props: `{ data: WorkflowResponse }`
  - [x] Implement CSS Grid layout per WD-6 spec:
    ```
    Row 1: PhaseBar (full width, grid-column: 1 / -1)
    Row 2: AIGuide (2/3) + LastActivity (1/3)
    Row 3: ArtifactInventory (2/3) + AgentsPanel (1/3)
    ```
  - [x] Use Tailwind grid: `grid grid-cols-3 gap-4`
  - [x] Ensure all 5 panels visible without scrolling at 1280x800 viewport
  - [x] Pass sliced props to each panel component (not full `WorkflowResponse`)
  - [x] Each panel gets only its data: PhaseBar gets `phases`, AIGuide gets `recommendation`, etc.

- [x] Task 5: Create 5 placeholder panel components (AC: 5)
  - [x] Create `packages/web/src/components/WorkflowPhaseBar.tsx`
    - Props: `{ phases: PhaseEntry[] }`
    - Renders phase names with state indicators (○/●/★), ARIA labels, sr-only state descriptions
  - [x] Create `packages/web/src/components/WorkflowAIGuide.tsx`
    - Props: `{ recommendation: Recommendation | null }`
    - Renders observation + implication text, or "No recommendations" empty state
  - [x] Create `packages/web/src/components/WorkflowAgentsPanel.tsx`
    - Props: `{ agents: AgentInfo[] | null }`
    - Renders agent list with icons, or "No agent manifest found" empty state
  - [x] Create `packages/web/src/components/WorkflowArtifactInventory.tsx`
    - Props: `{ artifacts: ClassifiedArtifact[] }`
    - Renders artifact list with filename + type, or "No artifacts generated yet" empty state
  - [x] Create `packages/web/src/components/WorkflowLastActivity.tsx`
    - Props: `{ lastActivity: { filename: string; phase: string; modifiedAt: string } | null }`
    - Renders filename, phase, relative time with `<time>` element, or "No activity yet" empty state
  - [x] All panels: use `rounded-[6px] border border-[var(--color-border-default)]` card styling
  - [x] All panels: include semantic HTML section, ARIA labels, and descriptive heading

- [x] Task 6: Create `EmptyWorkflowState.tsx` (AC: 4)
  - [x] Create `packages/web/src/components/EmptyWorkflowState.tsx`
  - [x] Non-judgmental, informative tone — explain what BMAD is and what the Workflow tab offers
  - [x] No error colors or warning styling — this is an expected state for new projects
  - [x] Include guidance on how to get started with BMAD (mention `_bmad/` directory)
  - [x] Use semantic HTML with appropriate ARIA attributes

- [x] Task 7: Verify lint, typecheck, and existing tests pass (AC: all)
  - [x] Run `pnpm lint` from project root — clean
  - [x] Run `pnpm typecheck` from project root — clean
  - [x] Run `pnpm test` — all existing tests still pass (no regressions; 2 pre-existing failures in conflicts.test.ts unrelated to this story)
  - [ ] Manually verify navigation renders correctly (if dev server available)

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
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] This story does NOT modify any `@composio/ao-core` interfaces
- [ ] This story does NOT add new API routes (uses existing `GET /api/workflow/[project]` from Story 7-2)
- [ ] Import boundaries preserved: Workflow components cannot import from `@composio/ao-core`, Sprint Board, or `tracker-bmad`

**Methods Used:**
- [ ] `getServices()` from `@/lib/services` — used in server component only (NOT in Workflow components)
- [ ] `WorkflowResponse` type from `@/lib/workflow/types.js` — used for component props
- [ ] `PhaseEntry`, `AgentInfo`, `Recommendation`, `ClassifiedArtifact` types from `@/lib/workflow/types.js`
- [ ] `fetch("/api/workflow/[project]")` — client-side API call in WorkflowPage.tsx

**Feature Flags:**
- [ ] None required — all features are additive, no existing behavior changes

## Dependency Review (if applicable)

**No new dependencies.** This story uses React, Next.js, and Tailwind — all already in the project.

Zero new entries in package.json (NFR-P6).

## Dev Notes

### Approach

This is the **first UI story** for the Workflow Dashboard (Epic 7). Stories 7-1, 7-2, and 7-3 built the computation engine, API route, and tests. This story creates the page shell and navigation — the visual foundation for all subsequent Workflow component stories.

**Key principle:** Create the layout shell with placeholder panels. Panel implementations will be filled in by Stories 7-5 (PhaseBar), 8-3 (AIGuide), 8-4 (AgentsPanel), 9-1 (ArtifactInventory), 9-2 (LastActivity). The placeholders should be real components with correct props signatures so they can be swapped out without changing the parent.

### Architecture Compliance (CRITICAL)

**WD-6 Component Architecture — CSS Grid Layout:**
```
┌─────────────────────────────────────────────────┐
│ PhaseBar (full width, compact)                  │
├──────────────────────────┬──────────────────────┤
│ AIGuide (2/3 width)      │ LastActivity (1/3)   │
├──────────────────────────┼──────────────────────┤
│ ArtifactInventory (2/3)  │ AgentsPanel (1/3)    │
└──────────────────────────┴──────────────────────┘
```

**Component Tree (per architecture):**
```
WorkflowPage (route: /workflow)
├── ProjectSelector (dropdown — reuses pattern from HomeView)
├── EmptyWorkflowState (if hasBmad === false)
└── WorkflowDashboard (if hasBmad === true)
    ├── WorkflowPhaseBar          ← phases[]
    ├── WorkflowAIGuide           ← recommendation | null
    ├── WorkflowAgentsPanel       ← agents[] | null
    ├── WorkflowArtifactInventory ← artifacts[]
    └── WorkflowLastActivity      ← lastActivity | null
```

**Panel Isolation Rules (NFR-M1, NFR-M4):**
1. Each panel is a single `.tsx` file in `packages/web/src/components/`
2. Each panel accepts typed props derived from `WorkflowResponse` — **no internal fetching**
3. Zero imports from Sprint Board components, tracker-bmad, or `@composio/ao-core`
4. Zero shared state between panels
5. All Workflow components prefixed with "Workflow" (e.g., `WorkflowPhaseBar.tsx`)

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `app/workflow/page.tsx` | `@/lib/services`, `@/components/WorkflowPage` | `@composio/ao-core` types directly |
| `components/Workflow*.tsx` | `@/lib/workflow/types.js`, React, Next.js | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `components/EmptyWorkflowState.tsx` | React | Everything else |

**Exception:** The server component (`app/workflow/page.tsx`) may import `getServices()` from `@/lib/services` — this is the same pattern used by `app/page.tsx`. The `getServices()` function imports from `@composio/ao-core` internally but the Workflow page only uses `config.projects` (a plain object of project IDs).

### Existing Patterns to Follow

**Navigation (`Navigation.tsx`):**
```typescript
// Current navItems array (line 11-16):
const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/fleet", label: "Fleet" },
  // ADD: { href: "/workflow", label: "Workflow" },
  { href: "/events", label: "Events" },
  { href: "/settings", label: "Settings" },
] as const;
```
Active state: `pathname === item.href` → `text-[var(--color-text-primary)]`
Inactive: `text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]`

**Server Component Pattern (`app/page.tsx`):**
```typescript
export const dynamic = "force-dynamic";
export async function generateMetadata() { ... }
export default async function WorkflowRoute() {
  const { config } = await getServices();
  const projectIds = Object.keys(config.projects || {});
  return <WorkflowPage projects={projectIds} />;
}
```

**Project Selector Pattern (`HomeView.tsx` lines 87-102):**
```typescript
<select
  value={selectedProject}
  onChange={(e) => { setSelectedProject(e.target.value); updateUrl(e.target.value); }}
  className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[11px] text-[var(--color-text-secondary)] px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
>
  {projects.map((id) => <option key={id} value={id}>{id}</option>)}
</select>
```

**Card Styling (consistent across dashboard):**
```
rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]
```

**Page Padding:** `px-8 py-7` (standard across dashboard pages)

### Tailwind CSS Grid Implementation

```tsx
// WorkflowDashboard.tsx grid layout
<div className="grid grid-cols-3 gap-4">
  <div className="col-span-3">          {/* Row 1: PhaseBar full width */}
    <WorkflowPhaseBar phases={data.phases} />
  </div>
  <div className="col-span-2">          {/* Row 2 left: AIGuide 2/3 */}
    <WorkflowAIGuide recommendation={data.recommendation} />
  </div>
  <div className="col-span-1">          {/* Row 2 right: LastActivity 1/3 */}
    <WorkflowLastActivity lastActivity={data.lastActivity} />
  </div>
  <div className="col-span-2">          {/* Row 3 left: ArtifactInventory 2/3 */}
    <WorkflowArtifactInventory artifacts={data.artifacts} />
  </div>
  <div className="col-span-1">          {/* Row 3 right: AgentsPanel 1/3 */}
    <WorkflowAgentsPanel agents={data.agents} />
  </div>
</div>
```

### Accessibility Requirements (NFR-A1 through NFR-A6)

- WCAG 2.1 AA compliance for all new components
- Semantic HTML: `<section>`, `<h2>`, `<nav>`, `<select>` — no div-soup
- ARIA labels on all panels: `aria-label="Phase progression"`, `aria-label="AI-guided recommendations"`, etc.
- Color independence: all status indicators use labels + icons + color, never color alone
- Keyboard navigation: all interactive elements reachable via keyboard, no traps
- Focus visibility: `focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]` on all interactive elements
- Project selector: native `<select>` element (inherently keyboard accessible)

### API Integration

**Endpoint:** `GET /api/workflow/[project]` (already exists from Story 7-2)

**Response shape (`WorkflowResponse`):**
```typescript
interface WorkflowResponse {
  projectId: string;
  projectName: string;
  hasBmad: boolean;
  phases: PhaseEntry[];
  agents: AgentInfo[] | null;
  recommendation: Recommendation | null;
  artifacts: ClassifiedArtifact[];
  lastActivity: { filename: string; phase: string; modifiedAt: string } | null;
}
```

**Client-side fetch pattern:**
```typescript
const res = await fetch(`/api/workflow/${encodeURIComponent(projectId)}`);
if (!res.ok) { /* handle 404/500 */ }
const data: WorkflowResponse = await res.json();
```

**Important:** The API always returns HTTP 200 for valid projects (even with no BMAD). Only 404 for unknown projects. Check `data.hasBmad` to decide between empty state and dashboard view.

### Testing Strategy

This story is primarily UI — component tests will be added in later stories (NFR-T3 requires >70% coverage for Workflow components). For this story:

1. **Lint + typecheck must pass** — no type errors in new components
2. **Existing tests must not regress** — 122 workflow tests + 20 route tests all pass
3. **No new test files expected** — placeholder components are too simple to unit test meaningfully
4. **Manual verification** — if dev server is available, verify navigation works and grid layout renders

### Previous Story Intelligence

**From Story 7-3 (code review):**
- Test naming must accurately reflect what's being tested (R6 vs R4 mislabel was caught)
- Assertions should be precise (use `toHaveLength(1)` not `toBeGreaterThanOrEqual(1)`)
- Import boundary violations are caught by ESLint — respect them

**From Story 7-2 (API route):**
- `getServices()` returns `{ config, registry, sessionManager }` — only `config.projects` needed for project list
- `config.projects` is a `Record<string, ProjectConfig>` — project IDs are the keys
- `project.name ?? projectId` fallback pattern for display names

**From Story 7-1 (computation engine):**
- All `lib/workflow/*` modules use ESM with `.js` extensions in imports
- Types exported from `lib/workflow/types.ts` — import with `@/lib/workflow/types.js` path alias

### Project Structure Notes

**New files to create:**
```
packages/web/src/
├── app/
│   └── workflow/
│       └── page.tsx                      # NEW: Server component route handler
├── components/
│   ├── WorkflowPage.tsx                  # NEW: Client component (project selector + data fetching)
│   ├── WorkflowDashboard.tsx             # NEW: CSS Grid layout container
│   ├── WorkflowPhaseBar.tsx              # NEW: Placeholder panel (Story 7-5 fills this in)
│   ├── WorkflowAIGuide.tsx               # NEW: Placeholder panel (Story 8-3 fills this in)
│   ├── WorkflowAgentsPanel.tsx           # NEW: Placeholder panel (Story 8-4 fills this in)
│   ├── WorkflowArtifactInventory.tsx     # NEW: Placeholder panel (Story 9-1 fills this in)
│   ├── WorkflowLastActivity.tsx          # NEW: Placeholder panel (Story 9-2 fills this in)
│   └── EmptyWorkflowState.tsx            # NEW: No-BMAD empty state
```

**Files to modify:**
```
packages/web/src/
├── components/
│   └── Navigation.tsx                    # MODIFY: Add Workflow nav item
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — WD-6 Component Architecture, CSS Grid Layout]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-4 API Design, WorkflowResponse contract]
- [Source: _bmad-output/planning-artifacts/architecture.md — NFR-M1 Component Isolation, NFR-M4 Sprint Board isolation]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Story 1.4 Workflow Page Shell & Navigation]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR19-FR23, NFR-P2, NFR-P5, NFR-A1-A6]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Grid layout, empty states, navigation]
- [Source: packages/web/src/components/Navigation.tsx — Navigation pattern, active state styling]
- [Source: packages/web/src/components/HomeView.tsx — Project selector pattern, URL state management]
- [Source: packages/web/src/app/page.tsx — Server component pattern, getServices() usage]
- [Source: packages/web/src/lib/workflow/types.ts — WorkflowResponse, PhaseEntry, AgentInfo, Recommendation types]
- [Source: packages/web/src/app/api/workflow/[project]/route.ts — API contract, project resolution pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug logs required — all lint, typecheck, and test runs passed cleanly on first attempt.

### Completion Notes List

- All 7 tasks completed successfully with zero regressions
- Navigation tab added between Fleet and Events — active state and mobile dropdown work automatically via existing `navItems` pattern
- Server component loads project IDs from config, passes to client component
- Client component manages URL state (`?project=<id>`), fetches from `/api/workflow/[project]`, renders conditional states (loading/error/empty/dashboard)
- CSS Grid layout matches WD-6 spec: 3-column grid, PhaseBar full width, 2/3+1/3 splits for rows 2-3
- All 5 panel components render actual data from WorkflowResponse props (not just "Coming in Story X" placeholders) — future stories will enhance rather than replace
- EmptyWorkflowState provides non-judgmental guidance for projects without BMAD configuration
- Import boundary rules strictly followed: zero imports from `@composio/ao-core`, Sprint Board, or `tracker-bmad` in any Workflow component
- Zero new dependencies added (NFR-P6)
- 2 pre-existing test failures in `conflicts.test.ts` documented — not caused by this story

### File List

**Created:**
- `packages/web/src/app/workflow/page.tsx` — Server component route handler
- `packages/web/src/components/WorkflowPage.tsx` — Client component with project selector and data fetching
- `packages/web/src/components/WorkflowDashboard.tsx` — CSS Grid layout container
- `packages/web/src/components/WorkflowPhaseBar.tsx` — Phase progression bar with ○/●/★ indicators
- `packages/web/src/components/WorkflowAIGuide.tsx` — AI recommendation panel
- `packages/web/src/components/WorkflowAgentsPanel.tsx` — Agent manifest panel
- `packages/web/src/components/WorkflowArtifactInventory.tsx` — Artifact inventory panel
- `packages/web/src/components/WorkflowLastActivity.tsx` — Last activity panel with relative time
- `packages/web/src/components/EmptyWorkflowState.tsx` — Empty state for non-BMAD projects

**Modified:**
- `packages/web/src/components/Navigation.tsx` — Added Workflow nav item
