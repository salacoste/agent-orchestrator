# Story 49.5: Project Filtering

Status: done

## Completion Notes

- Added `metadata: Record<string, string>` to FilterState interface for metadata filtering support
- Created `portfolio-filter.ts` with `filterProjects`, `extractAvailableTags`, `extractAvailableMetadata`, `hasActiveFilters`, and `EMPTY_FILTERS` utilities
- Created `PortfolioFilterBar.tsx` with status dropdown, tag toggle buttons, metadata dropdowns, project count display, and clear filters button
- Integrated filtering into `PortfolioView.tsx` with memoized `filteredProjects`, `availableTags`, and `availableMetadata`
- Extracted `ProjectNotFound`, `ProjectBreadcrumb`, `ProjectHeader` to `ProjectDetailComponents.tsx` to fix Next.js App Router page export restriction
- Fixed unused `PortfolioProject` import in `[projectId]/page.tsx`
- Code review fixes: added metadata filter UI (H1), added PortfolioView filter integration tests (H2), added metadata preservation tests (M3), fixed duplicate project count display (M2), updated comment clarity (L1)
- All tests pass (1526+ tests including 25 PortfolioView tests, 18 FilterBar tests, 21 filter utility tests)

## File List

- `packages/web/src/lib/types.ts` — Added `metadata` to FilterState
- `packages/web/src/lib/portfolio-filter.ts` — NEW: Filter utilities with AND logic + extractAvailableMetadata
- `packages/web/src/lib/__tests__/portfolio-filter.test.ts` — NEW: 21 filter utility tests
- `packages/web/src/components/PortfolioFilterBar.tsx` — NEW: Filter bar component with status, tags, metadata, clear
- `packages/web/src/components/__tests__/PortfolioFilterBar.test.tsx` — NEW: 18 filter bar tests (including metadata)
- `packages/web/src/components/PortfolioView.tsx` — Integrated filter state, memoized filtered projects, removed duplicate count
- `packages/web/src/components/__tests__/PortfolioView.test.tsx` — Updated with filter integration tests (25 tests)
- `packages/web/src/components/ProjectDetailComponents.tsx` — NEW: Extracted from page.tsx
- `packages/web/src/app/portfolio/[projectId]/page.tsx` — Removed inline components, fixed unused import
- `packages/core/src/types.ts` — Added tags/metadata to ProjectConfig (Task 1)
- `packages/web/src/lib/portfolio-aggregation.ts` — Pass tags/metadata from config

## Story

As a **project manager**,
I want **to filter projects by tags, status, or custom metadata**,
So that **I can focus on relevant projects when managing a large portfolio**.

## Acceptance Criteria

1. **Given** the portfolio has 10+ projects with various tags and statuses
   **When** I apply a filter (e.g., tag: "production", status: "active")
   **Then** only matching projects are displayed

2. **Given** multiple filters are available
   **When** I apply multiple filters
   **Then** filters are combined with AND logic (all conditions must match)

3. **Given** filters are applied
   **When** I click the clear filters button
   **Then** all filters are reset and all projects are displayed

4. **Given** the portfolio dashboard is displayed
   **When** I view the filter controls
   **Then** I see filter options for status (active/idle/error) and tags (derived from project metadata)

5. **Given** projects have custom metadata in their configuration
   **When** I filter by metadata key-value pairs
   **Then** only projects with matching metadata are displayed

## Tasks / Subtasks

