# BMad Tracker Plugin

## Overview

The BMad tracker plugin (`tracker-bmad`) is a file-based issue tracker implementation for the Agent Orchestrator. It reads sprint data from local YAML, Markdown, and JSONL files -- there are zero external API calls. All data lives in the project repository alongside the code.

BMad implements the full `Tracker` interface defined in `@composio/ao-core` (`packages/core/src/types.ts`), providing issue management, agent prompt generation, sprint analytics, health monitoring, forecasting, and automated status transitions.

**Package**: `@composio/ao-tracker-bmad`
**Source**: `packages/plugins/tracker-bmad/src/`
**Plugin slot**: `tracker`
**Version**: `0.1.0`

---

## Configuration

### agent-orchestrator.yaml

```yaml
projects:
  my-project:
    path: ~/my-project
    tracker:
      plugin: bmad
      outputDir: _bmad-output              # default: "_bmad-output"
      storyDir: implementation-artifacts    # default: "implementation-artifacts"
      branchPrefix: feat                    # default: "feat"
      includeArchContext: true              # include architecture.md in agent prompt (default: false)
      includePrdContext: false              # include prd.md in agent prompt (default: false)
      sprintEndDate: "2026-03-21"          # ISO date; enables pace calculation in forecast
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `plugin` | `string` | (required) | Must be `"bmad"` |
| `outputDir` | `string` | `"_bmad-output"` | Root directory for all BMad files, relative to project path |
| `storyDir` | `string` | `"implementation-artifacts"` | Subdirectory within `outputDir` containing story, epic, and tech-spec files |
| `branchPrefix` | `string` | `"feat"` | Git branch name prefix (e.g., `feat/story-1`) |
| `includeArchContext` | `boolean` | `false` | When true, `generatePrompt` includes architecture.md content (truncated to 4000 chars) |
| `includePrdContext` | `boolean` | `false` | When true, `generatePrompt` includes prd.md content (truncated to 3000 chars) |
| `sprintEndDate` | `string` | (none) | ISO date string for sprint deadline. Required for pace calculation in forecast. Without it, `pace` is always `"no-data"`. |
| `autoResetOnDeath` | `boolean` | `true` | When a session dies (killed/errored/stuck), automatically reset in-progress stories back to `ready-for-dev`. Set to `false` to keep the status unchanged. |
| `stuckHours` | `number` | `48` | Hours before an in-progress/review story triggers a stuck notification. |
| `wipLimit` | `number` | `3` | WIP limit per active column before triggering a notification. |
| `throughputDropPct` | `number` | `30` | Throughput drop percentage threshold (compared to 4-week average) for notifications. |
| `forecastBehind` | `boolean` | `true` | Whether to emit notifications when forecast pace is `"behind"`. |

### File Structure

All paths are relative to `{project.path}/{outputDir}`:

```
{outputDir}/
  sprint-status.yaml              # Sprint board state (all stories, statuses, epics)
  sprint-history.jsonl            # Append-only transition log
  planning-artifacts/
    architecture.md               # Architecture document (optional, for prompt context)
    prd.md                        # Product requirements (optional, for prompt context)
  {storyDir}/
    story-{id}.md                 # Story files (title, description, acceptance criteria)
    epic-{slug}.md                # Epic files (title, overview)
    tech-spec-{id}.md             # Technical specifications (optional, for prompt context)
```

### sprint-status.yaml Format

```yaml
development_status:
  story-1:
    status: in-progress
    epic: epic-auth
  story-2:
    status: done
    epic: epic-auth
  story-3:
    status: backlog
    epic: epic-dashboard
  epic-auth:
    status: epic-in-progress
```

Valid story statuses: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`
Valid epic statuses: `epic-backlog`, `epic-in-progress`, `epic-done`

Epic-level entries (IDs starting with `epic-` or statuses starting with `epic-`) are automatically excluded from story counts and listings.

---

## Core Tracker Interface

The plugin implements every method on the `Tracker` interface. Source: `packages/plugins/tracker-bmad/src/index.ts`.

### getIssue

```typescript
async getIssue(identifier: string, project: ProjectConfig): Promise<Issue>
```

