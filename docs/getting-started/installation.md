---
title: Installation
nav_order: 1
parent: Getting Started
description: Step-by-step installation guide for Agent Orchestrator — prerequisites, three install methods, verification, and troubleshooting for macOS and Linux.
---

# Installation

Get Agent Orchestrator running on your machine in under five minutes.

---

## Prerequisites

### Required

| Dependency | Version | Purpose | Verify |
|------------|---------|---------|--------|
| **Node.js** | 20+ | Runtime for the orchestrator and CLI | `node --version` |
| **Git** | 2.25+ | Repository management and worktrees | `git --version` |
| **pnpm** | 9+ | Package manager (installed by setup.sh) | `pnpm --version` |

**Install Node.js 20+:**

```bash
# macOS (Homebrew)
brew install node@20

# Linux (nvm — recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/latest/install.sh | bash
nvm install 20

# All platforms — direct download
# https://nodejs.org/en/download
```

**Install Git 2.25+:**

```bash
# macOS — comes with Xcode Command Line Tools, or:
brew install git

# Ubuntu/Debian
sudo apt install git

# Fedora/RHEL
sudo dnf install git
```

**Install pnpm:**

```bash
# Via corepack (bundled with Node 20+)
corepack enable
corepack prepare --activate

# Or via npm
npm install -g pnpm
```

### Optional

| Dependency | Purpose | Install |
|------------|---------|---------|
| **tmux** | Default runtime for agent sessions | `brew install tmux` (macOS) / `sudo apt install tmux` (Linux) |
| **GitHub CLI (`gh`)** | PR creation, issue management | `brew install gh` (macOS) — [Linux instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |
| **Claude CLI** | Default AI agent (claude-code) | `npm install -g @anthropic-ai/claude-code` |
| **Linear API Key** | Linear issue tracking | Set `LINEAR_API_KEY` env var |
| **Slack Webhook** | Slack notifications | Set `SLACK_WEBHOOK_URL` env var |

> **Note:** tmux and `gh` CLI are strongly recommended — they are used by the default configuration. If you use a different runtime (Docker, process) or tracker (Linear), you can skip the corresponding optional dependency.

---

## Install Methods

### Method 1: Quick Install (Recommended)

The setup script validates prerequisites, installs dependencies, builds all packages, and links the `ao` CLI globally:

```bash
git clone https://github.com/ComposioHQ/agent-orchestrator
cd agent-orchestrator
bash scripts/setup.sh
```

**What the script does:**

1. Validates hard requirements (Node 20+, Git 2.25+) — exits on failure
2. Warns about missing optional tools (tmux, `gh`, Claude CLI) — offers interactive install on macOS
3. Installs pnpm via corepack (falls back to `npm install -g pnpm`)
4. Runs `pnpm install` → `pnpm build` → `npm link` (CLI)
5. Verifies `ao` is in your PATH

{: .highlight }
> If the script fails, see [Troubleshooting](#troubleshooting) below, or try Method 2 for manual control.

### Method 2: Manual Build

Install step by step — useful when the automated script fails or you need more control:

```bash
# 1. Clone the repository
git clone https://github.com/ComposioHQ/agent-orchestrator
cd agent-orchestrator

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Link the CLI globally
npm link -g packages/cli

# 5. Verify
ao --version
```

### Method 3: npm Global Install (Coming Soon)

Not yet available — will be supported once the package is published to npm:

```bash
# Future — not yet available
npm install -g @composio/ao-cli
ao --version
```

{: .label .label-yellow }
Coming Soon

For now, use Method 1 or Method 2 above. Track progress on [npm package publication](https://github.com/ComposioHQ/agent-orchestrator/issues).

---

## Verify Installation

After installing, confirm everything is working:

```bash
# Check CLI version
ao --version
# Expected output: 0.1.0 (or current version)

# View available commands
ao --help

# Start the dashboard with a test repo
ao start https://github.com/your-org/your-repo
```

If `ao --version` prints a version number, the installation was successful. The dashboard will open at `http://localhost:5000`.

---

## Troubleshooting

### `node` command not found

Node.js is not installed or not in your PATH.

```bash
# Verify
node --version

# Install (macOS)
brew install node@20

# Install (Linux via nvm)
nvm install 20
```

### Node version too old

Agent Orchestrator requires Node.js 20 or later.

```bash
node --version
# If output is v18.x or lower, upgrade:

# macOS
brew upgrade node

# Linux (nvm)
nvm install 20
nvm use 20
```

### `pnpm` command not found

pnpm is required for installing dependencies in the monorepo.

```bash
# Option 1: corepack (bundled with Node 20+)
corepack enable
corepack prepare --activate

# Option 2: npm
npm install -g pnpm
```

### `ao` command not found after install

The `npm link` step may not have added `ao` to your PATH. This is common on some Linux setups.

```bash
# Find where npm links global packages
NPM_BIN="$(npm config get prefix)/bin"

# Add to your shell profile
echo "export PATH=\"$NPM_BIN:\$PATH\"" >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc

# Re-link if needed
cd agent-orchestrator/packages/cli
npm link
```

### tmux not installed

tmux is the default runtime for agent sessions. Without it, you'll need to configure an alternative runtime (e.g., `process`).

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux

# Fedora/RHEL
sudo dnf install tmux
```

### Build failures

If `pnpm build` fails with TypeScript compilation errors:

```bash
# Clean build artifacts and rebuild
pnpm clean
pnpm install
pnpm build
```

If the issue persists, ensure you're using the correct Node and pnpm versions:

```bash
node --version   # Should be v20.x
pnpm --version   # Should be 9.x
```

### GitHub CLI not authenticated

The `gh` CLI needs authentication for PR creation and issue tracking.

```bash
# Check status
gh auth status

# Authenticate
gh auth login
```

---

## Next Steps

- **[Quick Start Tutorial](../quick-start/)** — 5-minute hands-on guide from init to first agent
- **[Configuration Reference](../configuration/)** — full YAML config with all options
- **[Architecture Overview](../architecture-overview/)** — how the 8 plugin slots work together
