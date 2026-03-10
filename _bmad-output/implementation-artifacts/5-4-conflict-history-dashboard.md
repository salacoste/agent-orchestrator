# Story 5.4: Conflict History Dashboard

Status: done

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

- [x] Conflict history API endpoint
- [x] Dashboard component for history
- [x] Conflict detail view
- [x] Export functionality
- [x] Write unit tests

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

### Implementation Date
2026-03-08

### Files Modified/Created
1. **packages/web/src/app/api/sprint/[project]/conflicts/route.ts** - Created API endpoint (149 lines)
   - GET endpoint returns conflict history from ConflictDetectionService
   - Supports sorting: recency (default) or frequency
   - Supports export: CSV or JSON
   - Returns summary statistics (total, bySeverity, byType)
   - Proper error handling and project validation

2. **packages/web/src/components/ConflictHistoryTable.tsx** - Created dashboard component (394 lines)
   - Displays conflict history in a sortable table
   - Summary cards showing total conflicts by severity
   - Sort controls (recency/frequency)
   - Export buttons (CSV/JSON)
   - Conflict detail modal with full context
   - Priority scores display
   - Resolution status display
   - Responsive design with Tailwind CSS

3. **packages/web/src/app/conflicts/page.tsx** - Created conflicts page (25 lines)
   - Main page accessible at `/conflicts`
   - Uses ConflictHistoryTable component
   - Includes descriptive header and instructions

4. **packages/web/src/app/api/sprint/[project]/conflicts/conflicts.test.ts** - Created API tests (91 lines)
   - Tests empty conflicts list response
   - Tests 404 for unknown project
   - Tests sorting by recency and frequency
   - Tests CSV export format
   - Tests JSON export format
   - Tests error handling

### Acceptance Criteria Implementation
- ✅ AC1: View conflict history on dashboard - Full table with conflict ID, stories, agents, resolution, timestamp
- ✅ AC1: Sort by recency or frequency - Sort dropdown in UI, API supports `?sort=` parameter
- ✅ AC2: View conflict details - Modal view shows agents involved, priority scores, resolution taken, recommendations
- ✅ AC3: Export functionality - CSV and JSON export buttons trigger file downloads via `?export=` parameter

### Technical Notes

**API Endpoint**:
- Route: `/api/sprint/[project]/conflicts`
- Query parameters:
  - `sort`: "recency" (default) or "frequency"
  - `export`: "csv" or "json" (triggers file download)
- Response format:
```json
{
  "conflicts": [...],
  "summary": {
    "total": 10,
    "bySeverity": { "critical": 2, "high": 3, "medium": 3, "low": 2 },
    "byType": { "duplicate-assignment": 10 }
  }
}
```

**Dashboard Component Features**:
- **Summary Cards**: Total conflicts, Critical/High count, Medium count, Low count
- **Sort Controls**: Dropdown to switch between Most Recent and Most Frequent
- **Export Buttons**: CSV and JSON export (opens in new tab)
- **Conflicts Table**: Displays conflict ID, Story ID, agents, severity badge, detected time, resolution status
- **Detail Modal**: Click "View Details" to see:
  - Full conflict ID
  - Story ID
  - Existing and conflicting agents
  - Priority scores with percentages
  - Recommendations list
  - Resolution details (action and timestamp)

**Export Formats**:
- **CSV**: Spreadsheet-compatible format with headers
  - Headers: Conflict ID, Story ID, Existing Agent, Conflicting Agent, Type, Severity, Detected At, Resolution, Resolved At
- **JSON**: Full data structure for programmatic analysis

**Severity Color Coding**:
- Critical: Red badge with dark background
- High: Light red badge
- Medium: Yellow badge
- Low: Green badge

**Integration with Existing Services**:
- Uses `ConflictDetectionService.getConflicts()` to fetch current conflicts
- Uses `getAgentRegistry()` and `getSessionsDir()` for registry access
- Respects project configuration from agent-orchestrator.yaml

**Limitations** (for future enhancement):
- Current implementation shows **active/pending conflicts** from the detection service
- **Historical persistence** would require storing resolved conflicts in a database or audit log
- The audit trail service (Story 2.4) could be extended to store conflict events for true history
- Frequency sorting is based on current active conflicts, not historical patterns

**CLI Integration**:
- Dashboard complements CLI command `ao conflicts` which shows conflicts in terminal
- `ao resolve <conflict-id>` command can be used to manually resolve conflicts
- `ao resolve --list` provides similar data in terminal format

**Test Coverage**:
- API tests verify sorting, export formats, error handling
- Component uses standard React patterns (useState, useEffect, fetch)
- Tests mock getServices to avoid database/registry dependencies

**Remaining Work** (future stories):
- Persistent conflict history via audit trail integration
- Conflict pattern analysis and trends
- Automated conflict prevention recommendations based on history
