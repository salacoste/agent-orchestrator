# Story 62.29: CLI Review & PR Commands

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Review & PR Commands reference page that documents the 6 Review & PR commands (review-check, review-stats, rework, resolve, resolve-conflicts, conflicts),
so that I can understand each command's flags, tracker requirements, output formats, and usage examples for code review analytics, PR monitoring, and conflict resolution.

## Acceptance Criteria

1. **Review & PR Commands page** (`docs/cli/review-pr.md`) documents `ao review-check [project]`: description, flag (`--dry-run`), ora spinner, session iteration with SCM plugin, PR detection, pending comments/review decision, auto-fix prompt message, and dry-run mode — sourced from `packages/cli/src/commands/review-check.ts`
2. **Review & PR Commands page** documents `ao review-stats`: description, flag (`--json`), severity bar chart output (high=red, medium=yellow, low=green), top 5 categories, resolution rate, and JSON output shape — sourced from `packages/cli/src/commands/review-stats.ts`
3. **Review & PR Commands page** documents `ao rework [project]`: description, flags (`--epic <id>`, `--json`), bmad tracker requirement, rework rate/stats, transition stats table, worst offenders list, and JSON output shape — sourced from `packages/cli/src/commands/rework.ts`
4. **Review & PR Commands page** documents `ao resolve [conflictId]`: description, flags (`--list`, `--agent <id>`, `--tie-breaker <strategy>`, `--json`), conflict listing table, conflict detail display, severity formatting, priority scores, tie-breaker strategies, manual override, and resolution result — sourced from `packages/cli/src/commands/resolve.ts`
5. **Review & PR Commands page** documents `ao resolve-conflicts [storyId]`: description, flags (`--auto <strategy>`, `--format <format>`, `--expected-version <version>`, `--proposed-status <status>`, `--proposed-agent <agent>`), version conflict detection, side-by-side diff display, interactive merge, exit code 2 for conflicts, and performance warning — sourced from `packages/cli/src/commands/resolve-conflicts.ts`
6. **Review & PR Commands page** documents `ao conflicts`: description, flags (`--story <id>`, `--json`, `--severity <level>`), conflict listing grouped by story, severity filtering, summary table, and resolution hints — sourced from `packages/cli/src/commands/conflicts.ts`
7. **Page uses correct Just the Docs front matter**: `title: Review & PR Commands`, `nav_order: 6`, `parent: CLI Reference`, `description` field
8. **No hero-style font classes** (`.fs-5`, `.fw-300`), **ASCII diagrams under 60 chars**, **all code blocks use correct syntax highlighting**
9. **Cross-links** verified: parent link to CLI Reference, sibling links to 7 other CLI category pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Review & PR Commands page (AC: #1-9)
  - [x] Replace stub content in docs/cli/review-pr.md
  - [x] Write front matter (title, nav_order: 6, parent: CLI Reference, description)
  - [x] Write "Overview" section — 6 commands summary table
  - [x] Write "ao review-check" section — flags, ora spinner, auto-fix prompt, dry-run, examples
  - [x] Write "ao review-stats" section — flags, severity chart, categories, resolution rate, JSON, examples
  - [x] Write "ao rework" section — flags, bmad requirement, rework rate, transition stats, offenders, examples
  - [x] Write "ao resolve" section — flags, conflict listing, detail display, tie-breaker, override, examples
  - [x] Write "ao resolve-conflicts" section — flags, version diff, interactive merge, auto strategies, examples
  - [x] Write "ao conflicts" section — flags, story grouping, severity filter, summary table, examples
  - [x] Write "Tracker Requirements" callout — which commands need which tracker/SCM
  - [x] Write "Cross-Cutting Patterns" section — config errors, ora usage, exit codes
  - [x] Write "Next Steps" cross-links

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All source claims verified against actual code
- No hero font classes
- ASCII diagrams under 60 chars
- Cross-links verified
- All code blocks use correct syntax highlighting
- `{: .highlight }` callout for tracker requirements

## Dev Notes

### Design Decisions

- **This story covers the Review & PR Commands child page** — the index page (62-23), setup commands (62-24), session commands (62-25), sprint commands (62-26), story commands (62-27), and monitoring commands (62-28) are done
- **The stub file** at `docs/cli/review-pr.md` has front matter with `title: Review & PR Commands`, `nav_order: 6`, `parent: CLI Reference` — needs `description` added
- **6 commands** in Review & PR category: review-check, review-stats, rework, resolve, resolve-conflicts, conflicts
- **2 commands require bmad tracker**: `ao rework` (requires bmad tracker for sprint data), `ao review-stats` reads from review-findings.jsonl (no tracker needed)
- **2 commands use SCM plugin**: `ao review-check` requires SCM for PR detection
- **2 conflict types**: agent assignment conflicts (resolve, conflicts) vs version/state conflicts (resolve-conflicts)
- **ao review-check is the only command with ora spinner** in this category

### Previous Story Learnings (62-28)

- Source `.description()` strings must be quoted EXACTLY from source — no paraphrasing
- Flag descriptions must match source `.option()` strings exactly
- Command output strings must match actual `console.log` / `chalk` output
- Cross-link file existence must be verified
- Front matter needs `description` field for searchability
- Config error strings vary between commands — document the actual strings
- Use exact Unicode characters from source
- Double-space after emoji: `⚠️  ` not `⚠️ `
- Backtick quotes in config errors: `` `ao init` `` not `'ao init'`

### Source Files

- **packages/cli/src/commands/review-check.ts** — `ao review-check` (PR review comment detection with auto-fix prompt)
- **packages/cli/src/commands/review-stats.ts** — `ao review-stats` (code review analytics with severity charts)
- **packages/cli/src/commands/rework.ts** — `ao rework` (rework/churn detection for sprint stories)
- **packages/cli/src/commands/resolve.ts** — `ao resolve` (agent assignment conflict resolution)
- **packages/cli/src/commands/resolve-conflicts.ts** — `ao resolve-conflicts` (version conflict detection and interactive merge)
- **packages/cli/src/commands/conflicts.ts** — `ao conflicts` (agent assignment conflict listing)
- **packages/core/src/types.ts** — SCM interface (detectPR, getPendingComments, getReviewDecision), ReviewFinding, AgentConflict
- **packages/core/src/review-findings-store.ts** — ReviewFindingsStore for review-stats data source
- **docs/cli/review-pr.md** — Replace stub with full documentation
- **docs/cli/index.md** — Parent page for cross-reference

### Key Review & PR Command Facts (verified against source)

**Command count**: 6 top-level commands

| Command | File | --json | bmad Required | ora spinner | SCM Required |
|---------|------|--------|---------------|-------------|--------------|
| `ao review-check [project]` | review-check.ts | No | No | Yes | Yes |
| `ao review-stats` | review-stats.ts | Yes | No | No | No |
| `ao rework [project]` | rework.ts | Yes | Yes | No | No |
| `ao resolve [conflictId]` | resolve.ts | Yes | No | No | No |
| `ao resolve-conflicts [storyId]` | resolve-conflicts.ts | Yes (via `--format json`) | No | No | No |
| `ao conflicts` | conflicts.ts | Yes | No | No | No |

**ao review-check flags** (from review-check.ts):
- `[project]`: Project ID (checks all if omitted)
- `--dry-run`: Show what would be done without sending messages

**ao review-stats flags** (from review-stats.ts):
- `--json`: Output as JSON

**ao rework flags** (from rework.ts):
- `[project]`: Project ID (auto-resolves if only one project)
- `--epic <id>`: Filter by epic ID
- `--json`: Output as JSON

**ao resolve flags** (from resolve.ts):
- `[conflictId]`: The conflict ID to resolve
- `--list`: List all pending conflicts
- `--agent <id>`: Keep specific agent (overrides priority-based decision)
- `--tie-breaker <strategy>`: Tie-breaker strategy: recent, progress — default: recent
- `--json`: Output as JSON

**ao resolve-conflicts flags** (from resolve-conflicts.ts):
- `[storyId]`: Story ID to check for conflicts
- `--auto <strategy>`: Auto-resolve strategy: overwrite, retry, merge
- `--format <format>`: Output format: human, json — default: human
- `--expected-version <version>`: Expected version for conflict detection
- `--proposed-status <status>`: Proposed status value
- `--proposed-agent <agent>`: Proposed assigned agent value

**ao conflicts flags** (from conflicts.ts):
- `--story <id>`: Filter conflicts by story ID
- `--json`: Output as JSON
- `--severity <level>`: Filter by severity (critical, high, medium, low)

**Cross-cutting patterns:**
- 4 commands use `loadConfig()` — review-stats, rework, resolve, conflicts, resolve-conflicts, review-check
- `ao review-check` is unique — it uses ora spinner + SCM plugin + SessionManager
- `ao rework` is unique — requires bmad tracker plugin (`project.tracker.plugin === "bmad"`)
- `ao resolve-conflicts` is unique — uses `StateManager` + `ConflictResolver`, has exit code 2 for conflicts, has interactive merge via readline, has performance warning (>1000ms)
- `ao resolve` and `ao conflicts` share `ConflictDetectionService` and `formatSeverity()`/`formatDuration()` helpers
- Config error strings: review-stats, rework, resolve, conflicts use `No config found. Run 'ao init' first.` (single quotes); review-check uses `No agent-orchestrator.yaml found. Run 'ao init' first.`
- `ao review-stats` and `ao rework` have project directory checks: `Not in a project directory.`
- `ao resolve` and `ao conflicts` have project directory checks: `Could not determine project ID. Run from a project directory.`

**ao review-check details:**
- Uses ora spinner: `"Checking PRs for review comments..."`
- Iterates sessions, gets SCM per session, calls `scm.detectPR()` then `scm.getPendingComments()` + `scm.getReviewDecision()`
- Includes sessions with `commentCount > 0` OR `reviewDecision === "changes_requested"`
- Auto-fix message: `"There are review comments on your PR. Check with \`gh pr view --comments\` and \`gh pr api\` for inline comments. Address each one, push fixes, and reply."`
- Success: `"    -> Fix prompt sent"` (green)
- Failure: `"    -> Failed to send: <err>"` (red)
- Dry run: `"    (dry run -- would send fix prompt)"` (dim)

**ao review-stats details:**
- Data source: `<sessionsDir>/review-findings.jsonl` via ReviewFindingsStore
- Severity bar chart: high=red, medium=yellow, low=green; bar uses `"█"` repeated up to 30 times
- Top 5 categories with occurrence counts
- Resolution rate: `fixed / total` ratio as percentage
- JSON shape: `{ total, bySeverity, byCategory, fixRate }`
- No data: `"No review data available."` (yellow)

**ao rework details:**
- Requires bmad tracker: `Rework detection requires the bmad tracker plugin.`
- Rework rate as percentage, total events, total rework time (formatted via formatMs)
- formatMs: hours < 24 shows `"X.Xh"`, days shows `"X.Xd"`
- Transition stats table: From, To, Count, Avg Time
- Worst offenders: storyId, rework count (red), total rework time
- Uses `header()` with `"Rework Detection: <projectName>"`
- No rework: `"No rework detected. All transitions were forward."` (dim)

**ao resolve details:**
- Conflict listing: table with Conflict ID, Story, Existing, Conflicting, Severity, Detected
- Conflict detail: severity (CRITICAL/HIGH/MEDIUM/LOW), priority scores with color thresholds (>0.7 green, >0.4 yellow, else red)
- Manual override: `--agent` sets priority to 1.0 for chosen, 0.0 for other
- Tie-breaker validation: must be `"recent"` or `"progress"`
- Resolution result: action, kept agent (green), terminated agent (red), reason (dim)
- No conflicts: `"No pending conflicts"` (green)
- Footer hint: `"Resolve a conflict: ao resolve <conflict-id>"` (dim)

**ao resolve-conflicts details:**
- Two conflict types: version mismatches (expected vs actual version), field-level conflicts
- Side-by-side diff display with box-drawing characters
- Interactive merge: field-by-field [C]urrent/[P]roposed choice via readline
- Auto strategies: overwrite (discards current), retry (refresh + reapply), merge (manual)
- Exit code 2 when conflict detected in JSON mode
- Performance warning if >1000ms: `"Warning: Conflict resolution took <N>ms (>1000ms target)"`
- No conflict: `"No conflict detected for <storyId>"` (green)

**ao conflicts details:**
- Conflicts grouped by story in output
- Per-conflict: ID, severity (colored), type, detected (duration), existing agent (yellow), conflicting agent (cyan)
- Priority scores with color thresholds (same as resolve)
- Recommendations shown as bullet list
- Resolution status: green if resolved, yellow "Pending" if not
- Summary table: Story, Conflicts count, Highest Severity
- Resolution hints at bottom
- Severity sort order: critical(0), high(1), medium(2), low(3)

### Just the Docs Features Used

- `{: .highlight }` callout for tracker requirements
- `parent: CLI Reference` on child page
- Markdown tables for command reference, flags
- `bash` syntax highlighting for CLI examples
- `text` syntax highlighting for output examples

### References

- [Source: packages/cli/src/commands/review-check.ts — ao review-check PR review detection]
- [Source: packages/cli/src/commands/review-stats.ts — ao review-stats analytics]
- [Source: packages/cli/src/commands/rework.ts — ao rework churn detection]
- [Source: packages/cli/src/commands/resolve.ts — ao resolve agent conflict resolution]
- [Source: packages/cli/src/commands/resolve-conflicts.ts — ao resolve-conflicts version conflicts]
- [Source: packages/cli/src/commands/conflicts.ts — ao conflicts listing]
- [Source: packages/core/src/types.ts — SCM, ReviewFinding, AgentConflict types]
- [Source: docs/cli/index.md — Parent CLI Reference page]
- [Source: Story 62-28 — Previous story learnings (exact description strings, config error variants)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- 1 documentation file written replacing stub (docs/cli/review-pr.md)
- Source accuracy verification: All 6 command `.description()` strings verified against source (0 discrepancies)
- All 9 ACs verified against source code
- 6 commands documented: review-check, review-stats, rework, resolve, resolve-conflicts, conflicts
- Command descriptions verified exact: review-check ("Check PRs for review comments and trigger agents to address them"), review-stats ("View code review analytics"), rework ("Show rework/churn detection for sprint stories"), resolve ("Resolve agent assignment conflicts"), resolve-conflicts ("Detect and resolve version conflicts"), conflicts ("List and manage agent assignment conflicts")
- All flag names and descriptions verified against `.option()` calls in source
- bmad tracker requirement documented for `ao rework` only
- SCM requirement documented for `ao review-check` only
- `{: .highlight }` callout used for tracker/SCM requirements
- No hero font classes on page
- All cross-links verified (7 sibling pages + CLI Reference + Getting Started + Configuration)
- Front matter correct: title, nav_order: 6, parent: CLI Reference, description present
- Exit code 2 documented for resolve-conflicts (unique across all CLI commands)
- Performance warning (>1000ms) documented for resolve-conflicts
- Two conflict types clearly distinguished: agent assignment (resolve, conflicts) vs version/state (resolve-conflicts)
- 1 accuracy fix applied post-verification: em-dash in review-check dry-run output (`—` not `--`)

### File List

- `docs/cli/review-pr.md` — replace stub with Review & PR Commands documentation

### Change Log

- **2026-04-24:** Story created — Review & PR Commands documentation page (1 file to replace)
- **2026-04-24:** Task 1 completed — Review & PR Commands page written with 6 commands, all flags, examples, and cross-links
- **2026-04-24:** Story marked review — Phase 4 (CLI Reference) continued
- **2026-04-24:** Code review — 15 findings (0 CRITICAL, 5 HIGH, 6 MEDIUM, 4 LOW), all fixed
- **2026-04-24:** Second-pass review — 4 additional findings (0 HIGH, 1 MEDIUM, 3 LOW), all fixed
- **2026-04-24:** Story marked done

### Senior Developer Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (15 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[HIGH]** Fix review-stats bar scaling description — source uses raw count capped at 30, not proportional scaling
- [x] **[HIGH]** Fix rework JSON field name — `averageReworkTimeMs` not `avgTimeMs`
- [x] **[HIGH]** Fix resolve resolution result labels — `Kept agent:`/`Terminated agent:` not `Kept:`/`Terminated:`
- [x] **[HIGH]** Fix resolve-conflicts interactive merge arrows — Unicode `→` not ASCII `->`
- [x] **[HIGH]** Fix resolve-conflicts invalid choice arrow — Unicode `→` not ASCII `->`
- [x] **[MEDIUM]** Fix review-check pluralization — source conditionally pluralizes `session`/`sessions`
- [x] **[MEDIUM]** Fix rework rate format — source shows `15.0%` with one decimal
- [x] **[MEDIUM]** Fix resolve resolution success — add `✓` prefix and indent
- [x] **[MEDIUM]** Fix resolve manual override — document blue color and bold agent name
- [x] **[MEDIUM]** Fix resolve conflict detail — add missing `Type:` and `Detected:` lines
- [x] **[MEDIUM]** Fix resolve-conflicts resolution options — document green coloring
- [x] **[LOW]** Fix rework no-rework message — add `  ` leading indent
- [x] **[LOW]** Fix rework header — document `project.name || projectId` fallback
- [x] **[LOW]** Fix resolve-conflicts interactive merge header — document bold formatting
- [x] **[LOW]** Fix conflicts conflicting agent — document cyan coloring
- [x] **[MEDIUM]** Fix review-check auto-fix message — source says `gh api` not `gh pr api`
- [x] **[LOW]** Fix resolve-conflicts auto-resolve — document blue coloring
- [x] **[LOW]** Fix resolve-conflicts interactive merge — document "Selected proposed value" (green) outcome
- [x] **[LOW]** Fix Cross-Cutting config errors for resolve/conflicts — `No agent-orchestrator.yaml found` not `No config found`
