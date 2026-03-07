# Story 3.8: Workflow Health Metrics Panel

Status: ready-for-dev

## Story

As a Product Manager,
I want to see workflow health metrics on the dashboard,
so that I can identify bottlenecks and process issues.

## Acceptance Criteria

1. **Given** I view the dashboard home page
   **When** the page loads
   **Then** a metrics panel is displayed showing:
   - Total stories, completed, in-progress, blocked
   - Agent utilization rate (active/total agents)
   - Average cycle time (time to complete a story)
   - Sprint burndown progress

2. **Given** I view the metrics panel
   **When** data is displayed
   **Then** each metric shows:
   - Current value
   - Target/threshold for comparison
   - Trend indicator (↑ improving, ↓ degrading)
   - Color coding (green=good, yellow=warning, red=bad)

3. **Given** cycle time is trending up
   **When** the trend is detected
   **Then** the indicator shows ↑ red
   - **And** hovering shows: "Cycle time increased 20% this sprint"

4. **Given** blocked story count exceeds threshold
   **When** >3 stories are blocked
   **Then** the blocked metric turns red
   **And** clicking shows list of blocked stories

5. **Given** I want to see historical trends
   **When** I click on a metric
   **Then** a sparkline chart shows last 7 days
   - **And** the current value is highlighted

## Tasks / Subtasks

- [ ] Create MetricsPanel component
  - [ ] Grid layout for 4 key metrics
  - [ ] Value, target, trend, color for each
  - [ ] Click to drill down
  - [ ] Sparkline on click
- [ ] Implement metric calculations
  - [ ] Story counts from sprint status
  - [ ] Agent utilization from agent registry
  - [ ] Cycle time from completed stories
  - [ ] Burndown progress
- [ ] Implement trend detection
  - [ ] Compare current vs previous sprint
  - [ ] Calculate % change
  - [ ] Show trend arrows
- [ ] Implement color coding
  - [ ] Green: within target
  - [ ] Yellow: 10% over target
  - [ ] Red: >20% over target
- [ ] Write unit tests

## Dev Notes

### Metrics Data

```typescript
interface WorkflowMetrics {
  stories: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  agents: {
    total: number;
    active: number;
    utilizationRate: number; // active/total
  };
  cycleTime: {
    average: number; // hours
    target: number;
    trend: "up" | "down" | "stable";
  };
  burndown: {
    remaining: number;
    total: number;
    progress: number; // percentage
  };
}
```

### Dependencies

- Story 3.3 (Web Dashboard) - Page container
- /api/sprint/metrics endpoint - Metrics data

## Dev Agent Record

_(To be filled by Dev Agent)_
