# Story 2.1.9: Enhanced Sync Strategies

Status: done

## Story

As a Developer,
I want enhanced conflict resolution strategies beyond "last write wins",
so that concurrent edits can be merged intelligently instead of lost.

## Acceptance Criteria

1. **Given** concurrent YAML edits occur
   - Three-way merge strategy implemented
   - Operational transformation (OT) considered for sync
   - CRDTs (Conflict-free Replicated Data Types) evaluated
   - Merge strategies beyond "last write wins" available

2. **Given** conflict resolution is enhanced
   - Interactive merge with field-by-field prompts
   - Automatic merge for non-conflicting changes
   - Merge conflict markers for human resolution
   - Merge history tracked for analysis

3. **Given** sync strategies are researched
   - Operational transformation (OT) research documented
   - CRDT options evaluated
   - Three-way merge implementation completed
   - Performance implications documented

4. **Given** bidirectional sync is improved
   - Sync directionality configurable (push vs pull vs bidirectional)
   - Merge conflict resolution needs human judgment
   - Timestamp-based conflict resolution improved
   - "Last write wins" acceptable for current scale but not ideal

## Tasks / Subtasks

- [x] Research enhanced sync strategies
  - [x] Research operational transformation (OT) for sync
  - [x] Consider CRDTs for conflict-free replication
  - [x] Evaluate three-way merge for YAML
  - [x] Document trade-offs of each approach
- [x] Implement three-way merge for YAML
  - [x] Create three-way merge utility
  - [x] Detect merge conflicts at field level
  - [x] Automatic merge for non-conflicting changes
  - [x] Interactive merge prompts for conflicts
- [x] Implement merge conflict resolution
  - [x] Field-by-field merge prompts
  - [x] Merge conflict markers for human resolution
  - [x] Merge history tracking
  - [x] Merge conflict analytics
- [x] Evaluate OT and CRDT approaches
  - [x] Research OT libraries for Node.js
  - [x] Research CRDT libraries (Yjs, Automerge)
  - [x] Prototype OT/CRDT if feasible
  - [x] Document performance implications
- [x] Document sync strategies
  - [x] Document three-way merge approach
  - [x] Document OT/CRDT research findings
  - [x] Document trade-offs and recommendations
  - [x] Add troubleshooting guide for sync issues
- [x] Write tests for enhanced sync
  - [x] Test three-way merge scenarios
  - [x] Test automatic merge behavior
  - [x] Test conflict resolution prompts
  - [x] Test merge history tracking

## Dev Notes

### Epic 2 Retrospective Context (ACTION-9)

**Critical Issue Found:**
- Bidirectional sync is challenging
- Timestamp-based conflict resolution simple but flawed
- "Last write wins" acceptable for current scale
- Merge conflict resolution needs human judgment
- Sync directionality matters (push vs pull vs bidirectional)

**Root Cause:**
- Conflict resolution focused on detection, not resolution
- Simple "last write wins" for timestamp conflicts
- No three-way merge for concurrent edits
- No operational transformation or CRDT for complex sync

**Impact:**
- Concurrent edits may result in data loss
- Human judgment required for merge conflicts
- Sync directionality not configurable
- "Last write wins" not ideal for collaboration

**Prevention:**
- Research operational transformation (OT) for sync
- Consider CRDTs for conflict-free replication
- Evaluate merge strategies beyond "last write wins"
- Implement three-way merge for conflicts

**Epic 5 Context:**
- Originally deferred to Epic 5 (Conflict Resolution epic)
- Now prioritized as Epic 2.1 technical debt

### Technical Requirements

**Sync Strategy Comparison:**

| Strategy | Complexity | Performance | Collaboration | Implementation |
|----------|-----------|-------------|---------------|----------------|
| Last Write Wins | Low | Fast | Poor | ✅ Implemented |
| Three-Way Merge | Medium | Medium | Good | ⚠️ This story |
| Operational Transformation | High | Medium | Excellent | Future |
| CRDT (Yjs/Automerge) | High | Slow | Excellent | Future |

