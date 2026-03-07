# Story 3.7: Event Audit Trail Viewer

Status: ready-for-dev

## Story

As a Tech Lead,
I want to view and search the event audit trail from the dashboard,
so that I can troubleshoot issues and understand system behavior.

## Acceptance Criteria

1. **Given** I navigate to the Events page
   **When** the page loads
   **Then** a searchable event table is displayed:
   - Event ID, Type, Timestamp, Summary
   - Events ordered newest first
   - Pagination for 100 events per page

2. **Given** I want to filter events
   **When** I use the filter controls
   **Then** I can filter by:
   - Event type (dropdown)
   - Date range (date picker)
   - Story ID (text search)
   - Agent ID (text search)
   - Free-text search in event data

3. **Given** I click on an event ID
   **When** the event detail modal opens
   **Then** full event data is displayed:
   - All event metadata fields
   - Related story/agent links
   - Event hash for integrity
   - "View Source" button shows raw JSON

4. **Given** new events occur
   **When** the Events page is open
   **Then** a notification badge appears: "5 new events"
   **And** clicking refreshes the table with new events
   **Or** auto-refresh can be enabled (toggle)

5. **Given** I want to export events
   **When** I click "Export"
   **Then** a CSV or JSON download starts
   - With current filter applied
   - Up to 10,000 most recent events

## Tasks / Subtasks

- [ ] Create Events page in packages/web/app/events
  - [ ] Event table with pagination
  - [ ] Filter controls (type, date, story, agent)
  - [ ] Search input for free-text
  - [ ] Auto-refresh toggle
- [ ] Implement event detail modal
  - [ ] Full event metadata display
  - [ ] Related story/agent links
  - [ ] Raw JSON viewer
- [ ] Implement export functionality
  - [ ] Export filtered events
  - [ ] CSV or JSON format
  - [ ] Max 10,000 events
- [ ] Write unit tests

## Dev Notes

### API Endpoint

```typescript
// packages/web/app/api/events/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter");
  const since = searchParams.get("since");

  // Query audit trail from Story 2.4
  const events = await getAuditTrail().query({
    eventType: filter || undefined,
    since: since ? new Date(since) : undefined,
    last: 100,
  });

  return Response.json(events);
}
```

### Dependencies

- Story 2.4 (JSONL Audit Trail) - Event data source
- Story 3.3 (Web Dashboard) - Page infrastructure

## Dev Agent Record

_(To be filled by Dev Agent)_
