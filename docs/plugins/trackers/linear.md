---
title: Linear
nav_order: 2
parent: Tracker Plugins
grand_parent: Plugins
description: linear tracker plugin — Linear issue tracker via GraphQL with dual transport (direct API or Composio SDK), 6-state mapping, and additive label handling.
---

# Linear Tracker

The **linear** plugin integrates with Linear using their GraphQL API. It supports **dual transport** — direct Linear API access via `LINEAR_API_KEY` or Composio SDK access via `COMPOSIO_API_KEY`. The plugin auto-detects which key is available and routes requests accordingly.

{: .highlight }
> **Dual transport:** The linear plugin supports two ways to connect. If `COMPOSIO_API_KEY` is set, it uses the Composio SDK's `LINEAR_RUN_QUERY_OR_MUTATION` tool. Otherwise, it falls back to direct GraphQL via `https://api.linear.app/graphql` with your `LINEAR_API_KEY`.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `linear` |
| **Slot** | `tracker` |
| **Package** | `@composio/ao-plugin-tracker-linear` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The linear plugin sends GraphQL queries and mutations to Linear's API. Transport auto-detection happens at plugin creation time.

```text
create()
  |
  +-- Check COMPOSIO_API_KEY?
  |     +-- Yes: createComposioTransport()
  |     |     +-- Lazy-load @composio/core
  |     |     +-- Route via LINEAR_RUN_QUERY_OR_MUTATION
  |     |
  |     +-- No: createDirectTransport()
  |           +-- Use node:https to api.linear.app
  |           +-- LINEAR_API_KEY in Authorization header
  |
  +-- Return Tracker with GraphQL transport

getIssue(identifier, project)
  |
  +-- GraphQL query: issue(id: $id)
  |     +-- ISSUE_FIELDS fragment
  |     +-- Map state via mapLinearState()
  |
  +-- Return Issue
```

---

## Dual Transport

### Direct API Transport

- Uses Node.js `node:https` module (no external HTTP library)
- Sends GraphQL queries to `https://api.linear.app/graphql`
- Authorization via `LINEAR_API_KEY` environment variable
- 30-second timeout on all requests
- Response validation: checks HTTP status, GraphQL errors, and data presence

### Composio SDK Transport

- Lazy-loads `@composio/core` on first request
- Routes through Composio's `LINEAR_RUN_QUERY_OR_MUTATION` tool
- Uses `COMPOSIO_API_KEY` and optional `COMPOSIO_ENTITY_ID` (default: `"default"`)
- Same 30-second timeout as direct transport
- Provides helpful error if `@composio/core` is not installed

{: .highlight }
> **Auto-detection:** `COMPOSIO_API_KEY` takes priority. If both keys are set, the Composio SDK transport is used. This lets you switch transports by setting/unsetting environment variables with no config changes.

---

## State Mapping

Linear uses workflow state types. The plugin maps these to 4 Agent Orchestrator states:

| Linear State Type | Agent Orchestrator State |
|-------------------|--------------------------|
| `completed` | `closed` |
| `canceled` | `cancelled` |
| `started` | `in_progress` |
| `triage` | `open` |
| `backlog` | `open` |
| `unstarted` | `open` |

For state transitions (in `updateIssue`), the reverse mapping is:

| Agent Orchestrator State | Linear Target Type |
|--------------------------|-------------------|
| `closed` | `completed` |
| `open` | `unstarted` |
| `in_progress` | `started` |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"linear"` |

### Required Methods (5)

#### getIssue(identifier, project)

Fetches issue details via GraphQL query:

- Uses `ISSUE_FIELDS` fragment for consistent field selection
- Accepts both UUID and short identifier (e.g., `"INT-1327"`)
- Returns priority as numeric value
- Returns assignee's `displayName` or `name`

#### isCompleted(identifier, project)

Checks if issue is in a terminal state:

- Fetches only `state { type }`
- Returns `true` for `completed` or `canceled` states

#### issueUrl(identifier, project)

Builds Linear issue URL:

- Uses `workspaceSlug` from project config if available: `https://linear.app/{slug}/issue/{identifier}`
- Falls back to `https://linear.app/issue/{identifier}` (requires auth to redirect)

