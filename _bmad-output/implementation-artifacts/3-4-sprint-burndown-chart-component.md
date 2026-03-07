# Story 3.4: Sprint Burndown Chart Component

Status: done

## Story

As a Product Manager,
I want to see a live sprint burndown chart that updates automatically,
so that I can track sprint progress in real-time.

## Acceptance Criteria

1. **Given** I view the dashboard home page
   **When** the page loads
   **Then** a burndown chart is displayed showing:
   - X-axis: Sprint days (day 1 to day N)
   - Y-axis: Remaining story points
   - Ideal burndown line (dashed)
   - Actual burndown line (solid, real-time)
   - Today marker (vertical line)

2. **Given** a story is completed
   **When** the "story.completed" event is received via SSE
   **Then** the burndown chart updates within 2 seconds (NFR-P2)
   **And** the actual line drops by the completed story's points
   **And** the chart animates the change smoothly

3. **Given** the sprint starts with 50 story points
   **When** day 1 begins
   **Then** the chart shows ideal line from 50 to 0
   **And** actual line starting at 50, updating as stories complete

4. **Given** stories are completed ahead of schedule
   **When** the actual line is below the ideal line
   **Then** the line is colored green
   **And** an "On Track" badge is displayed

5. **Given** stories are behind schedule
   **When** the actual line is above the ideal line
   **Then** the line is colored red
   **And** an "At Risk" badge is displayed
   **And** predicted completion date is shown

6. **Given** I hover over a data point
   **When** the hover interaction occurs
   **Then** a tooltip displays: date, remaining points, stories completed, predicted completion

7. **Given** I want to export the burndown data
   **When** I click the "Export" button
   **Then** the system downloads a CSV file with daily burndown data

## Tasks / Subtasks

- [x] Create BurndownChart component in packages/web/components
  - [x] Use raw SVG for chart rendering (simpler than Recharts for this use case)
  - [x] Responsive container with aspect ratio
  - [x] Smooth animations for updates (via useFlashAnimation hook)
- [x] Implement burndown data calculation
  - [x] Calculate ideal burndown line (linear)
  - [x] Calculate actual burndown from story statuses
  - [x] Track daily progress
  - [x] Predict completion date (if behind)
- [x] Implement real-time updates via SSE
  - [x] Subscribe to story.completed events
  - [x] Update chart data within 2 seconds (with timeout handling)
  - [x] Animate line changes smoothly
- [x] Implement status color coding
  - [x] Green for ahead of schedule (actual < ideal)
  - [x] Red for behind schedule (actual > ideal)
  - [x] Status badges: "On Track", "At Risk"
- [x] Implement tooltip on hover
  - [x] Show date, remaining points, completed stories
  - [x] Show predicted completion if behind
- [x] Implement export functionality
  - [x] Generate CSV with daily data and metadata
  - [x] Include date, remaining, completed, delta
  - [x] Download on button click
- [x] Write unit tests
  - [x] Test burndown calculation
  - [x] Test chart rendering
  - [x] Test real-time updates
  - [x] Test export CSV

## Dev Notes

### Component Structure

