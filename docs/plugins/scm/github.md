---
title: SCM (GitHub)
nav_order: 5
parent: Plugins
description: github SCM plugin — GitHub PR/CI/review management via gh CLI with 11 required methods, fail-closed CI checking, bot detection with 10 known authors, and auto-inference from repo field.
---

# SCM — GitHub

The **github** SCM plugin manages GitHub pull requests using the `gh` CLI. It detects PRs from agent sessions, checks CI status, collects reviews, and determines merge readiness. It requires zero npm dependencies beyond `@composio/ao-core` and is automatically selected when a project has a `repo` field with `owner/repo` format.

{: .highlight }
> **Zero config:** The github SCM plugin is auto-inferred from the `repo` field. When `repo` contains a `/` (e.g., `org/repo`), Agent Orchestrator automatically sets the SCM to `"github"`. No additional environment variables or API keys are needed — it uses your existing `gh auth login` credentials.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `github` |
| **Slot** | `scm` |
| **Package** | `@composio/ao-plugin-scm-github` |
| **Version** | `0.1.0` |
| **Default** | Yes (auto-inferred from `repo` field) |

---

## How It Works

The github SCM plugin uses `execFile("gh", [...args])` for all GitHub API interactions. Every call has a 30-second timeout and 10MB max buffer. No direct HTTP requests are made.

```text
detectPR(session, project)
  |
  +-- Validate repo format (owner/repo)
  +-- gh pr list --head <branch> --json ...
  |     +-- Parse PR number, URL, title, branches
  |
  +-- Return PRInfo or null

getMergeability(pr)
  |
  +-- getPRState(pr)
  |     +-- gh pr view --json state
  +-- getCISummary(pr)
  |     +-- getCIChecks(pr)
  |           +-- gh pr checks --json name,state,...
  +-- gh pr view --json mergeable,reviewDecision,...
  |
  +-- Build blockers[] from:
  |     +-- CI status (passing/failing/pending)
  |     +-- Review decision (approved/pending)
  |     +-- Merge conflicts (mergeable status)
  |     +-- Branch protection (mergeStateStatus)
  |     +-- Draft status
  |
  +-- Return MergeReadiness
```

---

## Transport

All GitHub API interactions use the `gh` CLI:

```bash
# Example: detect PR for branch
gh pr list --repo org/repo --head feat/issue-42 --json number,url,title,headRefName,baseRefName,isDraft --limit 1

# Example: check CI status
gh pr checks 42 --repo org/repo --json name,state,link,startedAt,completedAt

# Example: merge PR
gh pr merge 42 --repo org/repo --squash --delete-branch
```

- **No direct HTTP** — all calls go through `execFile("gh", [...args])`
- **30s timeout** — every `gh` call has `{ timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }`
- **Error wrapping** — failed `gh` calls throw with `gh <first-3-args> failed: <message>` (e.g., `gh pr list failed: ...`)
- **Zero npm deps** — only depends on `@composio/ao-core`

{: .highlight }
> **Auth:** No configuration needed. The plugin relies on your existing `gh auth login` session. Run `gh auth status` to verify your session is active. Alternatively, set `GH_TOKEN` or `GITHUB_TOKEN` environment variables.

---

## PR State Mapping

GitHub PRs have 3 states mapped directly:

