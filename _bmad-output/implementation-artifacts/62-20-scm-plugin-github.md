# Story 62.20: SCM Plugin (GitHub)

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive reference page for the SCM GitHub plugin,
so that I understand PR detection, CI checks, review handling, merge strategies, and how to configure the plugin.

## Acceptance Criteria

1. **SCM GitHub page** (`docs/plugins/scm/github.md`) documents plugin info: name (`github`), slot (`scm`), package (`@composio/ao-plugin-scm-github`), version (`0.1.0`), default status (auto-inferred from `repo` field) — sourced from manifest (scm-github/src/index.ts lines 566-571)
2. **SCM GitHub page** documents transport mechanism: all GitHub API calls go through `execFile("gh", [...args])` with 30s timeout, 10MB max buffer, no direct HTTP — sourced from gh helper (lines 47-59)
3. **SCM GitHub page** documents auth setup: relies entirely on `gh auth login` session or `GH_TOKEN`/`GITHUB_TOKEN` env vars; plugin has zero auth code — sourced from implementation
4. **SCM GitHub page** documents the SCM interface: 1 required property (`name`), 11 required methods, 1 optional method (`getPRSummary`) — sourced from types.ts lines 567-618
5. **SCM GitHub page** documents all 12 methods with `gh` commands used and key behaviors — sourced from scm-github/src/index.ts (581 lines)
6. **SCM GitHub page** documents PR state mapping: `MERGED` → `merged`, `CLOSED` → `closed`, else → `open` — sourced from lines 128-143
7. **SCM GitHub page** documents CI state mapping: PENDING/QUEUED → `pending`, IN_PROGRESS → `running`, SUCCESS → `passed`, FAILURE/TIMED_OUT/CANCELLED/ACTION_REQUIRED → `failed`, SKIPPED/NEUTRAL → `skipped` — sourced from lines 201-224
8. **SCM GitHub page** documents review state mapping: APPROVED → `approved`, CHANGES_REQUESTED → `changes_requested`, DISMISSED → `dismissed`, PENDING → `pending`, else → `commented` — sourced from lines 298-303
9. **SCM GitHub page** documents `getMergeability` behavior: builds blockers array from CI status, review decision, mergeable status, mergeStateStatus, draft status — sourced from lines 481-562
10. **SCM GitHub page** documents `mergePR` merge strategies: `squash` (default), `merge`, `rebase` with `--delete-branch` always passed — sourced from lines 171-175
11. **SCM GitHub page** documents bot detection: 11 known bot authors used to filter automated comments — sourced from BOT_AUTHORS set (lines 30-41)
12. **SCM GitHub page** documents fail-closed vs fail-open error handling: `getCIChecks` throws on error, `getCISummary` returns `"failing"` for open PRs on error, `getPendingComments`/`getAutomatedComments` return `[]` on error — sourced from implementation
13. **SCM GitHub page** documents auto-inference: SCM defaults to `"github"` when `repo` field contains `/` via `applyProjectDefaults()` in config.ts — sourced from config.ts lines 316-318
14. **SCM GitHub page** documents supporting types: PRInfo (8 fields), PRState (3 values), MergeMethod (3 values), CICheck (6 fields), CIStatus (4 values), Review (4 fields), ReviewDecision (4 values), ReviewComment (8 fields), AutomatedComment (8 fields), MergeReadiness (5 fields) — sourced from types.ts lines 622-706
15. **SCM GitHub page** uses correct Just the Docs front matter: `title`, `nav_order`, `parent: Plugins`, `description` — no `grand_parent` needed (not nested under an index page)
16. **No hero-style font classes** (`.fs-5`, `.fw-300`) on any page
17. **ASCII diagrams** (if any) stay under 60 chars display width
18. **Config YAML examples** include `repo` and `path` fields
19. **Front matter includes `description`** field for searchability

## Tasks / Subtasks