Reads the story's entry from `sprint-status.yaml` and its corresponding `story-{id}.md` file. Returns an `Issue` with:

- `id`: the identifier string
- `title`: extracted from the H1 heading in the story markdown (falls back to the identifier)
- `description`: full markdown content of the story file (empty string if file is missing)
- `url`: `file://` URL to the story file on disk
- `state`: mapped from BMad status (`done` -> `"closed"`, `in-progress`/`review` -> `"in_progress"`, everything else -> `"open"`)
- `labels`: array containing the epic slug (if present) followed by the BMad status string

Throws if the identifier is not found in `sprint-status.yaml`.

### isCompleted

```typescript
async isCompleted(identifier: string, project: ProjectConfig): Promise<boolean>
```

Returns `true` if the story's status maps to `"closed"` (i.e., status is `"done"` or `"epic-done"`). Returns `false` if the story is not found.

### issueUrl

```typescript
issueUrl(identifier: string, project: ProjectConfig): string
```

Returns a `file://` URL pointing to the story markdown file. Path segments are URI-encoded.

### issueLabel

```typescript
issueLabel(url: string, _project: ProjectConfig): string
```

Extracts the story identifier from a file URL by matching the `story-{id}.md` pattern. Falls back to returning the full URL.

### branchName

```typescript
branchName(identifier: string, project: ProjectConfig): string
```

