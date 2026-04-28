# Story 62.18: Workspace Plugin Pages (worktree, clone)

Status: done

## Story

As a developer using Agent Orchestrator,
I want detailed documentation pages for the two workspace plugins (worktree and clone), including an index page with a comparison table and individual pages covering each plugin's features, methods, configuration, and capabilities,
so that I can choose the right workspace isolation strategy for my use case and configure it correctly.

## Acceptance Criteria

1. **Workspace index page** (`docs/plugins/workspace/index.md`) documents the workspace slot with a comparison table of both plugins — sourced from `packages/core/src/types.ts` Workspace interface (lines 428-448)
2. **Workspace index page** lists the Workspace interface: 1 required readonly property (`name`), 3 required methods (`create`, `destroy`, `list`), 3 optional methods (`postCreate`, `exists`, `restore`)
3. **Workspace index page** includes a comparison table covering: isolation strategy, disk usage, symlink support, branch handling, list implementation, restore strategy, config key — sourced from both plugin implementations
4. **Workspace index page** documents WorkspaceCreateConfig (4 fields: projectId, project, sessionId, branch) and WorkspaceInfo (4 fields: path, branch, sessionId, projectId) — sourced from `packages/core/src/types.ts` (lines 450-462)
5. **worktree page** (`docs/plugins/workspace/worktree.md`) documents: plugin name, package (`@composio/ao-plugin-workspace-worktree`), version, description, default status — sourced from manifest (lines 19-24)
6. **worktree page** documents all Workspace interface methods: `create`, `destroy`, `list`, `exists`, `restore`, `postCreate` — sourced from `packages/plugins/workspace-worktree/src/index.ts` (301 lines)
7. **worktree page** documents the create method: path validation via `SAFE_PATH_SEGMENT` regex, worktree creation with `git worktree add -b`, retry logic for existing branches, fallback on checkout failure — sourced from lines 57-112
8. **worktree page** documents the destroy method: intentional branch preservation design, `git worktree remove --force`, fallback to `rmSync` — sourced from lines 114-137
9. **worktree page** documents the list method: `git worktree list --porcelain` parsing, directory filtering, "detached" branch fallback — sourced from lines 139-194
10. **worktree page** documents postCreate symlink support: validates relative paths, no `..` traversal, resolved target must stay within workspace, nested target directory creation — sourced from lines 253-288
11. **worktree page** documents the restore method: 3-tier retry (existing branch, remote branch, default branch) — sourced from lines 209-247
12. **clone page** (`docs/plugins/workspace/clone.md`) documents: plugin name, package (`@composio/ao-plugin-workspace-clone`), version, description — sourced from manifest (lines 16-21)
13. **clone page** documents all Workspace interface methods: `create`, `destroy`, `list`, `exists`, `restore`, `postCreate` — sourced from `packages/plugins/workspace-clone/src/index.ts` (245 lines)
14. **clone page** documents the create method: `git clone --reference` for object sharing, early failure on existing directory, cleanup on clone/checkout failure — sourced from lines 54-126
15. **clone page** documents the destroy method: simple `rmSync` (no git worktree management) — sourced from lines 128-132
16. **clone page** documents the list method: filesystem scan + `git branch --show-current`, explicit `console.warn` for corrupted repos — sourced from lines 134-167
17. **clone page** documents the restore method: 2-tier retry (plain checkout, create new branch) — sourced from lines 182-231
18. **clone page** documents postCreate: only runs hook commands (no symlink support) — sourced from lines 233-241
19. **Both child pages** document path safety: `SAFE_PATH_SEGMENT` regex (`/^[a-zA-Z0-9_-]+$/`), `assertSafePathSegment()`, `expandPath()` for `~/` expansion
20. **All three pages** use correct Just the Docs front matter: `parent`, `grand_parent`, `nav_order`, `has_children` (index only), `description` — verified against existing page hierarchy
21. **All code blocks** use correct syntax highlighting: `text` for diagrams, `typescript` for code, `yaml` for config, `bash` for commands
22. **No hero-style font classes** (`.fs-5`, `.fw-300`) on any page
23. **ASCII diagrams** (if any) stay under 60 chars display width
24. **Links** to parent Plugins index page and between workspace child pages
25. **Config YAML examples** include `path` field in project configs (learned from Story 62-15)
26. **Directory is `workspace/` (singular)** — NOT `workspaces/`. Parent Plugins index links to `workspace/` on line 118.

