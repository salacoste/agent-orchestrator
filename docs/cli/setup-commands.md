---
title: Setup Commands
nav_order: 1
parent: CLI Reference
description: Setup commands for Agent Orchestrator — ao init, start, stop, create, plugins, plugin, and sprint-config for project initialization, configuration, and plugin management.
---

# Setup Commands

The Setup category includes 7 top-level commands for project initialization, orchestrator lifecycle, story creation, plugin management, and sprint configuration. Six are standalone commands; the seventh (`ao plugin`) is a parent command with 9 subcommands for plugin lifecycle management.

{: .highlight }
> **First time?** Run `ao init` to create your config file, then `ao start` to launch the orchestrator and dashboard. See [Getting Started](../../../getting-started/) for the full walkthrough.

---

## Command Summary

| Command | Description | `--json` |
|---------|-------------|----------|
| [`ao init`](#ao-init) | Interactive setup wizard — creates `agent-orchestrator.yaml` | No |
| [`ao start [project]`](#ao-start) | Start orchestrator agent and dashboard for a project (or pass a repo URL to onboard) | No |
| [`ao stop [project]`](#ao-stop) | Stop orchestrator agent and dashboard for a project | No |
| [`ao create [project]`](#ao-create) | Create a new story in the BMad tracker | Yes |
| [`ao plugins`](#ao-plugins) | List installed plugins | Yes |
| [`ao plugin <sub>`](#ao-plugin) | Manage plugins (9 subcommands) | Yes |
| [`ao sprint-config [project]`](#ao-sprint-config) | View or set sprint configuration | Yes (read) |

---

## ao init

Creates the `agent-orchestrator.yaml` configuration file. Three mutually exclusive modes:

| Mode | Flag | Behavior |
|------|------|----------|
| Interactive wizard | *(default)* | Up to 13 prompts (12 if tracker is not `linear`) |
| Auto-generate | `--auto` | Sensible defaults, no prompts |
| Git hooks | `--hooks` | Installs `prepare-commit-msg` hook only |

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--output <path>` | `-o` | `agent-orchestrator.yaml` | Output file path |
| `--auto` | | | Auto-generate config with sensible defaults (no prompts) |
| `--smart` | | | Analyze project and generate custom rules (coming soon — requires `--auto`) |
| `--hooks` | | | Install git hooks (prepare-commit-msg for story/agent tagging) |
| `--force` | | | Overwrite existing hooks (use with `--hooks`) |

### Interactive Mode

The wizard prompts for 12–13 configuration values (13 if the tracker is `linear`). Each has a smart default auto-detected from your environment:

1. **Data directory** — default: `~/.agent-orchestrator`
2. **Worktree directory** — default: `~/.worktrees`
3. **Dashboard port** — auto-detects free port, default: `5000`
4. **Runtime** — default: `tmux` (options: `tmux`, `process`)
5. **Agent** — default: `claude-code` (options: `claude-code`, `glm`, `codex`, `aider`)
6. **Workspace** — default: `worktree` (options: `worktree`, `clone`)
7. **Notifiers** — default: `desktop` (comma-separated: `desktop`, `slack`)
8. **Project ID** — default: basename of cwd (if git repo)
9. **GitHub repo** — default: auto-detected from git remote
10. **Local path** — default: cwd (if git repo)
11. **Default branch** — default: auto-detected, fallback: `main`
12. **Tracker** — default: `linear` (if `LINEAR_API_KEY` set), else `github` (options: `github`, `linear`, `none`)
13. **Linear team ID** — *(only if tracker is `linear`)*

### Auto Mode

```bash
# Generate config with sensible defaults
ao init --auto

# Generate with project-aware rules
ao init --auto --smart
```

Detects environment (git repo, tmux, gh CLI) and project type, then writes a complete config without any prompts.

### Hooks Mode

```bash
# Install prepare-commit-msg hook
ao init --hooks

# Overwrite existing hook
ao init --hooks --force
```

Installs a `.git/hooks/prepare-commit-msg` hook that appends `[story:X-Y] [agent:session-id]` tags to commit messages. Requires a git repository.

### Exit Conditions

| Condition | Exit code |
|-----------|-----------|
| Config file already exists at output path | `1` |
| `--smart` without `--auto` | `1` |
| Invalid port number | `1` |
| `--hooks` without a git repo | `1` |

---

## ao start

Starts the orchestrator agent and web dashboard for a project. Supports two flows:

- **Normal**: `ao start [project]` — starts from existing config
- **URL**: `ao start <url>` — clones repo, auto-generates config, then starts

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--no-dashboard` | *(dashboard starts)* | Skip starting the dashboard server |
| `--no-orchestrator` | *(orchestrator starts)* | Skip starting the orchestrator agent |
| `--rebuild` | | Clean and rebuild dashboard before starting |

### Normal Flow

```bash
# Start with default project
ao start

# Start a specific project
ao start my-app

# Start only the dashboard
ao start --no-orchestrator

# Rebuild and start
ao start --rebuild
```

The command loads config, resolves the project, and starts both the dashboard (`pnpm run dev` in the web package) and orchestrator session (a tmux session running the agent). On success, it auto-opens the browser to the session page.

### URL Flow

```bash
# Clone a repo and start
ao start https://github.com/owner/repo
```

The command parses the URL, clones the repo (using `gh repo clone`, SSH, or HTTPS in order), looks for an existing config, generates one if missing, then runs the normal startup sequence.

### Startup Sequence

```text
ao start [project]
  |
  +-- Load config, resolve project
  +-- Check port availability (default: 5000)
  +-- Dashboard:
  |     +-- Find web package directory
  |     +-- Check built (preflight)
  |     +-- Spawn: pnpm run dev
  |     +-- Print: Dashboard starting on http://localhost:PORT
  +-- Orchestrator:
  |     +-- Create session manager
  |     +-- Generate orchestrator prompt
  |     +-- Spawn agent session in tmux
  |     +-- If spawn fails: kill dashboard, throw
  +-- Print summary
  +-- Auto-open browser (30s timeout)
  +-- Keep alive (attached to dashboard)
```

### Output

On success, prints:

```text
--- Startup complete

Dashboard:    http://localhost:5000
Orchestrator: tmux attach -t my-app-orchestrator
Config:       /path/to/agent-orchestrator.yaml
```

---

## ao stop

Stops the orchestrator agent session and dashboard process for a project.

```bash
# Stop default project
ao stop

# Stop a specific project
ao stop my-app
```

### Stop Sequence

1. Loads config and resolves the project
2. **Orchestrator**: kills the tmux session via `sm.kill(sessionId)` with a spinner
3. **Dashboard**: finds PIDs on the configured port via `lsof -ti :PORT` and kills them
4. Prints: `✓ Orchestrator stopped`

This command has no flags. It always attempts to stop both the orchestrator session and dashboard process, logging warnings if either is not found.

---

## ao create

Creates a new story in the BMad tracker. Requires the `bmad` tracker plugin to be configured.

### Flags

| Flag | Short | Required | Description |
|------|-------|----------|-------------|
| `--title <title>` | `-t` | **Yes** | Story title |
| `--epic <epic>` | `-e` | No | Epic identifier (e.g. `epic-auth`) |
| `--description <desc>` | `-d` | No | Story description |
| `--json` | | No | Output as JSON |

### Examples

```bash
# Create a story
ao create --title "Add login page" --epic epic-auth

# Create with description
ao create -t "Fix rate limiter" -d "Users hitting 429 too often"

# JSON output for scripting
ao create --title "Refactor CLI" --json
```

### Requirements

- Config must exist (run `ao init` first)
- Tracker must be `bmad` (not `github` or `linear`)
- Tracker must support `createIssue`

### Output

Without `--json`, displays a `header("Story Created")` box with ID, title, state (green `backlog`), and epic. With `--json`, outputs `JSON.stringify(issue, null, 2)`.

---

## ao plugins

Lists all installed plugins with their status. This is the **plural** form — use [`ao plugin`](#ao-plugin) (singular) to manage plugins.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Examples

```bash
# List installed plugins
ao plugins

# JSON output
ao plugins --json
```

### Output Format

Displays a table with columns:

| Column | Width | Content |
|--------|-------|---------|
| Name | 28 chars | Plugin package name |
| Version | 12 chars | Installed version |
| Status | 14 chars | `✓ Loaded` (green), `✗ Failed` (red), or `⚠️ Disabled` (yellow) |
| Permissions | 20 chars | Granted permissions |
| Description | 30 chars | Short description |

Followed by a summary line: `N loaded, N disabled, N failed, N total`.

---

## ao plugin

Parent command for plugin lifecycle management. Has 9 subcommands:

| Subcommand | Description |
|-----------|-------------|
| `install <package>` | Install a plugin from npm or local path |
| `uninstall <package>` | Uninstall a plugin |
| `update <package>` | Update a plugin to latest version |
| `search <query>` | Search for plugins on npm |
| `info <package>` | Show detailed plugin information |
| `disable <package>` | Disable a plugin without uninstalling it |
| `enable <package>` | Enable a disabled plugin |
| `validate <path>` | Validate a plugin structure for publishing |
| `publish <path>` | Publish a plugin to the npm registry |

Every subcommand supports `--json` for machine-readable output.

### ao plugin install

```bash
# Install from npm
ao plugin install @composio/ao-plugin-notifier-slack

# Install from local path
ao plugin install ./my-plugin --local

# Auto-grant all permissions
ao plugin install my-plugin --grant-permissions
```

| Flag | Description |
|------|-------------|
| `--local` | Install from local path instead of npm |
| `--grant-permissions` | Automatically grant all requested permissions |
| `--json` | Output as JSON |

Without `--grant-permissions`, prompts for permission approval using interactive checkboxes. Permission categories: `runtime`, `agent`, `workspace`, `tracker`, `scm`, `notifier`, `terminal`.

### ao plugin uninstall

```bash
ao plugin uninstall @composio/ao-plugin-notifier-slack
```

Returns status: `uninstalled`, `cancelled`, or error.

### ao plugin update

```bash
# Update to latest
ao plugin update @composio/ao-plugin-notifier-slack

# Update to specific version
ao plugin update my-plugin --version 1.2.0
```

| Flag | Description |
|------|-------------|
| `--version <version>` | Update to specific version |
| `--json` | Output as JSON |

Returns status: `updated`, `up-to-date`, or error.

### ao plugin search

```bash
ao plugin search slack
```

Searches npm for matching plugins. Results show name (cyan bold), version (yellow), description, author, and homepage.

### ao plugin info

```bash
ao plugin info @composio/ao-plugin-notifier-slack
```

Shows version, status, API version, description, permissions, and any error details.

### ao plugin disable / enable

```bash
# Temporarily disable a plugin
ao plugin disable my-plugin

# Re-enable it
ao plugin enable my-plugin
```

Disabled plugins remain installed but are not loaded at startup.

### ao plugin validate

```bash
ao plugin validate ./packages/my-plugin
```

Validates plugin structure for publishing. Shows errors (red) and warnings (yellow). Exits with code `1` if validation fails.

### ao plugin publish

```bash
ao plugin publish ./packages/my-plugin
```

Validates the plugin structure first, then publishes to the npm registry. Exits with code `1` if validation or publishing fails.

---

## ao sprint-config

Views or sets sprint configuration for a project. Operates in two modes:

- **Read mode** (default): displays current sprint configuration
- **Write mode**: when any write flag is provided, updates the YAML config file

### Flags

| Flag | Mode | Description |
|------|------|-------------|
| `--start-date <date>` | Write | Set sprint start date (format: `YYYY-MM-DD`) |
| `--end-date <date>` | Write | Set sprint end date (format: `YYYY-MM-DD`) |
| `--clear-end-date` | Write | Remove sprint end date |
| `--goal <text>` | Write | Set sprint goal |
| `--target-velocity <n>` | Write | Set target velocity (positive integer) |
| `--wip-limit <col:n>` | Write | Set WIP limit (repeatable, e.g. `in-progress:3`) |
| `--json` | Read | Output as JSON |

### Read Mode

```bash
# View current sprint config
ao sprint-config

# View for a specific project
ao sprint-config my-app

# JSON output for scripting
ao sprint-config --json
```

Displays each field with its value (cyan) or `(not set)` (dim) if not configured.

### Write Mode

```bash
# Set sprint dates
ao sprint-config --start-date 2026-04-21 --end-date 2026-05-02

# Set goal and velocity
ao sprint-config --goal "Ship CLI docs" --target-velocity 10

# Set WIP limits (repeatable)
ao sprint-config --wip-limit in-progress:3 --wip-limit review:2

# Clear end date
ao sprint-config --clear-end-date
```

### Validation Rules

| Flag | Validation |
|------|------------|
| `--start-date` / `--end-date` | Must match `YYYY-MM-DD` and be a valid date |
| `--target-velocity` | Must be a positive integer |
| `--wip-limit` | Must match format `col:n` where `n` is a positive integer |

Invalid values print an error and exit with code `1`.

---

## Next Steps

- [Session Commands](../session-commands/) — Agent session lifecycle
- [Sprint Commands](../sprint-commands/) — Sprint planning and execution
- [Story Commands](../story-commands/) — Story and epic management
- [Monitoring Commands](../monitoring/) — Status, health, and metrics
- [Review & PR Commands](../review-pr/) — Code reviews and PR workflow
- [Intelligence Commands](../intelligence/) — Analytics and forecasting
- [Infrastructure Commands](../infrastructure/) — Providers, events, triggers
- [CLI Reference](./) — Command categories and common flags
- [Getting Started](../../../getting-started/) — Installation and first project
- [Configuration](../../../getting-started/configuration/) — Full config reference
