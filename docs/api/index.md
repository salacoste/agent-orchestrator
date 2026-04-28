---
title: REST API
nav_order: 7
has_children: true
description: REST API reference for the Agent Orchestrator web dashboard — 124 endpoints across 9 categories with JSON request/response, SSE streaming, and offset-based pagination.
---

# REST API

The Agent Orchestrator exposes a RESTful API from the Next.js web dashboard.
Every route lives under the file-based `app/api/` directory and is served at runtime without custom path rewriting.

**124 route files** are organized into 9 top-level categories, each documented in its own child page.

{: .highlight}
> All routes require `agent-orchestrator.yaml` in the working directory.
> See [Configuration Requirement](#configuration-requirement) below.

## Overview

| Attribute | Value |
|-----------|-------|
| Framework | Next.js 15 App Router |
| Routing | File-based (`packages/web/src/app/api/`) |
| Route files | 124 |
| Rendering | `force-dynamic` on most routes |
| OpenAPI spec | None (hand-documented) |
| Child pages | 9 — sessions, sprints, agents, events, portfolio, dependencies, scenarios, conflicts, risk |

Source: `packages/web/src/app/api/`

## Base URL

```
http://localhost:3000/api
```

No custom `basePath` is configured in `next.config.js`.
When deployed behind a reverse proxy, replace the host and port accordingly.

Source: `packages/web/next.config.js`

## Authentication

The API has **no authentication middleware**.
All routes are unauthenticated and are designed for local or self-hosted deployment behind a network boundary (reverse proxy, VPN, or firewall).

Two routes implement their own authorization:

| Route | Mechanism | Failure |
|-------|-----------|---------|
| `POST /api/telegram/webhook` | Validates `X-Telegram-Bot-Api-Secret-Token` header against configured secret | `401` |
| `POST /api/chat` | Requires `ANTHROPIC_API_KEY` environment variable for outbound LLM call | Returns `200` with `{ answer: "...", fallback: true }` if missing |

Source: route implementations in `packages/web/src/app/api/`

## Request Format

### JSON Bodies

All `POST`, `PATCH`, and `PUT` routes accept `Content-Type: application/json`.

### Dynamic Segments

Next.js 15 uses the `params: Promise<{ ... }>` pattern for dynamic segments:

```typescript
// Route file: app/api/sessions/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

Dynamic segment names used across the API:

| Segment | Used by |
|---------|---------|
| `[id]` | sessions, agents, scenarios, conflicts, approvals, DLQ, PRs |
| `[project]` | sprint, workflow, cross-session-memory, session streams |
| `[conflictId]` | conflicts |
| `[resourceType]` | conflict policies |
| `[errorId]` | DLQ retry |

### Query Parameters

Routes support filtering and pagination via query parameters:

```bash
# Audit events with pagination
GET /api/audit/events?page=2&limit=20

# Conflict history with filters
GET /api/conflicts/history?resourceType=repository&dateFrom=2026-01-01

# Audit events with date range
GET /api/audit/events?since=2026-04-01T00:00:00Z
```

### Input Validation

POST routes validate input using shared utilities from `packages/web/src/lib/validation.ts`:

| Function | Purpose |
|----------|---------|
| `validateString(value, fieldName)` | Checks for non-empty string |
| `validateIdentifier(value, fieldName)` | Validates alphanumeric identifiers |
| `stripControlChars(value)` | Strips control characters from strings |

Source: `packages/web/src/lib/validation.ts`

## Response Format

### Success Responses

Responses are **bare JSON objects** — no envelope wrapper:

```json
// Collection pattern
{ "sessions": [...], "stats": { "active": 3, "idle": 1 } }

// Single resource pattern
{ "id": "abc123", "status": "running", "agent": "claude-code" }

// Action confirmation pattern
{ "ok": true, "sessionId": "abc123" }
{ "success": true }

// Resource creation (status 201)
{ "session": { "id": "abc123", ... } }
```

### SSE Streaming Responses

Six routes use Server-Sent Events for real-time streaming:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

Event data is sent as JSON frames:

```
data: {"type":"session.snapshot","sessionId":"abc123","status":"running"}

: heartbeat

```

Heartbeat interval: **15 seconds** (`: heartbeat\n\n`).
Polling interval for data: **5 seconds**.

SSE routes:

| Route | Stream type |
|-------|-------------|
| `GET /api/events` | Global event bus |
| `GET /api/session/[id]/memory/stream` | Memory updates |
| `GET /api/session/[id]/notepad/stream` | Notepad changes |
| `GET /api/session/[id]/state/stream` | State transitions |
| `GET /api/session/[id]/timeline/stream` | Timeline entries |
| `GET /api/cross-session-memory/[project]/stream` | Cross-session memory |

Source: `packages/web/src/app/api/events/route.ts`, per-session stream routes

## Error Format

All errors return a consistent shape:

```json
{ "error": "Descriptive error message" }
```

### Status Codes

| Status | Meaning | Typical causes |
|--------|---------|----------------|
| `400` | Bad Request | Missing fields, invalid JSON, malformed identifiers |
| `401` | Unauthorized | Invalid Telegram webhook secret |
| `403` | Forbidden | Feature not enabled (e.g., cross-session memory disabled) |
| `404` | Not Found | Session, project, PR, or dependency not found |
| `409` | Conflict | Session not restorable, PR state not "open" |
| `422` | Unprocessable Entity | Dependency cycle detected, PR merge failure |
| `500` | Internal Server Error | Unexpected exceptions, missing config file |
| `503` | Service Unavailable | Missing credentials (environment variables) |

### Error Extraction Pattern

Routes extract error messages consistently:

```typescript
return NextResponse.json(
  { error: err instanceof Error ? err.message : "Failed to load resource" },
  { status: 500 }
);
```

### Extended Error: Dependency Cycle

The dependencies route returns an extended error when a cycle is detected:

```json
{
  "error": "Dependency cycle detected",
  "cyclePath": ["story-1", "story-2", "story-1"]
}
```

Source: `packages/web/src/app/api/dependencies/cross-project/route.ts`

## Common Headers

| Header | Value | Used by |
|--------|-------|---------|
| `Content-Type` | `application/json` | All JSON request/response routes |
| `Cache-Control` | `no-cache, no-store, must-revalidate` | Health, costs, conflict checkpoint |
| `Cache-Control` | `public, max-age=5, stale-while-revalidate=30` | Audit events |
| `Cache-Control` | `no-cache` | SSE stream routes |
| `X-Accel-Buffering` | `no` | SSE stream routes (disables nginx buffering) |
| `Connection` | `keep-alive` | SSE stream routes |

## Endpoint Categories

| Category | Routes | Prefix | Child Page | Description |
|----------|--------|--------|------------|-------------|
| Sessions | 7 | `/api/sessions` | [Sessions API](sessions/) | Session list, CRUD, kill, restore, message |
| Session Streams | 8 | `/api/session` | [Sessions API](sessions/) | Per-session state, memory, notepad, timeline (with SSE) |
| Sprints & Stories | 47 | `/api/sprint` | [Sprints API](sprints/) | Sprint CRUD, metrics, velocity, CFD, Monte Carlo, ceremonies, story CRUD |
| Agents | 11 | `/api/agent` | [Agents API](agents/) | Status, activity, capacity, confidence, logs, reassign |
| Events & Audit | 4 | `/api/events`, `/api/audit` | [Events API](events/) | SSE event bus, audit trail, immutable log, export |
| Portfolio & Pool | 2 | `/api/pool` | [Portfolio API](portfolio/) | Pool capacity, utilization |
| Dependencies | 4 | `/api/dependencies` | [Dependencies API](dependencies/) | Cross-project graph, blocking status, search |
| Scenarios | 5 | `/api/scenarios` | [Scenarios API](scenarios/) | CRUD, simulate, compare, apply |
| Conflicts | 7 | `/api/conflicts` | [Conflicts API](conflicts/) | Detection, resolution, suggestions, history, policies. Plus 2 sprint-level conflict routes under `/api/sprint` |
| Risk | 7 | `/api/risk` | [Risk API](risk/) | Score, alerts, bottleneck, optimization, utilization |

### Additional Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/health` | GET | System health check (always returns 200) |
| `POST /api/spawn` | POST | Spawn a new agent session |
| `GET /api/learning` | GET | Compound learning insights |
| `GET /api/users` | GET | User listing |
| `GET /api/resources` | GET | Resource inventory |
| `GET /api/costs/breakdown` | GET | Cost breakdown analysis |
| `POST /api/chat` | POST | LLM chat endpoint |
| `/api/approvals` | GET/POST | Approval queue (list, approve, reject) |
| `/api/dlq` | GET/POST | Dead-letter queue (list, retry) |
| `/api/state` | GET/POST | Full state export/import |
| `GET /api/sprints/unified` | GET | Unified sprint view across projects |
| `POST /api/telegram/webhook` | POST | Telegram bot webhook |
| `GET /api/workflow/[project]` | GET | Workflow dashboard data |
| `POST /api/workflow/feedback` | POST | Submit workflow feedback |
| `GET /api/workflow/health-metrics` | GET | Workflow health metrics |
| `GET /api/cross-session-memory/[project]` | GET | Cross-session memory read (non-stream) |
| `POST /api/prs/[id]/merge` | POST | Merge a pull request |

## Configuration Requirement

All routes (except `/api/health`) require `agent-orchestrator.yaml` in the working directory.

```bash
# If the config file is missing, every route returns:
# HTTP 500
{ "error": "No agent-orchestrator.yaml found. Run 'ao init' to create one." }
```

The config is loaded by `loadConfig()` in `packages/core/src/config.ts` and provided to routes via the `getServices()` singleton in `packages/web/src/lib/services.ts`:

```typescript
const { config, registry, sessionManager } = await getServices();
```

The singleton is cached in `globalThis` to survive Next.js HMR reloads and clears its cached promise on failure so subsequent calls retry.

{: .highlight}
> `/api/health` is the only route that gracefully handles missing config — it always returns HTTP 200 with degraded status.

Source: `packages/web/src/lib/services.ts`, `packages/core/src/config.ts`

## SSE Streaming

The API provides real-time updates via Server-Sent Events (SSE).

### Connecting

```javascript
const eventSource = new EventSource("http://localhost:3000/api/events");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data);
};

eventSource.onerror = () => {
  // EventSource auto-reconnects
};
```

### Event Format

```
data: {"type":"session.snapshot","sessionId":"abc123","status":"running","timestamp":"..."}\n\n
```

### Heartbeat

The server sends a heartbeat comment every **15 seconds** to keep the connection alive:

```
: heartbeat\n\n
```

### Available Streams

| Endpoint | Description |
|----------|-------------|
| `GET /api/events` | Global real-time event bus (all event types) |
| `GET /api/session/[id]/state/stream` | State transitions for a specific session |
| `GET /api/session/[id]/memory/stream` | Memory updates for a specific session |
| `GET /api/session/[id]/notepad/stream` | Notepad changes for a specific session |
| `GET /api/session/[id]/timeline/stream` | Timeline entries for a specific session |
| `GET /api/cross-session-memory/[project]/stream` | Cross-session memory updates for a project |

## Pagination

The audit events endpoint supports offset-based pagination:

```bash
GET /api/audit/events?page=1&limit=20
```

Response includes pagination metadata:

```json
{
  "events": [...],
  "total": 98,
  "page": 1,
  "limit": 100,
  "totalPages": 1
}
```

Parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | `1` | Page number (1-indexed) |
| `limit` | `100` | Events per page (max 1000) |
| `type` | — | Filter by event type |
| `storyId` | — | Filter by story ID |
| `agentId` | — | Filter by agent ID |
| `search` | — | Full-text search in event data |
| `since` | — | Filter events after timestamp (ISO 8601) |

{: .highlight}
> Pagination is currently only available on the audit events endpoint.
> Other list endpoints return all results or use query filters.

## Quick Start

```bash
# Health check (always returns 200)
curl http://localhost:3000/api/health

# List all sessions
curl http://localhost:3000/api/sessions

# Get sprint board for a project
curl http://localhost:3000/api/sprint/my-project

# Spawn a new session
curl -X POST http://localhost:3000/api/spawn \
  -H "Content-Type: application/json" \
  -d '{"project": "my-project", "story": "1-2-user-auth"}'

# Subscribe to real-time events (SSE)
curl -N http://localhost:3000/api/events
```

## API Reference

Detailed endpoint documentation for each category:

| Page | Description |
|------|-------------|
| [Sessions API](sessions/) | Session lifecycle — list, create, kill, restore, message, per-session state/memory/timeline streams |
| [Sprints API](sprints/) | Sprint and story management — CRUD, metrics, velocity, CFD, Monte Carlo, ceremonies, workload, WIP |
| [Agents API](agents/) | Agent operations — status, activity, capacity, confidence, logs, reassign, restart, cascade-resume |
| [Events API](events/) | Real-time events — SSE event bus, audit trail, immutable log, export |
| [Portfolio API](portfolio/) | Portfolio and pool — aggregation, capacity, utilization |
| [Dependencies API](dependencies/) | Cross-project dependencies — graph, blocking status, search |
| [Scenarios API](scenarios/) | Scenario simulation — CRUD, simulate, compare, apply |
| [Conflicts API](conflicts/) | Conflict management — detection, resolution, suggestions, history, policies |
| [Risk API](risk/) | Risk analysis — score, alerts, bottleneck, optimization, utilization |

---

- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
