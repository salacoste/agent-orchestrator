---
title: Production Deployment
nav_order: 6
parent: Advanced Topics
description: Build process, Docker containerization, process management, health monitoring, security hardening, CI/CD pipelines, and scaling considerations for deploying the Agent Orchestrator in production.
---

# Production Deployment

## Overview

The Agent Orchestrator is a Node.js application with two long-running processes:

1. **Web dashboard** — Next.js 15 app (App Router) serving the UI, REST API, and terminal WebSocket connections
2. **CLI daemon** — the `ao` command that manages sessions, spawns agents, and orchestrates workflows

Both processes are stateless — the orchestrator stores session metadata as flat files and events as JSONL logs. This makes deployment straightforward: build the TypeScript packages, start the web server, and configure the CLI.

**Deployment targets:** bare metal, Docker container, or any platform that runs Node.js 20+. The 8-plugin architecture means your runtime (tmux, process, docker), agent (claude-code, codex, aider), tracker (github, linear), and notifier (desktop, slack, discord, telegram, webhook) are all swappable.

**Source references:**
- Build scripts: `package.json`
- Web server: `packages/web/package.json`
- Config template: `agent-orchestrator.yaml.example`

**Related docs:** [Architecture Overview](../getting-started/architecture-overview/), [Configuration](../getting-started/configuration/), [Sessions](../core-concepts/sessions/), [Plugins](../plugins/)

## Build Process

### Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 20.0.0+ | ESM modules require Node 20+ |
| pnpm | 9.15.4 | Package manager (enforced by `packageManager` field) |

From `package.json`:

```json
{
  "engines": { "node": ">=20.0.0" },
  "packageManager": "pnpm@9.15.4",
  "type": "module"
}
```

### Build Commands

```bash
# Install dependencies
pnpm install

# Build all packages (TypeScript compilation)
pnpm build

# Typecheck all packages
pnpm typecheck

# Run linter
pnpm lint
```

`pnpm build` runs `pnpm -r build` — it compiles every workspace package in dependency order. Each package compiles its TypeScript (`tsc`) into `dist/`.

### Web Dashboard Build

The web dashboard uses Next.js 15 with a custom server for WebSocket support:

```bash
cd packages/web
pnpm build    # next build — produces .next/ output
pnpm start    # next start — serves on PORT (default: 5000)
```

The `dev` script starts three processes concurrently:

```json
{
  "dev": "concurrently --kill-others --kill-signal SIGTERM -n next,ws,dws \
    \"next dev -p ${PORT:-5000}\" \
    \"tsx watch server/terminal-websocket.ts\" \
    \"tsx watch server/direct-terminal-ws.ts\""
}
```

In production, the WebSocket servers run as separate processes alongside `next start`.

### Compiled Output Locations

| Package | Output | Entry Point |
|---------|--------|-------------|
| `@composio/ao-core` | `packages/core/dist/` | TypeScript → JavaScript |
| `@composio/ao-cli` | `packages/cli/dist/` | CLI binary |
| `@composio/ao-web` | `packages/web/.next/` | Next.js build output |
| Plugins (`runtime-*`, `agent-*`, etc.) | `packages/plugins/*/dist/` | TypeScript → JavaScript |

## Docker Deployment

No production Dockerfile exists in the repository yet. This section documents a recommended structure based on the integration test Dockerfile (`tests/integration/Dockerfile`) and the project's build requirements.

### Recommended Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM node:20-bookworm AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy lockfile first for better caching
COPY pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/
COPY packages/plugins/ packages/plugins/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm build

# Stage 2: Production
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    git \
    tmux \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy built artifacts and production deps
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/ packages/
COPY --from=builder /app/node_modules/ node_modules/

# Copy config template as default
COPY agent-orchestrator.yaml.example /app/agent-orchestrator.yaml

# Ports: dashboard (5000), terminal WebSocket (5080), direct terminal (5081)
EXPOSE 5000 5080 5081

ENV NODE_ENV=production
ENV PORT=5000