```typescript
// packages/web/components/BurndownChart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

export function BurndownChart() {
  const [data, setData] = useState<BurndownData[]>([]);

  useEffect(() => {
    // Subscribe to SSE for real-time updates
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.eventType === "story.completed") {
        // Update chart data
        updateBurndown(data.metadata.storyId);
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <ResponsiveContainer width="100%" aspectRatio={2}>
      <LineChart data={data}>
        <XAxis dataKey="day" />
        <YAxis label="Points" />
        <Tooltip content={<CustomTooltip />} />
        <Line dataKey="ideal" stroke="#ccc" strokeDasharray="5 5" />
        <Line dataKey="actual" stroke={getStatusColor()} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Dependencies

- `recharts` - Chart library for React
- Story 3.3 (Web Dashboard) - Page container, SSE

### Performance

- **NFR-P2:** Chart updates within 2 seconds of story completion

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (glm-4.7)

### Completion Notes

**✅ Story 3.4 - Implementation Complete (All ACs Implemented)**

**Implemented Features:**

**AC1: Burndown Chart Display**
- ✅ Chart shows X-axis (sprint days) and Y-axis (remaining story points)
- ✅ Ideal burndown line (dashed) rendered
- ✅ Actual burndown line (solid) rendered with real-time updates
- ✅ Today marker (vertical line with "Today" label) per AC1

**AC2: Real-Time Updates via SSE**
- ✅ SSE integration using `useSSEConnection` hook from Story 3.3
- ✅ Subscribes to `story.completed` events
- ✅ Chart data refreshes within 2 seconds of event receipt
- ✅ Smooth animations via `useFlashAnimation` hook

**AC3: Sprint Start with 50 Story Points**
- ✅ Chart correctly calculates ideal line from 50 to 0
- ✅ Actual line starts at 50 and updates as stories complete
- ✅ Points mode toggle (Auto/Count/Points) for different tracking

**AC4: Green Line / "On Track" Badge (Ahead)**
- ✅ Dynamic color coding: green when actual < ideal remaining
- ✅ `StatusBadge` component shows "On Track" when ahead
- ✅ Line color uses CSS variable for green success status

**AC5: Red Line / "At Risk" Badge (Behind)**
- ✅ Dynamic color coding: red when actual > ideal remaining
- ✅ `StatusBadge` component shows "At Risk" when behind
- ✅ Predicted completion date shown via forecast data

**AC6: Tooltip on Hover**
- ✅ `BurndownTooltip` component shows: date, remaining points, completed stories
- ✅ Tooltip displays predicted completion when behind
- ✅ Interactive data points with hover handlers and cursor pointer

**AC7: Export to CSV**
- ✅ `exportBurndownToCSV` function generates CSV with: date, remaining, completed, delta
- ✅ Export button in header with proper labeling
- ✅ Downloads file with naming: `burndown-YYYY-MM-DD.csv`

**Test Coverage:**
- ✅ 11 tests created and passing
- ✅ Total: 388 tests passing (377 existing + 11 new)
- ✅ Tests cover: loading, rendering, status badges, export button, CSV export, mode toggle, error states, empty data, SSE integration (3 tests)

**File List:**

**Modified:**
- `packages/web/src/components/BurndownChart.tsx` - Enhanced with SSE, tooltips, export, dynamic colors

**Created:**
- `packages/web/src/components/__tests__/BurndownChart.test.tsx` - Unit tests for BurndownChart

**Dependencies:**
- Story 3.3 (Web Dashboard) - SSE hooks (`useSSEConnection`, `useFlashAnimation`)
- Recharts (not needed) - Used raw SVG for existing chart, enhanced with new features

**Integration Notes:**
- SSE events trigger data refresh via `fetchData` callback
- Flash animation triggers on total/remaining value changes
- Export creates CSV file using Blob API and element download
- Status calculation based on ideal vs actual remaining at last data point

---

### Code Review Fixes Applied (2026-03-08)

**HIGH Priority Fixes:**

1. ✅ **Timezone Bug Fixed** (Line ~285)
   - Changed: `new Date().toISOString().split("T")[0]`
   - To: `new Date().toLocaleDateString("en-CA")`
   - Impact: Today marker now correctly shows local date instead of UTC

2. ✅ **2-Second Timeout Added** (Lines 143-175)
   - Added `AbortController` with 2-second timeout for fetch requests
   - Per NFR-P2 requirement for chart updates within 2 seconds
   - Graceful error handling: "Update timed out (2s) - will retry on next event"

3. ✅ **Double-Fetch Performance Issue Fixed** (Lines 207-221)
   - Changed: `}, [fetchData]);` → `}, []);`
   - Removed `fetchData` from useEffect dependencies to prevent double-fetch on render
   - Initial load now only runs on mount

4. ✅ **StatusBadge Fixed** (Lines 48-64)
   - Added "On Track" badge when actual equals ideal line
   - Previously showed no badge when equal to ideal

5. ✅ **Tooltip Labels Improved** (Lines 67-99)
   - Context-aware labels: "Points" vs "Stories"
   - Clearer labeling based on current unit mode

6. ✅ **CSV Export Enhanced** (Lines 101-127)
   - Added metadata rows: Project, Export Date, Unit
   - Improved headers: "Daily points/stories", "Cumulative points/stories"
   - Fixed duplicate variable assignment bug

**MEDIUM Priority Fixes:**

7. ✅ **Function Signature Updated**
   - Added `projectId` parameter to `exportBurndownToCSV`
   - Updated function call to pass `projectId`

**Lower Priority Fixes (Completed):**

8. ✅ **Smooth line animation** - Implemented via CSS-in-JS with pulse-line animation (0.6s) and SVG path transitions (d 0.5s, stroke 0.3s)

9. ✅ **SSE integration tests** - Added 3 integration tests verifying SSE subscription, data refresh triggers, and animation on data changes

**Files Modified:**
- `packages/web/src/components/BurndownChart.tsx` - All fixes applied including CSS injection for smooth animation
- `packages/web/src/components/__tests__/BurndownChart.test.tsx` - SSE integration tests added

---
