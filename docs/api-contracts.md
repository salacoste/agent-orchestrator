# Agent Orchestrator — API Contracts

55 API route files across 11 endpoint groups. All routes return JSON via `NextResponse.json()`.

## Session Management (7 routes)

| Method | Path | Description | Request | Response | Status |
|--------|------|-------------|---------|----------|--------|
| GET | `/api/sessions` | List sessions | `?active=true` | `{ sessions: DashboardSession[], stats: DashboardStats, orchestratorId: string \| null }` | 200 |
| GET | `/api/sessions/[id]` | Get session detail | — | `DashboardSession` (enriched with PR/issue data) | 200, 404 |
| POST | `/api/sessions/[id]/kill` | Kill session + cleanup | — | `{ ok: true, sessionId }` | 200, 404 |
| POST | `/api/sessions/[id]/restore` | Restore terminated session | — | `{ ok: true, sessionId }` | 200, 404 |
| POST | `/api/sessions/[id]/send` | Send message to agent | `{ message: string }` (max 10K chars, control chars stripped) | `{ ok: true, sessionId, message }` | 200, 400 |
| POST | `/api/sessions/[id]/message` | Send message (alternate path) | `{ message: string }` | `{ ok: true }` | 200, 400 |
| GET | `/api/sessions/[id]/issue` | Get linked issue | — | `{ title, description, state, labels, url }` | 200, 404 |

### DashboardSession Type (from `packages/web/src/lib/types.ts`)
```typescript
interface DashboardSession {
  id: string;
  projectId: string;
  status: SessionStatus;       // "spawning"|"working"|"pr_open"|"ci_failed"|"review_pending"|
                                // "changes_requested"|"approved"|"mergeable"|"merged"|"needs_input"|
                                // "stuck"|"errored"|"killed"|"terminated"|"done"|"cleanup"|"blocked"|"paused"
  activity: ActivityState | null; // "active"|"ready"|"idle"|"waiting_input"|"blocked"|"exited" | null
  branch: string | null;
  issueId: string | null;
  issueUrl: string | null;
  issueLabel: string | null;   // e.g. "INT-1327", "#42"
  issueTitle: string | null;
  summary: string | null;
  summaryIsFallback: boolean;
  createdAt: string;
  lastActivityAt: string;
  pr: DashboardPR | null;
  metadata: Record<string, string>;
}
```

### AttentionLevel (computed per-session for Kanban grouping)
```typescript
type AttentionLevel = "merge" | "respond" | "review" | "pending" | "working" | "done";
```

## Spawn (1 route)

| Method | Path | Description | Request | Response | Status |
|--------|------|-------------|---------|----------|--------|
| POST | `/api/spawn` | Spawn new session | `{ projectId: string, issueId?: string }` — both validated via `validateIdentifier` (alphanumeric, hyphens, underscores) | `{ session: DashboardSession }` | 201, 400, 500 |

## Real-time & Events (1 route)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/events` | SSE stream | `text/event-stream` — sends `type: "snapshot"` (sessions) every 5s, `type: "workflow-change"` on file changes, heartbeat every 15s |

### SSE Response Headers
`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`

## Audit Trail (2 routes)

| Method | Path | Description | Request | Response | Status |
|--------|------|-------------|---------|----------|--------|
| GET | `/api/audit/events` | Query audit events | `?page=1&limit=50&type=&storyId=&agentId=&search=&since=` | `{ events: AuditEvent[], total: number }` | 200 |
| GET | `/api/audit/events/export` | Export events | Same query params | JSONL blob (download) | 200 |

## Agent Management (4 routes)

| Method | Path | Description | Response | Status |
|--------|------|-------------|----------|--------|
| GET | `/api/agent/[id]` | Agent session detail | `DashboardSession` | 200, 404 |
| GET | `/api/agent/[id]/activity` | Agent activity timeline | `{ events: ActivityEvent[] }` | 200 |
| GET | `/api/agent/[id]/logs` | Agent session logs | `{ lines: string[] }` | 200 |
| POST | `/api/agent/[id]/resume` | Resume blocked agent | `{ ok: true }` | 200, 404 |

