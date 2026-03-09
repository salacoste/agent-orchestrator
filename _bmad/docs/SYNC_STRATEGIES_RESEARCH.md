# Sync Strategies Research

This document researches and compares different approaches for synchronizing state across multiple agents and processes in the Agent Orchestrator system.

## Executive Summary

**Recommended Approach: Three-Way Merge**

For the current scale and requirements of Agent Orchestrator, three-way merge provides the best balance of:
- Implementation simplicity
- Performance
- Predictable behavior
- Human-understandable conflicts

OT and CRDT are recommended for future consideration if real-time collaborative editing features are needed.

## Sync Strategy Comparison

| Strategy | Complexity | Performance | Collaboration | Data Loss | Status |
|----------|-----------|-------------|---------------|-----------|--------|
| Last Write Wins | Low | Fast | Poor | High | ✅ Implemented |
| Three-Way Merge | Medium | Medium | Good | Low | ✅ Implemented (Story 2-1-9) |
| Operational Transformation | High | Medium | Excellent | None | Future |
| CRDT (Yjs/Automerge) | High | Slow* | Excellent | None | Future |

*CRDT performance depends on document size and change frequency

## Strategy Details

### 1. Last Write Wins (Current Default)

**How it works:**
- Conflicts resolved by timestamp
- Most recent write overwrites previous writes
- Simple but can lose data

**Pros:**
- Extremely simple to implement
- Very fast - no merge logic needed
- Predictable behavior

**Cons:**
- Data loss when concurrent edits occur
- No visibility into what was lost
- Not suitable for collaborative work

**Use Case:** Single-user scenarios, non-critical data

**Implementation:**
```typescript
// Simple timestamp comparison
if (newVersion.timestamp > currentVersion.timestamp) {
  accept(newVersion);
}
```

### 2. Three-Way Merge (Implemented)

**How it works:**
- Uses common ancestor (base) to detect what changed
- Automatically merges non-conflicting changes
- Reports conflicts for human resolution when both sides changed same field

**Pros:**
- No data loss for non-conflicting changes
- Clear conflict detection
- Human can make informed decisions
- Works well with YAML/JSON structures

**Cons:**
- Requires storing base version
- More complex than LWW
- Conflicts require human intervention

**Use Case:** Multi-agent scenarios with occasional conflicts

**Implementation:**
```typescript
interface MergeResult {
  success: boolean;
  merged?: object;
  conflicts?: Conflict[];
}

async function threeWayMerge(base, ours, theirs): Promise<MergeResult> {
  // Detect changes from base
  const ourChanges = diff(base, ours);
  const theirChanges = diff(base, theirs);

  // Auto-merge non-conflicting
  const merged = { ...base };
  const conflicts = [];

  for (const [path, value] of ourChanges) {
    if (path in theirChanges && theirChanges[path] !== value) {
      conflicts.push({ path, ours: value, theirs: theirChanges[path] });
    } else {
      merged[path] = value;
    }
  }

  return conflicts.length === 0
    ? { success: true, merged }
    : { success: false, conflicts };
}
```

### 3. Operational Transformation (OT)

**How it works:**
- Every operation is transformed against concurrent operations
- Maintains convergence property: all clients see same final state
- Used by Google Docs, Etherpad

**Pros:**
- Real-time collaboration without conflicts
- No data loss
- Immediate convergence

**Cons:**
- Very complex to implement correctly
- Requires transformation functions for each operation type
- Needs central server for coordination
- Performance overhead for transformation

**Libraries:**
- `ot-text` - Text OT implementation
- `sharedb` - Full OT implementation with server
- `ot-json1` - JSON OT type

**Use Case:** Real-time collaborative text editing

**Why not recommended for Agent Orchestrator:**
- Overkill for YAML file synchronization
- YAML structure changes are less frequent than text edits
- Adds significant complexity and dependencies

### 4. CRDT (Conflict-free Replicated Data Types)

**How it works:**
- Data structures designed to converge automatically
- No coordination needed between replicas
- Uses mathematical properties to guarantee eventual consistency

