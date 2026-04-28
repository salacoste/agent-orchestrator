---
title: GitHub
nav_order: 1
parent: Tracker Plugins
grand_parent: Plugins
description: github tracker plugin — GitHub Issues via gh CLI with 3-state mapping, zero configuration, and automatic inference as default tracker.
---

# GitHub Tracker

The **github** plugin integrates with GitHub Issues using the `gh` CLI for all API interactions. It requires zero npm dependencies beyond `@composio/ao-core` and is automatically selected when a project has a `repo` field configured.

{: .highlight }
> **Zero config:** The github tracker is auto-inferred from the `repo` field. No additional environment variables or API keys are needed — it uses your existing `gh auth login` credentials.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `github` |
| **Slot** | `tracker` |
| **Package** | `@composio/ao-plugin-tracker-github` |
| **Version** | `0.1.0` |
| **Default** | Yes (auto-inferred from `repo` field) |

---

## How It Works

The github plugin uses `execFile("gh", [...args])` for all GitHub API calls. Every call has a 30-second timeout and 10MB max buffer. No direct HTTP requests are made.

```text
getIssue(identifier, project)
  |
  +-- gh issue view <id> --repo <repo> --json ...
  |     +-- Parse JSON response
  |     +-- Map state via mapState()
  |
  +-- Return Issue

generatePrompt(identifier, project)
  |
  +-- getIssue(identifier, project)
  |     +-- Reuse getIssue logic
  |
  +-- Build prompt with:
        +-- Issue title + URL
        +-- Labels (if any)
        +-- Description body
        +-- Implementation instructions
```

---

## Transport

All GitHub API interactions use the `gh` CLI:

```bash
# Example: fetch issue details
gh issue view 42 --repo org/repo --json number,title,body,url,state,stateReason,labels,assignees
```

- **No direct HTTP** — all calls go through `execFile("gh", [...args])`
- **30s timeout** — every `gh` call has `{ timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }`
- **Error wrapping** — failed `gh` calls throw with `gh <command> failed: <message>`
- **Zero npm deps** — only depends on `@composio/ao-core`

{: .highlight }
> **Auth:** No configuration needed. The plugin relies on your existing `gh auth login` session. Run `gh auth status` to verify your session is active.

---

## State Mapping

GitHub Issues has 2 states (`OPEN`, `CLOSED`) plus a `stateReason`. The plugin maps these to 3 Agent Orchestrator states:

| GitHub State | State Reason | Agent Orchestrator State |
|-------------|-------------|--------------------------|
| `CLOSED` | `NOT_PLANNED` | `cancelled` |
| `CLOSED` | (any other) | `closed` |
| `OPEN` | — | `open` |

{: .highlight }
> **Limitation:** GitHub Issues has no `in_progress` state. Setting `state: "in_progress"` in `updateIssue` is intentionally a no-op.

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"github"` |

### Required Methods (5)

#### getIssue(identifier, project)

Fetches issue details via `gh issue view`:

- Requests JSON fields: `number`, `title`, `body`, `url`, `state`, `stateReason`, `labels`, `assignees`
- Maps state via `mapState()`
- Returns first assignee's login

#### isCompleted(identifier, project)

Checks if issue is closed:

- Fetches only `state` field
- Returns `true` when `state.toUpperCase() === "CLOSED"`

#### issueUrl(identifier, project)

Builds GitHub issue URL:

- Strips leading `#` from identifier
- Returns `https://github.com/{repo}/issues/{number}`

#### branchName(identifier, project)

Generates branch name:

- Strips leading `#` from identifier
- Returns `feat/issue-{number}` (e.g., `feat/issue-42`)

#### generatePrompt(identifier, project)

Builds AI prompt from issue content:

1. Fetches full issue via `getIssue`
2. Includes issue number, title, URL
3. Adds labels (if any)
4. Includes description body
5. Appends implementation instructions

### Optional Methods (4)

#### issueLabel(url, project)

Extracts short label from GitHub URL:

- Parses `/issues/{number}` from URL
- Returns `#{number}` (e.g., `#42`)
- Falls back to last URL segment

#### listIssues(filters, project)

Lists issues with filters via `gh issue list`:

- Supports state filtering: `open` (default), `closed`, `all`
- Supports label filtering with `--label`
- Supports assignee filtering with `--assignee`
- Default limit: 30 (configurable via `filters.limit`)
- **Gracefully handles repos with issues disabled** — returns empty array instead of throwing

#### updateIssue(identifier, update, project)

Updates issue state, labels, assignee, or adds a comment:

- **State changes**: `closed` → `gh issue close`, `open` → `gh issue reopen`
- **`in_progress` is a no-op** — GitHub Issues lacks this state
- **Labels**: added via `gh issue edit --add-label` (additive)
- **Assignee**: set via `gh issue edit --add-assignee`
- **Comments**: added via `gh issue comment --body`

#### createIssue(input, project)

Creates a new issue via `gh issue create`:

- Sets title and body from input
- Adds labels via `--label` (if provided)
- Adds assignee via `--assignee` (if provided)
- Parses issue number from output URL
- Fetches full issue details via `getIssue` for return value

---

## Configuration

### Default (Auto-Inferred)

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    # tracker: github  # auto-inferred, no need to set
```

### Explicit Override

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    tracker:
      plugin: github
```

---

## When to Use GitHub

| Scenario | Recommendation |
|----------|---------------|
| Open-source projects | Use github — native GitHub integration |
| Public repos | Use github — issues visible to contributors |
| Need `in_progress` state | Use linear or bmad — GitHub lacks this state |
| No network access | Use bmad — github requires `gh` CLI |
| Private repos | Use github — works with `gh auth login` |

---

## Next Steps

- [Linear](../linear/) — Linear tracker with dual transport
- [BMAD](../bmad/) — Local filesystem tracker with sprint analytics
- [Tracker Plugins](./) — Tracker plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