## PR Operations (1 route)

| Method | Path | Description | Response | Status |
|--------|------|-------------|----------|--------|
| POST | `/api/prs/[id]/merge` | Merge PR | `{ success: true }` | 200, 500 |

## Dead Letter Queue (2 routes)

| Method | Path | Description | Request | Response | Status |
|--------|------|-------------|---------|----------|--------|
| GET | `/api/dlq` | List DLQ entries | `?format=stats\|entries\|all` | `{ stats: DLQStats, entries?: DLQEntry[] }` | 200 |
| POST | `/api/dlq/[errorId]/retry` | Retry failed operation | — | `{ replayed: DLQEntry }` | 200, 404 |

## Conflict Management (2 routes)

| Method | Path | Description | Response | Status |
|--------|------|-------------|----------|--------|
| GET | `/api/conflicts` | List conflicts | `{ conflicts: Conflict[] }` | 200 |
| PUT | `/api/conflicts/[conflictId]` | Resolve conflict | `{ resolved: true }` | 200, 404 |

## Workflow Dashboard (2 routes)

| Method | Path | Description | Response | Status |
|--------|------|-------------|----------|--------|
| GET | `/api/workflow/[project]` | Workflow state (BMAD) | `{ projectId, hasBmad, phases: Phase[], agents: AgentInfo[], recommendation, artifacts: Artifact[], lastActivity }` — always 200 (LKG fallback) | 200 |
| GET | `/api/workflow/health-metrics` | Workflow health | Health metrics object | 200 |

## AI Intelligence (2 routes)

| Method | Path | Description | Response | Status |
|--------|------|-------------|----------|--------|
| GET | `/api/learning` | Learning insights | `{ totalSessions, successRate, topPatterns, recentLearnings }` | 200 |
| GET | `/api/health` | System health | `{ overall: string, components: { name, status, latencyMs, message }[] }` — always 200 (WD-FR31) | 200 |

## Sprint Analytics (31 routes)

All under `/api/sprint/[project]/...`. The `[project]` param is the project ID from config.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sprint/[project]` | Sprint board state (stories by status column) |
| GET | `.../summary` | Sprint summary statistics |
| GET | `.../issues` | Issue list |
| GET | `.../epics` | Epic management |
| GET | `.../goals` | Sprint goals |
| GET | `.../velocity` | Velocity chart data |
| GET | `.../velocity-comparison` | Sprint-over-sprint velocity |
| GET | `.../throughput` | Throughput metrics |
| GET | `.../metrics` | Cycle time metrics |
| GET | `.../cfd` | Cumulative flow diagram |
| GET | `.../forecast` | Sprint forecasting |
| GET | `.../monte-carlo` | Monte Carlo simulation |
| GET | `.../health` | Sprint health score |
| GET | `.../aging` | Story aging heatmap |
| GET | `.../wip` | Work-in-progress limits |
| GET | `.../workload` | Workload distribution |
| GET | `.../dependencies` | Dependency graph |
| GET | `.../dependency-cycles` | Circular dependency detection |
| GET | `.../conflicts` | Sprint conflicts |
| GET | `.../comparison` | Sprint-over-sprint comparison |
| GET | `.../history` | Sprint history |
| GET | `.../rework` | Rework tracking |
| GET | `.../retro` | Retrospective data |
| GET | `.../standup` | Standup report |
| GET | `.../notifications` | Sprint notifications |
| GET | `.../plan` | Sprint plan |
| GET | `.../config` | Sprint configuration |
| GET | `.../story/[id]` | Story detail |
| POST | `.../story/create` | Create new story |
| POST | `.../ceremony/start` | Start sprint |
| POST | `.../ceremony/end` | End sprint |

## Error Response Format

All errors return: `{ error: string }` with HTTP status:
- **400** — Invalid input (missing fields, bad format, validation failure)
- **404** — Resource not found (session, agent, conflict)
- **500** — Internal server error (service failure, unexpected exception)

## Authentication

No authentication layer — designed for local development use. All endpoints are unauthenticated.
