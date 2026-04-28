---
title: BMAD
nav_order: 3
parent: Tracker Plugins
grand_parent: Plugins
description: bmad tracker plugin — filesystem-based tracker using YAML sprint status and markdown story files. No network calls, 10 of 10 optional methods, 26 sprint analytics sub-modules.
---

# BMAD Tracker

The **bmad** plugin is a fully local, filesystem-based tracker that reads and writes YAML sprint-status files and markdown story files. It requires no network access, no API keys, and implements **all 10 optional methods** — making it the most feature-rich tracker plugin. It also provides **26 sub-modules** for sprint analytics including forecasting, Monte Carlo simulation, CFD, and retrospective.

{: .highlight }
> **Fully local:** The bmad plugin makes zero network calls. All data lives in your project's `_bmad-output/` directory as YAML and markdown files. Perfect for air-gapped environments, local-first workflows, or teams that manage work in flat files.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `bmad` |
| **Slot** | `tracker` |
| **Package** | `@composio/ao-plugin-tracker-bmad` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The bmad plugin reads `sprint-status.yaml` for issue state and `story-*.md` files for issue content. All file writes are atomic (write to tmp file, then rename).

```text
getIssue(identifier, project)
  |
  +-- readSprintStatus(project)
  |     +-- Parse sprint-status.yaml
  |     +-- Look up identifier in development_status
  |
  +-- readFileOrNull(storyFilePath)
  |     +-- Parse H1 title from markdown
  |     +-- Extract description
  |
  +-- mapBmadState(status)
  |     +-- 7-state mapping
  |
  +-- Return Issue

generatePrompt(identifier, project)
  |
  +-- getIssue() for base content
  +-- validateDependencies() for warnings
  +-- extractAcceptanceCriteria() for checklist
  +-- Optional: architecture context (4000 chars max)
  +-- Optional: PRD context (3000 chars max)
  +-- Tech spec (4000 chars max)
  +-- Epic overview (2000 chars max)
  +-- Related stories (max 10 siblings)
  |
  +-- Return rich prompt
```

---

## Filesystem Approach

- **Sprint status**: `{outputDir}/sprint-status.yaml` — YAML file with `development_status` mapping
- **Story files**: `{outputDir}/{storyDir}/story-{id}.md` — Markdown files with H1 title, acceptance criteria, and implementation details
- **Tech specs**: `{outputDir}/{storyDir}/tech-spec-{id}.md` — Optional technical specification files
- **Epic files**: `{outputDir}/{storyDir}/epic-{slug}.md` — Epic description files
- **Architecture**: `{outputDir}/planning-artifacts/architecture.md` — Project architecture
- **PRD**: `{outputDir}/planning-artifacts/prd.md` — Product requirements
- **Atomic writes**: Uses `writeFileSync` to tmp file + `renameSync` for crash safety

---

## State Mapping

BMad supports 8 sprint column states that map to 3 Agent Orchestrator states:

| BMad Status | Agent Orchestrator State |
|-------------|--------------------------|
| `done` | `closed` |
| `epic-done` | `closed` |
| `in-progress` | `in_progress` |
| `review` | `in_progress` |
| `epic-in-progress` | `in_progress` |
| `backlog` | `open` |
| `ready-for-dev` | `open` |
| `epic-backlog` | `open` |

For reverse mapping (in `updateIssue`):

| Agent Orchestrator State | BMad Target Status |
|--------------------------|-------------------|
| `closed` / `cancelled` | `done` |
| `in_progress` | `in-progress` |
| `open` | `ready-for-dev` |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"bmad"` |

### Required Methods (5)

#### getIssue(identifier, project)

Fetches issue details from filesystem:

- Reads `sprint-status.yaml` to find status and epic
- Reads `story-{identifier}.md` for title (extracts H1) and description
- Builds labels from epic name and current status
- Returns `file://` URL pointing to story file

#### isCompleted(identifier, project)

