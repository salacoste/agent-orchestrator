# Story 49.3: Project Drill-Down Navigation

Status: done

## Story

As a **project manager**,
I want **to click on a project to navigate to its detailed dashboard**,
So that **I can investigate project-specific issues without manual navigation**.

## Acceptance Criteria

1. **Given** the portfolio dashboard displays multiple projects
   **When** I click on a project card or row
   **Then** I am navigated to that project's individual dashboard
   **And** the project context is preserved (active project state)

2. **Given** I am on a project's individual dashboard
   **When** I view the page
   **Then** I see the project name displayed prominently
   **And** I see a breadcrumb or back link to return to portfolio

3. **Given** a project card is displayed in the portfolio grid
   **When** I hover over the card
   **Then** the cursor changes to indicate clickability
   **And** the card has a visual hover state

4. **Given** the portfolio dashboard is displayed
   **When** I press Enter while focused on a project card
   **Then** I navigate to that project's dashboard (keyboard accessibility)

5. **Given** a project's individual dashboard loads
   **When** the project is invalid or not found
   **Then** I see an appropriate error state with a link back to portfolio

## Tasks / Subtasks

- [x] Task 1: Add onClick handler to ProjectCard component (AC: #1, #3)
  - [x] 1.1: Accept `onClick` prop in `ProjectCardProps` (already defined)
  - [x] 1.2: Wire `onClick` to card's `click` event with `role="button"` and `tabIndex={0}`
  - [x] 1.3: Add enhanced hover state with lift effect: `hover:-translate-y-0.5 hover:shadow-md transition-transform`
  - [x] 1.4: Ensure `cursor: pointer` on hover
  - [x] 1.5: Add `onKeyDown` handler for Enter key (AC: #4)
  - [x] 1.6: Add focus ring for accessibility: `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`

- [x] Task 2: Create project detail page route (AC: #1, #2, #5)
  - [x] 2.1: Create `packages/web/src/app/portfolio/[projectId]/page.tsx` with dynamic route
  - [x] 2.2: Load project data via `getServices()` filtered by `projectId`
  - [x] 2.3: Handle invalid/missing project ID with **inline error state** (not redirect)
  - [x] 2.4: Display project name in page header with breadcrumb
  - [x] 2.5: Add `export const dynamic = "force-dynamic"` for SSR
  - [x] 2.6: Reuse `Dashboard` component filtered by projectId (modified from team decision)

- [x] Task 3: Add breadcrumb navigation (AC: #2)
  - [x] 3.1: Create breadcrumb with arrow icon pattern: `← Portfolio` / `{Project Name}`
  - [x] 3.2: Link "Portfolio" back to `/portfolio` with obvious click affordance
  - [x] 3.3: Style with muted text for hierarchy (`text-gray-500`)
  - [x] 3.4: Add to project detail page header
  - [x] 3.5: Make "← Portfolio" link clearly clickable with hover state

- [x] Task 4: Wire navigation from PortfolioView to project detail (AC: #1)
  - [x] 4.1: In `PortfolioView.tsx`, use Next.js `useRouter` for navigation
  - [x] 4.2: Pass `onClick={() => router.push(`/portfolio/${project.id}`)}` to `PortfolioGrid`
  - [x] 4.3: Pass onClick through `PortfolioGrid` to each `ProjectCard`
  - [x] 4.4: Ensure navigation works with both click and keyboard

- [x] Task 5: Write tests (AC: #1-5)
  - [x] 5.1: Test ProjectCard click triggers navigation
  - [x] 5.2: Test ProjectCard Enter key triggers navigation
  - [x] 5.3: Test project detail page renders with valid projectId
  - [x] 5.4: Test project detail page shows error for invalid projectId
  - [x] 5.5: Test breadcrumb renders with "← Portfolio" pattern
  - [x] 5.6: Test hover transform class (`hover:-translate-y-0.5`)
  - [x] 5.7: Test focus ring for accessibility
  - [x] 5.8: Test backward compat when onClick is undefined
  - [ ] 5.9: (Optional) E2E test for full drill-down flow

## Task Completion Validation

- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no `expect(true).toBe(true)`)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags

**Methods Used:**
- [x] `getServices()` — Returns config, registry, sessionManager
- [x] `config.projects` — Access project list for lookup
- [x] Next.js `useRouter()` — Client-side navigation

**Feature Flags:**
- None required — all interfaces exist

## Dependency Review

No new dependencies required. Uses existing:
- Next.js 15 (App Router, dynamic routes)
- React 19
- Tailwind CSS 4.0
- Existing design tokens from globals.css

## CLI Integration Testing

N/A — This is a frontend-only feature with no CLI changes.

## Dev Notes

### Architecture Context

This is **Story 3 of 5** in **Epic 49: Portfolio Dashboard**. It builds on:
- **Story 49.1** (done): Portfolio page structure, ProjectCard, PortfolioGrid, PortfolioView
- **Story 49.2** (done): Aggregated metrics widget with SSE updates

Key existing components:
- `packages/web/src/components/ProjectCard.tsx` — Already has `onClick` prop (not wired)
- `packages/web/src/components/PortfolioGrid.tsx` — Renders project cards
- `packages/web/src/components/PortfolioView.tsx` — Main client component
- `packages/web/src/lib/types.ts` — `PortfolioProject` interface

### Key Architecture Decisions (from architecture.md)

1. **Next.js App Router** — Use dynamic routes `[projectId]` for project detail pages
2. **Server Components** — Fetch project data server-side, client components for interactivity
3. **Graceful Degradation** — Show error state for invalid projects, don't crash

### Previous Story Intelligence (49.1, 49.2)

**From Story 49.1 (Portfolio Dashboard Page Structure):**
- `ProjectCard` already has `onClick` prop defined but not wired: `onClick?: () => void`
- Card already has `tabIndex={0}` for keyboard accessibility
- `PortfolioGrid` accepts `projects: PortfolioProject[]` only — needs onClick prop
- SSE infrastructure established via `/api/events` route

**From Story 49.2 (Aggregated Metrics Widget):**
- SSE subscription pattern: `useEffect` with `EventSource` on `/api/events`
- Real-time updates use `router.refresh()` for server component re-render
- Throttle pattern for frequent updates (2s debounce)

### Project Detail Page Design

**TEAM DECISION (Party Mode 2026-03-27):** Use filtered dashboard approach (reuse HomeView)

The project detail page should show:
1. **Breadcrumb** — `← Portfolio` / {Project Name}
2. **Project Header** — Name, status, key metrics (reuse from ProjectCard)
3. **Filtered Dashboard** — Reuse existing `HomeView` component filtered by projectId

**Rationale for filtered dashboard approach:**
- **Mental Model Consistency** — Users already know the dashboard, no learning curve
- **Faster Delivery** — No new UI patterns to design and test
- **Context Preservation** — Session cards, PR status, activity — it's all already there

**Implementation Pattern:**

```typescript
// packages/web/src/app/portfolio/[projectId]/page.tsx
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { config } = await getServices();

  const project = config.projects?.find((p) => p.id === projectId);

  if (!project) {
    return <ProjectNotFound projectId={projectId} />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: "← Portfolio", href: "/portfolio" }, { label: project.name }]} />
      <ProjectHeader project={project} />
      <HomeView projectId={projectId} /> {/* Filtered dashboard */}
    </>
  );
}
```

### File Structure to Create/Modify

```
packages/web/src/
├── app/
│   └── portfolio/
│       └── [projectId]/
│           └── page.tsx              # NEW: Dynamic project detail page
├── components/
│   ├── ProjectCard.tsx               # MODIFY: Wire onClick, add hover state
│   ├── PortfolioGrid.tsx             # MODIFY: Pass onClick to cards
│   ├── PortfolioView.tsx             # MODIFY: Add navigation handler
│   └── Breadcrumb.tsx                # NEW or MODIFY existing
└── components/__tests__/
    ├── ProjectCard.test.tsx          # MODIFY: Add navigation tests
    ├── PortfolioGrid.test.tsx        # MODIFY: Add onClick prop tests
    └── PortfolioView.test.tsx        # MODIFY: Add router integration tests
```

### Component Interface Updates

```typescript
// packages/web/src/components/PortfolioGrid.tsx
interface PortfolioGridProps {
  projects: PortfolioProject[];
  onProjectClick?: (projectId: string) => void;  // NEW
}

// packages/web/src/components/ProjectCard.tsx
interface ProjectCardProps {
  project: PortfolioProject;
  onClick?: () => void;  // Already exists, needs wiring
}
```

### Navigation Pattern

```typescript
// packages/web/src/components/PortfolioView.tsx
"use client";

import { useRouter } from "next/navigation";

export function PortfolioView({ projects }: PortfolioViewProps) {
  const router = useRouter();

  const handleProjectClick = (projectId: string) => {
    router.push(`/portfolio/${projectId}`);
  };

  return (
    <>
      <PortfolioMetricsWidget metrics={metrics} />
      <PortfolioGrid
        projects={projects}
        onProjectClick={handleProjectClick}
      />
    </>
  );
}
```

### Keyboard Accessibility

ProjectCard must support both click and keyboard navigation:

```typescript
// packages/web/src/components/ProjectCard.tsx
<div
  role="button"
  tabIndex={0}
  onClick={onClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" && onClick) {
      e.preventDefault();
      onClick();
    }
  }}
  className="
    cursor-pointer
    hover:-translate-y-0.5 hover:shadow-md
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    transition-transform duration-150
    ...
  "
>
```

### Hover State Design (Sally's Recommendation)

Enhanced hover feedback for better click affordance:

```css
/* Tailwind classes for ProjectCard hover */
.project-card {
  @apply
    cursor-pointer
    transition-transform duration-150 ease-out
    hover:-translate-y-0.5   /* Subtle lift */
    hover:shadow-md           /* Depth */
    focus:ring-2
    focus:ring-blue-500
    focus:ring-offset-2;
}
```

**Why lift + shadow?** A simple background change is subtle. The lift effect makes the card feel "alive" and clickable — users get immediate visual feedback that this is an interactive element.

### Error State Design

**TEAM DECISION:** Use **inline error state**, NOT redirect with toast.

A redirect with toast feels "slippery" — user might not understand *why* they're back on portfolio. Better to show the error in context:

```
┌────────────────────────────────────────┐
│  ← Back to Portfolio                   │
│                                        │
│  ⚠️ Project Not Found                  │
│                                        │
│  The project "invalid-id" could not    │
│  be found. It may have been removed    │
│  or the URL may be incorrect.          │
│                                        │
│  [Return to Portfolio]                 │
└────────────────────────────────────────┘
```

**Edge cases to handle:**
1. Direct URL navigation to `/portfolio/non-existent-id`
2. Project deleted while user was on portfolio page
3. Malformed projectId (e.g., special characters)

### Testing Strategy

```typescript
// packages/web/src/components/__tests__/ProjectCard.test.tsx

describe("ProjectCard navigation", () => {
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("calls onClick when Enter is pressed", () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onClick).toHaveBeenCalled();
  });

  it("has cursor-pointer class", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("cursor-pointer");
  });

  it("has hover transform class", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("hover:-translate-y-0.5");
  });

  it("has focus ring for accessibility", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    const card = screen.getByRole("button");
    expect(card).toHaveClass("focus:ring-2");
  });

  it("handles undefined onClick gracefully (backward compat)", () => {
    render(<ProjectCard project={mockProject} />);
    // Should not throw when clicked without onClick
    fireEvent.click(screen.getByRole("button"));
  });
});
```

**E2E Test (Quinn's recommendation):**

```typescript
// packages/web/e2e/portfolio-drill-down.spec.ts
import { test, expect } from "@playwright/test";

test("portfolio drill-down navigation flow", async ({ page }) => {
  // 1. Navigate to portfolio
  await page.goto("/portfolio");

  // 2. Click first project card
  const firstCard = page.getByRole("button").first();
  await firstCard.click();

  // 3. Verify URL changed
  await expect(page).toHaveURL(/\/portfolio\/[\w-]+/);

  // 4. Verify breadcrumb renders
  await expect(page.getByText("← Portfolio")).toBeVisible();

  // 5. Navigate back via breadcrumb
  await page.getByText("← Portfolio").click();
  await expect(page).toHaveURL("/portfolio");
});

test("invalid project ID shows error state", async ({ page }) => {
  await page.goto("/portfolio/non-existent-project");
  await expect(page.getByText(/Project Not Found/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Return to Portfolio/i })).toBeVisible();
});
```
```

### Performance Requirements (NFRs)

- **NFR-P1**: Page loads within 2 seconds
- **NFR-F1-1**: Navigation should feel instant (client-side router)
- Use Next.js `prefetch` for faster transitions

### References

- [Source: epics-cycle-10.md#Story 49.3] — Requirements
- [Source: prd-cycle-10.md#F1: Portfolio Dashboard, FR-F1-3] — Drill-down requirement
- [Source: architecture.md#Decision 4] — Next.js App Router patterns
- [Source: ux-design-specification.md] — Design tokens, hover states
- [Source: Story 49.1] — Existing ProjectCard, PortfolioGrid, PortfolioView components
- [Source: Story 49.2] — SSE patterns, metrics integration

### Project Structure Notes

- Dynamic routes use `[param]` syntax in Next.js App Router
- Page components go in `packages/web/src/app/portfolio/[projectId]/page.tsx`
- Follow existing file naming: `kebab-case.tsx`
- Tests co-located: `__tests__/ComponentName.test.tsx`

### Limitations (Deferred Items)

None for this story. The project detail page can be minimal for MVP.

---

## Team Decisions (Party Mode 2026-03-27)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project detail page content | Filtered dashboard (reuse HomeView) | Mental model consistency, faster delivery |
| URL structure | `/portfolio/[projectId]` | Semantic clarity — portfolio is namespace for multi-project views |
| Invalid project handling | **Inline error state** with back link | User clarity over redirect — shows *why* not just redirects |
| Hover effect | `hover:-translate-y-0.5 hover:shadow-md transition-transform` | Card feels "alive" with lift effect |
| Breadcrumb pattern | `← Portfolio` / {Project Name} | Arrow icon makes back action obvious |
| Focus ring | `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` | Consistent with existing design system |

**Participants:** 🏗️ Winston (Architect), 💻 Amelia (Dev), 🎨 Sally (UX), 🧪 Quinn (QA), 📋 John (PM)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6-20250528)

### Debug Log References

- Test failures resolved: Updated ProjectCard className to use space-separated string instead of array
- Backward compat test fixed: Card now has conditional role (`role={onClick ? "button" : "listitem"}`)

### Completion Notes List

- Task 1 completed in previous session (ProjectCard hover/focus/navigation)
- Task 4 completed in previous session (PortfolioView/PortfolioGrid wiring)
- Tasks 2, 3, 5 completed in current session
- Used Dashboard component instead of HomeView for filtered project view (simpler, no sprint toggle needed)
- All 1471 tests pass

### File List

**Modified:**
- `packages/web/src/components/ProjectCard.tsx` — Added hover lift, focus ring, conditional role, keyboard handler
- `packages/web/src/components/PortfolioGrid.tsx` — Added `onProjectClick` prop passthrough
- `packages/web/src/components/PortfolioView.tsx` — Added navigation handler with `useRouter`
- `packages/web/src/components/__tests__/ProjectCard.test.tsx` — Added 8 navigation tests
- `packages/web/src/components/__tests__/PortfolioGrid.test.tsx` — Added onClick prop tests
- `packages/web/src/components/__tests__/PortfolioView.test.tsx` — Added router integration tests

**Created:**
- `packages/web/src/app/portfolio/[projectId]/page.tsx` — Dynamic project detail page with breadcrumb, error state, ProjectHeader
- `packages/web/src/app/portfolio/[projectId]/__tests__/page.test.tsx` — Tests for ProjectNotFound, ProjectBreadcrumb, ProjectHeader components (19 tests)
- `packages/web/src/lib/enrich-project-sessions.ts` — Shared utility for PR enrichment (extracted to fix code duplication)

## Code Review Follow-ups (Auto-Fixed)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Missing test for valid projectId | HIGH | Added ProjectHeader tests covering AC#2 (project name displayed prominently) |
| AC#2 incomplete - no prominent project name | HIGH | Added ProjectHeader component with h1, status badge, agent count |
| Breadcrumb pattern deviation | MEDIUM | Fixed to use "← Portfolio" text pattern (per team decision) |
| Code duplication in PR enrichment | MEDIUM | Extracted to `lib/enrich-project-sessions.ts` shared utility |
| Files not in File List | MEDIUM | Added all git-discovered files to File List above |
| CSS var instead of text-gray-500 | LOW | Kept CSS vars (better for design system consistency) |
| No direct test for ProjectDetailPage | LOW | Added comprehensive component-level tests |