CMD ["pnpm", "--filter", "@composio/ao-web", "start"]
```

### .dockerignore

```
node_modules
.next
dist
*.tsbuildinfo
.git
.github
_bmad
_bmad-output
docs
*.md
!README.md
tests
.env*
```

### docker-compose.yml (Production)

```yaml
services:
  orchestrator:
    build: .
    ports:
      - "5000:5000"   # Dashboard
      - "5080:5080"   # Terminal WebSocket
      - "5081:5081"   # Direct Terminal WebSocket
    volumes:
      - orchestrator-data:/root/.agent-orchestrator
      - orchestrator-worktrees:/root/.worktrees
      - ./agent-orchestrator.yaml:/app/agent-orchestrator.yaml:ro
    environment:
      - NODE_ENV=production
      - PORT=5000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  redis:
    image: redis:7-alpine
    # Required for Redis event bus plugin in multi-instance setups only
    # Uncomment the volume below for persistence across restarts
    volumes:
      - redis-data:/data

volumes:
  orchestrator-data:
  orchestrator-worktrees:
  redis-data:
```

### Ports

| Port | Service | Config Key | Default |
|------|---------|------------|---------|
| 5000 | Web dashboard | `port` | `5000` |
| 5080 | Terminal WebSocket | `terminalPort` | `5080` |
| 5081 | Direct terminal WebSocket | `directTerminalPort` | `5081` |

From `agent-orchestrator.yaml.example`:

```yaml
port: 5000
# terminalPort: 5080
# directTerminalPort: 5081
```

## Process Management

The orchestrator runs multiple processes that need coordination:

1. **Next.js server** — serves the dashboard and REST API
2. **Terminal WebSocket server** — manages ttyd instances for tmux session terminals
3. **Direct terminal WebSocket server** — direct tmux terminal access

### Graceful Shutdown

Both WebSocket servers handle `SIGINT` and `SIGTERM` with a 5-second forced-shutdown timeout:

```
Signal received (SIGINT/SIGTERM)
  → Kill all ttyd instances
  → Close WebSocket connections
  → Close HTTP server
  → Wait for existing connections to drain
  → Force exit after 5s if still running
