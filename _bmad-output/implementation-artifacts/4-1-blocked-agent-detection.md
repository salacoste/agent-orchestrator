# Story 4.1: Blocked Agent Detection

Status: done

## Story

As a Developer,
I want the system to automatically detect when an agent becomes blocked,
so that I can be notified and intervene when needed.

## Acceptance Criteria

1. **Given** agent "ao-story-001" is active and working
   **When** the agent produces no activity (no events, no log output) for 10 minutes
   **Then** the system marks the agent as "blocked"
   **And** publishes a "agent.blocked" event
   **And** sends a desktop notification: "Agent ao-story-001 blocked (inactive for 10m)"

2. **Given** the blocked threshold is configured
   **When** I set agent.blockTimeout to 5 minutes in agent-orchestrator.yaml
   **Then** agents are marked as blocked after 5 minutes of inactivity
   **And** the configuration is validated at startup (min: 1m, max: 60m)

3. **Given** an agent is marked as blocked
   **When** I view the fleet status
   **Then** the agent card shows in the Blocked column
   **And** displays: "Blocked: No activity for 10m"
   **And** a "Resume" button is available

4. **Given** an agent was marked as blocked
   **When** the agent resumes activity (produces new events)
   **Then** the system automatically marks the agent as "active"
   **And** publishes an "agent.resumed" event

5. **Given** I want to configure different thresholds per agent type
   **When** I configure agent-type specific timeouts
   **Then** "claude-code" agents use 10m threshold
   **And** "codex" agents use 5m threshold
   **And** "aider" agents use 15m threshold

6. **Given** an agent is intentionally paused
   **When** I run `ao pause ao-story-001`
   **Then** the agent is marked as "paused" (not "blocked")
   **And** blocked detection is suspended

## Tasks / Subtasks

- [ ] Create BlockedAgentDetector service in @composio/ao-core
  - [ ] Track last activity timestamp per agent
  - [ ] Check for inactivity threshold (default: 10m)
  - [ ] Mark agent as blocked when threshold exceeded
  - [ ] Auto-resume when activity resumes
- [ ] Implement agent-type specific timeouts
  - [ ] Parse agent-type from agent name or config
  - [ ] Apply configured timeout per type
  - [ ] Validate timeout range (1m-60m)
- [ ] Implement pause functionality
  - [ ] CLI command `ao pause <agent-id>`
  - [ ] Mark agent as "paused"
  - [ ] Suspend blocked detection
- [ ] Integrate with EventBus from Story 2.1
  - [ ] Subscribe to agent events to track activity
  - [ ] Publish "agent.blocked" events
  - [ ] Publish "agent.resumed" events
- [ ] Integrate with NotificationService from Story 3.1
  - [ ] Send desktop notification on block
  - [ ] Include agent ID and inactivity duration
- [ ] Add comprehensive error handling
- [ ] Write unit tests

## Dev Notes

### Implementation

```typescript
// packages/core/src/blocked-agent-detector.ts
export class BlockedAgentDetector {
  private lastActivity: Map<string, Date> = new Map();
  private blockedAgents: Set<string> = new Set();
  private pausedAgents: Set<string> = new Set();

  trackActivity(agentId: string): void {
    this.lastActivity.set(agentId, new Date());

    // Auto-resume if was blocked
    if (this.blockedAgents.has(agentId)) {
      this.unblockAgent(agentId);
    }
  }

  checkBlocked(): void {
    const now = Date.now();
    const timeout = this.getTimeout(); // from config

    for (const [agentId, lastActivity] of this.lastActivity.entries()) {
      if (this.pausedAgents.has(agentId)) continue;

      const inactiveMs = now - lastActivity.getTime();
      if (inactiveMs > timeout) {
        this.blockAgent(agentId, inactiveMs);
      }
    }
  }

  private blockAgent(agentId: string, inactiveMs: number): void {
    this.blockedAgents.add(agentId);
    // Publish event, send notification
  }

  pause(agentId: string): void {
    this.pausedAgents.add(agentId);
  }
}
```

### Dependencies

- Story 2.1 (Redis Event Bus) - Activity tracking
- Story 3.1 (Notification Service) - Desktop notifications

## Dev Agent Record

_(To be filled by Dev Agent)_
