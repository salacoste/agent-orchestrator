---
title: Worktree
nav_order: 1
parent: Workspace Plugins
grand_parent: Plugins
description: worktree workspace plugin — git worktree isolation with symlink support, porcelain-based listing, branch preservation on destroy, and 3-tier restore strategy. Default workspace plugin.
---

# Worktree Workspace

The **worktree** plugin uses git worktrees to create isolated working directories for each agent session. Worktrees share the `.git` directory with the main repository, making them space-efficient and fast to create. It is the default workspace plugin.

{: .highlight }
> **Shared `.git`:** Worktrees share git objects with the main repository. This means lower disk usage and faster creation compared to full clones. Each worktree gets its own working tree and branch.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `worktree` |
| **Slot** | `workspace` |
| **Package** | `@composio/ao-plugin-workspace-worktree` |
| **Version** | `0.1.0` |
| **Default** | Yes |

---

## How It Works

The worktree plugin creates isolated working directories under `~/.worktrees/{projectId}/{sessionId}` using `git worktree add`. It supports symlink sharing for resources between the main repo and worktrees, preserves branches on destroy, and provides a 3-tier restore strategy.

```text
create(config)
  |
  +-- Validate projectId + sessionId
  |     +-- SAFE_PATH_SEGMENT regex
  |
  +-- git fetch origin (tolerates offline)
  |
  +-- git worktree add -b <branch> <path>
  |     +-- Retry if branch exists
  |     +-- Cleanup on checkout failure
  |
  +-- Return WorkspaceInfo

postCreate(info, project)
  |
  +-- Symlink shared resources
  |     +-- Validate: relative, no ".."
  |     +-- Resolve within workspace
  |     +-- Create parent dirs
  |
  +-- Run postCreate hooks
        +-- sh -c <command>
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"worktree"` |

### create(config)

Creates a git worktree at `{worktreeBaseDir}/{projectId}/{sessionId}`:

```bash
git worktree add -b feature-branch ~/.worktrees/my-app/session-123 origin/main
```

- Validates `projectId` and `sessionId` against `SAFE_PATH_SEGMENT` regex
- Fetches latest from origin (tolerates offline failures)
- Creates worktree with a new branch from the default branch
- **Retry logic**: If the branch already exists, creates the worktree first then checks out the branch
- **Cleanup**: Removes orphaned worktree on checkout failure before rethrowing

### destroy(workspacePath)

Removes a worktree without deleting the branch:

```bash
git worktree remove --force ~/.worktrees/my-app/session-123
```

{: .highlight }
> **Branch preservation:** The worktree plugin intentionally does NOT delete the git branch on destroy. This is a deliberate design choice to avoid accidentally removing pre-existing local branches that may be useful for later review or restore.

- Resolves the main repo path via `git rev-parse --git-common-dir`
- Runs `git worktree remove --force` from the main repo
- Falls back to `rmSync(..., { recursive: true, force: true })` if git commands fail

### list(projectId)

Lists all worktrees for a project using git's porcelain output:

```bash
git worktree list --porcelain
```

- Reads `{worktreeBaseDir}/{projectId}` for subdirectories
- Parses porcelain output blocks (worktree path + branch from `refs/heads/` prefix)
- Filters to only include worktrees under the project directory
- Sets branch to `"detached"` if no branch is found

### exists(workspacePath)

Checks if the workspace directory exists and is a valid git repo via `git rev-parse --is-inside-work-tree`.

### restore(config, workspacePath)

Restores a worktree with a 3-tier retry strategy:

1. **Prune** stale worktree entries via `git worktree prune`
2. **Fetch** latest from origin
3. **Add existing branch** — `git worktree add <path> <branch>`
4. **Create from remote** — `git worktree add -b <branch> <path> origin/<branch>`
5. **Create from default** — `git worktree add -b <branch> <path> origin/<defaultBranch>`

### postCreate(info, project)

Runs setup after workspace creation in two phases:

**1. Symlink support** — Iterates over `project.symlinks` and creates symlinks:
- Validates each path is relative and does not contain `..`
- Resolves target within the workspace directory
- Guards that resolved target is still within the workspace
- Creates parent directories for nested targets

**2. Post-create hooks** — Runs shell commands from `project.postCreate` array via `sh -c` in the workspace directory.

---

## Configuration

### Per-Project

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    workspace: worktree
```

### Custom Base Directory

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    workspace: worktree
    workspaceConfig:
      worktreeDir: /custom/path/worktrees
```

### Symlink Sharing

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    symlinks:
      - node_modules        # Share node_modules with worktree
      - .env                # Share environment config
    postCreate:
      - "npm install"       # Run after workspace creation
```

---

## When to Use Worktree

| Scenario | Recommendation |
|----------|---------------|
| Default workspace isolation | Use worktree — space-efficient and fast |
| Need symlink sharing | Use worktree — only plugin with symlink support |
| Shared `.git` is acceptable | Use worktree — lower disk usage |
| Need branch preservation | Use worktree — branches survive destroy |
| Need complete independence | Use clone instead |

---

## Next Steps

- [Clone](../clone/) — Full clone isolation alternative
- [Workspace Plugins](./) — Workspace plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
