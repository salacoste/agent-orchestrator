---
title: Clone
nav_order: 2
parent: Workspace Plugins
grand_parent: Plugins
description: clone workspace plugin — full git clone isolation with --reference for object sharing, simple rmSync destroy, filesystem-based listing, and 2-tier restore strategy.
---

# Clone Workspace

The **clone** plugin creates fully independent working directories by cloning the repository. It uses `git clone --reference` for space-efficient object sharing with the source repo, providing complete isolation without the disk overhead of a full copy.

{: .highlight }
> **Complete independence:** Unlike worktrees, clones are fully independent repositories. Each clone has its own `.git` directory (with object sharing via `--reference`), making them suitable for scenarios where worktree sharing is not desirable.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `clone` |
| **Slot** | `workspace` |
| **Package** | `@composio/ao-plugin-workspace-clone` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The clone plugin creates isolated working directories under `~/.ao-clones/{projectId}/{sessionId}` using `git clone --reference`. The `--reference` flag shares git objects with the source repository for space efficiency while maintaining full independence.

```text
create(config)
  |
  +-- Validate projectId + sessionId
  |     +-- SAFE_PATH_SEGMENT regex
  |
  +-- Get remote URL from source repo
  |     +-- git remote get-url origin
  |     +-- Fallback to local path
  |
  +-- git clone --reference <repoPath>
  |     +-- Fail early if directory exists
  |     +-- Cleanup on clone failure
  |
  +-- git checkout -b <branch>
  |     +-- Fallback to git checkout
  |     +-- Cleanup on checkout failure
  |
  +-- Return WorkspaceInfo

postCreate(info, project)
  |
  +-- Run postCreate hooks only
        +-- sh -c <command>
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"clone"` |

### create(config)

Creates a cloned workspace at `{cloneBaseDir}/{projectId}/{sessionId}`:

```bash
git clone --reference ~/projects/my-app https://github.com/org/repo.git ~/.ao-clones/my-app/session-123
```

- Validates `projectId` and `sessionId` against `SAFE_PATH_SEGMENT` regex
- Gets remote URL from source repo via `git remote get-url origin`; falls back to local path
- **Fails early** if destination directory already exists (prevents data loss)
- Uses `git clone --reference <repoPath> --branch <defaultBranch>` for object sharing and initial checkout of the default branch
- Creates feature branch with `git checkout -b <branch>`; falls back to `git checkout <branch>`
- **Cleanup**: Removes partial clone directory on both clone failure and checkout failure

{: .highlight }
> **Object sharing:** The `--reference` flag creates an alternates file pointing to the source repo's git objects. This means the clone only stores new objects, making it nearly as space-efficient as a worktree while remaining fully independent.

### destroy(workspacePath)

Removes the clone directory:

```bash
rm -rf ~/.ao-clones/my-app/session-123
```

- Simply deletes the directory with `rmSync(..., { recursive: true, force: true })`
- Much simpler than worktree's destroy — no git worktree management needed
- The branch and all clone-specific objects are removed with the directory

### list(projectId)

Lists all clones for a project by scanning the filesystem:

```bash
# For each directory in ~/.ao-clones/my-app/:
git branch --show-current
```

- Reads `{cloneBaseDir}/{projectId}` directory entries
- For each subdirectory, runs `git branch --show-current` to get the active branch
- Logs warnings via `console.warn` for corrupted or invalid git repos instead of silently skipping them

{: .highlight }
> **Explicit diagnostics:** Unlike the worktree plugin which silently skips corrupted entries, the clone plugin logs warnings for corrupted clones. This provides visibility into workspace health issues.

### exists(workspacePath)

Checks if the workspace directory exists and is a valid git repo via `git rev-parse --is-inside-work-tree`.

### restore(config, workspacePath)

Restores a workspace with a 2-tier retry strategy:

1. **Clone fresh** — `git clone --reference <repoPath>` for object sharing
2. **Plain checkout** — `git checkout <branch>`
3. **Create new branch** — `git checkout -b <branch>` (fallback)

Cleans up on both clone and checkout failures.

### postCreate(info, project)

Runs setup after workspace creation:

- Only runs post-create hook commands (no symlink support)
- Simpler than worktree's postCreate — executes shell commands from `project.postCreate` array via `sh -c` in the workspace directory

---

## Configuration

### Per-Project

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    workspace: clone
```

### Custom Base Directory

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    workspace: clone
    workspaceConfig:
      cloneDir: /custom/path/clones
```

### Post-Create Hooks

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    workspace: clone
    postCreate:
      - "npm install"
      - "cp .env.example .env"
```

---

## When to Use Clone

| Scenario | Recommendation |
|----------|---------------|
| Need complete isolation | Use clone — independent `.git` per workspace |
| Worktree conflicts occur | Use clone — no shared `.git` state |
| CI/CD environments | Use clone — simpler cleanup, no worktree state |
| Need symlink sharing | Use worktree instead — clone has no symlink support |
| Default workspace | Use worktree instead — more feature-rich |

---

## Next Steps

- [Worktree](../worktree/) — Default workspace with git worktree isolation
- [Workspace Plugins](./) — Workspace plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
