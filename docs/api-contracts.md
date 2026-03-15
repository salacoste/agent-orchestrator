# Agent Orchestrator — API Contracts

## Session Management

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/sessions | List sessions | ?active=true | { sessions: DashboardSession[], stats, orchestratorId } |
| GET | /api/sessions/[id] | Get session | — | DashboardSession |
| POST | /api/sessions/[id]/kill | Kill session | — | { success: true } |
| POST | /api/sessions/[id]/restore | Restore session | — | { success: true } |
| POST | /api/sessions/[id]/send | Send message | { message } | { success: true } |
| POST | /api/spawn | Spawn session | { projectId, issueId? } | { session }, 201 |

## Real-time & Events

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/events | SSE stream (sessions + workflow-change + heartbeat) |
| GET | /api/audit/events | Audit event log |
| POST | /api/audit/events/export | Export audit log |

## Workflow Dashboard (BMAD)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | /api/workflow/[project] | Workflow state | { projectId, hasBmad, phases[], agents[], recommendation, artifacts[], lastActivity } |
| GET | /api/workflow/health-metrics | Health status | Health metrics object |

## Sprint Analytics (30+ routes)

All under /api/sprint/[project]/...

- summary, issues, epics, goals, velocity, throughput, burndown, cfd, forecast
- monte-carlo, health, aging, wip, workload, dependencies, dependency-cycles
- conflicts, comparison, history, rework, retro, standup, notifications
- ceremony/start, ceremony/end, config, story/create, story/[id]

## Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/agent/[id] | Agent details |
| GET | /api/agent/[id]/activity | Agent activity state |
| GET | /api/prs/[id]/merge | Check merge eligibility |
| POST | /api/prs/[id]/merge | Merge PR |
| GET | /api/dlq | Dead letter queue |
| GET | /api/conflicts | List conflicts |

## Error Response Format

All errors: `{ error: string }` with HTTP status 400/404/500

## Authentication

No authentication layer currently — designed for local development use.