- [x] Task 1: Replace placeholder with full SCM GitHub page (AC: #1-19)
  - [x] Write front matter (title, nav_order, parent, description)
  - [x] Write Plugin Info table
  - [x] Write How It Works section with ASCII diagram
  - [x] Write Transport section (gh CLI, auth, no direct HTTP)
  - [x] Write PR State Mapping table
  - [x] Write Methods section (Properties, Required Methods, Optional Method)
  - [x] Write CI State Mapping table (nested in getCIChecks)
  - [x] Write Review State Mapping table (nested in getReviews)
  - [x] Write MergeReadiness details (nested in getMergeability)
  - [x] Write Bot Detection section
  - [x] Write Supporting Types section
  - [x] Write Configuration section (default auto-inferred, explicit override)
  - [x] Write When to Use section
  - [x] Write Next Steps cross-links
- [x] Task 2: Verify source accuracy (AC: all)
  - [x] Cross-check method counts against types.ts SCM interface
  - [x] Cross-check gh commands against plugin source
  - [x] Cross-check state mappings against source code
  - [x] Cross-check field counts against types.ts supporting types
  - [x] Verify front matter, formatting rules, cross-links

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All source claims verified against actual code
- No hero font classes
- ASCII diagrams under 60 chars
- Cross-links verified

## Dev Notes

### Design Decisions

- **Single file to edit**: `docs/plugins/scm/github.md` — no index page needed (only 1 plugin in SCM slot, unlike trackers which have 3)
- **SCM interface has 1 required readonly property + 11 required methods + 1 optional method**: `name` (required), `detectPR`, `getPRState`, `mergePR`, `closePR`, `getCIChecks`, `getCISummary`, `getReviews`, `getReviewDecision`, `getPendingComments`, `getAutomatedComments`, `getMergeability` (required), `getPRSummary` (optional)
- **github is the default SCM**: Auto-inferred from `repo` field in config.ts (`applyProjectDefaults()` sets scm to "github" if `repo` contains "/")
- **Not in DefaultPluginsSchema**: Like tracker, SCM is set via `applyProjectDefaults()` not the defaults section
- **581 lines of source**: Larger than github tracker (314 lines) due to PR/CI/review complexity
- **Only `gh` CLI transport**: No direct HTTP, no GraphQL client library (though getPendingComments uses `gh api graphql`)

### Previous Story Learnings (62-19)

- `{: .highlight }` callouts for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text`, `bash`, `yaml`)
- ASCII diagrams MUST be under 60 chars wide
- Source accuracy matters — verify all claims against actual code
- Count precisely: method counts, parameter counts, field counts
- Config YAML examples need `path` field in project configs
- `description` field in front matter for searchability
- Required/Optional method split with proper heading hierarchy (`###` for group, `####` for individual methods)

### Source Files

- **packages/core/src/types.ts** — SCM interface (lines 567-618), PRInfo (lines 622-631), PRState (line 633), MergeMethod (line 642), CICheck (lines 646-653), CIStatus (line 655), Review (lines 667-672), ReviewDecision (line 674), ReviewComment (lines 676-685), AutomatedComment (lines 687-696), MergeReadiness (lines 700-706), SCMConfig (lines 1282-1285)
- **packages/core/src/config.ts** — SCM defaults: auto-inferred to "github" when repo contains "/" (lines 316-318), NOT in DefaultPluginsSchema
- **packages/plugins/scm-github/src/index.ts** — github SCM plugin (581 lines): manifest (566-571), gh helper (47-59), BOT_AUTHORS (30-41), detectPR (79-126), getPRState (128-143), getPRSummary (145-169), mergePR (171-175), closePR (177-179), getCIChecks (181-241), getCISummary (243-275), getReviews (277-312), getReviewDecision (314-331), getPendingComments (333-421), getAutomatedComments (423-479), getMergeability (481-562)
- **docs/plugins/index.md** — Parent Plugins page (line 120 links to scm/)
- **docs/plugins/scm/github.md** — Placeholder (9 lines)

### Key SCM Facts (verified against source)

**SCM interface properties (1):**
- `name: string` (required) — Plugin display name

**SCM interface required methods (11):**
- `detectPR(session, project)` → `Promise<PRInfo | null>` — Detect PR for session
- `getPRState(pr)` → `Promise<PRState>` — Get PR open/merged/closed state
- `mergePR(pr, method?)` → `Promise<void>` — Merge a PR
- `closePR(pr)` → `Promise<void>` — Close a PR
- `getCIChecks(pr)` → `Promise<CICheck[]>` — Get CI check results
- `getCISummary(pr)` → `Promise<CIStatus>` — Aggregate CI status
- `getReviews(pr)` → `Promise<Review[]>` — Get PR reviews
- `getReviewDecision(pr)` → `Promise<ReviewDecision>` — Get overall review decision
- `getPendingComments(pr)` → `Promise<ReviewComment[]>` — Get unresolved review comments
- `getAutomatedComments(pr)` → `Promise<AutomatedComment[]>` — Get bot/automated comments
- `getMergeability(pr)` → `Promise<MergeReadiness>` — Check if PR is ready to merge

**SCM interface optional methods (1):**
- `getPRSummary?(pr)` → `Promise<{ state, title, additions, deletions }>` — PR summary with stats

**Supporting types:**
- PRInfo (8 fields): number, url, title, owner, repo, branch, baseBranch, isDraft
- PRState (3 values): "open" | "merged" | "closed"
- MergeMethod (3 values): "merge" | "squash" | "rebase"
- CICheck (6 fields): name, status, url?, conclusion?, startedAt?, completedAt?
- CIStatus (4 values): "pending" | "passing" | "failing" | "none"
- Review (4 fields): author, state, body?, submittedAt
- ReviewDecision (4 values): "approved" | "changes_requested" | "pending" | "none"
- ReviewComment (8 fields): id, author, body, path?, line?, isResolved, createdAt, url
- AutomatedComment (8 fields): id, botName, body, path?, line?, severity, createdAt, url
- MergeReadiness (5 fields): mergeable, ciPassing, approved, noConflicts, blockers

**github SCM specifics:**
- All API calls via `gh` CLI with 30s timeout, 10MB buffer
- `getPendingComments` uses GraphQL via `gh api graphql` (REST lacks isResolved field)
- `getAutomatedComments` uses REST via `gh api` endpoint
- 11 known bot authors for filtering automated comments
- Fail-closed: getCIChecks throws, getCISummary returns "failing" for open PRs on error
- Fail-open: getPendingComments/getAutomatedComments return [] on error
- `mergePR` always passes `--delete-branch`, defaults to `squash` method
- `getMergeability` early-returns all-true for already-merged PRs
- Severity classification from body keywords: error/bug/critical → "error", warning/suggest → "warning", else → "info"

### Just the Docs Features Used

- `{: .highlight }` callout for tips
- Markdown tables for method reference, state mappings, supporting types
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for configuration examples
- `bash` syntax highlighting for gh CLI examples

### References

- [Source: packages/core/src/types.ts — SCM interface (lines 567-618), supporting types (lines 622-706)]
- [Source: packages/core/src/config.ts — SCM auto-inference (lines 316-318)]
- [Source: packages/plugins/scm-github/src/index.ts — github SCM plugin (581 lines)]
- [Source: docs/plugins/index.md — Parent Plugins page (line 120)]
- [Source: Story 62-19 — Previous story learnings (formatting, source accuracy, cross-links)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- Full SCM GitHub documentation page written (~430 lines) replacing 9-line placeholder
- Source accuracy verification found 3 discrepancies, all fixed:
  1. Bot count: 10 (not 11) — story file referenced "11" from initial analysis; actual BOT_AUTHORS set has 10 entries
  2. SCM auto-inference: code sets `{ plugin: "github" }` object, not string `"github"`
  3. getMergeability blocker messages: corrected to exact strings from source (`"CI is failing"` not `"CI checks are failing"`, `"PR is still a draft"` not `"PR is in draft mode"`, `"Changes requested in review"` / `"Review required"` not `"Review decision: {decision}"`)
- All 19 ACs verified against source code
- ASCII diagram width verified under 60 chars
- No hero font classes
- Config YAML examples include both `repo` and `path` fields

### Code Review Fixes

- **H1:** `detectPR` description falsely claimed returns `null` on invalid repo format — actually **throws**. Fixed to accurately describe: invalid repo format throws, `gh` call failures return `null`.
- **M1:** `getPendingComments` didn't document single-comment-per-thread limitation. Added note about `comments(first: 1)`.
- **L1:** Error wrapping format `gh <command> failed` was imprecise. Changed to `gh <first-3-args> failed` with example.
- **L2:** `getAutomatedComments` line field uses `line ?? original_line` fallback not documented. Added note.

### File List

- `docs/plugins/scm/github.md` — replaced placeholder with full SCM GitHub documentation page

### Change Log

- **2026-04-23:** Story created — SCM GitHub plugin documentation (1 file)
- **2026-04-23:** Task 1 completed — full documentation page written
- **2026-04-23:** Task 2 completed — source accuracy verified, 3 discrepancies fixed (bot count, auto-inference value, blocker messages)
- **2026-04-23:** Code review — 4 issues found and fixed: H1 detectPR throws on bad repo (not returns null), M1 single-comment-per-thread limit, L1 error wrapping format, L2 line field fallback