**Three-Way Merge for YAML:**
```typescript
// packages/core/src/utils/yaml-merge.ts

export interface MergeResult {
  success: boolean;
  merged?: any;          // Merged YAML object
  conflicts?: Conflict[]; // List of conflicts
}

export interface Conflict {
  path: string;          // YAML path (e.g., "stories.story-001.status")
  ours: any;             // Our version
  theirs: any;           // Their version
  base: any;             // Common ancestor version
}

export class YamlMerger {
  async threeWayMerge(
    base: any,    // Common ancestor (previous state)
    ours: any,    // Our changes (current state)
    theirs: any   // Their changes (external YAML)
  ): Promise<MergeResult> {
    const conflicts: Conflict[] = [];
    const merged = { ...base };

    // Detect conflicts at field level
    for (const [key, value] of Object.entries(ours)) {
      if (key in theirs) {
        if (JSON.stringify(value) !== JSON.stringify(theirs[key])) {
          // Both modified same field → conflict
          conflicts.push({
            path: key,
            ours: value,
            theirs: theirs[key],
            base: base[key]
          });
        } else {
          // Both modified to same value → safe to merge
          merged[key] = value;
        }
      } else {
        // Only we modified → safe to merge
        merged[key] = value;
      }
    }

    // Add fields only they modified
    for (const [key, value] of Object.entries(theirs)) {
      if (!(key in ours)) {
        merged[key] = value;
      }
    }

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    return { success: true, merged };
  }

  async interactiveResolve(conflicts: Conflict[]): Promise<any> {
    const resolved: any = {};

    for (const conflict of conflicts) {
      // Prompt user for resolution
      console.log(`\n❌ Conflict at: ${conflict.path}`);
      console.log(`  Base: ${JSON.stringify(conflict.base)}`);
      console.log(`  Ours: ${JSON.stringify(conflict.ours)}`);
      console.log(`  Theirs: ${JSON.stringify(conflict.theirs)}`);

      const choice = await prompt('Choose [o]urs, [t]heirs, [b]ase, or [m]erge: ');

      switch (choice) {
        case 'o':
          resolved[conflict.path] = conflict.ours;
          break;
        case 't':
          resolved[conflict.path] = conflict.theirs;
          break;
        case 'b':
          resolved[conflict.path] = conflict.base;
          break;
        case 'm':
          // Manual merge - prompt for value
          const manual = await prompt('Enter merged value: ');
          resolved[conflict.path] = JSON.parse(manual);
          break;
      }
    }

    return resolved;
  }
}
```

**Operational Transformation (OT) Research:**
- Libraries: `ot-text`, `share/lib`
- Complexity: High - requires transformation functions for each operation
- Use case: Real-time collaborative editing (like Google Docs)
- Recommendation: Overkill for YAML sync, better for text editing

**CRDT Options:**
- **Yjs**: Popular CRDT framework, JSON support, good for real-time collaboration
- **Automerge**: JSON-native CRDT, good for document collaboration
- Complexity: High - requires significant architectural changes
- Use case: Real-time collaborative editing with automatic conflict resolution
- Recommendation: Future consideration for real-time collaboration features

**Sync Directionality Configuration:**
```yaml
# agent-orchestrator.yaml
sync:
  mode: bidirectional  # push, pull, or bidirectional
  mergeStrategy: three-way  # last-write-wins, three-way, or interactive
  conflictResolution:
    automatic: false  # Auto-resolve non-conflicting changes
    promptOnConflict: true  # Prompt user for conflict resolution
```

### Architecture Compliance

**From architecture.md (Decision 2: State Management):**
- Bidirectional sync via file watcher (fs.watch())
- Optimistic locking with version stamps
- Three resolution strategies: overwrite, retry, merge
- Interactive merge with field-by-field prompts

**Enhanced Sync Strategies:**
- Three-way merge as default merge strategy
- Configurable sync directionality
- Interactive conflict resolution
- OT/CRDT for future real-time collaboration

### File Structure Requirements

