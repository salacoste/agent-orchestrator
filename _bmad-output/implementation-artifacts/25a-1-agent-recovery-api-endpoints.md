# Story 25a.1: Agent Recovery API Endpoints

Status: done

## Story
As a **tech lead**, I want `/api/agent/:id/ping`, `/restart`, `/reassign` endpoints, So that the recovery buttons in AgentSessionCard actually work.

## Acceptance Criteria
1. POST `/api/agent/:id/ping` — checks session liveness, returns status
2. POST `/api/agent/:id/restart` — kills session, returns confirmation for respawn
3. POST `/api/agent/:id/reassign` — kills agent, returns story to queue
4. All return 404 for unknown agents, 500 for errors

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6 (1M context)
### File List
- `packages/web/src/app/api/agent/[id]/ping/route.ts` — CREATED
- `packages/web/src/app/api/agent/[id]/restart/route.ts` — CREATED
- `packages/web/src/app/api/agent/[id]/reassign/route.ts` — CREATED
