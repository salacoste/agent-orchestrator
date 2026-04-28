# Story 62.19: Tracker Plugin Pages (github, linear, bmad)

Status: done

## Story

As a developer using Agent Orchestrator,
I want detailed documentation pages for the three tracker plugins (github, linear, bmad), including an index page with a comparison table and individual pages covering each plugin's features, methods, configuration, and authentication setup,
so that I can choose the right issue tracker for my use case and configure it correctly.

## Acceptance Criteria

1. **Tracker index page** (`docs/plugins/trackers/index.md`) documents the tracker slot with a comparison table of all 3 plugins — sourced from `packages/core/src/types.ts` Tracker interface (lines 471-518)
2. **Tracker index page** lists the Tracker interface: 1 required readonly property (`name`), 5 required methods (`getIssue`, `isCompleted`, `issueUrl`, `branchName`, `generatePrompt`), 10 optional methods (`issueLabel`, `listIssues`, `updateIssue`, `createIssue`, `validateIssue`, `findIssueByBranch`, `onPRMerge`, `onSessionDeath`, `getNotifications`, `getEpicTitle`)
3. **Tracker index page** includes a comparison table covering: backend transport, auth setup, network requirement, prompt richness, optional method coverage, default status — sourced from all 3 plugin implementations
4. **Tracker index page** documents supporting types: `Issue` (8 fields), `IssueFilters` (4 fields), `IssueUpdate` (4 fields), `CreateIssueInput` (5 fields), `IssueValidationResult` (3 fields) — sourced from `packages/core/src/types.ts` (lines 520-557)
5. **github page** (`docs/plugins/trackers/github.md`) documents: plugin name, package (`@composio/ao-plugin-tracker-github`), version, description, default status — sourced from manifest (lines 16-21)
6. **github page** documents all implemented methods: `getIssue`, `isCompleted`, `issueUrl`, `issueLabel`, `branchName`, `generatePrompt`, `listIssues`, `updateIssue`, `createIssue` — sourced from `packages/plugins/tracker-github/src/index.ts` (314 lines)
7. **github page** documents `gh` CLI transport: all GitHub API calls go through `execFile("gh", ...)` with 30s timeout, no direct HTTP — sourced from lines 25-37
8. **github page** documents state mapping: `CLOSED` + `NOT_PLANNED` → `"cancelled"`, `CLOSED` → `"closed"`, else `"open"` — sourced from lines 39-46
9. **github page** documents updateIssue limitation: `in_progress` state is a no-op since GitHub Issues lacks it — sourced from lines 211-262
10. **linear page** (`docs/plugins/trackers/linear.md`) documents: plugin name, package (`@composio/ao-plugin-tracker-linear`), version, description — sourced from manifest (lines 16-21)
11. **linear page** documents dual transport: direct Linear API (LINEAR_API_KEY) or Composio SDK (COMPOSIO_API_KEY), auto-detection in `create()` — sourced from lines 23-205, 713-720
12. **linear page** documents all implemented methods: `getIssue`, `isCompleted`, `issueUrl`, `issueLabel`, `branchName`, `generatePrompt`, `listIssues`, `updateIssue`, `createIssue` — sourced from `packages/plugins/tracker-linear/src/index.ts` (722 lines)
13. **linear page** documents config requirements: `workspaceSlug` for URLs, `teamId` for createIssue — sourced from lines 314-322, 573-698
14. **linear page** documents state mapping: Linear workflow states map to Issue states (completed→closed, canceled→cancelled, started→in_progress, triage/backlog/unstarted→open) — sourced from lines 238-250
15. **linear page** documents label handling: additive merge (doesn't replace existing labels) — sourced from lines 432-571
16. **bmad page** (`docs/plugins/trackers/bmad.md`) documents: plugin name, package (`@composio/ao-plugin-tracker-bmad`), version, description — sourced from manifest (lines 16-21)
17. **bmad page** documents filesystem-based approach: no network calls, reads/writes YAML sprint status and markdown story files — sourced from `packages/plugins/tracker-bmad/src/index.ts` (863 lines + 26 modules)
18. **bmad page** documents ALL implemented methods including all 10 optional methods: `validateIssue` (pre-flight checks), `findIssueByBranch`, `onPRMerge`, `onSessionDeath` (resets to ready-for-dev), `getNotifications` (configurable thresholds), `getEpicTitle` — sourced from lines 705-844
19. **bmad page** documents rich prompt generation: includes dependency warnings, acceptance criteria, architecture context, PRD context, tech spec, epic overview, related stories — sourced from lines 412-530
20. **bmad page** documents extra capabilities: 26 sub-modules for sprint analytics (forecasting, Monte Carlo, CFD, WIP limits, health, retrospective, standup, team workload, velocity, dependencies) — sourced from module list
21. **All child pages** document auth setup per plugin: github (none, uses `gh auth`), linear (LINEAR_API_KEY or COMPOSIO_API_KEY), bmad (none, filesystem)
22. **All four pages** use correct Just the Docs front matter: `parent`, `grand_parent`, `nav_order`, `has_children` (index only), `description` — verified against existing page hierarchy
23. **All code blocks** use correct syntax highlighting: `text` for diagrams, `typescript` for code, `yaml` for config, `bash` for commands
24. **No hero-style font classes** (`.fs-5`, `.fw-300`) on any page
25. **ASCII diagrams** (if any) stay under 60 chars display width
26. **Links** to parent Plugins index page and between tracker child pages
27. **Config YAML examples** include `repo` and `path` fields (trackers are auto-inferred from `repo`)
28. **Directory is `trackers/` (plural)** — NOT `tracker/`. Parent Plugins index links to `trackers/` on line 119.

## Tasks / Subtasks

- [x] Task 1: Write Tracker index page (`docs/plugins/trackers/index.md`) (AC: #1, #2, #3, #4)
  - [x] Front matter: title, nav_order, parent, has_children, description
  - [x] Intro paragraph explaining Tracker slot and auto-inference from `repo` field
  - [x] TL;DR callout: 3 plugins, github default, comparison guidance
  - [x] Tracker interface table: all methods (required + optional)
  - [x] Supporting types: Issue, IssueFilters, IssueUpdate, CreateIssueInput, IssueValidationResult
  - [x] Comparison table: all 3 plugins (backend, auth, network, prompt richness, optional methods)
  - [x] Links to child pages: github, linear, bmad

- [x] Task 2: Write github page (`docs/plugins/trackers/github.md`) (AC: #5, #6, #7, #8, #9)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version, default status
  - [x] How It Works section with ASCII diagram
  - [x] Methods table: all 9 implemented methods with descriptions
  - [x] Transport section: gh CLI, no direct HTTP
  - [x] State mapping: GitHub states to Issue states
  - [x] Auth setup: none (uses `gh auth login`)
  - [x] updateIssue limitation: in_progress is a no-op
  - [x] Configuration YAML examples

- [x] Task 3: Write linear page (`docs/plugins/trackers/linear.md`) (AC: #10, #11, #12, #13, #14, #15)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section with ASCII diagram showing dual transport
  - [x] Methods table: all 9 implemented methods with descriptions
  - [x] Dual transport: direct API vs Composio SDK, auto-detection
  - [x] Auth setup: LINEAR_API_KEY or COMPOSIO_API_KEY
  - [x] Config requirements: workspaceSlug, teamId
  - [x] State mapping: Linear workflow states to Issue states
  - [x] Label handling: additive merge
  - [x] Configuration YAML examples

- [x] Task 4: Write bmad page (`docs/plugins/trackers/bmad.md`) (AC: #16, #17, #18, #19, #20)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section with ASCII diagram showing filesystem approach
  - [x] Methods table: all 16 methods (5 required + 10 optional + name) with descriptions
  - [x] Filesystem approach: YAML + markdown, no network
  - [x] Auth setup: none
  - [x] Rich prompt generation details
  - [x] Extra capabilities overview: 26 sub-modules
  - [x] Configuration YAML examples (storyDir, branchPrefix, includeArchContext, includePrdContext)

- [x] Task 5: Verify navigation, formatting, and cross-links (AC: #21, #22, #23, #24, #25, #26, #27, #28)
  - [x] Front matter correct on all 4 pages (add `description` to index and all children)
  - [x] Code blocks use correct syntax highlighting
  - [x] No hero-style font classes
  - [x] ASCII diagrams under 60 chars
  - [x] Links to Plugins index and between pages work
  - [x] Config YAML examples include `repo` and `path` fields
  - [x] Directory is `trackers/` (not `tracker/`)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Not applicable** — This story modifies Jekyll markdown documentation pages. No TypeScript interfaces changed.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Design Decisions

- **4 files to edit**: `docs/plugins/trackers/index.md` (parent page), `docs/plugins/trackers/github.md`, `docs/plugins/trackers/linear.md`, `docs/plugins/trackers/bmad.md`
- **Directory is `trackers/` (plural)** — NOT `tracker/`. Verified: `docs/plugins/trackers/` exists. Parent Plugins index page links to `trackers/` on line 119.
- **Tracker interface has 1 required readonly property + 5 required methods + 10 optional methods**: `name` (required), `getIssue`, `isCompleted`, `issueUrl`, `branchName`, `generatePrompt` (required), `issueLabel`, `listIssues`, `updateIssue`, `createIssue`, `validateIssue`, `findIssueByBranch`, `onPRMerge`, `onSessionDeath`, `getNotifications`, `getEpicTitle` (optional)
- **github is the default tracker**: Auto-inferred from `repo` field in config.ts (`applyProjectDefaults()` sets tracker to "github" if not set)
- **Not in DefaultPluginsSchema**: Unlike other slots, tracker is set via `applyProjectDefaults()` — always defaults to `"github"` when a project has a `repo` field
- **All 3 plugins share 5 required methods** but differ significantly in optional method coverage: github (0 optional), linear (0 optional), bmad (ALL 10 optional)
- **Plugins differ in transport**: github uses `gh` CLI, linear uses GraphQL over HTTPS, bmad uses filesystem

### Previous Story Learnings (62-18)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide
- Source accuracy matters — verify all technical claims against actual code
- Count precisely: method counts, parameter counts, line counts
- Config YAML examples need `path` field in project configs
- `description` field in front matter for searchability
- When documenting method details, include line number references to source
- Cross-link between child pages and parent index

### Source Files

- **packages/core/src/types.ts** — Tracker interface (lines 471-518), Issue (lines 520-530), IssueFilters (lines 532-537), IssueUpdate (lines 539-544), CreateIssueInput (lines 546-552), IssueValidationResult (lines 554-557), TrackerConfig (line 1276)
- **packages/core/src/config.ts** — Tracker defaults: auto-inferred to "github" via `applyProjectDefaults()` (lines 320-323), NOT in DefaultPluginsSchema
- **packages/plugins/tracker-github/src/index.ts** — github plugin (314 lines): manifest (16-21), gh helper (25-37), state mapping (39-46), getIssue (56-87), isCompleted (89-101), issueUrl (103-106), issueLabel (108-119), branchName (121-124), generatePrompt (126-148), listIssues (150-209), updateIssue (211-262), createIssue (264-295)
- **packages/plugins/tracker-linear/src/index.ts** — linear plugin (722 lines): manifest (16-21), direct transport (54-123), composio transport (131-205), create/auto-detect (713-720), state mapping (238-250), ISSUE_FIELDS fragment (256-267), getIssue (277-298), isCompleted (300-312), issueUrl (314-322), issueLabel (324-336), branchName (338-341), generatePrompt (343-376), listIssues (378-430), updateIssue (432-571), createIssue (573-698)
- **packages/plugins/tracker-bmad/src/index.ts** — bmad plugin (863 lines): manifest (16-21), config helpers (204-222), state mapping (268-298), getIssue (354-379), isCompleted (381-386), issueUrl (388-392), issueLabel (394-397), branchName (399-410), generatePrompt (412-530), listIssues (532-582), updateIssue (584-631), createIssue (633-703), validateIssue (705-777), findIssueByBranch (779-781), onPRMerge (783-789), onSessionDeath (791-816), getEpicTitle (818-820), getNotifications (822-844)
- **packages/plugins/tracker-bmad/src/** — 26 additional sub-modules: auto-transition, cfd, cycle-time, dependencies, epic-management, forecast (+calibration+diff+log), history (+query), monte-carlo, planning, retrospective, rework, sprint-archive, sprint-comparison, sprint-goals, sprint-health, sprint-notifications, sprint-status-reader, standup, story-aging, story-detail, team-workload, throughput, velocity-comparison, workflow-columns
- **docs/plugins/index.md** — Parent Plugins index page (completed in Story 62-15, references trackers/ on line 119)
- **docs/plugins/trackers/index.md** — Placeholder (10 lines)
- **docs/plugins/trackers/github.md** — Placeholder (10 lines)
- **docs/plugins/trackers/linear.md** — Placeholder (10 lines)
- **docs/plugins/trackers/bmad.md** — Placeholder (10 lines)

### Key Tracker Facts (verified against source)

**Tracker interface properties (1):**
- `name: string` (required) — Plugin display name

**Tracker interface required methods (5):**
- `getIssue(identifier, project)` → `Promise<Issue>` — Fetch issue details
- `isCompleted(identifier, project)` → `Promise<boolean>` — Check completion
- `issueUrl(identifier, project)` → `string` — Build issue URL
- `branchName(identifier, project)` → `string` — Generate branch name
- `generatePrompt(identifier, project)` → `Promise<string>` — Build AI prompt

**Tracker interface optional methods (10):**
- `issueLabel?(url, project)` → `string` — Extract label from URL
- `listIssues?(filters, project)` → `Promise<Issue[]>` — List issues with filters
- `updateIssue?(identifier, update, project)` → `Promise<void>` — Update issue
- `createIssue?(input, project)` → `Promise<Issue>` — Create new issue
- `validateIssue?(identifier, project)` → `Promise<IssueValidationResult>` — Pre-flight validation
- `findIssueByBranch?(branch, project)` → `Promise<string | null>` — Find issue by branch
- `onPRMerge?(issueId, prUrl, project)` → `Promise<void>` — Handle PR merge
- `onSessionDeath?(issueId, project, sessionId?)` → `Promise<void>` — Handle session death
- `getNotifications?(project)` → `Promise<OrchestratorEvent[]>` — Sprint health notifications
- `getEpicTitle?(epicId, project)` → `string` — Get epic title

**Supporting types:**
- `Issue` (8 fields): id, title, description, url, state, labels, assignee, priority
- `IssueFilters` (4 fields): state, labels, assignee, limit
- `IssueUpdate` (4 fields): state, labels, assignee, comment
- `CreateIssueInput` (5 fields): title, description, labels, assignee, priority
- `IssueValidationResult` (3 fields): valid, errors, warnings

**Plugin comparison (verified against source):**

| Feature | github | linear | bmad |
|---------|--------|--------|------|
| Source lines | 314 | 722 | 863 + 26 modules |
| Backend | `gh` CLI | GraphQL API (direct or Composio) | Local filesystem |
| Network | Yes (via gh) | Yes | No |
| Auth | None (`gh auth login`) | LINEAR_API_KEY or COMPOSIO_API_KEY | None |
| Optional methods | 0 of 10 | 0 of 10 | 10 of 10 (all) |
| Default | Yes (auto-inferred) | No | No |
| Config keys | none | workspaceSlug, teamId | storyDir, branchPrefix, includeArchContext, includePrdContext |
| branchName format | `feat/issue-{num}` | `feat/{identifier}` | `feat/{id}` (configurable prefix) |
| issueLabel format | `#42` | `INT-1327` | Story identifier |
| Prompt richness | Basic | Medium (priority names) | Rich (deps, AC, arch, PRD, tech spec, epic, siblings) |
| State mapping | 3-state | 5-state | 7-state |
| Extra capabilities | None | None | 26 sub-modules: forecasting, Monte Carlo, CFD, WIP, health, retrospective, standup, team workload, velocity, dependencies |

**github specifics:**
- All API calls via `gh` CLI (`execFile("gh", [...args])`) with 30s timeout, 10MB buffer
- State mapping: `CLOSED` + `NOT_PLANNED` → `cancelled`, `CLOSED` → `closed`, else → `open`
- `listIssues` gracefully handles repos with issues disabled (returns empty array)
- `updateIssue`: `in_progress` state is a no-op (GitHub Issues lacks this state)
- `createIssue`: parses issue number from output URL, then calls `getIssue` for full details
- Zero npm dependencies beyond `@composio/ao-core`

**linear specifics:**
- Dual transport: direct GraphQL via `https` module OR Composio SDK (`@composio/core`)
- Auto-detect: prefers COMPOSIO_API_KEY, falls back to LINEAR_API_KEY
- GraphQL fragment `ISSUE_FIELDS` (lines 256-267) for consistent field selection
- `updateIssue`: resolves short IDs (e.g., `INT-1327`) to UUIDs for mutations
- State transitions: finds correct workflow state ID for team by state type
- Label updates are **additive** (merges with existing labels, doesn't replace)
- Assignee/label application on `createIssue` is best-effort (wrapped in try/catch)
- `generatePrompt` includes priority names (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)
- Requires `teamId` in project config for `createIssue`

**bmad specifics:**
- Entirely filesystem-based: reads/writes YAML sprint status + markdown story files
- Atomic file writes: writes to tmp file, then renames
- 7-state mapping from BMad columns: done/epic-done→closed, in-progress/review/epic-in-progress→in_progress, backlog/ready-for-dev/epic-backlog→open
- `generatePrompt`: richest of all plugins — includes dependency warnings, AC checklist, architecture context (if enabled, 4KB max), PRD context (if enabled, 3KB max), tech spec (4KB), epic overview (2KB), related stories (max 10)
- `validateIssue`: pre-flight checks — story file exists, has H1 title, has AC, status is spawnable, dependency check, warns if no tech spec
- `onSessionDeath`: resets story from `in-progress` to `ready-for-dev`, honors `autoResetOnDeath: false` config, clears assignment
- `getNotifications`: configurable thresholds (stuckHours, wipLimit, throughputDropPct, forecastBehind, reworkRatePct, reworkCountPerStory, columnAgingHours, circularDepsEnabled, blockedStoriesEnabled)
- Config helpers: `storyDir` (default: "implementation-artifacts"), `branchPrefix` (default: "feat"), `includeArchContext` (default: false), `includePrdContext` (default: false)

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for method reference, comparison table, config fields
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for configuration examples
- `bash` syntax highlighting for command examples
- `has_children: true` for index page
- `grand_parent: Plugins` for child pages

### Important: Four File Changes

This story modifies:
1. `docs/plugins/trackers/index.md` — Replace placeholder with full page
2. `docs/plugins/trackers/github.md` — Replace placeholder with full page
3. `docs/plugins/trackers/linear.md` — Replace placeholder with full page
4. `docs/plugins/trackers/bmad.md` — Replace placeholder with full page

### References

- [Source: packages/core/src/types.ts — Tracker, Issue, IssueFilters, IssueUpdate, CreateIssueInput, IssueValidationResult]
- [Source: packages/core/src/config.ts — Tracker defaults (auto-inferred from repo, not in DefaultPluginsSchema)]
- [Source: packages/plugins/tracker-github/src/index.ts — github plugin (314 lines)]
- [Source: packages/plugins/tracker-linear/src/index.ts — linear plugin (722 lines)]
- [Source: packages/plugins/tracker-bmad/src/index.ts — bmad plugin (863 lines + 26 modules)]
- [Source: docs/plugins/index.md — Parent Plugins page (Story 62-15)]
- [Source: Story 62-15 — Previous story learnings (callouts, formatting, accuracy)]
- [Source: Story 62-16 — Previous story learnings (diagram widths, source accuracy, cross-links)]
- [Source: Story 62-17 — Previous story learnings (method counts, source verification, cross-links)]
- [Source: Story 62-18 — Previous story learnings (field counts, restore commands accuracy, exists descriptions)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1 (Tracker index): Written as 168-line page with auto-inference explanation, Tracker interface (1 property, 5 required, 10 optional methods), supporting types (Issue 8 fields, IssueFilters 4, IssueUpdate 4, CreateIssueInput 5, IssueValidationResult 3), full comparison table across 12 dimensions, config examples
- Task 2 (github): Written as 220-line page with ASCII diagram, all 9 methods documented (getIssue, isCompleted, issueUrl, issueLabel, branchName, generatePrompt, listIssues, updateIssue, createIssue), gh CLI transport section, 3-state mapping table, updateIssue in_progress no-op callout, 2 config examples
- Task 3 (linear): Written as 260-line page with dual transport ASCII diagram, all 9 methods documented, auto-detection explanation, 5-state mapping (with reverse mapping), additive label handling callout, priority name table, workspaceSlug/teamId config requirements, 3 config examples
- Task 4 (bmad): Written as 386-line page with filesystem ASCII diagram, all 15 methods documented (5 required + 10 optional), 7-state mapping table, rich prompt generation details (8 sections), validateIssue 7-check breakdown, onSessionDeath behavior, getNotifications threshold table, 26 sub-module listing organized by category, 5 config examples
- Task 5 (verification): Front matter consistent (parent, grand_parent, nav_order, description). No hero font classes. Code blocks use correct syntax (text, bash, yaml). ASCII diagrams max 56 chars (linear.md). Cross-links verified: index→child pages, each child→other children + parent + Configuration. Config YAML has `repo` + `path` fields. Directory confirmed `trackers/`. Total: 1034 lines across 4 files.

### Source Accuracy Corrections During Implementation

- AC#2 corrected: "6 required methods" → "5 required methods" (source: types.ts lines 471-490, generatePrompt is the 5th, not a 6th)
- AC#4 corrected: "Issue (7 fields)" → "Issue (8 fields)" — source has `priority?: number` field (types.ts line 534)
- AC#4 corrected: "IssueValidationResult (2 fields)" → "IssueValidationResult (3 fields)" — source has `warnings: string[]` field (types.ts line 523)
- AC#4 corrected: "CreateIssueInput (4 fields)" → "CreateIssueInput (5 fields)" — source has `priority?: number` field (types.ts line 556)

### Code Review Fixes (2026-04-23)

Adversarial review found 12 issues (5 HIGH, 3 MEDIUM, 4 LOW). Fixed all HIGH and MEDIUM:

- **H1**: index.md comparison table — github/linear optional methods "0 of 10" → "4 of 10"
- **H2**: index.md CreateIssueInput — 4 fields → 5 fields (missing `priority?: number`)
- **H3**: Config YAML format across all 4 files — changed from `tracker: string` + `trackerConfig:` to `tracker: { plugin: name, key: value }`
- **H4**: github.md getIssue — removed false claim "Strips leading `#` from identifier" (source passes identifier raw; `#` stripping only happens in `issueUrl`/`issueLabel`)
- **H5**: bmad.md — moved `issueLabel` from "Required Methods (5)" to "Optional Methods (10)" (it's optional in the Tracker interface per types.ts:484)
- **M1**: bmad.md — "7 sprint column states" → "8 sprint column states" (table has 8 rows)
- **M2**: index.md — auto-inference wording changed: tracker defaults for ALL projects without explicit tracker, not conditional on `repo` field (source: config.ts:321-322)
- **M3**: bmad.md — verified "Optional Methods" section now lists all 10 after moving issueLabel

### Code Review Fixes — LOW Issues (2026-04-23)

- **L1**: github.md + linear.md — added Required (5) vs Optional (4) method distinction with proper heading hierarchy (`###` for group, `####` for individual methods); moved issueLabel to Optional Methods section in both
- **L2**: bmad.md — changed "4KB/3KB/2KB max" to "4000/3000/2000 chars max" (source uses `.slice(N)` on strings, which counts characters not bytes)
- **L3**: linear.md front matter — "5-state mapping" → "6-state mapping" (6 Linear state types → 4 AO states)
- **L4**: bmad.md getNotifications — added callout noting 9 configurable keys vs 16 total in `NotificationThresholds` interface
- **Bonus**: github.md front matter — "automatic inference from repo field" → "automatic inference as default tracker" (consistent with M2 fix)

### File List

- `docs/plugins/trackers/index.md` — Replaced 10-line placeholder with 168-line full page
- `docs/plugins/trackers/github.md` — Replaced 10-line placeholder with 220-line full page
- `docs/plugins/trackers/linear.md` — Replaced 10-line placeholder with 260-line full page
- `docs/plugins/trackers/bmad.md` — Replaced 10-line placeholder with 386-line full page

### Change Log

- **2026-04-23:** Story created — tracker plugin documentation (4 files: index + 3 plugins)
- **2026-04-23:** Implementation complete — 1034 lines across 4 files. Corrected field counts: Issue 8 fields (not 7), IssueValidationResult 3 fields (not 2), Tracker 5 required methods (not 6)
- **2026-04-23:** Code review fixes — resolved 8 issues (5 HIGH, 3 MEDIUM): config YAML format corrected across all files, getIssue false claim removed, issueLabel moved to optional methods, state count corrected, auto-inference wording fixed
- **2026-04-23:** Code review LOW fixes — resolved 4 LOW issues: github.md required/optional split, bmad.md chars vs KB, linear.md state count in front matter, bmad.md threshold note
