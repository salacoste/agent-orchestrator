# Story 19.3: Cascade Failure Circuit Breaker

Status: done

## Story

As a **tech lead**,
I want the system to auto-pause remaining agents when 3+ fail within 5 minutes,
So that systemic issues don't burn tokens.

## Acceptance Criteria

1. **AC1: Cascade detection**
   - **Given** 3+ agents fail within a 5-minute window
   - **When** the circuit breaker triggers
   - **Then** remaining agents are paused (not killed)
   - **And** dashboard shows "Cascade detected — running diagnostics..."

2. **AC2: Auto-diagnostic**
   - **Given** cascade is triggered
   - **When** diagnostics run
   - **Then** system checks: API connectivity, config validity, basic operations
   - **And** results displayed in dashboard

3. **AC3: Manual resume**
   - **Given** cascade pause is active
   - **When** user clicks "Resume All"
   - **Then** all paused agents resume

## Tasks / Subtasks

- [ ] Task 1: Extend CircuitBreakerManager with cascade detection logic
  - [ ] 1.1: Track agent failure timestamps (sliding 5-min window)
  - [ ] 1.2: Trigger cascade when count >= 3 in window
- [ ] Task 2: Implement auto-pause via BlockedAgentDetector.pause()
- [ ] Task 3: Add cascade status to dashboard
- [ ] Task 4: Add "Resume All" button
- [ ] Task 5: Write tests
- [ ] Task 6: Validate

## Dev Notes

### Leverages: CircuitBreakerManager (per-service breakers) + BlockedAgentDetector.pause()
Cascade detection is a new aggregate check across all agents, using existing per-agent pause mechanism.

### Source Files
- `packages/core/src/circuit-breaker-manager.ts` — extend with cascade logic
- `packages/core/src/blocked-agent-detector.ts` — pause/resume all agents
- `packages/web/src/components/WorkflowDashboard.tsx` — cascade banner + resume button

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