```

From `packages/web/server/terminal-websocket.ts`:

```typescript
function shutdown(signal: string) {
  console.log(`[Terminal] ${signal} received, shutting down...`);
  // Kill all ttyd instances...
  server.close(() => {
    console.log("[Terminal] Server closed");
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => {
    console.error("[Terminal] Forced shutdown after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

The same pattern is used in `packages/web/server/direct-terminal-ws.ts`.

### systemd

```ini
[Unit]
Description=Agent Orchestrator Dashboard
After=network.target

[Service]
Type=simple
User=orchestrator
WorkingDirectory=/opt/agent-orchestrator
ExecStart=/usr/bin/pnpm --filter @composio/ao-web start
Restart=on-failure
RestartSec=10
TimeoutStopSec=10

# Graceful shutdown
KillSignal=SIGTERM
FinalKillSignal=SIGKILL

Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
```

{: .note }
> The terminal WebSocket servers (`terminal-websocket.ts`, `direct-terminal-ws.ts`) are long-running processes and cannot use `ExecStartPost`. Run them as separate systemd services with the same `[Service]` configuration but pointing to each WebSocket script, or use pm2 instead.

### pm2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "ao-dashboard",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/agent-orchestrator/packages/web",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
    {
      name: "ao-terminal-ws",
      script: "server/terminal-websocket.ts",
      interpreter: "tsx",
      cwd: "/opt/agent-orchestrator/packages/web",
    },
    {
      name: "ao-direct-terminal-ws",
      script: "server/direct-terminal-ws.ts",
      interpreter: "tsx",
      cwd: "/opt/agent-orchestrator/packages/web",
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # configure auto-start on boot
```

### Startup Ordering

1. Start data directories (`dataDir`, `worktreeDir`) — ensure paths exist
2. Start the Next.js dashboard (`next start`)
3. Start the terminal WebSocket servers
4. Verify health with `GET /api/health`

## Reverse Proxy

No nginx configuration exists in the repository. This section provides a recommended setup for production deployments behind a reverse proxy.

### nginx Configuration

```nginx
upstream orchestrator_dashboard {
    server 127.0.0.1:5000;
}

upstream orchestrator_terminal_ws {
    server 127.0.0.1:5080;
}

upstream orchestrator_direct_terminal_ws {
    server 127.0.0.1:5081;
}

server {
    listen 80;
    server_name orchestrator.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name orchestrator.example.com;

    # SSL/TLS
    ssl_certificate     /etc/ssl/certs/orchestrator.pem;
    ssl_certificate_key /etc/ssl/private/orchestrator.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Dashboard
    location / {
        proxy_pass http://orchestrator_dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Terminal WebSocket
    location /ws/terminal/ {
        proxy_pass http://orchestrator_terminal_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Direct Terminal WebSocket
    location /ws/direct-terminal/ {
        proxy_pass http://orchestrator_direct_terminal_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Static asset caching (Next.js builds)
    location /_next/static/ {
        proxy_pass http://orchestrator_dashboard;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://orchestrator_dashboard;
    }
}
```

### WebSocket Proxying Notes

- `proxy_read_timeout 86400` — keeps idle WebSocket connections alive for 24 hours
- `proxy_http_version 1.1` — required for WebSocket upgrade
- The `Upgrade` and `Connection` headers are mandatory for WebSocket proxying

## Health Monitoring

The orchestrator provides a comprehensive health monitoring system that checks 8 components.

**Sources:** `packages/core/src/health-check.ts`, `health-check-rules.ts`, `degraded-mode.ts`, `circuit-breaker.ts`, `circuit-breaker-manager.ts`

### HealthCheckServiceImpl

The `HealthCheckServiceImpl` class monitors 8 components:

| Component | Config Key | What's Checked |
|-----------|------------|----------------|
| Event Bus | `eventBus` | Connection, latency, queue depth |
| BMAD Tracker | `bmadTracker` | Availability, latency |
| Local State | `stateManager` | File access, YAML integrity |
| Agent Registry | `agentRegistry` | Active agent count |
| Data Directory | `dataDir` | File accessibility, session count |
| Lifecycle Manager | `lifecycleManager` | Session count, degraded mode |
| Circuit Breakers | `circuitBreakerStates` | Open/half-open/closed state |
| Dead Letter Queue | `dlq` | Capacity, pending entries |

All checks include rate limiting — minimum 1s between checks, maximum 60 checks per 60-second window.

### `/api/health` Endpoint

The health check is exposed as `GET /api/health` from `packages/web/src/app/api/health/route.ts`:

```json
{
  "overall": "healthy",
  "components": [
    {
      "component": "event-bus",
      "status": "healthy",
      "message": "Event bus connected",
      "latencyMs": 12,
      "details": null
    }
  ],
  "timestamp": "2026-04-27T12:00:00.000Z",
  "exitCode": 0
}
```

The endpoint always returns HTTP 200 — even when unhealthy — to support monitoring systems that check status codes. The `exitCode` field indicates health (0 = healthy, 1 = unhealthy).

### Health Check Rules Engine

The rules engine (`health-check-rules.ts`) adds:

- **Per-component thresholds** — override global `maxLatencyMs` and `maxQueueDepth` per component
- **Weighted health aggregation** — assign weights (0-1) to components for overall status calculation
- **Critical components** — mark a component as critical so its failure makes the overall status unhealthy
- **Custom health check functions** — register additional checks via `CustomHealthCheckFn`

### Circuit Breaker

The circuit breaker (`circuit-breaker.ts`) prevents cascading failures with a CLOSED → OPEN → HALF-OPEN state machine:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `failureThreshold` | 5 | Failures before opening |
| `openDurationMs` | 30000 (30s) | Time to stay open before half-open |

State transitions:
- **CLOSED** → normal operation, failures are counted
- **OPEN** → after `failureThreshold` consecutive failures, all requests are blocked
- **HALF-OPEN** → after `openDurationMs`, allows one request to test recovery
- **HALF-OPEN** + success → back to CLOSED
- **HALF-OPEN** + failure → back to OPEN

The `CircuitBreakerManager` (`circuit-breaker-manager.ts`) creates named breaker instances per service (event-bus, tracker, scm, notifier) with a circular publishing guard — the event-bus breaker does not publish state changes through the event bus itself.

### Degraded Mode

The degraded mode service (`degraded-mode.ts`) tracks service availability with 4 states:

| State | Meaning |
|-------|---------|
| `normal` | All services available |
| `event-bus-unavailable` | Event bus down, events queued in-memory |
| `bmad-unavailable` | BMAD tracker down, sync operations queued |
| `multiple-services-unavailable` | Two or more services down |

When a service recovers, the system automatically drains queued operations.

### Configuration

```yaml
health:
  checkIntervalMs: 30000     # Check every 30s (default)
  alertOnTransition: true    # Publish event on status change (default: true)
  thresholds:
    maxLatencyMs: 1000       # Global latency threshold (default: 1000ms)
    maxQueueDepth: 100       # Global queue depth threshold (default: 100)
  perComponent:              # Override per component
    event-bus:
      maxLatencyMs: 500
      maxQueueDepth: 200
    bmad-tracker:
      maxLatencyMs: 2000
```

From `agent-orchestrator.yaml.example`.

## Security Hardening

### execFile vs exec Policy

The orchestrator enforces a strict security policy for shell command execution. From `CLAUDE.md`:

- **Always use `execFile`** (or `spawn`) — NEVER `exec` (shell injection risk)
- **Always add timeouts** — `{ timeout: 30_000 }` for external commands
- **Never interpolate user input** — pass as array args, not string templates
- **Do NOT use `JSON.stringify` for shell escaping** — not a shell escaping function

```typescript
// GOOD
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
  timeout: 30_000,
});

// BAD — shell injection risk
exec(`git checkout ${branchName}`);
```

### Plugin Sandbox Permissions

Each plugin implements a well-defined interface from `packages/core/src/types.ts`. Plugins only have access to the methods defined in their interface — there is no shared global state. The 8-plugin slots (Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, Provider) are isolated from each other.

### API Key Management

All API keys and secrets must be stored as environment variables:

```yaml
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}     # Environment variable reference
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}   # Environment variable reference
    defaultChatId: ${TELEGRAM_CHAT_ID}
```

Never hardcode API keys in `agent-orchestrator.yaml` or commit them to version control.

### GitHub Actions Security Workflow

The `.github/workflows/security.yml` runs three security checks:

| Job | Tool | Trigger | Severity |
|-----|------|---------|----------|
| Scan for Secrets | Gitleaks | Push/PR to main, weekly Monday 8am UTC | Any finding |
| Dependency Review | `dependency-review-action` | Pull requests only | Moderate+ |
| NPM Audit | `pnpm audit` | All triggers | High (production deps) |

```yaml
# security.yml
npm-audit:
  steps:
    - run: pnpm audit --audit-level=moderate        # Warn on moderate+
    - run: pnpm audit --prod --audit-level=high      # Fail on high in production deps
```

The NPM audit job runs twice: once broadly (continue-on-error for moderate findings) and once strictly for production dependencies only.

### Notifier Webhook URL Protection

Notifier webhook URLs are resolved from environment variables using `${VAR_NAME}` syntax. The config loader substitutes these at parse time — the raw YAML never contains actual URLs.

## CI/CD Pipeline

The project uses 6 GitHub Actions workflows:

### CI (`ci.yml`)

Runs on push to `main` and all pull requests:

| Job | Steps | Purpose |
|-----|-------|---------|
| Lint | `pnpm lint` | ESLint check |
| Typecheck | `pnpm typecheck` | TypeScript type checking |
| Test | `pnpm test` | Unit tests (excludes web) |
| Test (Web) | `vitest run server/__tests__/` | Web server unit + integration tests |

All jobs use Node 20, pnpm, and `--frozen-lockfile` installs.

### Release (`release.yml`)

Runs on push to `main`:

```yaml
- pnpm -r --filter '!@composio/ao-web' build
- changesets/action@v1:
    version: pnpm version-packages   # Auto-version on changeset
    # publish: pnpm release          # NPM publishing (disabled — no NPM_TOKEN)
```

NPM publishing is currently disabled. The release workflow handles version bumping via changesets only. Re-enable by uncommenting the `publish` line and setting `NPM_TOKEN` in repository secrets.

### Security (`security.yml`)

Runs on push/PR to `main` and weekly on Monday at 08:00 UTC. See [Security Hardening](#security-hardening) for details.

### Pages (`pages.yml`)

Deploys the Jekyll documentation site to GitHub Pages on push to `main` when `docs/` files change:

```yaml
on:
  push:
    branches: ["main"]
    paths:
      - "docs/**"
      - ".github/workflows/pages.yml"
```

Uses Ruby 3.3, builds Jekyll with `JEKYLL_ENV=production`, and deploys via `actions/deploy-pages@v5`.

### Integration Tests (`integration-tests.yml`)

Runs on push/PR to `main` with a 20-minute timeout:

1. Installs tmux, Claude Code, Codex, Aider, and OpenCode
2. Builds all non-web packages
3. Runs `pnpm test:integration` with API keys from repository secrets

### Onboarding Test (`onboarding-test.yml`)

Runs on PRs touching `packages/` or `scripts/setup.sh`. Uses Docker Compose to test the fresh install experience:

```yaml
on:
  pull_request:
    paths:
      - 'packages/**'
      - 'scripts/setup.sh'
```

## Scaling Considerations

### Stateless Architecture

The orchestrator is fundamentally stateless:

- **Session metadata** — flat YAML files in `dataDir` (default: `~/.agent-orchestrator`)
- **Event log** — append-only JSONL files
- **No database** — no shared state between instances

This means vertical scaling (more CPU/RAM) rarely helps — the bottleneck is agent runtime slots, not orchestrator capacity.

### Horizontal Scaling Constraints

Multiple orchestrator instances can run against the same project repos if:

1. **Data directory is shared** — `dataDir` must be on a shared filesystem (NFS, EFS) so all instances read/write the same session metadata
2. **Worktree directory is shared** — `worktreeDir` must be accessible from all instances
3. **Event bus uses Redis** — replace the in-memory event bus with the Redis plugin for cross-instance event delivery
4. **Session affinity** — a session's agent process runs on one machine; route WebSocket connections to the correct instance

### Event Bus Redis Plugin

For multi-instance deployments, use the Redis event bus plugin:

```yaml
defaults:
  eventBus: redis    # Use Redis instead of in-memory
```

See [Redis Event Bus](../plugins/eventbus/redis/) for configuration details.

### Runtime Scaling Implications

| Runtime | Scalability | Notes |
|---------|-------------|-------|
| tmux | Single machine | tmux sessions are local to the host |
| process | Single machine | Child processes run on the host |
| docker | Multi-machine | Containers can run on any Docker host |
| kubernetes | Multi-machine | Pods scheduled across cluster nodes |

For multi-machine deployments, use the Docker or Kubernetes runtime plugins so agent sessions can be distributed across hosts.

## Configuration

### Production-Specific Values

| Setting | Default | Production Recommendation | Config Key |
|---------|---------|--------------------------|------------|
| Dashboard port | 5000 | 5000 (behind reverse proxy) | `port` |
| Terminal WS port | 5080 | 5080 | `terminalPort` |
| Direct terminal port | 5081 | 5081 | `directTerminalPort` |
| Health check interval | 30000ms | 30000ms | `health.checkIntervalMs` |
| Max latency threshold | 1000ms | 1000ms | `health.thresholds.maxLatencyMs` |
| Max queue depth | 100 | 100 | `health.thresholds.maxQueueDepth` |
| Circuit breaker threshold | 5 failures | 5-10 | Per-service override |
| Circuit breaker open duration | 30000ms | 30000-60000ms | Per-service override |

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NODE_ENV` | Set to `production` | Yes |
| `PORT` | Dashboard port override | No (default: 5000) |
| `SLACK_WEBHOOK_URL` | Slack notifier webhook | If using Slack |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | If using Telegram |
| `TELEGRAM_CHAT_ID` | Telegram default chat | If using Telegram |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | If using Discord |
| `GITHUB_TOKEN` | GitHub API access | If using GitHub tracker/SCM |
| `LINEAR_API_KEY` | Linear API access | If using Linear tracker |
| `ANTHROPIC_API_KEY` | Claude agent API | If using claude-code agent |
| `OPENAI_API_KEY` | OpenAI API access | If using codex agent |

### Production Config Template

```yaml
# agent-orchestrator.yaml — Production Configuration

dataDir: /data/agent-orchestrator
worktreeDir: /data/worktrees

port: 5000
# terminalPort: 5080
# directTerminalPort: 5081

health:
  checkIntervalMs: 30000
  alertOnTransition: true
  thresholds:
    maxLatencyMs: 1000
    maxQueueDepth: 100
  perComponent:
    event-bus:
      maxLatencyMs: 500
    bmad-tracker:
      maxLatencyMs: 2000

defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [slack]

projects:
  production-app:
    name: Production App
    repo: org/production-app
    path: /repos/production-app
    defaultBranch: main
    sessionPrefix: prod

notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"

notificationRouting:
  urgent: [slack]
  action: [slack]
  warning: [slack]
  info: [slack]

reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
    escalateAfter: 2
  changes-requested:
    auto: true
    action: send-to-agent
    escalateAfter: 30m
  approved-and-green:
    auto: false
    action: notify
    priority: action
```

## Production Readiness Checklist

### Build & Deployment

- [ ] Node.js 20+ installed
- [ ] pnpm 9.15.4 installed
- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] `pnpm build` succeeds (all packages compile)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Docker image builds successfully (if using Docker)
- [ ] Config file created from `agent-orchestrator.yaml.example`

### Health Checks

- [ ] `GET /api/health` returns `healthy` status
- [ ] All 8 components reporting (event-bus, tracker, state, registry, data-dir, lifecycle, breakers, DLQ)
- [ ] Health check interval configured (default: 30s)
- [ ] Thresholds tuned for your deployment
- [ ] Monitoring system configured to poll `/api/health`

### Monitoring & Alerting

- [ ] Process manager configured (systemd or pm2)
- [ ] Log aggregation configured (stdout/stderr)
- [ ] Alert on health status transitions (`alertOnTransition: true`)
- [ ] Circuit breaker open/close alerts
- [ ] Degraded mode entry/exit alerts

### Security

- [ ] All API keys stored in environment variables (not in config file)
- [ ] Config file has restricted file permissions (600)
- [ ] `execFile` policy enforced in custom plugins
- [ ] SSL/TLS configured on reverse proxy
- [ ] Gitleaks pre-commit hook installed
- [ ] NPM audit passes for production dependencies

### Networking

- [ ] Reverse proxy configured (nginx or similar)
- [ ] WebSocket proxying enabled for terminal connections
- [ ] Port 5000 (dashboard) accessible
- [ ] Ports 5080/5081 (terminal WebSocket) accessible
- [ ] SSL certificate valid and auto-renewing

### Process Management

- [ ] Graceful shutdown tested (SIGINT/SIGTERM)
- [ ] Auto-restart configured (systemd `Restart=on-failure` or pm2)
- [ ] Startup ordering verified (dashboard → WebSocket servers)
- [ ] Log rotation configured

### Scaling

- [ ] Data directory on shared filesystem (if multi-instance)
- [ ] Redis event bus configured (if multi-instance)
- [ ] Session affinity configured on load balancer (if multi-instance)
- [ ] Runtime plugin matches deployment target (tmux for single, docker/k8s for multi)

### Notifications

- [ ] At least one notifier configured and tested
- [ ] Notification routing rules set (`urgent`, `action`, `warning`, `info`)
- [ ] Webhook URLs valid and secured
- [ ] Quiet hours configured if needed (Telegram plugin)

---

- **Parent** — [Advanced Topics](.)
- **Siblings** — [Cross-Project Orchestration](cross-project/), [Monte Carlo Simulations](monte-carlo/), [Custom Plugin Development](custom-plugins/), [Hooks & Extensions](hooks-extensions/), [Prompt Layers](prompt-layers/)
- **Related** — [Architecture Overview](../getting-started/architecture-overview/), [Configuration](../getting-started/configuration/), [Sessions](../core-concepts/sessions/), [Plugins](../plugins/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
