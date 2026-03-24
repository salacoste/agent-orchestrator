---
id: task-14.2
title: 'Fix: fractional iterations (0.5) causes empty array and undefined percentiles'
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
**File:** `sprint-simulator.ts:81`\n**Trigger:** iterations is fractional like 0.5 (truthy, passes >0 check)\n**Fix:** `const safeIter = Math.max(0, Math.floor(iterations));`\n**Consequence:** Loop runs 0 times but totals.sort and index access on empty array returns undefined
<!-- SECTION:DESCRIPTION:END -->