| GitHub PR State | Agent Orchestrator State |
|----------------|--------------------------|
| `MERGED` | `merged` |
| `CLOSED` | `closed` |
| `OPEN` (or any other) | `open` |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"github"` |

### Required Methods (11)

#### detectPR(session, project)

Detects the PR associated with an agent session:

- Validates `session.branch` exists (returns `null` if missing)
- Validates `project.repo` has `owner/repo` format (exactly 2 parts, both non-empty) — **throws** on invalid format
- Queries `gh pr list --head <branch>` to find matching PR
- Returns `PRInfo` object or `null` if no PR found
- **Silent on `gh` errors** — returns `null` if `gh pr list` fails (no PR is not fatal)

#### getPRState(pr)

Fetches PR open/merged/closed state:

- Queries `gh pr view --json state`
- Maps `MERGED` → `merged`, `CLOSED` → `closed`, else → `open`
- Comparison uses `.toUpperCase()`

#### mergePR(pr, method?)

Merges a pull request:

- **Merge method** maps to flags: `"rebase"` → `--rebase`, `"merge"` → `--merge`, else `--squash`
- Default method is `"squash"`
- **Always passes `--delete-branch`** — branch is deleted after merge
- Single `gh pr merge` command with appropriate flag

#### closePR(pr)

Closes a pull request without merging:

- Runs `gh pr close`

#### getCIChecks(pr)

Fetches individual CI check results:

- Queries `gh pr checks --json name,state,link,startedAt,completedAt`
- **CI state mapping** (fail-closed for unknowns):

| GitHub Check State | Agent Orchestrator Status |
|--------------------|---------------------------|
| `PENDING`, `QUEUED` | `pending` |
| `IN_PROGRESS` | `running` |
| `SUCCESS` | `passed` |
| `FAILURE`, `TIMED_OUT`, `CANCELLED`, `ACTION_REQUIRED` | `failed` |
| `SKIPPED`, `NEUTRAL` | `skipped` |
| Unknown values | `failed` |

- **Throws on error** — does not silently return empty array

#### getCISummary(pr)

Computes aggregate CI status from individual checks:

- Calls `getCIChecks()` internally
- **Fail-closed logic:**
  1. If `getCIChecks` throws → checks if PR is merged/closed (`getPRState`). If merged/closed, returns `"none"`. Otherwise returns `"failing"`
  2. Has any `failed` → `"failing"`
  3. Has any `pending`/`running` → `"pending"`
  4. Has at least one `passed` → `"passing"`
  5. Else → `"none"`

#### getReviews(pr)

Fetches PR reviews:

- Queries `gh pr view --json reviews`
- **Review state mapping:**

| GitHub Review State | Agent Orchestrator State |
|---------------------|--------------------------|
| `APPROVED` | `approved` |
| `CHANGES_REQUESTED` | `changes_requested` |
| `DISMISSED` | `dismissed` |
| `PENDING` | `pending` |
| Any other | `commented` |

- Null-safe: `author.login ?? "unknown"`, `body || undefined`

#### getReviewDecision(pr)

Fetches the overall review decision:

- Queries `gh pr view --json reviewDecision`
- **Decision mapping:** `APPROVED` → `approved`, `CHANGES_REQUESTED` → `changes_requested`, `REVIEW_REQUIRED` → `pending`, else → `none`

#### getPendingComments(pr)

Fetches unresolved review comments from human reviewers:

- Uses **GraphQL** via `gh api graphql` (REST API lacks `isResolved` field on review threads)
- Fetches up to 100 review threads, retrieving only the **first comment** per thread (`comments(first: 1)`)
- **Filters out:** resolved threads, bot-authored threads, threads with no comments
- **Bot detection:** 10 known bot authors (see Bot Detection section)
- **Silent on error** — returns `[]` rather than throwing (missing comments are not fatal)

#### getAutomatedComments(pr)

Fetches comments from bots and automated tools:

- Uses REST via `gh api` endpoint (`repos/{owner}/{repo}/pulls/{number}/comments`)
- Fetches up to 100 comments (`per_page=100`)
- **Filters to only bot-authored comments** using `BOT_AUTHORS` set
- **Line field resolution:** uses `line` with fallback to `original_line` when null
- **Severity classification** from comment body (lowercase keyword matching):

| Keywords | Severity |
|----------|----------|
| `error`, `bug`, `critical`, `potential issue` | `error` |
| `warning`, `suggest`, `consider` | `warning` |
| Any other | `info` |

- **Silent on error** — returns `[]`

#### getMergeability(pr)

Determines if a PR is ready to merge by checking multiple conditions:

- **Early exit for merged PRs** — returns all-true with empty blockers
- Queries `gh pr view --json mergeable,reviewDecision,mergeStateStatus,isDraft`
- Also calls `getPRState()` and `getCISummary()` internally
- **Blocker checks:**

| Condition | Blocker Message |
|-----------|----------------|
| CI not passing | `"CI is failing"` or `"CI is pending"` |
| Review not approved | `"Changes requested in review"` or `"Review required"` |
| Merge conflicts | `"Merge conflicts"` |
| Merge blocked | `"Merge is blocked by branch protection"` |
| Branch behind | `"Branch is behind base branch"` |
| Checks unstable | `"Required checks are failing"` |
| Draft PR | `"PR is still a draft"` |
| Merge status unknown | `"Merge status unknown (GitHub is computing)"` |

- Returns `{ mergeable: blockers.length === 0, ciPassing, approved, noConflicts, blockers }`

### Optional Methods (1)

#### getPRSummary(pr)

Returns PR summary with change statistics:

- Queries `gh pr view --json state,title,additions,deletions`
- Returns `{ state, title, additions, deletions }`
- Uses `?? 0` / `?? ""` defaults for null fields

---

## Bot Detection

The plugin maintains a set of 10 known bot authors used to filter automated comments from human review comments:

| Bot Name | Tool |
|----------|------|
| `cursor[bot]` | Cursor IDE |
| `github-actions[bot]` | GitHub Actions |
| `codecov[bot]` | Codecov |
| `sonarcloud[bot]` | SonarCloud |
| `dependabot[bot]` | Dependabot |
| `renovate[bot]` | Renovate |
| `codeclimate[bot]` | Code Climate |
| `deepsource-autofix[bot]` | DeepSource |
| `snyk-bot` | Snyk |
| `lgtm-com[bot]` | LGTM |

Used by `getPendingComments` (filters out) and `getAutomatedComments` (filters in).

---

## Error Handling

The plugin uses two distinct error handling strategies:

### Fail-Closed (CI and Merge)

- `getCIChecks` — **throws** on error. CI status affects merge decisions, so errors must surface
- `getCISummary` — returns `"failing"` for open PRs when checks can't be fetched (safe default), `"none"` for already-merged/closed PRs
- `getMergeability` — surfaces CI and review errors as blockers

### Fail-Open (Comments)

- `getPendingComments` — returns `[]` on error. Missing comments don't block merges
- `getAutomatedComments` — returns `[]` on error. Bot comments are informational only

{: .highlight }
> **Design rationale:** CI failures can block merges, so errors must be visible. Comments are advisory — a failed comment fetch shouldn't prevent a merge decision.

---

## Supporting Types

### PRInfo (8 fields)

| Field | Type | Description |
|-------|------|-------------|
| `number` | number | PR number |
| `url` | string | PR URL |
| `title` | string | PR title |
| `owner` | string | Repository owner |
| `repo` | string | Repository name |
| `branch` | string | Head branch name |
| `baseBranch` | string | Base branch name |
| `isDraft` | boolean | Whether PR is a draft |

### PRState (3 values)

`"open"` | `"merged"` | `"closed"`

### MergeMethod (3 values)

`"merge"` | `"squash"` | `"rebase"`

### CICheck (6 fields)

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `status` | `"pending"` \| `"running"` \| `"passed"` \| `"failed"` \| `"skipped"` | Yes |
| `url` | string | No |
| `conclusion` | string | No |
| `startedAt` | Date | No |
| `completedAt` | Date | No |

### CIStatus (4 values)

`"pending"` | `"passing"` | `"failing"` | `"none"`

### Review (4 fields)

| Field | Type | Required |
|-------|------|----------|
| `author` | string | Yes |
| `state` | `"approved"` \| `"changes_requested"` \| `"commented"` \| `"dismissed"` \| `"pending"` | Yes |
| `body` | string | No |
| `submittedAt` | Date | Yes |

### ReviewDecision (4 values)

`"approved"` | `"changes_requested"` | `"pending"` | `"none"`

### ReviewComment (8 fields)

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `author` | string | Yes |
| `body` | string | Yes |
| `path` | string | No |
| `line` | number | No |
| `isResolved` | boolean | Yes |
| `createdAt` | Date | Yes |
| `url` | string | Yes |

### AutomatedComment (8 fields)

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `botName` | string | Yes |
| `body` | string | Yes |
| `path` | string | No |
| `line` | number | No |
| `severity` | `"error"` \| `"warning"` \| `"info"` | Yes |
| `createdAt` | Date | Yes |
| `url` | string | Yes |

### MergeReadiness (5 fields)

| Field | Type | Description |
|-------|------|-------------|
| `mergeable` | boolean | No blockers detected |
| `ciPassing` | boolean | All CI checks passing |
| `approved` | boolean | Review approved |
| `noConflicts` | boolean | No merge conflicts |
| `blockers` | string[] | List of blocking issues |

---

## Configuration

### Default (Auto-Inferred)

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    # scm: github  # auto-inferred from repo field
```

### Explicit Override

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    scm:
      plugin: github
```

{: .highlight }
> **Auto-inference:** SCM defaults to `"github"` when the `repo` field contains a `/` (i.e., `owner/repo` format). The config loader sets `scm: { plugin: "github" }` via `applyProjectDefaults()`. Unlike other plugin slots, SCM is not set in `DefaultPluginsSchema`.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| GitHub-hosted projects | Use github — native PR/CI/review integration |
| Need CI status checks | Use github — fail-closed CI checking |
| Need merge readiness | Use github — comprehensive blocker detection |
| Need bot comment parsing | Use github — 10 known bot authors with severity |
| No network access | Not applicable — SCM requires network for PR data |

---

## Next Steps

- [Tracker Plugins](../trackers/) — Issue tracking with github, linear, bmad
- [Notifier Plugins](../notifiers/) — Notification routing to desktop, Slack, Telegram
- [Plugins](../) — Plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
