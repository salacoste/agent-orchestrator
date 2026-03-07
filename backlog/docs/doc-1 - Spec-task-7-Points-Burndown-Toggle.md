---
id: doc-1
title: 'Spec: task-7 Points Burndown Toggle'
type: other
created_date: '2026-03-05 01:03'
---
# Implementation Spec: task-7 (F1) - Points-Based Burndown UI Toggle

## Overview
Add user-controllable toggle to BurndownChart allowing manual selection between count-based and points-based burndown views.

## Requirements

### Current Behavior
- Component auto-detects points mode when `data.hasPoints === true && data.totalPoints > 0`
- No user override option
- Line 163-167: `const usePoints = data.hasPoints === true && data.totalPoints !== undefined && data.totalPoints > 0;`

### Desired Behavior
- Three-mode toggle: Auto (default) | Count | Points
- Auto: Use current auto-detection logic
- Count: Force story count mode
- Points: Force points mode (only enabled when points data available)
- Toggle only visible when `data.hasPoints === true`

## Implementation

### File: `packages/web/src/components/BurndownChart.tsx`

#### 1. Add State (after line 76)
```typescript
const [pointsMode, setPointsMode] = useState<boolean | null>(null);
// null = auto, true = force points, false = force count
```

#### 2. Update Mode Logic (replace lines 163-167)
```typescript
const hasPointsData = data.hasPoints === true && data.totalPoints !== undefined && data.totalPoints > 0;
const usePoints = pointsMode ?? hasPointsData;
const total = usePoints ? (data.totalPoints ?? 0) : totalStories;
const unit = usePoints ? "pts" : "stories";
```

#### 3. Add UI Toggle (after line 247, before SVG)
```tsx
{/* Mode toggle - only show when points data available */}
{data.hasPoints && (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-xs text-muted">View:</span>
    <div className="flex rounded border border-border">
      <button
        onClick={() => setPointsMode(null)}
        className={`px-2 py-1 text-xs rounded-l ${
          pointsMode === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
      >
        Auto
      </button>
      <button
        onClick={() => setPointsMode(false)}
        className={`px-2 py-1 text-xs border-l border-border ${
          pointsMode === false ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
      >
        Count
      </button>
      <button
        onClick={() => setPointsMode(true)}
        disabled={!hasPointsData}
        className={`px-2 py-1 text-xs border-l border-border rounded-r ${
          pointsMode === true ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        } ${!hasPointsData ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Points
      </button>
    </div>
  </div>
)}
```

## Testing
1. Test Auto mode with points data - should show points
2. Test Auto mode without points data - should show count
3. Test Count override with points data - should show count
4. Test Points override - should show points
5. Test Points button disabled when no points data

## Acceptance Criteria
- ✅ Three-way toggle appears when points data available
- ✅ Auto mode uses current auto-detection
- ✅ Count mode forces story count view
- ✅ Points mode forces points view
- ✅ Points button disabled when no points data
- ✅ Chart updates correctly on mode change

## Effort Estimate
30 minutes | 30 lines of code | Low risk
