# Story 3.5: Fleet Monitoring Matrix

Status: ready-for-dev

## Story

As a Tech Lead,
I want to view a fleet monitoring matrix showing all active agents,
so that I can assess overall system health at a glance.

## Acceptance Criteria

1. **Given** I navigate to the Fleet page
   **When** the page loads
   **Then** a 3-column grid layout is displayed:
   - Column 1: Active agents (🟢)
   - Column 2: Idle agents (🟡)
   - Column 3: Blocked/Failed agents (🔴)
   **And** each agent is displayed as a card with:
   - Agent ID, Story ID and title, Status indicator, Time since last activity

2. **Given** an agent transitions from active to idle
   **When** the "agent.status_changed" event is received
   **Then** the agent card moves from Active to Idle column with animation
   **And** the update completes within 3 seconds (NFR-P5)

3. **Given** an agent becomes blocked
   **When** the "story.blocked" event is received
   **Then** the agent card moves to Blocked column
   **And** the card shows the blockage reason
   **And** a "Resume" button is displayed

4. **Given** I click "Resume" on a blocked agent
   **When** the button is clicked
   **Then** a modal opens with story details and resume options
   **And** I can trigger `ao resume STORY-001` from the modal

5. **Given** I want to view agent details
   **When** I click on an agent card
   **Then** a drawer slides in showing:
   - Full story context
   - Recent activity log
   - Story progress (acceptance criteria status)
   - Links to `ao logs agent-id` and `ao status story-id`

6. **Given** no agents are running
   **When** the fleet page is viewed
   **Then** an empty state is displayed: "No active agents. Spawn agents with `ao spawn`"
   **And** a button to open spawn modal is shown

## Tasks / Subtasks

- [ ] Create FleetMonitoring component in packages/web
  - [ ] 3-column grid layout with CSS Grid
  - [ ] Agent cards with status colors
  - [ ] Animated transitions between columns
  - [ ] Responsive design for mobile
- [ ] Implement real-time agent status updates
  - [ ] Subscribe to agent.status_changed events
  - [ ] Update card positions within 3 seconds
  - [ ] Animate card movements smoothly
- [ ] Implement blocked agent actions
  - [ ] Resume button on blocked agent cards
  - [ ] Resume modal with story details
  - [ ] Trigger ao resume command
- [ ] Implement agent detail drawer
  - [ ] Slide-in drawer on card click
  - [ ] Show story context, activity log, progress
  - [ ] Links to CLI commands
- [ ] Implement empty state
  - [ ] Display when no agents active
  - [ ] Call-to-action to spawn agents
- [ ] Write unit tests
  - [ ] Test grid layout
  - [ ] Test agent card rendering
  - [ ] Test status transitions
  - [ ] Test empty state

## Dev Notes

### Component Structure

```typescript
// packages/web/app/fleet/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function FleetPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    // Subscribe to agent status changes
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.eventType === "agent.status_changed") {
        updateAgentStatus(data.metadata);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      <AgentColumn title="Active" agents={agents.filter(a => a.status === "active")} color="green" />
      <AgentColumn title="Idle" agents={agents.filter(a => a.status === "idle")} color="yellow" />
      <AgentColumn title="Blocked" agents={agents.filter(a => a.status === "blocked")} color="red" />
    </div>
  );
}
```

### Dependencies

- Story 3.3 (Web Dashboard) - Page container
- /api/fleet/status endpoint - Agent data

### Performance

- **NFR-P5:** Agent status updates within 3 seconds

## Dev Agent Record

_(To be filled by Dev Agent)_