Checks if story is done:

- Reads sprint status and maps via `mapBmadState()`
- Returns `true` for `done` and `epic-done` statuses

#### issueUrl(identifier, project)

Generates local file URL:

- Returns `file://{encodedPath}` pointing to story markdown file

#### branchName(identifier, project)

Generates branch name with configurable prefix:

- Sanitizes identifier for git branch safety (removes `~^:?*[]\`, collapses dashes)
- Returns `{prefix}/{identifier}` where prefix defaults to `"feat"`
- Falls back to `{prefix}/story` if identifier is empty after sanitization

#### generatePrompt(identifier, project)

**The richest prompt generator** of all tracker plugins. Builds a comprehensive prompt including:

1. **Dependency warnings** — checks for unfinished dependencies, lists blockers
2. **Story content** — full story description
3. **Acceptance criteria checklist** — extracted from `## Acceptance Criteria` section, formatted as `- [ ]` items
4. **Architecture context** (if `includeArchContext: true`) — tech stack section + full architecture doc (4000 chars max, truncated)
5. **PRD context** (if `includePrdContext: true`) — product requirements (3000 chars max, truncated)
6. **Technical specification** — tech spec file (4000 chars max, truncated)
7. **Epic overview** — epic markdown file (2000 chars max, truncated)
8. **Related stories** — up to 10 sibling stories in the same epic with status

### Optional Methods (10 — all implemented)

#### issueLabel(url, project)

Extracts identifier from file URL:

- Parses `story-{identifier}.md` pattern from URL
- Falls back to raw URL

#### listIssues(filters, project)

Lists stories from sprint status:

- Skips epic-level entries (entries starting with `epic-`)
- Filters by state and labels
- Reads story files for titles
- Default limit: 30

#### updateIssue(identifier, update, project)

Updates story status and records history:

- Maps state to BMad status via `reverseMapState()`
- **Atomic write** to `sprint-status.yaml` (tmp + rename)
- Records transition in history log
- Handles assignee updates via `writeStoryAssignment()`
- Appends comments to history as audit trail entries

#### createIssue(input, project)

Creates a new story:

- Auto-generates ID by incrementing highest numeric suffix in existing IDs
- Validates title is required
- Adds entry to `sprint-status.yaml` with `backlog` status
- Writes story markdown file with H1 title and AC placeholder
- Records creation in history log
- Derives epic from labels (looks for `epic-*` prefix)

#### validateIssue(identifier, project)

Pre-flight validation before spawning an agent:

1. **Story file exists** — error if missing
2. **Story has content** — error if empty
3. **Has H1 title** — error if missing
4. **Has acceptance criteria** — error if none found
5. **Status is spawnable** — error if `done`, `in-progress`, or `review`
6. **Dependencies met** — error if blocked by unfinished dependencies
7. **Tech spec exists** — warning (non-blocking) if no tech spec

Returns `{ valid, errors, warnings }`.

#### findIssueByBranch(branch, project)

Reverse lookups story by branch name:

- Delegates to `findStoryForPR()` from auto-transition module

#### onPRMerge(issueId, prUrl, project)

Handles PR merge event:

- Delegates to `transitionOnMerge()` for status transition

#### onSessionDeath(issueId, project, sessionId?)

Resets story on session death:

- Only resets stories currently `in-progress` (not `review` or `done`)
- Honors `autoResetOnDeath: false` config to disable
- Only resets if dying session matches assigned session
- Resets status to `ready-for-dev` and clears assignment
- Records transition in history

#### getEpicTitle(epicId, project)

Resolves epic identifier to title:

- Reads epic markdown file and extracts H1 title
- Falls back to epic slug if file is missing

#### getNotifications(project)

Sprint health notifications with configurable thresholds:

| Threshold Key | Description |
|--------------|-------------|
| `stuckHours` | Hours before flagging stuck stories |
| `wipLimit` | Maximum WIP across active columns |
| `throughputDropPct` | Percentage drop triggering alert |
| `forecastBehind` | Stories behind forecast schedule |
| `reworkRatePct` | Rework rate percentage threshold |
| `reworkCountPerStory` | Rework events per story threshold |
| `columnAgingHours` | Hours before flagging aged stories |
| `circularDepsEnabled` | Enable circular dependency detection |
| `blockedStoriesEnabled` | Enable blocked story detection |

{: .highlight }
> **Configurable thresholds:** The table above shows the 9 keys forwarded from tracker config to `getNotifications`. The internal `NotificationThresholds` interface defines 16 total keys — the remaining 7 (e.g., `backlogAgingDays`, `cycleTimeRegressionPct`, `teamOverloadLimit`) use compiled-in defaults.

---

## Extra Capabilities: 26 Sub-Modules

The bmad plugin includes 26 sub-modules for sprint analytics beyond the Tracker interface:

### Forecasting & Simulation
- **forecast** — Sprint completion forecasting
- **monte-carlo** — Monte Carlo simulation for delivery estimates
- **forecast-log** — Forecast snapshot logging
- **forecast-calibration** — Forecast accuracy analysis
- **forecast-diff** — Forecast comparison across sprints

### Sprint Analytics
- **cfd** — Cumulative Flow Diagram data
- **cycle-time** — Story cycle time analysis
- **throughput** — Daily throughput and lead time metrics
- **velocity-comparison** — Sprint-to-sprint velocity trends
- **sprint-comparison** — Cross-sprint metric comparison
- **sprint-health** — WIP limits and health indicators
- **sprint-goals** — Sprint goal tracking
- **sprint-archive** — Sprint archiving and unfinished story carry-over
- **sprint-notifications** — Configurable threshold-based alerts

### Story & Epic Management
- **story-detail** — Per-story detail with transitions
- **story-aging** — Column aging analysis
- **epic-management** — CRUD for epics
- **dependencies** — Dependency graph and cycle detection

### Team & Process
- **team-workload** — Per-member workload distribution
- **standup** — Automated standup report generation
- **retrospective** — Sprint retrospective analysis
- **rework** — Rework event tracking
- **planning** — Sprint planning with story selection

### Infrastructure
- **sprint-status-reader** — YAML parsing for sprint status
- **history** + **history-query** — Event history and querying
- **auto-transition** — Status transitions on PR merge
- **workflow-columns** — Config-aware column definitions

---

## Configuration

### Basic Setup

```yaml
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
```

### Custom Story Directory and Branch Prefix

```yaml
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
      storyDir: implementation-artifacts  # default
      branchPrefix: feat                  # default
```

### Rich Prompts with Context

```yaml
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
      includeArchContext: true   # include architecture.md (4000 chars max)
      includePrdContext: true    # include prd.md (3000 chars max)
```

### Notification Thresholds

```yaml
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
      stuckHours: 24
      wipLimit: 5
      throughputDropPct: 30
      columnAgingHours: 48
      circularDepsEnabled: true
      blockedStoriesEnabled: true
```

### Session Death Behavior

```yaml
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
      autoResetOnDeath: false   # disable auto-reset on session death
```

---

## When to Use BMAD

| Scenario | Recommendation |
|----------|---------------|
| Local-first workflow | Use bmad — no network required |
| Sprint analytics needed | Use bmad — 26 sub-modules for forecasting, CFD, Monte Carlo |
| Pre-flight validation | Use bmad — `validateIssue` checks deps, AC, status |
| PR-based auto-transition | Use bmad — `onPRMerge` transitions story status |
| Open-source projects | Use github — public issues |
| Product teams with Linear | Use linear — native integration |

---

## Next Steps

- [GitHub](../github/) — Default tracker via `gh` CLI
- [Linear](../linear/) — Linear tracker with dual transport
- [Tracker Plugins](./) — Tracker plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