**New Files to Create:**
```
packages/core/src/
├── utils/
│   └── yaml-merge.ts            # Three-way merge utility
├── services/
│   └── sync-manager.ts          # Enhanced sync manager
└── __tests__/
    ├── yaml-merge.test.ts       # Merge tests
    └── sync-manager.test.ts     # Sync tests

.bmad/docs/
└── SYNC_STRATEGIES_RESEARCH.md  # OT/CRDT research findings
```

### Library/Framework Requirements

**Dependencies for Enhanced Sync:**
- No new dependencies required for three-way merge
- Future OT/CRDT: Consider `yjs` or `automerge` if needed

### Testing Standards

**Test Coverage Goals:**
- Test three-way merge scenarios
- Test automatic merge behavior
- Test conflict resolution prompts
- Test merge history tracking
- Test sync directionality (push/pull/bidirectional)

**Test Quality Standards:**
- Test with concurrent edit scenarios
- Test conflict detection at field level
- Test interactive resolution flow
- Test merge conflict markers

**Three-Way Merge Test Example:**
```typescript
it('merges non-conflicting changes', async () => {
  const base = { story1: { status: 'backlog' }, story2: { status: 'backlog' } };
  const ours = { story1: { status: 'in-progress' }, story2: { status: 'backlog' } };
  const theirs = { story1: { status: 'backlog' }, story2: { status: 'in-progress' } };

  const result = await merger.threeWayMerge(base, ours, theirs);

  expect(result.success).toBe(true);
  expect(result.merged.story1.status).toBe('in-progress');
  expect(result.merged.story2.status).toBe('in-progress');
});

it('detects conflicting changes', async () => {
  const base = { story1: { status: 'backlog' } };
  const ours = { story1: { status: 'in-progress' } };
  const theirs = { story1: { status: 'blocked' } };

  const result = await merger.threeWayMerge(base, ours, theirs);

  expect(result.success).toBe(false);
  expect(result.conflicts).toHaveLength(1);
  expect(result.conflicts![0].path).toBe('story1.status');
});
```

### Project Structure Notes

**Alignment with Unified Project Structure:**
- Add to existing `packages/core/src/utils/` structure
- Enhance existing sync functionality
- Follow existing test patterns

**Detected Conflicts or Variances:**
- None detected — this enhances existing sync implementation

### References

- [Source: _bmad-output/retrospectives/epic-2-retrospective.md] ACTION-9: Enhanced Sync Strategies
- [Source: _bmad-output/implementation-artifacts/2-7-conflict-resolution-optimistic-locking.md] Current conflict resolution
- [Source: _bmad-output/implementation-artifacts/2-8-state-sync-to-bmad-tracker.md] Bidirectional sync implementation
- [Source: _bmad-output/planning-artifacts/architecture.md] Decision 2: State Management Strategy
- [Source: https://yjs.dev/] Yjs CRDT framework
- [Source: https://automerge.org/] Automerge CRDT library

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — implementation completed without major issues.

### Completion Notes List

1. ✅ Implemented three-way merge for YAML conflicts with field-level detection
2. ✅ Researched OT and CRDT approaches (documented in SYNC_STRATEGIES_RESEARCH.md)
3. ✅ Documented sync strategies and trade-offs
4. ✅ Interactive conflict resolution with merge prompts
5. ✅ Merge history tracking for analytics
6. ✅ **Code Review Fixes Applied**:
   - Fixed `deepEqual` to handle edge cases (NaN, Date, Map, Set, circular references)
   - Fixed `deepClone` to handle Date, Map, Set properly
   - Added `onConflict` callback option in `MergeOptions`
   - Added `mergeArrays` option with element-wise deep merge
   - Fixed async handling for `mergePrimitives`, `mergeArrays`, `mergeArrayElements`
   - Fixed deleted field handling (properly exclude keys from merged result)

### File List

**Created:**
- `packages/core/src/utils/yaml-merge.ts` - Three-way merge utility
- `packages/core/src/__tests__/yaml-merge.test.ts` - Merge tests
- `_bmad/docs/SYNC_STRATEGIES_RESEARCH.md` - OT/CRDT research findings

**Modified:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status
