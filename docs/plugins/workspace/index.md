---
title: Workspace Plugins
nav_order: 3
parent: Plugins
has_children: true
description: Workspace plugin slot with 2 built-in plugins — worktree (default) and clone. Comparison table, configuration, and selection guide for workspace isolation strategies.
---

# Workspace Plugins

The workspace plugin manages how Agent Orchestrator creates isolated working directories for each agent session. It creates the workspace, cleans up when done, lists active workspaces, and optionally sets up symlinks or runs post-creation hooks. Agent Orchestrator ships with **2 workspace plugins**: **worktree** (default) for git worktree isolation, and **clone** for full repository cloning.

{: .highlight }
> **TL;DR:** 2 plugins — worktree (default, space-efficient with shared `.git`) and clone (full independence with `git clone --reference`). Choose worktree for most cases, clone when you need complete isolation.

---

## Workspace Interface

All workspace plugins implement the `Workspace` interface from `@composio/ao-core`. The interface defines **1 required property**, **3 required methods**, and **3 optional methods**:

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Plugin display name (e.g., `"worktree"`, `"clone"`) |

### Methods

| Method | Required | Description |
|--------|----------|-------------|
| `create(config)` | Yes | Create a new isolated workspace for a session |
| `destroy(workspacePath)` | Yes | Clean up and remove a workspace |
| `list(projectId)` | Yes | List all workspaces for a project |
| `postCreate?(info, project)` | No | Run setup after workspace creation |
| `exists?(workspacePath)` | No | Check if a workspace exists and is a valid git repo |
| `restore?(config, workspacePath)` | No | Restore a previously created workspace |

### WorkspaceCreateConfig

The `create()` method receives a config with **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Project identifier (used as directory name) |
| `project` | ProjectConfig | Full project configuration from YAML |
| `sessionId` | SessionId | Unique session identifier (used as directory name) |
| `branch` | string | Git branch name for the workspace |

### WorkspaceInfo

The `create()` and `list()` methods return `WorkspaceInfo` with **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Absolute path to the workspace directory |
| `branch` | string | Git branch checked out in the workspace |
| `sessionId` | SessionId | Session identifier |
| `projectId` | string | Project identifier |

---

## Plugin Comparison

| Feature | worktree | clone |
|---------|----------|-------|
| **Isolation strategy** | git worktree (shared `.git`) | git clone (`--reference`) |
| **Disk usage** | Lower (shared git objects) | Higher (independent copy) |
| **Symlink support** | Yes (`postCreate`) | No |
| **Branch handling** | Preserved on destroy | Deleted with directory |
| **List method** | `git worktree list --porcelain` | Filesystem scan + `git branch` |
| **Restore strategy** | 3-tier retry | 2-tier retry |
| **Default base dir** | `~/.worktrees` | `~/.ao-clones` |
| **Config key** | `worktreeDir` | `cloneDir` |
| **Default** | Yes | No |
| **Complexity** | 301 lines | 245 lines |
| **Package** | `@composio/ao-plugin-workspace-worktree` | `@composio/ao-plugin-workspace-clone` |

---

## Path Safety

Both plugins share identical path safety logic to prevent directory traversal attacks:

- **`SAFE_PATH_SEGMENT`** regex: `/^[a-zA-Z0-9_-]+$/` — validates `projectId` and `sessionId`
- **`assertSafePathSegment()`** — throws on invalid characters
- **`expandPath()`** — expands `~/` to home directory for config paths

---

## Child Pages

- [Worktree](worktree/) — Git worktree isolation with symlink support (default)
- [Clone](clone/) — Full repository clone with `--reference` for object sharing

---

## Configuration

```yaml
# Global default
defaults:
  workspace: worktree

# Per-project override
projects:
  my-isolated-app:
    repo: org/my-isolated-app
    path: ~/projects/my-isolated-app
    workspace: clone
```

See [Plugins](../) for the full plugin configuration reference.
