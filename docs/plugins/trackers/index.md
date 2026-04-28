---
title: Tracker Plugins
nav_order: 4
parent: Plugins
has_children: true
description: Tracker plugin slot with 3 built-in plugins — github (default), linear, bmad. Comparison table, interface reference, and configuration guide for issue tracking integrations.
---

# Tracker Plugins

The tracker plugin manages how Agent Orchestrator interacts with issue tracking systems. It fetches issue details, generates AI prompts from issue content, creates branches, and optionally handles issue lifecycle (create, update, list, validate). Agent Orchestrator ships with **3 tracker plugins**: **github** (default) for GitHub Issues via the `gh` CLI, **linear** for Linear via GraphQL, and **bmad** for local filesystem-based tracking using YAML and markdown files.

{: .highlight }
> **TL;DR:** 3 plugins — github (default, `gh` CLI, zero config), linear (GraphQL API, dual transport), bmad (filesystem, no network, richest features). Choose github for open-source, linear for product teams, bmad for local-first workflows.

---

## Tracker Auto-Inference

The tracker plugin is **auto-inferred** for all projects. When a project config does not specify a `tracker` block, Agent Orchestrator automatically sets the tracker to `"github"`. Unlike other plugin slots, tracker is not set in the `DefaultPluginsSchema` — it's applied via `applyProjectDefaults()` at config load time.

---

## Tracker Interface

All tracker plugins implement the `Tracker` interface from `@composio/ao-core`. The interface defines **1 required property**, **5 required methods**, and **10 optional methods**:

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Plugin display name (e.g., `"github"`, `"linear"`, `"bmad"`) |

### Required Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getIssue(identifier, project)` | `Promise<Issue>` | Fetch issue details by identifier |
| `isCompleted(identifier, project)` | `Promise<boolean>` | Check if issue is completed/closed |
| `issueUrl(identifier, project)` | `string` | Generate a URL for the issue |
| `branchName(identifier, project)` | `string` | Generate a git branch name for the issue |
| `generatePrompt(identifier, project)` | `Promise<string>` | Build an AI prompt from issue content |

### Optional Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `issueLabel?(url, project)` | `string` | Extract human-readable label from URL |
| `listIssues?(filters, project)` | `Promise<Issue[]>` | List issues with filters |
| `updateIssue?(identifier, update, project)` | `Promise<void>` | Update issue state, labels, assignee |
| `createIssue?(input, project)` | `Promise<Issue>` | Create a new issue |
| `validateIssue?(identifier, project)` | `Promise<IssueValidationResult>` | Pre-flight validation before spawning |
| `findIssueByBranch?(branch, project)` | `Promise<string \| null>` | Reverse-lookup issue by branch name |
| `onPRMerge?(issueId, prUrl, project)` | `Promise<void>` | Handle PR merge event |
| `onSessionDeath?(issueId, project, sessionId?)` | `Promise<void>` | Handle session death event |
| `getNotifications?(project)` | `Promise<OrchestratorEvent[]>` | Sprint health notifications |
| `getEpicTitle?(epicId, project)` | `string` | Resolve epic identifier to title |

---

## Supporting Types

### Issue (8 fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Issue identifier |
| `title` | string | Issue title |
| `description` | string | Issue body/description |
| `url` | string | Issue URL |
| `state` | `"open" \| "in_progress" \| "closed" \| "cancelled"` | Current state |
| `labels` | string[] | Applied labels |
| `assignee?` | string | Assigned user |
| `priority?` | number | Priority value |

### IssueFilters (4 fields)

| Field | Type | Description |
|-------|------|-------------|
| `state?` | `"open" \| "closed" \| "all"` | Filter by state |
| `labels?` | string[] | Filter by labels |
| `assignee?` | string | Filter by assignee |
| `limit?` | number | Maximum results (default: 30) |

### IssueUpdate (4 fields)

| Field | Type | Description |
|-------|------|-------------|
| `state?` | `"open" \| "in_progress" \| "closed"` | New state |
| `labels?` | string[] | Labels to add |
| `assignee?` | string | New assignee |
| `comment?` | string | Comment to add |

### CreateIssueInput (5 fields)

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Issue title (required) |
| `description` | string | Issue body (required) |
| `labels?` | string[] | Initial labels |
| `assignee?` | string | Initial assignee |
| `priority?` | number | Priority value |

### IssueValidationResult (3 fields)

| Field | Type | Description |
|-------|------|-------------|
| `valid` | boolean | Whether the issue passed validation |
| `errors` | string[] | Blocking issues |
| `warnings` | string[] | Non-blocking warnings |

---

## Plugin Comparison

| Feature | github | linear | bmad |
|---------|--------|--------|------|
| **Backend transport** | `gh` CLI | GraphQL API (direct or Composio) | Local filesystem |
| **Network required** | Yes (via gh) | Yes | No |
| **Auth setup** | None (`gh auth login`) | `LINEAR_API_KEY` or `COMPOSIO_API_KEY` | None |
| **Optional methods** | 4 of 10 | 4 of 10 | 10 of 10 (all) |
| **Default** | Yes (auto-inferred) | No | No |
| **Config keys** | none | `workspaceSlug`, `teamId` | `storyDir`, `branchPrefix`, `includeArchContext`, `includePrdContext` |
| **branchName format** | `feat/issue-{num}` | `feat/{identifier}` | `{prefix}/{id}` (configurable) |
| **issueLabel format** | `#42` | `INT-1327` | Story identifier |
| **Prompt richness** | Basic | Medium (priority names) | Rich (deps, AC, arch, PRD, tech spec, epic, siblings) |
| **State mapping** | 3-state | 5-state | 7-state |
| **Source lines** | 314 | 722 | 863 + 26 modules |
| **Package** | `@composio/ao-plugin-tracker-github` | `@composio/ao-plugin-tracker-linear` | `@composio/ao-plugin-tracker-bmad` |

---

## Child Pages

- [GitHub](github/) — GitHub Issues via `gh` CLI (default)
- [Linear](linear/) — Linear via GraphQL with dual transport
- [BMAD](bmad/) — Local filesystem tracker with sprint analytics

---

## Configuration

```yaml
# Tracker is auto-inferred for all projects without explicit tracker
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    # tracker:                 # auto-inferred to github
    #   plugin: github

# Override for Linear
projects:
  my-product:
    repo: org/my-product
    path: ~/projects/my-product
    tracker:
      plugin: linear
      workspaceSlug: my-team
      teamId: "team-uuid-here"

# Override for BMad (local-only)
projects:
  my-local:
    repo: org/my-local
    path: ~/projects/my-local
    tracker:
      plugin: bmad
```

See [Plugins](../) for the full plugin configuration reference.
