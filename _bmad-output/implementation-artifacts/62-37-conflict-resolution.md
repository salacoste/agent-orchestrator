# Story 62.37: Conflict Resolution

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Conflict Resolution documentation page that documents the conflict detection system, resource conflict types and severity, resolution workflows with suggestions, policy configuration hierarchy, conflict history with pattern analysis, file-level conflict detection, agent assignment conflict detection, real-time SSE updates, and the complete conflict API surface,
so that I can understand how conflicts are detected across resource types (repository, file-path, agent, external-service), how severity is computed, how policies are resolved through a 4-level hierarchy, how suggestions are generated per strategy and resource type, how history is persisted and queried with filters, and how each component connects to backend APIs and core engine modules.

## Acceptance Criteria

1. **Conflict Resolution page** (`docs/web-dashboard/conflict-resolution.md`) documents an "Overview" section describing the conflicts page at `/conflicts` with 3-tab layout (Active, History, Policies), server component data loading, and `force-dynamic` rendering — sourced from `packages/web/src/app/conflicts/page.tsx` and `client.tsx`
2. **Conflict Resolution page** documents a "Resource Conflict Detection" section describing `detectResourceConflicts()` with O(n) hash map grouping by (type, identifier), `extractProjectResources()` extracting repo/file-path/agent resources from config, `computeConflictSeverity()` severity model (agent always critical, repo high/critical, file-path medium/high, external-service low/medium), and `checkResourceConflicts()` as the main entry point — sourced from `packages/core/src/resource-conflict.ts`
3. **Conflict Resolution page** documents a "Conflict Types" section describing the 4 resource types (`repository`, `file-path`, `agent`, `external-service`), severity levels (`critical`, `high`, `medium`, `low`), `ResourceConflict` shape (7 fields), `ProjectResource` shape, and `ResourceConflictType`/`ResourceConflictSeverity` string unions — sourced from `packages/core/src/resource-conflict.ts`
4. **Conflict Resolution page** documents an "Active Conflicts Dashboard" section describing `ConflictAlertDashboard` with SSE subscription via `useConflictSSE`, `ConflictSummaryCards` (4-card grid: Total, Critical/High, By Severity, By Resource Type), `ConflictListView` with resource-type and severity filter dropdowns, `ConflictSeverityBadge` (color-coded: critical=red, high=orange, medium=yellow, low=green), and "New" badge for real-time arrivals — sourced from `packages/web/src/components/ConflictAlertDashboard.tsx`, `ConflictSummaryCards.tsx`, `ConflictListView.tsx`, `ConflictSeverityBadge.tsx`
5. **Conflict Resolution page** documents a "Conflict Detail Panel" section describing `ConflictDetailPanel` as a slide-over (right-aligned, max-w-md, Escape/backdrop close) showing severity badge, resource type with label mapping, resource identifier (mono), competing projects list, detected timestamp, metadata key-value pairs, and resolution suggestions — sourced from `packages/web/src/components/ConflictDetailPanel.tsx`
6. **Conflict Resolution page** documents a "Resolution Suggestions" section describing `generateSuggestions()` pure function, `ResourceConflictResolutionStrategy` (5 strategies: sequential-scheduling, resource-isolation, agent-reassignment, increase-capacity, stagger-schedules), strategy-to-resource-type mapping (repository→sequential+isolation+stagger, agent→reassignment+capacity+stagger, file-path→sequential+isolation, external-service→stagger+capacity), recommended strategy by severity (critical→resource-isolation, high→sequential-scheduling, medium→stagger-schedules, low→none), `SuggestionAction` types (config-change, agent-operation, schedule-change), and `ConflictSuggestionsList` component — sourced from `packages/core/src/resource-conflict-suggestions.ts` and `packages/web/src/components/ConflictSuggestionsList.tsx`
7. **Conflict Resolution page** documents a "Conflict Resolution" section describing the `POST /api/conflicts/[conflictId]` endpoint with 3 action types (keep-existing, replace-with-new, manual), mock response behavior (not yet wired to real resolution service), `ConflictResolutionService` with tie-breaker logic (recent vs progress), auto-resolve threshold (0.3), and project-specific config overrides — sourced from `packages/web/src/app/api/conflicts/[conflictId]/route.ts` and `packages/core/src/conflict-resolution.ts`
8. **Conflict Resolution page** documents a "Policy Configuration" section describing `ConflictPolicyPanel` with per-resource-type mode selector (priority-based, manual, isolation), 4-level policy resolution hierarchy (project-type override → project-default → global-default → hardcoded "manual"), `applyPolicy()` behavior per mode (manual=no action, priority-based=winner selection, isolation=resource-type-specific plan), and in-memory config update via `PUT /api/conflicts/policies/[resourceType]` — sourced from `packages/web/src/components/ConflictPolicyPanel.tsx` and `packages/core/src/conflict-policy.ts`
9. **Conflict Resolution page** documents a "Conflict History" section describing `ConflictHistoryView` with `ConflictHistoryFilters` (5 filters: dateFrom, dateTo, resourceType, projectId, outcome), `ConflictPatternSummary` (4-card grid: Total Resolved, Avg Resolution Time, Most Conflicted Resource, Recurring Conflicts), `ConflictHistoryList` with `OutcomeBadge` (resolved=green, auto-resolved=blue, dismissed=gray, escalated=red), JSON export via `/api/conflicts/history/export`, and JSONL persistence at `conflict-history.jsonl` — sourced from `packages/web/src/components/ConflictHistoryView.tsx`, `packages/core/src/conflict-history.ts`
10. **Conflict Resolution page** documents a "Project Conflict Table" section describing `ConflictHistoryTable` with per-project conflict listing, summary cards (Total, Critical/High, Medium, Low), sort options (recency/frequency), export formats (CSV/JSON), HTML table with conflict ID, story, agents, severity, detection time, resolution status, and detail modal with priority scores — sourced from `packages/web/src/components/ConflictHistoryTable.tsx`
11. **Conflict Resolution page** documents a "File Conflict Detection" section describing `detectFileConflicts()` O(n) hash map algorithm, `AgentFileChange` merging from learning store + session metadata, `useConflictCheckpoint` hook with 30-second polling, `ConflictCheckpointPanel` showing file conflicts with agent pairs and rollback capability, and `Cache-Control: no-cache, no-store, must-revalidate` — sourced from `packages/web/src/lib/workflow/conflict-detector.ts` and `packages/web/src/components/ConflictCheckpointPanel.tsx`
12. **Conflict Resolution page** documents an "Agent Assignment Conflicts" section describing `ConflictDetectionServiceImpl` with priority scoring formula (base 0.5 + time bonus max +0.3 + agent type bonus 0.1/0.05 − retry penalty max −0.2, clamped 0–1), severity thresholds (>0.7 critical, score diff <0.2 high, <0.5 medium, else low), auto-resolve at 0.3 threshold, startup conflict detection, and `createConflictDetectionService()` factory — sourced from `packages/core/src/conflict-detection.ts`
13. **Conflict Resolution page** documents a "Real-Time Updates" section describing SSE subscription via `useConflictSSE` hook with `conflict-detected` event type, globalThis singleton pub/sub pattern in `conflict-broadcaster.ts`, `detectAndBroadcast()` filtering to new-only conflicts by ID dedup, and EventSource auto-reconnect — sourced from `packages/web/src/hooks/useConflictSSE.ts` and `packages/web/src/lib/conflict-broadcaster.ts`
14. **Conflict Resolution page** documents a "Persistence" section describing YAML-backed `ResourceConflictFileStore` at `resource-conflicts.yaml`, JSONL audit trail at `resource-conflicts-audit.jsonl`, JSONL history at `conflict-history.jsonl`, file validation on read, and private cache in `ResourceConflictFileStore` class — sourced from `packages/core/src/resource-conflict.ts` and `packages/core/src/conflict-history.ts`
15. **Conflict Resolution page** documents an "API Routes" section listing all 10 endpoints: `GET /api/conflicts`, `POST /api/conflicts/[conflictId]`, `GET /api/conflicts/[conflictId]/suggestions`, `GET /api/conflicts/history`, `GET /api/conflicts/history/export`, `GET /api/conflicts/policies`, `GET/PUT /api/conflicts/policies/[resourceType]`, `GET /api/sprint/conflicts`, `GET /api/sprint/[project]/conflicts` — with method, purpose, query params, body shape, validation rules, and response shapes
16. **Conflict Resolution page** documents a "Key Types" section listing: `ResourceConflict` (7 fields), `ResourceConflictType` (4 values), `ResourceConflictSeverity` (4 values), `ResourceConflictPolicy` (5 fields), `ResourceConflictSuggestion` (7 fields), `ConflictResolutionMode` (3 values), `ConflictHistoryEntry` (7 fields), `ConflictPatternSummary` (7 fields), `ConflictHistoryFilter` (5 fields), `FileConflict` (3 fields), `AgentConflictEvent` (7 fields), `AgentConflictResolution` (3 fields), `SuggestionAction` (2 fields) — sourced from `packages/core/src/resource-conflict.ts`, `packages/core/src/resource-conflict-suggestions.ts`, `packages/core/src/conflict-history.ts`, `packages/core/src/conflict-policy.ts`, `packages/core/src/types.ts`
17. **Page uses correct Just the Docs front matter**: `title: Conflict Resolution`, `nav_order: 5`, `parent: Web Dashboard`, `description` field
18. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
19. **Cross-links** verified: parent link to Web Dashboard index, sibling links to other Web Dashboard child pages, Conflicts API (62.47), Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Conflict Resolution page (AC: #1-19)
  - [x] Replace stub content in docs/web-dashboard/conflict-resolution.md
  - [x] Write front matter (title, nav_order: 5, parent: Web Dashboard, description)
  - [x] Write "Overview" section — 3-tab layout, server component, force-dynamic (AC #1)
  - [x] Write "Resource Conflict Detection" section — hash map grouping, severity model, main entry point (AC #2)
  - [x] Write "Conflict Types" section — 4 resource types, severity levels, type shapes (AC #3)
  - [x] Write "Active Conflicts Dashboard" section — SSE, summary cards, list view, severity badges (AC #4)
  - [x] Write "Conflict Detail Panel" section — slide-over, metadata, suggestions (AC #5)
  - [x] Write "Resolution Suggestions" section — 5 strategies, mapping, recommended by severity, actions (AC #6)
  - [x] Write "Conflict Resolution" section — 3 action types, tie-breaker, auto-resolve threshold (AC #7)
  - [x] Write "Policy Configuration" section — 4-level hierarchy, 3 modes, per-resource-type config (AC #8)
  - [x] Write "Conflict History" section — filters, pattern summary, outcome badges, export, JSONL (AC #9)
  - [x] Write "Project Conflict Table" section — per-project listing, sort, export, detail modal (AC #10)
  - [x] Write "File Conflict Detection" section — O(n) algorithm, checkpoint polling, cache headers (AC #11)
  - [x] Write "Agent Assignment Conflicts" section — priority scoring, severity thresholds, auto-resolve (AC #12)
  - [x] Write "Real-Time Updates" section — SSE hook, broadcaster singleton, dedup (AC #13)
  - [x] Write "Persistence" section — YAML store, JSONL audit, JSONL history (AC #14)
  - [x] Write "API Routes" section — 10 endpoints with method/purpose/params/validation/response (AC #15)
  - [x] Write "Key Types" section — all conflict-related types with field counts (AC #16)
  - [x] Write "Next Steps" cross-links section (AC #19)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All 22 subtasks checked off
- `docs/web-dashboard/conflict-resolution.md` exists with comprehensive content
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages

## Source Files

### Page Routes (Server Components)
- `packages/web/src/app/conflicts/page.tsx` — conflicts page (server component)
- `packages/web/src/app/conflicts/client.tsx` — 3-tab client layout

### Components
- `packages/web/src/components/ConflictAlertDashboard.tsx` — active conflicts dashboard with SSE
- `packages/web/src/components/ConflictListView.tsx` — filterable conflict list
- `packages/web/src/components/ConflictDetailPanel.tsx` — slide-over detail panel
- `packages/web/src/components/ConflictSummaryCards.tsx` — 4-card summary grid
- `packages/web/src/components/ConflictSeverityBadge.tsx` — color-coded severity badge
- `packages/web/src/components/ConflictSuggestionsList.tsx` — resolution suggestions cards
- `packages/web/src/components/ConflictHistoryView.tsx` — history tab with filters + export
- `packages/web/src/components/ConflictHistoryFilters.tsx` — 5-filter control bar
- `packages/web/src/components/ConflictHistoryList.tsx` — history entry card list
- `packages/web/src/components/ConflictHistoryTable.tsx` — per-project conflict table
- `packages/web/src/components/ConflictPatternSummary.tsx` — pattern stats cards
- `packages/web/src/components/ConflictPolicyPanel.tsx` — policy configuration panel
- `packages/web/src/components/ConflictCheckpointPanel.tsx` — file conflict + checkpoint panel

### API Routes
- `packages/web/src/app/api/conflicts/route.ts` — GET list/scan
- `packages/web/src/app/api/conflicts/[conflictId]/route.ts` — POST resolve
- `packages/web/src/app/api/conflicts/[conflictId]/suggestions/route.ts` — GET suggestions
- `packages/web/src/app/api/conflicts/history/route.ts` — GET history with filters
- `packages/web/src/app/api/conflicts/history/export/route.ts` — GET export download
- `packages/web/src/app/api/conflicts/history/filter-utils.ts` — shared filter parser
- `packages/web/src/app/api/conflicts/policies/route.ts` — GET all policies
- `packages/web/src/app/api/conflicts/policies/[resourceType]/route.ts` — GET/PUT single policy
- `packages/web/src/app/api/sprint/conflicts/route.ts` — GET file conflicts
- `packages/web/src/app/api/sprint/[project]/conflicts/route.ts` — GET project conflicts + export

### Core Engine
- `packages/core/src/resource-conflict.ts` — detection, severity, store, audit trail
- `packages/core/src/resource-conflict-suggestions.ts` — suggestion generation, strategy mapping
- `packages/core/src/conflict-history.ts` — history persistence, filtering, patterns, export
- `packages/core/src/conflict-policy.ts` — policy resolution hierarchy, apply
- `packages/core/src/conflict-detection.ts` — agent assignment conflict service
- `packages/core/src/conflict-resolution.ts` — resolution service with tie-breaker
- `packages/core/src/conflict-resolver.ts` — state conflict resolver (detect/resolve/merge)
- `packages/core/src/conflict-wizard.ts` — merge analysis and suggestions
- `packages/core/src/conflict-notification.ts` — notification integration
- `packages/core/src/conflict-metrics.ts` — metrics recording and summaries
- `packages/core/src/conflict-patterns.ts` — pattern analysis and prevention

### Hooks
- `packages/web/src/hooks/useConflictSSE.ts` — SSE subscription hook
- `packages/web/src/hooks/useConflictCheckpoint.ts` — 30s polling hook

### Lib
- `packages/web/src/lib/conflict-sse-constants.ts` — SSE event type constant
- `packages/web/src/lib/conflict-broadcaster.ts` — globalThis singleton pub/sub
- `packages/web/src/lib/workflow/conflict-detector.ts` — file conflict detection

### Types
- `packages/core/src/types.ts` — ConflictResolver, ConflictDetectionService, ConflictResolutionService interfaces
- `packages/web/src/lib/types.ts` — ResourceConflict re-exports

## Change Log

- 2026-04-25: Story created from sprint backlog
- 2026-04-25: Wrote comprehensive conflict-resolution.md documentation covering all 19 ACs
- 2026-04-25: Adversarial code review — 15 claims verified (14 accurate, 1 inaccurate). Fixed 3 issues: priority scoring base for unassigned agents (medium), resolutionStrategy type precision, byStrategy type precision

## Dev Notes

### Architecture Patterns (from Story 62-36 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Web Dashboard index, sibling links, related advanced topics and API docs
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files; annotate forward references with *(upcoming)*
- Adversarial code review should verify exact constants, thresholds, and type shapes against source code

### Source Tree Components

- 13 UI components under `packages/web/src/components/Conflict*.tsx`
- 2 page routes under `packages/web/src/app/conflicts/`
- 10 API route files under `packages/web/src/app/api/conflicts/` and `packages/web/src/app/api/sprint/`
- 11 core engine modules under `packages/core/src/conflict-*.ts` and `packages/core/src/resource-conflict*.ts`
- 2 hooks under `packages/web/src/hooks/useConflict*.ts`
- 3 lib files under `packages/web/src/lib/`

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all type field counts match actual TypeScript interfaces
- Verify API endpoint parameters and response shapes match route implementations
- Confirm severity model thresholds match `computeConflictSeverity()` logic
- Validate policy hierarchy matches `resolvePolicyForResource()` implementation

### Project Structure Notes

- Doc file location: `docs/web-dashboard/conflict-resolution.md`
- Nav order: 5 (after Scenario Comparison at nav_order: 4)
- Sibling pages: index.md (0), portfolio-view.md (1), sprint-board.md (2), session-detail.md (3), scenario-comparison.md (4)

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.37]
- [Source: packages/web/src/app/conflicts/page.tsx]
- [Source: packages/web/src/app/conflicts/client.tsx]
- [Source: packages/core/src/resource-conflict.ts]
- [Source: packages/core/src/resource-conflict-suggestions.ts]
- [Source: packages/core/src/conflict-history.ts]
- [Source: packages/core/src/conflict-policy.ts]
- [Source: packages/core/src/conflict-detection.ts]
- [Source: packages/core/src/conflict-resolution.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes

- Wrote `docs/web-dashboard/conflict-resolution.md` replacing stub with comprehensive documentation (~350 lines)
- All 19 acceptance criteria covered across 16 documentation sections
- Documented 2 page routes, 10 API endpoints, 13 components, 11 core engine modules, 2 hooks, 3 lib files
- Front matter includes `description` field (was missing from stub)
- Cross-links: 7 of 8 resolve to existing files; `docs/api/conflicts.md` is a forward reference to story 62-47 (backlog), annotated *(upcoming)*
- No hero font classes used
- Source analysis from 2 parallel subagents provided exhaustive API/component/type coverage
- Adversarial code review: 15 specific claims verified against source code (14 accurate, 1 inaccurate). Fixed priority scoring base (0.3 for unassigned vs 0.5 for assigned), resolutionStrategy type, byStrategy type

### File List

- `docs/web-dashboard/conflict-resolution.md` — replaced stub with comprehensive documentation