- [x] Task 1: Extend PortfolioProject type for filtering (AC: #1, #4, #5)
  - [x] 1.1: Add `tags?: string[]` to PortfolioProject interface in types.ts
  - [x] 1.2: Add `metadata?: Record<string, string>` to PortfolioProject interface
  - [x] 1.3: Update enrich-project-sessions.ts to include tags and metadata from config

- [x] Task 2: Create FilterState types and utilities (AC: #1, #2)
  - [x] 2.1: Define FilterState interface (status, tags, metadata)
  - [x] 2.3: Create filterProjects utility function with AND logic for multiple filters
  - [x] 2.4: Extract unique tags from all projects for filter dropdown options

- [x] Task 3: Create PortfolioFilterBar component (AC: #1, #3, #4)
  - [x] 3.1: Create components/PortfolioFilterBar.tsx with status filter dropdown
  - [x] 3.2: Add tag filter (multi-select or checkbox group)
  - [x] 3.3: Add clear filters button with visibility based on filter state
  - [x] 3.4: Style filter bar using existing design tokens

- [x] Task 4: Integrate filtering into PortfolioView (AC: #1, #2, #3)
  - [x] 4.1: Add filterState to PortfolioView component
  - [x] 4.2: Memoize filtered projects using useMemo with filterProjects utility
  - [x] 4.3: Pass filtered projects to PortfolioGrid instead of all projects
  - [x] 4.4: Update metrics to reflect filtered projects (optional: show "X of Y" count)
  - [x] 5.5: Update project count display to show filtered/total when filters active

- [x] Task 5: Write tests (AC: #1-5)
  - [x] 5.1: Test filterProjects utility with various filter combinations
  - [x] 5.2: Test AND logic for combined filters
  - [x] 5.3: Test PortfolioFilterBar renders and calls handlers
  - [x] 5.4: Test PortfolioView filters projects correctly
  - [x] 5.5: Test clear filters resets to showing all projects

## Task Completion Validation

- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no `expect(true).toBe(true)`)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags

**Methods Used:**
- [ ] `PortfolioProject` interface — Extended with tags and metadata
- [ ] No new core interfaces required — Pure frontend feature

**Feature Flags:**
- None expected — Uses existing project data infrastructure

## Dependency Review

No new dependencies required. Uses existing:
- React hooks (useState, useMemo, useCallback)
- Existing design tokens from globals.css
- Existing types and utilities

## CLI Integration Testing

N/A — This is a frontend-only feature with no CLI changes.

## Dev Notes

### Architecture Context

This is **Story 5 of 5** in **Epic 49: Portfolio Dashboard**. It builds on:
- **Story 49.1** (done): Portfolio page structure, ProjectCard, PortfolioGrid, PortfolioView
- **Story 49.2** (done): Aggregated metrics widget with basic SSE subscription
- **Story 49.3** (done): Project drill-down navigation with routing
- **Story 49.4** (done): Real-time SSE updates with granular state management

### Previous Story Intelligence (49.1-49.4)

**From Story 49.1:**
- PortfolioProject interface in types.ts - needs tags and metadata fields
- PortfolioView manages local state for projects
- PortfolioGrid renders project cards

**From Story 49.4:**
- PortfolioView uses `projectsRef` to avoid stale closures
- Metrics are calculated via `useMemo` with `calculatePortfolioMetrics`
- Project count is displayed in header

### Current PortfolioProject Interface

```typescript
export interface PortfolioProject {
  id: string;
  name: string;
  status: "active" | "idle" | "error";
  activeAgents: number;
  stories: {
    backlog: number;
    inProgress: number;
    done: number;
    blocked: number;
  };
  lastActivity?: string; // ISO date string
  lastUpdated?: number;  // For highlight animation
}
```

**Needs:** `tags?: string[]` and `metadata?: Record<string, string>`

### Filter Implementation Pattern

```typescript
// Filter state interface
interface FilterState {
  status: PortfolioProject["status"] | null;
  tags: string[];
  metadata: Record<string, string>;
}

// Filter function with AND logic
function filterProjects(
  projects: PortfolioProject[],
  filters: FilterState
): PortfolioProject[] {
  return projects.filter(project => {
    // Status filter
    if (filters.status && project.status !== filters.status) {
      return false;
    }

    // Tags filter (AND logic - all selected tags must be present)
    if (filters.tags.length > 0) {
      const projectTags = project.tags || [];
      if (!filters.tags.every(tag => projectTags.includes(tag))) {
        return false;
      }
    }

    // Metadata filter (AND logic - all key-values must match)
    for (const [key, value] of Object.entries(filters.metadata)) {
      if (project.metadata?.[key] !== value) {
        return false;
      }
    }

    return true;
  });
}
```

### FilterBar Component Pattern

```typescript
// PortfolioFilterBar.tsx
interface PortfolioFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTags: string[];
  projectCount: { filtered: number; total: number };
}

// Use existing design tokens:
// - border-[var(--color-border-default)]
// - bg-[var(--color-bg-surface)]
// - text-[var(--color-text-primary)]
// - text-[var(--color-text-secondary)]
```

### File Structure to Modify

```
packages/web/src/
├── components/
│   ├── PortfolioView.tsx           # MODIFY: Add filter state, integrate filter bar
│   ├── PortfolioFilterBar.tsx      # CREATE: Filter controls
│   ├── PortfolioGrid.tsx           # REVIEW: No changes needed (receives filtered projects)
│   └── __tests__/
│       ├── PortfolioView.test.tsx  # MODIFY: Add filter integration tests
│       └── PortfolioFilterBar.test.tsx # CREATE: Filter bar tests
├── lib/
│   ├── types.ts                    # MODIFY: Add tags/metadata to PortfolioProject
│   ├── portfolio-filter.ts         # CREATE: Filter utilities
│   └── __tests__/
│       └── portfolio-filter.test.ts # CREATE: Filter utility tests
└── app/portfolio/
    └── page.tsx                    # REVIEW: May need to pass tags/metadata from server
```

### Testing Strategy

```typescript
// portfolio-filter.test.ts
describe("filterProjects", () => {
  it("filters by status", () => {
    const result = filterProjects(mockProjects, { status: "active", tags: [], metadata: {} });
    expect(result.every(p => p.status === "active")).toBe(true);
  });

  it("applies AND logic for multiple tags", () => {
    const result = filterProjects(mockProjects, { status: null, tags: ["production", "api"], metadata: {} });
    expect(result.every(p =>
      p.tags?.includes("production") && p.tags?.includes("api")
    )).toBe(true);
  });

  it("returns all projects when no filters applied", () => {
    const result = filterProjects(mockProjects, { status: null, tags: [], metadata: {} });
    expect(result).toHaveLength(mockProjects.length);
  });
});

// PortfolioFilterBar.test.tsx
describe("PortfolioFilterBar", () => {
  it("calls onFiltersChange when status filter changes", () => {
    const onFiltersChange = vi.fn();
    render(<PortfolioFilterBar filters={emptyFilters} onFiltersChange={onFiltersChange} availableTags={[]} projectCount={{ filtered: 5, total: 5 }} />);
    // Select status from dropdown
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "active" } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, status: "active" });
  });

  it("shows clear button only when filters are active", () => {
    const { rerender } = render(<PortfolioFilterBar filters={emptyFilters} onFiltersChange={vi.fn()} availableTags={[]} projectCount={{ filtered: 5, total: 5 }} />);
    expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();

    rerender(<PortfolioFilterBar filters={{ ...emptyFilters, status: "active" }} onFiltersChange={vi.fn()} availableTags={[]} projectCount={{ filtered: 3, total: 5 }} />);
    expect(screen.getByText(/clear/i)).toBeInTheDocument();
  });
});
```

### Performance Requirements (NFRs)

- **NFR-P1**: Portfolio loads within 2 seconds for 50 projects
- **NFR-F1-1**: Filtering should be client-side (no server round-trip)
- Use `useMemo` for filtered results to avoid recalculation on every render

### Accessibility Considerations

- Filter controls must have proper labels (`aria-label` or visible labels)
- Clear button must be keyboard accessible
- Filter state changes should be announced to screen readers (`aria-live`)

### References

- [Source: epics-cycle-10.md#Story 49.5] — Requirements
- [Source: prd-cycle-10.md#F1: Portfolio Dashboard, FR-F1-5] — Filtering requirement
- [Source: Story 49.4] — Current PortfolioView implementation with projectsRef pattern
- [Source: packages/web/src/lib/types.ts] — PortfolioProject interface

### Project Structure Notes

- Follow existing component patterns from Story 49.1-49.4
- Use `var(--color-*)` for theme consistency
- Test file co-location: `__tests__/ComponentName.test.tsx`
- Utility functions in separate files with co-located tests

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