Generates a git-safe branch name: `{branchPrefix}/{sanitized-identifier}`. The identifier is sanitized by replacing characters invalid in git branch names (`~`, `^`, `:`, `?`, `*`, `[`, `]`, `\`, `/`, spaces), collapsing double dots and consecutive hyphens, and stripping `.lock` suffixes.

Example: identifier `"story-1"` with default prefix produces `"feat/story-1"`.

### generatePrompt

```typescript
async generatePrompt(identifier: string, project: ProjectConfig): Promise<string>
```

Generates a rich context prompt for an AI agent working on the story. The prompt assembles multiple sections in order:

1. **Story header** -- title and identifier
2. **Story content** -- full markdown from `story-{id}.md`
3. **Acceptance criteria checklist** -- extracted bullet items from the `## Acceptance Criteria` section, formatted as `- [ ]` checkboxes
4. **Tech stack** -- extracted from `## Tech Stack` or `## Technology` section of `architecture.md` (only if `includeArchContext: true`)
5. **Architecture context** -- full `architecture.md` content, truncated to 4000 chars (only if `includeArchContext: true`)
6. **Product requirements** -- full `prd.md` content, truncated to 3000 chars (only if `includePrdContext: true`)
7. **Technical specification** -- `tech-spec-{id}.md`, truncated to 4000 chars
8. **Epic overview** -- the parent epic's markdown, truncated to 2000 chars
9. **Related stories** -- up to 10 sibling stories in the same epic, showing ID, title, and status

### listIssues

```typescript
async listIssues(filters: IssueFilters, project: ProjectConfig): Promise<Issue[]>
```

Lists issues from `sprint-status.yaml`, excluding epic-level entries. Supports filtering by:

- `state`: `"open"` (includes `open` + `in_progress`), `"closed"`, or `"all"`
- `labels`: match if the entry's epic or status is in the filter list
- `limit`: max results (default 30)

### updateIssue

```typescript
async updateIssue(identifier: string, update: IssueUpdate, project: ProjectConfig): Promise<void>
```

Writes a new status back to `sprint-status.yaml`. The state mapping on write is:

| `IssueUpdate.state` | Written BMad status |
|---|---|
| `"closed"`, `"cancelled"` | `"done"` |
| `"in_progress"` | `"in-progress"` |
| `"open"` | `"ready-for-dev"` |

The YAML file is written atomically using a temp file + rename pattern. After a successful write, a history entry is appended to `sprint-history.jsonl`.

### validateIssue

```typescript
async validateIssue(identifier: string, project: ProjectConfig): Promise<IssueValidationResult>
```

Pre-spawn validation that checks:

**Errors** (blocks spawning):
- Story file `story-{id}.md` does not exist
- Story file is empty
- Story has no H1 title
- Story has no acceptance criteria bullets
- Story status is `done`, `in-progress`, or `review` (already active or finished)

**Warnings** (non-blocking):
- No tech spec file found (`tech-spec-{id}.md`)

### createIssue

```typescript
async createIssue(input: CreateIssueInput, project: ProjectConfig): Promise<Issue>
```

Creates a new story in the sprint. The method:

1. **Auto-generates a story ID** by scanning existing IDs in `sprint-status.yaml` for the highest numeric suffix and incrementing it. IDs follow the `s{N}` pattern (e.g., `s1`, `s2`, `s3`).
2. **Validates** that a non-empty title is provided (throws if missing).
3. **Adds the entry** to `sprint-status.yaml` with status `"backlog"` and optional epic label (extracted from `input.labels` matching `epic-*`).
4. **Writes a story markdown file** (`story-{id}.md`) with the title as H1, description body, and a placeholder acceptance criteria section.
5. **Records a history entry** (`"" → "backlog"`) in `sprint-history.jsonl`.
6. **Creates the story directory** if it doesn't exist (using `mkdirSync` with `{ recursive: true }`).

Returns the created `Issue` with state `"open"` and labels array.

### findIssueByBranch

```typescript
async findIssueByBranch?(branch: string, project: ProjectConfig): Promise<string | null>
```

Optional Tracker interface method. Reverse-lookups a story ID from a git branch name. Delegates to `findStoryForPR()` from `auto-transition.ts`. Returns the matched story ID or `null`.

Used by the lifecycle-manager when a PR merge event lacks a session-level `issueId` — the manager calls this method to discover the associated story from the branch name.

### onPRMerge

```typescript
async onPRMerge?(issueId: string, prUrl: string | undefined, project: ProjectConfig): Promise<void>
```

Optional Tracker interface method. Handles the full merge-transition flow for a story. Delegates to `transitionOnMerge()` which:
- Sets the story status to `"done"` in `sprint-status.yaml`
- Appends a history entry
- Produces an `AutoTransitionEvent`

Called by the lifecycle-manager when a session reaches the `"merged"` state, replacing the previous inline BMad-specific logic.

### onSessionDeath

```typescript
async onSessionDeath?(issueId: string, project: ProjectConfig): Promise<void>
```

Optional Tracker interface method. Resets a story's status when its agent session dies (killed, errored, or stuck). The BMad implementation:

1. Reads the story's current status from `sprint-status.yaml`.
2. **Only resets `in-progress` stories** — stories in `review` or `done` are left unchanged (review may indicate human review is pending).
3. Checks the `autoResetOnDeath` config option — if explicitly `false`, does nothing.
4. Writes the new status (`ready-for-dev`) via `writeStoryStatus()` and records a history entry.

Called by the lifecycle-manager when a session transitions to `killed`, `errored`, or `stuck`.

### getNotifications

```typescript
async getNotifications?(project: ProjectConfig): Promise<OrchestratorEvent[]>
```

Optional Tracker interface method. Evaluates sprint health and forecast against configurable thresholds, returning notification events for dispatch. The BMad implementation:

1. Reads optional threshold overrides from the tracker config (`stuckHours`, `wipLimit`, `throughputDropPct`, `forecastBehind`).
2. Calls `checkSprintNotifications()` to produce `SprintNotification` objects.
3. Maps each notification to an `OrchestratorEvent` via `formatNotificationEvent()`.

Called by the lifecycle-manager's polling loop. Notifications are debounced — only newly-appeared notification types trigger dispatch.

---

## Shared Helpers

Exported from `packages/plugins/tracker-bmad/src/index.ts` for use by the CLI and web dashboard.

### BMAD_COLUMNS

```typescript
const BMAD_COLUMNS = ["backlog", "ready-for-dev", "in-progress", "review", "done"] as const;
```

Ordered array of sprint board columns.

### BmadColumn

```typescript
type BmadColumn = "backlog" | "ready-for-dev" | "in-progress" | "review" | "done";
```

### getBmadStatus

```typescript
function getBmadStatus(labels: string[]): string
```

Extracts the BMad status from an issue's labels array by returning the last label (lowercased). Falls back to `"backlog"` if labels are empty.

### categorizeStatus

```typescript
function categorizeStatus(bmadStatus: string): "done" | "in-progress" | "open"
```

Maps a BMad status to a high-level bucket:

| BMad status | Category |
|---|---|
| `"done"` | `"done"` |
| `"in-progress"`, `"review"` | `"in-progress"` |
| everything else | `"open"` |

### readEpicTitle

```typescript
function readEpicTitle(epicSlug: string, project: ProjectConfig): string
```

Reads the H1 title from `epic-{slug}.md`. Returns the slug as fallback if the file is missing or unreadable.

---

## Analytics Modules

### History

**Source**: `packages/plugins/tracker-bmad/src/history.ts`

The history module manages the append-only transition log stored in `sprint-history.jsonl`. Each line is a JSON object recording a single status transition.

#### HistoryEntry

```typescript
interface HistoryEntry {
  timestamp: string;   // ISO-8601
  storyId: string;
  fromStatus: string;
  toStatus: string;
}
```

#### appendHistory

```typescript
function appendHistory(
  project: ProjectConfig,
  storyId: string,
  fromStatus: string,
  toStatus: string,
): void
```

Appends a single JSONL line with the current ISO timestamp. Creates the directory and file if they do not exist. Write failures are silently swallowed (best-effort).

#### readHistory

```typescript
function readHistory(project: ProjectConfig): HistoryEntry[]
```

Reads and parses all lines from `sprint-history.jsonl`. Malformed lines are skipped. Each entry is validated for required string fields and a valid ISO date prefix (`YYYY-MM-DD`). Returns an empty array if the file is missing or unreadable.

---

### Cycle Time

**Source**: `packages/plugins/tracker-bmad/src/cycle-time.ts`

Transforms the JSONL history into per-story cycle times, column dwell times, throughput rates, and bottleneck detection.

#### CycleTimeStats

```typescript
interface CycleTimeStats {
  stories: StoryCycleTime[];
  averageCycleTimeMs: number;
  medianCycleTimeMs: number;
  averageColumnDwells: ColumnDwell[];   // sorted by dwellMs descending
  bottleneckColumn: string | null;       // column with highest average dwell
  throughputPerDay: number;              // trailing 7-day window
  throughputPerWeek: number;             // trailing 28-day window
  completedCount: number;
}
```

#### StoryCycleTime

```typescript
interface StoryCycleTime {
  storyId: string;
  startedAt: string;         // ISO-8601
  completedAt: string;       // ISO-8601
  cycleTimeMs: number;
  columnDwells: ColumnDwell[];
}
```

#### ColumnDwell

```typescript
interface ColumnDwell {
  column: string;
  dwellMs: number;
}
```

#### computeCycleTime

```typescript
function computeCycleTime(project: ProjectConfig): CycleTimeStats
```

**Algorithm**:

1. Read all history entries and group by `storyId`.
2. For each story, sort transitions chronologically.
3. Find the last transition where `toStatus === "done"` (handles stories that bounce back and complete again).
4. Determine `startedAt` as the timestamp of the first transition where `fromStatus === "backlog"`, or the first transition overall.
5. Compute `cycleTimeMs` as `completedAt - startedAt`.
6. Compute per-transition column dwells (time between consecutive transitions).
7. Aggregate across all completed stories: mean, median, per-column average dwell times.
8. Identify the bottleneck column as the one with the highest average dwell time.
9. Compute throughput: count of stories completed within a trailing 7-day window divided by 7 (for daily), and within a trailing 28-day window (for weekly, scaled by 7).

Returns an empty stats object if no history exists or no stories have reached `done`.

---

### Sprint Health

**Source**: `packages/plugins/tracker-bmad/src/sprint-health.ts`

Surfaces actionable health indicators: stuck stories, WIP overload, throughput regression, and bottleneck warnings.

#### SprintHealthResult

```typescript
interface SprintHealthResult {
  overall: HealthSeverity;
  indicators: HealthIndicator[];
  stuckStories: string[];
  wipColumns: string[];
}
```

#### HealthIndicator

```typescript
interface HealthIndicator {
  id: string;
  severity: HealthSeverity;
  message: string;
  details: string[];
}

type HealthSeverity = "ok" | "warning" | "critical";
```

#### computeSprintHealth

```typescript
function computeSprintHealth(project: ProjectConfig): SprintHealthResult
```

Evaluates four health checks:

**1. Stuck stories** -- stories in `in-progress` or `review` with no transition for an extended period.

| Condition | Severity |
|---|---|
| No transition for >= 96 hours | `critical` |
| No transition for >= 48 hours | `warning` |

Only stories with at least one history entry are evaluated (no history = cannot determine staleness).

**2. WIP alerts** -- too many stories in active columns (`in-progress`, `review`).

| Condition | Severity |
|---|---|
| Column count > 5 | `critical` |
| Column count > 3 | `warning` |

**3. Throughput drop** -- compares 7-day daily throughput against 4-week daily average (via `computeCycleTime`).

| Condition | Severity |
|---|---|
| Ratio < 0.4 (< 40% of average) | `critical` |
| Ratio < 0.7 (< 70% of average) | `warning` |

**4. Bottleneck warning** -- one column's average dwell time is >= 2x the next-highest column.

| Condition | Severity |
|---|---|
| Highest dwell >= 2x second-highest | `warning` |

The `overall` severity is the worst severity found across all indicators.

#### Thresholds Summary

| Constant | Value |
|---|---|
| `STUCK_WARNING_MS` | 48 hours |
| `STUCK_CRITICAL_MS` | 96 hours |
| `WIP_WARNING` | 3 |
| `WIP_CRITICAL` | 5 |
| `THROUGHPUT_WARNING_RATIO` | 0.7 |
| `THROUGHPUT_CRITICAL_RATIO` | 0.4 |
| `BOTTLENECK_RATIO` | 2 |

---

### Forecast

**Source**: `packages/plugins/tracker-bmad/src/forecast.ts`

Projects sprint completion date and pace using linear regression on the cumulative completion curve.

#### SprintForecast

```typescript
interface SprintForecast {
  projectedCompletionDate: string | null;   // ISO date
  daysRemaining: number | null;
  pace: "ahead" | "on-pace" | "behind" | "no-data";
  confidence: number;                        // R-squared from regression (0-1)
  currentVelocity: number;                   // stories per day (regression slope)
  requiredVelocity: number;                  // stories per day needed to hit sprintEndDate
  remainingStories: number;
  totalStories: number;
  completedStories: number;
}
```

#### computeForecast

```typescript
function computeForecast(project: ProjectConfig): SprintForecast
```

**Algorithm**:

1. Count total and completed stories from `sprint-status.yaml` (excluding epic-level entries).
2. If all stories are done, return immediately with `pace: "ahead"`, `daysRemaining: 0`.
3. Read history and group completions (`toStatus === "done"`) by calendar date.
4. Build cumulative completion data points: `x` = day index from first completion, `y` = cumulative count.
5. Fit a linear regression (`y = mx + b`) to the data points with R-squared confidence.
6. Project the completion date: extrapolate when cumulative completions reach `totalStories` using the regression slope.
7. Compute `daysRemaining` from today to the projected date.
8. If `sprintEndDate` is configured, determine pace:

| Condition | Pace |
|---|---|
| currentVelocity >= requiredVelocity * 1.1 | `"ahead"` |
| currentVelocity >= requiredVelocity * 0.9 | `"on-pace"` |
| otherwise | `"behind"` |

Without `sprintEndDate`, pace is always `"no-data"`.

Requires at least 2 data points (2 distinct completion dates) for regression. The `confidence` field is the R-squared value of the regression fit.

---

### Retrospective

**Source**: `packages/plugins/tracker-bmad/src/retrospective.ts`

Groups completed stories by ISO calendar week (Monday-Sunday) and computes velocity trends, carry-over counts, and cycle time averages per period.

#### RetrospectiveResult

```typescript
interface RetrospectiveResult {
  periods: SprintPeriod[];
  velocityTrend: number[];              // completedCount per period
  averageVelocity: number;              // mean of velocityTrend
  velocityChange: number;               // % change: last period vs average (-100 to +inf)
  totalCompleted: number;
  overallAverageCycleTimeMs: number;
}
```

#### SprintPeriod

```typescript
interface SprintPeriod {
  startDate: string;           // ISO date (Monday)
  endDate: string;             // ISO date (Sunday)
  completedCount: number;
  averageCycleTimeMs: number;
  carryOverCount: number;      // stories active this week but not completed
  storyIds: string[];          // completed story IDs
}
```

#### computeRetrospective

```typescript
function computeRetrospective(project: ProjectConfig): RetrospectiveResult
```

**Algorithm**:

1. Read all history and group entries by `storyId`.
2. Sort each story's entries chronologically.
3. For each `done` transition, determine which ISO week it falls in (by computing the Monday of that week).
4. Compute cycle time per completion: time from the first non-backlog transition (or first transition overall) to the `done` transition.
5. Each story is counted only once per week even if it has multiple `done` transitions.
6. Carry-over count: stories with any activity in a week but not completed that week.
7. Build sorted periods array and derive velocity trend, average velocity, and velocity change percentage.

The `velocityChange` is calculated as `((lastPeriodVelocity - averageVelocity) / averageVelocity) * 100`. Requires at least 2 periods to compute.

---

### Story Detail

**Source**: `packages/plugins/tracker-bmad/src/story-detail.ts`

Provides a detailed view of a single story's transition history, column dwell times, and lifecycle timestamps.

#### StoryDetail

```typescript
interface StoryDetail {
  storyId: string;
  currentStatus: string;
  epic: string | null;
  transitions: StoryTransition[];
  columnDwells: Array<{ column: string; totalDwellMs: number }>;  // sorted desc by dwell
  totalCycleTimeMs: number | null;   // null if not yet done
  startedAt: string | null;          // first non-backlog transition
  completedAt: string | null;        // last done transition
  isCompleted: boolean;
}
```

#### StoryTransition

```typescript
interface StoryTransition {
  timestamp: string;          // ISO-8601
  fromStatus: string;
  toStatus: string;
  dwellMs: number | null;    // time in fromStatus before this transition; null for first
}
```

#### getStoryDetail

```typescript
function getStoryDetail(storyId: string, project: ProjectConfig): StoryDetail
```

**Algorithm**:

1. Read current status and epic from `sprint-status.yaml`. If the story is not found, returns a detail object with `currentStatus: "unknown"` and empty arrays.
2. Read history and filter to entries for this story. If no history entries exist, returns the known status with empty transitions.
3. Sort entries chronologically.
4. Build transitions array. Each transition after the first includes `dwellMs` (time since the previous transition).
5. Aggregate column dwell times: for each pair of consecutive transitions, the time between them is attributed to the `toStatus` column of the earlier transition. Results are sorted by total dwell time descending.
6. `startedAt`: timestamp of the first transition where `fromStatus === "backlog"`, or the first transition overall.
7. `completedAt`: timestamp of the last transition where `toStatus === "done"`, or `null`.
8. `totalCycleTimeMs`: `completedAt - startedAt` if completed, otherwise `null`.

---

## Auto-Transition System

**Source**: `packages/plugins/tracker-bmad/src/auto-transition.ts`

Handles automatic story status transitions triggered by external events (primarily PR merges).

### Types

```typescript
interface AutoTransitionEvent {
  type: "bmad.story_done";
  storyId: string;
  timestamp: string;          // ISO-8601
  previousStatus: string;
  prUrl?: string;
}

interface AutoTransitionResult {
  transitioned: boolean;
  storyId: string;
  previousStatus: string;
  newStatus: string;
  event: AutoTransitionEvent | null;
  reason: string;             // "transitioned" | "already_done" | "story_not_found"
}
```

### writeStoryStatus

```typescript
function writeStoryStatus(project: ProjectConfig, storyId: string, newStatus: string): void
```

Low-level YAML writer. Reads `sprint-status.yaml`, updates the specified story's status field, and writes the full document back. Throws if the file is missing, malformed, or the story ID is not found.

### transitionOnMerge

```typescript
function transitionOnMerge(
  project: ProjectConfig,
  storyId: string,
  prUrl?: string,
): AutoTransitionResult
```

Orchestrates the full transition-on-merge flow:

1. Read sprint status and find the story entry.
2. If the story is not found, return `reason: "story_not_found"`.
3. If the story is already `"done"`, return `reason: "already_done"`.
4. Call `writeStoryStatus` to set status to `"done"`.
5. Call `appendHistory` to record the transition.
6. Create and return an `AutoTransitionEvent` of type `"bmad.story_done"`.

### findStoryForPR

```typescript
function findStoryForPR(project: ProjectConfig, branchName: string): string | null
```

Matches a git branch name to a story ID. Loads all story IDs from `sprint-status.yaml`, sorts them by length descending (so longer, more specific IDs match first), and returns the first ID found as a substring of the branch name. Returns `null` if no match.

Example: branch `"feat/story-1-2-add-auth"` with story IDs `["story-1", "story-1-2"]` matches `"story-1-2"` (longer match wins).

---

## Sprint Notifications

**Source**: `packages/plugins/tracker-bmad/src/sprint-notifications.ts`

Evaluates sprint health and forecast data against configurable thresholds, producing notification objects suitable for dispatch via any Notifier plugin.

### NotificationThresholds

```typescript
interface NotificationThresholds {
  stuckHours: number;           // default: 48
  wipLimit: number;             // default: 3
  throughputDropPct: number;    // default: 30
  forecastBehind: boolean;      // default: true
}
```

### SprintNotification

```typescript
interface SprintNotification {
  type:
    | "sprint.health_warning"
    | "sprint.health_critical"
    | "sprint.forecast_behind"
    | "sprint.story_stuck"
    | "sprint.wip_exceeded";
  severity: "warning" | "critical" | "info";
  title: string;
  message: string;
  details: string[];
  timestamp: string;
}
```

### checkSprintNotifications

```typescript
function checkSprintNotifications(
  project: ProjectConfig,
  thresholds?: Partial<NotificationThresholds>,
): SprintNotification[]
```

Runs `computeSprintHealth` and `computeForecast`, then produces notifications for:

1. **Health indicators** -- each warning or critical indicator from sprint health becomes a `sprint.health_warning` or `sprint.health_critical` notification.
2. **Stuck stories** -- if any stories are stuck, emits a `sprint.story_stuck` notification listing all stuck story IDs.
3. **WIP exceeded** -- if any columns exceed WIP limits, emits a `sprint.wip_exceeded` notification listing the affected columns.
4. **Forecast behind** -- if `pace === "behind"` and `forecastBehind` threshold is enabled, emits a `sprint.forecast_behind` notification with current vs. required velocity.

### formatNotificationEvent

```typescript
function formatNotificationEvent(notification: SprintNotification): OrchestratorEvent
```

Converts a `SprintNotification` into an `OrchestratorEvent` for dispatch through the orchestrator's event system. Severity is mapped: `critical` -> `"urgent"`, `warning` -> `"warning"`, `info` -> `"info"`. The event ID is generated with a timestamp and random suffix.

### getDefaultThresholds

```typescript
function getDefaultThresholds(): NotificationThresholds
```

Returns a copy of the default thresholds object.

---

## Data Flow

```
                          sprint-status.yaml
                                 |
                                 v
                        readSprintStatus()
                        (sprint-status-reader.ts)
                                 |
                +----------------+----------------+
                |                |                |
                v                v                v
         Core Tracker     Analytics Layer    Auto-Transition
         (index.ts)                          (auto-transition.ts)
                |                |                |
                |                v                |
                |    sprint-history.jsonl         |
                |         |                      |
                |    readHistory()               |
                |    appendHistory()  <----------+
                |         |
                |    +----+------+------+-------+--------+
                |    |           |      |       |        |
                |    v           v      v       v        v
                | Cycle Time  Health  Forecast  Retro  Story
                | (cycle-     (sprint- (fore-  (retro- Detail
                |  time.ts)   health.  cast.   spec-  (story-
                |              ts)     ts)     tive.   detail.
                |                              ts)     ts)
                |    |           |      |       |        |
                |    +-----------+------+-------+--------+
                |                |
                v                v
            CLI/Web        Sprint Notifications
           consumers       (sprint-notifications.ts)
                                 |
                                 v
                         formatNotificationEvent()
                                 |
                                 v
                         OrchestratorEvent --> Notifier plugins
```

**Data sources** (read):
- `sprint-status.yaml` -- current board state (statuses, epics)
- `story-{id}.md` -- story content (title, description, acceptance criteria)
- `epic-{slug}.md` -- epic content (title, overview)
- `tech-spec-{id}.md` -- technical specification
- `architecture.md` -- architecture document
- `prd.md` -- product requirements
- `sprint-history.jsonl` -- transition event log

**Data sinks** (write):
- `sprint-status.yaml` -- status updates via `updateIssue` and `writeStoryStatus`
- `sprint-history.jsonl` -- new entries via `appendHistory`

**Consumers**:
- `packages/cli/` -- `ao sprint`, `ao metrics`, `ao create`, and other CLI commands
- `packages/web/` -- Next.js API routes and dashboard components
- Notifier plugins -- via `formatNotificationEvent` producing `OrchestratorEvent`
- Lifecycle-manager -- via optional Tracker interface methods (`findIssueByBranch`, `onPRMerge`, `onSessionDeath`, `getNotifications`)

---

## Lifecycle-Manager Integration

The lifecycle-manager (`packages/core/src/lifecycle-manager.ts`) calls optional Tracker interface methods to handle story transitions and notifications without hardcoding plugin-specific logic.

### Merge Handling

When a session transitions to `"merged"`:

1. Lifecycle-manager checks if the session has an `issueId`. If not, it calls `tracker.findIssueByBranch(branch, project)` to discover the story from the PR branch name.
2. If `tracker.onPRMerge` exists, it calls it with the story ID and PR URL.
3. Falls back to `tracker.updateIssue` with `state: "closed"` if `onPRMerge` is not implemented.

### Session Death Handling

When a session transitions to `killed`, `errored`, or `stuck`:

1. Lifecycle-manager calls `tracker.onSessionDeath(issueId, project)` if the method exists.
2. The BMad implementation resets `in-progress` stories back to `ready-for-dev`, making them available for re-assignment.

### Notification Polling

During each `pollAll()` cycle (every 30 seconds):

1. For each project with an active session and a `getNotifications` method on its tracker, the lifecycle-manager calls `tracker.getNotifications(project)`.
2. A `Map<string, Set<string>>` (`activeNotifications`) debounces notifications — only newly-appeared notification types are dispatched as `OrchestratorEvent`.
3. Notifications that were already active on the previous poll cycle are suppressed.

---

## Public Exports Summary

All analytics types and functions are re-exported from `packages/plugins/tracker-bmad/src/index.ts`:

```typescript
// Shared helpers
export { BMAD_COLUMNS, getBmadStatus, categorizeStatus, readEpicTitle };
export type { BmadColumn };

// History
export { readHistory, appendHistory };
export type { HistoryEntry };

// Cycle Time
export { computeCycleTime };
export type { CycleTimeStats, StoryCycleTime, ColumnDwell };

// Sprint Health
export { computeSprintHealth };
export type { SprintHealthResult, HealthIndicator, HealthSeverity };

// Forecast
export { computeForecast };
export type { SprintForecast };

// Retrospective
export { computeRetrospective };
export type { RetrospectiveResult, SprintPeriod };

// Story Detail
export { getStoryDetail };
export type { StoryDetail, StoryTransition };

// Auto-Transition
export { transitionOnMerge, writeStoryStatus, findStoryForPR };
export type { AutoTransitionEvent, AutoTransitionResult };

// Sprint Notifications
export { checkSprintNotifications, getDefaultThresholds, formatNotificationEvent };
export type { SprintNotification, NotificationThresholds };

// Plugin module
export { manifest, create };
export default { manifest, create } satisfies PluginModule<Tracker>;
```

Note: The tracker object returned by `create()` also implements 5 optional Tracker interface methods (`createIssue`, `findIssueByBranch`, `onPRMerge`, `onSessionDeath`, `getNotifications`) that are called by the lifecycle-manager and CLI commands at runtime.
