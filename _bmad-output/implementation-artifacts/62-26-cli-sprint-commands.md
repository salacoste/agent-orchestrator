# Story 62.26: CLI Sprint Commands

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Sprint Commands reference page that documents the 7 Sprint commands (sprint, sprint-start, sprint-end, sprint-summary, sprint-plan, velocity, plan) plus their flags, output formats, and usage examples,
so that I can understand each command's behavior, tracker requirements, and sprint lifecycle management capabilities.

## Acceptance Criteria

1. **Sprint Commands page** (`docs/cli/sprint-commands.md`) documents `ao sprint [project]`: description, flags (`--compact`, `--json`), column-based progress display, progress bar, WIP status, blocked story indicators, session info, bmad-only features (dependency graph, WIP limits, forecast), and JSON output shape — sourced from `packages/cli/src/commands/sprint.ts`
2. **Sprint Commands page** documents `ao sprint-start [project]`: description, flags (`--goal`, `--velocity`, `--start-date`, `--end-date`, `--sprint-number`, `--json`), date validation, auto-increment sprint number, YAML mutation, and output format — sourced from `packages/cli/src/commands/sprint-start.ts`
3. **Sprint Commands page** documents `ao sprint-end [project]`: description, flags (`--clear`, `--archive-done`, `--json`), bmad tracker requirement, sprint report metrics (velocity, cycle time, health, pace), archive behavior, and JSON output shape — sourced from `packages/cli/src/commands/sprint-end.ts`
4. **Sprint Commands page** documents `ao sprint-summary [project]`: description, flag (`--json`), bmad tracker requirement, single-screen summary layout (goal, progress bar, columns, stories, points, health, velocity, pace, days remaining, stuck stories, WIP alerts), and JSON output shape — sourced from `packages/cli/src/commands/sprint-summary.ts`
5. **Sprint Commands page** documents `ao sprint-plan`: description (no flags, no project argument), YAML-only operation (reads sprint-status.yaml from cwd), dependency graph with circular detection, status grouping, priority sorting, and performance warning — sourced from `packages/cli/src/commands/sprint-plan.ts`
6. **Sprint Commands page** documents `ao velocity [project]`: description, flags (`--weeks`, `--json`), bmad tracker requirement, horizontal bar chart, trend icons, completion estimate, and JSON output shape — sourced from `packages/cli/src/commands/velocity.ts`
7. **Sprint Commands page** documents `ao plan [project]`: description, flags (`--json`, `--accept`, `--full`), two code paths (bmad tracker vs YAML fallback), `--accept` behavior (moves stories to ready-for-dev), `--full` epic grouping, capacity/load analysis, and recommended stories — sourced from `packages/cli/src/commands/plan.ts`
8. **Page uses correct Just the Docs front matter**: `title: Sprint Commands`, `nav_order: 3`, `parent: CLI Reference`, `description` field
9. **No hero-style font classes** (`.fs-5`, `.fw-300`), **ASCII diagrams under 60 chars**, **all code blocks use correct syntax highlighting**
10. **Cross-links** verified: parent link to CLI Reference, sibling links to 7 other CLI category pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Sprint Commands page (AC: #1-10)
  - [x] Replace stub content in docs/cli/sprint-commands.md
  - [x] Write front matter (title, nav_order: 3, parent: CLI Reference, description)
  - [x] Write "Overview" section — 7 commands summary table
  - [x] Write "ao sprint" section — flags, column display, progress bar, bmad features, examples
  - [x] Write "ao sprint-start" section — flags, date validation, auto-increment, examples
  - [x] Write "ao sprint-end" section — flags, bmad requirement, metrics report, archive, examples
  - [x] Write "ao sprint-summary" section — flags, summary layout, bmad requirement, examples
  - [x] Write "ao sprint-plan" section — YAML-only operation, dependency graph, examples
  - [x] Write "ao velocity" section — flags, bar chart, trend analysis, bmad requirement, examples
  - [x] Write "ao plan" section — two paths, flags, capacity/load, --accept, --full, examples
  - [x] Write "Tracker Requirements" callout — which commands need bmad vs any tracker
  - [x] Write "Next Steps" cross-links

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All source claims verified against actual code
- No hero font classes
- ASCII diagrams under 60 chars
- Cross-links verified
- All code blocks use correct syntax highlighting
- `{: .highlight }` callout for tracker requirement

## Dev Notes

### Design Decisions

- **This story covers the Sprint Commands child page** — the index page (62-23), setup commands (62-24), and session commands (62-25) are done
- **The stub file** at `docs/cli/sprint-commands.md` has front matter with `title: Sprint Commands`, `nav_order: 3`, `parent: CLI Reference` — needs `description` added
- **7 commands** in Sprint category: sprint, sprint-start, sprint-end, sprint-summary, sprint-plan, velocity, plan
- **3 commands require bmad tracker**: sprint-end, sprint-summary, velocity (exit with error otherwise)
- **2 commands have conditional bmad features**: sprint (additive, non-fatal), plan (full features with bmad, YAML fallback without)
- **2 commands work without config**: sprint-plan (reads YAML from cwd), plan (YAML fallback path)
- **No ora spinners** are used in any Sprint command — all output is direct chalk/console
- **6 of 7 commands take `[project]` argument** — only sprint-plan does not
- **sprint-start writes directly to YAML config** — not through a service layer

### Previous Story Learnings (62-25)

- Source `.description()` strings must be quoted EXACTLY from source — no paraphrasing
- Flag descriptions must match source `.option()` strings exactly
- Command output strings must match actual `console.log` / `chalk` output
- Cross-link file existence must be verified
- Front matter needs `description` field for searchability
- Config error strings vary between commands — document the actual strings, not a generic one
- Split output sections when a command has multiple code paths (e.g., story-based vs plain flow in spawn)
- Use exact Unicode characters from source (e.g., `★` not `*`, `⊘` for blocked)

### Source Files

- **packages/cli/src/commands/sprint.ts** — `ao sprint` (column-based progress display)
- **packages/cli/src/commands/sprint-start.ts** — `ao sprint-start` (start new sprint)
- **packages/cli/src/commands/sprint-end.ts** — `ao sprint-end` (end sprint with report)
- **packages/cli/src/commands/sprint-summary.ts** — `ao sprint-summary` (single-screen summary)
- **packages/cli/src/commands/sprint-plan.ts** — `ao sprint-plan` (YAML-based execution plan)
- **packages/cli/src/commands/velocity.ts** — `ao velocity` (weekly velocity with bar chart)
- **packages/cli/src/commands/plan.ts** — `ao plan` (sprint planning with two paths)
- **packages/cli/src/lib/format.ts** — Output formatting (banner, header, padCol, getStoryStatusEmoji)
- **docs/cli/sprint-commands.md** — Replace stub with full documentation
- **docs/cli/index.md** — Parent page for cross-reference

### Key Sprint Command Facts (verified against source)

**Command count**: 7 flat top-level commands

| Command | File | --json | --project arg | bmad required | ora spinner |
|---------|------|--------|---------------|---------------|-------------|
| `ao sprint [project]` | sprint.ts | Yes | Yes (inline) | Conditional (additive) | No |
| `ao sprint-start [project]` | sprint-start.ts | Yes | Yes (inline) | No | No |
| `ao sprint-end [project]` | sprint-end.ts | Yes | Yes (inline) | Yes | No |
| `ao sprint-summary [project]` | sprint-summary.ts | Yes | Yes (inline) | Yes | No |
| `ao sprint-plan` | sprint-plan.ts | No | No | No (YAML only) | No |
| `ao velocity [project]` | velocity.ts | Yes | Yes (inline) | Yes | No |
| `ao plan [project]` | plan.ts | Yes | Yes (inline) | Conditional (two paths) | No |

**ao sprint flags** (from sprint.ts):
- `--compact`: Show only column counts
- `--json`: Output as JSON

**ao sprint-start flags** (from sprint-start.ts):
- `--goal <text>`: Sprint goal
- `--velocity <n>`: Target velocity (stories/sprint)
- `--start-date <date>`: Sprint start date (YYYY-MM-DD, defaults to today)
- `--end-date <date>`: Sprint end date (YYYY-MM-DD)
- `--sprint-number <n>`: Sprint number (auto-increments if not set)
- `--json`: Output as JSON

**ao sprint-end flags** (from sprint-end.ts):
- `--clear`: Archive sprint history and clear config dates/goal
- `--archive-done`: Also remove done stories from sprint-status.yaml (use with --clear)
- `--json`: Output as JSON

**ao sprint-summary flags** (from sprint-summary.ts):
- `--json`: Output as JSON

**ao sprint-plan flags** (from sprint-plan.ts):
- *(none)*

**ao velocity flags** (from velocity.ts):
- `--weeks <n>`: Number of weeks to show (default: 8)
- `--json`: Output as JSON

**ao plan flags** (from plan.ts):
- `--json`: Output as JSON
- `--accept`: Accept plan: move recommended stories to ready-for-dev
- `--full`: Show all stories grouped by epic

**Cross-cutting patterns:**
- 6 of 7 commands use `loadConfig()` + `resolveProject()` — sprint-plan does not
- sprint-plan reads YAML directly from `process.cwd()` — no config, no project resolution
- No ora spinners in any Sprint command — all output via direct chalk/console.log
- `[project]` argument is inline in `.command()` for all 6 commands that take it — not via `.argument()`
- sprint-start writes directly to YAML config file via `readFileSync`/`writeFileSync`
- bmad-only features in sprint: dependency graph, WIP limits, forecast — all non-fatal on failure
- Column colors: done=green, in-progress=cyan, review=blue, ready-for-dev=yellow, backlog=dim
- Status emoji (format.ts): backlog=📋, ready-for-dev=🟡, in-progress=🔵, review=👁️, done=✅

### Just the Docs Features Used

- `{: .highlight }` callout for tracker requirements
- `parent: CLI Reference` on child page
- Markdown tables for command reference, flags
- `bash` syntax highlighting for CLI examples
- `text` syntax highlighting for output examples

### References

- [Source: packages/cli/src/commands/sprint.ts — ao sprint column progress]
- [Source: packages/cli/src/commands/sprint-start.ts — ao sprint-start with date validation]
- [Source: packages/cli/src/commands/sprint-end.ts — ao sprint-end with metrics report]
- [Source: packages/cli/src/commands/sprint-summary.ts — ao sprint-summary single-screen]
- [Source: packages/cli/src/commands/sprint-plan.ts — ao sprint-plan YAML-based]
- [Source: packages/cli/src/commands/velocity.ts — ao velocity bar chart]
- [Source: packages/cli/src/commands/plan.ts — ao plan with two code paths]
- [Source: packages/cli/src/lib/format.ts — Output formatting utilities]
- [Source: docs/cli/index.md — Parent CLI Reference page]
- [Source: Story 62-25 — Previous story learnings (exact description strings, config error variants)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- 1 documentation file written replacing stub (docs/cli/sprint-commands.md)
- Source accuracy verification: All 7 command `.description()` strings verified against source (0 discrepancies)
- All 10 ACs verified against source code
- 7 commands documented: sprint, sprint-start, sprint-end, sprint-summary, sprint-plan, velocity, plan
- Command descriptions verified exact: sprint ("Show sprint progress — stories grouped by status column"), sprint-start ("Start a new sprint — set dates, goal, and target velocity"), sprint-end ("End a sprint — generate final metrics report"), sprint-summary ("Show a single-screen sprint summary with key metrics"), sprint-plan ("Generate sprint execution plan from sprint-status.yaml"), velocity ("Show weekly velocity history with trend analysis"), plan ("Show sprint planning — recommended stories, capacity, and blockers")
- All flag names and descriptions verified against `.option()` calls in source
- Column colors verified: done=green, in-progress=cyan, review=blue, ready-for-dev=yellow, backlog=dim
- Status emojis verified exact: backlog=📋, ready-for-dev=🟡, in-progress=🔵, review=👁️, done=✅, optional=⚪
- Tracker requirements documented: 3 bmad required, 2 conditional, 1 any tracker, 1 no tracker
- Two code paths documented for `ao plan` (bmad tracker vs YAML fallback)
- `{: .highlight }` callout used for Tracker Requirements section
- No hero font classes on page
- All cross-links verified (7 sibling pages + CLI Reference + Getting Started + Configuration)
- Front matter correct: title, nav_order: 3, parent: CLI Reference, description present

### File List

- `docs/cli/sprint-commands.md` — replaced stub with Sprint Commands documentation

### Change Log

- **2026-04-24:** Story created — Sprint Commands documentation page (1 file to replace)
- **2026-04-24:** Task 1 completed — Sprint Commands page written with 7 commands, all flags, examples, and cross-links
- **2026-04-24:** Story marked review — Phase 4 (CLI Reference) continued
- **2026-04-24:** Code review — 4 findings (0 HIGH, 2 MEDIUM, 2 LOW), all fixed
- **2026-04-24:** Story marked done

### Senior Developer Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (4 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[MEDIUM]** Fix Cross-Cutting Patterns config error string — source uses backtick quotes `` `ao init` ``, not single quotes
- [x] **[MEDIUM]** Fix sprint-plan circular dependency and performance warning spacing — source uses `⚠️  ` (double space), not `⚠️ ` (single)
- [x] **[LOW]** Add YAML fallback note to `ao plan` JSON output section
- [x] **[LOW]** Fix sprint JSON shape `blockedBy: null` — show both blocked (with `blockedBy` array) and non-blocked (without `blockedBy`) examples