#### branchName(identifier, project)

Generates branch name:

- Returns `feat/{identifier}` (e.g., `feat/INT-1327`)

#### generatePrompt(identifier, project)

Builds AI prompt from issue content:

1. Fetches full issue via `getIssue`
2. Includes issue identifier, title, URL
3. Adds labels (if any)
4. **Includes priority with human-readable name:**

| Priority Value | Name |
|---------------|------|
| 0 | No priority |
| 1 | Urgent |
| 2 | High |
| 3 | Normal |
| 4 | Low |

5. Includes description body
6. Appends implementation instructions

### Optional Methods (4)

#### issueLabel(url, project)

Extracts short label from Linear URL:

- Parses `/issue/{IDENTIFIER}` pattern (e.g., `INT-1327`)
- Falls back to last URL segment

#### listIssues(filters, project)

Lists issues with GraphQL filters:

- State filtering: maps `closed` to `{ type: { in: ["completed", "canceled"] } }`, default open filters completed/canceled
- Label filtering: `{ name: { in: [...] } }`
- Assignee filtering: `{ displayName: { eq: ... } }`
- Team filtering: uses `teamId` from project config if available
- Default limit: 30 (configurable via `filters.limit`)

#### updateIssue(identifier, update, project)

Updates issue with multiple operations:

1. **Resolves short ID to UUID** for mutations (e.g., `"INT-1327"` → UUID)
2. **State transitions**: finds the correct workflow state ID for the team by matching state type
3. **Assignee**: looks up user by `displayName`, applies via `issueUpdate` mutation
4. **Labels (additive)**: fetches existing label IDs, resolves new label names to IDs, merges both sets — **does not remove existing labels**
5. **Comments**: creates via `commentCreate` mutation

{: .highlight }
> **Additive labels:** Unlike a replace strategy, the linear plugin merges new labels with existing ones. If an issue has labels `[bug, frontend]` and you add `[urgent]`, it becomes `[bug, frontend, urgent]`. Existing labels are never removed.

#### createIssue(input, project)

Creates a new issue via GraphQL mutation:

- Requires `teamId` in project tracker config (throws if missing)
- Creates issue with title, description, teamId, and optional priority
- **Assignee applied after creation** — looks up user by name, wraps in try/catch (best-effort)
- **Labels applied after creation** — resolves label names to IDs, wraps in try/catch (best-effort)
- Only reflects successfully applied labels/assignees in the returned Issue

---

## Configuration

### Basic Setup

```yaml
projects:
  my-product:
    repo: org/my-product
    path: ~/projects/my-product
    tracker:
      plugin: linear
```

### With Workspace Slug and Team ID

```yaml
projects:
  my-product:
    repo: org/my-product
    path: ~/projects/my-product
    tracker:
      plugin: linear
      workspaceSlug: my-team        # for issue URLs
      teamId: "team-uuid-here"      # required for createIssue
```

### Environment Variables

```bash
# Option 1: Direct Linear API
export LINEAR_API_KEY="lin_api_xxx..."

# Option 2: Via Composio SDK
export COMPOSIO_API_KEY="cmp_xxx..."
export COMPOSIO_ENTITY_ID="default"  # optional, defaults to "default"
```

---

## When to Use Linear

| Scenario | Recommendation |
|----------|---------------|
| Product teams using Linear | Use linear — native integration |
| Need `in_progress` state | Use linear — supports started/in-progress |
| Need priority tracking | Use linear — includes priority in prompts |
| No network access | Use bmad — linear requires API access |
| Open-source projects | Use github — public issues |
| Need sprint analytics | Use bmad — linear has no extra modules |

---

## Next Steps

- [GitHub](../github/) — Default tracker via `gh` CLI
- [BMAD](../bmad/) — Local filesystem tracker with sprint analytics
- [Tracker Plugins](./) — Tracker plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