## Tasks / Subtasks

- [x] Task 1: Write Workspace index page (`docs/plugins/workspace/index.md`) (AC: #1, #2, #3, #4)
  - [x] Front matter: title, nav_order, parent, has_children, description
  - [x] Intro paragraph explaining Workspace slot
  - [x] TL;DR callout: 2 plugins, worktree default, comparison guidance
  - [x] Workspace interface table: all methods (required + optional)
  - [x] WorkspaceCreateConfig and WorkspaceInfo types
  - [x] Comparison table: both plugins (isolation strategy, disk usage, symlink support, branch handling, list implementation, restore strategy, config key)
  - [x] Links to child pages: worktree, clone

- [x] Task 2: Write worktree page (`docs/plugins/workspace/worktree.md`) (AC: #5, #6, #7, #8, #9, #10, #11)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version, default status
  - [x] How It Works section with ASCII diagram
  - [x] Methods table: all 6 methods with descriptions
  - [x] Create method: path validation, worktree creation, retry logic, cleanup
  - [x] Destroy method: branch preservation, git remove, rmSync fallback
  - [x] List method: porcelain parsing, directory filtering, detached fallback
  - [x] Restore method: 3-tier retry strategy
  - [x] postCreate: symlink support with security validation
  - [x] Path safety: SAFE_PATH_SEGMENT, assertSafePathSegment, expandPath
  - [x] Configuration YAML examples

- [x] Task 3: Write clone page (`docs/plugins/workspace/clone.md`) (AC: #12, #13, #14, #15, #16, #17, #18)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section with ASCII diagram
  - [x] Methods table: all 6 methods with descriptions
  - [x] Create method: clone --reference, early failure on existing, cleanup
  - [x] Destroy method: simple rmSync
  - [x] List method: filesystem scan, git branch, warn on corrupted
  - [x] Restore method: 2-tier retry strategy
  - [x] postCreate: hook commands only (no symlink support)
  - [x] Path safety (shared pattern with worktree)
  - [x] Configuration YAML examples

- [x] Task 4: Verify navigation, formatting, and cross-links (AC: #19, #20, #21, #22, #23, #24, #25, #26)
  - [x] Front matter correct on all 3 pages (add `description` to index and both children)
  - [x] Code blocks use correct syntax highlighting
  - [x] No hero-style font classes
  - [x] ASCII diagrams under 60 chars
  - [x] Links to Plugins index and between pages work
  - [x] Config YAML examples include `path` field
  - [x] Directory is `workspace/` (not `workspaces/`)

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

- **3 files to edit**: `docs/plugins/workspace/index.md` (parent page), `docs/plugins/workspace/worktree.md`, `docs/plugins/workspace/clone.md`
- **Directory is `workspace/` (singular)** — NOT `workspaces/`. Verified: `docs/plugins/workspace/` exists. Parent Plugins index page links to `workspace/` on line 118.
- **Workspace interface has 1 required readonly property + 3 required methods + 3 optional methods**: `name` (required), `create`, `destroy`, `list` (required), `postCreate`, `exists`, `restore` (optional)
- **worktree is the default workspace**: Set in `DefaultPluginsSchema` (config.ts: `workspace: z.string().default("worktree")`)
- **Both plugins share identical path safety logic**: `SAFE_PATH_SEGMENT` regex, `assertSafePathSegment()`, `expandPath()`
- **Plugins differ in isolation strategy**: worktree uses `git worktree` (shared `.git`), clone uses `git clone --reference` (independent copy)

### Previous Story Learnings (62-17)

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

- **packages/core/src/types.ts** — Workspace interface (lines 428-448), WorkspaceCreateConfig (lines 450-455), WorkspaceInfo (lines 457-462), WorkspaceHooksConfig (lines 397-402)
- **packages/core/src/config.ts** — DefaultPluginsSchema: workspace defaults to "worktree"
- **packages/plugins/workspace-worktree/src/index.ts** — worktree plugin (301 lines): manifest (19-24), SAFE_PATH_SEGMENT (33), assertSafePathSegment (35), git helper (27), expandPath (42), create (57-112), destroy (114-137), list (139-194), exists (196-207), restore (209-247), postCreate with symlinks (249-297)
- **packages/plugins/workspace-clone/src/index.ts** — clone plugin (245 lines): manifest (16-21), git helper (24), SAFE_PATH_SEGMENT (30), assertSafePathSegment (32), expandPath (39), create with --reference (54-126), destroy (128-132), list (134-167), exists (169-180), restore (182-231), postCreate hooks only (233-241)
- **docs/plugins/index.md** — Parent Plugins index page (completed in Story 62-15, references workspace/ on line 118)
- **docs/plugins/workspace/index.md** — Placeholder (10 lines)
- **docs/plugins/workspace/worktree.md** — Placeholder (8 lines)
- **docs/plugins/workspace/clone.md** — Placeholder (8 lines)

### Key Workspace Facts (verified against source)

**Workspace interface properties (1):**
- `name: string` (required) — Plugin display name

**Workspace interface required methods (3):**
- `create(config: WorkspaceCreateConfig)` — Create a new workspace for a session
- `destroy(workspacePath: string)` — Clean up and remove a workspace
- `list(projectId: string)` — List all workspaces for a project

**Workspace interface optional methods (3):**
- `postCreate?(info: WorkspaceInfo, project: ProjectConfig)` — Run setup after workspace creation
- `exists?(workspacePath: string)` — Check if workspace exists
- `restore?(config: WorkspaceCreateConfig, workspacePath: string)` — Restore a previously created workspace

**WorkspaceCreateConfig (4 fields):** projectId, project, sessionId, branch

**WorkspaceInfo (4 fields):** path, branch, sessionId, projectId

**Plugin comparison (verified against source):**

| Feature | worktree | clone |
|---------|----------|-------|
| Source lines | 301 | 245 |
| Isolation strategy | git worktree (shared .git) | git clone --reference |
| Default base dir | `~/.worktrees` | `~/.ao-clones` |
| Disk usage | Lower (shared objects) | Higher (--reference helps) |
| Config key | `worktreeDir` | `cloneDir` |
| Symlink support | Yes (postCreate) | No |
| Branch deletion on destroy | No (intentional) | N/A (deletes directory) |
| List implementation | `git worktree list --porcelain` | Filesystem scan + `git branch --show-current` |
| Restore strategy | 3-tier retry | 2-tier retry |
| Corrupted repo handling | Silent skip | Explicit `console.warn` |
| Default | Yes | No |

**worktree specifics:**
- Path: `{worktreeBaseDir}/{projectId}/{sessionId}` (default `~/.worktrees/{projectId}/{sessionId}`)
- SAFE_PATH_SEGMENT regex: `/^[a-zA-Z0-9_-]+$/` — prevents directory traversal
- Create: `git worktree add -b <branch> <path> origin/<defaultBranch>` with retry on existing branch
- Destroy: `git worktree remove --force` + fallback `rmSync`; does NOT delete branch (deliberate design choice — lines 126-130)
- List: parses `git worktree list --porcelain` output blocks; filters by project directory; sets "detached" for no-branch worktrees
- Restore: (1) prune + fetch, (2) `worktree add` on existing branch, (3) `worktree add -b` from `origin/<branch>`, (4) `worktree add -b` from `origin/<defaultBranch>`
- postCreate symlinks: validates relative path, no `..`, resolved target must be within workspace, creates parent dirs
- postCreate hooks: runs `sh -c` commands from `project.postCreate` array

**clone specifics:**
- Path: `{cloneBaseDir}/{projectId}/{sessionId}` (default `~/.ao-clones/{projectId}/{sessionId}`)
- Create: `git clone --reference <repoPath> --branch <defaultBranch>` for object sharing; fails early if directory exists; cleans up on failure
- Destroy: simple `rmSync(..., { recursive: true, force: true })` — no git commands
- List: reads directory entries + `git branch --show-current`; warns on corrupted repos
- Restore: (1) plain checkout, (2) create new branch — 2-tier retry
- postCreate: only runs hook commands (no symlink support)

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for method reference, comparison table, config fields
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for configuration examples
- `bash` syntax highlighting for command examples
- `has_children: true` for index page
- `grand_parent: Plugins` for child pages

### Important: Three File Changes

This story modifies:
1. `docs/plugins/workspace/index.md` — Replace placeholder with full page
2. `docs/plugins/workspace/worktree.md` — Replace placeholder with full page
3. `docs/plugins/workspace/clone.md` — Replace placeholder with full page

### References

- [Source: packages/core/src/types.ts — Workspace, WorkspaceCreateConfig, WorkspaceInfo, WorkspaceHooksConfig]
- [Source: packages/plugins/workspace-worktree/src/index.ts — worktree plugin (301 lines)]
- [Source: packages/plugins/workspace-clone/src/index.ts — clone plugin (245 lines)]
- [Source: packages/core/src/config.ts — DefaultPluginsSchema (workspace defaults to "worktree")]
- [Source: docs/plugins/index.md — Parent Plugins page (Story 62-15)]
- [Source: Story 62-15 — Previous story learnings (callouts, formatting, accuracy)]
- [Source: Story 62-16 — Previous story learnings (diagram widths, source accuracy, cross-links)]
- [Source: Story 62-17 — Previous story learnings (method counts, source verification, cross-links)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1 (Workspace index): Written as 113-line page with full comparison table, Workspace interface docs, WorkspaceCreateConfig/WorkspaceInfo types, config examples
- Task 2 (worktree): Written as 195-line page with ASCII diagram, all 6 methods documented (create with retry, destroy with branch preservation, list with porcelain parsing, restore with 3-tier retry, postCreate with symlink support), 3 config examples
- Task 3 (clone): Written as 194-line page with ASCII diagram, all 6 methods documented (create with --reference, destroy with rmSync, list with filesystem scan, restore with 2-tier retry, postCreate hooks only), 3 config examples
- Task 4 (verification): Front matter consistent (parent, grand_parent, nav_order, description). No hero font classes. Code blocks use correct syntax (text, bash, yaml). Config YAML has `path` field. Cross-links verified: index→Plugins, worktree↔clone, both→parent. Directory confirmed `workspace/`. Total: 502 lines across 3 files.

### File List

- `docs/plugins/workspace/index.md` — Replaced 10-line placeholder with 113-line full page
- `docs/plugins/workspace/worktree.md` — Replaced 10-line placeholder with 195-line full page
- `docs/plugins/workspace/clone.md` — Replaced 10-line placeholder with 194-line full page

### Change Log

- **2026-04-23:** Initial implementation — 3 documentation pages for workspace plugins (502 lines total)
- **2026-04-23:** Code review fixes — WorkspaceCreateConfig field count (5→4), worktree restore commands (`git checkout`→`git worktree add`), exists() descriptions (add git validity check), clone create --branch detail, line count correction
- **2026-04-23:** Second-pass review — fixed index.md exists? description to match interface contract (types.ts:443)

