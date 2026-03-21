# Story 19.1: Dead Agent Detection

Status: done

## Story

As a **tech lead**,
I want the system to detect agents with no activity for a configurable threshold,
So that stuck agents are surfaced before they waste time.

## Acceptance Criteria

1. **AC1: Dashboard shows warning for inactive agents**
   - **Given** an agent has no output for `health.agentTimeoutMinutes` (default: 15)
   - **When** the health monitor checks
   - **Then** dashboard shows amber warning at threshold, red alert at 2x threshold
   - **And** configurable per-project in YAML

2. **AC2: Recovery actions offered**
   - **Given** a dead/stuck agent is detected
   - **When** displayed in dashboard
   - **Then** offers actions: "Ping", "Restart with context", "Reassign"

3. **AC3: Leverages existing BlockedAgentDetector**
   - **Given** the existing `BlockedAgentDetector` with per-agent timeout tracking
   - **When** the dead agent check runs
   - **Then** it uses existing `getAgentStatus()` and `checkBlocked()` APIs
   - **And** extends with dashboard notification via existing event system

## Tasks / Subtasks

- [ ] Task 1: Extend BlockedAgentDetector output with severity tiers (amber/red)
- [ ] Task 2: Add dashboard display for dead/stuck agents in AgentSessionCard
- [ ] Task 3: Write tests
- [ ] Task 4: Validate

## Dev Notes

### Existing foundation: BlockedAgentDetector already tracks per-agent inactivity
- `trackActivity(agentId)` updates timestamp
- `checkBlocked(agentId)` returns `BlockedAgentStatus` with `isBlocked`, `inactiveDuration`
- `startDetection()` runs periodic checks (60s interval)
- Publishes `agent.blocked` events
- Configurable per-agent-type timeouts

Story 19.1 adds: severity tiers (amber at 1x threshold, red at 2x) + dashboard display.

### Source Files
- `packages/core/src/blocked-agent-detector.ts` — extend with severity
- `packages/web/src/components/AgentSessionCard.tsx` — display dead agent warning

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
