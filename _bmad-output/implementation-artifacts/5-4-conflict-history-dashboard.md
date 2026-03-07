# Story 5.4: Conflict History Dashboard

Status: ready-for-dev

## Story

As a Product Manager,
I want to view conflict history and resolution patterns,
so that I can identify systemic issues causing conflicts.

## Acceptance Criteria

1. **Given** conflicts have occurred
   - View conflict history on dashboard
   - Show: conflict ID, stories, agents, resolution, timestamp
   - Sort by recency or frequency

2. **Given** I view conflict details
   - Full context: agents involved, priority scores
   - Resolution taken (manual/auto)
   - Related events

3. **Given** I want to export conflict data
   - CSV/JSON export
   - For analysis and reporting

## Tasks / Subtasks

- [ ] Conflict history API endpoint
- [ ] Dashboard component for history
- [ ] Conflict detail view
- [ ] Export functionality
- [ ] Write unit tests

## Dev Notes

### Dashboard Page: `/conflicts`

```typescript
// packages/web/app/conflicts/page.tsx
export default function ConflictsPage() {
  const conflicts = useConflicts();

  return (
    <div>
      <h1>Conflict History</h1>
      <ConflictHistoryTable conflicts={conflicts} />
    </div>
  );
}
```

### Dependencies

- Story 3.3 (Web Dashboard) - Page infrastructure
- Story 5.1/5.2/5.3 - Conflict data sources

## Dev Agent Record

_(To be filled by Dev Agent)_