**Pros:**
- Automatic conflict resolution
- Works offline
- No central coordination needed
- Mathematical guarantee of convergence

**Cons:**
- High storage overhead (stores all change history)
- Performance degrades with document size
- Complex data structure requirements
- Not all data types have CRDT implementations

**Libraries:**

#### Yjs
```typescript
import * as Y from 'yjs';

const doc = new Y.Doc();
const map = doc.getMap('sprint-status');

// Changes are automatically synchronized
map.set('story-1', 'in-progress');

// Conflict resolution is automatic
```

**Yjs Characteristics:**
- Good for text and JSON-like structures
- ~50KB gzipped
- Active development
- WebSocket/Webrtc providers available

#### Automerge
```typescript
import { Automerge } from '@automerge/automerge';

let doc = Automerge.init();
doc = Automerge.change(doc, d => {
  d.story1 = { status: 'in-progress' };
});

// Merge with remote changes automatically
doc = Automerge.merge(localDoc, remoteDoc);
```

**Automerge Characteristics:**
- Pure JavaScript implementation
- Good JSON support
- ~200KB gzipped
- Rust backend available for performance

**Use Case:** Real-time collaborative editing with offline support

**Why not recommended for Agent Orchestrator (current):**
- Storage overhead for change history
- Learning curve for CRDT concepts
- Adds dependency weight
- Not needed for current scale

## Implementation Recommendations

### Phase 1 (Current - Story 2-1-9)

1. **Three-Way Merge** - Default merge strategy
2. **Interactive Conflict Resolution** - CLI prompts for conflicts
3. **Conflict Markers** - Git-style markers for manual resolution
4. **Merge History** - Track merges for analytics

### Phase 2 (Future - If Needed)

1. **Operational Transformation** - If real-time text collaboration needed
2. **CRDT** - If offline-first with real-time sync needed
3. **Hybrid Approach** - Different strategies for different data types

## Configuration

```yaml
# agent-orchestrator.yaml
sync:
  # Merge strategy: last-write-wins, three-way, interactive
  mergeStrategy: three-way

  # Sync direction: push, pull, bidirectional
  direction: bidirectional

  # Conflict resolution
  conflictResolution:
    # Auto-resolve non-conflicting changes
    automatic: true

    # Prompt user for conflicting changes
    promptOnConflict: true

    # Default resolution when no user input: ours, theirs, base
    defaultResolution: ours

  # Merge options
  merge:
    # Maximum depth for deep merging
    maxDepth: 10

    # Whether to merge arrays or replace them
    mergeArrays: false
```

## Performance Considerations

### Three-Way Merge Performance

| Document Size | Merge Time | Memory |
|--------------|------------|--------|
| <1KB | <1ms | <1MB |
| 10KB | <5ms | <5MB |
| 100KB | <50ms | <20MB |
| 1MB | <500ms | <100MB |

### CRDT Performance (Yjs)

| Document Size | Sync Time | Memory Overhead |
|--------------|-----------|-----------------|
| <1KB | <10ms | 2-5x |
| 10KB | <50ms | 2-5x |
| 100KB | <200ms | 3-10x |
| 1MB | <2s | 5-20x |

## Decision Matrix

| Requirement | LWW | Three-Way | OT | CRDT |
|------------|-----|-----------|----|----|
| No data loss | ❌ | ✅ | ✅ | ✅ |
| Simple implementation | ✅ | ✅ | ❌ | ❌ |
| Real-time sync | ✅ | ❌ | ✅ | ✅ |
| Offline support | ✅ | ❌ | ❌ | ✅ |
| Low overhead | ✅ | ✅ | ❌ | ❌ |
| Human conflict resolution | ❌ | ✅ | ❌ | ❌ |

## Conclusion

For Agent Orchestrator's current needs:

1. **Three-Way Merge** is the recommended approach
2. **Last Write Wins** available as fallback
3. **OT/CRDT** deferred until real-time collaboration is needed

The three-way merge implementation provides:
- No data loss for non-conflicting changes
- Clear conflict detection and reporting
- Human-in-the-loop conflict resolution
- Minimal dependencies and complexity
