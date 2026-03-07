# Story 3.6: Agent Session Cards with Activity History

Status: ready-for-dev

## Story

As a Developer,
I want to click on an agent card and see its detailed activity history,
so that I can understand what work the agent has done and troubleshoot issues.

## Acceptance Criteria

1. **Given** I click on an agent card
   **When** the detail modal opens
   **Then** the agent session card displays:
   - Agent ID, session name, assigned story
   - Current status, session duration, last activity
   **And** the modal is draggable and resizable

2. **Given** the session card is open
   **When** I scroll down
   **Then** the activity timeline is displayed:
   - Events in chronological order (newest first)
   - Timestamp, event type, description for each event
   - Color coding by event type
   - Last 50 events for the session

3. **Given** I want to view agent logs
   **When** I click "View Logs" button
   **Then** the modal expands to show recent log output
   - Last 100 lines from the agent session
   - Syntax highlighted for readability
   - Auto-scroll to latest logs

4. **Given** I want to attach to the agent session
   **When** I click "Attach" button
   **Then** the modal shows tmux attach command
   - Copy-able command: `tmux attach-session -t ao-story-001`
   - Button to execute directly if supported

5. **Given** the agent is blocked
   **When** I view the session card
   **Then** the blocked status is highlighted in red
   - Blockage reason is displayed
   - "Resume" button is shown

## Tasks / Subtasks

- [ ] Create AgentSessionCard modal component
  - [ ] Draggable and resizable modal
  - [ ] Agent header with status, duration, activity
  - [ ] Activity timeline with color-coded events
  - [ ] Log viewer with syntax highlighting
- [ ] Implement activity timeline
  - [ ] Fetch from /api/agent/{id}/activity
  - [ ] Display last 50 events
  - [ ] Color coding by event type
  - [ ] Newest first ordering
- [ ] Implement log viewer
  - [ ] Fetch from /api/agent/{id}/logs
  - [ ] Display last 100 lines
  - [ ] Syntax highlighting ( Prism.js or highlight.js )
  - [ ] Auto-scroll toggle
- [ ] Implement attach functionality
  - [ ] Show tmux attach command
  - [ ] Copy to clipboard button
  - [ ] Execute button (if supported)
- [ ] Implement resume action
  - [ ] Resume button for blocked agents
  - [ ] Opens resume modal
  - [ ] Triggers ao resume command
- [ ] Write unit tests
  - [ ] Test modal rendering
  - [ ] Test activity timeline
  - [ ] Test log viewer
  - [ ] Test attach command display

## Dev Notes

### Component Structure

```typescript
// packages/web/components/AgentSessionCard.tsx
"use client";

import { useState } from "react";

export function AgentSessionCard({ agentId }: { agentId: string }) {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <AgentHeader agentId={agentId} />
        <ActivityTimeline events={activity} />
        {showLogs && <LogViewer logs={logs} />}
        <Actions agentId={agentId} onAttach={handleAttach} onResume={handleResume} />
      </div>
    </div>
  );
}
```

### Dependencies

- Story 3.3 (Web Dashboard) - Modal infrastructure
- /api/agent/{id}/activity - Activity data
- /api/agent/{id}/logs - Log data

## Dev Agent Record

_(To be filled by Dev Agent)_
