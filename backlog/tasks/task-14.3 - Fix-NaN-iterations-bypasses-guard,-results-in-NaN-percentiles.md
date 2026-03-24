---
id: task-14.3
title: 'Fix: NaN iterations bypasses guard, results in NaN percentiles'
status: Done
assignee: []
created_date: '2026-03-24 11:36'
updated_date: '2026-03-24 11:48'
labels:
  - edge-case
  - sprint-simulator
  - crash
dependencies: []
parent_task_id: task-14
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `sprint-simulator.ts:118`\n**Trigger:** iterations is NaN (NaN > 0 is false but NaN <= 0 also false)\n**Fix:** `if (!Number.isFinite(iterations) || iterations <= 0) return earlyResult;`\n**Consequence:** NaN bypasses guard, loop never runs, percentile index is NaN
<!-- SECTION:DESCRIPTION:END -->
